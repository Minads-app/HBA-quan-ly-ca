import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: "AIzaSyBW4umrc7qR2CDqlpBYQ-7iXPh9j7WZ85A",
  authDomain: "qlns-q3.firebaseapp.com",
  projectId: "qlns-q3",
  storageBucket: "qlns-q3.firebasestorage.app",
  messagingSenderId: "705513130335",
  appId: "1:705513130335:web:fbae8c6b0464b348994eea"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const functions = getFunctions(app, 'us-central1');

const secondaryApp = getApps().find((a: FirebaseApp) => a.name === 'SecondaryApp') || initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

export { auth, db, functions, secondaryAuth };
