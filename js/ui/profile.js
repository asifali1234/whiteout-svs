// ui/profile.js — profile page UI & wiring

import {auth} from "../lib/firebase.js";
import {getAlliances} from "../data/cache.js";
import {acceptInviteIfExists} from "../data/inviteOps.js";

import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {fetchUserByEmail, UpdateProfileOnApproval, UpdateUserToPending} from "../data/userOps.js";

import {bookSlot, cancelAndRebookSlot, cancelSlot, fetchActiveSVS, fetchReservations} from "../data/svsOps.js";
// import { cancelSlot } from "../data/svsOps.js";


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

// const spinner = document.getElementById("profileSpinner");

let currentlyOpenDetail = null;

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
    // 🧊 KEEP SPINNER VISIBLE
    // auth-state.js will NOT hide it for profile data
    // if (spinner) spinner.style.display = "block";

    console.log("Loading profile...");
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
        snap = await fetchUserByEmail(user.email);
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

    // 🔥 PRELOAD ALLIANCES FIRST
    const alliances = await getAlliances();

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
        const refreshed = await fetchUserByEmail(user.email);
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
        console.log("SHOWING PROFILE VIEW Approved user");
        if (profileView) profileView.style.display = "block";
        return;
    }

    /* ---------- PENDING / NEW USER ---------- */
    await loadAlliances(alliancePending);
    if (profileForm) {
        console.log("showing profile form for pending/incomplete user");
        profileForm.style.display = "block";
        profileForm.classList.add("fade-in");
    }

    if (statusText) statusText.innerText = "⏳ Complete your profile and wait for approval";
    console.log("PROFILE DATA:", data);
    console.log("UI SETUP DONE");
}


/* ---------- SAVE (APPROVED USER) ---------- */
if (saveProfileBtn) {
    saveProfileBtn.onclick = async () => {
        try {
            await UpdateProfileOnApproval(auth.currentUser.email, ingameNameInput.value.trim(), allianceSelect.value);

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

        try {
            await UpdateUserToPending(auth.currentUser.email, playerIdPending.value.trim(), ingameNamePending.value.trim(), alliancePending.value);

            showToast("Profile submitted", "success");
            profileForm.style.display = "none";
            statusText.innerText = "⏳ Waiting for admin approval";

        } catch (err) {
            console.error(err);
            showToast(err.message || "Profile submission failed", "error");
        }
    };
}

/* =====================================================
   AUTH STATE
===================================================== */

onAuthStateChanged(auth, async (user) => {
    console.log(user);
    console.log("AUTH STATE CHANGED - PROFILE PAGE");
    if (!user) return;

    // ✅ SHOW PAGE ONLY WHEN READY
    const authLoader = document.getElementById("authLoader");
    const appRoot = document.getElementById("appRoot");

    if (appRoot) appRoot.classList.add("hidden");
    if (authLoader) authLoader.style.display = "flex";

    try {
        await loadProfile();

    } catch (e) {
        console.error(e);
        showToast("Failed to load profile", "error");
    } finally {
        console.log("AUTH STATE CHANGED - PROFILE PAGE : DONE");
        if (authLoader) authLoader.style.display = "none";
        if (appRoot) appRoot.classList.remove("hidden");
    }
});

/* ---------- MEMBER TABS ---------- */
const memberTabs = document.querySelectorAll(".member-tabs .tab-btn");
const memberPanels = document.querySelectorAll(".tab-panel");

memberTabs.forEach(btn => {
    btn.onclick = async () => {

        memberTabs.forEach(b => b.classList.remove("active"));
        memberPanels.forEach(p => p.classList.remove("active"));

        btn.classList.add("active");

        const tabName = btn.dataset.tab;
        const panel = document.getElementById(`tab-${tabName}`);

        if (panel) panel.classList.add("active");

        // 🔥 LOAD RESERVATIONS WHEN TAB OPENED
        if (tabName === "reservations") {
            loadTimezoneOptions();
            await loadMemberReservations();
        }
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


async function loadMemberReservations() {

    const container = document.getElementById("memberReservationContainer");
    container.innerHTML = "Loading...";

    const active = await fetchActiveSVS();

    if (!active || !active.id) {
        container.innerHTML = "No active SVS.";
        return;
    }

    await renderMemberReservationBoard(active.id);
}

async function renderMemberReservationBoard(svsId) {

    const container = document.getElementById("memberReservationContainer");
    container.innerHTML = "";

    const slots = await fetchReservations(svsId);

    const currentUser = auth.currentUser;
    if (!currentUser) return;

    /* =========================
       🔥 ACTIVE RESERVATIONS
    ========================== */

    const mySlots = slots.filter(
        s => s.reservedBy === currentUser.email
    );

    if (mySlots.length) {

        const activeWrapper = document.createElement("div");
        activeWrapper.className = "member-active-reservations";

        const title = document.createElement("h3");
        title.innerText = "Your Active Reservations";
        activeWrapper.appendChild(title);

        mySlots.forEach(slot => {

            const card = document.createElement("div");
            card.className = "member-active-card";

            const zone = localStorage.getItem("preferredTimezone") || "UTC";

            const formattedTime = new Intl.DateTimeFormat("en-GB", {
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
                timeZone: zone
            }).format(slot.startTime);

            const dateObj = new Date(slot.day + "T00:00:00Z");
            const weekday = dateObj.toLocaleDateString("en-US", {weekday: "short"});

            const role = slot.role
                ?.replace(/_/g, " ")
                ?.replace(/\b\w/g, l => l.toUpperCase());

            card.innerHTML = `
                <div class="active-left">
                    <div class="active-main">
                        ${weekday} • ${slot.day} • ${role}
                    </div>
                    <div class="active-time">
                        ${formattedTime} (${zone})
                    </div>
                </div>
                <div class="active-right">
                    <button class="danger-btn cancel-active-btn">
                        Cancel
                    </button>
                </div>
            `;

            card.querySelector(".cancel-active-btn").onclick = async () => {

                openConfirmModal(
                    "Cancel Reservation?",
                    `Cancel your reservation at ${formattedTime}?`,
                    async () => {
                        try {
                            await cancelSlot(svsId, slot.id);
                            showToast("Reservation cancelled", "info");
                            await renderMemberReservationBoard(svsId);
                        } catch (e) {
                            showToast(e.message, "error");
                        }
                    }
                );
            };

            activeWrapper.appendChild(card);
        });

        container.appendChild(activeWrapper);
    }

    const grouped = {};

    slots.forEach(s => {
        if (!grouped[s.day]) grouped[s.day] = [];
        grouped[s.day].push(s);
    });

    const days = Object.keys(grouped).sort();

    if (!days.length) {
        container.innerHTML = "No slots available.";
        return;
    }

    days.forEach(day => {

        const dayWrapper = document.createElement("div");
        dayWrapper.className = "member-day-wrapper";

        // Get weekday
        const dateObj = new Date(day + "T00:00:00Z");
        const weekday = dateObj.toLocaleDateString("en-US", {weekday: "short"});

// Get role from first slot of that day
        const roleRaw = grouped[day][0]?.role || "";
        const role = roleRaw
            .replace(/_/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());

        const header = document.createElement("h4");
        const zone = localStorage.getItem("preferredTimezone");
        header.innerText = `${weekday} • ${day} • ${role} (${zone})`;

        dayWrapper.appendChild(header);
        const grid = document.createElement("div");
        grid.className = "member-grid";

        grouped[day]
            .sort((a, b) => a.startTime - b.startTime)
            .forEach(slot => {

                const block = document.createElement("div");

                let css = "free";
                if (slot.reservedBy) css = "reserved";
                if (slot.reservedBy === auth.currentUser.email) css = "mine";

                block.className = `slot-block ${css}`;

                const time = formatTimeWithZone(slot.startTime);

                block.innerText = time;

                const detail = buildSlotDetail(slot, svsId, slots);

                block.onclick = () => {

                    // Close previous if different
                    if (currentlyOpenDetail && currentlyOpenDetail !== detail) {
                        currentlyOpenDetail.classList.remove("active-detail");
                    }

                    const isOpening = !detail.classList.contains("active-detail");

                    // Close current if already open
                    if (!isOpening) {
                        detail.classList.remove("active-detail");
                        currentlyOpenDetail = null;
                        return;
                    }

                    detail.classList.add("active-detail");
                    currentlyOpenDetail = detail;
                };

                grid.appendChild(block);
                grid.appendChild(detail);
            });

        dayWrapper.appendChild(grid);
        container.appendChild(dayWrapper);
    });
}

function buildSlotDetail(slot, svsId, allSlots) {

    const detail = document.createElement("div");
    detail.className = "slot-detail";

    const time = slot.startTime
        .toISOString()
        .substring(11, 16);

    /* ================= FREE SLOT ================= */

    if (!slot.reservedBy) {

        detail.innerHTML = `
            <div><strong>${time}</strong></div>
            <div>Status: FREE</div>
            <button class="primary-btn reserve-btn">
                Reserve
            </button>
        `;

        const btn = detail.querySelector(".reserve-btn");

        btn.onclick = async () => {

            btn.disabled = true;
            btn.innerText = "Reserving...";

            try {

                await bookSlot(svsId, slot.id);

                showToast("Slot reserved", "success");

                await renderMemberReservationBoard(svsId);

            } catch
                (e) {

                console.error("BOOK ERROR:", e);

                /* ===== USER ALREADY HAS SLOT SAME DAY ===== */

                if (e.message === "You already have a reservation for this day.") {

                    const existingSlot = allSlots.find(s =>
                        s.reservedBy === auth.currentUser.email &&
                        s.day === slot.day
                    );

                    if (!existingSlot) {
                        showToast("Existing reservation not found.", "error");
                        btn.disabled = false;
                        btn.innerText = "Reserve";
                        return;
                    }

                    const oldTime = existingSlot.startTime
                        .toISOString()
                        .substring(11, 16);

                    openConfirmModal(
                        "Replace Reservation?",
                        `You already booked ${oldTime}.
            
Do you want to cancel it and reserve ${time} instead?`,
                        async () => {

                            try {

                                await cancelAndRebookSlot(
                                    svsId,
                                    existingSlot.id,
                                    slot.id,
                                    {
                                        email: auth.currentUser.email,
                                        playerId: existingSlot.playerId,
                                        ingameName: existingSlot.ingameName,
                                        alliance: existingSlot.alliance
                                    }
                                );

                                showToast("Reservation updated", "success");
                                await renderMemberReservationBoard(svsId);

                            } catch (err) {

                                if (err.message === "Slot already reserved.") {
                                    showToast("New slot just got taken.", "error");
                                } else {
                                    showToast(err.message || "Rebooking failed.", "error");
                                }
                            }
                        }
                    );

                    /* ===== SLOT JUST TAKEN ===== */

                } else if (e.message === "Slot already reserved.") {

                    showToast("This slot was just taken by someone else.", "error");

                    /* ===== FIRESTORE PERMISSION ISSUE ===== */

                } else if (e.code === "permission-denied") {
                    showToast("You are not allowed to reserve.", "error");

                    /* ===== UNKNOWN ERROR ===== */

                } else {
                    showToast(e.message || "Reservation failed.", "error");
                }


                btn.disabled = false;
                btn.innerText = "Reserve";
            }
        };

    }

    /* ================= RESERVED SLOT ================= */

    else {

        detail.innerHTML = `
            <div><strong>${time}</strong></div>
            <div>Player: ${slot.ingameName}</div>
            <div>ID: ${slot.playerId}</div>
            <div>Alliance: ${slot.alliance}</div>
        `;

        /* ===== USER OWNS THIS SLOT ===== */

        if (slot.reservedBy === auth.currentUser.email) {

            const cancelBtn = document.createElement("button");
            cancelBtn.className = "danger-btn";
            cancelBtn.innerText = "Cancel";

            cancelBtn.onclick = async () => {

                openConfirmModal(
                    "Cancel Reservation?",
                    `Cancel your ${time} reservation?`,
                    async () => {

                        try {

                            await cancelSlot(svsId, slot.id);

                            showToast("Reservation cancelled", "info");
                            await renderMemberReservationBoard(svsId);

                        } catch (e) {

                            showToast(e.message || "Cancel failed.", "error");
                        }
                    }
                );
            };

            detail.appendChild(cancelBtn);
        }
    }

    return detail;
}


function openConfirmModal(title, message, onConfirm) {

    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const msgEl = document.getElementById("confirmMessage");
    const yesBtn = document.getElementById("confirmYesBtn");
    const noBtn = document.getElementById("confirmNoBtn");

    if (!modal) {
        // fallback
        if (confirm(message)) {
            onConfirm();
        }
        return;
    }

    titleEl.innerText = title;
    msgEl.innerText = message;

    modal.classList.add("active");

    yesBtn.onclick = async () => {
        modal.classList.remove("active");
        await onConfirm();
    };

    noBtn.onclick = () => {
        modal.classList.remove("active");
    };
}

function loadTimezoneOptions() {

    const select = document.getElementById("timezoneSelect");
    if (!select) return;

    select.innerHTML = ""; // prevent duplicates

    const zones = Intl.supportedValuesOf("timeZone");

    zones.forEach(zone => {
        const opt = document.createElement("option");
        opt.value = zone;
        opt.textContent = zone;
        select.appendChild(opt);
    });

    // 🔥 DEFAULT = UTC
    const saved = localStorage.getItem("preferredTimezone");

    select.value = saved || "UTC";

    select.onchange = () => {
        localStorage.setItem("preferredTimezone", select.value);
        loadMemberReservations(); // re-render board
    };
}

function formatTimeWithZone(date) {

    if (!date) return "-";

    const zone = localStorage.getItem("preferredTimezone") || "UTC";

    return new Intl.DateTimeFormat("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: zone
    }).format(date);
}
