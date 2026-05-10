import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCi1yfjxuMVfPcG7ep_4wIcaYCMH2_HMDU",
  authDomain: "televault-911cc.firebaseapp.com",
  projectId: "televault-911cc",
  storageBucket: "televault-911cc.firebasestorage.app",
  messagingSenderId: "652424750913",
  appId: "1:652424750913:web:bc7c419cd19821ed5563c0"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
