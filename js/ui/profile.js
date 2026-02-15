// ui/profile.js — profile page UI & wiring

import {auth, db} from "../lib/firebase.js";
import {doc, getDoc, updateDoc} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {getAlliances} from "../data/cache.js";
import {acceptInviteIfExists} from "../data/inviteOps.js";

import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

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

const spinner = document.getElementById("profileSpinner");

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
    const alliances = await getAlliances();
    alliances.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = `${a.shortName} – ${a.name}`;
        selectEl.appendChild(opt);
    });
}

/* ---------- LOAD PROFILE ---------- */
async function loadProfile() {
    // Hide both sections first
    if (profileView) profileView.style.display = "none";
    if (profileForm) profileForm.style.display = "none";

    // Show loading text / spinner
    if (statusText) statusText.innerText = "Loading profile…";

    const user = auth.currentUser;
    if (!user) {
        if (statusText) statusText.innerText = "Not logged in";
        return;
    }


    let snap;
    try {
        snap = await getDoc(doc(db, "users", user.email));
    } catch (e) {
        console.error("Failed to read user doc", e);
        if (statusText) statusText.innerText = "Failed to load profile";
        return;
    }

    if (!snap.exists()) {
        console.error("User doc missing");
        if (statusText) statusText.innerText = "Profile not found. Contact admin.";
        return;
    }

    let data = snap.data();
    console.log("PROFILE DATA:", data);

    const adminBtn = document.getElementById("adminBtn");

    if (adminBtn && data?.role === "admin") {
        adminBtn.classList.remove("hidden");
        adminBtn.onclick = () => {
            window.location.href = "admin.html";
        };
    }

    /* ================= ACCEPT INVITE IF EXISTS ================= */

    const inviteAccepted = await acceptInviteIfExists(user.email);

    if (inviteAccepted) {
        showToast("Invitation accepted", "success");
        const refreshed = await getDoc(userRef);
        data = refreshed.data();
    }

    /* ================= CONTROL TABS ================= */

    controlTabs(data.status);

    /* ---------- APPROVED USER ---------- */
    if (data.status === "approved") {
        // Load alliances FIRST (offscreen)
        await loadAlliances(allianceSelect);

        // Populate values
        if (playerIdInput) playerIdInput.value = data.playerId || "";
        if (ingameNameInput) ingameNameInput.value = data.ingameName || "";
        if (allianceSelect) allianceSelect.value = data.alliance || "";

        // Status text last
        if (statusText) statusText.innerText =
            "✅ Profile approved. Contact admin for ID changes.";

        // 🔥 SHOW ONLY AFTER EVERYTHING IS READY
        if (profileView) profileView.style.display = "block";
        return;
    }

    /* ---------- PENDING / NEW USER ---------- */
    await loadAlliances(alliancePending);
    if (profileForm) {
        profileForm.style.display = "block";
        profileForm.classList.add("fade-in");
    }

    if (statusText) statusText.innerText = "⏳ Complete your profile and wait for approval";
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

/* =====================================================
   AUTH STATE
===================================================== */

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    try {
        // 🧊 KEEP SPINNER VISIBLE
        // auth-state.js will NOT hide it for profile data
        if (spinner) spinner.style.display = "block";
        await loadProfile();


        if (spinner) spinner.style.display = "none";

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

/* ---------- MEMBER TABS ---------- */
const memberTabs = document.querySelectorAll(".member-tabs .tab-btn");
const memberPanels = document.querySelectorAll(".tab-panel");

memberTabs.forEach(btn => {
    btn.onclick = () => {
        memberTabs.forEach(b => b.classList.remove("active"));
        memberPanels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");
        const panel = document.getElementById(`tab-${btn.dataset.tab}`);
        if (panel) panel.classList.add("active");
    };
});


function controlTabs(status) {
    const memberTabs = document.querySelectorAll(".member-tabs .tab-btn");

    memberTabs.forEach(btn => {
        const tab = btn.dataset.tab;

        if (status !== "approved" && tab !== "profile") {
            btn.classList.add("disabled-tab");
            btn.style.pointerEvents = "none";
            btn.style.opacity = "0.5";
        } else {
            btn.classList.remove("disabled-tab");
            btn.style.pointerEvents = "auto";
            btn.style.opacity = "1";
        }
    });

    // If not approved, force profile tab active
    if (status !== "approved") {
        document.querySelectorAll(".tab-panel").forEach(p =>
            p.classList.remove("active")
        );
        document.querySelector('[data-tab="profile"]').classList.add("active");
        document.getElementById("tab-profile").classList.add("active");
    }
}

