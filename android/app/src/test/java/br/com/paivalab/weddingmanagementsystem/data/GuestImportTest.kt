package br.com.paivalab.weddingmanagementsystem.data

import org.junit.Assert.assertEquals
import org.junit.Test

class GuestImportTest {
    @Test fun quotedCellsAndSemicolonDelimiter() {
        val rows = GuestImport.parseCsv("Nome;Grupo;Notas\n\"Ana; Maria\";Família;\"linha 1\nlinha 2\"\n")
        assertEquals("Ana; Maria", rows[1][0])
        assertEquals("linha 1\nlinha 2", rows[1][2])
    }
}
