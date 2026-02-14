// data/inviteOps.js — Firestore operations for invites (data layer)
import { db, auth } from "../lib/firebase.js";
import { addDoc, collection, updateDoc, doc, serverTimestamp, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export async function createInvite({ email, playerId, ingameName, alliance }) {
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

    const ref = await addDoc(collection(db, "invites"), payload);
    return ref.id;
}

export async function cancelInvite(inviteId) {
    await updateDoc(doc(db, "invites", inviteId), { cancelled: true });
}

export async function fetchActiveInvites() {
    const snap = await getDocs(
        query(
            collection(db, "invites"),
            where("used", "==", false),
            where("cancelled", "==", false)
        )
    );

    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

