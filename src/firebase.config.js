// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyA3YZjrDIypPChhH8sAakZLoMkEVEw-1nA",
  authDomain: "churreria-por.firebaseapp.com",
  projectId: "churreria-por",
  storageBucket: "churreria-por.firebasestorage.app",
  messagingSenderId: "1090354394964",
  appId: "1:1090354394964:web:cc50d6ee53a50b9f737ac1",
  measurementId: "G-Y8N1Z3DZEL"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;
