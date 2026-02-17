// data/auditOps.js

import { db, auth } from "../lib/firebase.js";
import {
    collection,
    collectionGroup,
    addDoc,
    getDocs,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import {
    limit,
    startAfter,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* =====================================================
   CREATE AUDIT ENTRY
===================================================== */

export async function logAudit({
                                   entityType,
                                   entityId = null,
                                   action,
                                   playerId = null,
                                   ingameName = null,
                                   alliance = null,
                                   role = null,
                                   severity = "info",
                                   details = {}
                               }) {

    if (!auth.currentUser) return;

    await addDoc(collection(db, "auditLogs"), {
        entityType,
        entityId,
        action,

        // Snapshot fields
        playerId,
        ingameName,
        alliance,
        severity,

        performedBy: auth.currentUser.email,
        role: auth.currentUser.email?.includes("@whiteout.local")
            ? "member"
            : "admin",
        performedAt: serverTimestamp(),
        ...details
    });
}


/* =====================================================
   FETCH GLOBAL AUDIT LOGS
   - Handles Firestore query
   - Converts timestamps
   - Returns clean JS objects
===================================================== */


const PAGE_SIZE = 25;

export async function fetchAuditPage(lastDoc = null) {

    let q = query(
        collectionGroup(db, "auditLogs"),
        orderBy("performedAt", "desc"),
        limit(PAGE_SIZE)
    );

    if (lastDoc) {
        q = query(
            collectionGroup(db, "auditLogs"),
            orderBy("performedAt", "desc"),
            startAfter(lastDoc),
            limit(PAGE_SIZE)
        );
    }

    const snap = await getDocs(q);

    const docs = snap.docs.map(d => ({
        id: d.id,
        ...d.data(),
        performedAt: d.data().performedAt?.toDate() || null
    }));

    return {
        logs: docs,
        lastDoc: snap.docs[snap.docs.length - 1] || null
    };
}


export async function fetchAuditLogs() {

    const snap = await getDocs(
        query(
            collectionGroup(db, "auditLogs"),
            orderBy("performedAt", "desc")
        )
    );

    return snap.docs.map(docSnap => {

        const data = docSnap.data();

        return {
            id: docSnap.id,
            entityType: data.entityType || null,
            entityId: data.entityId || null,
            action: data.action || null,
            severity: data.severity || "info",
            performedBy: data.performedBy || null,
            role: data.role || null,
            ingameName: data.ingameName || null,
            playerId: data.playerId || null,
            alliance: data.alliance || null,
            slotId: data.slotId || null,
            dateId: data.dateId || null,
            selfPoints: data.selfPoints ?? null,
            opponentPoints: data.opponentPoints ?? null,
            performedAt: data.performedAt
                ? data.performedAt.toDate()
                : null
        };
    });
}

