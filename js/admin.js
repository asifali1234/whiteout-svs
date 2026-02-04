// js/admin.js
import { auth, db } from "./firebase.js";
import {
    collection,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    addDoc,
    setDoc,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ===================== SEARCH ===================== */
const inviteSearch = document.querySelector('[data-search="invites"]');
const pendingSearch = document.querySelector('[data-search="pending"]');
const approvedSearch = document.querySelector('[data-search="approved"]');

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

/* ===================== DOM ===================== */
const tabs = document.querySelectorAll(".tab-btn");
const panels = document.querySelectorAll(".tab-panel");

const allianceTable = document.getElementById("allianceTable");
const inviteTable = document.getElementById("inviteTable");
const pendingTable = document.getElementById("pendingTable");
const approvedTable = document.getElementById("approvedTable");

/* ===================== TAB HANDLER ===================== */
tabs.forEach(btn => {
    btn.onclick = () => activateTab(btn.dataset.tab);
});

async function activateTab(tab) {
    tabs.forEach(b => b.classList.remove("active"));
    panels.forEach(p => p.classList.remove("active"));

    document.querySelector(`.tab-btn[data-tab="${tab}"]`).classList.add("active");
    const panel = document.getElementById(`tab-${tab}`);
    panel.classList.add("active");

    const loader = panel.querySelector(".loader");
    loader.style.display = "flex";

    try {
        if (tab === "alliances") await loadAlliances();
        if (tab === "invites") await loadInvites();
        if (tab === "pending") await loadUsers("pending");
        if (tab === "approved") await loadUsers("approved");
    } catch (e) {
        console.error(e);
        showToast("Failed to load data", "error");
    } finally {
        loader.style.display = "none";
    }
}

/* ===================== ALLIANCES ===================== */
async function loadAlliances() {
    if (allianceCache) {
        renderAlliances(allianceCache);
        return;
    }

    const snap = await getDocs(collection(db, "alliances"));
    allianceCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderAlliances(allianceCache);
}

function renderAlliances(list) {
    allianceTable.innerHTML = `
    <tr><th>ID</th><th>Short</th><th>Name</th><th>Status</th><th></th></tr>
  `;
    list.forEach(a => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${a.id}</td>
      <td>${a.shortName}</td>
      <td>${a.name}</td>
      <td>${a.status}</td>
      <td><button>Edit</button></td>
    `;
        tr.querySelector("button").onclick = () => openAllianceModal(a.id, a);
        allianceTable.appendChild(tr);
    });
}

/* ===================== INVITES ===================== */
async function loadInvites() {
    if (inviteCache) {
        renderInvites(inviteCache);
        return;
    }

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
    inviteTable.innerHTML = `
    <tr><th>Email</th><th>ID</th><th>Name</th><th>Alliance</th><th></th></tr>
  `;
    if (!list.length) {
        inviteTable.innerHTML += `
      <tr><td colspan="5" style="text-align:center;opacity:.6">No active invites</td></tr>
    `;
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
            inviteCache = null;
            loadInvites();
            showToast("Invite cancelled", "info");
        };
        inviteTable.appendChild(tr);
    });
}

/* ===================== USERS ===================== */
async function loadUsers(status) {
    const cache = status === "pending" ? pendingCache : approvedCache;
    const table = status === "pending" ? pendingTable : approvedTable;

    if (cache) {
        renderUsers(cache, table, status);
        return;
    }

    const snap = await getDocs(
        query(collection(db, "users"), where("status", "==", status))
    );

    const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (status === "pending") pendingCache = data;
    else approvedCache = data;

    renderUsers(data, table, status);
}

function renderUsers(list, table, status) {
    table.innerHTML = `
    <tr><th>Email</th><th>ID</th><th>Name</th><th>Alliance</th><th></th></tr>
  `;
    list.forEach(u => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
      <td>${u.email}</td>
      <td>${u.playerId || "-"}</td>
      <td>${u.ingameName || "-"}</td>
      <td>${u.alliance || "-"}</td>
      <td></td>
    `;
        table.appendChild(tr);
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
