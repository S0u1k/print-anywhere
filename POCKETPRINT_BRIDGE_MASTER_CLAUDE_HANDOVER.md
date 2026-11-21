# POCKETPRINT BRIDGE — COMPREHENSIVE ARCHITECTURE, CODEBASE AUDIT & CLAUDE FIX HANDOVER

> **Document Version**: 2.0.0  
> **Target Device**: Canon PIXMA MG2570S  
> **Production Live URL**: [print-anywhere-three.vercel.app](https://print-anywhere-three.vercel.app/)  
> **GitHub Repository**: [github.com/S0u1k/print-anywhere](https://github.com/S0u1k/print-anywhere)  
> **Primary Branches**: `main` (Production)  

---

## 1. PROJECT EXECUTIVE SUMMARY

**PocketPrint Bridge** is a full-stack, cross-platform cloud printing ecosystem engineered to make standard, non-networked consumer USB printers (specifically the **Canon PIXMA MG2570S**) printable from any smartphone, laptop, or tablet anywhere in the world without requiring port forwarding, static public IPs, or mandatory account creation.

The project incorporates:
1. **Web Client** (`web/`): A responsive, mobile-first React 18 + Vite + TypeScript Single Page Application styled with Tailwind CSS, utilizing camera QR scanning (`jsqr`), Lucide icons, and zero-registration Anonymous Guest workspaces.
2. **Cloud Relay Server** (`backend/` & `api/`): An Express + TypeScript backend running on Node.js and deployed to Vercel Serverless Functions (`api/index.ts`). It handles REST APIs, Socket.IO real-time channels, pairing handshakes, and ephemeral file relays.
3. **Database & Cloud Storage** (`Firebase`): Cloud Firestore for cross-region persistent document sync, Firebase Authentication (Anonymous Guest linking to Email/Password), Firebase Realtime Database, and Firebase Cloud Storage.
4. **Mode A Host Agent** (`backend/src/laptopAgent.ts`): A background Node.js + PowerShell Win32 Spooler daemon running on a Windows PC/Laptop connected to the Canon PIXMA MG2570S via standard USB.
5. **Mode B Gateway App** (`android/app/`): A native Android Kotlin application utilizing the Android USB Host API, USB OTG, Room Database, and embedded PDF rasterization to drive the Canon PIXMA MG2570S directly from an Android smartphone.

---

## 2. THE THREE PRINTING MODES

```mermaid
flowchart TD
    subgraph ModeA["MODE A: Windows Laptop Host"]
        UserDeviceA["Phone / Web Browser"] -->|Uploads PDF| CloudRelayA["PocketPrint Cloud Relay"]
        CloudRelayA -->|WebSocket / Polling| LaptopAgent["Windows Laptop Agent (laptopAgent.ts)"]
        LaptopAgent -->|Win32 Spooler / PowerShell| CanonDriverA["Canon MG2500 Series Driver"]
        CanonDriverA -->|USB Type-A/B Cable| CanonPrinterA["Canon PIXMA MG2570S"]
    end

    subgraph ModeB["MODE B: Android USB Gateway"]
        UserDeviceB["Laptop / Remote Web Browser"] -->|Uploads PDF| CloudRelayB["PocketPrint Cloud Relay"]
        CloudRelayB -->|WebSocket / Job Event| AndroidGateway["Android Gateway App / Web Gateway"]
        AndroidGateway -->|Android USB Host / OTG| UsbDriverB["Canon USB Protocol Engine"]
        UsbDriverB -->|USB OTG Adapter| CanonPrinterB["Canon PIXMA MG2570S"]
    end

    subgraph ModeC["MODE C: Hybrid / Cloud Direct"]
        UserDeviceC["Any Paired Device"] -->|Job Dispatch| CloudRelayC["PocketPrint Cloud Relay"]
        CloudRelayC -->|Direct IP / Virtual Spooler| HybridGateway["LAN Gateway / Print Daemon"]
        HybridGateway --> CanonPrinterC["Target Printer"]
    end
```

### Detailed Mode Specifications:
* **MODE A (Windows Laptop Host)**:
  - **Topology**: Phone (Controller) → Web Cloud Relay → Windows Laptop (Gateway) → Canon PIXMA MG2570S.
  - **Host Daemon**: `backend/src/laptopAgent.ts`.
  - **Print Engine**: Uses Windows PowerShell (`Get-Printer`, `Get-PrintJob`) and executes headless printing via Microsoft Edge or Win32 default shell verbs (`msedge --headless --print-to-printer`).
  - **Telemetry**: Detects paper jams, offline status, spooler errors, and ink warnings from the Windows Print Spooler and relays them back to the web dashboard.

* **MODE B (Android USB Gateway)**:
  - **Topology**: Laptop (Controller) → Web Cloud Relay → Android Phone (Gateway) → USB OTG → Canon PIXMA MG2570S.
  - **Mobile Gateway**: `android/app/src/main/java/com/pocketprint/bridge/`.
  - **USB Protocol**: Communicates over `android.hardware.usb.UsbManager` with Canon Vendor ID `0x04A9` and Product ID `0x176D`. Rasterizes PDF pages using `android.graphics.pdf.PdfRenderer` into native raster data streamed over bulk USB endpoints.
  - **Relay Client**: `RelayWebSocketClient.kt` maintains a persistent socket or SSE connection to the Cloud Relay.

* **MODE C (Hybrid / Direct Connect)**:
  - Preserved existing architecture for direct-linked network daemons or peer-to-peer workspace connections.

---

## 3. COMPLETE REPOSITORY STRUCTURE

```
d:\My Created Projects\printer home/
├── .github/workflows/          # CI/CD and deployment workflows
├── .vercel/                    # Vercel project configuration
├── android/                    # Native Android USB Gateway App
│   ├── app/
│   │   ├── build.gradle.kts
│   │   └── src/main/java/com/pocketprint/bridge/
│   │       ├── data/           # Room Database & PrintJob entities
│   │       ├── driver/         # Canon MG2570S USB Driver implementation
│   │       ├── network/        # RelayWebSocketClient.kt
│   │       ├── pdf/            # PdfRasterizer.kt
│   │       ├── service/        # Background PrintGatewayService.kt
│   │       ├── ui/             # Jetpack Compose screens (Pairing, Dashboard, USB)
│   │       └── usb/            # UsbPrinterManager.kt (USB Host negotiation)
│   ├── build.gradle.kts
│   └── gradlew.bat
├── api/
│   └── index.ts                # Vercel Serverless Function entry point -> backend/src/app.ts
├── backend/                    # Node.js + Express + TypeScript Backend
│   ├── src/
│   │   ├── app.ts              # Express application setup & middleware stack
│   │   ├── server.ts           # Standalone HTTP & Socket.IO server startup
│   │   ├── laptopAgent.ts      # Mode A Windows Agent daemon
│   │   ├── db/
│   │   │   ├── schema.sql      # SQLite / Relational reference schema
│   │   │   └── store.ts        # In-memory + JSON file persistent data store
│   │   ├── middleware/
│   │   │   └── authMiddleware.ts # JWT + Guest Workspace session authentication
│   │   ├── routes/
│   │   │   ├── authRoutes.ts   # Traditional user registration & login
│   │   │   ├── deviceRoutes.ts # Device registration & telemetry heartbeats
│   │   │   ├── guestRoutes.ts  # Instant guest workspace provisioning
│   │   │   ├── jobRoutes.ts    # Print job creation, status polling & file downloads
│   │   │   ├── pairingRoutes.ts# 8-digit PIN & QR code handshake system
│   │   │   └── printerRoutes.ts# Printer capabilities & status queries
│   │   ├── services/
│   │   │   └── firebaseAdmin.ts# Firebase Admin SDK (Auth, Firestore, Storage)
│   │   ├── socket/
│   │   │   └── index.ts        # Socket.IO rooms, job dispatches & pairing events
│   │   ├── types/
│   │   │   └── index.ts        # Shared TypeScript interfaces & enums
│   │   └── utils/
│   │       ├── auth.ts         # JWT generation, token verification
│   │       └── pairingSync.ts  # Workspace token exchange logic
│   ├── tests/                  # Jest test suites (API, Pairing, QR)
│   ├── package.json
│   └── tsconfig.json
├── web/                        # React 18 + Vite + TypeScript Frontend
│   ├── src/
│   │   ├── App.tsx             # Root state container & navigation controller
│   │   ├── components/
│   │   │   ├── Navigation.tsx  # Header & navigation sidebar
│   │   │   ├── PairingModal.tsx# Universal 8-digit & QR pairing modal
│   │   │   ├── QrScanner.tsx   # Cross-platform live camera QR decoder (jsqr)
│   │   │   └── ui/             # Reusable UI primitives (Button, Card, Modal, Toast)
│   │   ├── context/
│   │   │   └── AuthContext.tsx # Guest workspace & Firebase Auth provider
│   │   ├── pages/
│   │   │   ├── AccountSettingsPage.tsx # Account, backup keys & cloud links
│   │   │   ├── DashboardPage.tsx       # Live status, quick actions, telemetry
│   │   │   ├── DeviceManagementPage.tsx# Connected gateways list & health
│   │   │   ├── PrintDocumentsPage.tsx  # PDF upload, formatting & print dispatcher
│   │   │   ├── PrintHistoryPage.tsx    # Completed job logs
│   │   │   ├── PrintQueuePage.tsx      # Active spooler monitor & retry/cancel
│   │   │   └── PrinterStatusPage.tsx   # Detailed Canon PIXMA hardware status
│   │   ├── services/
│   │   │   ├── api.ts          # Strongly-typed API client wrapper
│   │   │   ├── apiClient.ts    # Centralized fetch client (correlation IDs, errors)
│   │   │   └── firebase.ts     # Firebase Client SDK initialization
│   │   ├── types/              # Frontend TypeScript definitions
│   │   ├── utils/
│   │   │   └── qrPayloadParser.ts # Strict QR payload decoding & validation
│   │   └── __tests__/          # Vitest test suites (QR, Auth, Modes, Badges)
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.ts          # Manual chunk splitting (vendor-firebase, qr, etc.)
├── package.json                # Root package workspace
├── vercel.json                 # Vercel routing, build commands & header policies
└── .env.example
```

---

## 4. DEVICE PAIRING & WORKSPACE HANDSHAKE ENGINE

One of the most critical systems in PocketPrint Bridge is the **Zero-Friction Device Pairing Engine**. Users do NOT need to create username/password accounts to link their laptop and phone.

```mermaid
sequenceDiagram
    autonumber
    actor Phone as Phone (Mode B Gateway)
    participant Relay as PocketPrint Cloud Relay
    actor Laptop as Laptop (Web Controller)

    Phone->>Relay: POST /api/pairing/session (Initiator details)
    Relay-->>Phone: Returns { pairingCode: "1234-5678", sessionId, qrPayload }
    Note over Phone: Displays 8-digit PIN & QR Code
    
    alt Option A: Laptop scans QR with Camera
        Laptop->>Laptop: QrScanner captures video frames -> jsqr decodes JSON payload
        Laptop->>Relay: POST /api/pairing/claim { sessionId, qrToken, claimerDevice }
    else Option B: Laptop enters 8-digit PIN
        Laptop->>Relay: POST /api/pairing/claim { pairingCode: "1234-5678", claimerDevice }
    end

    Relay->>Relay: Validates session, marks CLAIMED, matches workspaceId
    Relay-->>Laptop: Returns { status: "CLAIMED", workspaceId, claimerToken }
    Relay--)Phone: Socket.IO emits 'pairing:claimed'
    
    Phone->>Relay: POST /api/pairing/confirm { sessionId }
    Relay-->>Phone: Returns { status: "COMPLETED", workspaceId, initiatorToken }
    Relay--)Laptop: Socket.IO emits 'pairing:completed'

    Note over Phone,Laptop: Both devices now share identical workspaceId!<br/>Phone registers Canon printer; Laptop sees it as ONLINE destination.
```

### Key Pairing Files & Functions:
1. `backend/src/routes/pairingRoutes.ts`:
   - `POST /session`: Generates collision-resistant 8-digit code (e.g., `4829-1053`) and cryptographically signed QR token.
   - `POST /claim`: Accepts either PIN or QR token; binds the claimer device to the session.
   - `POST /confirm`: Finalizes the handshake and synchronizes workspace permissions.
2. `web/src/components/PairingModal.tsx`:
   - Manages tabs: `'generate'` (Show QR / Code) and `'enter'` (Scan QR or Type PIN).
   - Polls session status every `1500ms` if WebSockets are interrupted.
   - Synchronizes tokens into `localStorage['pocketprint_token']` and `localStorage['pocketprint_workspace_id']`.
3. `web/src/components/QrScanner.tsx`:
   - Accesses camera via `navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })`.
   - Renders animated laser line and bounding guides.
   - Continuously scans offscreen canvas frames at `120ms` intervals using `jsqr`.
4. `web/src/utils/qrPayloadParser.ts`:
   - Validates JSON format: `{ sessionId, qrToken, pairingCode }`.
   - Supports URL fallback parameters: `https://...?pair=1234-5678&session=...`.
   - Safely discards invalid or external QR codes without crashing.

---

## 5. PRINT JOB LIFECYCLE & THE 4.5 MB VERCEL LIMITATION

### The Flow:
1. User navigates to **Print Document** (`web/src/pages/PrintDocumentsPage.tsx`).
2. Client checks connected destinations (`devices` and `printers` fetched from `/api/devices` and `/api/printers`).
3. User uploads PDF document.
4. User configures print options: Copies, Page Range, Paper Size (A4 / Letter), Orientation, Color / Monochrome, Resolution (300 / 600 DPI).
5. User clicks **Review & Send Print Job** -> **Confirm & Dispatch**.
6. Job is posted as `FormData` to `/api/jobs/upload`.
7. Backend validates PDF magic bytes (`%PDF-`), calculates SHA-256 integrity hash, stores file temporarily, creates a 60-minute expiring download token, and dispatches an event (`job:incoming`) to the target device room via Socket.IO.
8. The target device (Windows Agent or Android Gateway) downloads the file using the token and sends it to the physical Canon PIXMA MG2570S.

### Critical Production Constraints & Fixes:
> [!IMPORTANT]
> **Vercel Serverless Function Body Limit (4.5 MB)**:
> Vercel limits incoming HTTP request bodies on serverless functions to **4.5 MB**.
> - If a user attempts to upload a 50 MB file directly to `/api/jobs/upload` on Vercel, the Vercel edge proxy immediately terminates the connection with a network drop or `413 FUNCTION_PAYLOAD_TOO_LARGE`.
> - **Client Guard Implemented**: `PrintDocumentsPage.tsx` enforces `MAX_FILE_SIZE_MB = 4.5`. Files above 4.5 MB are caught immediately with an informative toast rather than hanging.
> - **Extended Timeout**: `api.uploadPrintJob` has been configured with `timeoutMs: 90000` (90 seconds) so that slow mobile uploads don't hit the default 15-second timeout.
> - **Valid Destination Enforcement**: Previously, the confirmation modal allowed dispatching even if `Destination: No destination selected`. The UI now strictly disables submission until an active gateway/printer is paired and selected.

---

## 6. FIREBASE & CLOUD ARCHITECTURE

The application runs in a **Hybrid Resilience Architecture**:
- **Cloud Firestore**:
  - Used for real-time document synchronization across paired devices.
  - Setup: In the Firebase Console, the project is configured under `print-anywhere-souvik`.
  - When setting up Firestore, **"Start in test mode"** is used during setup so client devices can read/write pairing sessions and printer telemetry.
- **In-Memory / Local JSON Fallback** (`backend/src/db/store.ts`):
  - If Firebase Admin credentials are not provided in environment variables, the backend gracefully falls back to `pocketprint_store.json` in `/tmp` (on Vercel) or the local directory.
  - All pairing, device registration, and job queuing functions continue to work without throwing unhandled exceptions.
- **Firebase Authentication** (`web/src/context/AuthContext.tsx`):
  - Supports anonymous guest authentication (`signInAnonymously`) with a 128-bit workspace recovery key.
  - Allows linking anonymous guest workspaces to a permanent email/password account at any time via `linkGuestToAccount`.

---

## 7. AUTOMATED TEST SUITE STATUS

Both the frontend and backend have comprehensive test suites that can be executed at any time:

### Frontend Vitest Suite (`web/`):
```bash
npm --prefix web run test
```
* **Status**: **30 / 30 Tests Passing**
  - `modeSelection.test.ts`: Verifies Mode A, Mode B, and Mode C selection and `localStorage` persistence.
  - `qrScanner.test.ts`: Verifies QR JSON parsing, URL query extraction, raw code validation, and error rejection.
  - `apiClient.test.ts`: Verifies Bearer token headers, timeout handling, non-2xx status handling, and offline detection.
  - `statusBadge.test.ts`: Verifies online/offline visual indicators.
  - `guestAuthFlow.test.ts`: Verifies anonymous workspace generation and hybrid mode recovery.

### Backend Jest Suite (`backend/`):
```bash
npm --prefix backend run test
```
* **Status**: **18 / 18 Tests Passing**
  - `api.test.ts`: Tests authentication, device registration, printer capability query, and job upload.
  - `bidirectionalPairing.test.ts`: Tests complete 8-digit PIN handshake cycle.
  - `qrPairing.test.ts`: Tests QR session claim, validation, and Socket.IO event emission.

---

## 8. BUILD & DEPLOYMENT CONFIGURATION

### Vercel Production Build:
- Root directory contains `vercel.json`:
  ```json
  {
    "version": 2,
    "builds": [
      {
        "src": "api/index.ts",
        "use": "@vercel/node"
      },
      {
        "src": "web/package.json",
        "use": "@vercel/static-build",
        "config": {
          "distDir": "dist"
        }
      }
    ],
    "routes": [
      { "src": "/api/(.*)", "dest": "api/index.ts" },
      { "src": "/(.*)", "dest": "web/$1" }
    ]
  }
  ```
- **Vite Chunk Optimization** (`web/vite.config.ts`):
  - Chunks are cleanly split using Rollup `manualChunks`:
    - `vendor-firebase` (~694 kB)
    - `vendor-qr` (~154 kB)
    - `vendor-react` (~133 kB)
    - `vendor-icons` (~29 kB)
    - `index` application bundle (~208 kB)
  - Zero chunk size warnings; `chunkSizeWarningLimit` set to 1500.
- **npm Settings**:
  - `allowScripts` configured for `@firebase/util`, `protobufjs`, and `esbuild`.
  - `.npmrc` configured with `audit=false` and `fund=false` to eliminate noisy build logs.

---

## 9. CLAUDE DIRECTIVE: MASTER TASK LIST & PROMPTS

When you paste this file to Claude, you can use the prompt template below to assign specific remaining tasks or enhancements:

### Master Prompt Template for Claude:

```markdown
# TASK: AUDIT & ENHANCE POCKETPRINT BRIDGE

Hello Claude,
You are acting as the Principal Architect, Full-Stack Engineer, and Embedded Systems Specialist for PocketPrint Bridge.
All architecture, codebase structures, pairing logic, and hardware constraints are detailed in the handover specification above.

Your mission is to inspect the codebase, address any remaining edge cases, and execute the requested enhancements.

### KEY AREAS TO FOCUS ON:
1. **Large File Uploads via Firebase Storage (Bypassing Vercel's 4.5 MB Limit)**:
   - When a user uploads a PDF > 4.5 MB (e.g., 20 MB - 50 MB), instead of uploading through `/api/jobs/upload`, the frontend should directly stream the file to Firebase Cloud Storage via `uploadBytesResumable()` in `web/src/services/firebase.ts`.
   - Once uploaded, the client should pass the resulting download URL to a new endpoint `/api/jobs/create-from-storage` so the target gateway can fetch it directly without exceeding Vercel's payload limits.

2. **Android USB OTG Driver (Canon PIXMA MG2570S)**:
   - Inspect `android/app/src/main/java/com/pocketprint/bridge/driver/CanonMg2570sDriver.kt` and `UsbPrinterManager.kt`.
   - Ensure the bulk transfer endpoints, raster resolution mapping (300 DPI vs 600 DPI), and BJNP/Canon raster escape sequences correctly drive the print head and feed mechanism.

3. **Windows Laptop Agent (`backend/src/laptopAgent.ts`)**:
   - Ensure the agent handles automatic reconnection, self-healing WebSocket drops, and reports live print spooler queue counts and ink levels.

Please review the codebase, propose your plan, and provide precise, complete drop-in code fixes.
```

---

## 10. SUMMARY OF RECENT COMMITS ON `main`

| Commit | Description |
| :--- | :--- |
| `f32aefe` | **fix(print)**: Enforce valid gateway destination, validate 4.5 MB Vercel payload limit, and increase upload timeout to 90s |
| `513b73e` | **chore**: Fix npm `cache-dir` and `allowScripts` warnings; optimize Vite manual chunks |
| `9418bf0` | **feat(qr)**: Implement live camera QR code scanner with `jsqr`, frame-by-frame decoding, and permission recovery |
| `a55099f` | **fix(pairing)**: Fix bidirectional pairing code lookup, token synchronization, and guest workspace pairing |
