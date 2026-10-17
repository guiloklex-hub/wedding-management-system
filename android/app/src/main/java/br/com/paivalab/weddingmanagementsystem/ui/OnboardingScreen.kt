package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.wrapContentWidth
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import java.time.LocalDate
import kotlin.math.roundToInt

internal val languageOptions = listOf("pt-BR" to "Português (BR)", "en" to "English", "es" to "Español")
internal val currencyOptions = listOf("BRL" to "R$ (BRL)", "USD" to "US$ (USD)", "EUR" to "€ (EUR)")

private val stepTitles = listOf(R.string.onboarding_step_couple, R.string.onboarding_step_budget,
    R.string.onboarding_step_start, R.string.onboarding_step_done)

/**
 * Assistente da primeira execução, nos moldes do onboarding web. O passo de
 * e-mail e WhatsApp da web vira "primeiros passos": no Android tudo é local.
 */
@Composable
fun OnboardingScreen(
    language: String,
    currency: String,
    onLanguage: (String) -> Unit,
    onFinish: (coupleNames: String, eventDate: String, contingency: Int, currency: String, seedTasks: Boolean) -> Unit,
    onDemo: () -> Unit,
) {
    var step by rememberSaveable { mutableIntStateOf(0) }
    var names by rememberSaveable { mutableStateOf("") }
    var date by rememberSaveable { mutableStateOf("") }
    var chosenCurrency by rememberSaveable { mutableStateOf(currency) }
    var contingency by rememberSaveable { mutableIntStateOf(10) }
    var seedTasks by rememberSaveable { mutableStateOf(true) }
    var dateError by rememberSaveable { mutableStateOf(false) }
    var confirmDemo by rememberSaveable { mutableStateOf(false) }
    val parsedDate = runCatching { LocalDate.parse(normalizeDateInput(date)) }.getOrNull()
    val scroll = rememberScrollState()
    val focus = LocalFocusManager.current
    LaunchedEffect(step) {
        focus.clearFocus()
        scroll.scrollTo(0)
    }

    // Fora do Scaffold não há cor de conteúdo definida; sem o Surface o título fica preto no tema escuro.
    Surface(Modifier.fillMaxSize(), color = PlannerBackground, contentColor = PlannerOnSurface) {
    Column(
        Modifier.fillMaxSize().safeDrawingPadding().verticalScroll(scroll)
            .wrapContentWidth(Alignment.CenterHorizontally).widthIn(max = 640.dp).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(stringResource(R.string.onboarding_title), style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold,
            modifier = Modifier.semantics { heading() })
        Stepper(step)
        Card(
            colors = CardDefaults.cardColors(containerColor = PlannerSurface),
            border = BorderStroke(1.dp, PlannerBorder),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                when (step) {
                    0 -> {
                        StepHeader(R.string.onboarding_couple_title, R.string.onboarding_couple_body)
                        EditorTextField(names, { names = it.take(EditorLimits.NAME) }, stringResource(R.string.couple_names), null)
                        DatePickerOutlinedField(date, { date = it; dateError = false }, stringResource(R.string.event_date),
                            error = if (dateError) stringResource(R.string.err_date) else null)
                        Text(stringResource(R.string.currency), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            currencyOptions.forEach { (option, label) ->
                                FilterChip(selected = chosenCurrency == option, onClick = { chosenCurrency = option }, label = { Text(label) })
                            }
                        }
                        Text(stringResource(R.string.language), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            languageOptions.forEach { (option, label) ->
                                FilterChip(selected = language == option, onClick = { onLanguage(option) }, label = { Text(label) })
                            }
                        }
                    }
                    1 -> {
                        StepHeader(R.string.onboarding_budget_title, R.string.onboarding_budget_body)
                        Text(stringResource(R.string.onboarding_contingency_value, contingency), fontWeight = FontWeight.SemiBold,
                            color = PlannerRose)
                        Slider(
                            value = contingency.toFloat(),
                            onValueChange = { contingency = it.roundToInt() },
                            valueRange = 0f..30f,
                            modifier = Modifier.semantics { stateDescription = "$contingency%" },
                        )
                        Text(stringResource(R.string.onboarding_contingency_hint), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                    }
                    2 -> {
                        StepHeader(R.string.onboarding_start_title, R.string.onboarding_start_body)
                        if (parsedDate != null) {
                            ToggleChip(stringResource(R.string.onboarding_seed_tasks), seedTasks) { seedTasks = it }
                        } else {
                            Text(stringResource(R.string.onboarding_seed_needs_date), style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                        }
                        InfoLine(R.string.onboarding_offline)
                        InfoLine(R.string.onboarding_backup)
                        InfoLine(R.string.onboarding_reminders)
                        OutlinedButton(onClick = { confirmDemo = true }, modifier = Modifier.fillMaxWidth()) {
                            Text(stringResource(R.string.onboarding_demo))
                        }
                    }
                    else -> {
                        StepHeader(R.string.onboarding_done_title, R.string.onboarding_done_body)
                        SummaryLine(R.string.couple_names, names.ifBlank { "—" })
                        SummaryLine(R.string.event_date, parsedDate?.let { formatDisplayDate(it.toString(), language) } ?: "—")
                        SummaryLine(R.string.currency, chosenCurrency)
                        SummaryLine(R.string.onboarding_step_budget, "$contingency%")
                        if (seedTasks && parsedDate != null) SummaryLine(R.string.tasks, stringResource(R.string.onboarding_summary_seeded))
                    }
                }
            }
        }
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            if (step > 0) {
                OutlinedButton(onClick = { step-- }, modifier = Modifier.weight(1f)) { Text(stringResource(R.string.back)) }
            }
            Button(
                onClick = {
                    if (step == 0 && date.isNotBlank() && parsedDate == null) {
                        dateError = true
                    } else if (step < stepTitles.lastIndex) {
                        step++
                    } else {
                        onFinish(names.trim(), parsedDate?.toString().orEmpty(), contingency, chosenCurrency, seedTasks && parsedDate != null)
                    }
                },
                modifier = Modifier.weight(1f),
            ) { Text(stringResource(if (step < stepTitles.lastIndex) R.string.onboarding_next else R.string.onboarding_finish)) }
        }
    }
    }

    if (confirmDemo) {
        AlertDialog(
            onDismissRequest = { confirmDemo = false },
            text = { Text(stringResource(R.string.demo_seed_confirm)) },
            confirmButton = {
                TextButton(onClick = { confirmDemo = false; onDemo() }) { Text(stringResource(R.string.demo_seed_button)) }
            },
            dismissButton = { TextButton(onClick = { confirmDemo = false }) { Text(stringResource(R.string.cancel)) } },
        )
    }
}

@Composable
private fun Stepper(current: Int) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        PlannerProgressBar((current + 1f) / stepTitles.size, PlannerRose, height = 6.dp)
        Text(
            stringResource(R.string.onboarding_step_of, current + 1, stepTitles.size, stringResource(stepTitles[current])),
            style = MaterialTheme.typography.labelMedium, color = PlannerMuted,
        )
    }
}

@Composable
private fun StepHeader(title: Int, body: Int) {
    Text(stringResource(title), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold, color = PlannerChampagne,
        modifier = Modifier.semantics { heading() })
    Text(stringResource(body), style = MaterialTheme.typography.bodyMedium, color = PlannerMuted)
}

@Composable
private fun InfoLine(text: Int) {
    Text(stringResource(text), style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun SummaryLine(label: Int, value: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(stringResource(label), color = PlannerMuted)
        Text(value, fontWeight = FontWeight.SemiBold, textAlign = TextAlign.End, modifier = Modifier.weight(1f))
    }
}
