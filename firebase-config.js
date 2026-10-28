// Copy the web app config from Firebase Console > Project settings > Your apps.
// Firebase web config is public app identification, not an admin credential.
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY_HERE",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  appId: "PASTE_APP_ID_HERE"
};

export const firebaseConfigured = !Object.values(firebaseConfig).some(value =>
  typeof value !== "string" || !value || value.includes("PASTE_") || value.includes("YOUR_PROJECT_ID")
);
