// data/idGuard.js
// Centralized Player ID ownership validation

import { db } from "../lib/firebase.js";
import {
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/**
 * Validate if a Player ID can be claimed.
 *
 * @param {string} playerId - Numeric player ID
 * @param {string} context - "id-signup" | "google-profile" | "invite-create"
 *
 * @returns {Object}
 * {
 *   allowed: boolean,
 *   reason: string | null,
 *   placeholderDocId: string | null
 * }
 */
export async function validatePlayerIdClaim(playerId, context) {

    const q = query(
        collection(db, "users"),
        where("playerId", "==", playerId)
    );

    const snap = await getDocs(q);

    // No user owns this ID
    if (snap.empty) {
        return {
            allowed: true,
            reason: null,
            placeholderDocId: null
        };
    }

    // Only one doc should ever match (global uniqueness)
    const docSnap = snap.docs[0];
    const data = docSnap.data();
    const docId = docSnap.id;

    // Placeholder case
    if (data.isPlaceholder === true && data.authLinked === false) {

        if (context === "id-signup") {
            return {
                allowed: true,
                reason: "placeholder-link",
                placeholderDocId: docId
            };
        }

        // Google user cannot claim placeholder ID
        return {
            allowed: false,
            reason: "reserved-placeholder",
            placeholderDocId: null
        };
    }

    // Real user already owns ID
    return {
        allowed: false,
        reason: "already-claimed",
        placeholderDocId: null
    };
}
