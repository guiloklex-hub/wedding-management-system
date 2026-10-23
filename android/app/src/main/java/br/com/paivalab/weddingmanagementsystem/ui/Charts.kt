package br.com.paivalab.weddingmanagementsystem.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import br.com.paivalab.weddingmanagementsystem.R
import java.util.Locale
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

data class ChartSeries(val label: String, val color: Color, val values: List<Float>, val dashed: Boolean = false, val fill: Boolean = false)

/** Rótulo curto do eixo, como o `${(v / 1000).toFixed(0)}k` dos gráficos da web; recebe centavos. */
fun compactAmount(cents: Float): String {
    val value = cents / 100f
    return when {
        abs(value) >= 1_000_000f -> String.format(Locale.ROOT, "%.1fM", value / 1_000_000f)
        abs(value) >= 1_000f -> "${(value / 1_000f).roundToInt()}k"
        else -> value.roundToInt().toString()
    }
}

private class PlotArea(val left: Float, val top: Float, val right: Float, val bottom: Float, val minY: Float, val maxY: Float) {
    fun y(value: Float) = bottom - (value - minY) / (maxY - minY) * (bottom - top)
}

private fun range(values: List<Float>): Pair<Float, Float> {
    val low = min(0f, values.minOrNull() ?: 0f)
    val high = max(values.maxOrNull() ?: 0f, 0f)
    return low to if (high - low < 1f) low + 1f else high
}

private fun DrawScope.axes(area: PlotArea, measurer: TextMeasurer, style: TextStyle, grid: Color, yAxis: (Float) -> String) {
    listOf(area.minY, (area.minY + area.maxY) / 2, area.maxY).forEach { value ->
        val y = area.y(value)
        drawLine(grid, Offset(area.left, y), Offset(area.right, y), strokeWidth = 1.dp.toPx())
        val label = measurer.measure(yAxis(value), style)
        drawText(label, topLeft = Offset(area.left - label.size.width - 6.dp.toPx(), y - label.size.height / 2))
    }
    if (area.minY < 0f) drawLine(grid.copy(alpha = 1f), Offset(area.left, area.y(0f)), Offset(area.right, area.y(0f)), strokeWidth = 1.5.dp.toPx())
}

private fun DrawScope.xLabels(labels: List<String>, x: (Int) -> Float, measurer: TextMeasurer, style: TextStyle, top: Float) {
    if (labels.isEmpty()) return
    listOf(0, labels.size / 2, labels.lastIndex).distinct().forEach { index ->
        val label = measurer.measure(labels[index], style)
        val left = (x(index) - label.size.width / 2).coerceIn(0f, size.width - label.size.width)
        drawText(label, topLeft = Offset(left, top))
    }
}

@Composable
private fun axisGutter(measurer: TextMeasurer, style: TextStyle, minY: Float, maxY: Float, yAxis: (Float) -> String): Float {
    val widest = listOf(minY, maxY, (minY + maxY) / 2).maxOf { measurer.measure(yAxis(it), style).size.width }
    return widest + with(LocalDensity.current) { 10.dp.toPx() }
}

/** Legenda; com um ponto selecionado mostra o rótulo do eixo X e o valor de cada série. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChartLegend(series: List<ChartSeries>, xLabels: List<String>, selected: Int?, valueText: (ChartSeries, Float) -> String) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        if (selected != null) Text(xLabels[selected], style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            series.forEach { line ->
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    Box(Modifier.size(10.dp).background(line.color, CircleShape))
                    val value = selected?.let { line.values.getOrNull(it) }
                    Text(if (value == null) line.label else "${line.label}: ${valueText(line, value)}",
                        style = MaterialTheme.typography.bodySmall, color = PlannerMuted)
                }
            }
        }
        if (selected == null) Text(stringResource(R.string.insights_chart_hint), style = MaterialTheme.typography.labelSmall, color = PlannerMuted)
    }
}

/** Toque ou arraste escolhem o ponto; [index] recebe a posição X e a largura do gráfico. */
private fun Modifier.selectable(count: Int, gutter: Float, index: (Float, Float) -> Int, onSelect: (Int) -> Unit): Modifier =
    pointerInput(count, gutter) { detectTapGestures { onSelect(index(it.x, size.width.toFloat())) } }
        .pointerInput(count, gutter) { detectHorizontalDragGestures { change, _ -> onSelect(index(change.position.x, size.width.toFloat())) } }

/** Linhas (e área opcional) no estilo dos gráficos Recharts da web, com seleção por toque. */
@Composable
fun PlannerLineChart(
    xLabels: List<String>,
    series: List<ChartSeries>,
    description: String,
    valueText: (ChartSeries, Float) -> String,
    modifier: Modifier = Modifier,
    band: Pair<List<Float>, List<Float>>? = null,
    bandColor: Color = PlannerChampagne,
    yAxis: (Float) -> String = ::compactAmount,
) {
    var selected by rememberSaveable(xLabels.size) { mutableStateOf<Int?>(null) }
    val measurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelSmall.copy(color = PlannerMuted)
    val grid = PlannerBorder
    val guide = PlannerMuted
    val (minY, maxY) = range(series.flatMap { it.values } + band?.let { it.first + it.second }.orEmpty())
    val gutter = axisGutter(measurer, style, minY, maxY, yAxis)
    val count = xLabels.size
    fun x(index: Int, right: Float) = if (count <= 1) (gutter + right) / 2 else gutter + index * (right - gutter) / (count - 1)
    fun index(position: Float, width: Float) =
        if (count <= 1) 0 else ((position - gutter) / ((width - gutter) / (count - 1))).roundToInt().coerceIn(0, count - 1)
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Canvas(Modifier.fillMaxWidth().height(200.dp).semantics { contentDescription = description }
            .selectable(count, gutter, ::index) { selected = it }) {
            val labelHeight = measurer.measure("0", style).size.height.toFloat()
            val area = PlotArea(gutter, labelHeight / 2, size.width - 4.dp.toPx(), size.height - labelHeight - 6.dp.toPx(), minY, maxY)
            axes(area, measurer, style, grid, yAxis)
            band?.let { (lower, upper) ->
                val path = Path()
                upper.forEachIndexed { i, v -> if (i == 0) path.moveTo(x(i, area.right), area.y(v)) else path.lineTo(x(i, area.right), area.y(v)) }
                lower.indices.reversed().forEach { i -> path.lineTo(x(i, area.right), area.y(lower[i])) }
                path.close()
                drawPath(path, bandColor.copy(alpha = .15f))
            }
            series.forEach { line ->
                if (line.values.isEmpty()) return@forEach
                val path = Path()
                line.values.forEachIndexed { i, v -> if (i == 0) path.moveTo(x(i, area.right), area.y(v)) else path.lineTo(x(i, area.right), area.y(v)) }
                if (line.fill) {
                    val fill = Path().apply {
                        addPath(path)
                        lineTo(x(line.values.lastIndex, area.right), area.y(0f))
                        lineTo(x(0, area.right), area.y(0f))
                        close()
                    }
                    drawPath(fill, line.color.copy(alpha = .22f))
                }
                drawPath(path, line.color, style = Stroke(2.dp.toPx(), cap = StrokeCap.Round,
                    pathEffect = if (line.dashed) PathEffect.dashPathEffect(floatArrayOf(8.dp.toPx(), 6.dp.toPx())) else null))
                if (line.values.size == 1) drawCircle(line.color, 3.dp.toPx(), Offset(x(0, area.right), area.y(line.values[0])))
            }
            selected?.let { i ->
                val px = x(i, area.right)
                drawLine(guide, Offset(px, area.top), Offset(px, area.bottom), strokeWidth = 1.dp.toPx())
                series.forEach { line -> line.values.getOrNull(i)?.let { drawCircle(line.color, 4.dp.toPx(), Offset(px, area.y(it))) } }
            }
            xLabels(xLabels, { x(it, area.right) }, measurer, style, area.bottom + 4.dp.toPx())
        }
        ChartLegend(series, xLabels, selected, valueText)
    }
}

/** Barras para cima ([up]) e para baixo ([down]) por período, como "Entradas e saídas por mês". */
@Composable
fun PlannerFlowBars(
    xLabels: List<String>,
    up: ChartSeries,
    down: ChartSeries,
    highlight: List<Boolean>,
    description: String,
    valueText: (ChartSeries, Float) -> String,
    modifier: Modifier = Modifier,
) {
    var selected by rememberSaveable(xLabels.size) { mutableStateOf<Int?>(null) }
    val measurer = rememberTextMeasurer()
    val style = MaterialTheme.typography.labelSmall.copy(color = PlannerMuted)
    val grid = PlannerBorder
    val alert = PlannerRose
    val (minY, maxY) = range(up.values + down.values.map { -it })
    val gutter = axisGutter(measurer, style, minY, maxY, ::compactAmount)
    val count = xLabels.size
    fun index(position: Float, width: Float) =
        ((position - gutter) / ((width - gutter) / max(count, 1))).toInt().coerceIn(0, max(count - 1, 0))
    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Canvas(Modifier.fillMaxWidth().height(200.dp).semantics { contentDescription = description }
            .selectable(count, gutter, ::index) { selected = it }) {
            val labelHeight = measurer.measure("0", style).size.height.toFloat()
            val area = PlotArea(gutter, labelHeight / 2, size.width - 4.dp.toPx(), size.height - labelHeight - 6.dp.toPx(), minY, maxY)
            val step = (area.right - area.left) / max(count, 1)
            fun center(i: Int) = area.left + step * (i + .5f)
            highlight.forEachIndexed { i, on ->
                if (on) drawRect(alert.copy(alpha = .08f), Offset(area.left + step * i, area.top), Size(step, area.bottom - area.top))
            }
            axes(area, measurer, style, grid, ::compactAmount)
            val bar = step * .6f
            val zero = area.y(0f)
            (0 until count).forEach { i ->
                val alpha = if (selected == null || selected == i) 1f else .45f
                up.values.getOrNull(i)?.takeIf { it > 0f }?.let {
                    drawRect(up.color.copy(alpha = alpha), Offset(center(i) - bar / 2, area.y(it)), Size(bar, zero - area.y(it)))
                }
                down.values.getOrNull(i)?.takeIf { it > 0f }?.let {
                    drawRect(down.color.copy(alpha = alpha), Offset(center(i) - bar / 2, zero), Size(bar, area.y(-it) - zero))
                }
            }
            xLabels(xLabels, ::center, measurer, style, area.bottom + 4.dp.toPx())
        }
        ChartLegend(listOf(up, down), xLabels, selected, valueText)
    }
}

/** Anel do health score, como o `ScoreGauge` da web. */
@Composable
fun ScoreGauge(score: Int, color: Color, modifier: Modifier = Modifier) {
    val track = PlannerTrack
    Box(modifier.size(88.dp), contentAlignment = Alignment.Center) {
        Canvas(Modifier.size(88.dp)) {
            val stroke = 8.dp.toPx()
            val arc = Size(size.width - stroke, size.height - stroke)
            val topLeft = Offset(stroke / 2, stroke / 2)
            drawArc(track, 0f, 360f, false, topLeft, arc, style = Stroke(stroke))
            drawArc(color, -90f, 360f * score.coerceIn(0, 100) / 100f, false, topLeft, arc, style = Stroke(stroke, cap = StrokeCap.Round))
        }
        Text(score.toString(), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
    }
}
