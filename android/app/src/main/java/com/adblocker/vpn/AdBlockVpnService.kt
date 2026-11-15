package com.adblocker.vpn

import android.content.Intent
import android.net.VpnService
import android.os.ParcelFileDescriptor
import android.util.Log
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.DatagramPacket
import java.net.DatagramSocket
import java.net.InetAddress
import java.util.concurrent.ConcurrentLinkedDeque
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicLong

/**
 * VPN local que só captura tráfego DNS. Nenhum dado sai do aparelho por ela:
 * consultas de domínios de anúncio recebem 0.0.0.0, as demais são repassadas
 * ao DNS público (Cloudflare/Google).
 */
class AdBlockVpnService : VpnService() {

    companion object {
        const val ACTION_START = "com.adblocker.START"
        const val ACTION_STOP = "com.adblocker.STOP"
        private const val TAG = "AdBlockVpn"

        // DNS "falso" anunciado ao sistema; tudo que vai para ele passa pela VPN.
        private const val VPN_ADDRESS = "10.111.222.1"
        private const val FAKE_DNS = "10.111.222.2"
        private val UPSTREAM = listOf("1.1.1.1", "8.8.8.8")

        @Volatile var isRunning = false
            private set
        val blockedCount = AtomicLong(0)
        val totalCount = AtomicLong(0)
        val recentBlocked = ConcurrentLinkedDeque<String>()
    }

    private var tun: ParcelFileDescriptor? = null
    private var readerThread: Thread? = null
    private val pool = Executors.newFixedThreadPool(8)

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_STOP) {
            stopVpn()
            stopSelf()
            return START_NOT_STICKY
        }
        // ACTION_START, ou intent nulo/SERVICE_INTERFACE quando é "VPN sempre ativa".
        startVpn()
        return START_STICKY
    }

    private fun startVpn() {
        if (isRunning) return
        Blocklist.load(this)
        val builder = Builder()
            .setSession("AdBlocker")
            .addAddress(VPN_ADDRESS, 32)
            .addDnsServer(FAKE_DNS)
            .addRoute(FAKE_DNS, 32) // só o DNS entra na VPN; o resto vai direto
            .setBlocking(true)
        try {
            builder.addDisallowedApplication(packageName) // o próprio app não passa pela VPN
        } catch (_: Exception) {}

        tun = builder.establish() ?: run {
            Log.e(TAG, "Permissão de VPN não concedida")
            stopSelf()
            return
        }
        isRunning = true
        readerThread = Thread({ loop(tun!!) }, "adblock-dns").also { it.start() }
        Log.i(TAG, "VPN iniciada com ${Blocklist.size} domínios bloqueados")
    }

    private fun loop(fd: ParcelFileDescriptor) {
        val input = FileInputStream(fd.fileDescriptor)
        val output = FileOutputStream(fd.fileDescriptor)
        val buffer = ByteArray(32767)
        try {
            while (isRunning) {
                val len = input.read(buffer)
                if (len <= 0) continue
                val query = DnsQuery.parse(buffer, len) ?: continue
                totalCount.incrementAndGet()
                if (Blocklist.isBlocked(query.name)) {
                    blockedCount.incrementAndGet()
                    rememberBlocked(query.name)
                    write(output, query.wrapResponse(query.blockedResponse()))
                } else {
                    pool.execute { forward(query, output) }
                }
            }
        } catch (e: Exception) {
            if (isRunning) Log.e(TAG, "Erro no loop da VPN", e)
        }
    }

    private fun forward(query: DnsQuery, output: FileOutputStream) {
        for (server in UPSTREAM) {
            try {
                DatagramSocket().use { socket ->
                    protect(socket) // garante que não volta para dentro da VPN
                    socket.soTimeout = 5000
                    val addr = InetAddress.getByName(server)
                    socket.send(DatagramPacket(query.dns, query.dns.size, addr, 53))
                    val resp = ByteArray(4096)
                    val packet = DatagramPacket(resp, resp.size)
                    socket.receive(packet)
                    write(output, query.wrapResponse(resp.copyOf(packet.length)))
                }
                return
            } catch (e: Exception) {
                Log.w(TAG, "Falha no DNS $server para ${query.name}: ${e.message}")
            }
        }
    }

    @Synchronized
    private fun write(output: FileOutputStream, packet: ByteArray) {
        try { output.write(packet) } catch (_: Exception) {}
    }

    private fun rememberBlocked(name: String) {
        recentBlocked.addFirst(name)
        while (recentBlocked.size > 50) recentBlocked.pollLast()
    }

    private fun stopVpn() {
        isRunning = false
        try { tun?.close() } catch (_: Exception) {}
        tun = null
        readerThread?.interrupt()
        readerThread = null
    }

    override fun onRevoke() { // usuário desligou pela tela de VPN do Android
        stopVpn()
        super.onRevoke()
    }

    override fun onDestroy() {
        stopVpn()
        pool.shutdownNow()
        super.onDestroy()
    }
}
