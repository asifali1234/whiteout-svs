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

/* =====================================================
   CREATE INVITE (UNIQUE PER EMAIL)
===================================================== */
export async function createInvite({email, playerId, ingameName, alliance}) {

    const inviteRef = doc(db, "invites", email);

    // Check if active invite already exists
    const existing = await getDoc(inviteRef);

    if (existing.exists()) {
        const data = existing.data();

        if (!data.used && !data.cancelled) {
            throw new Error("Active invite already exists for this email.");
        }
    }

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

    return email; // document ID is email
}

/* =====================================================
   CANCEL INVITE
===================================================== */

export async function cancelInvite(inviteId) {
    await updateDoc(doc(db, "invites", inviteId), {
        cancelled: true
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

            // Update user atomically
            transaction.set(userRef, {
                email: identifier,
                role: "member",
                playerId: inviteData.playerId,
                ingameName: inviteData.ingameName,
                alliance: inviteData.alliance,
                status: "approved"
            }, { merge: true });

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
