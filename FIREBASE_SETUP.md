# Firebase setup for Crossed

The app uses Firebase Authentication and Cloud Firestore in project `tic-tac-toe-6363f`.

## Configured Firebase services

- The Firebase Web app was already registered in the project. Its public Web config is in `firebase-config.js`.
- Email/Password and Anonymous sign-in are enabled. Anonymous accounts let online guests create and join rooms without signing up.
- `puneetgupta7839.github.io` is an authorized Authentication domain for the GitHub Pages app.
- A Standard Firestore database named `(default)` was created in Mumbai (`asia-south1`) with deletion protection enabled.
- Firestore rules in `firestore.rules` were deployed. The app uses `users/{uid}/matches/{matchId}` for private saved scores and `rooms/{roomCode}` for online matches.

## App files

Deploy these files together at the same site path:

- `index.html`
- `style.css`
- `script.js`
- `firebase-client.js`
- `firebase-config.js`

`firebase.json`, `.firebaserc`, `firestore.rules`, and `firestore.indexes.json` configure Firebase and are not browser pages. The site must be served over HTTPS; GitHub Pages does this automatically.

## Usage and limits

Cloud Firestore has a no-cost quota; usage beyond the quota may require a billing plan. Check the project’s Usage page as the app gets traffic. [Firebase pricing](https://firebase.google.com/pricing) lists the current quotas.

The Security Rules validate score ownership, record fields, room membership, and legal move/round transitions. Rooms are casual multiplayer; the client remains untrusted and this game is not designed for prize-based competition. Review the prototype rules before broadly sharing the app.
