package com.adblocker.vpn

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.VpnService
import android.util.Log

/**
 * Religa o bloqueio quando o aparelho (celular ou TV) liga, ou depois de atualizar o app,
 * se o usuário tinha deixado ele ligado.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (intent.action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_LOCKED_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            "android.intent.action.QUICKBOOT_POWERON",
            -> Unit
            else -> return
        }
        if (!AdBlockVpnService.isEnabled(context) || AdBlockVpnService.isRunning) return
        // prepare() == null: a permissão de VPN já foi dada antes, dá para ligar sem tela.
        if (VpnService.prepare(context) != null) {
            Log.w("AdBlockBoot", "Permissão de VPN não está mais concedida; abra o app para ligar")
            return
        }
        try {
            AdBlockVpnService.start(context)
        } catch (e: Exception) {
            Log.e("AdBlockBoot", "Não foi possível religar o bloqueio", e)
        }
    }
}
