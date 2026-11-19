package com.adblocker.vpn

import android.app.Activity
import android.content.ActivityNotFoundException
import android.content.Intent
import android.net.VpnService
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/** Ponte entre o JavaScript e o serviço de VPN. Exposto como NativeModules.AdBlock. */
class AdBlockModule(private val ctx: ReactApplicationContext) :
    ReactContextBaseJavaModule(ctx), ActivityEventListener {

    private val requestCode = 4242
    private var pendingStart: Promise? = null

    init { ctx.addActivityEventListener(this) }

    companion object { const val NAME = "AdBlock" }

    override fun getName() = NAME

    @ReactMethod
    fun start(promise: Promise) {
        val consent = VpnService.prepare(ctx)
        if (consent == null) {
            launchService()
            promise.resolve(true)
            return
        }
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "App não está em primeiro plano")
            return
        }
        pendingStart = promise
        try {
            activity.startActivityForResult(consent, requestCode)
        } catch (e: ActivityNotFoundException) {
            // Algumas TVs (ex.: firmwares de fabricante) não trazem a tela de permissão de VPN.
            pendingStart = null
            promise.reject(
                "VPN_DIALOG_MISSING",
                "Este aparelho não tem a tela de permissão de VPN. Pelo computador, rode:\n" +
                    "adb shell appops set ${ctx.packageName} ACTIVATE_VPN allow\n" +
                    "e tente ligar de novo.",
                e,
            )
        }
    }

    @ReactMethod
    fun stop(promise: Promise) {
        ctx.startService(Intent(ctx, AdBlockVpnService::class.java).setAction(AdBlockVpnService.ACTION_STOP))
        promise.resolve(true)
    }

    @ReactMethod
    fun getStats(promise: Promise) {
        if (Blocklist.size == 0) Blocklist.load(ctx)
        val map = Arguments.createMap()
        map.putBoolean("running", AdBlockVpnService.isRunning)
        map.putDouble("blocked", AdBlockVpnService.blockedCount.get().toDouble())
        map.putDouble("total", AdBlockVpnService.totalCount.get().toDouble())
        map.putInt("listSize", Blocklist.size)
        val recent = Arguments.createArray()
        AdBlockVpnService.recentBlocked.take(30).forEach { recent.pushString(it) }
        map.putArray("recent", recent)
        val allowed = Arguments.createArray()
        Blocklist.allowedList().forEach { allowed.pushString(it) }
        map.putArray("allowed", allowed)
        promise.resolve(map)
    }

    @ReactMethod
    fun updateBlocklist(promise: Promise) {
        Thread {
            try {
                promise.resolve(Blocklist.download(ctx))
            } catch (e: Exception) {
                promise.reject("DOWNLOAD_FAILED", e.message ?: "Falha ao baixar a lista", e)
            }
        }.start()
    }

    @ReactMethod
    fun setAllowed(domain: String, allow: Boolean, promise: Promise) {
        Blocklist.setAllowed(ctx, domain, allow)
        promise.resolve(true)
    }

    private fun launchService() {
        AdBlockVpnService.start(ctx)
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode != this.requestCode) return
        val p = pendingStart ?: return
        pendingStart = null
        if (resultCode == Activity.RESULT_OK) {
            launchService()
            p.resolve(true)
        } else {
            p.reject("VPN_DENIED", "Permissão de VPN negada")
        }
    }

    override fun onNewIntent(intent: Intent) {}
}
