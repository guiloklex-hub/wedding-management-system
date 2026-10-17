package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextInput
import androidx.test.espresso.Espresso.closeSoftKeyboard
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import br.com.paivalab.weddingmanagementsystem.R
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OnboardingScreenTest {
    @get:Rule val compose = createComposeRule()
    private val resources = InstrumentationRegistry.getInstrumentation().targetContext.resources

    @Test fun walksThroughStepsAndFinishesWithChosenValues() {
        var finished: List<Any>? = null
        compose.setContent {
            PlannerTheme {
                OnboardingScreen(
                    language = "pt-BR", currency = "BRL", onLanguage = {},
                    onFinish = { names, date, contingency, currency, seed -> finished = listOf(names, date, contingency, currency, seed) },
                    onDemo = {},
                )
            }
        }
        val next = resources.getString(R.string.onboarding_next)
        compose.onNodeWithText(resources.getString(R.string.couple_names)).performTextInput("Ana & Bia")
        // Na activity de teste o teclado desloca a janela e cobre os chips; o app usa edge-to-edge.
        closeSoftKeyboard()
        compose.onNodeWithText("€ (EUR)").performClick()
        compose.onNodeWithText(next).performClick()
        compose.onNodeWithText(resources.getString(R.string.onboarding_contingency_value, 10)).assertIsDisplayed()
        compose.onNodeWithText(next).performClick()
        // Sem data, o app não oferece gerar tarefas com prazo.
        compose.onNodeWithText(resources.getString(R.string.onboarding_seed_needs_date)).assertIsDisplayed()
        compose.onNodeWithText(next).performClick()
        compose.onNodeWithText("Ana & Bia").assertIsDisplayed()
        compose.onNodeWithText(resources.getString(R.string.onboarding_finish)).performClick()
        assertEquals(listOf("Ana & Bia", "", 10, "EUR", false), finished)
    }
}
