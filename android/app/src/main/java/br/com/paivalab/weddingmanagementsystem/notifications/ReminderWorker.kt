package br.com.paivalab.weddingmanagementsystem.notifications

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import br.com.paivalab.weddingmanagementsystem.MainActivity
import br.com.paivalab.weddingmanagementsystem.R
import br.com.paivalab.weddingmanagementsystem.data.Kinds
import br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.ui.localizedText
import java.time.LocalDate
import java.util.concurrent.TimeUnit
import kotlinx.coroutines.flow.first

class ReminderWorker(context: Context, parameters: WorkerParameters) : CoroutineWorker(context, parameters) {
    override suspend fun doWork(): Result {
        val manager = applicationContext.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(NotificationChannel("planner_reminders", applicationContext.getString(R.string.app_name),
            NotificationManager.IMPORTANCE_DEFAULT))
        if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(applicationContext,
                Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return Result.success()
        val preferences = PlannerPreferences(applicationContext)
        val language = preferences.locale.first()
        val dao = PlannerDatabase.get(applicationContext).dao()
        val records = dao.allRecords().filter { it.deletedAt == null }
        val now = System.currentTimeMillis()
        val lastBackup = preferences.lastBackupAt.first()
        val lastReminder = preferences.lastBackupReminderAt.first()
        val changed = dao.allAudit().any { it.at > lastBackup }
        if (changed && now - lastBackup >= TimeUnit.DAYS.toMillis(7) &&
            now - lastReminder >= TimeUnit.DAYS.toMillis(7)) {
            send(manager, 1, localizedText(applicationContext, R.string.backup_weekly_reminder, language),
                localizedText(applicationContext, R.string.backup_weekly_body, language))
            preferences.markBackupReminder()
        }
        val today = LocalDate.now()
        records.filter { it.kind in setOf(Kinds.PAYMENT, Kinds.TASK) && it.status !in setOf("PAID", "DONE") }
            .filter { record -> record.date?.let { runCatching { LocalDate.parse(it) }.getOrNull() }?.let {
                !it.isBefore(today) && !it.isAfter(today.plusDays(2)) } == true }
            .take(10).forEach { record ->
                send(manager, (record.id + today.toString()).hashCode(),
                    localizedText(applicationContext, R.string.upcoming, language), record.title)
            }
        return Result.success()
    }

    private fun send(manager: NotificationManager, id: Int, title: String, body: String) {
        val intent = Intent(applicationContext, MainActivity::class.java)
        val pending = PendingIntent.getActivity(applicationContext, id, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
        val notification = NotificationCompat.Builder(applicationContext, "planner_reminders")
            .setSmallIcon(R.drawable.ic_heart_notification)
            .setContentTitle(title).setContentText(body).setContentIntent(pending).setAutoCancel(true)
            .setVisibility(NotificationCompat.VISIBILITY_PRIVATE).build()
        manager.notify(id, notification)
    }

    companion object {
        fun schedule(context: Context) {
            val workManager = WorkManager.getInstance(context)
            workManager.enqueueUniquePeriodicWork("planner_reminders", ExistingPeriodicWorkPolicy.KEEP,
                PeriodicWorkRequestBuilder<ReminderWorker>(1, TimeUnit.DAYS).build())
            workManager.enqueue(OneTimeWorkRequestBuilder<ReminderWorker>().build())
        }
    }
}
