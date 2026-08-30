const {
  withAndroidManifest,
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require("@expo/config-plugins");
const fs = require("fs");
const path = require("path");

const PACKAGE_NAME = "com.bibliaofflinevoz.nativebridge";
const SOURCE_DIRECTORY = "com/bibliaofflinevoz/nativebridge";

// Alinhado com a tabela oficial do Nearby Connections:
// https://developers.google.com/nearby/connections/android/get-started
const manifestPermissions = [
  ["android.permission.RECORD_AUDIO"],
  ["android.permission.BLUETOOTH", { "android:maxSdkVersion": "30" }],
  ["android.permission.BLUETOOTH_ADMIN", { "android:maxSdkVersion": "30" }],
  ["android.permission.ACCESS_WIFI_STATE"],
  ["android.permission.CHANGE_WIFI_STATE"],
  // SEM maxSdkVersion de proposito. A tabela oficial do Google limita
  // COARSE em 28 e FINE em 31, mas o Nearby continua exigindo localizacao
  // acima disso: startDiscovery falha com
  // MISSING_PERMISSION_ACCESS_COARSE_LOCATION (8034).
  // Ver https://github.com/android/connectivity-samples/issues/297
  ["android.permission.ACCESS_FINE_LOCATION"],
  ["android.permission.ACCESS_COARSE_LOCATION"],
  ["android.permission.BLUETOOTH_SCAN"],
  ["android.permission.BLUETOOTH_CONNECT"],
  ["android.permission.BLUETOOTH_ADVERTISE"],
  ["android.permission.NEARBY_WIFI_DEVICES"],
  ["android.permission.FOREGROUND_SERVICE"],
  ["android.permission.FOREGROUND_SERVICE_CONNECTED_DEVICE"],
  ["android.permission.POST_NOTIFICATIONS"],
];

const packageSource = `package ${PACKAGE_NAME}

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class BibliaNativePackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
    listOf(OfflineSpeechModule(reactContext), NearbyConnectionsModule(reactContext))

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> =
    emptyList()
}
`;

const speechSource = `package ${PACKAGE_NAME}

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Handler
import android.os.Looper
import android.os.Build
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.UiThreadUtil
import com.facebook.react.modules.core.DeviceEventManagerModule

class OfflineSpeechModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context), RecognitionListener {
  private var recognizer: SpeechRecognizer? = null
  private val handler = Handler(Looper.getMainLooper())
  private var listening = false
  private var timedOut = false
  private val timeout = Runnable {
    if (listening) {
      timedOut = true
      recognizer?.cancel()
      listening = false
      emit("speechError", Arguments.createMap().apply {
        putString("code", "TIMEOUT")
        putString("message", "O limite de 15 segundos foi atingido.")
      })
    }
  }

  override fun getName() = "OfflineSpeech"

  @ReactMethod
  fun isRecognitionAvailable(promise: Promise) {
    val available = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
    } else {
      SpeechRecognizer.isRecognitionAvailable(context)
    }
    promise.resolve(available)
  }

  @ReactMethod
  fun startListening(promise: Promise) {
    if (context.checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
      promise.reject("PERMISSION_DENIED", "RECORD_AUDIO must be granted by JavaScript before listening.")
      return
    }
    val offlineAvailable = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      SpeechRecognizer.isOnDeviceRecognitionAvailable(context)
    } else {
      SpeechRecognizer.isRecognitionAvailable(context)
    }
    if (!offlineAvailable) {
      promise.reject("OFFLINE_UNAVAILABLE", "Instale o pacote de reconhecimento de voz offline em português nas configurações do Android.")
      return
    }
    UiThreadUtil.runOnUiThread {
      try {
        destroyRecognizer()
        recognizer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
          SpeechRecognizer.createOnDeviceSpeechRecognizer(context)
        } else {
          SpeechRecognizer.createSpeechRecognizer(context)
        }
        recognizer?.setRecognitionListener(this)
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, "pt-BR")
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_PREFERENCE, "pt-BR")
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_PREFER_OFFLINE, true)
        }
        timedOut = false
        listening = true
        handler.postDelayed(timeout, 15_000)
        recognizer?.startListening(intent)
        promise.resolve(null)
      } catch (error: Exception) {
        listening = false
        handler.removeCallbacks(timeout)
        promise.reject("START_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stopListening(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      handler.removeCallbacks(timeout)
      listening = false
      recognizer?.stopListening()
      promise.resolve(null)
    }
  }

  @ReactMethod
  fun cancelListening(promise: Promise) {
    UiThreadUtil.runOnUiThread {
      handler.removeCallbacks(timeout)
      listening = false
      recognizer?.cancel()
      promise.resolve(null)
    }
  }

  // Required by React Native's NativeEventEmitter. Events are emitted only while JS subscribes.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  override fun onPartialResults(results: android.os.Bundle?) = emitResults("speechPartialResult", results)
  override fun onResults(results: android.os.Bundle?) {
    handler.removeCallbacks(timeout)
    listening = false
    emitResults("speechResult", results)
  }
  override fun onError(error: Int) {
    handler.removeCallbacks(timeout)
    listening = false
    if (timedOut) {
      timedOut = false
      return
    }
    emit("speechError", Arguments.createMap().apply {
      putInt("code", error)
      putString("message", errorMessage(error))
    })
  }
  override fun onReadyForSpeech(params: android.os.Bundle?) = Unit
  override fun onBeginningOfSpeech() = Unit
  override fun onRmsChanged(rmsdB: Float) = Unit
  override fun onBufferReceived(buffer: ByteArray?) = Unit
  override fun onEndOfSpeech() = Unit
  override fun onEvent(eventType: Int, params: android.os.Bundle?) = Unit

  private fun emitResults(event: String, results: android.os.Bundle?) {
    val matches = results?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf()
    emit(event, Arguments.createMap().apply {
      putArray("results", Arguments.fromList(matches))
      putBoolean("isFinal", event == "speechResult")
    })
  }

  private fun errorMessage(error: Int) = when (error) {
    SpeechRecognizer.ERROR_AUDIO -> "Não foi possível capturar o áudio."
    SpeechRecognizer.ERROR_CLIENT -> "O reconhecimento de voz foi interrompido."
    SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "A permissão do microfone foi negada."
    SpeechRecognizer.ERROR_NETWORK, SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "O pacote offline pt-BR não está disponível. Instale-o nas configurações de voz do Android."
    SpeechRecognizer.ERROR_NO_MATCH -> "Nenhuma fala foi reconhecida."
    SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "O reconhecedor de voz está ocupado. Tente novamente."
    SpeechRecognizer.ERROR_SERVER -> "O serviço de reconhecimento offline não respondeu."
    SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "Nenhuma fala foi detectada."
    else -> "A transcrição falhou (código $error)."
  }

  private fun emit(event: String, value: Any) {
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, value)
  }

  private fun destroyRecognizer() {
    handler.removeCallbacks(timeout)
    recognizer?.destroy()
    recognizer = null
  }

  override fun invalidate() {
    UiThreadUtil.runOnUiThread { destroyRecognizer() }
    super.invalidate()
  }
}
`;

const nearbySource = `package ${PACKAGE_NAME}

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import com.google.android.gms.nearby.connection.Strategy
import com.google.android.gms.tasks.Tasks
import java.nio.charset.StandardCharsets

class NearbyConnectionsModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val client: ConnectionsClient = Nearby.getConnectionsClient(context)
  private val connectedEndpoints = mutableSetOf<String>()
  private val pendingEndpoints = mutableSetOf<String>()
  private val endpointNames = mutableMapOf<String, String>()
  private val endpointKeys = mutableMapOf<String, String>()
  // Conexoes aguardando a confirmacao humana do codigo. O Google e explicito:
  // conexoes aceitas sem autenticacao sao inseguras.
  private val awaitingAuth = mutableSetOf<String>()
  private var localName: String = "Aparelho"
  private var backgroundEnabled = false
  // Identidade persistente do aparelho, vinda do JS. Serve para duas coisas:
  // (1) desempate da corrida simetrica do P2P_CLUSTER, onde so o token menor
  // inicia a conexao; (2) chave estavel do contato, porque o endpointId do
  // Nearby muda a cada sessao e nao serve para historico nem fila offline.
  private var localToken: String = java.util.UUID.randomUUID().toString()
  private var advertising = false
  private var discovering = false

  private fun statusCodeOf(error: Exception): Int =
    (error as? com.google.android.gms.common.api.ApiException)?.statusCode ?: -1

  private fun displayName(): String = localName + "|" + localToken
  private fun cleanName(raw: String): String = raw.substringBeforeLast("|")
  private fun peerKeyOf(raw: String): String = raw.substringAfterLast("|", "")

  override fun getName() = "NearbyConnections"

  @ReactMethod
  fun start(serviceId: String, name: String, deviceId: String, promise: Promise) {
    localName = name.ifBlank { Build.MODEL ?: "Aparelho" }
    if (deviceId.isNotBlank()) localToken = deviceId
    if (!hasNearbyPermissions()) {
      promise.reject("PERMISSION_DENIED", "Nearby permissions must be granted by JavaScript before starting.")
      return
    }
    val strategy = Strategy.P2P_CLUSTER
    val endpointName = displayName()
    // As duas tasks sao tratadas separadamente de proposito. Tasks.whenAll
    // agrega os erros em "1 out of 2 underlying tasks failed" e descarta o
    // statusCode do Nearby, que e a unica informacao util para diagnosticar.
    var advertisingDone = false
    var discoveryDone = false
    var settled = false

    fun settleSuccess() {
      if (!settled && advertisingDone && discoveryDone) {
        settled = true
        promise.resolve(null)
      }
    }

    fun settleFailure(phase: String, error: Exception) {
      val detail = describeNearbyError(error)
      emitError("START_FAILED", "$phase: $detail")
      if (!settled) {
        settled = true
        client.stopAdvertising()
        client.stopDiscovery()
        promise.reject("START_FAILED", "$phase: $detail", error)
      }
    }

    client.startAdvertising(
      endpointName,
      serviceId,
      lifecycleCallback,
      AdvertisingOptions.Builder().setStrategy(strategy).build()
    )
      .addOnSuccessListener { advertising = true; advertisingDone = true; settleSuccess() }
      .addOnFailureListener { error ->
        // 8001 = STATUS_ALREADY_ADVERTISING. Ja estava anunciando: sucesso.
        if (statusCodeOf(error) == ConnectionsStatusCodes.STATUS_ALREADY_ADVERTISING) {
          advertising = true; advertisingDone = true; settleSuccess()
        } else settleFailure("advertising", error)
      }

    client.startDiscovery(
      serviceId,
      discoveryCallback,
      DiscoveryOptions.Builder().setStrategy(strategy).build()
    )
      .addOnSuccessListener { discovering = true; discoveryDone = true; settleSuccess() }
      .addOnFailureListener { error ->
        // 8002 = STATUS_ALREADY_DISCOVERING. Ja estava procurando: sucesso.
        if (statusCodeOf(error) == ConnectionsStatusCodes.STATUS_ALREADY_DISCOVERING) {
          discovering = true; discoveryDone = true; settleSuccess()
        } else settleFailure("discovery", error)
      }
  }

  @ReactMethod
  fun broadcastText(text: String, promise: Promise) {
    if (connectedEndpoints.isEmpty()) {
      promise.resolve(0)
      return
    }
    client.sendPayload(connectedEndpoints.toList(), Payload.fromBytes(text.toByteArray(StandardCharsets.UTF_8)))
      .addOnSuccessListener { promise.resolve(connectedEndpoints.size) }
      .addOnFailureListener { error -> promise.reject("SEND_FAILED", error.message, error) }
  }

  @ReactMethod
  fun enableBackground(promise: Promise) {
    try {
      NearbyForegroundService.start(context.applicationContext)
      backgroundEnabled = true
      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("BACKGROUND_FAILED", error.message ?: "Não foi possível ativar o modo disponível.", error)
    }
  }

  @ReactMethod
  fun disableBackground(promise: Promise) {
    NearbyForegroundService.stop(context.applicationContext)
    backgroundEnabled = false
    promise.resolve(null)
  }

  @ReactMethod
  fun acceptPeer(endpointId: String, promise: Promise) {
    if (endpointId !in awaitingAuth) {
      promise.reject("NO_PENDING_AUTH", "Não há conexão aguardando confirmação para esse aparelho.")
      return
    }
    awaitingAuth.remove(endpointId)
    client.acceptConnection(endpointId, payloadCallback)
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { error ->
        emitError("ACCEPT_FAILED", describeNearbyError(error))
        promise.reject("ACCEPT_FAILED", describeNearbyError(error), error)
      }
  }

  @ReactMethod
  fun rejectPeer(endpointId: String, promise: Promise) {
    awaitingAuth.remove(endpointId)
    pendingEndpoints.remove(endpointId)
    client.rejectConnection(endpointId)
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { error -> promise.reject("REJECT_FAILED", describeNearbyError(error), error) }
  }

  @ReactMethod
  fun sendTextTo(endpointId: String, text: String, promise: Promise) {
    if (endpointId !in connectedEndpoints) {
      promise.reject("NOT_CONNECTED", "Esse aparelho não está conectado.")
      return
    }
    client.sendPayload(endpointId, Payload.fromBytes(text.toByteArray(StandardCharsets.UTF_8)))
      .addOnSuccessListener { promise.resolve(1) }
      .addOnFailureListener { error -> promise.reject("SEND_FAILED", describeNearbyError(error), error) }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    client.stopAdvertising()
    client.stopDiscovery()
    client.stopAllEndpoints()
    advertising = false
    discovering = false
    connectedEndpoints.clear()
    pendingEndpoints.clear()
    awaitingAuth.clear()
    endpointNames.clear()
    endpointKeys.clear()
    emit("nearbyStopped", Arguments.createMap())
    promise.resolve(null)
  }

  // Required by React Native's NativeEventEmitter.
  @ReactMethod
  fun addListener(eventName: String) = Unit

  @ReactMethod
  fun removeListeners(count: Double) = Unit

  private val discoveryCallback = object : EndpointDiscoveryCallback() {
    override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
      emit("nearbyEndpointFound", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("endpointName", cleanName(info.endpointName))
        putString("serviceId", info.serviceId)
      })
      if (endpointId in connectedEndpoints || endpointId in pendingEndpoints) return
      // So o lado com token menor inicia; o outro espera a solicitacao chegar.
      val remoteToken = info.endpointName.substringAfterLast("|", "")
      if (remoteToken.isNotEmpty() && localToken >= remoteToken) return
      pendingEndpoints.add(endpointId)
      client.requestConnection(displayName(), endpointId, lifecycleCallback)
        .addOnFailureListener { error ->
          pendingEndpoints.remove(endpointId)
          // 8003 = ja conectado a esse endpoint; nao e erro.
          if (statusCodeOf(error) != ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT) {
            emitError("CONNECTION_REQUEST_FAILED", describeNearbyError(error))
          }
        }
    }
    override fun onEndpointLost(endpointId: String) {
      emit("nearbyEndpointLost", Arguments.createMap().apply { putString("endpointId", endpointId) })
    }
  }

  private val lifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      endpointNames[endpointId] = cleanName(info.endpointName)
      endpointKeys[endpointId] = peerKeyOf(info.endpointName)
      emit("nearbyConnectionInitiated", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("endpointName", cleanName(info.endpointName))
        putBoolean("isIncomingConnection", info.isIncomingConnection)
      })
      client.acceptConnection(endpointId, payloadCallback)
        .addOnFailureListener { error -> emitError("ACCEPT_FAILED", error.message ?: "Could not accept connection.") }
    }
    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      pendingEndpoints.remove(endpointId)
      val code = resolution.status.statusCode
      val success = code == com.google.android.gms.common.api.CommonStatusCodes.SUCCESS ||
        code == ConnectionsStatusCodes.STATUS_ALREADY_CONNECTED_TO_ENDPOINT
      if (success) connectedEndpoints.add(endpointId) else connectedEndpoints.remove(endpointId)
      emit("nearbyConnectionResult", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("endpointName", endpointNames[endpointId] ?: "Aparelho")
        putString("peerKey", endpointKeys[endpointId] ?: endpointId)
        putBoolean("connected", success)
        putInt("statusCode", code)
      })
    }
    override fun onDisconnected(endpointId: String) {
      connectedEndpoints.remove(endpointId)
      pendingEndpoints.remove(endpointId)
      awaitingAuth.remove(endpointId)
      emit("nearbyDisconnected", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("endpointName", endpointNames[endpointId] ?: "Aparelho")
        putString("peerKey", endpointKeys[endpointId] ?: endpointId)
      })
      endpointNames.remove(endpointId)
      endpointKeys.remove(endpointId)
    }
  }

  private fun notifyIncoming(from: String, text: String) {
    // Notifica com o app aberto ou fechado. A leitura em voz alta so acontece
    // quando a pessoa toca em reproduzir.
    try {
      NearbyForegroundService.ensureChannels(context)
      val manager = context.getSystemService(android.app.NotificationManager::class.java) ?: return
      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      val pending = android.app.PendingIntent.getActivity(
        context, 0, launch,
        android.app.PendingIntent.FLAG_UPDATE_CURRENT or android.app.PendingIntent.FLAG_IMMUTABLE
      )
      val notification = android.app.Notification.Builder(context, NearbyForegroundService.MESSAGE_CHANNEL_ID)
        .setContentTitle(from)
        .setContentText(text)
        .setStyle(android.app.Notification.BigTextStyle().bigText(text))
        .setSmallIcon(context.applicationInfo.icon)
        .setAutoCancel(true)
        .setContentIntent(pending)
        .build()
      manager.notify(text.hashCode(), notification)
      val vibrator = context.getSystemService(android.os.Vibrator::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        vibrator?.vibrate(android.os.VibrationEffect.createOneShot(400, android.os.VibrationEffect.DEFAULT_AMPLITUDE))
      } else {
        @Suppress("DEPRECATION")
        vibrator?.vibrate(400)
      }
    } catch (_: Exception) {
      // Notificacao e um extra: nunca deve derrubar a entrega da mensagem.
    }
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      val bytes = payload.asBytes() ?: return
      notifyIncoming(endpointNames[endpointId] ?: "Mensagem recebida", String(bytes, StandardCharsets.UTF_8))
      emit("nearbyPayload", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("endpointName", endpointNames[endpointId] ?: "Aparelho")
        putString("peerKey", endpointKeys[endpointId] ?: endpointId)
        putString("text", String(bytes, StandardCharsets.UTF_8))
      })
    }
    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
  }

  private fun hasNearbyPermissions(): Boolean {
    // Localizacao e exigida em TODOS os niveis: o Nearby ainda pede COARSE
    // acima da API 28, apesar do que a documentacao do Google diz.
    val permissions = mutableListOf(
      Manifest.permission.ACCESS_FINE_LOCATION,
      Manifest.permission.ACCESS_COARSE_LOCATION
    )
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      permissions += Manifest.permission.BLUETOOTH_SCAN
      permissions += Manifest.permission.BLUETOOTH_CONNECT
      permissions += Manifest.permission.BLUETOOTH_ADVERTISE
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      permissions += Manifest.permission.NEARBY_WIFI_DEVICES
    }
    val missing = permissions.filter {
      context.checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED
    }
    if (missing.isNotEmpty()) {
      emitError("PERMISSION_DENIED", "Faltam permissoes: " + missing.joinToString(", ") { it.substringAfterLast('.') })
    }
    return missing.isEmpty()
  }

  private fun describeNearbyError(error: Exception): String {
    val api = error as? com.google.android.gms.common.api.ApiException
      ?: return error.message ?: error.javaClass.simpleName
    val code = api.statusCode
    val name = com.google.android.gms.nearby.connection.ConnectionsStatusCodes.getStatusCodeString(code)
    return "$name ($code)"
  }

  private fun emitError(code: String, message: String) {
    emit("nearbyError", Arguments.createMap().apply { putString("code", code); putString("message", message) })
  }
  private fun emit(event: String, value: Any) {
    context.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java).emit(event, value)
  }
  override fun invalidate() {
    client.stopAdvertising()
    client.stopDiscovery()
    client.stopAllEndpoints()
    connectedEndpoints.clear()
    if (backgroundEnabled) NearbyForegroundService.stop(context.applicationContext)
    super.invalidate()
  }
}
`;


const serviceSource = `package ${PACKAGE_NAME}

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * Mantem o processo vivo para o Nearby continuar anunciando e procurando com o
 * app fechado. O Android moderno nao permite varredura periodica em background
 * sem isto: WorkManager tem minimo de 15 minutos e o Android 12+ impede iniciar
 * servico a partir do background.
 *
 * Ligado e desligado pelo usuario, nao automaticamente.
 */
class NearbyForegroundService : Service() {
  companion object {
    const val CHANNEL_ID = "biblia_nearby_ativo"
    const val MESSAGE_CHANNEL_ID = "biblia_nearby_mensagens"
    const val NOTIFICATION_ID = 4201

    fun start(context: Context) {
      val intent = Intent(context, NearbyForegroundService::class.java)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) context.startForegroundService(intent)
      else context.startService(intent)
    }

    fun stop(context: Context) {
      context.stopService(Intent(context, NearbyForegroundService::class.java))
    }

    fun ensureChannels(context: Context) {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
      val manager = context.getSystemService(NotificationManager::class.java) ?: return
      manager.createNotificationChannel(
        NotificationChannel(CHANNEL_ID, "Comunicação ativa", NotificationManager.IMPORTANCE_LOW).apply {
          description = "Mostra que o aparelho está disponível para receber mensagens por perto."
        }
      )
      manager.createNotificationChannel(
        NotificationChannel(MESSAGE_CHANNEL_ID, "Mensagens recebidas", NotificationManager.IMPORTANCE_HIGH).apply {
          description = "Avisa quando chega uma mensagem."
          enableVibration(true)
        }
      )
    }
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    ensureChannels(this)
    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = PendingIntent.getActivity(
      this, 0, launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    val notification: Notification = Notification.Builder(this, CHANNEL_ID)
      .setContentTitle("Disponível para mensagens por perto")
      .setContentText("Tocando aqui você abre o aplicativo.")
      .setSmallIcon(applicationInfo.icon)
      .setOngoing(true)
      .setContentIntent(pending)
      .build()

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
      startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE)
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }
    // START_STICKY: se o sistema matar por memoria, o servico volta.
    return START_STICKY
  }
}
`;

function withBibliaNative(config) {
  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] || [];
    for (const [name, attributes = {}] of manifestPermissions) {
      const alreadyAdded = manifest["uses-permission"].some(
        (permission) => permission.$?.["android:name"] === name
      );
      if (!alreadyAdded) {
        manifest["uses-permission"].push({
          $: { "android:name": name, ...attributes },
        });
      } else if (Object.keys(attributes).length > 0) {
        const existing = manifest["uses-permission"].find(
          (permission) => permission.$?.["android:name"] === name
        );
        existing.$ = { ...existing.$, ...attributes };
      }
    }
    const application = manifest.application?.[0];
    if (application) {
      application.service = application.service || [];
      const serviceName = ".nativebridge.NearbyForegroundService";
      const already = application.service.some((entry) => entry.$?.["android:name"] === serviceName);
      if (!already) {
        application.service.push({
          $: {
            "android:name": `${PACKAGE_NAME}.NearbyForegroundService`,
            "android:exported": "false",
            "android:foregroundServiceType": "connectedDevice",
          },
        });
      }
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const dependency = 'implementation("com.google.android.gms:play-services-nearby:19.3.0")';
    if (!config.modResults.contents.includes("play-services-nearby")) {
      config.modResults.contents = config.modResults.contents.replace(
        /dependencies\s*\{/,
        `dependencies {\n    ${dependency}`
      );
    }
    return config;
  });

  config = withMainApplication(config, (config) => {
    let source = config.modResults.contents;
    if (!source.includes("import com.bibliaofflinevoz.nativebridge.BibliaNativePackage")) {
      source = source.replace(/(package [^\n]+\n)/, "$1\nimport com.bibliaofflinevoz.nativebridge.BibliaNativePackage\n");
    }
    if (!source.includes("add(BibliaNativePackage())")) {
      source = source.replace(
        /(PackageList\(this\)\.packages\.apply\s*\{)/,
        "$1\n          add(BibliaNativePackage())"
      );
    }
    config.modResults.contents = source;
    return config;
  });

  return withDangerousMod(config, ["android", async (config) => {
    const directory = path.join(config.modRequest.platformProjectRoot, "app/src/main/java", SOURCE_DIRECTORY);
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(path.join(directory, "BibliaNativePackage.kt"), packageSource);
    fs.writeFileSync(path.join(directory, "OfflineSpeechModule.kt"), speechSource);
    fs.writeFileSync(path.join(directory, "NearbyConnectionsModule.kt"), nearbySource);
    fs.writeFileSync(path.join(directory, "NearbyForegroundService.kt"), serviceSource);
    return config;
  }]);
}

module.exports = withBibliaNative;