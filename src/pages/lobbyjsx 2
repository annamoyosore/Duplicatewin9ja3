// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import {
  account,
  databases,
  DATABASE_ID,
  MATCH_COLLECTION,
  WALLET_COLLECTION,
  ID,
  Query
} from "../lib/appwrite";

import { lockFunds, unlockFunds } from "../lib/wallet";

const GAME_COLLECTION = "games";
const ADMIN_ID = "69ef9fe863a02a7490b4";
const APP_VERSION = "1.0.3";

// =========================
// CREATE DECK
// =========================
function createDeck() {
  const shapes = ["c", "t", "s", "r", "x"];
  let deck = [];

  for (let s of shapes) {
    for (let i = 1; i <= 13; i++) {
      deck.push(s + i);
    }
  }

  return deck.sort(() => Math.random() - 0.5);
}

// =========================
// CREATE GAME
// =========================
async function createGame(match, opponentId) {
  const deck = createDeck();

  const hand1 = deck.splice(0, 6);
  const hand2 = deck.splice(0, 6);
  const top = deck.pop();

  return await databases.createDocument(
    DATABASE_ID,
    GAME_COLLECTION,
    ID.unique(),
    {
      matchId: match.$id,
      players: `${match.hostId},${opponentId}`,
      hands: `${hand1.join(",")}|${hand2.join(",")}`,
      deck: deck.join(","),
      discard: top,
      turn: opponentId,
      status: "running",
      round: "1",
      winnerId: "",
      turnStartTime: new Date().toISOString()
    }
  );
}

// =========================
// COMPONENT
// =========================
export default function Lobby({ goGame, back }) {
  const [matches, setMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [stake, setStake] = useState("");
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loadingMatchId, setLoadingMatchId] = useState(null);

  useEffect(() => {
    init();
  }, []);

  // 🔄 AUTO UPDATE
  useEffect(() => {
    const v = localStorage.getItem("app_version");
    if (v && v !== APP_VERSION) {
      localStorage.setItem("app_version", APP_VERSION);
      window.location.reload(true);
    } else {
      localStorage.setItem("app_version", APP_VERSION);
    }
  }, []);

  async function init() {
    const u = await account.get();
    setUser(u);

    const w = await databases.listDocuments(
      DATABASE_ID,
      WALLET_COLLECTION,
      [Query.equal("userId", u.$id)]
    );

    if (w.documents.length) setWallet(w.documents[0]);

    refresh(u.$id);
  }

  // =========================
  // REALTIME (FIXED)
  // =========================
  useEffect(() => {
    if (!user) return;

    const unsubMatch = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${MATCH_COLLECTION}.documents`,
      () => refresh(user.$id)
    );

    const unsubGame = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents`,
      async (res) => {
        const g = res.payload;

        if (!g.players?.includes(user.$id)) return;

        if (g.status === "finished" && g.matchId) {
          try {
            const m = await databases.getDocument(
              DATABASE_ID,
              MATCH_COLLECTION,
              g.matchId
            );

            if (m.status !== "finished") {
              await databases.updateDocument(
                DATABASE_ID,
                MATCH_COLLECTION,
                g.matchId,
                { status: "finished" }
              );
            }
          } catch (e) {
            console.log("Sync error:", e.message);
          }
        }

        refresh(user.$id);
      }
    );

    return () => {
      unsubMatch();
      unsubGame();
    };
  }, [user]);

  async function refresh(userId) {
    await loadMatches(userId);
    await loadActiveMatches(userId);
  }

  async function loadMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.equal("status", "waiting"), Query.isNull("opponentId")]
    );

    setMatches(res.documents.filter(m => m.hostId !== userId));
  }

  async function loadActiveMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION
    );

    setActiveMatches(
      res.documents.filter(
        m =>
          (m.hostId === userId || m.opponentId === userId) &&
          m.status !== "cancelled"
      )
    );
  }

  // =========================
  // SAFE RESUME
  // =========================
  async function safeResume(match) {
    try {
      const g = await databases.getDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        match.gameId
      );

      if (g.status === "finished") {
        await databases.updateDocument(
          DATABASE_ID,
          MATCH_COLLECTION,
          match.$id,
          { status: "finished" }
        );

        alert("Game already finished");
        refresh(user.$id);
        return;
      }

      goGame(match.gameId, match.stake);

    } catch {
      alert("Failed to open game");
    }
  }

  // =========================
  // JOIN MATCH (UNCHANGED CORE)
  // =========================
  async function joinMatch(match) {
    if (loadingMatchId) return;

    setLoadingMatchId(match.$id);

    try {
      const fresh = await databases.getDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        match.$id
      );

      if (fresh.status !== "waiting" || fresh.opponentId) {
        throw new Error("Match already taken");
      }

      if ((wallet?.balance || 0) < fresh.stake) {
        throw new Error("Insufficient balance");
      }

      await lockFunds(user.$id, fresh.stake);

      const totalPot = fresh.stake * 2;
      const adminCut = Math.floor(totalPot * 0.1);
      const finalPot = totalPot - adminCut;

      const adminRes = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION,
        [Query.equal("userId", ADMIN_ID)]
      );

      const adminWallet = adminRes.documents[0];

      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        adminWallet.$id,
        {
          balance: (adminWallet.balance || 0) + adminCut
        }
      );

      const updated = await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: finalPot,
          adminPaid: true
        }
      );

      const game = await createGame(updated, user.$id);

      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        updated.$id,
        { gameId: game.$id }
      );

      goGame(game.$id, updated.stake);

    } catch (err) {
      await unlockFunds(user.$id, match.stake);
      alert(err.message);
    }

    setLoadingMatchId(null);
  }

  // =========================
  // CREATE MATCH
  // =========================
  async function createMatch() {
    const amount = Number(stake);

    if (!amount || amount < 50) {
      return alert("Minimum ₦50");
    }

    if ((wallet?.balance || 0) < amount) {
      return alert("Insufficient balance");
    }

    try {
      await lockFunds(user.$id, amount);

      await databases.createDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        ID.unique(),
        {
          hostId: user.$id,
          opponentId: null,
          stake: amount,
          pot: amount,
          status: "waiting",
          gameId: "",
          adminPaid: false,
          refunded: false,
          createdAt: new Date().toISOString()
        }
      );

      setStake("");

    } catch (err) {
      alert(err.message);
    }
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🎮 Game Lobby</h1>

      <h2 style={styles.section}>🔥 Your Matches</h2>

      {activeMatches.map(m => (
        <div key={m.$id} style={styles.card}>
          <div>
            <p>₦{m.stake}</p>
            <p>{m.status}</p>
          </div>

          {m.status === "finished" ? (
            <button disabled style={styles.finishedBtn}>
              ✅ Finished
            </button>
          ) : m.status === "waiting" && !m.opponentId ? (
            <button onClick={() => cancelMatch(m)} style={styles.cancelBtn}>
              ❌ Cancel
            </button>
          ) : (
            <button
              style={styles.resumeBtn}
              onClick={() => safeResume(m)}
            >
              ▶ Resume
            </button>
          )}
        </div>
      ))}

      <h2 style={styles.section}>🎯 Available</h2>

      {matches.map(m => (
        <div key={m.$id} style={styles.card}>
          <span>₦{m.stake}</span>
          <button
            onClick={() => joinMatch(m)}
            style={styles.joinBtn}
          >
            Join
          </button>
        </div>
      ))}

      <div style={styles.createBox}>
        <input
          type="number"
          placeholder="Stake ₦"
          value={stake}
          onChange={e => setStake(e.target.value)}
          style={styles.input}
        />

        <button onClick={createMatch} style={styles.createBtn}>
          Create Match
        </button>
      </div>

      <button onClick={back} style={styles.back}>
        ← Back
      </button>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  container: { padding: 20, background: "#020617", color: "#fff" },
  title: { fontSize: 28 },
  section: { marginTop: 20, color: "gold" },
  card: {
    background: "#111827",
    padding: 15,
    margin: "10px 0",
    display: "flex",
    justifyContent: "space-between"
  },
  joinBtn: { background: "gold", padding: 8 },
  resumeBtn: { background: "green", padding: 8, color: "#fff" },
  cancelBtn: { background: "red", padding: 8, color: "#fff" },
  finishedBtn: { background: "#16a34a", padding: 8, color: "#fff" },
  input: { width: "100%", padding: 10 },
  createBtn: { width: "100%", padding: 10, background: "blue", color: "#fff" },
  back: { marginTop: 20 }
};