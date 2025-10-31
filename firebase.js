// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAEUOzOWdq0xs3qiIlX1RzB6bpKkkMLykA",
  authDomain: "antifiltras-7116d.firebaseapp.com",
  databaseURL: "https://antifiltras-7116d-default-rtdb.firebaseio.com",
  projectId: "antifiltras-7116d",
  storageBucket: "antifiltras-7116d.firebasestorage.app",
  messagingSenderId: "795745598666",
  appId: "1:795745598666:web:72b77816d3c2a3c17f8833",
  measurementId: "G-8NS1EX4ZF3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export default app;
