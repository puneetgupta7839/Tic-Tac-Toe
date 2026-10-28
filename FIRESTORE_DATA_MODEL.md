# Firestore model review

Reviewed `index.html`, `script.js`, `firebase-client.js`, and the existing rules before tightening access.

## Collections, reads, and writes

- `users/{uid}/matches/{matchId}`: signed-in account-owned match history. The app writes using `setDoc`, reads the current user's collection ordered by `playedAt` descending, and limits reads to 50. It does not delete match documents.
- `rooms/{roomCode}`: one temporary online match per seven-character uppercase room code. Authenticated anonymous or email accounts create rooms, join as Player O, subscribe to a single room with `onSnapshot`, submit moves in transactions, and Player X advances the next round in a transaction. No room listing or deletion is used.
- No Firestore `where()` queries are used.

## Match history document

Required fields: `matchId` (string, same as document ID), `xName` and `oName` (strings, 1–24 characters), `xScore` and `oScore` (integers, 0–11), `rounds` (integer, 1–11), `format` (integer, 5 or 11), `winner` (string, player name or `Tie`), and `playedAt` (ISO date string). `mode` is optional and is `online` for online matches. Documents are private to their owning signed-in UID. Anonymous users do not read or save account history.

## Room document

Fields: `code`, `players` (X and O seats with UID and name, O may be null while waiting), `board` (nine entries from empty/X/O), `turn`, `starter`, `nextStarter`, `scores` (X/O integer counts), `history` (up to 11 entries from X/O/D), `total` (5 or 11), `status` (waiting/playing/round-over/complete), `winner` (null/X/O), and `createdAt` (ISO date string). A room is readable by an authenticated user who knows its code while it is waiting, and by its two members after play starts. Only the creator can advance rounds; each current-turn seat submits its own move.

## Constraints and security limits

- Validate required fields, types, enumerated values, IDs, names, and list sizes on both create and update.
- Keep account match documents scoped to the authenticated owner.
- Keep room seats and match configuration immutable after creation, apart from the one-time Player O join.
- Rules can validate board/result consistency and constrain which room member may make each transition. The browser remains untrusted, so a determined room participant may still manipulate a casual game state; the feature is not suitable for prizes or competitive play.
