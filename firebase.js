// firebase.js
// Importar solo lo que se puede usar en Node.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Configuración de Firebase (la tuya)
const firebaseConfig = {
  apiKey: "AIzaSyAEUOzOWdq0xs3qiIlX1RzB6bpKkkMLykA",
  authDomain: "antifiltras-7116d.firebaseapp.com",
  databaseURL: "https://antifiltras-7116d-default-rtdb.firebaseio.com",
  projectId: "antifiltras-7116d",
  storageBucket: "antifiltras-7116d.firebasestorage.app",
  messagingSenderId: "795745598666",
  appId: "1:795745598666:web:72b77816d3c2a3c17f8833"
  // measurementId no se usa en Node.js
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);

// Firestore (Base de datos)
const db = getFirestore(app);

// Auth (Autenticación)
const auth = getAuth(app);

// Exportar todo para usar en otros archivos
export { app, db, auth };
