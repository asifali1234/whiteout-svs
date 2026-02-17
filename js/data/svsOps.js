// data/svsOps.js
// Production-safe SVS operations layer

import {auth, db} from "../lib/firebase.js";
import {
    collection,
    doc,
    getDoc,
    getDocs,
    orderBy,
    query,
    runTransaction,
    serverTimestamp,
    Timestamp,
    where,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {logAudit} from "./auditOps.js";


/* =====================================================
   HELPERS
===================================================== */

function formatDateId(date) {
    return date.toISOString().split("T")[0];
}

function generateSvsId(battleDate) {
    const d = battleDate.toISOString().split("T")[0].replace(/-/g, "_");
    return `svs_${d}`;
}

function getPrepDates(battleDate) {
    // Monday–Friday before Saturday battle
    const dates = [];
    for (let i = 5; i >= 1; i--) {
        const d = new Date(battleDate);
        d.setUTCDate(d.getUTCDate() - i);
        dates.push(new Date(d));
    }
    return dates;
}

function getRoleForWeekday(weekday) {
    if (weekday === 1) return "vice_president"; // Monday
    if (weekday === 2) return "vice_president"; // Tuesday
    if (weekday === 4) return "minister_of_education"; // Thursday
    return null;
}

/* =====================================================
   CREATE SVS (Atomic with control doc)
===================================================== */

export async function createSVS({opponentState, battleDate}) {
    const svsId = generateSvsId(battleDate);

    const svsRef = doc(db, "svs", svsId);
    const controlRef = doc(db, "svsMeta", "control");

    await runTransaction(db, async (tx) => {
        const controlSnap = await tx.get(controlRef);

        if (!controlSnap.exists()) {
            throw new Error("SVS control document missing.");
        }

        if (controlSnap.data().status !== "none") {
            throw new Error("Active SVS already exists.");
        }

        tx.set(svsRef, {
            opponentState,
            battleDate: Timestamp.fromDate(battleDate),
            status: "active",
            victor: null,
            createdAt: serverTimestamp(),
            completedAt: null
        });

        tx.update(controlRef, {
            activeSvsId: svsId,
            status: "active"
        });
    });

    return svsId;
}

/* =====================================================
   COMPLETE SVS (Atomic Freeze)
===================================================== */

export async function completeSVS(svsId) {

    const svsRef = doc(db, "svs", svsId);
    const controlRef = doc(db, "svsMeta", "control");
    const prepCollection = collection(db, "svs", svsId, "prepPoints");

    await runTransaction(db, async (tx) => {

        const svsSnap = await tx.get(svsRef);
        if (!svsSnap.exists()) throw new Error("SVS not found.");

        const data = svsSnap.data();

        if (data.status !== "active") {
            throw new Error("SVS already completed.");
        }

        const now = new Date();
        const battleDate = data.battleDate.toDate();

        if (now < battleDate) {
            throw new Error("Cannot complete before battle date.");
        }

        if (!data.victor) {
            throw new Error("Victor must be set before completion.");
        }

        // Optional: Ensure prep points exist
        const prepSnap = await getDocs(prepCollection);
        if (prepSnap.empty) {
            throw new Error("Prep points missing.");
        }

        tx.update(svsRef, {
            status: "completed",
            completedAt: serverTimestamp()
        });

        tx.update(controlRef, {
            activeSvsId: null,
            status: "none"
        });

        await logAudit({
            entityType: "svs",
            entityId: svsId,
            action: "svs_completed",
            role: "admin",
            severity: "critical"
        });

    });


}


/* =====================================================
   GENERATE PREP POINT DOCS
===================================================== */

export async function initializePrepPoints(svsId, battleDate) {
    const prepDates = getPrepDates(battleDate);

    const batch = writeBatch(db);

    prepDates.forEach(date => {
        const id = formatDateId(date);
        const weekday = date.getUTCDay(); // 0=Sun

        const ref = doc(db, "svs", svsId, "prepPoints", id);

        batch.set(ref, {
            date: Timestamp.fromDate(date),
            weekday,
            selfPoints: 0,
            opponentPoints: 0,
            updatedAt: serverTimestamp()
        });
    });

    await batch.commit();
}

/* =====================================================
   GENERATE RESERVATION SLOTS
===================================================== */

export async function generateSlots(svsId, battleDate) {
    const prepDates = getPrepDates(battleDate);

    const batch = writeBatch(db);

    prepDates.forEach(date => {
        const weekday = date.getUTCDay();
        const role = getRoleForWeekday(weekday);
        if (!role) return;

        for (let i = 0; i < 48; i++) {
            const start = new Date(date);
            start.setUTCHours(0, 0, 0, 0);
            start.setUTCMinutes(i * 30);

            const end = new Date(start);
            end.setUTCMinutes(start.getUTCMinutes() + 30);

            const slotId = `${formatDateId(date)}_${role}_${start
                .toISOString()
                .substring(11, 16)}`;

            const slotRef = doc(db, "svs", svsId, "reservations", slotId);

            batch.set(slotRef, {
                day: formatDateId(date),
                role,
                startTime: Timestamp.fromDate(start),
                endTime: Timestamp.fromDate(end),
                reservedBy: null,
                playerId: null,
                ingameName: null,
                createdAt: null,
                updatedAt: null
            });
        }
    });

    await batch.commit();
}

/* =====================================================
   UPDATE PREP POINTS
===================================================== */

export async function updatePrepPoints(svsId, dateId, selfPoints, opponentPoints) {

    const svsRef = doc(db, "svs", svsId);
    const prepRef = doc(db, "svs", svsId, "prepPoints", dateId);

    await runTransaction(db, async (tx) => {

        const svsSnap = await tx.get(svsRef);
        if (!svsSnap.exists()) throw new Error("SVS not found.");

        const svsData = svsSnap.data();

        if (svsData.status !== "active") {
            throw new Error("Cannot update points after completion.");
        }

        tx.update(prepRef, {
            selfPoints,
            opponentPoints,
            updatedAt: serverTimestamp()
        });

        await logAudit({
            entityType: "prep_points",
            entityId: svsId,
            action: "prep_updated",
            role: "admin",
            severity: "info",
            details: {
                dateId,
                selfPoints,
                opponentPoints
            }
        });


    });

}

export async function setVictor(svsId, victor) {

    if (!["self", "opponent"].includes(victor)) {
        throw new Error("Invalid victor.");
    }

    const svsRef = doc(db, "svs", svsId);

    await runTransaction(db, async (tx) => {

        const snap = await tx.get(svsRef);
        if (!snap.exists()) throw new Error("SVS not found.");

        const data = snap.data();

        if (data.status !== "active") {
            throw new Error("Cannot set victor after completion.");
        }

        const now = new Date();
        const battleDate = data.battleDate.toDate();

        if (now < battleDate) {
            throw new Error("Cannot set victor before battle date.");
        }

        tx.update(svsRef, {
            victor
        });

        await logAudit({
            entityType: "svs",
            entityId: svsId,
            action: "victor_set",
            role: "admin",
            severity: "info",
            details: {victor}
        });


    });

}


/* =====================================================
   BOOK SLOT (Atomic)
===================================================== */


/* =====================================================
   BOOK SLOT (Atomic)
===================================================== */

export async function bookSlot(svsId, slotId) {

    const slotRef = doc(db, "svs", svsId, "reservations", slotId);

    await runTransaction(db, async (tx) => {

        const slotSnap = await tx.get(slotRef);
        if (!slotSnap.exists()) throw new Error("Slot not found.");

        const slotData = slotSnap.data();

        if (slotData.reservedBy !== null) {
            throw new Error("Slot already reserved.");
        }

        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated.");

        const userRef = doc(db, "users", user.email);
        const userSnap = await tx.get(userRef);

        if (!userSnap.exists()) {
            throw new Error("Profile not found.");
        }

        const profile = userSnap.data();

        // Prevent multiple bookings same day
        const reservationsQuery = query(
            collection(db, "svs", svsId, "reservations"),
            where("day", "==", slotData.day),
            where("reservedBy", "==", user.email)
        );

        const existing = await getDocs(reservationsQuery);
        if (!existing.empty) {
            throw new Error("You already have a reservation for this day.");
        }

        tx.update(slotRef, {
            reservedBy: user.email,
            playerId: profile.playerId,
            ingameName: profile.ingameName,
            alliance: profile.alliance,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

    });

    // 🔥 Audit outside transaction
    await logAudit({
        entityType: "svs_reservation",
        entityId: svsId,
        action: "member_reserve",
        role: "member",
        severity: "info",
        details: { slotId }
    });
}




export async function cancelAndRebookSlot(
    svsId,
    oldSlotId,
    newSlotId,
    userData
) {

    const oldSlotRef = doc(db, "svs", svsId, "reservations", oldSlotId);
    const newSlotRef = doc(db, "svs", svsId, "reservations", newSlotId);

    await runTransaction(db, async (tx) => {

        const oldSnap = await tx.get(oldSlotRef);
        const newSnap = await tx.get(newSlotRef);

        if (!oldSnap.exists() || !newSnap.exists()) {
            throw new Error("Slot not found.");
        }

        const newData = newSnap.data();

        if (newData.reservedBy !== null) {
            throw new Error("New slot already reserved.");
        }

        // 1️⃣ Cancel old slot
        tx.update(oldSlotRef, {
            reservedBy: null,
            playerId: null,
            ingameName: null,
            alliance: null,
            updatedAt: serverTimestamp()
        });

        // 2️⃣ Book new slot
        tx.update(newSlotRef, {
            reservedBy: userData.email,
            playerId: userData.playerId,
            ingameName: userData.ingameName,
            alliance: userData.alliance,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

    });

}


/* =====================================================
   DELETE OWN RESERVATION
===================================================== */

export async function cancelSlot(svsId, slotId) {

    const slotRef = doc(db, "svs", svsId, "reservations", slotId);

    let cancelledData = null; // 👈 store for audit

    await runTransaction(db, async (tx) => {

        const snap = await tx.get(slotRef);
        if (!snap.exists()) throw new Error("Slot not found.");

        const data = snap.data();

        if (!data.reservedBy) {
            throw new Error("Slot already free.");
        }

        const user = auth.currentUser;
        if (!user) throw new Error("Not authenticated.");

        if (data.reservedBy !== user.email) {
            throw new Error("You can only cancel your own reservation.");
        }

        // 👇 Save BEFORE clearing
        cancelledData = {
            playerId: data.playerId,
            ingameName: data.ingameName,
            alliance: data.alliance
        };

        tx.update(slotRef, {
            reservedBy: null,
            playerId: null,
            ingameName: null,
            alliance: null,
            updatedAt: serverTimestamp()
        });
    });

    // 🔥 Audit AFTER transaction succeeds
    if (cancelledData) {
        await logAudit({
            entityType: "svs_reservation",
            entityId: svsId,
            action: "member_cancel",
            playerId: cancelledData.playerId,
            ingameName: cancelledData.ingameName,
            alliance: cancelledData.alliance,
            role: "member",
            severity: "warning",
            details: { slotId }
        });
    }
}



/* =====================================================
   ADMIN RESERVE SLOT (Atomic + Placeholder Safe)
===================================================== */

export async function adminReserveSlot(
    svsId,
    slotId,
    playerId,
    ingameNameInput,
    allianceInput
) {

    if (!/^\d+$/.test(playerId)) {
        throw new Error("Player ID must be numeric.");
    }

    const slotRef = doc(db, "svs", svsId, "reservations", slotId);
    const usersCollection = collection(db, "users");

    await runTransaction(db, async (tx) => {

        // 1️⃣ Get slot
        const slotSnap = await tx.get(slotRef);
        if (!slotSnap.exists()) {
            throw new Error("Slot not found.");
        }

        const slotData = slotSnap.data();

        if (slotData.reservedBy !== null) {
            throw new Error("Slot already reserved.");
        }

        // 2️⃣ Find user by playerId
        const userQuery = query(
            usersCollection,
            where("playerId", "==", playerId)
        );

        const userSnap = await getDocs(userQuery);

        let userEmail;
        let ingameName;
        let alliance;

        if (userSnap.empty) {

            // Placeholder must be created
            if (!ingameNameInput || !allianceInput) {
                throw new Error("Ingame name and alliance required for new placeholder.");
            }

            userEmail = `${playerId}@whiteout.local`;
            ingameName = ingameNameInput;
            alliance = allianceInput;

            const userRef = doc(db, "users", userEmail);

            tx.set(userRef, {
                email: userEmail,
                role: "member",
                playerId: playerId,
                ingameName: ingameName,
                alliance: alliance,
                status: "approved",
                isPlaceholder: true,
                authLinked: false,
                createdByAdmin: true
            });

        } else {

            if (userSnap.docs.length > 1) {
                throw new Error("Data integrity error: duplicate Player IDs.");
            }

            const userDoc = userSnap.docs[0];
            const userData = userDoc.data();

            userEmail = userDoc.id;
            ingameName = userData.ingameName;
            alliance = userData.alliance;

            if (!ingameName || !alliance) {
                throw new Error("Existing user profile incomplete.");
            }
        }

        // 3️⃣ Ensure user has no existing reservation same day
        const reservationQuery = query(
            collection(db, "svs", svsId, "reservations"),
            where("day", "==", slotData.day),
            where("reservedBy", "==", userEmail)
        );

        const existingReservation = await getDocs(reservationQuery);

        if (!existingReservation.empty) {
            throw new Error("User already has a reservation for this day.");
        }

        // 4️⃣ Assign slot
        tx.update(slotRef, {
            reservedBy: userEmail,
            playerId: playerId,
            ingameName: ingameName,
            alliance: allianceInput || alliance || null,
            updatedAt: serverTimestamp(),
            createdAt: serverTimestamp()
        });

        await logAudit({
            entityType: "svs_reservation",
            entityId: svsId,
            action: "admin_reserve",
            playerId,
            ingameName,
            alliance: allianceInput || alliance,
            role: "admin",
            severity: "info",
            details: {slotId}
        });

    });
}

export async function adminCancelSlot(svsId, slotId) {

    const slotRef = doc(db, "svs", svsId, "reservations", slotId);

    try {

        await runTransaction(db, async (tx) => {

            const snap = await tx.get(slotRef);
            if (!snap.exists()) throw new Error("Slot not found.");

            const data = snap.data();

            if (!data.reservedBy) {
                throw new Error("Slot already free.");
            }

            tx.update(slotRef, {
                reservedBy: null,
                playerId: null,
                ingameName: null,
                alliance: null,
                updatedAt: serverTimestamp()
            });

            await logAudit({
                entityType: "svs_reservation",
                entityId: svsId,
                action: "admin_cancel",
                severity: "warning",
                role: "admin",
                details: {
                    slotId,
                    playerId: data.playerId,
                    ingameName: data.ingameName,
                    alliance: data.alliance
                }
            });


        });

    } catch (error) {
        console.error("Error cancelling reservation:", error);
        throw error;
    }
}

/* =====================================================
   FETCH COMPLETED SVS LIST
===================================================== */

export async function fetchCompletedSVS() {

    const snap = await getDocs(
        query(
            collection(db, "svs"),
            where("status", "==", "completed"),
            orderBy("completedAt", "desc")
        )
    );

    return snap.docs.map(docSnap => {
        const data = docSnap.data();

        return {
            id: docSnap.id,
            opponentState: data.opponentState,
            battleDate: data.battleDate?.toDate() || null,
            completedAt: data.completedAt?.toDate() || null,
            victor: data.victor || null
        };
    });
}

/* =====================================================
   FETCH PREP POINTS
===================================================== */

export async function fetchPrepPoints(svsId) {

    const snap = await getDocs(
        query(
            collection(db, "svs", svsId, "prepPoints"),
            orderBy("date")
        )
    );

    return snap.docs.map(docSnap => {
        const data = docSnap.data();

        return {
            id: docSnap.id,
            date: data.date?.toDate() || null,
            weekday: data.weekday,
            selfPoints: data.selfPoints || 0,
            opponentPoints: data.opponentPoints || 0
        };
    });
}

/* =====================================================
   FETCH RESERVATIONS
===================================================== */

export async function fetchReservations(svsId) {

    const snap = await getDocs(
        query(
            collection(db, "svs", svsId, "reservations"),
            orderBy("startTime")
        )
    );

    return snap.docs.map(docSnap => {
        const data = docSnap.data();

        return {
            id: docSnap.id,
            ...data,
            startTime: data.startTime?.toDate() || null,
            endTime: data.endTime?.toDate() || null
        };
    });
}

/* =====================================================
   FETCH ACTIVE SVS (CONTROL + DATA)
===================================================== */

export async function fetchActiveSVS() {

    const controlRef = doc(db, "svsMeta", "control");
    const controlSnap = await getDoc(controlRef);

    if (!controlSnap.exists()) {
        return {active: false};
    }

    const controlData = controlSnap.data();

    if (controlData.status !== "active" || !controlData.activeSvsId) {
        return {active: false};
    }

    const svsRef = doc(db, "svs", controlData.activeSvsId);
    const svsSnap = await getDoc(svsRef);

    if (!svsSnap.exists()) {
        return {active: false};
    }

    const data = svsSnap.data();

    return {
        active: true,
        id: svsSnap.id,
        opponentState: data.opponentState,
        battleDate: data.battleDate?.toDate() || null,
        status: data.status,
        victor: data.victor,
        completedAt: data.completedAt?.toDate() || null
    };
}

/* =====================================================
   FETCH FULL SVS DETAILS (HISTORY VIEW)
===================================================== */

export async function fetchSVSFullDetails(svsId) {

    const svsRef = doc(db, "svs", svsId);
    const svsSnap = await getDoc(svsRef);

    if (!svsSnap.exists()) {
        throw new Error("SVS not found");
    }

    const svsData = svsSnap.data();

    const prepSnap = await getDocs(
        collection(db, "svs", svsId, "prepPoints")
    );

    const reservationsSnap = await getDocs(
        query(
            collection(db, "svs", svsId, "reservations"),
            orderBy("startTime")
        )
    );

    return {
        svs: {
            id: svsId,
            opponentState: svsData.opponentState,
            battleDate: svsData.battleDate?.toDate() || null,
            victor: svsData.victor,
            status: svsData.status,
            completedAt: svsData.completedAt?.toDate() || null
        },
        prepPoints: prepSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            date: d.data().date?.toDate() || null
        })),
        reservations: reservationsSnap.docs.map(d => ({
            id: d.id,
            ...d.data(),
            startTime: d.data().startTime?.toDate() || null
        }))
    };
}


export async function deleteUserAndClearReservation(userId) {

    const controlSnap = await getDoc(doc(db, "svsMeta", "control"));

    const activeSvsId = controlSnap.exists()
        ? controlSnap.data().activeSvsId
        : null;

    await runTransaction(db, async (tx) => {

        const userRef = doc(db, "users", userId);

        // 1️⃣ Delete reservation if active SVS exists
        if (activeSvsId) {

            const reservationsQuery = query(
                collection(db, "svs", activeSvsId, "reservations"),
                where("reservedBy", "==", userId)
            );

            const reservationsSnap = await getDocs(reservationsQuery);

            reservationsSnap.forEach(resDoc => {

                tx.update(resDoc.ref, {
                    reservedBy: null,
                    playerId: null,
                    ingameName: null,
                    alliance: null,
                    updatedAt: serverTimestamp()
                });

            });
        }

        // 2️⃣ Delete user document
        tx.delete(userRef);
    });

    await logAudit({
        entityType: "user",
        entityId: userId,
        action: "user_deleted",
        severity: "warning"
    });
}
