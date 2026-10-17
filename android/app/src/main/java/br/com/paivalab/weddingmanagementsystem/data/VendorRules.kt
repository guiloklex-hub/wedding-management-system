package br.com.paivalab.weddingmanagementsystem.data

/** As 23 categorias de `src/lib/categories.ts`, na mesma ordem, com a cor de cada uma. */
object VendorCategories {
    val colors: Map<String, Long> = linkedMapOf(
        "VENUE" to 0xFFA78BFA, "BUFFET" to 0xFFFB923C, "BARTENDER" to 0xFFF43F5E, "DECOR" to 0xFFEC4899,
        "PHOTO_VIDEO" to 0xFF0EA5E9, "MUSIC_DJ" to 0xFF8B5CF6, "DRESS" to 0xFFF472B6, "SUIT" to 0xFF64748B,
        "BEAUTY" to 0xFFFB7185, "RINGS" to 0xFFFACC15, "INVITES" to 0xFF22C55E, "STATIONERY" to 0xFF10B981,
        "FAVORS" to 0xFF06B6D4, "CAKE_SWEETS" to 0xFFE879F9, "TRANSPORT" to 0xFF84CC16, "CEREMONY" to 0xFFF59E0B,
        "CELEBRANT" to 0xFF3B82F6, "PLANNER" to 0xFF14B8A6, "HOTEL" to 0xFF6366F1, "HONEYMOON" to 0xFF0891B2,
        "GIFTS" to 0xFFD946EF, "INSURANCE" to 0xFF475569, "OTHER" to 0xFF71717A,
    )
    val keys: List<String> = colors.keys.toList()

    fun key(extra: org.json.JSONObject): String? = ExtraFields.text(extra, "categoryKey").takeIf { it in colors }
}

/** Situações de contrato, como `ContractStatusSchema` da web. */
object ContractRules {
    val unsigned = setOf("DRAFT", "SENT", "NEGOTIATING")
    const val DIGITAL = "DIGITAL"
    const val PHYSICAL = "PHYSICAL"

    fun signedStatus(method: String): String = when (method) {
        DIGITAL -> "SIGNED_DIGITAL"
        PHYSICAL -> "SIGNED_PHYSICAL"
        else -> throw IllegalArgumentException(method)
    }

    /** Versão de um contrato novo: um a mais que os contratos ativos do fornecedor, como `createContract`. */
    fun nextVersion(index: RecordIndex, vendorId: String?): Int =
        (vendorId?.let { index.children(it, Kinds.CONTRACT).size } ?: 0) + 1
}

/** Tipos de anexo aceitos pela web (`Attachment.kind`). */
object AttachmentKinds {
    const val CONTRACT = "CONTRACT"
    val choices = listOf("PROPOSAL", "RECEIPT", "INVOICE", "ID_DOC", "PHOTO", "OTHER")

    /** Arquivos gravados até a v1.2 usavam `ATTACHMENT`. */
    fun normalize(kind: String): String = kind.takeIf { it == CONTRACT || it in choices } ?: "OTHER"
}
