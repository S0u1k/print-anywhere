# PocketPrint Bridge — Production Deployment Guide

**Project:** PocketPrint Bridge: Dual-Gateway Remote Printing Platform  
**Target Hardware:** Canon PIXMA MG2570S All-in-One Inkjet  
**Version:** v1.0.0 Production  
**Date:** November 20, 2026  
**Status:** Live & Documented  
**Evaluator:** Senior DevOps & Cloud Infrastructure Engineer  

---

## 1. Quick Reference & Core URLs

| Asset / Endpoint | URL / Identifier |
| :--- | :--- |
| **GitHub Repository** | [https://github.com/S0u1k/print-anywhere](https://github.com/S0u1k/print-anywhere) |
| **Production Live Website** | [https://print-anywhere-three.vercel.app](https://print-anywhere-three.vercel.app) |
| **Vercel Project Dashboard** | [https://vercel.com/souvik-s-projects4/print-anywhere](https://vercel.com/souvik-s-projects4/print-anywhere) |
| **Production Branch** | `main` |
| **Monorepo Root Directory** | `.` |
| **Output Directory** | `web/dist` |

---

## 2. How the Fully Automated Pipeline Works

Once code is pushed to GitHub, **zero manual commands** are needed to deploy:

```
[Developer updates code in Antigravity]
              │
              ▼
    git add . && git commit -m "feat: new feature"
              │
              ▼
         git push origin main
              │
              ├─────────────────────────────────────────────┐
              ▼                                             ▼
 [ GitHub Actions CI (.github/workflows/ci.yml) ]   [ Vercel Native Git Engine ]
  1. Frontend: Type Check, Vitest, Vite Build        1. Detects push to main
  2. Backend: Jest & 15-Point E2E Security Tests     2. Clones latest commit
  3. Android: Driver & Gradle Validation             3. Runs 'npm --prefix web install'
  4. Firebase: JSON & Rule Syntax Check              4. Runs 'npm --prefix web run build'
  5. Emits 'ci-success-gate' PASS Status             5. Deploys to Production
              │                                      6. Updates live domain:
              └──────────────► GATES ───────────────►   https://print-anywhere-three.vercel.app
```

---

## 3. Environment Variables Specification

To configure environment variables in Vercel:
1. Navigate to **Project Settings** -> **Environment Variables** in the Vercel Dashboard.
2. Enter the required keys per the matrix below:

### 3.1 Client-Side Variables (`web/` — Prefixed with `VITE_`)
*Exposed to browser client for Firebase and backend connectivity:*

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `VITE_FIREBASE_API_KEY` | Production & Preview | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Production & Preview | `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | Production & Preview | Firebase Project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | Production & Preview | `<project-id>.appspot.com` |
| `VITE_FIREBASE_DATABASE_URL` | Production & Preview | `https://<project-id>-default-rtdb.firebaseio.com` |
| `VITE_FIREBASE_APP_ID` | Production & Preview | Firebase Web Application ID |
| `VITE_API_BASE_URL` | Production & Preview | Serverless API base URL (`/api` or custom domain) |

### 3.2 Server-Side Variables (`backend/` & `api/`)
*Strictly protected server-side; NEVER exposed to the frontend:*

| Variable Name | Environment | Description |
| :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | Production & Preview | Project ID for Firebase Admin SDK |
| `FIREBASE_CLIENT_EMAIL` | Production & Preview | Service Account Client Email |
| `FIREBASE_PRIVATE_KEY` | Production & Preview | Private Key from Service Account JSON |
| `FIREBASE_DATABASE_URL` | Production & Preview | Realtime Database URL for presence queues |
| `FIREBASE_STORAGE_BUCKET` | Production & Preview | Dedicated Cloud Storage Bucket |
| `JWT_SECRET` | Production & Preview | Secret key for signing guest and device JWTs |
| `HMAC_DOWNLOAD_SECRET` | Production & Preview | Secret for signing single-use PDF download tokens |

> [!CAUTION]
> Never commit `.env` or service account JSON files to the repository. The `.gitignore` is pre-configured to strictly ignore `.env*`, `*.pem`, `*.key`, and `*service*.json`.

---

## 4. Configuring Vercel Deployment Checks (Quality Gate)

To prevent broken builds from ever reaching Production:

1. Open your Vercel project at:  
   `https://vercel.com/souvik-s-projects4/print-anywhere/settings/deployment-protection`
2. Scroll to the **Deployment Checks** section.
3. Toggle **Deployment Checks** to **Enabled**.
4. In **Required Checks**, add:
   - `Frontend Quality & Build`
   - `Backend API & Security E2E Tests`
   - `CI Quality Gate (Required for Vercel Promotion)`
5. Click **Save**.

Now, whenever a push to `main` occurs:
- Vercel prepares the deployment in a staged state.
- Vercel queries GitHub Actions for the `ci-success-gate` status.
- Only when all tests pass is the deployment promoted to the live Production alias `https://print-anywhere-three.vercel.app`.

---

## 5. Branch Workflow & Preview Deployments

### 5.1 Working with Feature Branches
```bash
# 1. Create and switch to a new feature branch
git checkout -b feature/new-printer-model

# 2. Make your code changes and commit
git commit -am "feat: add support for additional Canon models"

# 3. Push to GitHub
git push origin feature/new-printer-model
```

### 5.2 What Happens on Feature Push:
1. GitHub Actions runs all CI test suites on `feature/new-printer-model`.
2. Vercel automatically builds and deploys an isolated **Preview Deployment**.
3. A preview URL is created:  
   `https://print-anywhere-<hash>-souvik-s-projects4.vercel.app`
4. The live production site remains 100% untouched.

### 5.3 Merging to Production:
1. Open a Pull Request targeting `main`.
2. Inspect the Vercel Bot comment on the PR to review the live preview site.
3. Ensure all GitHub Actions checks are green (PASS).
4. Merge the Pull Request.
5. Vercel automatically builds `main` and promotes it to the production URL.

---

## 6. Rollback Procedures

If an unexpected runtime regression occurs in Production:

### Option A: Instant Vercel CLI Rollback
```powershell
& "C:\Users\souvi\AppData\Roaming\npm\vercel.cmd" rollback
```

### Option B: Vercel Web Dashboard Rollback
1. Open [https://vercel.com/souvik-s-projects4/print-anywhere/deployments](https://vercel.com/souvik-s-projects4/print-anywhere/deployments).
2. Locate the previous working deployment in the list.
3. Click the **three dots (...)** menu on that deployment.
4. Click **Promote to Production**.
5. The live domain instantly switches back to the chosen stable build within 2 seconds.

### Option C: Clean Git Revert
```powershell
& "D:\My Created Projects\Cache\tools\git\cmd\git.exe" revert HEAD
& "D:\My Created Projects\Cache\tools\git\cmd\git.exe" push origin main
```
Vercel will detect the revert commit and automatically build and deploy the safe state.
