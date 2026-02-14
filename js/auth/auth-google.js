// auth/auth-google.js — Google sign-in button wiring
import { auth } from "../lib/firebase.js";
import {
    GoogleAuthProvider,
    signInWithPopup,
    signOut
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Buttons MAY or MAY NOT exist depending on page
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");

const provider = new GoogleAuthProvider();

// Login with Google
if (loginBtn) {
    loginBtn.onclick = async () => {
        const loader = document.getElementById("globalLoader");
        if (loader) loader.classList.remove("hidden");

        try {
            await signInWithPopup(auth, provider);
        } catch (err) {
            console.error(err);
            alert("Login failed");
            if (loader) loader.classList.add("hidden");
        }
    };
}

// Logout
if (logoutBtn) {
    logoutBtn.onclick = async () => {
        try {
            await signOut(auth);
            window.location.href = "index.html";
        } catch (err) {
            console.error("Logout failed:", err);
            alert("Logout failed");
        }
    };
}

