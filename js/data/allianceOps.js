// data/allianceOps.js — alliance-specific data operations
import { db } from "../lib/firebase.js";
import { getAlliances, clearAllianceCache } from "./cache.js";
import { setDoc,getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { logAudit } from "./auditOps.js";


// Returns an array of alliance objects from cache or Firestore
export async function getAlliancesData() {
    return await getAlliances();
}

// Save (create or update) an alliance document
export async function saveAllianceData(id, shortName, name, status) {

    const docId = id.trim();
    const ref = doc(db, "alliances", docId);

    // 🔎 Check if document already exists
    const snap = await getDoc(ref);
    const isNew = !snap.exists();

    await setDoc(ref, {
        shortName: shortName.trim(),
        name: name.trim(),
        status
    }, { merge: true });

    await logAudit({
        entityType: "alliance",
        entityId: docId,
        action: isNew ? "alliance_created" : "alliance_updated",
        role: "admin",
        severity: "info"
    });


    // clear the cached alliances so callers will re-fetch
    clearAllianceCache();
}

