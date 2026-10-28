import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
import {
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  getFirestore,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
import { firebaseConfig, firebaseConfigured } from "./firebase-config.js";

let app;
let auth;
let db;

function services() {
  if (!firebaseConfigured) throw new Error("Firebase is not configured yet. Add your Firebase web app config first.");
  if (!app) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
  }
  return {auth, db};
}

export function isConfigured() { return firebaseConfigured; }
export function watchAuth(callback, onError) {
  const {auth} = services();
  return onAuthStateChanged(auth, callback, onError);
}
export function currentUser() {
  if (!firebaseConfigured || !auth) return null;
  return auth.currentUser;
}
export async function createAccount(email, password) {
  const {auth} = services();
  return (await createUserWithEmailAndPassword(auth, email, password)).user;
}
export async function signIn(email, password) {
  const {auth} = services();
  return (await signInWithEmailAndPassword(auth, email, password)).user;
}
export async function resetPassword(email) {
  const {auth} = services();
  return sendPasswordResetEmail(auth, email);
}
export async function signOutUser() {
  const {auth} = services();
  return signOut(auth);
}
async function ensureUser() {
  const {auth} = services();
  if (!auth.currentUser) await signInAnonymously(auth);
  return auth.currentUser;
}

export async function saveCloudMatch(record) {
  const {db} = services();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return false;
  const matchId = record.matchId || `${Date.now()}-${crypto.randomUUID()}`;
  await setDoc(doc(db, "users", user.uid, "matches", matchId), {...record, matchId});
  return true;
}

export async function loadCloudMatches() {
  const {db} = services();
  const user = auth?.currentUser;
  if (!user || user.isAnonymous) return [];
  const matches = collection(db, "users", user.uid, "matches");
  const result = await getDocs(query(matches, orderBy("playedAt", "desc"), limit(50)));
  return result.docs.map(item => item.data());
}

function newRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = new Uint8Array(7);
  crypto.getRandomValues(bytes);
  return [...bytes].map(byte => alphabet[byte % alphabet.length]).join("");
}

export async function createRoom(playerName, total) {
  const {db} = services();
  const user = await ensureUser();
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const code = newRoomCode();
    const roomRef = doc(db, "rooms", code);
    try {
      await runTransaction(db, async transaction => {
        if ((await transaction.get(roomRef)).exists()) throw new Error("ROOM_CODE_COLLISION");
        transaction.set(roomRef, {
          code,
          players: {X: {uid: user.uid, name: playerName || "Player X"}, O: null},
          board: Array(9).fill(""),
          turn: "X",
          starter: "X",
          nextStarter: "O",
          scores: {X: 0, O: 0},
          history: [],
          total,
          status: "waiting",
          winner: null,
          createdAt: new Date().toISOString()
        });
      });
      return code;
    } catch (error) {
      if (error.message !== "ROOM_CODE_COLLISION" || attempt === 3) throw error;
    }
  }
}

export async function joinRoom(codeInput, playerName) {
  const {db} = services();
  const user = await ensureUser();
  const code = codeInput.trim().toUpperCase();
  const roomRef = doc(db, "rooms", code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("We couldn't find that room code.");
    const room = snapshot.data();
    if (room.status !== "waiting" || room.players.O) throw new Error("That room is already full or has started.");
    if (room.players.X.uid === user.uid) throw new Error("Open the room on another device or browser profile to join as Player O.");
    transaction.update(roomRef, {
      "players.O": {uid: user.uid, name: playerName || "Player O"},
      status: "playing"
    });
  });
  return code;
}

export function watchRoom(code, callback, onError) {
  const {db} = services();
  return onSnapshot(doc(db, "rooms", code), snapshot => {
    if (!snapshot.exists()) onError?.(new Error("This room is no longer available."));
    else callback(snapshot.data());
  }, onError);
}

const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
function outcome(board) {
  for (const line of wins) {
    if (board[line[0]] && board[line[0]] === board[line[1]] && board[line[1]] === board[line[2]]) {
      return {winner: board[line[0]]};
    }
  }
  return board.every(Boolean) ? {winner: null} : null;
}

export async function submitRoomMove(code, role, index) {
  const {db} = services();
  const user = await ensureUser();
  const roomRef = doc(db, "rooms", code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) throw new Error("This room is no longer available.");
    const room = snapshot.data();
    if (room.status !== "playing" || room.players[role]?.uid !== user.uid || room.turn !== role || room.board[index]) return;
    const board = [...room.board];
    board[index] = role;
    const result = outcome(board);
    let turn = role === "X" ? "O" : "X";
    let scores = {...room.scores};
    let history = [...room.history];
    let status = "playing";
    let nextStarter = room.nextStarter;
    let winner = null;
    if (result) {
      if (result.winner) scores[result.winner] += 1;
      history.push(result.winner || "D");
      const clinched = scores.X > room.total / 2 || scores.O > room.total / 2;
      if (clinched || history.length >= room.total) {
        status = "complete";
        winner = scores.X === scores.O ? null : (scores.X > scores.O ? "X" : "O");
      } else {
        status = "round-over";
        nextStarter = room.starter === "X" ? "O" : "X";
      }
    }
    transaction.update(roomRef, {board, turn, scores, history, status, nextStarter, winner});
  });
}

export async function advanceRoomRound(code) {
  const {db} = services();
  const user = await ensureUser();
  const roomRef = doc(db, "rooms", code);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(roomRef);
    if (!snapshot.exists()) return;
    const room = snapshot.data();
    if (room.status !== "round-over" || room.players.X.uid !== user.uid) return;
    transaction.update(roomRef, {
      board: Array(9).fill(""),
      starter: room.nextStarter,
      turn: room.nextStarter,
      nextStarter: room.nextStarter === "X" ? "O" : "X",
      status: "playing",
      winner: null
    });
  });
}
