// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de tu Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAEUOzOWdq0xs3qiIlX1RzB6bpKkkMLykA",
  authDomain: "antifiltras-7116d.firebaseapp.com",
  databaseURL: "https://antifiltras-7116d-default-rtdb.firebaseio.com",
  projectId: "antifiltras-7116d",
  storageBucket: "antifiltras-7116d.firebasestorage.app",
  messagingSenderId: "795745598666",
  appId: "1:795745598666:web:72b77816d3c2a3c17f8833"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Firestore
const db = getFirestore(app);

// Auth
const auth = getAuth(app);

// Exportar nombrados
export { app, db, auth };
