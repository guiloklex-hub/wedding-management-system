package br.com.paivalab.weddingmanagementsystem.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.longPreferencesKey
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.map

private val Context.plannerPreferences by preferencesDataStore("planner_preferences")

class PlannerPreferences(private val context: Context) {
    private val localeKey = stringPreferencesKey("locale")
    private val currencyKey = stringPreferencesKey("currency")
    private val lastBackupKey = longPreferencesKey("last_backup_at")
    private val lastReminderKey = longPreferencesKey("last_backup_reminder_at")

    val locale: Flow<String> = context.plannerPreferences.data.map { it[localeKey] ?: "pt-BR" }
    val currency: Flow<String> = context.plannerPreferences.data.map { it[currencyKey] ?: "BRL" }
    val lastBackupAt: Flow<Long> = context.plannerPreferences.data.map { it[lastBackupKey] ?: 0L }
    val lastBackupReminderAt: Flow<Long> = context.plannerPreferences.data.map { it[lastReminderKey] ?: 0L }

    suspend fun setLocale(value: String) {
        require(value in setOf("pt-BR", "en", "es"))
        context.plannerPreferences.edit { it[localeKey] = value }
    }

    suspend fun setCurrency(value: String) {
        require(value in setOf("BRL", "USD", "EUR"))
        context.plannerPreferences.edit { it[currencyKey] = value }
    }

    suspend fun markBackup() {
        context.plannerPreferences.edit { it[lastBackupKey] = System.currentTimeMillis() }
    }

    suspend fun markBackupReminder() {
        context.plannerPreferences.edit { it[lastReminderKey] = System.currentTimeMillis() }
    }
}
