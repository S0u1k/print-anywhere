package com.pocketprint.bridge

import android.app.Application
import android.util.Log

class PocketPrintApp : Application() {
    companion object {
        lateinit var instance: PocketPrintApp
            private set
    }

    override fun onCreate() {
        super.onCreate()
        instance = this
        Log.i("PocketPrintApp", "PocketPrint Bridge Application Initialized")
    }
}
