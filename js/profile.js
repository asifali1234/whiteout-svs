// js/profile.js

import { auth, db } from "./firebase.js";
import {
    doc,
    getDoc,
    updateDoc,
    getDocs,
    collection,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ---------- ELEMENTS ---------- */
const profileForm = document.getElementById("profileForm");
const profileView = document.getElementById("profileView");
const statusText = document.getElementById("profileStatus");

const playerIdInput = document.getElementById("playerIdInput");
const ingameNameInput = document.getElementById("ingameNameInput");
const allianceSelect = document.getElementById("allianceSelect");
const saveProfileBtn = document.getElementById("saveProfileBtn");

const playerIdPending = document.getElementById("playerIdInputPending");
const ingameNamePending = document.getElementById("ingameNameInputPending");
const alliancePending = document.getElementById("allianceSelectPending");

const spinner = document.getElementById("profileSpinner")

/* ---------- TOAST ---------- */
function showToast(message, type = "info") {
    const c = document.getElementById("toastContainer");
    if (!c) return;

    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerText = message;
    c.appendChild(t);

    setTimeout(() => t.remove(), 3000);
}

/* ---------- LOAD ALLIANCES ---------- */
async function loadAlliances(selectEl) {
    selectEl.innerHTML = "";

    const snap = await getDocs(
        query(collection(db, "alliances"), where("status", "==", "active"))
    );

    snap.forEach(d => {
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = `${d.data().shortName} – ${d.data().name}`;
        selectEl.appendChild(opt);
    });
}

/* ---------- LOAD PROFILE ---------- */
async function loadProfile() {
    // Hide both sections first
    profileView.style.display = "none";
    profileForm.style.display = "none";

    // Show loading text / spinner
    statusText.innerText = "Loading profile…";

    const user = auth.currentUser;
    if (!user) {
        statusText.innerText = "Not logged in";
        return;
    }

    let snap;
    try {
        snap = await getDoc(doc(db, "users", user.email));
    } catch (e) {
        console.error("Failed to read user doc", e);
        statusText.innerText = "Failed to load profile";
        return;
    }

    if (!snap.exists()) {
        console.error("User doc missing");
        statusText.innerText = "Profile not found. Contact admin.";
        return;
    }

    const data = snap.data();
    console.log("PROFILE DATA:", data);

    /* ---------- APPROVED USER ---------- */
    if (data.status === "approved") {
        // Load alliances FIRST (offscreen)
        await loadAlliances(allianceSelect);

        // Populate values
        playerIdInput.value = data.playerId || "";
        ingameNameInput.value = data.ingameName || "";
        allianceSelect.value = data.alliance || "";

        // Status text last
        statusText.innerText =
            "✅ Profile approved. Contact admin for ID changes.";

        // 🔥 SHOW ONLY AFTER EVERYTHING IS READY
        profileView.style.display = "block";
        return;
    }

    /* ---------- PENDING / NEW USER ---------- */
    await loadAlliances(alliancePending);
    profileForm.style.display = "block";
    profileView.classList.add("fade-in");

    await loadAlliances(alliancePending);

    statusText.innerText = "⏳ Complete your profile and wait for approval";
}

/* ---------- SAVE (APPROVED USER) ---------- */
if (saveProfileBtn) {
    saveProfileBtn.onclick = async () => {
        try {
            await updateDoc(doc(db, "users", auth.currentUser.email), {
                ingameName: ingameNameInput.value.trim(),
                alliance: allianceSelect.value
            });

            showToast("Profile updated", "success");
            saveProfileBtn.innerText = "Saved ✓";
            setTimeout(() => (saveProfileBtn.innerText = "Save Changes"), 1500);
        } catch (e) {
            console.error(e);
            showToast("Update failed", "error");
        }
    };
}

/* ---------- SUBMIT (PENDING USER) ---------- */
if (profileForm) {
    profileForm.onsubmit = async (e) => {
        e.preventDefault();

        await updateDoc(doc(db, "users", auth.currentUser.email), {
            playerId: playerIdPending.value.trim(),
            ingameName: ingameNamePending.value.trim(),
            alliance: alliancePending.value,
            status: "pending"
        });

        showToast("Profile submitted", "success");
        profileForm.style.display = "none";
        statusText.innerText = "⏳ Waiting for admin approval";

    };
}

/* ---------- INIT ---------- */
import { onAuthStateChanged } from
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        // 🧊 KEEP SPINNER VISIBLE
        // auth-state.js will NOT hide it for profile data
        spinner.style.display = "block";
        await loadProfile(); // waits for everything
        spinner.style.display = "none";

    } catch (e) {
        console.error(e);
        showToast("Failed to load profile", "error");
    } finally {
        // ✅ SHOW PAGE ONLY WHEN READY
        const authLoader = document.getElementById("authLoader");
        const appRoot = document.getElementById("appRoot");

        if (authLoader) authLoader.style.display = "none";
        if (appRoot) appRoot.classList.remove("hidden");
    }
});