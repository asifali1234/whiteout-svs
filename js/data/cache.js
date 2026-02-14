// data/cache.js — small in-memory cache helpers for data-layer
import { db } from "../lib/firebase.js";
import {
    collection,
    getDocs,
    query,
    where
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let allianceCache = null;

export async function getAlliances() {
    if (allianceCache) return allianceCache;

    const snap = await getDocs(
        query(collection(db, "alliances"), where("status", "==", "active"))
    );

    allianceCache = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
    }));

    return allianceCache;
}

export function clearAllianceCache() {
    allianceCache = null;
}

