// functions/src/handlers/firebaseAdapter.ts
import * as admin from "firebase-admin";

const FIREBASE_WEB_API_KEY = process.env.WEB_API_KEY || "";

// Initialize Firebase Admin once per process
if (!admin.apps.length) {
  admin.initializeApp(); // uses default creds in Cloud Run/GCF / local env
}

if (!FIREBASE_WEB_API_KEY) {
  console.warn(
    "[cfg] FIREBASE_WEB_API_KEY is not set; Firebase token exchange will fail"
  );
}

export async function getFirebaseIdTokenForUid(uid: string): Promise<string> {
  if (!FIREBASE_WEB_API_KEY) {
    throw new Error("WEB_API_KEY not configured – cannot mint Firebase ID token");
  }

  // 1) Mint a Firebase Custom Token
  const customToken = await admin.auth().createCustomToken(uid);

  // 2) Exchange for a Firebase ID token via Identity Toolkit
  const resp = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    } as any
  );

  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error(`customTokenExchange_http_${resp.status}:${txt}`);
  }

  const json: any = await resp.json();
  const idToken: string | undefined = json?.idToken;
  if (!idToken) throw new Error("customTokenExchange_missing_idToken");
  return idToken;
}
