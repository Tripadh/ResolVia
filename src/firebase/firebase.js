
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyCyimC3dicSolIKpTbCRiCnmlsljRd7-Tk",
  authDomain: "ai-complaint-7553e.firebaseapp.com",
  projectId: "ai-complaint-7553e",
  storageBucket: "ai-complaint-7553e.firebasestorage.app",
  messagingSenderId: "844625881092",
  appId: "1:844625881092:web:40a9771fc1b91609922d51",
  measurementId: "G-390BBSZVLF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const rtdb = getDatabase(app, "https://ai-complaint-7553e-default-rtdb.firebaseio.com/");
const functions = getFunctions(app);

export { app, analytics, auth, rtdb, functions };
