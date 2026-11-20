# PocketPrint Bridge — CI/CD Pipeline Architecture

**Project:** PocketPrint Bridge: Dual-Gateway Remote Printing Platform  
**Target Hardware:** Canon PIXMA MG2570S All-in-One Inkjet  
**Version:** v1.0.0 Production Pipeline  
**Date:** November 20, 2026  
**Status:** Configured & Verified  
**Lead DevOps Architect:** Senior DevOps, Release Automation & Cloud Infrastructure Engineer  

---

## 1. High-Level Architectural Topology

PocketPrint Bridge implements a modern, single-source-of-truth Continuous Integration and Continuous Deployment (CI/CD) lifecycle. The architecture couples **GitHub Actions** for rigorous automated quality control with **Vercel Native Git Integration** for automated, zero-downtime global edge deployments.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              CI/CD END-TO-END PIPELINE                                 │
└────────────────────────────────────────────────────────────────────────────────────────┘

 [ Local Development ]
   Antigravity Local Workspace (Windows 11)
   d:\My Created Projects\printer home
             │
             │  git commit & git push origin <branch>
             ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────┐
 │ GITHUB REPOSITORY: https://github.com/S0u1k/print-anywhere                            │
 ├────────────────────────────────────────┬──────────────────────────────────────────────┤
 │  Branch: main                          │  Branches: feature/*, pr/*, test/*           │
 └───────────────────┬────────────────────┴──────────────────────┬───────────────────────┘
                     │                                           │
         Webhook Trigger (Push / PR)                 Webhook Trigger (Push)
                     │                                           │
                     ▼                                           ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────┐
 │ GITHUB ACTIONS CI RUNNER (.github/workflows/ci.yml)                                   │
 ├─────────────────────────┬─────────────────────────┬───────────────────────────────────┤
 │ 1. Frontend CI          │ 2. Backend CI           │ 3. Android Gateway CI             │
 │  • Node 20.x            │  • Node 20.x            │  • JDK 17 (Temurin)               │
 │  • npm install          │  • npm install          │  • Gradle 8.7 Setup               │
 │  • tsc --noEmit         │  • tsc --noEmit         │  • Task validation                │
 │  • Vitest Suite (2/2)   │  • Jest Suite (8/8)     │  • Driver syntax verify           │
 │  • Vite Bundle Build    │  • 15-Point E2E Security│                                   │
 ├─────────────────────────┴─────────────────────────┴───────────────────────────────────┤
 │ 4. Firebase Configuration Validation (JSON schemas, Firestore & Storage rules)        │
 ├───────────────────────────────────────────────────────────────────────────────────────┤
 │ 5. CI QUALITY GATE (ci-success-gate: Aggregates all 4 checks)                         │
 └───────────────────────────────────┬───────────────────────────────────────────────────┘
                                     │
                     Status Check: PASS / FAIL
                                     │
                                     ▼
 ┌───────────────────────────────────────────────────────────────────────────────────────┐
 │ VERCEL NATIVE GIT ENGINE (Project: souvik-s-projects4/print-anywhere)                 │
 ├───────────────────────────────────────────────────────────────────────────────────────┤
 │                                                                                       │
 │  • Pulls Git Commit via GitHub App Integration                                        │
 │  • Monorepo Root Directory: '.'                                                       │
 │  • Install Command: 'npm --prefix web install'                                        │
 │  • Build Command: 'npm --prefix web run build'                                        │
 │  • Output Directory: 'web/dist'                                                       │
 │  • Serverless Function API: 'api/index.ts' -> 'backend/src/app.ts'                    │
 │                                                                                       │
 ├────────────────────────────────────────┬──────────────────────────────────────────────┤
 │ IF TARGET IS 'main'                    │ IF TARGET IS PREVIEW / FEATURE / PR          │
 ├────────────────────────────────────────┼──────────────────────────────────────────────┤
 │ • Deploys to Production                │ • Deploys to Isolated Preview                │
 │ • Promotes live aliases:               │ • Generates branch preview URL:              │
 │   https://print-anywhere-three.vercel  │   https://print-anywhere-<hash>.vercel.app   │
 │   .app                                 │ • Leaves live production site untouched      │
 │ • Edge Cache Invalidation & Revalidate │ • Comments Preview link on GitHub PR          │
 └────────────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 2. Core Operational Principles

### 2.1 Single Deployment Engine (Zero Duplication)
To avoid race conditions, duplicate compute bills, and conflicting build statuses:
- **GitHub Actions strictly owns Testing and Quality Assurance.** It never calls `vercel deploy --prod` directly.
- **Vercel Native Git Integration strictly owns Build and Edge Deployment.** It listens to GitHub Webhooks triggered by repository pushes and pull requests.
- No third deployment pipeline or redundant runner exists.

### 2.2 Quality Gate (Preventing Broken Code from Reaching Production)
Vercel's deployment lifecycle can be gated against external GitHub Actions status checks.
1. When a push arrives on `main`, GitHub Actions starts the pipeline defined in `.github/workflows/ci.yml`.
2. The final consolidation job `ci-success-gate` depends on `[frontend-ci, backend-ci, android-ci, firebase-validation]`.
3. If any sub-test fails (e.g., TypeScript error, broken pairing test, invalid PDF parser, corrupted Firestore rule), `ci-success-gate` terminates with exit code 1.
4. When configured with **Vercel Deployment Checks**, Vercel pauses production promotion until `ci-success-gate` reports `success`.

---

## 3. GitHub Actions CI Matrix (`.github/workflows/ci.yml`)

| Job Name | Scope & Test Vectors | Success Condition |
| :--- | :--- | :--- |
| **`frontend-ci`** | React 18, Vite 5, Tailwind CSS, TypeScript 5.4. Runs `tsc --noEmit`, Vitest status badge tests, and generates `web/dist`. | Zero TS errors, 2/2 Vitest passed, `web/dist/index.html` verified. |
| **`backend-ci`** | Express 5, Socket.IO 4, SQLite/JSON Store, HMAC Tokenizer. Runs `tsc --noEmit`, Jest suite (8/8 tests), and executes the 15-point bidirectional pairing E2E suite (`test_bidirectional_pairing_e2e.cjs`) against a live background relay. | Zero TS errors, 8/8 Jest tests passed, 15/15 E2E security tests passed. |
| **`android-ci`** | Kotlin 1.9, Jetpack Compose, AGP 8.4. Sets up Temurin JDK 17, Gradle 8.7, and validates driver build definitions (`CanonPixmaBackend.kt`, `UsbPrinterManager.kt`). | Gradle scripts parse cleanly, zero missing dependencies. |
| **`firebase-validation`** | Syntax and structure validation for `firebase.json`, `database.rules.json`, `firestore.indexes.json`, `firestore.rules`, and `storage.rules`. | All JSON files parse, rules contain valid version 2 headers. |
| **`ci-success-gate`** | Aggregation gate requiring all 4 jobs. | Emits certified production clearance token. |

---

## 4. Vercel Configuration & Native Git Link

### 4.1 Project Link Identifiers
- **Vercel Project Name:** `print-anywhere`
- **Vercel Project ID:** `prj_G4LW6uTxh4bqKupfcuNGCRR6qaXn`
- **Connected GitHub Repository:** `S0u1k/print-anywhere` (`repoId: 1465263223`)
- **Git Credential ID:** `cred_f105fc1d69cf9415a8ffa5861f5ad92dfe015c25`
- **Configured Production Branch:** `main`
- **Active Git Options:**
  - `gitProviderOptions.createDeployments: "enabled"`
  - `gitProviderOptions.disableRepositoryDispatchEvents: false`
  - `gitComments.onCommit: true`
  - `gitComments.onPullRequest: true`

### 4.2 Monorepo Configuration Strategy
Because PocketPrint Bridge houses the frontend in `web/` and backend API logic in `backend/`, the root directory is kept as `.` with:
1. Root [`package.json`](file:///d:/My%20Created%20Projects/printer%20home/package.json):
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
2. [`vercel.json`](file:///d:/My%20Created%20Projects/printer%20home/vercel.json):
   ```json
   {
     "version": 2,
     "framework": "vite",
     "installCommand": "npm --prefix web install",
     "buildCommand": "npm --prefix web run build",
     "outputDirectory": "web/dist",
     "rewrites": [
       { "source": "/api/(.*)", "destination": "/api/index" },
       { "source": "/(.*)", "destination": "/index.html" }
     ]
   }
   ```
3. Serverless API bridge at [`api/index.ts`](file:///d:/My%20Created%20Projects/printer%20home/api/index.ts).

---

## 5. Branch Strategy & Staging Environments

### 5.1 Production Deployments (`main` branch)
- Trigger: Push directly to `main` or merge of an approved Pull Request into `main`.
- Target: Production Environment.
- Canonical Live URL: **`https://print-anywhere-three.vercel.app`**
- Auto-Aliased URL: `https://print-anywhere-souvik-s-projects4.vercel.app`

### 5.2 Preview Deployments (`feature/*`, `bugfix/*`, `pr/*` branches)
- Trigger: Push to any branch other than `main`.
- Target: Isolated Preview Environment.
- Preview URL Scheme: `https://print-anywhere-<unique-hash>-souvik-s-projects4.vercel.app`
- PR Integration: Vercel GitHub Bot automatically posts the Preview URL and build summary as a comment on the GitHub Pull Request.

---

## 6. Failure Handling & Instant Rollback

If a build fails or an uncaught issue is discovered after deployment:
1. **Build Failure Prevention:** Vercel retains the current live production deployment intact if a new commit fails the build step.
2. **Instant Rollback:**
   - In Vercel CLI: `vercel rollback`
   - In Vercel Web Dashboard: Navigate to **Deployments** -> select last known good deployment -> click **Promote to Production**.
3. **Git History Integrity:** Never force-push or reset remote history. Push a revert or corrective commit to `main`, letting Vercel rebuild and redeploy automatically.
