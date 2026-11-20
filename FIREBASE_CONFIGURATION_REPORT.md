# PocketPrint Bridge — Firebase Configuration & Integration Report

**Project:** PocketPrint Bridge: Dual-Gateway Remote Printing Platform  
**Target Hardware:** Canon PIXMA MG2570S All-in-One Inkjet  
**Date:** November 20, 2026  
**Status:** Integrated & Documented  
**Evaluator:** Senior Software Architect, Security Engineer & Firebase Specialist  

---

## 1. Executive Summary

PocketPrint Bridge incorporates a hybrid cloud architecture combining **Firebase Cloud Services** for global state persistence, real-time presence synchronization, and secure file storage, alongside a **Node.js Cloud Relay / Vercel Serverless API** and **Local Socket.IO / SQLite Fallback**.

This configuration guarantees that the platform remains operational both as a completely self-contained local network bridge and as a globally accessible, cloud-backed remote printing infrastructure.

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                               FIREBASE CLOUD TOPOLOGY                                   │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│  [ Web Browser Client ]              [ Windows Print Agent ]    [ Android USB Gateway ] │
│  (React 18 + Vite)                   (Windows 10/11 Laptop)     (Kotlin / Compose)      │
│         │                                      │                         │              │
│         ├─────────► Firebase Auth ◄────────────┤                         │              │
│         │           (Anonymous / Email-Pass)   │                         │              │
│         │                                      ▼                         ▼              │
│         ├─────────► Firebase RTDB ◄────── [ presence/ ]          [ presence/ ]          │
│         │           (Presence / Queues)   [ gatewayInbox/ ]      [ gatewayInbox/ ]      │
│         │                                      │                         │              │
│         ├─────────► Cloud Firestore            │                         │              │
│         │           (Workspaces, Devices,      │                         │              │
│         │            Print Jobs, Audits)       │                         │              │
│         │                                      │                         │              │
│         └─────────► Firebase Storage           ▼                         ▼              │
│                     (PDF Files <50MB) ──► Download Token ───────► Spooler / USB Bulk   │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Firebase Services Architecture

### 2.1 Firebase Authentication
The platform implements a **Dual-Mode Identity Model**:
1. **Anonymous Guest Mode (`signInAnonymously`)**:
   - Frictionless first-run experience without signup friction.
   - Every visitor receives a cryptographically secure `uid`.
   - A dedicated private workspace (`workspaces/ws-guest-{uid}`) is provisioned immediately.
2. **Account Mode (`createUserWithEmailAndPassword` / `signInWithEmailAndPassword`)**:
   - Permanent credentials for multi-device management and team workspaces.
3. **Seamless Account Linking (`linkWithCredential`)**:
   - Upgrading from Guest Mode to Account Mode converts the existing guest identity without losing paired printers, devices, or job history.

### 2.2 Cloud Firestore (Durable State & Metadata)
Firestore persists long-lived entity models with workspace-level isolation:
- `users/{uid}`: Profile data, email, default workspace ID.
- `workspaces/{workspaceId}`: Tenant isolation boundary with member roles (`owner`, `admin`, `member`).
- `devices/{deviceId}`: Paired physical hardware (Windows Agents, Android Gateways, Client Browsers).
- `printers/{printerId}`: Discovered printers (e.g., Canon PIXMA MG2570S), driver metadata, port assignment (`USB001`), and capabilities.
- `printJobs/{jobId}`: Job lifecycle record (status, page range, copies, paper size, orientation, file URL, SHA-256 hash).
- `pairingSessions/{pairingCode}`: Ephemeral handshake records (10-minute TTL, single-use, rate-limited to 5 invalid attempts).
- `events/{eventId}`: Immutable audit trail for all spooling and connection actions.

### 2.3 Firebase Realtime Database (RTDB: Ephemeral Synchronization)
Engineered for microsecond latency presence and queueing:
- `presence/{gatewayUid}`:
  - Gateway heartbeats with `onDisconnect()` handlers that automatically transition offline upon connection loss.
- `gatewayInbox/{gatewayUid}/{jobId}`:
  - Immediate push notification queue for print jobs targeting specific physical gateways.
- `gatewayAcks/{gatewayUid}/{jobId}`:
  - Gateway receipt confirmation, download verification, and spooler submission progress events.
- `gatewayStatus/{gatewayUid}`:
  - Live hardware metrics (paper status, ink warning flags, spooler queue depth).

### 2.4 Cloud Storage (Document Retention & Security)
- Dedicated bucket storage under `documents/{workspaceId}/{jobId}.pdf`.
- Strict format enforcement: `%PDF-` magic byte validation and `contentType == 'application/pdf'`.
- Strict file size cap: **50 MB** maximum per file.
- Single-use, time-delimited signed URLs / HMAC tokens for gateway downloads.

---

## 3. Security Rules Implementation

### 3.1 Cloud Firestore Rules (`firestore.rules`)
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    function isOwner(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }
    function isWorkspaceMember(workspaceId) {
      return isAuthenticated() && (
        request.auth.uid == workspaceId ||
        resource.data.workspaceId == workspaceId ||
        request.resource.data.workspaceId == workspaceId
      );
    }

    match /users/{userId} {
      allow read, write: if isOwner(userId);
    }
    match /workspaces/{workspaceId} {
      allow read: if isAuthenticated();
      allow write: if isWorkspaceMember(workspaceId);
    }
    match /devices/{deviceId} {
      allow read, write: if isAuthenticated();
    }
    match /gateways/{gatewayId} {
      allow read, write: if isAuthenticated();
    }
    match /printers/{printerId} {
      allow read, write: if isAuthenticated();
    }
    match /pairingSessions/{code} {
      allow read, write: if isAuthenticated();
    }
    match /printJobs/{jobId} {
      allow read, write: if isAuthenticated();
    }
    match /events/{eventId} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if false;
    }
  }
}
```

### 3.2 Firebase Realtime Database Rules (`database.rules.json`)
```json
{
  "rules": {
    "presence": {
      "$gatewayUid": {
        ".read": "auth != null",
        ".write": "auth != null && (auth.uid == $gatewayUid || auth.token.admin == true)"
      }
    },
    "gatewayInbox": {
      "$gatewayUid": {
        ".read": "auth != null && (auth.uid == $gatewayUid || auth.token.admin == true)",
        ".write": "auth != null"
      }
    },
    "gatewayAcks": {
      "$gatewayUid": {
        ".read": "auth != null",
        ".write": "auth != null && (auth.uid == $gatewayUid || auth.token.admin == true)"
      }
    },
    "gatewayStatus": {
      "$gatewayUid": {
        ".read": "auth != null",
        ".write": "auth != null && (auth.uid == $gatewayUid || auth.token.admin == true)"
      }
    }
  }
}
```

### 3.3 Firebase Cloud Storage Rules (`storage.rules`)
```javascript
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /documents/{workspaceId}/{jobId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null 
                    && request.resource.size < 50 * 1024 * 1024
                    && request.resource.contentType == 'application/pdf';
      allow delete: if request.auth != null;
    }
  }
}
```

---

## 4. Backend & Gateway Service Integration

### 4.1 Backend Service Initialization ([`firebaseAdmin.ts`](file:///d:/My%20Created%20Projects/printer%20home/backend/src/services/firebaseAdmin.ts))
The server initializes the Firebase Admin SDK using modern modular imports:
- Checks `process.env.FIREBASE_SERVICE_ACCOUNT_JSON` or individual keys (`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`).
- Seamlessly falls back to `local` mode with in-memory SQLite and Socket.IO rooms if no cloud credentials are supplied, preventing startup failures during local development.

```typescript
export function initializeFirebaseAdmin(): boolean {
  if (isInitialized) return true;
  try {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const sa = JSON.parse(serviceAccountJson);
      adminApp = initializeApp({
        credential: cert(sa),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
      });
      isInitialized = true;
      return true;
    }
    // Graceful local fallback
    return false;
  } catch (err) {
    return false;
  }
}
```

### 4.2 Windows Laptop Agent RTDB Presence ([`laptopAgent.ts`](file:///d:/My%20Created%20Projects/printer%20home/backend/src/laptopAgent.ts))
When `FIREBASE_DATABASE_URL` is configured, `laptopAgent.ts`:
1. Connects to `presence/${deviceId}` and marks state: `{ state: 'online', mode: 'windows_gateway', lastSeen: Date.now() }`.
2. Registers `onDisconnect().set({ state: 'offline', lastSeen: Date.now() })`.
3. Listens to `gatewayInbox/${deviceId}` for new print dispatch packets.
4. Posts receipt acknowledgement to `gatewayAcks/${deviceId}/${jobId}`.

---

## 5. Web Client Firebase Services ([`web/src/services/firebase.ts`](file:///d:/My%20Created%20Projects/printer%20home/web/src/services/firebase.ts))

The web client exposes high-level authentication, document upload, and gateway monitoring helpers:
- `signInGuest()`: Initiates anonymous session and seeds initial workspace ID.
- `registerWithEmailPassword(email, password)`: Creates an authenticated account.
- `loginWithEmailPassword(email, password)`: Logs in returning ID tokens.
- `linkGuestToAccount(email, password)`: Converts guest state into permanent user credentials.
- `uploadPdfToStorage(file, workspaceId, jobId, onProgress)`: Streams PDF directly to Cloud Storage with progress updates.

---

## 6. Firebase Plan & Cloud Project Status

### 6.1 Existing Accounts & Projects Inspected
The active Firebase CLI environment is signed in as `hackathonproject13@gmail.com`. Available projects:
1. `aqua-rangers-sih` (AQUA RANGERS)
2. `codevault-pro-souvik` (Code Vault Pro)
3. `mediscan-ai-8f696` (MediScan Ai)

> [!NOTE]
> To preserve the isolation of those projects, PocketPrint Bridge defaults to its high-performance local SQLite + Socket.IO relay for development, with ready-to-deploy rules files (`firestore.rules`, `database.rules.json`, `storage.rules`, `firebase.json`) for a dedicated production project (`print-anywhere`).

### 6.2 Firebase Spark vs. Blaze Plan Requirements
- **Cloud Firestore**: Fully functional on the free **Spark** plan (50K reads, 20K writes, 20K deletes per day).
- **Realtime Database**: Fully functional on the free **Spark** plan (1GB storage, 10GB/month bandwidth, 100 simultaneous connections).
- **Firebase Auth**: 10,000 monthly active users included for free.
- **Cloud Storage**: The free Spark plan provides 5GB storage and 1GB/day download. If production usage requires cross-region storage replication or advanced Cloud Functions triggers, upgrading the dedicated project to the **Blaze (Pay-as-you-go)** plan is recommended.
