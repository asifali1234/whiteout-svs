// ui/admin.js — Admin UI controller (tabs, modals, and renders)

// Third-party / CDN imports
import {onAuthStateChanged} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {fetchAuditLogs} from "../data/auditOps.js";
// Local firebase instances
import {auth} from "../lib/firebase.js";

// Data modules
import {getAlliancesData, saveAllianceData} from "../data/allianceOps.js";
import {cancelInvite, createInvite, fetchActiveInvites} from "../data/inviteOps.js";
import {approveUser, fetchUserByEmail, fetchUsersByStatus, updateUser} from "../data/userOps.js";
import {
    adminCancelSlot,
    adminReserveSlot,
    completeSVS,
    createSVS,
    fetchActiveSVS,
    fetchCompletedSVS,
    fetchPrepPoints,
    fetchReservations,
    fetchSVSFullDetails,
    generateSlots,
    initializePrepPoints,
    setVictor,
    updatePrepPoints
} from "../data/svsOps.js";
import { fetchPlaceholderUsers } from "../data/userOps.js";
import { deleteUserAndClearReservation } from "../data/svsOps.js";

let activeSvsSubtab = null;
let activeSvsDay = null;

/* ===================== DOM NODES ===================== */
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

// ✅ SHOW PAGE ONLY WHEN READY
const authLoader = document.getElementById("authLoader");
const appRoot = document.getElementById("appRoot");


const inviteType = document.getElementById("inviteType");
const inviteEmailWrapper = document.getElementById("inviteEmailWrapper");

const svsCreationContainer = document.getElementById("svsCreationContainer");
const activeSvsContainer = document.getElementById("activeSvsContainer");
const reservationCalendar = document.getElementById("reservationCalendar");

if (inviteType) {
    inviteType.onchange = () => {
        if (inviteType.value === "id") {
            inviteEmailWrapper.style.display = "none";
        } else {
            inviteEmailWrapper.style.display = "block";
        }
    };
}


/* ===================== CACHES & STATE ===================== */
let inviteCache = null;
let pendingCache = null;
let approvedCache = null;
let allianceCache = null;

// store the document id for the user being edited (was incorrectly using email as id)
let editUserId = null;

/* ===================== HELPERS ===================== */
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
        if (tab === "svs") await loadSVSPanel();
        if (tab === "history") await loadHistory();
        if (tab === "audit") await loadGlobalAudit();
        if (tab === "placeholders") await loadPlaceholders();

        console.log("Activated tab:", tab);
    } catch (e) {
        console.error(e);
        showToast("Failed to load tab data", "error");
    } finally {
        loader.style.display = "none";
        if (authLoader) authLoader.style.display = "none";
        if (appRoot) appRoot.classList.remove("hidden");
    }
}

/* ===================== ALLIANCES ===================== */
async function loadAlliances() {
    try {
        allianceCache = await getAlliancesData();
        renderAlliances(allianceCache);
    } catch (e) {
        console.error(e);
        showToast("Failed to load alliances", "error");
    }
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
            <td><button class="secondary-btn">Edit</button></td>
        `;
        tr.querySelector("button").onclick = () => openAllianceModal(a);
        allianceTable.appendChild(tr);
    });
}

/* ===================== INVITES ===================== */
async function loadInvites() {
    try {
        inviteCache = await fetchActiveInvites();
        renderInvites(inviteCache);
    } catch (e) {
        console.error(e);
        showToast("Failed to load invites", "error");
    }
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
        tr.querySelector("button").onclick = () => {

            openConfirmModal(
                "Cancel Invite",
                `Are you sure you want to cancel invite for:\n\n${i.email}?`,
                async () => {
                    try {
                        await cancelInvite(i.id);
                        showToast("Invite cancelled", "info");
                        await loadInvites();

                    } catch (e) {
                        console.error(e);
                        showToast("Failed to cancel invite", "error");
                    }
                }
            );

        };
        inviteTable.appendChild(tr);
    });
}

/* ===================== USERS ===================== */
async function loadUsers(status) {
    try {
        const data = await fetchUsersByStatus(status);
        if (status === "pending") pendingCache = data;
        else approvedCache = data;

        renderUsers(data, status === "pending" ? pendingTable : approvedTable, status);
    } catch (e) {
        console.error(e);
        showToast("Failed to load users", "error");
    }
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
            <td class="action-cell"></td>
        `;

        const actionCell = tr.children[4];
        const actionWrapper = document.createElement("div");
        actionWrapper.className = "action-buttons";

        if (status === "pending") {
            const approve = document.createElement("button");
            approve.className = "secondary-btn";
            approve.innerText = "Approve";
            approve.onclick = async () => {
                try {
                    await approveUser(u.id);
                    showToast("User approved", "success");
                    loadUsers("pending");
                } catch (e) {
                    console.error(e);
                    showToast("Approve failed", "error");
                }
            };
            actionWrapper.appendChild(approve);
        }

        const edit = document.createElement("button");
        edit.className = "secondary-btn";
        edit.innerText = "Edit";
        edit.onclick = () => openEditModal(u);
        actionWrapper.appendChild(edit);

        const del = document.createElement("button");
        del.innerText = "Delete";
        del.className = "danger-btn";

        del.onclick = () => {

            openConfirmModal(
                "Delete User",
                `Are you sure you want to delete user:\n\n${u.email}\n\nThis action cannot be undone.`,
                async () => {
                    try {
                        await deleteUserAndClearReservation(u.id);

                        showToast("User deleted", "info");
                        await loadUsers(status);

                    } catch (e) {
                        console.error(e);
                        showToast("Delete failed", "error");
                    }
                }
            );

        };

        actionWrapper.appendChild(del);
        actionCell.appendChild(actionWrapper);

        table.appendChild(tr);
    });
}

/* ===================== MODAL LOGIC ===================== */

// Invite
if (openInviteModalBtn)
    openInviteModalBtn.onclick = async () => {
        inviteModal.classList.add("active");
        await loadAllianceOptions(inviteAlliance);

        // reset fields
        inviteType.value = "email";
        inviteEmailWrapper.style.display = "block";
    };

if (cancelInviteBtn)
    cancelInviteBtn.onclick = () => inviteModal.classList.remove("active");

if (createInviteBtn)
    createInviteBtn.onclick = async () => {
        try {
            const type = inviteType.value;
            const playerId = invitePlayerId.value.trim();
            const ingameName = inviteIngameName.value.trim();
            const alliance = inviteAlliance ? inviteAlliance.value : "";

            if (!/^\d+$/.test(playerId)) {
                showToast("Player ID must be numeric", "error");
                return;
            }

            let email;

            if (type === "email") {
                email = inviteEmail.value.trim();
                if (!email) {
                    showToast("Email is required", "error");
                    return;
                }
            } else {
                // Invite by ID
                email = `${playerId}@whiteout.local`;
            }

            await createInvite({
                email,
                playerId: playerId,
                ingameName: ingameName,
                alliance: alliance
            });
            showToast("Invite created", "success");
            inviteModal.classList.remove("active");
            loadInvites();
        } catch (e) {
            console.error(e);
            showToast("Failed to create invite", "error");
        }
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
        try {
            await saveAllianceData(allianceIdInput.value, allianceShortNameInput.value, allianceNameInput.value, allianceStatusInput.value);

            showToast("Alliance saved", "success");
            allianceModal.classList.remove("active");
            loadAlliances();
        } catch (e) {
            console.error(e);
            showToast("Failed to save alliance", "error");
        }
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
    // store the real document id so we can update correctly
    editUserId = u.id;

    editEmail.value = u.email;
    editPlayerId.value = u.playerId || "";
    editIngameName.value = u.ingameName || "";
    editStatus.value = u.status;
    editRole.value = u.role;

    loadAllianceOptions(editAlliance).then(() => {
        editAlliance.value = u.alliance || "";
    }).catch(e => {
        console.error(e);
    });

    editModal.classList.add("active");
}

if (cancelEditBtn)
    cancelEditBtn.onclick = () => editModal.classList.remove("active");

if (saveEditBtn)
    saveEditBtn.onclick = async () => {
        if (!editUserId) {
            showToast("No user selected", "error");
            return;
        }

        try {
            await updateUser(editUserId, {
                playerId: editPlayerId.value.trim(),
                ingameName: editIngameName.value.trim(),
                alliance: editAlliance.value,
                status: editStatus.value,
                role: editRole.value
            });
            showToast("User updated", "success");
            editModal.classList.remove("active");
            loadUsers(editStatus.value);
        } catch (e) {
            console.error(e);
            showToast("Failed to update user", "error");
        }
    };

/* ===================== ALLIANCE OPTIONS ===================== */
async function loadAllianceOptions(selectEl) {
    if (!selectEl) return;
    selectEl.innerHTML = "";
    try {
        const alliances = await getAlliancesData();
        alliances.forEach(a => {
            const opt = document.createElement("option");
            opt.value = a.id;
            opt.textContent = `${a.shortName} – ${a.name}`;
            selectEl.appendChild(opt);
        });
    } catch (e) {
        console.error(e);
        showToast("Failed to load alliances for select", "error");
    }
}

/* ===================== SEARCH ===================== */
function attachSearch(input, table) {
    if (!input || !table) return;
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


/* ===================== SVS ===================== */

const createSvsBtn = document.getElementById("createSvsBtn");
const svsOpponentState = document.getElementById("svsOpponentState");
const svsBattleDate = document.getElementById("svsBattleDate");
const svsStatusBox = document.getElementById("svsStatusBox");

async function loadSVSPanel() {

    svsCreationContainer.innerHTML = "";
    activeSvsContainer.innerHTML = "";

    const result = await fetchActiveSVS();

    if (!result.active) {

        activeSvsSubtab = null;
        activeSvsDay = null;

        renderCreateSvsUI();
        return;
    }

    renderActiveSvsUI(result.id, result);
}


function renderCreateSvsUI() {

    svsCreationContainer.innerHTML = `
        <div class="svs-card">
            <h3>Create New SVS</h3>

            <div class="svs-form-row">
                <div class="svs-form-group">
                    <label>Opponent State</label>
                    <input type="text" id="svsOpponentState" />
                </div>

                <div class="svs-form-group">
                    <label>Battle Date (Saturday)</label>
                    <input type="date" id="svsBattleDate" />
                </div>
            </div>

            <button id="createSvsBtn" class="primary-btn">
                Create SVS
            </button>
        </div>
    `;

    const btn = document.getElementById("createSvsBtn");

    btn.onclick = async () => {

        const opponent = document.getElementById("svsOpponentState").value.trim();
        const dateValue = document.getElementById("svsBattleDate").value;

        if (!opponent || !dateValue) {
            showToast("All fields required", "error");
            return;
        }

        const battleDate = new Date(dateValue + "T00:00:00Z");

        if (battleDate.getUTCDay() !== 6) {
            showToast("Battle date must be Saturday (UTC)", "error");
            return;
        }

        try {
            btn.disabled = true;
            btn.innerText = "Creating...";

            const svsId = await createSVS({
                opponentState: opponent,
                battleDate
            });

            await initializePrepPoints(svsId, battleDate);
            await generateSlots(svsId, battleDate);

            showToast("SVS created", "success");
            await loadSVSPanel();

        } catch (e) {
            showToast(e.message, "error");
        } finally {
            btn.disabled = false;
            btn.innerText = "Create SVS";
        }
    };
}

function renderActiveSvsUI(svsId, data) {

    const battleDate = data.battleDate; // already JS Date
    const now = new Date();

    let battleDateStr = "-";

    if (battleDate instanceof Date && !isNaN(battleDate)) {
        battleDateStr = battleDate.toISOString().substring(0, 10);
    }


    const canComplete = now >= battleDate && !!data.victor;

    activeSvsContainer.innerHTML = `
        <div class="svs-main-card">

            <div class="svs-header-row">
                <div>
                    <h3>Active SVS</h3>
                    <div class="svs-meta">
                        <span><strong>Opponent:</strong> ${data.opponentState}</span>
                        <span><strong>Battle Date:</strong> ${battleDateStr}</span>
                        <span><strong>Status:</strong> ${data.status}</span>
                    </div>
                </div>

                <button id="completeSvsBtn"
                    class="danger-btn"
                    ${!canComplete ? "disabled" : ""}>
                    Complete SVS
                </button>
            </div>

            <div class="svs-subtabs">
              
                <button class="svs-subtab-btn" data-subtab="reservations">
                    Reservations
                </button>
                
                <button class="svs-subtab-btn" data-subtab="points">
                    Points & Victor
                </button>
            </div>

            <div id="svsSubtabContent" class="svs-subtab-content"></div>

        </div>
    `;

    // Attach tab behavior
    document.querySelectorAll(".svs-subtab-btn").forEach(btn => {
        btn.onclick = () => {

            activeSvsSubtab = btn.dataset.subtab;

            document.querySelectorAll(".svs-subtab-btn")
                .forEach(b => b.classList.remove("active-subtab"));

            btn.classList.add("active-subtab");

            if (activeSvsSubtab === "points") {
                renderPointsAndVictorTab(svsId, data);
            }

            if (activeSvsSubtab === "reservations") {
                renderReservationsTab(svsId);
            }
        };
    });

    const completeBtn = document.getElementById("completeSvsBtn");

    if (canComplete && completeBtn) {
        completeBtn.onclick = () => {

            openConfirmModal(
                "Complete SVS",
                "Are you sure you want to complete this SVS?\n\nThis action cannot be undone.",
                async () => {
                    try {
                        await completeSVS(svsId);

                        showToast("SVS completed", "success");
                        await loadSVSPanel();

                    } catch (e) {
                        showToast(e.message || "Failed to complete SVS", "error");
                    }
                }
            );

        };
    }
    if (activeSvsSubtab) {
        const btn = document.querySelector(
            `.svs-subtab-btn[data-subtab="${activeSvsSubtab}"]`
        );
        if (btn) btn.click();
    }
}

async function renderPointsAndVictorTab(svsId, data) {

    const container = document.getElementById("svsSubtabContent");

    container.innerHTML = `
        <div class="svs-inner-card">
            <h4>Prep Points</h4>
            <div id="prepPointsSection"></div>
        </div>

        <div class="svs-inner-card">
            <div id="victorSection"></div>
        </div>
    `;

    renderPrepPointsUI(svsId);
    renderVictorUI(svsId, data);
}

async function renderReservationsTab(svsId) {

    const container = document.getElementById("svsSubtabContent");

    container.innerHTML = `
        <div class="svs-inner-card">
            <div class="history-section-header">
                <h4>Reservation Calendar</h4>
            </div>
   
            <div id="reservationCalendar"></div>
        </div>
    `;


    // 🔥 Re-query AFTER injecting HTML
    const reservationContainer = document.getElementById("reservationCalendar");

    const reservations = await fetchReservations(svsId);
    await renderReservationCalendar(svsId, reservations, reservationContainer);
}


async function renderPrepPointsUI(svsId) {

    const container = document.getElementById("prepPointsSection");
    if (!container) return;

    const prepList = await fetchPrepPoints(svsId);

    if (!prepList.length) {
        container.innerHTML = `<div>No prep points found.</div>`;
        return;
    }

    let totalSelf = 0;
    let totalOpp = 0;

    prepList.forEach(docSnap => {
        const d = docSnap;
        totalSelf += d.selfPoints || 0;
        totalOpp += d.opponentPoints || 0;
    });

    const diff = totalSelf - totalOpp;

    let html = `
        <div class="prep-summary">
            <div>Total Self: <strong>${totalSelf}</strong></div>
            <div>Total Opponent: <strong>${totalOpp}</strong></div>
            <div>Difference: 
                <strong class="${diff >= 0 ? 'positive' : 'negative'}">
                    ${diff}
                </strong>
            </div>
        </div>
    `;


    prepList.forEach(docSnap => {

        const d = docSnap;
        const dateObj = d.date;

        const dateStr = dateObj.toISOString().substring(0, 10);
        const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });

        html += `
            <div class="prep-card">
                <div class="prep-date">
                    <span class="prep-weekday">${weekday}</span>
                    <span class="prep-date-value">${dateStr}</span>
                </div>
        
        <div class="prep-input-block">
            <label>Self Points</label>
                    <input type="number" 
                        id="self_${docSnap.id}" 
                        value="${d.selfPoints}" />
                </div>
        
        <div class="prep-input-block">
            <label>Opponent Points</label>
                    <input type="number" 
                        id="opp_${docSnap.id}" 
                        value="${d.opponentPoints}" />
                </div>
        
                <button 
            class="secondary-btn prep-save-btn"
                    onclick="window.__updatePrep('${svsId}', '${docSnap.id}')">
                    Save
                </button>
            </div>
        `;

    });

    container.innerHTML = html;

    // attach handler globally (simple solution)
    window.__updatePrep = async (svsId, dateId) => {

        const selfPoints = parseInt(document.getElementById(`self_${dateId}`).value) || 0;
        const oppPoints = parseInt(document.getElementById(`opp_${dateId}`).value) || 0;

        try {
            await updatePrepPoints(svsId, dateId, selfPoints, oppPoints);
            showToast("Prep points updated", "success");
        } catch (e) {
            showToast(e.message || "Update failed", "error");
        }
    };
}

function renderVictorUI(svsId, data) {
    console.log("Rendering Victor UI with data:", data);
    const container = document.getElementById("victorSection");
    if (!container) return;

    const battleDate = data.battleDate; // already JS Date
    const now = new Date();

    let battleDateStr = "-";

    if (battleDate instanceof Date && !isNaN(battleDate)) {
        battleDateStr = battleDate.toISOString().substring(0, 10);
    }

    console.log("Victor UI: " + battleDateStr);

    const canSet =
        battleDate instanceof Date &&
        !isNaN(battleDate) &&
        now >= battleDate;

    console.log(battleDateStr);
    console.log(now)
    console.log(canSet)


    container.innerHTML = `
        <h4>Set Victor</h4>

        <select id="victorSelect" ${!canSet ? "disabled" : ""}>
            <option value="">-- Select Victor --</option>
            <option value="self" ${data.victor === "self" ? "selected" : ""}>
                Our State
            </option>
            <option value="opponent" ${data.victor === "opponent" ? "selected" : ""}>
                Opponent State
            </option>
        </select>

        <button 
            class="secondary-btn"
            ${!canSet ? "disabled" : ""}
            id="saveVictorBtn">
            Save Victor
        </button>
    `;

    const btn = document.getElementById("saveVictorBtn");
    if (!btn || !canSet) return;

    btn.onclick = async () => {

        const value = document.getElementById("victorSelect").value;
        if (!value) {
            showToast("Select victor", "error");
            return;
        }

        try {
            await setVictor(svsId, value);
            showToast("Victor updated", "success");
            await loadSVSPanel();
        } catch (e) {
            showToast(e.message || "Failed to set victor", "error");
        }
    };
}


async function renderReservationCalendar(svsId, slotDocs, containerEl, readOnly = false) {

    if (!containerEl) return;

    containerEl.innerHTML = "";

    let currentDaySlots = [];
    let totalSlots = slotDocs.length;
    let filledSlots = 0;

    slotDocs.forEach(slot => {
        if (slot.reservedBy) filledSlots++;
    });
    /* ================= SUMMARY BAR ================= */

    const summary = document.createElement("div");
        summary.className = "reservation-summary";
        summary.innerHTML = `
            <div class="reservation-summary-top">
                <div class="reservation-stat">
                    <span class="stat-label">Total Filled</span>
                    <span class="stat-value">${filledSlots} / ${totalSlots}</span>
                </div>

            <button id="exportCsvBtn" class="btn-export">
                <span class="export-icon">⬇</span>
                <span>Export CSV</span>
            </button>
            </div>
        
            <div class="reservation-filters">
        
                <label class="filter-checkbox">
                    <input type="checkbox" id="showOnlyFreeToggle" />
                    <span>Free Only</span>
                </label>
        
                <input type="text"
                    id="reservationSearch"
                    class="filter-input"
                    placeholder="Search name, ID, alliance" />
        
                <select id="allianceFilter" class="filter-select">
                    <option value="">All Alliances</option>
                </select>
        
            </div>
        `;

    containerEl.appendChild(summary);

    /* ================= ALLIANCE FILTER ================= */

    const allianceFilter = document.getElementById("allianceFilter");
    const alliances = await getAlliancesData();

    alliances.forEach(a => {
        const opt = document.createElement("option");
        opt.value = a.id;
        opt.textContent = a.shortName;
        allianceFilter.appendChild(opt);
    });

    /* ================= GROUP SLOTS BY DAY ================= */

    const grouped = {};

    slotDocs.forEach(d => {
        const data = d;
        if (!grouped[data.day]) grouped[data.day] = [];
        grouped[data.day].push({id: d.id, ...data});
    });

    const days = Object.keys(grouped).sort();

    if (!days.length) {
        containerEl.innerHTML =
            `<div style="opacity:.6">No slots found.</div>`;
        return;
    }

    /* ================= DAY TABS ================= */

    const tabWrapper = document.createElement("div");
    tabWrapper.className = "svs-day-tabs";

    const panel = document.createElement("div");
    panel.className = "svs-day-panel";

    let activeBtn = null;

    function renderDaySlots(slots) {

        panel.innerHTML = "";

        slots.forEach(slot => {

            const card = document.createElement("div");
            card.className = "svs-slot-card";

            let time = "-";

            if (slot.startTime instanceof Date && !isNaN(slot.startTime)) {
                time = slot.startTime.toISOString().substring(11, 16);
            }

            const left = document.createElement("div");
            left.className = "slot-left";

            if (slot.reservedBy) {
                left.innerHTML = `
                    <div class="slot-row-main">
                        <span class="slot-player">${slot.ingameName}</span>
                        <span class="slot-separator"> - </span>
                        <span class="slot-id">${slot.playerId}</span>
                        <span class="slot-separator"> - </span>
                        <span class="slot-alliance">${slot.alliance || "-"}</span>
                    </div>
                    <div class="slot-time-line">
                        ${time}
                    </div>
                `;
                card.classList.add("reserved");
            } else {
                left.innerHTML = `
                    <div class="slot-time">${time}</div>
                    <div class="slot-free">Free</div>
                `;
                card.classList.add("free");
            }

            const right = document.createElement("div");
            right.className = "slot-actions";

            if (!slot.reservedBy && !readOnly) {

                const reserveBtn = document.createElement("button");
                reserveBtn.className = "secondary-btn";
                reserveBtn.innerText = "Reserve";

                reserveBtn.onclick = async () => {

                    openReserveModal(svsId, slot.id);
                };

                right.appendChild(reserveBtn);

            } else if (!readOnly)  {

                const cancelBtn = document.createElement("button");
                cancelBtn.className = "danger-btn";
                cancelBtn.innerText = "Cancel";

                cancelBtn.onclick = () => {

                    openConfirmModal(
                        "Cancel Reservation",
                        "Are you sure you want to cancel this reservation?",
                        async () => {
                            try {
                                await adminCancelSlot(svsId, slot.id);

                                showToast("Reservation cancelled", "info");
                                await loadSVSPanel();

                            } catch (e) {
                                showToast("Cancel failed", "error");
                            }
                        }
                    );

                };

                right.appendChild(cancelBtn);
            }

            card.appendChild(left);
            card.appendChild(right);
            panel.appendChild(card);
        });
    }

    function applyFilters() {

        const showFree = document.getElementById("showOnlyFreeToggle").checked;
        const search = document.getElementById("reservationSearch").value.toLowerCase();
        const allianceValue = document.getElementById("allianceFilter").value;

        const filtered = currentDaySlots.filter(slot => {

            if (showFree && slot.reservedBy) return false;

            if (allianceValue && slot.alliance !== allianceValue) return false;

            if (search) {
                const text = `
                    ${slot.ingameName || ""}
                    ${slot.playerId || ""}
                    ${slot.alliance || ""}
                `.toLowerCase();

                if (!text.includes(search)) return false;
            }

            return true;
        });

        summary.classList.toggle(
            "filters-active",
            document.getElementById("showOnlyFreeToggle").checked ||
            document.getElementById("reservationSearch").value ||
            document.getElementById("allianceFilter").value
        );

        renderDaySlots(filtered);
    }

    document.getElementById("showOnlyFreeToggle").onchange = applyFilters;
    document.getElementById("reservationSearch").oninput = applyFilters;
    document.getElementById("allianceFilter").onchange = applyFilters;

    days.forEach((day, index) => {

        const daySlots = grouped[day];
        const filled = daySlots.filter(s => s.reservedBy).length;

        const firstSlot = daySlots[0];
        const role = firstSlot.role
            .replace(/_/g, " ")
            .replace(/\b\w/g, l => l.toUpperCase());

        const dateObj = new Date(day + "T00:00:00Z");
        const weekday = dateObj.toLocaleDateString("en-US", {weekday: "short"});

        const btn = document.createElement("button");
        btn.className = "svs-day-btn";
        btn.innerHTML = `
            <div>${weekday} – ${day}</div>
            <small>${role}</small>
            <div>${filled}/48</div>
        `;

        btn.onclick = () => {

            if (activeBtn) activeBtn.classList.remove("active-day");
            btn.classList.add("active-day");
            activeBtn = btn;

            activeSvsDay = day;
            currentDaySlots = daySlots;

            applyFilters();
        };

        if (activeSvsDay === day || (!activeSvsDay && index === 0)) {
            btn.classList.add("active-day");
            activeBtn = btn;
            activeSvsDay = day;
            currentDaySlots = daySlots;
            applyFilters();
        }


        tabWrapper.appendChild(btn);
    });
    const exportBtn = document.getElementById("exportCsvBtn");

    if (exportBtn) {
        exportBtn.onclick = () => exportReservationsToCSV(svsId, slotDocs);
    }

    containerEl.appendChild(tabWrapper);
    containerEl.appendChild(panel);
}

function exportReservationsToCSV(svsId, slotDocs) {

    const rows = [];

    // Header
    rows.push([
        "Date",
        "Weekday",
        "Role",
        "Time",
        "Player ID",
        "Ingame Name",
        "Alliance",
        "Reserved By"
    ]);

    slotDocs.forEach(slot => {

        const data = slot;

        const dateObj = new Date(data.day + "T00:00:00Z");
        const weekday = dateObj.toLocaleDateString("en-US", { weekday: "short" });

        const time = new Date(data.startTime.seconds * 1000)
            .toISOString()
            .substring(11, 16);

        const role = data.role
            ? data.role.replace(/_/g, " ").toUpperCase()
            : "";

        rows.push([
            data.day,
            weekday,
            role,
            time,
            data.playerId || "",
            data.ingameName || "",
            data.alliance || "",
            data.reservedBy || ""
        ]);
    });

    // Convert to CSV string
    const csvContent = rows
        .map(row => row.map(field =>
            `"${String(field).replace(/"/g, '""')}"`
        ).join(","))
        .join("\n");

    // Create download
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = `${svsId}_reservations.csv`;
    link.click();

    URL.revokeObjectURL(url);
}


/* ===================== INIT ===================== */
activateTab("alliances");

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const snap = await fetchUserByEmail(user.email);
    if (!snap.exists()) return;

    const profileBtn = document.getElementById("profileBtn");

    if (profileBtn) {
        profileBtn.classList.remove("hidden");
        profileBtn.onclick = () => {
            window.location.href = "profile.html";
        };
    }
});


async function loadHistory() {

    const historyContainer = document.getElementById("historyContainer");
    historyContainer.innerHTML = "";

    const completedList = await fetchCompletedSVS();

    if (!completedList.length) {
        historyContainer.innerHTML =
            `<div style="opacity:.6">No completed SVS found.</div>`;
        return;
    }

    completedList.forEach(data => {

        const svsId = data.id;

        const battleDate = data.battleDate
            ? data.battleDate.toISOString().substring(0, 10)
            : "-";

        const completedAt = data.completedAt
            ? data.completedAt.toISOString().substring(0, 10)
            : "-";

        const card = document.createElement("div");
        card.className = "history-card";

        card.innerHTML = `
            <div class="history-header">
                <div>
                    <strong>${battleDate}</strong> — ${data.opponentState}
                </div>
                <div>
                    Victor: ${data.victor || "-"}
                </div>
            </div>

            <div class="history-meta">
                Completed: ${completedAt}
            </div>

            <button class="secondary-btn view-history-btn">
                View Details
            </button>

            <div class="history-details hidden"></div>
        `;

        const btn = card.querySelector(".view-history-btn");
        const details = card.querySelector(".history-details");

        btn.onclick = async () => {

            if (!details.classList.contains("hidden")) {
                details.classList.add("hidden");
                details.innerHTML = "";
                return;
            }

            details.classList.remove("hidden");

            await renderHistoryDetails(svsId, details);
        };

        historyContainer.appendChild(card);
    });
}

async function renderHistoryDetails(svsId, containerEl) {

    containerEl.innerHTML = "Loading...";

    const result = await fetchSVSFullDetails(svsId);

    const { svs, prepPoints, reservations } = result;

    containerEl.innerHTML = "";

    /* ================= SUMMARY ================= */

    const summary = document.createElement("div");
    summary.className = "history-summary";

    summary.innerHTML = `
        <div><strong>Opponent:</strong> ${svs.opponentState}</div>
        <div><strong>Battle Date:</strong> ${svs.battleDate?.toISOString().substring(0, 10)}</div>
        <div><strong>Victor:</strong> ${svs.victor}</div>
    `;

    containerEl.appendChild(summary);

    /* ================= PREP POINTS ================= */

    const prepWrapper = document.createElement("div");
    prepWrapper.className = "history-prep";

    prepWrapper.innerHTML = `<h4>Prep Points</h4>`;

    prepPoints.forEach(d => {

        const weekday = d.date?.toLocaleDateString("en-US", { weekday: "short" });
        const dateStr = d.date?.toISOString().substring(0, 10);

        const row = document.createElement("div");
        row.className = "history-prep-row";

        row.innerHTML = `
            <div>${weekday} — ${dateStr}</div>
            <div>Self: ${d.selfPoints}</div>
            <div>Opponent: ${d.opponentPoints}</div>
        `;

        prepWrapper.appendChild(row);
    });

    containerEl.appendChild(prepWrapper);

    /* ================= RESERVATIONS ================= */

    const resWrapper = document.createElement("div");
    resWrapper.className = "history-reservations";

    resWrapper.innerHTML = `
        <div class="history-section-header">
            <h4>Reservations</h4>       
        </div>
    `;

    containerEl.appendChild(resWrapper);

    await renderReservationCalendar(
        svsId,
        reservations,
        resWrapper,
        true
    );
}


async function loadGlobalAudit() {

    const tableContainer = document.getElementById("auditTableContainer");
    const searchInput = document.getElementById("auditSearch");
    const actionFilter = document.getElementById("auditActionFilter");
    const severityFilter = document.getElementById("auditSeverityFilter");
    const dateFilter = document.getElementById("auditDateFilter");

    if (!tableContainer) return;

    tableContainer.innerHTML = `<div class="audit-loading">Loading...</div>`;

    const logs = await fetchAuditLogs();

    /* ================= PAGINATION STATE ================= */

    const PAGE_SIZE = 25;
    let currentPage = 1;
    let filteredLogs = [...logs];


    /* ================= FORMATTERS ================= */

    function formatTime(ts) {
        if (!ts) return "-";
        return ts.toLocaleString();
    }

    function formatAction(action) {

        const map = {
            admin_reserve: "Admin Reserved Slot",
            admin_cancel: "Admin Cancelled Slot",
            member_reserve: "Member Reserved Slot",
            member_cancel: "Member Cancelled Slot",
            profile_updated: "Profile Updated",
            profile_submitted: "Profile Submitted",
            user_approved: "User Approved",
            user_deleted: "User Deleted",
            alliance_created: "Alliance Created",
            alliance_updated: "Alliance Updated",
            invite_created: "Invite Created",
            invite_cancelled: "Invite Cancelled",
            victor_set: "Victor Set",
            prep_updated: "Prep Points Updated",
            svs_completed: "SVS Completed"
        };

        return map[action] || action;
    }

    function buildTypeBadge(type) {
        return `<span class="audit-badge type-${type}">
                    ${type ? type.toUpperCase() : "-"}
                </span>`;
    }

    function buildSeverityBadge(severity) {
        if (!severity) return "";
        return `<span class="audit-badge severity-${severity}">
                    ${severity.toUpperCase()}
                </span>`;
    }

    function buildDetails(d) {

        switch (d.entityType) {

            case "svs_reservation":
                return `
                    <div class="audit-details-block">
                        <div><strong>SVS:</strong> ${d.entityId || "-"}</div>
                        <div><strong>Slot:</strong> ${d.slotId || "-"}</div>
                        <div><strong>Player:</strong> ${d.ingameName || "-"} (${d.playerId || "-"})</div>
                        <div><strong>Alliance:</strong> ${d.alliance || "-"}</div>
                    </div>
                `;

            case "user":
                return `
                    <div class="audit-details-block">
                        <div><strong>Name:</strong> ${d.ingameName || "-"}</div>
                        <div><strong>ID:</strong> ${d.playerId || "-"}</div>
                        <div><strong>Email:</strong> ${d.entityId || "-"}</div>
                        <div><strong>Alliance:</strong> ${d.alliance || "-"}</div>
                    </div>
                `;

            case "alliance":
                return `
                    <div class="audit-details-block">
                        <div><strong>Alliance ID:</strong> ${d.entityId}</div>
                    </div>
                `;

            case "invite":
                return `
                    <div class="audit-details-block">
                        <div><strong>Email:</strong> ${d.entityId}</div>
                        <div><strong>Player ID:</strong> ${d.playerId || "-"}</div>
                    </div>
                `;

            case "svs":
                return `
                    <div class="audit-details-block">
                        <div><strong>SVS:</strong> ${d.entityId}</div>
                    </div>
                `;

            case "prep_points":
                return `
                    <div class="audit-details-block">
                        <div><strong>SVS:</strong> ${d.entityId}</div>
                        <div><strong>Date:</strong> ${d.dateId || "-"}</div>
                        <div><strong>Self:</strong> ${d.selfPoints ?? "-"}</div>
                        <div><strong>Opponent:</strong> ${d.opponentPoints ?? "-"}</div>
                    </div>
                `;

            default:
                return d.entityId || "-";
        }
    }

    /* ================= RENDER ================= */

    function renderPage() {

        const start = (currentPage - 1) * PAGE_SIZE;
        const end = start + PAGE_SIZE;
        const pageLogs = filteredLogs.slice(start, end);

        if (!pageLogs.length) {
            tableContainer.innerHTML =
            `<div class="audit-empty">
                <div class="empty-icon">📄</div>
                <div>No audit logs found</div>
            </div>`;
            return;
        }

        const table = document.createElement("table");
        table.className = "audit-table";

        table.innerHTML = `
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th>Action</th>
                    <th>Actor</th>
                </tr>
            </thead>
        <tbody></tbody>
        `;

    const tbody = table.querySelector("tbody");

        pageLogs.forEach(d => {

            const tr = document.createElement("tr");

        // Severity color
            if (d.severity) {
            tr.classList.add(`severity-${d.severity}`);
            }

        // Admin highlight
            if (d.role === "admin") {
            tr.classList.add("admin-log");
            }

            tr.innerHTML = `
            <td class="audit-time">
                ${formatTime(d.performedAt)}
            </td>

                <td>
                <span class="badge type-${d.entityType}">
                    ${d.entityType || "-"}
                </span>
            </td>

            <td class="audit-details">
                ${buildDetails(d)}
            </td>

            <td>
                <span class="badge action-badge">
                    ${formatAction(d.action)}
                </span>
                </td>

            <td class="audit-actor">
                    ${d.performedBy || "-"}
                    ${d.role === "admin"
                    ? `<span class="badge admin">ADMIN</span>`
                : ""}
                </td>
            `;

            tbody.appendChild(tr);
        });

        /* ================= PAGINATION UI ================= */

        const totalPages = Math.ceil(filteredLogs.length / PAGE_SIZE);

        const pagination = document.createElement("div");
        pagination.className = "audit-pagination";

        pagination.innerHTML = `
            <button class="secondary-btn" ${currentPage === 1 ? "disabled" : ""} id="auditPrev">
                ◀ Prev
            </button>

            <span class="audit-page-info">
                Page ${currentPage} of ${totalPages}
            </span>

            <button class="secondary-btn" ${currentPage >= totalPages ? "disabled" : ""} id="auditNext">
                Next ▶
            </button>
        `;

        tableContainer.innerHTML = "";
        tableContainer.appendChild(table);
        tableContainer.appendChild(pagination);

        document.getElementById("auditPrev").onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                renderPage();
            }
        };

        document.getElementById("auditNext").onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                renderPage();
            }
        };
    }

    /* ================= FILTERING ================= */

    function applyFilters() {

        const search = searchInput.value.toLowerCase();
        const action = actionFilter.value;
        const severity = severityFilter.value;
        const date = dateFilter.value;

        filteredLogs = logs.filter(d => {

            if (action && d.action !== action) return false;
            if (severity && d.severity !== severity) return false;

            if (date && d.performedAt) {
                const logDate = d.performedAt
                    .toISOString()
                    .substring(0, 10);
                if (logDate !== date) return false;
            }

            if (search) {
                const text = `
                    ${d.ingameName || ""}
                    ${d.playerId || ""}
                    ${d.entityId || ""}
                    ${d.action || ""}
                    ${d.entityType || ""}
                `.toLowerCase();

                if (!text.includes(search)) return false;
            }

            return true;
        });

        currentPage = 1; // reset page on filter
        renderPage();
    }

    /* ================= DYNAMIC ACTION FILTER ================= */

    const uniqueActions = [...new Set(logs.map(l => l.action).filter(Boolean))];

    actionFilter.innerHTML = `<option value="">All Actions</option>`;

    uniqueActions.sort().forEach(action => {
        const opt = document.createElement("option");
        opt.value = action;
        opt.textContent = formatAction(action);
        actionFilter.appendChild(opt);
    });

    searchInput.oninput = applyFilters;
    actionFilter.onchange = applyFilters;
    severityFilter.onchange = applyFilters;
    dateFilter.onchange = applyFilters;

    renderPage();
}


async function loadPlaceholders() {

    const container = document.getElementById("placeholderContainer");
    container.innerHTML = "Loading...";

    const users = await fetchPlaceholderUsers();

    if (!users.length) {
        container.innerHTML = `
            <div class="empty-state">
                No placeholder users found
            </div>
        `;
        return;
    }

    const table = document.createElement("table");
    table.className = "admin-table";

    table.innerHTML = `
        <thead>
            <tr>
                <th>Email</th>
                <th>Player ID</th>
                <th>Name</th>
                <th>Alliance</th>
                <th>Actions</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");

    users.forEach(u => {

        const tr = document.createElement("tr");

        tr.innerHTML = `
            <td>${u.email}</td>
            <td>${u.playerId}</td>
            <td>${u.ingameName}</td>
            <td>${u.alliance}</td>
            <td>
                <button class="secondary-btn edit-placeholder">
                    Edit
                </button>
                <button class="danger-btn delete-placeholder">
                    Delete
                </button>
            </td>
        `;

    /* ========= EDIT ========= */

    tr.querySelector(".edit-placeholder").onclick = () => {
        openEditModal({
            id: u.id,          // document id
            email: u.email,
            playerId: u.playerId,
            ingameName: u.ingameName,
            alliance: u.alliance,
            status: u.status || "approved",
            role: u.role || "member"
        });
    };

    /* ========= DELETE ========= */

        tr.querySelector(".delete-placeholder").onclick = async () => {

            openConfirmModal(
                "Delete Placeholder?",
                `Delete placeholder ${u.ingameName}? This will remove active reservations.`,
                async () => {
                    await deleteUserAndClearReservation(u.id);
                    showToast("Placeholder deleted", "success");
                    loadPlaceholders();
                }
            );
        };

        tbody.appendChild(tr);
    });

    container.innerHTML = "";
    container.appendChild(table);
}

let currentReserveContext = null;

function openReserveModal(svsId, slotId) {

    currentReserveContext = { svsId, slotId };

    document.getElementById("reservePlayerId").value = "";
    document.getElementById("reserveIngameName").value = "";
    document.getElementById("reserveAlliance").value = "";

    document.getElementById("reserveExtraFields").classList.add("hidden");

    document.getElementById("reserveModal").classList.add("active");
}

function initReserveModal() {

    const cancelBtn = document.getElementById("cancelReserveBtn");
    const confirmBtn = document.getElementById("confirmReserveBtn");

    if (!cancelBtn || !confirmBtn) return;

    cancelBtn.addEventListener("click", () => {
        document.getElementById("reserveModal")
            .classList.remove("active");
    });

    confirmBtn.addEventListener("click", handleReserveConfirm);
}

initReserveModal();

async function handleReserveConfirm() {

    const playerId = document.getElementById("reservePlayerId").value.trim();
    const ingameName = document.getElementById("reserveIngameName").value.trim();
    const alliance = document.getElementById("reserveAlliance").value.trim();

    if (!playerId) {
        showToast("Player ID required", "error");
        return;
    }

    try {

        await adminReserveSlot(
            currentReserveContext.svsId,
            currentReserveContext.slotId,
            playerId,
            null,
            null
        );

        document.getElementById("reserveModal").classList.remove("active");
        showToast("Reserved successfully", "success");
        await loadSVSPanel();

    } catch (err) {

        // If placeholder required
        if (err.message.includes("Ingame name")) {

            document.getElementById("reserveExtraFields")
                .classList.remove("hidden");

            if (!ingameName || !alliance) {
                showToast("Ingame name & alliance required", "error");
                return;
            }

            try {
                await adminReserveSlot(
                    currentReserveContext.svsId,
                    currentReserveContext.slotId,
                    playerId,
                    ingameName,
                    alliance
                );

                document.getElementById("reserveModal").classList.remove("active");
                showToast("Reserved successfully", "success");
                await loadSVSPanel();

            } catch (e2) {
                showToast(e2.message, "error");
            }
        } else {
            showToast(err.message, "error");
        }
    }
}




let confirmCallback = null;

function openConfirmModal(title, message, onConfirm) {

    confirmCallback = onConfirm;

    const modal = document.getElementById("confirmModal");
    const titleEl = document.getElementById("confirmTitle");
    const messageEl = document.getElementById("confirmMessage");

    if (!modal || !titleEl || !messageEl) return;

    titleEl.innerText = title;
    messageEl.innerText = message;

    modal.classList.add("active");
}

/* ================= CONFIRM MODAL INIT ================= */

function initConfirmModal() {

    const modal = document.getElementById("confirmModal");
    const noBtn = document.getElementById("confirmNoBtn");
    const yesBtn = document.getElementById("confirmYesBtn");

    if (!modal || !noBtn || !yesBtn) return;

    noBtn.addEventListener("click", () => {
        modal.classList.remove("active");
        confirmCallback = null;
    });

    yesBtn.addEventListener("click", async () => {

        if (confirmCallback) {
            await confirmCallback();
        }

        confirmCallback = null;
        modal.classList.remove("active");
    });
}

/* CALL IT IMMEDIATELY */
initConfirmModal();
