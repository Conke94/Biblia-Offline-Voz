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

const manifestPermissions = [
  ["android.permission.RECORD_AUDIO"],
  ["android.permission.BLUETOOTH"],
  ["android.permission.BLUETOOTH_ADMIN"],
  ["android.permission.ACCESS_WIFI_STATE"],
  ["android.permission.CHANGE_WIFI_STATE"],
  ["android.permission.ACCESS_FINE_LOCATION", { "android:maxSdkVersion": "30" }],
  ["android.permission.ACCESS_COARSE_LOCATION", { "android:maxSdkVersion": "30" }],
  ["android.permission.BLUETOOTH_SCAN", { "android:usesPermissionFlags": "neverForLocation" }],
  ["android.permission.BLUETOOTH_CONNECT"],
  ["android.permission.BLUETOOTH_ADVERTISE"],
  ["android.permission.NEARBY_WIFI_DEVICES"],
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
import com.google.android.gms.nearby.connection.Strategy
import com.google.android.gms.tasks.Tasks
import java.nio.charset.StandardCharsets

class NearbyConnectionsModule(private val context: ReactApplicationContext) :
  ReactContextBaseJavaModule(context) {
  private val client: ConnectionsClient = Nearby.getConnectionsClient(context)
  private val connectedEndpoints = mutableSetOf<String>()

  override fun getName() = "NearbyConnections"

  @ReactMethod
  fun start(serviceId: String, promise: Promise) {
    if (!hasNearbyPermissions()) {
      promise.reject("PERMISSION_DENIED", "Nearby permissions must be granted by JavaScript before starting.")
      return
    }
    val strategy = Strategy.P2P_CLUSTER
    val endpointName = Build.MODEL ?: "Bíblia Offline Voz"
    val advertising = client.startAdvertising(
      endpointName,
      serviceId,
      lifecycleCallback,
      AdvertisingOptions.Builder().setStrategy(strategy).build()
    )
    val discovery = client.startDiscovery(
      serviceId,
      discoveryCallback,
      DiscoveryOptions.Builder().setStrategy(strategy).build()
    )
    Tasks.whenAll(advertising, discovery)
      .addOnSuccessListener { promise.resolve(null) }
      .addOnFailureListener { error ->
        client.stopAdvertising()
        client.stopDiscovery()
        val message = error.message ?: "Não foi possível iniciar a conexão local."
        emitError("START_FAILED", message)
        promise.reject("START_FAILED", message, error)
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
  fun stop(promise: Promise) {
    client.stopAdvertising()
    client.stopDiscovery()
    client.stopAllEndpoints()
    connectedEndpoints.clear()
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
        putString("endpointName", info.endpointName)
        putString("serviceId", info.serviceId)
      })
      client.requestConnection(Build.MODEL ?: "Bíblia Offline Voz", endpointId, lifecycleCallback)
        .addOnFailureListener { error -> emitError("CONNECTION_REQUEST_FAILED", error.message ?: "Could not request connection.") }
    }
    override fun onEndpointLost(endpointId: String) {
      emit("nearbyEndpointLost", Arguments.createMap().apply { putString("endpointId", endpointId) })
    }
  }

  private val lifecycleCallback = object : ConnectionLifecycleCallback() {
    override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
      emit("nearbyConnectionInitiated", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("endpointName", info.endpointName)
        putBoolean("isIncomingConnection", info.isIncomingConnection)
      })
      client.acceptConnection(endpointId, payloadCallback)
        .addOnFailureListener { error -> emitError("ACCEPT_FAILED", error.message ?: "Could not accept connection.") }
    }
    override fun onConnectionResult(endpointId: String, resolution: ConnectionResolution) {
      val success = resolution.status.statusCode == com.google.android.gms.common.api.CommonStatusCodes.SUCCESS
      if (success) connectedEndpoints.add(endpointId) else connectedEndpoints.remove(endpointId)
      emit("nearbyConnectionResult", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putBoolean("connected", success)
        putInt("statusCode", resolution.status.statusCode)
      })
    }
    override fun onDisconnected(endpointId: String) {
      connectedEndpoints.remove(endpointId)
      emit("nearbyDisconnected", Arguments.createMap().apply { putString("endpointId", endpointId) })
    }
  }

  private val payloadCallback = object : PayloadCallback() {
    override fun onPayloadReceived(endpointId: String, payload: Payload) {
      val bytes = payload.asBytes() ?: return
      emit("nearbyPayload", Arguments.createMap().apply {
        putString("endpointId", endpointId)
        putString("text", String(bytes, StandardCharsets.UTF_8))
      })
    }
    override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) = Unit
  }

  private fun hasNearbyPermissions(): Boolean {
    val permissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      arrayOf(
        Manifest.permission.BLUETOOTH_SCAN,
        Manifest.permission.BLUETOOTH_CONNECT,
        Manifest.permission.BLUETOOTH_ADVERTISE,
        Manifest.permission.NEARBY_WIFI_DEVICES
      )
    } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_ADVERTISE)
    } else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
    return permissions.all { context.checkSelfPermission(it) == PackageManager.PERMISSION_GRANTED }
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
    super.invalidate()
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
    return config;
  }]);
}

module.exports = withBibliaNative;