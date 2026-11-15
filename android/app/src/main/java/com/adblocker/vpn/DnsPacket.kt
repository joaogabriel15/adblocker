package com.adblocker.vpn

import java.nio.ByteBuffer

/**
 * Leitura/escrita mínima de pacotes IPv4 + UDP + DNS, o suficiente para
 * interceptar consultas DNS que chegam pela interface da VPN.
 */
class DnsQuery(
    val srcIp: ByteArray,
    val dstIp: ByteArray,
    val srcPort: Int,
    val dstPort: Int,
    val dns: ByteArray,
) {
    /** Nome consultado (ex.: "ads.google.com") e tipo (1 = A, 28 = AAAA). */
    val name: String
    val qtype: Int
    /** Posição logo após a seção "question" do DNS. */
    private val questionEnd: Int

    init {
        val sb = StringBuilder()
        var i = 12
        while (true) {
            val len = dns[i].toInt() and 0xFF
            if (len == 0) { i++; break }
            if (len and 0xC0 != 0) throw IllegalArgumentException("compressão na pergunta")
            if (sb.isNotEmpty()) sb.append('.')
            sb.append(String(dns, i + 1, len, Charsets.US_ASCII))
            i += len + 1
        }
        name = sb.toString()
        qtype = ((dns[i].toInt() and 0xFF) shl 8) or (dns[i + 1].toInt() and 0xFF)
        questionEnd = i + 4
    }

    /** Resposta "bloqueada": A -> 0.0.0.0, AAAA -> ::, outros tipos -> sem resposta. */
    fun blockedResponse(): ByteArray {
        val answerLen = when (qtype) { 1 -> 4; 28 -> 16; else -> -1 }
        val extra = if (answerLen > 0) 12 + answerLen else 0
        val buf = ByteBuffer.allocate(questionEnd + extra)
        buf.put(dns, 0, questionEnd)
        val rd = dns[2].toInt() and 0x01
        buf.put(2, (0x80 or (dns[2].toInt() and 0x78) or rd).toByte()) // QR=1, opcode, RD
        buf.put(3, 0x80.toByte())                                       // RA=1, RCODE=0
        buf.putShort(4, 1)                                              // QDCOUNT
        buf.putShort(6, if (answerLen > 0) 1 else 0)                    // ANCOUNT
        buf.putShort(8, 0)                                              // NSCOUNT
        buf.putShort(10, 0)                                             // ARCOUNT
        if (answerLen > 0) {
            buf.position(questionEnd)
            buf.putShort(0xC00C.toShort())  // ponteiro para o nome da pergunta
            buf.putShort(qtype.toShort())
            buf.putShort(1)                 // classe IN
            buf.putInt(300)                 // TTL
            buf.putShort(answerLen.toShort())
            buf.put(ByteArray(answerLen))   // 0.0.0.0 ou ::
        }
        return buf.array()
    }

    /** Monta o pacote IPv4/UDP de volta para o app que perguntou. */
    fun wrapResponse(payload: ByteArray): ByteArray {
        val udpLen = 8 + payload.size
        val total = 20 + udpLen
        val b = ByteBuffer.allocate(total)
        // Cabeçalho IPv4
        b.put(0x45.toByte()); b.put(0)
        b.putShort(total.toShort())
        b.putShort(0); b.putShort(0x4000.toShort()) // id, flags (DF)
        b.put(64); b.put(17)                        // TTL, protocolo UDP
        b.putShort(0)                               // checksum (calculado abaixo)
        b.put(dstIp); b.put(srcIp)                  // invertido: servidor -> app
        // Cabeçalho UDP
        b.putShort(dstPort.toShort()); b.putShort(srcPort.toShort())
        b.putShort(udpLen.toShort()); b.putShort(0) // checksum UDP opcional no IPv4
        b.put(payload)
        val arr = b.array()
        val cs = checksum(arr, 0, 20)
        arr[10] = (cs shr 8).toByte(); arr[11] = cs.toByte()
        return arr
    }

    companion object {
        /** Retorna a consulta DNS se o pacote for IPv4/UDP para a porta 53; senão null. */
        fun parse(packet: ByteArray, length: Int): DnsQuery? {
            if (length < 28) return null
            if ((packet[0].toInt() shr 4) != 4) return null
            val ihl = (packet[0].toInt() and 0x0F) * 4
            if (packet[9].toInt() != 17) return null
            val dstPort = u16(packet, ihl + 2)
            if (dstPort != 53) return null
            val srcPort = u16(packet, ihl)
            val udpLen = u16(packet, ihl + 4)
            val dnsStart = ihl + 8
            val dnsLen = minOf(udpLen - 8, length - dnsStart)
            if (dnsLen < 12) return null
            return try {
                DnsQuery(
                    srcIp = packet.copyOfRange(12, 16),
                    dstIp = packet.copyOfRange(16, 20),
                    srcPort = srcPort,
                    dstPort = dstPort,
                    dns = packet.copyOfRange(dnsStart, dnsStart + dnsLen),
                )
            } catch (e: Exception) {
                null
            }
        }

        private fun u16(b: ByteArray, off: Int) =
            ((b[off].toInt() and 0xFF) shl 8) or (b[off + 1].toInt() and 0xFF)

        private fun checksum(b: ByteArray, off: Int, len: Int): Int {
            var sum = 0
            var i = off
            while (i < off + len) {
                sum += u16(b, i)
                i += 2
            }
            while (sum shr 16 != 0) sum = (sum and 0xFFFF) + (sum shr 16)
            return sum.inv() and 0xFFFF
        }
    }
}
