package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import android.net.Uri
import java.io.ByteArrayInputStream
import java.io.ByteArrayOutputStream
import java.util.zip.ZipInputStream
import javax.xml.parsers.DocumentBuilderFactory
import org.w3c.dom.Element

data class ImportedGuest(
    val name: String,
    val groupName: String?,
    val phone: String,
    val email: String,
    val status: String,
    val plusOnes: Int = 0,
    val tags: List<String> = emptyList(),
    val extra: Map<String, String> = emptyMap(),
)

data class GuestImportPreview(val source: String, val guests: List<ImportedGuest>)

object GuestImport {
    fun read(context: Context, uri: Uri): GuestImportPreview {
        val bytes = context.contentResolver.openInputStream(uri)?.use { readLimited(it, 5_000_000) }
            ?: error("Não foi possível ler o arquivo")
        val table = if (bytes.size >= 4 && bytes[0] == 0x50.toByte() && bytes[1] == 0x4b.toByte()) {
            parseXlsx(bytes)
        } else {
            parseCsv(bytes.toString(Charsets.UTF_8).removePrefix("\uFEFF"))
        }
        require(table.size in 2..2001) { "Arquivo sem convidados ou com mais de 2000 linhas" }
        val headers = table.first().map(String::trim)
        val source = when {
            listOf("Nome do convite", "Nome completo do convidado", "Status", "Telefone", "E-mail", "Tags")
                .all(headers::contains) -> "wedy"
            listOf("Nome", "Status", "Grupo").all(headers::contains) -> "csv"
            else -> error("Colunas CSV/Wedy não reconhecidas")
        }
        val guests = table.drop(1).mapNotNull { row ->
            val values = headers.mapIndexed { index, header -> header to row.getOrElse(index) { "" }.trim() }.toMap()
            val name = (values[if (source == "wedy") "Nome completo do convidado" else "Nome"] ?: "").take(160)
            if (name.isBlank()) return@mapNotNull null
            val group = values[if (source == "wedy") "Nome do convite" else "Grupo"]?.take(80)?.ifBlank { null }
            val rawStatus = values["Status"].orEmpty().lowercase()
            val status = when (rawStatus) {
                "confirmado", "confirmada", "vai" -> "CONFIRMED"
                "recusado", "recusada", "recusou", "não vai", "nao vai" -> "DECLINED"
                "talvez" -> "MAYBE"
                "não convidado", "nao convidado" -> "NOT_INVITED"
                else -> "INVITED"
            }
            val plus = values["+1 confirmados"]?.toIntOrNull()?.coerceIn(0, 10) ?: 0
            val tags = if (source == "wedy") values["Tags"].orEmpty().split(',').map(String::trim).filter(String::isNotBlank).take(20)
                else if (values["Padrinho"].orEmpty().lowercase() in setOf("sim", "yes", "true", "1")) listOf("Padrinhos") else emptyList()
            ImportedGuest(name, group,
                values["Telefone"].orEmpty().take(40),
                values[if (source == "wedy") "E-mail" else "Email"].orEmpty().take(160),
                status, plus, tags,
                values.filterKeys { it !in setOf("Pin do convite") })
        }
        require(guests.isNotEmpty()) { "Nenhum convidado válido" }
        return GuestImportPreview(source, guests)
    }

    internal fun parseCsv(text: String): List<List<String>> {
        val firstLine = text.lineSequence().firstOrNull().orEmpty()
        val delimiter = if (firstLine.count { it == ';' } > firstLine.count { it == ',' }) ';' else ','
        val rows = mutableListOf<List<String>>()
        val row = mutableListOf<String>()
        val cell = StringBuilder()
        var quoted = false
        var index = 0
        while (index < text.length) {
            val char = text[index]
            when {
                char == '"' && quoted && index + 1 < text.length && text[index + 1] == '"' -> {
                    cell.append('"'); index++
                }
                char == '"' -> quoted = !quoted
                char == delimiter && !quoted -> { row.add(cell.toString()); cell.clear() }
                char == '\n' && !quoted -> {
                    row.add(cell.toString().removeSuffix("\r")); cell.clear()
                    if (row.any(String::isNotBlank)) rows.add(row.toList())
                    row.clear()
                }
                else -> cell.append(char)
            }
            index++
            require(rows.size <= 2001) { "Mais de 2000 linhas" }
        }
        require(!quoted) { "Aspas CSV não fechadas" }
        row.add(cell.toString().removeSuffix("\r"))
        if (row.any(String::isNotBlank)) rows.add(row)
        return rows
    }

    private fun parseXlsx(bytes: ByteArray): List<List<String>> {
        var strings: ByteArray? = null
        var sheet: ByteArray? = null
        var total = 0
        ZipInputStream(ByteArrayInputStream(bytes)).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                val data = readLimited(zip, 20_000_000 - total)
                total += data.size
                require(total <= 20_000_000) { "Planilha grande demais" }
                if (entry.name == "xl/sharedStrings.xml" || entry.name == "xl/worksheets/sheet1.xml") {
                    if (entry.name.endsWith("sharedStrings.xml")) strings = data else sheet = data
                }
                zip.closeEntry()
            }
        }
        val shared = strings?.let { parseXml(it).getElementsByTagNameNS("*", "si") }
        val sharedValues = if (shared == null) emptyList() else (0 until shared.length).map { shared.item(it).textContent ?: "" }
        val root = parseXml(sheet ?: error("Planilha Wedy sem sheet1.xml"))
        val rows = root.getElementsByTagNameNS("*", "row")
        require(rows.length <= 2001) { "Mais de 2000 linhas" }
        return (0 until rows.length).map { index ->
            val cells = (rows.item(index) as Element).getElementsByTagNameNS("*", "c")
            val columns = mutableMapOf<Int, String>()
            for (cellIndex in 0 until cells.length) {
                val cell = cells.item(cellIndex) as Element
                val column = cell.getAttribute("r").takeWhile(Char::isLetter).fold(0) { acc, letter ->
                    acc * 26 + letter.uppercaseChar().code - 'A'.code + 1
                } - 1
                if (column !in 0..99) continue
                val value = cell.getElementsByTagNameNS("*", "v").item(0)?.textContent
                    ?: cell.getElementsByTagNameNS("*", "is").item(0)?.textContent.orEmpty()
                columns[column] = if (cell.getAttribute("t") == "s") sharedValues.getOrElse(value.toIntOrNull() ?: -1) { "" } else value
            }
            (0..(columns.keys.maxOrNull() ?: -1)).map { columns[it].orEmpty() }
        }
    }

    private fun parseXml(bytes: ByteArray): org.w3c.dom.Document {
        require(bytes.none { it == 0.toByte() }) { "XML inválido" }
        val xml = String(bytes, Charsets.UTF_8)
        require(!Regex("<!\\s*(DOCTYPE|ENTITY)\\b", RegexOption.IGNORE_CASE).containsMatchIn(xml)) {
            "Declaração XML externa não permitida"
        }
        return DocumentBuilderFactory.newInstance().apply {
            isNamespaceAware = true
            isExpandEntityReferences = false
        }.newDocumentBuilder().parse(ByteArrayInputStream(bytes))
    }

    private fun readLimited(input: java.io.InputStream, max: Int): ByteArray {
        val output = ByteArrayOutputStream()
        val chunk = ByteArray(8192)
        while (true) {
            val count = input.read(chunk)
            if (count < 0) break
            require(output.size() + count <= max) { "Arquivo grande demais" }
            output.write(chunk, 0, count)
        }
        return output.toByteArray()
    }
}
