package br.com.paivalab.weddingmanagementsystem

import android.Manifest
import android.content.pm.PackageManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import androidx.biometric.BiometricManager
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.lifecycleScope
import br.com.paivalab.weddingmanagementsystem.data.PlannerDatabase
import br.com.paivalab.weddingmanagementsystem.data.PlannerPreferences
import br.com.paivalab.weddingmanagementsystem.data.PlannerRepository
import br.com.paivalab.weddingmanagementsystem.backup.BackupArchive
import br.com.paivalab.weddingmanagementsystem.ui.PlannerApp
import br.com.paivalab.weddingmanagementsystem.ui.PlannerTheme
import br.com.paivalab.weddingmanagementsystem.ui.PlannerViewModel
import br.com.paivalab.weddingmanagementsystem.ui.localized
import br.com.paivalab.weddingmanagementsystem.ui.localizedText
import br.com.paivalab.weddingmanagementsystem.notifications.ReminderWorker
import kotlinx.coroutines.flow.collect
import kotlinx.coroutines.launch

class MainActivity : FragmentActivity() {
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { }
    private var unlocked by mutableStateOf(false)
    private var requestedSection by mutableStateOf<String?>(null)
    private var lastBackgroundAt = 0L
    private var afterAuthentication: (() -> Unit)? = null
    private var unlockLanguage = "pt-BR"
    private lateinit var database: PlannerDatabase
    private lateinit var model: PlannerViewModel

    private val authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG or
        BiometricManager.Authenticators.DEVICE_CREDENTIAL

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        database = PlannerDatabase.get(this)
        val preferences = PlannerPreferences(this)
        val archive = BackupArchive(this, database, preferences)
        ReminderWorker.schedule(this)
        model = ViewModelProvider(
            this,
            PlannerViewModel.Factory(PlannerRepository(database), preferences),
        )[PlannerViewModel::class.java]
        handleDebugIntent(intent)
        setContent {
            PlannerTheme {
                val language by model.locale.collectAsState()
                if (unlocked) {
                    PlannerApp(
                        model = model,
                        activity = this,
                        archive = archive,
                        authenticate = ::authenticate,
                        externalSection = requestedSection,
                        onExternalSectionConsumed = { requestedSection = null },
                        onLoadDemoSeed = { model.loadDemoSeed(database) },
                    )
                } else {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Column(
                            modifier = Modifier.padding(32.dp),
                            horizontalAlignment = Alignment.CenterHorizontally,
                            verticalArrangement = Arrangement.spacedBy(20.dp),
                        ) {
                            Icon(Icons.Default.Favorite, null, tint = MaterialTheme.colorScheme.primary)
                            Text(localized(R.string.unlock_title, language), style = MaterialTheme.typography.headlineSmall)
                            val available = BiometricManager.from(this@MainActivity).canAuthenticate(authenticators) == BiometricManager.BIOMETRIC_SUCCESS
                            if (!available) {
                                Text(localized(R.string.device_lock_required, language))
                                Button(onClick = { startActivity(Intent(Settings.ACTION_SECURITY_SETTINGS)) }) {
                                    Text(localized(R.string.settings, language))
                                }
                            } else {
                                Button(onClick = { authenticate() }) {
                                    Text(localized(R.string.unlock_button, language))
                                }
                            }
                        }
                    }
                }
            }
        }
        lifecycleScope.launch {
            var initial = true
            preferences.locale.collect { language ->
                unlockLanguage = language
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
        handleDebugIntent(intent)
    }

    private fun handleDebugIntent(intent: Intent?) {
        if (intent == null) return
        if (intent.getBooleanExtra("skip_auth", false)) {
            unlocked = true
        }
        if (intent.getBooleanExtra("seed_demo", false)) {
            unlocked = true
            model.loadDemoSeed(database)
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

    override fun onStop() {
        lastBackgroundAt = System.currentTimeMillis()
        super.onStop()
    }

    private fun authenticate(onSuccess: (() -> Unit)? = null) {
        if (BiometricManager.from(this).canAuthenticate(authenticators) != BiometricManager.BIOMETRIC_SUCCESS) return
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
}
