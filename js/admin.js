import { auth, db } from "./firebase.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    addDoc,
    getDoc,
    setDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getAlliances, clearAllianceCache } from "./cache.js";

/* ===================== SEARCH ===================== */
const inviteSearch = document.querySelector('[data-search="invites"]');
const pendingSearch = document.querySelector('[data-search="pending"]');
const approvedSearch = document.querySelector('[data-search="approved"]');

/* ===================== TABLES ===================== */
const allianceTable = document.getElementById("allianceTable");
const inviteTable = document.getElementById("inviteTable");
const pendingTable = document.getElementById("pendingTable");
const approvedTable = document.getElementById("approvedTable");

/* ===================== MODALS ===================== */
const inviteModal = document.getElementById("inviteModal");
const openInviteModalBtn = document.getElementById("openInviteModalBtn");
const cancelInviteBtn = document.getElementById("cancelInviteBtn");
const createInviteBtn = document.getElementById("createInviteBtn");

const inviteEmail = document.getElementById("inviteEmail");
const invitePlayerId = document.getElementById("invitePlayerId");
const inviteIngameName = document.getElementById("inviteIngameName");
const inviteAlliance = document.getElementById("inviteAlliance");

const allianceModal = document.getElementById("allianceModal");
const openAllianceModalBtn = document.getElementById("openAllianceModalBtn");
const cancelAllianceBtn = document.getElementById("cancelAllianceBtn");
const saveAllianceBtn = document.getElementById("saveAllianceBtn");

const allianceIdInput = document.getElementById("allianceIdInput");
const allianceShortNameInput = document.getElementById("allianceShortNameInput");
const allianceNameInput = document.getElementById("allianceNameInput");
const allianceStatusInput = document.getElementById("allianceStatusInput");

const editModal = document.getElementById("editModal");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const saveEditBtn = document.getElementById("saveEditBtn");

const editEmail = document.getElementById("editEmail");
const editPlayerId = document.getElementById("editPlayerId");
const editIngameName = document.getElementById("editIngameName");
const editAlliance = document.getElementById("editAlliance");
const editStatus = document.getElementById("editStatus");
const editRole = document.getElementById("editRole");

/* ===================== CACHES ===================== */
let inviteCache = null;
let pendingCache = null;
let approvedCache = null;
let allianceCache = null;

/* ===================== TOAST ===================== */
function showToast(msg, type = "info") {
    const c = document.getElementById("toastContainer");
    if (!c) return;
    const t = document.createElement("div");
    t.className = `toast ${type}`;
    t.innerText = msg;
    c.appendChild(t);
    setTimeout(() => t.remove(), 3000);
}

/* ===================== TABS ===================== */
const tabs = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");

tabs.forEach(btn => {
    btn.onclick = () => activateTab(btn.dataset.tab);
});

async function activateTab(tab) {
    tabs.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");
    const panel = document.getElementById(`tab-${tab}`);
    panel.classList.add("active");

    const loader = panel.querySelector(".loader");
    loader.style.display = "flex";

    try {
        if (tab === "alliances") await loadAlliances();
        if (tab === "invites") await loadInvites();
        if (tab === "pending") await loadUsers("pending");
        if (tab === "approved") await loadUsers("approved");
    } finally {
        loader.style.display = "none";
    }
}

/* ===================== ALLIANCES ===================== */
async function loadAlliances() {
    allianceCache = await getAlliances();
    renderAlliances(allianceCache);
}

function renderAlliances(list) {
    allianceTable.innerHTML =
        `<tr><th>ID</th><th>Short</th><th>Name</th><th>Status</th><th></th></tr>`;

    list.forEach(a => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${a.id}</td>
            <td>${a.shortName}</td>
            <td>${a.name}</td>
            <td>${a.status}</td>
            <td><button>Edit</button></td>
        `;
        tr.querySelector("button").onclick = () => openAllianceModal(a);
        allianceTable.appendChild(tr);
    });
}

/* ===================== INVITES ===================== */
async function loadInvites() {
    const snap = await getDocs(
        query(
            collection(db, "invites"),
            where("used", "==", false),
            where("cancelled", "==", false)
        )
    );
    inviteCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderInvites(inviteCache);
}

function renderInvites(list) {
    inviteTable.innerHTML =
        `<tr><th>Email</th><th>ID</th><th>Name</th><th>Alliance</th><th></th></tr>`;

    if (!list.length) {
        inviteTable.innerHTML +=
            `<tr><td colspan="5" style="text-align:center;opacity:.6">No active invites</td></tr>`;
        return;
    }

    list.forEach(i => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${i.email}</td>
            <td>${i.playerId}</td>
            <td>${i.ingameName}</td>
            <td>${i.alliance}</td>
            <td><button class="danger-btn">Cancel</button></td>
        `;
        tr.querySelector("button").onclick = async () => {
            await updateDoc(doc(db, "invites", i.id), { cancelled: true });
            showToast("Invite cancelled", "info");
            loadInvites();
        };
        inviteTable.appendChild(tr);
    });
}

/* ===================== USERS ===================== */
async function loadUsers(status) {
    const snap = await getDocs(
        query(collection(db, "users"), where("status", "==", status))
    );

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (status === "pending") pendingCache = data;
    else approvedCache = data;

    renderUsers(data, status === "pending" ? pendingTable : approvedTable, status);
}

function renderUsers(list, table, status) {
    table.innerHTML =
        `<tr><th>Email</th><th>ID</th><th>Name</th><th>Alliance</th><th></th></tr>`;

    list.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${u.email}</td>
            <td>${u.playerId || "-"}</td>
            <td>${u.ingameName || "-"}</td>
            <td>${u.alliance || "-"}</td>
            <td></td>
        `;

        if (status === "pending") {
            const approve = document.createElement("button");
            approve.innerText = "Approve";
            approve.onclick = async () => {
                await updateDoc(doc(db, "users", u.id), { status: "approved" });
                showToast("User approved", "success");
                loadUsers("pending");
            };
            tr.children[4].appendChild(approve);
        }

        const edit = document.createElement("button");
        edit.innerText = "Edit";
        edit.onclick = () => openEditModal(u);
        tr.children[4].appendChild(edit);

        const del = document.createElement("button");
        del.innerText = "Delete";
        del.className = "danger-btn";

        del.onclick = async () => {
            const confirmDelete = confirm(
                `Are you sure you want to delete user:\n\n${u.email}\n\nThis action cannot be undone.`
            );

            if (!confirmDelete) return;

            try {
                await deleteDoc(doc(db, "users", u.id));
                showToast("User deleted", "info");
                loadUsers(status);
            } catch (e) {
                console.error(e);
                showToast("Delete failed", "error");
            }
        };
        tr.children[4].appendChild(del);

        table.appendChild(tr);
    });
}

/* ===================== MODAL LOGIC ===================== */

// Invite
if (openInviteModalBtn)
    openInviteModalBtn.onclick = async () => {
        inviteModal.classList.add("active");
        await loadAllianceOptions(inviteAlliance);
    };

if (cancelInviteBtn)
    cancelInviteBtn.onclick = () => inviteModal.classList.remove("active");

if (createInviteBtn)
    createInviteBtn.onclick = async () => {
        await addDoc(collection(db, "invites"), {
            email: inviteEmail.value.trim(),
            playerId: invitePlayerId.value.trim(),
            ingameName: inviteIngameName.value.trim(),
            alliance: inviteAlliance.value,
            invitedBy: auth.currentUser.email,
            used: false,
            cancelled: false,
            createdAt: new Date()
        });
        showToast("Invite created", "success");
        inviteModal.classList.remove("active");
        loadInvites();
    };

// Alliance
if (openAllianceModalBtn)
    openAllianceModalBtn.onclick = () => {
        allianceIdInput.disabled = false;
        allianceIdInput.value = "";
        allianceShortNameInput.value = "";
        allianceNameInput.value = "";
        allianceStatusInput.value = "active";
        allianceModal.classList.add("active");
    };

if (cancelAllianceBtn)
    cancelAllianceBtn.onclick = () => allianceModal.classList.remove("active");

if (saveAllianceBtn)
    saveAllianceBtn.onclick = async () => {
        await setDoc(doc(db, "alliances", allianceIdInput.value.trim()), {
            shortName: allianceShortNameInput.value.trim(),
            name: allianceNameInput.value.trim(),
            status: allianceStatusInput.value
        }, { merge: true });

        clearAllianceCache();
        showToast("Alliance saved", "success");
        allianceModal.classList.remove("active");
        loadAlliances();
    };

function openAllianceModal(a) {
    allianceIdInput.value = a.id;
    allianceIdInput.disabled = true;
    allianceShortNameInput.value = a.shortName;
    allianceNameInput.value = a.name;
    allianceStatusInput.value = a.status;
    allianceModal.classList.add("active");
}

// Edit User
function openEditModal(u) {
    editEmail.value = u.email;
    editPlayerId.value = u.playerId || "";
    editIngameName.value = u.ingameName || "";
    editStatus.value = u.status;
    editRole.value = u.role;

    loadAllianceOptions(editAlliance).then(() => {
        editAlliance.value = u.alliance || "";
    });

    editModal.classList.add("active");
}

if (cancelEditBtn)
    cancelEditBtn.onclick = () => editModal.classList.remove("active");

if (saveEditBtn)
    saveEditBtn.onclick = async () => {
        await updateDoc(doc(db, "users", editEmail.value), {
            playerId: editPlayerId.value.trim(),
            ingameName: editIngameName.value.trim(),
            alliance: editAlliance.value,
            status: editStatus.value,
            role: editRole.value
        });
        showToast("User updated", "success");
        editModal.classList.remove("active");
        loadUsers(editStatus.value);
    };

/* ===================== ALLIANCE OPTIONS ===================== */
async function loadAllianceOptions(selectEl) {
    selectEl.innerHTML = "";
    const alliances = await getAlliances();
    alliances.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = `${a.shortName} – ${a.name}`;
        selectEl.appendChild(opt);
    });
}

/* ===================== SEARCH ===================== */
function attachSearch(input, table) {
    input.oninput = e => {
        const q = e.target.value.toLowerCase();
        table.querySelectorAll("tr").forEach((r, i) => {
            if (i === 0) return;
            r.style.display = r.innerText.toLowerCase().includes(q) ? "" : "none";
        });
    };
}
if (inviteSearch) attachSearch(inviteSearch, inviteTable);
if (pendingSearch) attachSearch(pendingSearch, pendingTable);
if (approvedSearch) attachSearch(approvedSearch, approvedTable);

/* ===================== INIT ===================== */
activateTab("alliances");

import { onAuthStateChanged } from
        "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const snap = await getDoc(doc(db, "users", user.email));
    if (!snap.exists()) return;

    const profileBtn = document.getElementById("profileBtn");

    if (profileBtn) {
        profileBtn.classList.remove("hidden");
        profileBtn.onclick = () => {
            window.location.href = "profile.html";
        };
    }
});
