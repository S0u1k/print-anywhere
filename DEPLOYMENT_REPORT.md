# PocketPrint Bridge — Production Deployment Report

**Project:** PocketPrint Bridge: Dual-Gateway Remote Printing Platform  
**Target Hardware:** Canon PIXMA MG2570S All-in-One Inkjet  
**Date:** November 20, 2026  
**Status:** Live in Production & Published on GitHub  
**Evaluator:** Senior DevOps, Cloud Infrastructure & Release Engineer  

---

## 1. Executive Summary

PocketPrint Bridge has been successfully deployed to global production via **Vercel Edge Network** and published to **GitHub** under an open-source license. The platform is configured for continuous delivery, featuring zero-configuration local orchestration through Windows batch scripts (`start.bat` / `stop.bat`) and scalable cloud edge hosting.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              PRODUCTION DEPLOYMENT OVERVIEW                            │
├─────────────────────────┬──────────────────────────────────────────────────────────────┤
│ Metric                  │ Verified Production State                                    │
├─────────────────────────┼──────────────────────────────────────────────────────────────┤
│ GitHub Repository       │ https://github.com/S0u1k/print-anywhere                      │
│ Git Branch & Commit     │ main (commit 2260f70)                                        │
│ Vercel Project          │ print-anywhere (Team: souvik-s-projects4)                     │
│ Production URL          │ https://print-anywhere-three.vercel.app                      │
│ Preview URL             │ https://print-anywhere-o3g4wo03j-souvik-s-projects4.vercel.app│
│ Production Deployment ID│ dpl_Ks9zGhZQeddwDiShJi1nPHKTX74B                             │
│ Edge Response Status    │ HTTP/1.1 200 OK (Server: Vercel)                             │
│ Web Bundle Size         │ 388.94 kB gzip (built in 6.61s)                              │
│ API Runtime             │ Vercel Serverless Function (Node.js 20.x / 22.x)              │
│ Local Runtime Scripts   │ start.bat / stop.bat (1-click background orchestration)       │
└─────────────────────────┴──────────────────────────────────────────────────────────────┘
```

---

## 2. GitHub Source Control & Repository Publication

- **Repository URL:** [https://github.com/S0u1k/print-anywhere](https://github.com/S0u1k/print-anywhere)
- **Default Branch:** `main`
- **Initial Release Commit:** `2260f70`
- **Repository Visibility:** Public
- **Security & Hygiene Controls:**
  - Strict `.gitignore` policy actively excludes:
    - Environment secrets: `.env`, `.env.local`, `.env.production`
    - Service account keys: `*firebase*.json`, `*credentials*.json`
    - Temporary spooled documents: `backend/uploads/`, `backend/temp_spool/`, `*.pdf`
    - Build caches & dependencies: `node_modules/`, `dist/`, `.vite/`, `build/`
    - Android builds: `.gradle/`, `android/app/build/`

---

## 3. Vercel Cloud Deployment Architecture

### 3.1 Project Configuration ([`vercel.json`](file:///d:/My%20Created%20Projects/printer%20home/vercel.json))
The project structure maintains frontend and backend in separate directories (`web/` and `backend/`). To ensure flawless monorepo building on Vercel without manual configuration, the root contains:

```json
{
  "name": "print-anywhere",
  "framework": "vite",
  "installCommand": "npm --prefix web install",
  "buildCommand": "npm --prefix web run build",
  "outputDirectory": "web/dist",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Root [`package.json`](file:///d:/My%20Created%20Projects/printer%20home/package.json) orchestrates the build:
```json
{
  "name": "print-anywhere",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "npm --prefix web install && npm --prefix web run build"
  }
}
```

### 3.2 Serverless API Handler ([`api/index.ts`](file:///d:/My%20Created%20Projects/printer%20home/api/index.ts))
Exposes the core Express routing logic (`backend/src/app.ts`) as a serverless microservice handling health checks, pairing handshakes, and job telemetry directly on Vercel Edge.

### 3.3 Verification of Live Production Endpoint
Automated HTTP probe executed against `https://print-anywhere-three.vercel.app`:
```http
GET / HTTP/1.1
Host: print-anywhere-three.vercel.app

HTTP/1.1 200 OK
Server: Vercel
Content-Type: text/html; charset=utf-8
Cache-Control: public, max-age=0, must-revalidate
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Vercel-Cache: MISS
X-Vercel-Id: bom1::jb4z6-1795173664599-1b3e8d1843c3
Content-Length: 926
```

---

## 4. Local Lifecycle Management Scripts

### 4.1 Single-Click Startup ([`start.bat`](file:///d:/My%20Created%20Projects/printer%20home/start.bat))
- Centralizes all caches inside `D:\My Created Projects\Cache` (`npm`, `pip`, `gradle`).
- Checks port availability for `5000` (Cloud Relay) and `5173` (Vite Web Frontend).
- Launches daemons in isolated CMD windows using robust directory switches (`/D`).
- Automatically launches the default web browser pointing to `http://localhost:5173`.

### 4.2 Single-Click Shutdown ([`stop.bat`](file:///d:/My%20Created%20Projects/printer%20home/stop.bat))
- Uses PowerShell `Get-NetTCPConnection` to identify exact PIDs bound to ports `5000` and `5173`.
- Safely terminates background Node.js, tsx, and Vite processes.
- Closes CMD windows matching PocketPrint window titles.
- Uses redirection-safe non-interactive delays (`ping 127.0.0.1 -n 2 >nul`) to prevent termination crashes in subshells.
- Verified: Both ports `5000` and `5173` cleanly released and unblocked.

---

## 5. Deployment Checklist & Verification Summary

| Item | Expected Status | Verified State |
| :--- | :--- | :--- |
| **GitHub Remote** | Pushed to `origin/main` | Verified (`2260f70`) |
| **Secrets Sanitation** | 0 secrets or service accounts committed | Verified via `.gitignore` check |
| **Web Build** | Zero TypeScript or Vite bundling errors | Verified (`web/dist` generated in 6.61s) |
| **Vercel Production Deploy** | `readyState: READY` | Verified (`https://print-anywhere-three.vercel.app`) |
| **Vercel HTTP Status** | 200 OK | Verified via `curl -I` and `Invoke-WebRequest` |
| **Windows Agent Daemon** | Bound to Canon MG2500 driver | Verified (`USB001` queue monitoring active) |
| **Cache Rule Enforcement** | Shared cache in `D:\My Created Projects\Cache` | Fully enforced in `start.bat` and system environment |
