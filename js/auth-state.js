// js/auth-state.js

import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from
      "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const appRoot = document.getElementById("appRoot");
const authLoader = document.getElementById("authLoader");

function showApp() {
  console.log("SHOW APP CALLED");
  if (authLoader) authLoader.style.display = "none";
  if (appRoot) appRoot.classList.remove("hidden");
}

onAuthStateChanged(auth, async (user) => {
  console.log("AUTH STATE TRIGGERED", window.location.pathname);
  const currentPage =
      window.location.pathname.split("/").pop() || "index.html";

  /* ================= NOT LOGGED IN ================= */
  if (!user) {
    if (currentPage !== "index.html") {
      window.location.replace("index.html");
      return;
    }

    // allow login page to render
    showApp();
    return;
  }

  /* ================= LOGGED IN ================= */
  const email = user.email;
  const userRef = doc(db, "users", email);

  let snap = await getDoc(userRef);

  // first login bootstrap
  if (!snap.exists()) {
    await setDoc(userRef, {
      email,
      role: "member",
      status: "incomplete",
      playerId: null,
      ingameName: null,
      alliance: null,
      createdAt: serverTimestamp()
    });
    snap = await getDoc(userRef);

  }

  const data = snap.data();
  console.log(data);

  console.log("ready to route based on role and profile completeness");
  /* ================= ADMIN ================= */
  if (data.role === "admin") {

    // Allow admin to access BOTH pages
    if (currentPage === "index.html") {
        window.location.replace("profile.html");
        return;
    }

    // already on admin page → render immediately
    showApp();
    return;
  }

  /* ================= MEMBER WITHOUT PROFILE ================= */
  if (!data.playerId || !data.ingameName || !data.alliance) {
    console.log("member without profile");
    if (currentPage !== "profile.html") {
      window.location.replace("profile.html");
      return;
    }

    // already on profile page → SHOW IT
    showApp();
    return;
  }

  /* ================= MEMBER WITH PROFILE ================= */
  if (currentPage !== "profile.html") {
    console.log("member without profile");
    window.location.replace("profile.html");
    return;
  }

  console.log("mgoing to showapp");

  showApp();
});
