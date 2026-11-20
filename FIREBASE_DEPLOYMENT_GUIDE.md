# PocketPrint Bridge — Firebase Deployment & Security Rules Guide

**Project:** PocketPrint Bridge: Dual-Gateway Remote Printing Platform  
**Target Hardware:** Canon PIXMA MG2570S All-in-One Inkjet  
**Version:** v1.0.0 Production  
**Date:** November 20, 2026  
**Status:** Integrated & Documented  
**Evaluator:** Senior Firebase Architect & Security Lead  

---

## 1. Overview

While Vercel hosts the web dashboard and serverless API endpoints, **Firebase** powers the persistence layer:
- **Cloud Firestore**: Workspaces, devices, printers, and job histories.
- **Firebase Realtime Database (RTDB)**: Low-latency gateway presence heartbeats and immediate job inboxes.
- **Firebase Cloud Storage**: Secure PDF document storage capped at 50 MB with strict `%PDF-` validation.
- **Firebase Authentication**: Guest anonymous auth and permanent email/password accounts with account linking.

This guide details how Firebase rules and indexes are validated in CI and deployed safely without exposing private credentials.

---

## 2. Firebase Configuration Files

The project contains declarative Firebase definitions:

| File | Purpose | Validation Tool |
| :--- | :--- | :--- |
| [`firebase.json`](file:///d:/My%20Created%20Projects/printer%20home/firebase.json) | Declares target rule files and hosting parameters | Parsed by JSON engine in `.github/workflows/ci.yml` |
| [`firestore.rules`](file:///d:/My%20Created%20Projects/printer%20home/firestore.rules) | Role-based data access rules for Firestore collections | Evaluated for version 2 syntax and isolation rules |
| [`database.rules.json`](file:///d:/My%20Created%20Projects/printer%20home/database.rules.json) | RTDB rules for `presence/`, `gatewayInbox/`, and `gatewayAcks/` | Parsed by JSON engine in `.github/workflows/ci.yml` |
| [`storage.rules`](file:///d:/My%20Created%20Projects/printer%20home/storage.rules) | Document retention and MIME-type enforcement rules | Evaluated for version 2 syntax and size constraints |
| [`firestore.indexes.json`](file:///d:/My%20Created%20Projects/printer%20home/firestore.indexes.json) | Compound index definitions for high-speed queries | Parsed by JSON engine in `.github/workflows/ci.yml` |

---

## 3. Automated Rule Deployment via GitHub Actions

The workflow [`.github/workflows/firebase-deploy.yml`](file:///d:/My%20Created%20Projects/printer%20home/.github/workflows/firebase-deploy.yml) automatically triggers whenever changes to rules or indexes are pushed to `main`.

### Required GitHub Secrets
To enable automated cloud deployment from GitHub Actions:
1. Navigate to your GitHub repository:  
   [https://github.com/S0u1k/print-anywhere/settings/secrets/actions](https://github.com/S0u1k/print-anywhere/settings/secrets/actions)
2. Add one of the following secrets:
   - **`FIREBASE_SERVICE_ACCOUNT`**: The full content of a dedicated Google Cloud Service Account JSON key with the **Firebase Rules Admin** role.
   - **`FIREBASE_TOKEN`**: A CI deployment token obtained via `firebase login:ci`.

> [!NOTE]
> If neither secret is configured in GitHub Secrets, the CI workflow safely validates the rules locally and logs an informational notice without failing the build. This ensures that repository forks and contributors without deployment permissions can still run full CI tests.

---

## 4. Manual Deployment via Local CLI

If you prefer to deploy Firebase rules directly from your local development environment:

```powershell
# 1. Ensure you are in the project root
cd "d:\My Created Projects\printer home"

# 2. Deploy only rules and indexes (will NOT touch hosting or overwrite databases)
& "C:\Users\souvi\AppData\Roaming\npm\firebase.cmd" deploy --only firestore:rules,firestore:indexes,database,storage
```

---

## 5. Security & Billing Safeguards

1. **No Accidental Upgrades:** Deploying rules does NOT change or upgrade the project billing plan.
2. **Spark Plan Compatibility:** All defined rules operate completely within the free Firebase Spark tier.
3. **Data Protection:** Security rules prevent any client from reading or modifying another user's workspace documents, device pairing keys, or spool files.
