// lib/firebase.js — Firebase initialization and shared instances

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/*
  🔴 IMPORTANT
  Replace these values with EXACT values
  from Firebase Console → Project Settings → Web App
*/
const firebaseConfig = {
    apiKey: "AIzaSyC4zVp07JU28Q1a9mSDz_LCw5B8ziJ8_CY",
    authDomain: "whiteout-svs-reservation.firebaseapp.com",
    projectId: "whiteout-svs-reservation",
    storageBucket: "whiteout-svs-reservation.firebasestorage.app",
    messagingSenderId: "408990700097",
    appId: "1:408990700097:web:4d979ac1f5f30226c7ecc0",
    measurementId: "G-W3QVDBD9GK"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export shared instances
export const auth = getAuth(app);
window.auth = auth;
export const db = getFirestore(app);


window.signInWithCustomToken = signInWithCustomToken;

