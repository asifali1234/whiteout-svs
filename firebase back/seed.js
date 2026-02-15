const admin = require("firebase-admin");

admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: "whiteout-svs-reservation"
});

const db = admin.firestore();

async function run() {
    // CREATE ADMIN USER
    await db.collection("users").doc("aachi554@gmail.com").set({
        email: "aachi554@gmail.com",
        ingameName: "GeneZyn",
        playerId: "487345501",
        alliance: "ONE",
        role: "admin",
        status: "approved",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // CREATE ALLIANCE
    await db.collection("alliances").doc("ONE").set({
        code: "ONE",
        name: "ONE PIECE",
        status: "active",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // CREATE INVITE
    await db.collection("invites").add({
        email: "aachi.mec@gmail.com",
        ingameName: "genesis",
        playerId: "487410582",
        alliance: "ONE",
        invitedBy: "aachi554@gmail.com",
        status: "sent",
        used: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log("✅ FIRESTORE SCHEMA CREATED");
}

run().catch(console.error);