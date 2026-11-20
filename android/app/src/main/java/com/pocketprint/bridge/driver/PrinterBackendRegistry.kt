package com.pocketprint.bridge.driver

import android.hardware.usb.UsbDevice
import com.pocketprint.bridge.usb.UsbDiagnosticInfo

object PrinterBackendRegistry {
    private val backends = listOf<PrinterBackend>(
        CanonPixmaBackend(),
        PclBackend(),
        EscPBackend(),
        GenericRasterBackend(),
        SimulatedPrinterBackend()
    )

    fun getAllBackends(): List<PrinterBackend> = backends

    fun getBackendById(id: String): PrinterBackend? = backends.find { it.backendId == id }

    fun detectBackend(
        device: UsbDevice?,
        diag: UsbDiagnosticInfo?,
        forceSimulated: Boolean = false
    ): PrinterBackend {
        if (forceSimulated || device == null) {
            return backends.first { it is SimulatedPrinterBackend }
        }

        // 1. Check for Canon MG2500 / MG2570S match
        val canon = backends.firstOrNull { it is CanonPixmaBackend && it.isCompatible(device, diag) }
        if (canon != null) return canon

        // 2. Check for PCL
        val pcl = backends.firstOrNull { it is PclBackend && it.isCompatible(device, diag) }
        if (pcl != null) return pcl

        // 3. Check for ESC/P
        val escp = backends.firstOrNull { it is EscPBackend && it.isCompatible(device, diag) }
        if (escp != null) return escp

        // 4. Check for Generic Raster if Bulk OUT is present
        val generic = backends.firstOrNull { it is GenericRasterBackend && it.isCompatible(device, diag) }
        if (generic != null) return generic

        // Default to simulated
        return backends.first { it is SimulatedPrinterBackend }
    }
}
