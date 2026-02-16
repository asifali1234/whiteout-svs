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

export async function fetchUsersByStatus(status) {
    const snap = await getDocs(query(collection(db, "users"), where("status", "==", status)));
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

export async function approveUser(userId) {
    await updateDoc(doc(db, "users", userId), { status: "approved" });
}

export async function updateUser(userId, data) {
    await updateDoc(doc(db, "users", userId), data);
}

export async function deleteUser(userId) {
    await deleteDoc(doc(db, "users", userId));
}

export async function fetchUserByEmail(email) {
    return await getDoc(doc(db, "users", email));
}

export async function UpdateProfileOnApproval(email, ingameName, alliance) {
    await updateDoc(doc(db, "users", email), {
        ingameName: ingameName,
        alliance: alliance
    });
}

export async function UpdateUserToPending(email, playerId, ingameName, alliance) {
    await updateDoc(doc(db, "users", email), {
        playerId: playerId,
        ingameName: ingameName,
        alliance: alliance,
        status: "pending"
    });
}
