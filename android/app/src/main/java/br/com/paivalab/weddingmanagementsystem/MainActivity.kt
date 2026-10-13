package br.com.paivalab.weddingmanagementsystem

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.os.Build
import android.graphics.Color
import android.os.Bundle
import android.provider.Settings
import android.util.Log
import android.widget.Toast
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.core.content.ContextCompat
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import androidx.activity.compose.setContent
import androidx.activity.SystemBarStyle
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.DisposableEffect
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import br.com.paivalab.weddingmanagementsystem.data.BlobStore
import br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerRepository
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.ui.PlannerApp
import br.com.paivalab.weddingmanagementsystem.ui.PlannerTheme
import br.com.paivalab.weddingmanagementsystem.ui.PlannerViewModel
import br.com.paivalab.weddingmanagementsystem.ui.UnlockScreen
import br.com.paivalab.weddingmanagementsystem.ui.isPlannerDark
import br.com.paivalab.weddingmanagementsystem.ui.localizedText
import br.com.paivalab.weddingmanagementsystem.notifications.ReminderWorker
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity() {
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private var unlocked by mutableStateOf(false)
    private var requestedSection by mutableStateOf<String?>(null)
    private var requestedRecordId by mutableStateOf<String?>(null)
    private var lastBackgroundAt = 0L
    private var afterAuthentication: (() -> Unit)? = null
    private var unlockLanguage = "pt-BR"
    private lateinit var database: PlannerDatabase
    private lateinit var blobs: BlobStore
    private lateinit var model: PlannerViewModel

    private val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL

    override fun onCreate(savedInstanceState: Bundle?) {
        enableEdgeToEdge()
        super.onCreate(savedInstanceState)
        unlocked = savedInstanceState?.getBoolean(STATE_UNLOCKED) ?: false
        lastBackgroundAt = savedInstanceState?.getLong(STATE_BACKGROUND_AT) ?: 0L
        database = PlannerDatabase.get(this)
        blobs = BlobStore(this)
        lifecycleScope.launch(Dispatchers.IO) {
            runCatching { blobs.migrateFromDatabase(database.dao()) }
                .onFailure { Log.e("MainActivity", "[blobs] migração de anexos falhou", it) }
        }
        val preferences = PlannerPreferences(this)
        val archive = BackupArchive(this, database, preferences)
        ReminderWorker.schedule(this)
        model = ViewModelProvider(
            this,
            PlannerViewModel.Factory(PlannerRepository(database, blobs), preferences),
        )[PlannerViewModel::class.java]
        handleIntent(intent)
        setContent {
            val themeMode by model.themeMode.collectAsState()
            val dark = isPlannerDark(themeMode)
            DisposableEffect(dark) {
                val style = SystemBarStyle.auto(Color.TRANSPARENT, Color.TRANSPARENT) { dark }
                enableEdgeToEdge(statusBarStyle = style, navigationBarStyle = style)
                onDispose { }
            }
            PlannerTheme(darkTheme = dark) {
                val language by model.locale.collectAsState()
                if (unlocked) {
                    PlannerApp(
                        model = model,
                        activity = this,
                        archive = archive,
                        authenticate = ::authenticate,
                        externalSection = requestedSection,
                        externalRecordId = requestedRecordId,
                        onExternalConsumed = { requestedSection = null; requestedRecordId = null },
                        onLoadDemoSeed = { model.loadDemoSeed(database, blobs) },
                    )
                } else {
                    UnlockScreen(
                        language = language,
                        canAuthenticate = BiometricManager.from(this@MainActivity).canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS,
                        onUnlock = { authenticate() },
                        onOpenSettings = { startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS)) },
                    )
                }
            }
        }
        lifecycleScope.launch {
            var initial = true
            preferences.locale.collect { language ->
                unlockLanguage = language
                if (AppCompatDelegate.getApplicationLocales().toLanguageTags() != language) {
                    AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(language))
                }
                if (initial) {
                    initial = false
                    if (!unlocked) authenticate()
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        if (intent == null) return
        intent.getStringExtra(EXTRA_RECORD_ID)?.takeIf { it.length in 1..100 }?.let { requestedRecordId = it }
        if (!BuildConfig.DEBUG) return
        if (intent.getBooleanExtra("skip_auth", false)) {
            unlocked = true
        }
        if (intent.getBooleanExtra("seed_demo", false)) {
            unlocked = true
            model.loadDemoSeed(database, blobs)
        }
        intent.getStringExtra("section")?.takeIf { it.isNotBlank() }?.let { target ->
            unlocked = true
            requestedSection = target
        }
    }

    override fun onStart() {
        super.onStart()
        if (lastBackgroundAt != 0L && System.currentTimeMillis() - lastBackgroundAt >= 5 * 60_000) {
            unlocked = false
        }
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        outState.putBoolean(STATE_UNLOCKED, unlocked)
        outState.putLong(STATE_BACKGROUND_AT, lastBackgroundAt)
    }

    override fun onStop() {
        lastBackgroundAt = System.currentTimeMillis()
        super.onStop()
    }

    private fun authenticate(onSuccess: (() -> Unit)? = null) {
        if (BiometricManager.from(this).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) {
            Toast.makeText(this, localizedText(this, R.string.device_lock_needed_action, unlockLanguage), Toast.LENGTH_LONG).show()
            return
        }
        afterAuthentication = onSuccess
        val prompt = BiometricPrompt(this, ContextCompat.getMainExecutor(this),
            object : BiometricPrompt.AuthenticationCallback() {
                override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
                    unlocked = true
                    if (Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(this@MainActivity,
                            Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    }
                    afterAuthentication?.invoke()
                    afterAuthentication = null
                }
                override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
                    afterAuthentication = null
                }
            })
        val info = BiometricPrompt.PromptInfo.Builder()
            .setTitle(localizedText(this, R.string.unlock_title, unlockLanguage))
            .setAllowedAuthenticators(authenticators)
            .build()
        prompt.authenticate(info)
    }

    companion object {
        /** Abre o registro indicado após o desbloqueio; usado pelas notificações. */
        const val EXTRA_RECORD_ID = "record_id"
        private const val STATE_UNLOCKED = "unlocked"
        private const val STATE_BACKGROUND_AT = "background_at"
    }
}
