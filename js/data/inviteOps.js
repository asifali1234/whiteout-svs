// data/inviteOps.js — Firestore operations for invites (data layer)

import { db, auth } from "../lib/firebase.js";
import {
    doc,
    setDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    serverTimestamp,
    runTransaction,
    getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { validatePlayerIdClaim } from "./idGuard.js";
import { logAudit } from "./auditOps.js";


/* =====================================================
   CREATE INVITE (UNIQUE PER EMAIL)
===================================================== */
export async function createInvite({email, playerId, ingameName, alliance}) {

    if (!/^\d+$/.test(playerId)) {
        throw new Error("Player ID must be numeric.");
    }

    /* =====================================================
       GLOBAL PLAYER ID OWNERSHIP CHECK
    ===================================================== */

    const idValidation = await validatePlayerIdClaim(playerId, "invite-create");

    if (!idValidation.allowed) {
        if (idValidation.reason === "already-claimed") {
            throw new Error("This Player ID is already registered.");
        }

        if (idValidation.reason === "reserved-placeholder") {
            throw new Error("This Player ID is reserved.");
        }
    }

    /* =====================================================
       1️⃣ BLOCK IF USER ALREADY EXISTS (approved/pending)
    ===================================================== */

    const userRef = doc(db, "users", email);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
        const userData = userSnap.data();

        if (userData.status === "approved") {
            throw new Error("User is already approved.");
        }

        if (userData.status === "pending") {
            throw new Error("User is already pending approval.");
        }

        // If user has already completed profile but status weird
        if (userData.playerId || userData.ingameName || userData.alliance) {
            throw new Error("User already has profile data.");
        }
    }

    /* =====================================================
       2️⃣ BLOCK DUPLICATE PLAYER ID INVITES
    ===================================================== */

    const existingSnap = await getDocs(
        query(
            collection(db, "invites"),
            where("playerId", "==", playerId),
            where("used", "==", false),
            where("cancelled", "==", false)
        )
    );

    if (!existingSnap.empty) {
        throw new Error("Active invite already exists for this Player ID.");
    }

    /* =====================================================
       3️⃣ BLOCK DUPLICATE EMAIL INVITES
    ===================================================== */

    const inviteRef = doc(db, "invites", email);

    // Check if active invite already exists
    const existing = await getDoc(inviteRef);

    if (existing.exists()) {
        const data = existing.data();

        if (!data.used && !data.cancelled) {
            throw new Error("Active invite already exists for this email.");
        }
    }

    /* =====================================================
       4️⃣ CREATE INVITE
    ===================================================== */

    const payload = {
        email,
        playerId,
        ingameName,
        alliance,
        invitedBy: auth.currentUser ? auth.currentUser.email : null,
        used: false,
        cancelled: false,
        createdAt: serverTimestamp()
    };

    await setDoc(inviteRef, payload);

    await logAudit({
        entityType: "invite",
        entityId: email,
        action: "invite_created",
        playerId,
        ingameName,
        alliance,
        role: "admin",
        severity: "info"
    });


    return email; // document ID is email
}

/* =====================================================
   CANCEL INVITE
===================================================== */

export async function cancelInvite(inviteId) {
    await updateDoc(doc(db, "invites", inviteId), {
        cancelled: true
    });
    await logAudit({
        entityType: "invite",
        entityId: inviteId,
        action: "invite_cancelled",
        role: "admin",
        severity: "warning"
    });

}

/* =====================================================
   FETCH ACTIVE INVITES
===================================================== */
export async function fetchActiveInvites() {
    const snap = await getDocs(
        query(
            collection(db, "invites"),
            where("used", "==", false),
            where("cancelled", "==", false)
        )
    );

    return snap.docs.map(d => ({
        id: d.id,   // now this IS the email
        ...d.data()
    }));
}

/* =====================================================
   TRANSACTION-SAFE INVITE ACCEPTANCE
===================================================== */

export async function acceptInviteIfExists(identifier) {

    const inviteRef = doc(db, "invites", identifier);
    const userRef = doc(db, "users", identifier);

    try {

        let accepted = false;

        await runTransaction(db, async (transaction) => {

            const inviteSnap = await transaction.get(inviteRef);

            if (!inviteSnap.exists()) return;

            const inviteData = inviteSnap.data();

            if (inviteData.used || inviteData.cancelled) return;

            const existingUserSnap = await transaction.get(userRef);

            if (existingUserSnap.exists()) {
                const existingData = existingUserSnap.data();

                // If placeholder, convert it
                if (existingData.isPlaceholder === true) {
                    transaction.update(userRef, {
                        role: "member",
                        playerId: inviteData.playerId,
                        ingameName: inviteData.ingameName,
                        alliance: inviteData.alliance,
                        status: "approved",
                        isPlaceholder: false,
                        authLinked: true
                    });
                } else {
                    // Existing real user — just update fields
                    transaction.update(userRef, {
                        playerId: inviteData.playerId,
                        ingameName: inviteData.ingameName,
                        alliance: inviteData.alliance,
                        status: "approved"
                    });
                }

            } else {

                // Create fresh user doc
                transaction.set(userRef, {
                    email: identifier,
                    role: "member",
                    playerId: inviteData.playerId,
                    ingameName: inviteData.ingameName,
                    alliance: inviteData.alliance,
                    status: "approved",
                    isPlaceholder: false,
                    authLinked: true
                });
            }

            // Mark invite used
            transaction.update(inviteRef, {
                used: true
            });

            accepted = true;
        });

        return accepted;

    } catch (e) {
        console.error("Invite transaction failed:", e);
        throw e;
    }
}
