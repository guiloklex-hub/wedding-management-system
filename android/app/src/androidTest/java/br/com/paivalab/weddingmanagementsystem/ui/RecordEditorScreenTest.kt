package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextInput
import androidx.test.espresso.Espresso.closeSoftKeyboard
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerRecord
import br.com.paivalab.weddingmanagementsystem.data.RecordIndex
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class RecordEditorScreenTest {
    @get:Rule val compose = createComposeRule()
    private val resources = InstrumentationRegistry.getInstrumentation().targetContext.resources

    @Test fun showsFieldErrorAndSavesOnlyValidRecord() {
        var saved: PlannerRecord? = null
        compose.setContent {
            PlannerTheme {
                RecordEditorScreen(
                    module = modules.first { it.kind == Kinds.TASK },
                    initial = null, initialParentId = null, index = RecordIndex(emptyList()), language = "pt-BR",
                    onClose = {}, onSave = { saved = it }, onDelete = {},
                )
            }
        }
        compose.onNodeWithText(resources.getString(R.string.save)).performClick()
        compose.onNodeWithText(resources.getString(R.string.err_required)).assertIsDisplayed()
        assertNull(saved)

        compose.onNodeWithText(resources.getString(R.string.title)).performTextInput("Provar o menu")
        // Na activity de teste o teclado desloca a janela e cobre os chips; o app usa edge-to-edge.
        closeSoftKeyboard()
        compose.onNodeWithText(resources.getString(R.string.priority_urgent)).performScrollTo().performClick()
        compose.onNodeWithText(resources.getString(R.string.save)).performClick()
        assertEquals("Provar o menu", saved?.title)
        assertEquals("URGENT", org.json.JSONObject(saved!!.extraJson).getString("priority"))
    }
}
