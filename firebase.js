import admin from "firebase-admin";
import config from "./config.js";

const serviceAccount = JSON.parse(config.FIREBASE_KEY);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
export { db };
