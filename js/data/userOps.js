// data/userOps.js — Firestore operations for user documents
import {db} from "../lib/firebase.js";
import {
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    updateDoc,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { validatePlayerIdClaim } from "./idGuard.js";
import { logAudit } from "./auditOps.js";



export async function fetchUsersByStatus(status) {
    const snap = await getDocs(query(collection(db, "users"), where("status", "==", status)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveUser(userId) {

    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};

    await updateDoc(ref, { status: "approved" });

    await logAudit({
        entityType: "user",
        entityId: userId,
        action: "user_approved",
        details: {
            playerId: data.playerId || null,
            ingameName: data.ingameName || null,
            alliance: data.alliance || null
        }
    });
}


export async function updateUser(userId, data) {

    const ref = doc(db, "users", userId);

    const beforeSnap = await getDoc(ref);
    const beforeData = beforeSnap.exists() ? beforeSnap.data() : {};

    await updateDoc(ref, data);

    const afterSnap = await getDoc(ref);
    const afterData = afterSnap.exists() ? afterSnap.data() : {};

    await logAudit({
        entityType: "user",
        entityId: userId,
        action: "profile_updated",
        role: "admin",
        details: {
            playerId: afterData.playerId || beforeData.playerId || null,
            ingameName: afterData.ingameName || beforeData.ingameName || null,
            alliance: afterData.alliance || beforeData.alliance || null
        }
    });
}


async function deleteUser(userId) {

    const ref = doc(db, "users", userId);
    const snap = await getDoc(ref);

    let snapshotData = {};

    if (snap.exists()) {
        snapshotData = snap.data();
    }

    await deleteDoc(ref);

    await logAudit({
        entityType: "user",
        entityId: userId,
        action: "user_deleted",
        role: "admin",
        details: {
            playerId: snapshotData.playerId || null,
            ingameName: snapshotData.ingameName || null,
            alliance: snapshotData.alliance || null
        }
    });
}


export async function fetchUserByEmail(email) {
    return await getDoc(doc(db, "users", email));
}

export async function UpdateProfileOnApproval(email, ingameName, alliance) {
    await updateDoc(doc(db, "users", email), {
        ingameName: ingameName,
        alliance: alliance
    });

    await logAudit({
        entityType: "user",
        entityId: email,
        action: "profile_updated",
        ingameName,
        alliance,
        role: "member",
        severity: "info"
    });


}

export async function UpdateUserToPending(email, playerId, ingameName, alliance) {

    if (!/^\d+$/.test(playerId)) {
        throw new Error("Player ID must be numeric.");
    }

    const validation = await validatePlayerIdClaim(playerId, "google-profile");

    if (!validation.allowed) {

        if (validation.reason === "already-claimed") {
            throw new Error("This Player ID is already registered.");
        }

        if (validation.reason === "reserved-placeholder") {
            throw new Error("This Player ID is reserved.");
        }

        throw new Error("Invalid Player ID.");
    }

    await updateDoc(doc(db, "users", email), {
        playerId: playerId,
        ingameName: ingameName,
        alliance: alliance,
        status: "pending"
    });



}

export async function fetchPlaceholderUsers() {
    const snap = await getDocs(
        query(
            collection(db, "users"),
            where("isPlaceholder", "==", true)
        )
    );

    return snap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));
}
