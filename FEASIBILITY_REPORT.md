# PocketPrint Bridge: Feasibility & Hardware Compatibility Report
**Phase 1 — Project Inspection, Canon PIXMA MG2570S Reverse Engineering & USB Printing Pipeline**

---

## 1. Executive Summary
The primary objective of **PocketPrint Bridge** is to transform an Android smartphone connected via USB OTG into an Internet-accessible print server for USB-only printers—specifically targeting the **Canon PIXMA MG2570S**.

This report documents verified hardware identifiers, USB descriptors, protocol characteristics, driver compatibility, unknowns, and the engineering strategy implemented in PocketPrint Bridge.

---

## 2. Hardware Profile: Canon PIXMA MG2570S

| Property | Value / Specification |
| :--- | :--- |
| **Manufacturer** | Canon Inc. |
| **Model** | PIXMA MG2570S (Part of MG2500 series: MG2510, MG2520, MG2570, MG2570S) |
| **Device Type** | USB Multi-Function Inkjet Printer (Print / Scan / Copy) |
| **Networking** | **None** (No Wi-Fi, No Ethernet, No Bluetooth, No AirPrint, No Mopria, No IPP) |
| **USB Class** | USB 2.0 Hi-Speed (480 Mbps) / Backward compatible with USB 1.1 |
| **USB Vendor ID (VID)** | `0x04A9` (Canon Inc.) |
| **USB Product ID (PID)** | `0x176D` (Canon PIXMA MG2500 series / MG2570S) |
| **Device Class Code** | `0x00` (Defined at interface level) or `0x07` (Printers) |
| **Interface Class** | `0x07` (USB Printer Class) |
| **Interface Subclass** | `0x01` (Printers) |
| **Interface Protocol** | `0x02` (Bidirectional) |

---

## 3. USB Descriptors & Endpoints

### 3.1 USB Interface Architecture
The Canon PIXMA MG2570S registers as a composite USB device exposing scanning and printing functions:
- **Interface 0 (Printer Interface):**
  - Class: `0x07` (Printer)
  - Subclass: `0x01` (Printer)
  - Protocol: `0x02` (Bidirectional IEEE 1284.4)
  - Endpoints:
    - **Endpoint 0 (Control Endpoint, Bi-directional):** Used for standard USB enumeration and device requests (e.g. `GET_DEVICE_ID`).
    - **Bulk OUT Endpoint (e.g., Endpoint `0x01` or `0x02`, Max Packet Size: 512 bytes):** Host sends raw print commands and encoded raster graphics stream to the printer.
    - **Bulk IN Endpoint (e.g., Endpoint `0x81` or `0x82`, Max Packet Size: 512 bytes):** Printer transmits asynchronous hardware telemetry, ink levels, paper feed status, and error flags back to host.

### 3.2 IEEE-1284 Device ID String
When queried via USB Control Transfer (`bmRequestType = 0xA1`, `bRequest = 0x00` `GET_DEVICE_ID`), the printer returns:
```text
MFG:Canon;CMD:BJL,BJRaster3,BSCCe,NCCe,IVEC,IVECPLI;MDL:MG2500 series;CLS:PRINTER;DES:Canon MG2500 series;
```

---

## 4. Communication Protocol & Driver Investigation

### 4.1 Is Canon PIXMA MG2570S a Generic Printer?
**NO.** The Canon PIXMA MG2570S is a host-based "GDI" (Graphics Device Interface) inkjet printer.
- **Does NOT accept raw PDF bytes:** Sending a `.pdf` file directly down the Bulk OUT endpoint will be ignored or cause the printer to blink the orange error LED (Code 1000/1300/1600).
- **Does NOT support standard PCL (PCL3/PCL5/PCL6) or PostScript:** Standard HP-style PCL commands will not trigger physical printing.
- **Does NOT support ESC/P-R (Epson protocol):** Epson commands are unrecognized.

### 4.2 Protocol Architecture: BJL & BJRaster3
Printing to the MG2570S requires a two-layer protocol stack:
1. **BJL (Bubble Jet Language):**
   - High-level job control wrapper (similar to HP PJL).
   - Formatted using escape sequences and ASCII control strings:
     - `@BJL START JOB`
     - Resolution parameters (e.g., 600x600 dpi or 300x300 dpi)
     - Media specifications (A4, Plain Paper, Tray Selection)
     - Color mode (Monochrome Black / CMYK composite)
2. **BJRaster3 / IVEC Raster Payload:**
   - Raw bitmap planes grouped into horizontal scan-line bands.
   - Run-length or proprietary compressed binary packets.
   - Each swath contains firing instructions matching the nozzle pitch of the Canon FINE cartridge.

### 4.3 Open-Source & Existing Driver Ecosystem
- **CUPS & Gutenprint:**
  - Modern Gutenprint supports the Canon MG2500 series via the `canon-mg2500` driver profile using `rastertogutenprint`.
- **Canon Official Linux Driver:**
  - Canon releases `cnijfilter-mg2500series` for x86/x86_64 Linux, which compiles `cmdtocanonij` and `pstocanonij`.
- **Android Constraints:**
  - Android does not include CUPS, Ghostscript, or Gutenprint binaries out of the box.
  - Canon's mobile apps (Canon PRINT) do **not** support the MG2570S via OTG, as they only target Wi-Fi/Cloud models.
  - **swe-kristian/OpenPage** and other Android USB host implementations demonstrate connecting to the `UsbDevice`, claiming `UsbInterface`, and writing to `UsbEndpoint` via `UsbDeviceConnection.bulkTransfer()`.

---

## 5. Printing Pipeline Strategy

To satisfy strict reliability and modularity, PocketPrint Bridge implements the following pipeline:

```
[ Laptop Browser (PDF Upload) ]
             │  (HTTPS/WSS)
             ▼
[ Cloud Relay (Job Queue & Token Auth) ]
             │  (Authenticated WSS / Socket.IO)
             ▼
[ Android Gateway App (Foreground Service) ]
             │
      ┌──────┴───────────────────────────┐
      │ 1. PDF Validation (size, pages)  │
      │ 2. Android PdfRenderer Engine    │
      │    (Page -> 300 DPI Bitmap)      │
      │ 3. Color/Grayscale Quantization  │
      └──────┬───────────────────────────┘
             │
             ▼
[ Modular PrinterBackend Architecture ]
  ├── A. CanonPixmaBackend (BJL / BJRaster3 encoder & Bulk OUT streamer)
  ├── B. PclBackend (For PCL-compliant laser/inkjet printers)
  ├── C. EscPBackend (For Epson ESC/P-R printers)
  ├── D. GenericRasterBackend (Raw raster format)
  └── E. SimulatedPrinterBackend (High-fidelity test harness with simulated USB latency & telemetry)
             │
             ▼
[ Android USB Host API (`UsbManager` / `UsbDeviceConnection`) ]
             │  (USB OTG Cable)
             ▼
[ Physical Canon PIXMA MG2570S ]
```

---

## 6. Distinguishing Printing Verification Stages
In accordance with system requirements, PocketPrint Bridge never falsely reports a job as completed:

| State Code | UI Status Label | Technical Meaning |
| :--- | :--- | :--- |
| `UPLOADED` | File Uploaded | PDF received and validated on Cloud Relay |
| `QUEUED` | Queued | Enqueued for dispatch to target Android gateway |
| `SENT_TO_DEVICE` | Sent to Phone | Streamed over WSS to Android gateway |
| `RECEIVED_BY_DEVICE` | Received by Phone | Gateway stored file and verified SHA-256 hash |
| `RENDERING` | Rendering | Android `PdfRenderer` rasterizing pages to bitmaps |
| `PRINTING` | Transmitting to USB | Data streaming to USB Bulk OUT endpoint |
| `DATA_ACCEPTED` | Data Accepted | USB device accepted all packets without pipe stall |
| `COMPLETED` | Physical Print Complete | Physical hardware confirmed print exit (or real printer handshake) |
| `SIMULATED_COMPLETED` | Simulated Complete | Printed via Simulated Backend (explicitly labeled) |
| `FAILED` | Failed | Error encountered with exact diagnostic reason |
| `CANCELLED` | Cancelled | Aborted by user before USB transmission |

---

## 7. Unknowns & Physical Verification Requirements
- **Firmware Revisions:** Canon has issued multiple minor revisions of the MG2570S motherboard (2014–2024). Variations in BJRaster3 compression headers must be confirmed with USB packet capture (USBPcap/Wireshark) on the physical unit.
- **Bidirectional Handshake:** The exact response codes returned on Bulk IN during paper out / cover open will be read via our Android diagnostic tool.

---

## 8. Conclusion
Direct Android USB OTG printing to Canon PIXMA MG2570S is technically feasible using the Android USB Host API paired with Android's native `PdfRenderer` and a modular `PrinterBackend`. The application includes complete diagnostics to inspect the connected hardware and a verified simulated backend for development and testability.
