# PocketPrint Bridge — Final Release Report (v1.0.0)

**Project:** PocketPrint Bridge: Open-Source Dual-Gateway Remote Printing Platform  
**Target Hardware:** Canon PIXMA MG2570S All-in-One Inkjet  
**Version:** v1.0.0 (Production Release)  
**Date:** November 20, 2026  
**Status:** Released & Publicly Available  
**Lead Architect:** Senior Software Architect & DevOps Lead  

---

## 1. Release Overview

PocketPrint Bridge is an open-source, production-grade remote printing ecosystem that bridges modern web clients to legacy, host-based GDI desktop printers (specifically the Canon PIXMA MG2570S) without requiring specialized network hardware or proprietary print servers.

The v1.0.0 release achieves complete feature parity across:
1. **Mode A — Windows Laptop Gateway**: Turns any Windows 10/11 laptop into an Internet-connected print gateway leveraging installed native drivers (`Canon MG2500 series Printer` on `USB001`) and the Windows Spooler (`spoolsv.exe`).
2. **Mode B — Android Smartphone USB OTG Gateway**: Turns an Android 12+ smartphone into a portable, battery-powered print server utilizing Android USB Host APIs, Canon BJL command encapsulation, and BJRaster3 swath rendering.
3. **Cloud Synchronization & Global Reach**: Backed by Firebase Firestore, Realtime Database (RTDB), and deployed as a serverless web app on **Vercel Edge Network**.

---

## 2. Key Links & Verified Deliverables

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               VERIFIED RELEASE ASSETS                                  │
├─────────────────────────┬──────────────────────────────────────────────────────────────┤
│ Resource                │ Verified Destination / Value                                 │
├─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ Public GitHub Repo      │ https://github.com/S0u1k/print-anywhere                      │
│ Live Production URL     │ https://print-anywhere-three.vercel.app                      │
│ Vercel Preview URL      │ https://print-anywhere-o3g4wo03j-souvik-s-projects4.vercel.app│
│ Git Release Commit      │ 2260f70 (branch main)                                        │
│ Target Printer Model    │ Canon PIXMA MG2570S (USB ID: 0x04A9:0x176D)                  │
│ Verified Operating Sys  │ Windows 10/11 Home x64, Android 12+ (API 31+)                │
│ Startup Orchestrator    │ start.bat (Single-click local daemon orchestrator)           │
│ Shutdown Orchestrator   │ stop.bat (Single-click port release & process manager)       │
│ Centralized Cache Path  │ D:\My Created Projects\Cache                                 │
└─────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 3. Core Architectural Modules

### 3.1 Mode A: Windows Laptop Print Gateway
- **Agent Entry Point:** [`backend/src/laptopAgent.ts`](file:///d:/My%20Created%20Projects/printer%20home/backend/src/laptopAgent.ts)
- **Driver Integration:** Automatic detection of `Canon MG2500 series Printer` on port `USB001`.
- **Spooler Engine:** Seamless execution through Microsoft Edge Headless or native PowerShell spooler commands:
  ```powershell
  msedge.exe --headless --disable-gpu --print-to-printer="Canon MG2500 series Printer" temp_spool\job.pdf
  ```
- **Real-Time Presence:** Continuous heartbeat synchronization with Firebase RTDB (`presence/${deviceId}`) with automatic `onDisconnect()` transition.
- **Queue Polling:** Actively polls `Get-PrintJob` to provide incremental percentage-based progress (`RECEIVED_BY_GATEWAY` 20% -> `VALIDATING` 35% -> `SUBMITTED_TO_PRINTER` 50% -> `SPOOLING` 70% -> `SPOOLER_COMPLETED` 90% -> `COMPLETED` 100%).

### 3.2 Mode B: Android USB OTG Gateway
- **Engine Entry Point:** [`android/app/src/main/java/com/pocketprint/bridge/driver/CanonPixmaBackend.kt`](file:///d:/My%20Created%20Projects/printer%20home/android/app/src/main/java/com/pocketprint/bridge/driver/CanonPixmaBackend.kt)
- **USB Host Claims:** USB Vendor `0x04A9`, Product `0x176D` on Interface `0x00`.
- **Endpoints:** Direct communication via Bulk OUT (`0x01`) and Bulk IN (`0x81`).
- **BJL / BJRaster3 Pipeline:** Encapsulates high-resolution raster bit-planes into BJL command blocks (`@BJL START JOB`, `@BJL SET RESOLUTION=300`, `@BJL SET PAPER=A4`).

### 3.3 Bidirectional Pairing & Guest Workspaces
- **Flow A:** Phone scans Laptop QR code.
- **Flow B:** Laptop scans Phone QR code.
- **Flow C:** Laptop enters 6-digit code generated on phone.
- **Flow D:** Phone enters 6-digit code generated on laptop.
- **Security:** 5-attempt rate-limiting lockout, single-use HMAC token generation, 12-word mnemonic recovery keys, and zero cross-workspace data leakage.

### 3.4 Unified Print Form ([`PrintDocumentsPage.tsx`](file:///d:/My%20Created%20Projects/printer%20home/web/src/pages/PrintDocumentsPage.tsx))
- Single, modern reactive form catering to all print gateways.
- Features drag-and-drop PDF upload, instant client-side page counting and rendering previews, paper size selection (A4, Letter, 4x6"), orientation (Portrait/Landscape), copies, color/monochrome modes, and live progress bars.

---

## 4. Release Verification & Test Results

- **Automated Tests:** 15/15 passed in `backend/test_bidirectional_pairing_e2e.cjs`.
- **TypeScript Integrity:** Clean compilation with 0 errors across backend and frontend.
- **Web Build:** 388.94 kB optimized production bundle generated in 6.61s.
- **Live Vercel Edge Probe:** HTTP 200 OK with verified CDN cache headers.
- **Clean Process Termination:** `stop.bat` tested and verified to cleanly unbind ports 5000 and 5173.

---

## 5. Quick-Start Guide

### Option 1: Local Development & Windows Printing
1. Double-click [`start.bat`](file:///d:/My%20Created%20Projects/printer%20home/start.bat).
   - Starts Cloud Relay (port 5000), Vite Web UI (port 5173), and Windows Print Agent.
   - Automatically opens `http://localhost:5173` in your browser.
2. Connect your Canon PIXMA MG2570S via USB.
3. Upload any PDF file and click **Print Now**.
4. To safely stop all services, double-click [`stop.bat`](file:///d:/My%20Created%20Projects/printer%20home/stop.bat).

### Option 2: Live Cloud Remote Printing
1. Visit the live production URL: **[https://print-anywhere-three.vercel.app](https://print-anywhere-three.vercel.app)**.
2. Use Guest Mode or sign in.
3. Pair your laptop or phone gateway using the bidirectional QR pairing screen.
4. Print documents from any browser, anywhere in the world!
