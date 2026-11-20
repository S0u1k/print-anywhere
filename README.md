# PocketPrint Bridge: Dual-Gateway Remote Printing Platform

**Enterprise-Grade Remote Internet Printing for Windows & Android Gateways**

PocketPrint Bridge is an open-source, dual-gateway remote printing platform. It decouples document authors on mobile phone browsers or remote laptops from physical printer connectivity, enabling reliable PDF printing to host-based printers—specifically targeting the **Canon PIXMA MG2570S**—through whichever device physically hosts the printer:

1. **Mode A — Windows Laptop Print Gateway:**
   - Physical Connection: USB 2.0 cable to Windows 10/11 Laptop (`USB001`).
   - Trigger Source: Remote Android phone browser or any remote client.
   - Dispatch Engine: Authenticated background Windows Print Agent (`backend/src/laptopAgent.ts`).
   - Rendering: Official installed Windows Canon Driver (`Canon MG2500 series Printer`) & Windows Print Spooler (`spoolsv.exe`).

2. **Mode B — Android USB Print Gateway:**
   - Physical Connection: USB On-The-Go (OTG) cable to Android Smartphone.
   - Trigger Source: Remote laptop web browser or remote client.
   - Dispatch Engine: Android Foreground Service with USB Host API (`android/app/src/main/`).
   - Rendering: Native Android `PdfRenderer` rasterizing to 300/600 DPI matrices, converted into Canon Bubble Jet Language (BJL) + compressed BJRaster3 swath scanlines streamed across Bulk OUT `0x01`.

---

## 1. Unified Architecture & Workflows

```
┌────────────────────────────────────────────────────────────────────────┐
│                      ONE UNIFIED WEB DASHBOARD                         │
│             (Mobile Touch-Friendly & Desktop Responsive)               │
└──────────────────────────────────┬─────────────────────────────────────┘
                                   │ HTTPS / WSS
                                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   CLOUD RELAY SERVER (Port 5000)                       │
│             Node.js + Express + TypeScript + Socket.IO                 │
│         • Unified Device & Printer Registry                            │
│         • JWT & Hardware Authorization Checks                          │
│         • Magic Bytes Validation & SHA-256 Checksums                   │
└──────────────────┬─────────────────────────────────┬───────────────────┘
                   │ Outbound WSS                    │ Outbound WSS
                   ▼                                 ▼
      ┌─────────────────────────┐       ┌─────────────────────────┐
      │  MODE A: WINDOWS AGENT  │       │ MODE B: ANDROID GATEWAY │
      │ Windows 11 Laptop       │       │ Android Smartphone      │
      │ Direct Spooler Adapter  │       │ USB Host API & Service  │
      └────────────┬────────────┘       └────────────┬────────────┘
                   │ USB001                          │ USB OTG
                   ▼                                 ▼
      ┌─────────────────────────┐       ┌─────────────────────────┐
      │  Canon Windows Driver   │       │   CanonPixmaBackend     │
      │  (MG2500 Series Spooler)│       │   (BJL / BJRaster3)     │
      └────────────┬────────────┘       └────────────┬────────────┘
                   │                                 │
                   └────────────────┬────────────────┘
                                    ▼
                     [ Canon PIXMA MG2570S ]
                        PHYSICAL PRINTOUT
```

### Key Technical Properties:
- **No Router Port Forwarding Required:** Both gateways initiate authenticated outbound WebSocket connections to Cloud Relay.
- **Hardware Targeting:** Verified on the **Canon PIXMA MG2570S** (USB 2.0 Hi-Speed, VID: `0x04A9`, PID: `0x176D`).
- **Unified Registry:** Devices register with `gatewayType: 'WINDOWS_HOST'` or `'ANDROID_USB'`. Printers register with connection types `USB` or `USB_OTG` and their verified driver backend identifiers.
- **Truthful Status Reporting:** Never fakes percentages or marks simulated execution as physical. Differentiates `COMPLETED` (physical output) from `SIMULATED_COMPLETED` (virtual testing sandbox).

---

## 2. Hardware Specification: Canon PIXMA MG2570S

| Property | Value |
| :--- | :--- |
| **Manufacturer** | Canon Inc. |
| **Model** | PIXMA MG2570S (MG2500 Series) |
| **Interface** | USB 2.0 Hi-Speed (480 Mbps) |
| **USB Vendor ID (VID)** | `0x04A9` (Canon Inc.) |
| **USB Product ID (PID)** | `0x176D` (MG2500 Series) |
| **USB Class** | Interface Class `0x07` (Printer), Subclass `0x01`, Protocol `0x02` (Bidirectional) |
| **IEEE-1284 Identification** | `MFG:Canon;CMD:BJL,BJRaster3,BSCCe,NCCe,IVEC,IVECPLI;MDL:MG2500 series;` |
| **Data Format (Mode A)** | Windows EMF / XPS / RAW via Canon Windows Driver on `USB001` |
| **Data Format (Mode B)** | `@PJL` / `@BJL` Header + Compressed BJRaster3 Swaths (`ESC ( r 1` ... `ESC ( A`) |

---

## 3. Project Directory Structure

```
printer home/
├── backend/                       # Cloud Relay & Windows Laptop Print Agent
│   ├── src/
│   │   ├── db/store.ts            # Persistent JSON database with thread-safe disk sync
│   │   ├── middleware/auth.ts     # JWT user & device authentication
│   │   ├── routes/
│   │   │   ├── authRoutes.ts      # User sign-in, registration, password reset
│   │   │   ├── deviceRoutes.ts    # Gateway pairing & device management
│   │   │   ├── printerRoutes.ts   # Unified printer registry (GET, POST, DELETE)
│   │   │   └── jobRoutes.ts       # PDF upload, validation, and gateway dispatch
│   │   ├── socket/index.ts        # Socket.IO room routing (`device:<id>`, `user:<id>`)
│   │   ├── types/index.ts         # Unified domain types & 17-state JobStatus
│   │   ├── laptopAgent.ts         # Mode A: Windows Laptop Print Agent Daemon
│   │   └── server.ts              # Express & Socket.IO server entry point
│   ├── tests/api.test.ts          # Jest automated integration test suite (8/8 passing)
│   ├── test_e2e_dual_gateway.cjs  # End-to-end automated dual-gateway verification
│   └── package.json
├── web/                           # React 18 + Vite + TypeScript + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/            # Sidebar, TopNav, MobileNav, StatusBadge, UI kit
│   │   ├── context/AuthContext.tsx# Authentication context & Socket.IO initialization
│   │   ├── pages/
│   │   │   ├── DashboardPage.tsx  # Dual-gateway telemetry, quick print, recent jobs
│   │   │   ├── PrintDocumentsPage.tsx # PDF upload, dual destination selector, print parameters
│   │   │   ├── PrinterStatusPage.tsx  # Mode A vs Mode B hardware diagnostics & descriptors
│   │   │   ├── DeviceManagementPage.tsx# Separated Windows Gateways & Android Gateways
│   │   │   ├── PrintQueuePage.tsx # Real-time queue monitoring with gateway badges
│   │   │   ├── PrintHistoryPage.tsx   # Audit log with gateway tags and truthful status
│   │   │   └── AccountSettingsPage.tsx# Security, retention policies, and preferences
│   │   ├── services/api.ts        # REST API client
│   │   ├── services/socket.ts     # Socket.IO event listener helpers
│   │   ├── types/index.ts         # Frontend TypeScript interfaces
│   │   └── App.tsx                # Aurora Auth Screen + Authenticated App Router
│   └── package.json
└── android/                       # Kotlin + Jetpack Compose Android Studio App
    └── app/src/main/java/com/pocketprint/bridge/
        ├── driver/
        │   ├── CanonPixmaBackend.kt   # Native BJL + BJRaster3 protocol encoder
        │   ├── PrinterBackend.kt      # Modular printer driver contract
        │   └── PrinterBackendRegistry.kt
        ├── network/
        │   └── RelayWebSocketClient.kt# Socket.IO client with auto-reconnection
        ├── pdf/
        │   └── PdfRasterizer.kt       # Native Android 300/600 DPI bitmap rasterizer
        └── service/
            └── PrintGatewayService.kt # Android Foreground Service + WakeLock
```

---

## 4. Setup & Local Run Instructions

### Step 1: Start Cloud Relay Backend (Port 5000)
```bash
cd backend
npm install
npm test               # Run the 8-suite automated tests
npx tsx src/server.ts  # Starts server on http://localhost:5000
```

### Step 2: Start Windows Laptop Print Agent (Mode A)
In a separate terminal on the Windows laptop connected to the Canon printer via USB:
```bash
cd backend
npm run agent          # Starts Windows Print Agent daemon
```
*The agent discovers installed Windows printers via PowerShell, identifies the target Canon PIXMA MG2500 Series, connects outbound to Cloud Relay as `WINDOWS_HOST`, and registers the printer endpoint.*

### Step 3: Start Web Dashboard (Port 5173)
```bash
cd web
npm install
npm test               # Run frontend unit tests
npm run build          # Verifies clean production bundle
npm run dev -- --host  # Starts Vite dev server on http://localhost:5173
```

### Step 4: Access the Website
- **On Laptop:** Open `http://localhost:5173/`.
- **On Mobile Phone:** Connect to the same local Wi-Fi or public URL (e.g., `http://192.168.31.23:5173/`).
- Use the **1-Click Sign In (Souvik Admin Demo)** button or enter:
  - **Email:** `souvik@pocketprint.io`
  - **Password:** `Password123!`

---

## 5. Automated Verification & Test Results

Run the complete end-to-end integration test:
```bash
cd backend
node test_e2e_dual_gateway.cjs
```

### Verified Test Output:
```
===============================================================
  PocketPrint Bridge: End-to-End Dual-Gateway Integration Test 
===============================================================

[1/6] Authenticating User souvik@pocketprint.io...
  ✓ Logged in as: Souvik Admin (ID: usr-7040cb37)

[2/6] Verifying Dual-Gateway & Printer Registry...
  ✓ Discovered 2 Gateway(s):
    • [WINDOWS_HOST] "Windows Laptop Gateway (Canon MG2500)" (ID: dev-laptop-558419, Online: true)
    • [ANDROID_USB] "Google Pixel 8 Pro (Android USB Gateway)" (ID: dev-android-pixel-01, Online: true)
  ✓ Discovered 2 Printer(s):
    • [WINDOWS_HOST] "Canon MG2500 series Printer" (Conn: USB, Driver: Canon MG2500 series Printer)
    • [ANDROID_USB] "Canon PIXMA MG2570S (USB OTG)" (Conn: USB_OTG, Driver: CanonPixmaBackend)

[3/6] Generating Valid Test PDF Document...
  ✓ Test PDF created: test_doc.pdf (329 bytes)

[4/6] MODE A TEST: Dispatching PDF to Windows Laptop Gateway...
  ✓ Upload response: HTTP 201
  ✓ Job Created: ID=job-d38409c2, Gateway=WINDOWS_HOST, Status=QUEUED
  Waiting for Windows Print Agent to spool to Canon MG2500 series Printer...
    [Mode A Status] SUBMITTED_TO_PRINTER (50%)
    [Mode A Status] SPOOLING (70%)
    [Mode A Status] SPOOLER_COMPLETED (90%)
    [Mode A Status] COMPLETED (100%)
  ✓ MODE A SUCCESS: Job successfully spooled to Canon Windows Driver on USB001!

[5/6] MODE B TEST: Dispatching PDF to Android USB Gateway...
  ✓ Android Gateway Socket connected and joined room: device:dev-android-pixel-01
  ✓ Upload response: HTTP 201
  ✓ Job Created: ID=job-296e1779, Gateway=ANDROID_USB, Status=QUEUED
  ✓ Android Gateway Socket received job:incoming: "test_doc.pdf" (job-296e1779)
  ✓ MODE B SUCCESS: Android Gateway processed and acknowledged job

[6/6] Verifying Job History & Integrity...
  ✓ Found user audit log with distinct gateway modes and truthful simulation flags.

===============================================================
  ALL END-TO-END DUAL-GATEWAY ACCEPTANCE TESTS PASSED!        
===============================================================
```

---

## 6. Strict Rules & Compliance

- **No Remote Commits:** All development is maintained locally; strictly no unauthorized GitHub pushes.
- **Integrity First:** Simulated outputs are tagged `isSimulated: true` and `SIMULATED_COMPLETED`. Real hardware completions are marked `COMPLETED` only upon verified transmission.
- **Port Security:** No inbound ports are exposed on mobile phones or client laptops. Outbound TLS WebSocket connections ensure firewall and NAT traversal.

---

## 7. Open-Source License

This project is licensed under the **MIT License**.
