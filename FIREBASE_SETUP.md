# Firebase setup for Crossed

The app remains playable without an account. Email/password accounts make named scores available across devices. Online rooms use Firebase Authentication anonymously, so neither player needs to sign up.

## 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. In **Project settings → General → Your apps**, add a Web app and copy its config values.
3. In **Authentication → Sign-in method**, enable **Email/Password** and **Anonymous**.
4. In **Authentication → Settings → Authorized domains**, add `puneetgupta7839.github.io` if it is not already listed.
5. In **Firestore Database**, create a database. Choose a region near your users.

## 2. Add the web app config

Open `firebase-config.js` and replace the placeholder values for `apiKey`, `authDomain`, `projectId`, and `appId` with the values from your Firebase Web app. These are Firebase web app identifiers, not administrator credentials. Never put a service account key in this website.

## 3. Publish Firestore rules

In **Firestore Database → Rules**, paste the contents of `firestore.rules` and click **Publish**. These rules keep score history private to its account and restrict room updates to the two players. Room codes are short-lived matchmaking codes, so share them only with the intended opponent.

## 4. Publish the app

Upload `index.html`, `style.css`, `script.js`, `firebase-client.js`, `firebase-config.js`, and `firestore.rules` to the repository root (the HTML expects the script and CSS files beside it). The setup guide is for reference and does not need to be deployed. After GitHub Pages finishes publishing, open the site over HTTPS and try **Sign in** or **Play online**.

## What users can do

- Play two-player or against the computer without signing in.
- Create an account or sign in to sync named match history.
- Play online as a guest by creating a room and sharing its seven-character code.

This is a small browser game prototype. Firestore rules limit access by room membership, but the client currently sends moves directly; this is suitable for friendly play, not competitive or prize-based matches.
