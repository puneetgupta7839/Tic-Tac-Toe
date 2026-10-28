// Web app configuration from Firebase project tic-tac-toe-6363f.
// These identifiers are public; never add service account credentials here.
export const firebaseConfig = {
  apiKey: "AIzaSyC_F-T9J8eGYkwyvY5TPYMSDaUTOdcajEw",
  authDomain: "tic-tac-toe-6363f.firebaseapp.com",
  projectId: "tic-tac-toe-6363f",
  storageBucket: "tic-tac-toe-6363f.firebasestorage.app",
  messagingSenderId: "946207510710",
  appId: "1:946207510710:web:c735d8829c4a29a4fc1617",
  measurementId: "G-YBZY09MJ3E"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value =>
  typeof value !== "string" || !value || value.includes("PASTE_") || value.includes("YOUR_PROJECT_ID")
);
