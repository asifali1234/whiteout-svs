// auth/auth-id.js — Player ID + Password login

import {auth} from "../lib/firebase.js";
import {signInWithEmailAndPassword,createUserWithEmailAndPassword} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { validatePlayerIdClaim } from "../data/idGuard.js";

/* ================= ELEMENTS ================= */

const idForm = document.getElementById("idLoginForm");
const playerIdInput = document.getElementById("idEmail");
const passwordInput = document.getElementById("idPassword");
const loader = document.getElementById("globalLoader");

/* ================= HELPER ================= */

function buildSyntheticEmail(playerId) {
    return `${playerId}@whiteout.local`;
}

/* ================= FORM SUBMIT ================= */

if (idForm) {
    idForm.onsubmit = async (e) => {
        e.preventDefault();

        const rawId = playerIdInput.value.trim();
        const password = passwordInput.value.trim();

        // 🔒 Validate numeric only
        if (!/^\d+$/.test(rawId)) {
            alert("Player ID must be numeric only.");
            return;
        }

        if (!password) {
            alert("Enter password.");
            return;
        }

        const email = buildSyntheticEmail(rawId);

        if (loader) loader.classList.remove("hidden");

        console.log("Attempting login with email:", email);
        try {
            // Try login first
            await signInWithEmailAndPassword(auth, email, password);
        } catch (err) {
            console.error(err);

            if (err.code === "auth/user-not-found") {
                alert("Account not found. Please sign up.");
            } else if (
                err.code === "auth/wrong-password" ||
                err.code === "auth/invalid-credential"
            ) {
                alert("Incorrect password.");
            } else {
                console.error(err);
                alert("Login failed.");
            }
            if (loader) loader.classList.add("hidden");
        }

    };
}

const signupForm = document.getElementById("idSignupForm");
const signupPlayerId = document.getElementById("signupPlayerId");
const signupPassword = document.getElementById("signupPassword");
const signupConfirm = document.getElementById("signupConfirm");

if (signupForm) {
    signupForm.onsubmit = async (e) => {
        e.preventDefault();

        const rawId = signupPlayerId.value.trim();
        const password = signupPassword.value.trim();
        const confirm = signupConfirm.value.trim();

        if (!/^\d+$/.test(rawId)) {
            alert("Player ID must be numeric only.");
            return;
        }

        if (password.length < 6) {
            alert("Password must be at least 6 characters.");
            return;
        }

        if (password !== confirm) {
            alert("Passwords do not match.");
            return;
        }

        const email = buildSyntheticEmail(rawId);

        if (loader) loader.classList.remove("hidden");

        try {

            const validation = await validatePlayerIdClaim(rawId, "id-signup");

            if (!validation.allowed) {

                if (validation.reason === "already-claimed") {
                    alert("This Player ID is already registered.");
                } else if (validation.reason === "reserved-placeholder") {
                    alert("This Player ID is reserved.");
                } else {
                    alert("Invalid Player ID.");
                }

                if (loader) loader.classList.add("hidden");
                return;
            }

            await createUserWithEmailAndPassword(auth, email, password);
            console.log("Account created:", email);

        } catch (err) {
            console.error(err);

            if (err.code === "auth/email-already-in-use") {
                alert("Account already exists. Please login.");
            } else {
                console.error(err);
                alert("Signup failed.");
            }
        }

    };
}

