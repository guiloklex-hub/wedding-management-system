package br.com.paivalab.weddingmanagementsystem.data

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class VendorRulesTest {
    @Test fun categoriesMatchTheWebList() {
        assertEquals(23, VendorCategories.keys.size)
        assertEquals("VENUE", VendorCategories.keys.first())
        assertEquals("OTHER", VendorCategories.keys.last())
        assertEquals("PHOTO_VIDEO", VendorCategories.key(ExtraFields.parse("""{"categoryKey":"PHOTO_VIDEO"}""")))
        assertNull(VendorCategories.key(ExtraFields.parse("""{"categoryKey":"FOTOGRAFIA"}""")))
    }

    @Test fun contractSigningAndVersions() {
        assertEquals("SIGNED_DIGITAL", ContractRules.signedStatus(ContractRules.DIGITAL))
        assertEquals("SIGNED_PHYSICAL", ContractRules.signedStatus(ContractRules.PHYSICAL))
        val index = RecordIndex(listOf(
            PlannerRecord("v", Kinds.VENDOR, "Buffet"),
            PlannerRecord("c1", Kinds.CONTRACT, "Proposta", parentId = "v"),
            PlannerRecord("c2", Kinds.CONTRACT, "Aditivo", parentId = "v"),
        ))
        assertEquals(3, ContractRules.nextVersion(index, "v"))
        assertEquals(1, ContractRules.nextVersion(index, null))
    }

    @Test fun legacyAttachmentKindBecomesWebValue() {
        assertEquals("OTHER", AttachmentKinds.normalize("ATTACHMENT"))
        assertEquals("RECEIPT", AttachmentKinds.normalize("RECEIPT"))
        assertEquals("CONTRACT", AttachmentKinds.normalize("CONTRACT"))
    }
}
