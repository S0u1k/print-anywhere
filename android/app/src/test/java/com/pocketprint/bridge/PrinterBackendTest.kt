package com.pocketprint.bridge

import com.pocketprint.bridge.data.model.JobStatus
import com.pocketprint.bridge.data.model.PrintJob
import com.pocketprint.bridge.data.model.PrintOptions
import com.pocketprint.bridge.driver.CanonPixmaBackend
import com.pocketprint.bridge.driver.PrinterBackendRegistry
import com.pocketprint.bridge.driver.SimulatedPrinterBackend
import com.pocketprint.bridge.usb.UsbDiagnosticInfo
import org.junit.Assert.*
import org.junit.Test

class PrinterBackendTest {

    @Test
    fun testCanonBackendCompatibility_MatchesCanonPixmaMg2570S() {
        val backend = CanonPixmaBackend()
        val canonDiag = UsbDiagnosticInfo(
            deviceName = "/dev/bus/usb/001/002",
            vendorIdHex = "0x04A9",
            productIdHex = "0x176D",
            vendorIdInt = 0x04A9,
            productIdInt = 0x176D,
            manufacturerName = "Canon Inc.",
            productName = "MG2500 series",
            serialNumber = "123456",
            deviceClass = 0,
            deviceSubclass = 0,
            deviceProtocol = 0,
            interfaces = emptyList(),
            ieee1284DeviceId = "MFG:Canon;CMD:BJL,BJRaster3;MDL:MG2500 series;",
            isCanonPixmaMg2500Series = true,
            hasBulkOutEndpoint = true,
            hasBulkInEndpoint = true,
            bulkOutEndpointAddress = 0x01,
            bulkInEndpointAddress = 0x81,
            rawDescriptorSummary = "Canon Test"
        )

        assertTrue(backend.isCompatible(null, canonDiag))
    }

    @Test
    fun testBackendRegistry_FallbackToSimulatedWhenNoHardware() {
        val selected = PrinterBackendRegistry.detectBackend(
            device = null,
            diag = null,
            forceSimulated = false
        )
        assertTrue(selected is SimulatedPrinterBackend)
        assertTrue(selected.isSimulated)
    }

    @Test
    fun testJobStatus_TerminalStates() {
        assertTrue(JobStatus.COMPLETED.isTerminal())
        assertTrue(JobStatus.SIMULATED_COMPLETED.isTerminal())
        assertTrue(JobStatus.FAILED.isTerminal())
        assertTrue(JobStatus.CANCELLED.isTerminal())

        assertFalse(JobStatus.QUEUED.isTerminal())
        assertFalse(JobStatus.RENDERING.isTerminal())
        assertFalse(JobStatus.PRINTING.isTerminal())
    }

    @Test
    fun testPrintJob_OptionsIntegrity() {
        val options = PrintOptions(
            copies = 2,
            pageRange = "1-5",
            paperSize = "A4",
            orientation = "PORTRAIT",
            colorMode = "COLOR",
            dpi = 300
        )
        val job = PrintJob(
            id = "test-job-001",
            userId = "user-123",
            deviceId = "phone-456",
            fileName = "sample.pdf",
            fileSize = 1048576,
            fileUrl = "/uploads/sample.pdf",
            options = options
        )

        assertEquals("test-job-001", job.id)
        assertEquals(2, job.options.copies)
        assertEquals("A4", job.options.paperSize)
        assertEquals(JobStatus.QUEUED, job.status)
    }
}
