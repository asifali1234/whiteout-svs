// data/allianceOps.js — alliance-specific data operations
import { db } from "../lib/firebase.js";
import { getAlliances, clearAllianceCache } from "./cache.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Returns an array of alliance objects from cache or Firestore
export async function getAlliancesData() {
    return await getAlliances();
}

// Save (create or update) an alliance document
export async function saveAllianceData(id, shortName, name, status) {
    const docId = id.trim();
    await setDoc(doc(db, "alliances", docId), {
        shortName: shortName.trim(),
        name: name.trim(),
        status
    }, { merge: true });

    // clear the cached alliances so callers will re-fetch
    clearAllianceCache();
}

