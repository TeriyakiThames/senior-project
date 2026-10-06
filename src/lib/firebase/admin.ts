import { initializeApp, getApps, cert, type ServiceAccount } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { getAuth, type Auth } from 'firebase-admin/auth';

function getFirebaseAdmin(): { db: Firestore; auth: Auth } {
  if (getApps().length > 0) {
    return { db: getFirestore(), auth: getAuth() };
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountKey) {
    try {
      const serviceAccount = JSON.parse(serviceAccountKey) as ServiceAccount;
      const app = initializeApp({ credential: cert(serviceAccount) });
      return { db: getFirestore(app), auth: getAuth(app) };
    } catch {
      // Ignore parse failure and try default init
    }
  }

  try {
    const app = initializeApp();
    return { db: getFirestore(app), auth: getAuth(app) };
  } catch {
    // Fallback for build / CI environments without live credentials
    const app = initializeApp(
      { projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'senior-project-dummy' },
      'fallback-app',
    );
    return { db: getFirestore(app), auth: getAuth(app) };
  }
}

export const { db, auth } = getFirebaseAdmin();
