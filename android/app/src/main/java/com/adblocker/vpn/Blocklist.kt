package com.adblocker.vpn

import android.content.Context
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL

/**
 * Lista de domínios bloqueados (formato "hosts").
 * Ordem de carregamento: lista baixada (filesDir/hosts.txt) > lista embutida (assets/hosts_basic.txt).
 */
object Blocklist {
    const val DEFAULT_URL =
        "https://raw.githubusercontent.com/StevenBlack/hosts/master/hosts"

    private const val DOWNLOADED_FILE = "hosts.txt"
    private const val BUNDLED_ASSET = "hosts_basic.txt"
    private const val PREFS = "adblock_prefs"
    private const val KEY_ALLOWED = "allowed_domains"

    @Volatile private var blocked: Set<String> = emptySet()
    @Volatile private var allowed: Set<String> = emptySet()

    val size: Int get() = blocked.size

    fun load(context: Context) {
        val file = File(context.filesDir, DOWNLOADED_FILE)
        blocked = if (file.exists() && file.length() > 0) {
            file.bufferedReader().use { parse(it) }
        } else {
            context.assets.open(BUNDLED_ASSET).bufferedReader().use { parse(it) }
        }
        allowed = prefs(context).getStringSet(KEY_ALLOWED, emptySet())!!.toSet()
    }

    /** Baixa uma nova lista e a ativa. Retorna o número de domínios. */
    fun download(context: Context, url: String = DEFAULT_URL): Int {
        val conn = URL(url).openConnection() as HttpURLConnection
        conn.connectTimeout = 15_000
        conn.readTimeout = 30_000
        try {
            if (conn.responseCode != 200) error("HTTP ${conn.responseCode}")
            val tmp = File(context.filesDir, "$DOWNLOADED_FILE.tmp")
            conn.inputStream.use { input -> tmp.outputStream().use { input.copyTo(it) } }
            val parsed = tmp.bufferedReader().use { parse(it) }
            if (parsed.size < 100) {
                tmp.delete()
                error("Lista baixada parece inválida (${parsed.size} domínios)")
            }
            tmp.renameTo(File(context.filesDir, DOWNLOADED_FILE))
            blocked = parsed
            return parsed.size
        } finally {
            conn.disconnect()
        }
    }

    /** Verifica o domínio e todos os "pais" (ads.exemplo.com -> exemplo.com). */
    fun isBlocked(domain: String): Boolean {
        var d = domain.lowercase().trimEnd('.')
        if (matches(allowed, d)) return false
        while (true) {
            if (blocked.contains(d)) return true
            val dot = d.indexOf('.')
            if (dot < 0) return false
            d = d.substring(dot + 1)
            if (!d.contains('.')) return false // não bloqueia TLD sozinho
        }
    }

    private fun matches(set: Set<String>, domain: String): Boolean {
        if (set.isEmpty()) return false
        var d = domain
        while (true) {
            if (set.contains(d)) return true
            val dot = d.indexOf('.')
            if (dot < 0) return false
            d = d.substring(dot + 1)
        }
    }

    fun allowedList(): List<String> = allowed.sorted()

    fun setAllowed(context: Context, domain: String, allow: Boolean) {
        val d = domain.lowercase().trim().trimEnd('.')
        val next = if (allow) allowed + d else allowed - d
        allowed = next
        prefs(context).edit().putStringSet(KEY_ALLOWED, next).apply()
    }

    private fun prefs(context: Context) =
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private val IGNORED = setOf(
        "localhost", "localhost.localdomain", "local", "broadcasthost",
        "ip6-localhost", "ip6-loopback", "0.0.0.0",
    )

    private fun parse(reader: BufferedReader): Set<String> {
        val out = HashSet<String>(100_000)
        reader.forEachLine { raw ->
            val line = raw.substringBefore('#').trim()
            if (line.isEmpty()) return@forEachLine
            val parts = line.split(Regex("\\s+"))
            // "0.0.0.0 dominio" ou só "dominio"
            val host = (if (parts.size >= 2) parts[1] else parts[0]).lowercase()
            if (host in IGNORED || !host.contains('.')) return@forEachLine
            out.add(host)
        }
        return out
    }
}
