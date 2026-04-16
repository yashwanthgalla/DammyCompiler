# Online Compiler

Online code compiler built with React, Monaco Editor, and OnlineCompiler.io API.

## Features

- Real-time authentication using Firebase Auth (`onAuthStateChanged` listener)
- Email/password sign-up and sign-in
- Auth-gated code execution
- Multi-file editor with Monaco
- Default starter syntax templates for every supported language
- Save/load complete workspace snapshots to Firestore using custom names
- Upload coding problems with course + set organization and language-specific starter templates
- Minimalist black responsive UI

## Environment Variables

Create or update `.env` in the project root:

```env
ONLINECOMPILER_API_KEY=your_onlinecompiler_api_key
ONLINECOMPILER_BASE_URL=https://api.onlinecompiler.io
ONLINECOMPILER_EXECUTE_PATH=/api/run-code-sync/
ONLINECOMPILER_API_KEY_HEADER=Authorization
ONLINECOMPILER_TIMEOUT_MS=15000
VITE_COMPILER_API_BASE_URL=
VITE_ADMIN_EMAIL=admin@example.com

VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_auth_domain
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_storage_bucket
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## Fix: Verification Email Not Received

If users are signing up but not getting verification emails, check these in Firebase Console:

1. Authentication > Sign-in method > Email/Password must be enabled.
2. Authentication > Settings > Authorized domains must include your app host (for local: `localhost`).
3. Authentication > Templates > Email address verification should be enabled and not paused.
4. Authentication > Usage: check for quota/rate limit issues.
5. Ask users to check Spam/Promotions tab.

In this app, a verification email is sent on signup, can be resent from the verify screen, and status refreshes automatically every few seconds.

Enable Firestore in your Firebase project and create basic rules for authenticated users to read/write their own workspace documents.

This project now stores full workspace file maps in the `workspaces` collection with an `ownerId` field, and users can list/retrieve all their saved workspaces from the UI.

Problem uploads are stored in the `problemUploads` collection with owner-only access, course/set metadata, and multi-language templates.

Problem uploads are admin-only. Preferred: set Firebase Auth custom claim `admin: true`.

Rules now also support a Firestore fallback allowlist via `adminUsers/{uid}` documents (for server-side permission checks).

Recommended setup:
1. Keep `VITE_ADMIN_EMAIL` for UI routing.
2. Add the same user UID in `adminUsers/{uid}` (from Firebase Console or Admin SDK) so Firestore writes are authorized.

## Firestore Rules

Rules are defined in [firestore.rules](firestore.rules) and enforce owner-only access.

Deploy rules:

```bash
npm install -g firebase-tools
firebase login
firebase use <your-firebase-project-id>
firebase deploy --only firestore:rules
```

If you prefer console setup, copy the contents of [firestore.rules](firestore.rules) into Firebase Console > Firestore Database > Rules.

Compiler execution now uses OnlineCompiler.io only.

## Run Locally

```bash
npm install
npm run server
npm run dev
```

Or run frontend and backend together:

```bash
npm run dev:all
```

### Compiler Connection Notes

- In local development, keep `VITE_COMPILER_API_BASE_URL` empty and Vite will proxy `/api/*` requests to `http://localhost:3001`.
- If your backend is hosted elsewhere, set `VITE_COMPILER_API_BASE_URL` to that origin (example: `https://your-backend.example.com`).
- Use `GET /api/health` to verify backend status before testing compile.

## Build

```bash
npm run build
```
