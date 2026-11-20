# PocketPrint Bridge — Complete Project Documentation

**Project Name:** PocketPrint Bridge  
**Version:** 2.0.0 (Production Architecture & Local Release)  
**Primary Target Hardware:** Canon PIXMA MG2570S (USB 2.0 Hi-Speed, Host-Based GDI)  
**Operating Environment:** Windows 11 (Laptop Gateway), Android 12+ (OTG Mobile Gateway), Modern Web Browsers  
**Author / Engineering Team:** Antigravity Engineering Team  

---

## 1. Project Overview

**PocketPrint Bridge** is an open-source, hybrid remote printing platform engineered to turn non-networked, host-based USB printers into smart, cloud-accessible network printers.

Following the discontinuation of Google Cloud Print in December 2020, users with affordable consumer USB printers (such as the **Canon PIXMA MG2570S**) were left without native remote printing capabilities. PocketPrint Bridge solves this problem through an outbound WebSocket relay and dual-gateway architecture that requires **no router port forwarding, no dedicated Linux CUPS server, and no expensive Raspberry Pi hardware**.

---

## 2. Dual Operating Modes

The system supports two complementary printing workflows:

```
========================================================================================
MODE 1: Mobile-to-Laptop Spooler (Active Home Setup)
========================================================================================
[ Smartphone (Mobile Browser) ]
            │  Wi-Fi / Internet (http://192.168.31.23:5173)
            ▼
[ Cloud Relay Hub (Port 5000) ]
            │  Socket.IO: "job:incoming"
            ▼
[ Windows Laptop Print Agent (`laptopAgent.ts`) ]
            │  Windows Spooler Dispatch (msedge --headless --print-to-printer)
            ▼
[ Canon PIXMA MG2570S Printer (USB001 Port) ]  ===> PHYSICAL PRINTOUT

========================================================================================
MODE 2: Remote-to-Android USB OTG Gateway (Autonomous Mobile Mode)
========================================================================================
[ Remote Laptop Browser (Anywhere in the World) ]
            │  HTTPS / WSS (Upload PDF)
            ▼
[ Cloud Relay Hub (Node.js + Socket.IO) ]
            │  Outbound Authenticated WebSocket
            ▼
[ Android Gateway Phone (Foreground Service + WakeLock) ]
            │  1. Download PDF via expiring 1-hour JWT token
            │  2. Native Android `PdfRenderer` (300/600 DPI)
            │  3. Convert to Canon Bubble Jet Language (BJL) + BJRaster3 Swaths
            │  4. Android USB Host API (Claim Interface, Bulk OUT 0x01)
            ▼
[ Canon PIXMA MG2570S Printer (USB OTG Cable) ]  ===> PHYSICAL PRINTOUT
```

---

## 3. System Architecture & Modules

The repository consists of four decoupled subsystems:

### A. Web Dashboard & User Interface (`web/`)
* **Framework:** React 18, Vite, TypeScript, Tailwind CSS v4, `motion/react`, `lucide-react`.
* **Aurora Sign Up Interface ([`web/src/App.tsx`](file:///d:/My%20Created%20Projects/printer%20home/web/src/App.tsx)):**
  * Modern two-column layout (`52%` Hero column + `48%` Form column).
  * Autoplay, loop background video without dark tint overlays.
  * Staggered entry animation via `motion/react`.
  * Dynamic 3-phase activation steps (`<StepItem>`).
  * Social buttons (Google with `Chrome` icon, Github with `Github` icon).
  * Password input with interactive eye toggle and validation helper text.
* **Full Multi-Page Management Console:**
  * **Dashboard:** Real-time metrics, active gateway status, target hardware specs card.
  * **Print Documents:** Drag-and-drop PDF upload, page range, copies, A4/Letter size, orientation, color/grayscale, DPI.
  * **Printer Management:** Real-time IEEE-1284 string inspection, USB Bulk OUT/IN endpoint health, OTG step-by-step guide.
  * **Gateways:** Gateway phone pairing with 6-digit PIN / QR countdown, gateway rename, and unpairing dialog.
  * **Queue & History:** Live animated progress bars, cancellation modals, searchable audit logs.
  * **Settings:** User profile, document retention timer (1 hr, 24 hr, 7 days), printing defaults.

### B. Cloud Relay Backend (`backend/`)
* **Runtime:** Node.js, Express, TypeScript, Socket.IO.
* **Security & Auth:** JWT tokens (`30d` for devices, `7d` for users), bcrypt password hashing.
* **PDF Engine & Validation:**
  * Validates `%PDF-` magic header bytes via Multer memory/disk pipeline.
  * Verifies file integrity with SHA-256 hashes.
  * Enforces a 50 MB file size cap.
* **Expiring Download Tokens:** Generates single-use 1-hour JWT tokens for gateway file downloads (`/api/jobs/:id/download`).
* **Automated Retention Purge:** 30-minute background interval that purges expired job PDFs from disk.
* **Persistence:** Atomic, persistent JSON data store ([`pocketprint_store.json`](file:///d:/My%20Created%20Projects/printer%20home/backend/pocketprint_store.json)) with support for PostgreSQL migration (`schema.sql`).

### C. Windows Laptop Print Agent (`backend/src/laptopAgent.ts`)
* **Runtime:** TypeScript daemon (`npm run agent`) executed on the Windows host.
* **Functionality:**
  * Auto-discovers installed Windows printers (`Canon MG2500 series Printer` on `USB001`).
  * Registers and maintains an active device session with the Cloud Relay.
  * Sends telemetry heartbeats every 10 seconds.
  * Listens for `job:incoming` events.
  * Downloads PDF using the job's secure download token.
  * Spools silently to the Canon printer via headless Microsoft Edge Chromium:
    ```powershell
    msedge.exe --headless --disable-gpu --print-to-printer="Canon MG2500 series Printer" "temp_spool\job.pdf"
    ```
  * Broadcasts real-time progress (`PRINTING` at 20% $\rightarrow$ 60% $\rightarrow$ `COMPLETED` at 100%).

### D. Android Gateway Application (`android/`)
* **Language & UI:** Kotlin, Jetpack Compose Material 3, MVVM architecture.
* **Foreground Service:** `PrintGatewayService.kt` with persistent notification and partial `WakeLock` to prevent Android Doze mode termination.
* **USB Host API:** `UsbPrinterManager.kt` discovers USB devices, requests OTG permissions, extracts IEEE-1284 device IDs via control transfer `0xA1`, and claims Bulk OUT (`0x01`) and Bulk IN (`0x81`) endpoints.
* **Modular Driver Registry:**
  * `CanonPixmaBackend.kt`: BJL headers, BJRaster3 compression, swath chunking, and status register polling.
  * `SimulatedPrinterBackend.kt`: Virtual sandbox producing truthful `SIMULATED_COMPLETED` statuses when physical hardware is detached.
  * Extensible interfaces for `PclBackend.kt`, `EscPBackend.kt`, and `GenericRasterBackend.kt`.
* **Rasterizer Engine:** `PdfRasterizer.kt` leveraging native Android `PdfRenderer` for 300/600 DPI bitmap extraction.

### E. Interactive 3D Mascot (`index.html`)
* **Engine:** Three.js r169 WebGL rendering module.
* **Features:**
  * Cursor-tracking kinematic head (`robot` $\rightarrow$ `body` $\rightarrow$ `head`) with exponential damping.
  * Curvature-mapped visor wrapped mathematically onto sphere: $z = \sqrt{R^2 - x^2 - y^2}$.
  * Procedural eyes, iris radial gradient, dark pupil, and specular glint following cursor.
  * Phase-shifted floating arms ($\pi \times 0.85$ offset).
  * Emissive spherical studio softboxes and bloom post-processing (`UnrealBloomPass`).
  * Automatic procedural fallback if 3D GLB assets fail.

---

## 4. Hardware Profile: Canon PIXMA MG2570S

| Property | Value |
| :--- | :--- |
| **Manufacturer** | Canon Inc. |
| **Product Name** | Canon PIXMA MG2570S (MG2500 Series) |
| **Interface** | USB 2.0 Hi-Speed (480 Mbps) |
| **Vendor ID (VID)** | `0x04A9` (Canon Inc.) |
| **Product ID (PID)** | `0x176D` (MG2500 Series) |
| **USB Class** | Class `0x07` (Printer), Subclass `0x01` (Printers), Protocol `0x02` (Bidirectional) |
| **Bulk OUT Endpoint** | `0x01` (Data Transfer Pipe) |
| **Bulk IN Endpoint** | `0x81` (Status & Telemetry Pipe) |
| **IEEE-1284 String** | `MFG:Canon;CMD:BJL,BJRaster3,BSCCe,NCCe,IVEC,IVECPLI;MDL:MG2500 series;` |
| **Driver Protocol** | Canon Bubble Jet Language (`BJL`) + Compressed `BJRaster3` Swaths |

> [!WARNING]
> **No Raw PDF Acceptance:** The Canon PIXMA MG2570S is a host-based GDI printer without an onboard PostScript/PCL interpreter. Sending raw PDF or text bytes causes USB pipe stalls or ink error codes `1000`/`1300`. Print jobs must always be converted to raster scanlines before USB transfer.

---

## 5. API & WebSocket Specifications

### REST Endpoints

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | None | Service health, uptime, and status check |
| `POST` | `/api/auth/register` | None | User account creation |
| `POST` | `/api/auth/login` | None | Authenticate user & return JWT token |
| `GET` | `/api/devices` | User JWT | List paired gateways for the current user |
| `POST` | `/api/devices/pair-code`| User JWT | Generate 6-digit pairing code & QR payload |
| `POST` | `/api/devices/pair` | None | Complete gateway device pairing |
| `POST` | `/api/jobs/upload` | User JWT | Upload PDF & enqueue print job (`multipart/form-data`) |
| `GET` | `/api/jobs` | User JWT | List print jobs for the authenticated user |
| `GET` | `/api/jobs/:id` | User JWT | Retrieve specific print job detail & progress |
| `GET` | `/api/jobs/:id/download`| Token | Download print job PDF using single-use 1h token |
| `POST` | `/api/jobs/:id/cancel` | User JWT | Cancel an active or queued print job |

### WebSocket Protocol (Socket.IO)

* **`device:register`**: Sent by the gateway upon connection to declare capabilities (printer model, USB status).
* **`device:heartbeat`**: Periodic telemetry packet emitted every 10 seconds.
* **`device:status_change`**: Broadcasts gateway online/offline transitions to the user's dashboard room.
* **`job:incoming`**: Emitted by relay to dispatch print job payloads to target gateway rooms.
* **`job:status_update`**: Emitted by gateways to report progress (`QUEUED` $\rightarrow$ `PRINTING` $\rightarrow$ `COMPLETED` / `FAILED`).

---

## 6. Local Quickstart Guide

### Running All Components

#### 1. Start Cloud Relay Backend (Port 5000)
```powershell
cd "d:\My Created Projects\printer home\backend"
npx tsx src/server.ts
```

#### 2. Start Windows Laptop Print Agent (Gateway Daemon)
```powershell
cd "d:\My Created Projects\printer home\backend"
npm run agent
```

#### 3. Start Web Dashboard (Port 5173)
```powershell
cd "d:\My Created Projects\printer home\web"
npx vite --port 5173 --host
```

#### 4. Access URLs:
* **Local Laptop Browser:** [http://localhost:5173/](http://localhost:5173/)
* **Mobile Phone on Wi-Fi:** `http://192.168.31.23:5173/`
* **Default Admin Account:**
  * **Email:** `souvik@pocketprint.io`
  * **Password:** `Password123!`

---

## 7. Automated Test Verification Results

All test suites and production builds across the stack are passing:

```text
========================================================================
1. Backend Integration Test Suite (Jest + Supertest)
========================================================================
PASS tests/api.test.ts
  √ 1. Health check returns status 200 and ok (94 ms)
  √ 2. Register a new user (224 ms)
  √ 3. Duplicate user registration should fail with 409 (121 ms)
  √ 4. Login with correct credentials returns token (213 ms)
  √ 5. Generate device pairing code (26 ms)
  √ 6. Complete device pairing using pairing code (14 ms)
  √ 7. Reject non-PDF file upload (36 ms)
  √ 8. Upload valid PDF and create print job (133 ms)
Test Suites: 1 passed, 1 total
Tests:       8 passed, 8 total

========================================================================
2. Frontend Unit Test Suite (Vitest)
========================================================================
✓ src/__tests__/statusBadge.test.ts (2 tests)
Test Files: 1 passed (1)
Tests:      2 passed (2)

========================================================================
3. Frontend Production Build (TypeScript + Vite + PostCSS)
========================================================================
✓ 1929 modules transformed.
dist/index.html                   0.92 kB │ gzip:  0.58 kB
dist/assets/index-CUJCz1mh.css   36.02 kB │ gzip:  6.98 kB
dist/assets/index-qxH8Sh1B.js   298.16 kB │ gzip: 98.03 kB
✓ built in 13.75s
```

---

## 8. Repository Directory Map

```
printer home/
├── GITHUB_RESEARCH_REPORT.md   # Prior art & competitive analysis
├── FEASIBILITY_REPORT.md       # Hardware reverse-engineering report
├── PROJECT_DOCUMENTATION.md    # Master technical manual (This document)
├── README.md                   # Quickstart guide
├── docker-compose.yml          # Container configuration
├── index.html                  # Standalone Iris 3D Mascot Hero section
├── android/                    # Android Studio Project (Kotlin, Jetpack Compose)
│   ├── app/src/main/
│   │   ├── java/com/pocketprint/bridge/
│   │   │   ├── driver/         # CanonPixmaBackend, BJRaster3, Simulation
│   │   │   ├── usb/            # UsbPrinterManager, Diagnostics
│   │   │   ├── pdf/            # PdfRasterizer
│   │   │   ├── network/        # RelayWebSocketClient
│   │   │   ├── service/        # PrintGatewayService
│   │   │   └── ui/             # Jetpack Compose Screens
├── backend/                    # Node.js + TypeScript Cloud Relay
│   ├── src/
│   │   ├── db/                 # DataStore & PostgreSQL DDL
│   │   ├── routes/             # authRoutes, deviceRoutes, jobRoutes
│   │   ├── socket/             # Socket.IO event hub & rooms
│   │   ├── utils/              # JWT & bcrypt utilities
│   │   ├── laptopAgent.ts      # Windows Spooler Gateway Daemon
│   │   └── server.ts           # Express server entry point
│   └── tests/                  # Jest integration test suite
└── web/                        # React 18 + Vite Web Dashboard
    ├── src/
    │   ├── App.tsx             # Aurora Sign Up & Dashboard router
    │   ├── index.css           # Tailwind CSS & Inter typography
    │   ├── components/ui/      # Reusable UI component library
    │   └── services/           # REST api client & socket.io client
    ├── postcss.config.js       # PostCSS Tailwind plugin config
    └── tailwind.config.js      # Tailwind configuration & design tokens
```
