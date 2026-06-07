import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import env from './env.js';

// Render stores env vars as literal strings, so \n stays as \n instead of a real newline.
// This normalizes the private key regardless of how it was stored.
function normalizePrivateKey(key) {
  if (!key) return key;
  // Replace literal \n with real newlines, and strip surrounding quotes if present
  return key
    .replace(/^"/, '')
    .replace(/"$/, '')
    .replace(/\\n/g, '\n');
}

function getCredentialConfig() {
  const jsonPath = path.resolve(process.cwd(), 'mit-adt-student-hub-firebase-adminsdk-fbsvc-c4d8ee22bb.json');
  if (fs.existsSync(jsonPath)) {
    const raw = fs.readFileSync(jsonPath, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      projectId: parsed.project_id,
      clientEmail: parsed.client_email,
      privateKey: parsed.private_key,
    };
  }

  return {
    projectId: env.firebaseProjectId,
    clientEmail: env.firebaseClientEmail,
    privateKey: normalizePrivateKey(env.firebasePrivateKey),
  };
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(getCredentialConfig()),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export default admin;
