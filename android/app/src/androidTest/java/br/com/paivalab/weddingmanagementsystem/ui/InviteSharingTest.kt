package br.com.paivalab.weddingmanagementsystem.ui

import android.content.Intent
import android.net.Uri
import androidx.core.content.IntentCompat
import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerFile
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class InviteSharingTest {
    @Test
    fun invitationAttachmentIsIncludedInShareIntent() {
        val context = ApplicationProvider.getApplicationContext<android.content.Context>()
        val template = PlannerRecord("invitation", Kinds.INVITATION, "Convite", notes = "Olá, {nome}!")
        val guest = PlannerRecord("guest", Kinds.GUEST, "Ana")
        val file = PlannerFile("file", template.id, "ATTACHMENT", "convite.pdf", "application/pdf", 3L, "hash")
        val uri = Uri.parse("content://example.test/convite.pdf")
        val intent = buildInviteAttachmentIntent(context, template, guest, file, uri)

        assertEquals(Intent.ACTION_SEND, intent.action)
        assertEquals("application/pdf", intent.type)
        assertEquals("Olá, Ana!", intent.getStringExtra(Intent.EXTRA_TEXT))
        assertEquals(uri, IntentCompat.getParcelableExtra(intent, Intent.EXTRA_STREAM, Uri::class.java))
        assertNotNull(intent.clipData)
        assertTrue(intent.flags and Intent.FLAG_GRANT_READ_URI_PERMISSION != 0)
    }
}
