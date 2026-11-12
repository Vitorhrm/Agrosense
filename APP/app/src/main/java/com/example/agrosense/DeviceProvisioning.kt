package com.example.agrosense

import android.Manifest
import android.annotation.SuppressLint
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothGatt
import android.bluetooth.BluetoothGattCallback
import android.bluetooth.BluetoothGattCharacteristic
import android.bluetooth.BluetoothGattDescriptor
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothProfile
import android.bluetooth.BluetoothStatusCodes
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.core.content.PermissionChecker
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.UUID

/** Bluetooth configuration is limited to the local WebView and explicitly selected devices. */
@SuppressLint("MissingPermission")
class DeviceProvisioning(
    private val activity: MainActivity,
    private val emit: (JSONObject) -> Unit,
) {
    private val serviceId = UUID.fromString("9ee936a0-982f-4dd6-9353-7152519a3c00")
    private val writeId = UUID.fromString("9ee936a0-982f-4dd6-9353-7152519a3c01")
    private val replyId = UUID.fromString("9ee936a0-982f-4dd6-9353-7152519a3c02")
    private val notifyId = UUID.fromString("00002902-0000-1000-8000-00805f9b34fb")
    private val handler = Handler(Looper.getMainLooper())
    private val manager = activity.getSystemService(BluetoothManager::class.java)
    private val found = mutableMapOf<String, BluetoothDevice>()
    private val reply = ByteArrayOutputStream()
    private val writes = ArrayDeque<ByteArray>()
    private var role = ""
    private var pendingRole: String? = null
    private var scan: ScanCallback? = null
    private var gatt: BluetoothGatt? = null
    private var pairing: BluetoothDevice? = null
    private var writer: BluetoothGattCharacteristic? = null
    private var writing = false
    private var awaitingReply = false
    private var closed = false
    private val timeout = Runnable {
        error("O dispositivo não respondeu. Aproxime-se do ESP32 e tente novamente.")
        disconnect()
    }
    private val permissions = activity.registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        val requested = pendingRole
        pendingRole = null
        if (requested != null && result.values.all { it }) startScan(requested)
        else error("Permita o acesso ao Bluetooth para buscar o dispositivo.")
    }
    private val bonds = object : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            val device = if (Build.VERSION.SDK_INT >= 33) {
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE, BluetoothDevice::class.java)
            } else {
                @Suppress("DEPRECATION")
                intent.getParcelableExtra(BluetoothDevice.EXTRA_DEVICE)
            }
            if (device == null || pairing?.address != device.address) return
            when (intent.getIntExtra(BluetoothDevice.EXTRA_BOND_STATE, BluetoothDevice.BOND_NONE)) {
                BluetoothDevice.BOND_BONDED -> {
                    if (device.bondState != BluetoothDevice.BOND_BONDED) return
                    pairing = null
                    open(device)
                }
                BluetoothDevice.BOND_NONE -> {
                    pairing = null
                    handler.removeCallbacks(timeout)
                    error("O pareamento Bluetooth foi cancelado ou falhou.")
                }
            }
        }
    }

    init {
        ContextCompat.registerReceiver(activity, bonds, IntentFilter(BluetoothDevice.ACTION_BOND_STATE_CHANGED), ContextCompat.RECEIVER_EXPORTED)
    }

    private fun event(type: String) = JSONObject().put("type", type)
    private fun error(message: String) = emit(event("error").put("message", message))
    private fun armTimeout(ms: Long = 12_000) {
        handler.removeCallbacks(timeout)
        handler.postDelayed(timeout, ms)
    }

    fun dispatch(message: String) {
        if (closed || message.length > 2048) return
        val request = runCatching { JSONObject(message) }.getOrNull() ?: return
        try {
            when (request.optString("action")) {
                "scan" -> startScan(request.optString("role"))
                "connect" -> connect(request.optString("id"))
                "send" -> send(request.optString("json"))
                "disconnect" -> disconnect()
            }
        } catch (_: SecurityException) {
            error("O Android bloqueou o acesso ao Bluetooth.")
        }
    }

    private fun startScan(requested: String) {
        if (closed || requested !in setOf("transmitter", "receiver")) return
        val required = if (Build.VERSION.SDK_INT >= 31) {
            arrayOf(Manifest.permission.BLUETOOTH_SCAN, Manifest.permission.BLUETOOTH_CONNECT)
        } else arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
        if (required.any { ContextCompat.checkSelfPermission(activity, it) != PermissionChecker.PERMISSION_GRANTED }) {
            pendingRole = requested
            permissions.launch(required)
            return
        }
        val adapter = manager?.adapter
        if (adapter?.isEnabled != true) {
            error("Ative o Bluetooth para buscar o ESP32.")
            return
        }
        disconnect(announce = false)
        val scanner = adapter.bluetoothLeScanner ?: run {
            error("A busca Bluetooth não está disponível.")
            return
        }
        role = requested
        found.clear()
        val expectedName = if (role == "transmitter") "AgroSense-TX" else "AgroSense-RX"
        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                handler.post {
                    if (scan !== this || result.scanRecord?.deviceName != expectedName) return@post
                    val id = result.device.address
                    if (found.put(id, result.device) == null) {
                        emit(event("device").put("id", id).put("name", expectedName).put("role", role).put("rssi", result.rssi))
                    }
                }
            }
            override fun onScanFailed(errorCode: Int) {
                handler.post {
                    if (scan !== this) return@post
                    stopScan()
                    error("Falha na busca Bluetooth (código $errorCode).")
                }
            }
        }
        scan = callback
        scanner.startScan(
            listOf(ScanFilter.Builder().setServiceUuid(ParcelUuid(serviceId)).build()),
            ScanSettings.Builder().setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY).build(),
            callback,
        )
        handler.postDelayed({
            if (scan === callback) {
                stopScan()
                emit(event("scan-complete"))
            }
        }, 10_000)
    }

    private fun stopScan() {
        scan?.let { runCatching { manager?.adapter?.bluetoothLeScanner?.stopScan(it) } }
        scan = null
    }

    private fun connect(id: String) {
        val device = found[id] ?: run {
            error("Busque novamente e selecione um dispositivo da lista.")
            return
        }
        disconnect(announce = false)
        if (device.bondState == BluetoothDevice.BOND_BONDED) open(device)
        else {
            pairing = device
            armTimeout(60_000)
            if (device.bondState != BluetoothDevice.BOND_BONDING && !device.createBond()) {
                pairing = null
                handler.removeCallbacks(timeout)
                error("Não foi possível iniciar o pareamento Bluetooth.")
            }
        }
    }

    private fun open(device: BluetoothDevice) {
        armTimeout()
        gatt = device.connectGatt(activity, false, callbacks, BluetoothDevice.TRANSPORT_LE)
        if (gatt == null) {
            handler.removeCallbacks(timeout)
            error("Não foi possível conectar ao ESP32.")
        }
    }

    private val callbacks = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(connection: BluetoothGatt, status: Int, newState: Int) {
            handler.post {
                if (gatt !== connection) return@post
                if (status == BluetoothGatt.GATT_SUCCESS && newState == BluetoothProfile.STATE_CONNECTED) {
                    if (!connection.discoverServices()) fail("Não foi possível descobrir os serviços do ESP32.")
                } else if (newState == BluetoothProfile.STATE_DISCONNECTED || status != BluetoothGatt.GATT_SUCCESS) {
                    if (writer == null || status != BluetoothGatt.GATT_SUCCESS) error("A conexão Bluetooth foi interrompida.")
                    disconnect()
                }
            }
        }

        override fun onServicesDiscovered(connection: BluetoothGatt, status: Int) {
            handler.post {
                if (gatt !== connection) return@post
                val service = connection.getService(serviceId)
                val command = service?.getCharacteristic(writeId)
                val response = service?.getCharacteristic(replyId)
                val descriptor = response?.getDescriptor(notifyId)
                if (status != BluetoothGatt.GATT_SUCCESS || command == null || response == null || descriptor == null ||
                    !connection.setCharacteristicNotification(response, true)) {
                    fail("O dispositivo não oferece o serviço AgroSense esperado.")
                    return@post
                }
                writer = command
                val requested = if (Build.VERSION.SDK_INT >= 33) {
                    connection.writeDescriptor(descriptor, BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE) == BluetoothStatusCodes.SUCCESS
                } else {
                    @Suppress("DEPRECATION")
                    descriptor.value = BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE
                    @Suppress("DEPRECATION")
                    connection.writeDescriptor(descriptor)
                }
                if (!requested) fail("Não foi possível habilitar respostas do ESP32.")
            }
        }

        override fun onDescriptorWrite(connection: BluetoothGatt, descriptor: BluetoothGattDescriptor, status: Int) {
            handler.post {
                if (gatt !== connection || descriptor.uuid != notifyId) return@post
                handler.removeCallbacks(timeout)
                if (status == BluetoothGatt.GATT_SUCCESS) emit(event("connected"))
                else fail("O dispositivo não confirmou o canal de resposta Bluetooth.")
            }
        }

        override fun onCharacteristicWrite(connection: BluetoothGatt, characteristic: BluetoothGattCharacteristic, status: Int) {
            handler.post {
                if (gatt !== connection || characteristic.uuid != writeId) return@post
                writing = false
                if (status == BluetoothGatt.GATT_SUCCESS) writeNext()
                else fail("O ESP32 recusou a escrita. Confira o pareamento e tente novamente.")
            }
        }

        override fun onCharacteristicChanged(connection: BluetoothGatt, characteristic: BluetoothGattCharacteristic, value: ByteArray) {
            receive(connection, characteristic.uuid, value.copyOf())
        }

        @Deprecated("Compatibilidade com Android anterior à API 33")
        override fun onCharacteristicChanged(connection: BluetoothGatt, characteristic: BluetoothGattCharacteristic) {
            @Suppress("DEPRECATION")
            receive(connection, characteristic.uuid, characteristic.value?.copyOf() ?: return)
        }
    }

    private fun receive(connection: BluetoothGatt, uuid: UUID, value: ByteArray) {
        handler.post {
            if (gatt !== connection || uuid != replyId) return@post
            for (byte in value) {
                if (byte == 10.toByte()) {
                    val payload = runCatching { JSONObject(reply.toString(Charsets.UTF_8.name())) }.getOrNull()
                    reply.reset()
                    if (payload == null) {
                        fail("Resposta Bluetooth inválida.")
                        return@post
                    }
                    awaitingReply = false
                    handler.removeCallbacks(timeout)
                    emit(event("message").put("payload", payload))
                } else if (reply.size() < 512) reply.write(byte.toInt())
                else {
                    fail("Resposta Bluetooth excedeu o tamanho permitido.")
                    return@post
                }
            }
        }
    }

    private fun send(json: String) {
        val bytes = (json + "\n").toByteArray(Charsets.UTF_8)
        if (gatt == null || writer == null || bytes.size > 512 || writing || awaitingReply) {
            error("O dispositivo está desconectado, ocupado ou recebeu uma configuração grande demais.")
            return
        }
        val operation = runCatching { JSONObject(json).optString("op") }.getOrNull()
        if (operation !in setOf("info", "save", "scan_lora")) return
        awaitingReply = true
        // Keep each write within the default ATT payload, even without MTU negotiation.
        for (offset in bytes.indices step 20) writes.add(bytes.copyOfRange(offset, minOf(offset + 20, bytes.size)))
        armTimeout(if (operation == "info") 12_000 else 30_000)
        writeNext()
    }

    private fun writeNext() {
        val connection = gatt ?: return
        val characteristic = writer ?: return
        val bytes = writes.removeFirstOrNull() ?: return
        writing = true
        val started = if (Build.VERSION.SDK_INT >= 33) {
            connection.writeCharacteristic(characteristic, bytes, BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT) == BluetoothStatusCodes.SUCCESS
        } else {
            @Suppress("DEPRECATION")
            characteristic.value = bytes
            characteristic.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            @Suppress("DEPRECATION")
            connection.writeCharacteristic(characteristic)
        }
        if (!started) fail("Não foi possível enviar a configuração Bluetooth.")
    }

    private fun fail(message: String) {
        error(message)
        disconnect()
    }

    private fun disconnect(announce: Boolean = true) {
        stopScan()
        handler.removeCallbacks(timeout)
        val old = gatt
        gatt = null
        pairing = null
        writer = null
        writing = false
        awaitingReply = false
        writes.clear()
        reply.reset()
        if (old != null) {
            runCatching { old.disconnect() }
            runCatching { old.close() }
        }
        if (announce) emit(event("disconnected"))
    }

    fun close() {
        closed = true
        disconnect(announce = false)
        activity.unregisterReceiver(bonds)
        handler.removeCallbacksAndMessages(null)
    }
}
