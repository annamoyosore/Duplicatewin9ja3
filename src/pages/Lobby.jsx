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
  // 🔴 CANCEL MATCH
  // =========================
  async function cancelMatch(match) {
    if (loadingMatchId) return;

    // Only host can cancel
    if (match.hostId !== user.$id) {
      return alert("Only host can cancel");
    }

    // Only if no one joined yet
    if (match.opponentId) {
      return alert("Cannot cancel, opponent already joined");
    }

    setLoadingMatchId(match.$id);

    try {
      const fresh = await databases.getDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        match.$id
      );

      if (fresh.status !== "waiting") {
        throw new Error("Match already started");
      }

      // 💰 REFUND
      await unlockFunds(user.$id, fresh.stake);

      // ❌ CANCEL MATCH
      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          status: "cancelled",
          refunded: true
        }
      );

      // 🔄 REFRESH UI
      refresh(user.$id);

    } catch (err) {
      alert(err.message);
    }

    setLoadingMatchId(null);
  }

  // =========================
  // REALTIME
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
          } catch {}
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

  // =========================
  // LOAD MATCHES
  // =========================
  async function loadMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [
        Query.equal("status", "waiting"),
        Query.isNull("opponentId")
      ]
    );

    const filtered = res.documents.filter(
      (m) => m.hostId !== userId
    );

    setMatches(filtered);
  }

  async function loadActiveMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION
    );

    const mine = res.documents.filter(
      (m) =>
        (m.hostId === userId || m.opponentId === userId) &&
        m.status !== "cancelled"
    );

    setActiveMatches(mine);
  }

  // =========================
  // JOIN MATCH
  // =========================
  async function joinMatch(match) {
    if (loadingMatchId) return;

    if (match.hostId === user.$id) {
      return alert("You cannot join your own match");
    }

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

      const adminCut = Math.floor(fresh.stake * 0.1);

      const updated = await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: fresh.stake * 2 - adminCut,
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

      {activeMatches.map((m) => (
        <div key={m.$id} style={styles.card}>
          <div>
            <p>₦{m.stake}</p>
            <p>{m.status}</p>
          </div>

          {/* ✅ CANCEL BUTTON */}
          {m.status === "waiting" && !m.opponentId && m.hostId === user.$id ? (
            <button
              style={styles.cancelBtn}
              onClick={() => cancelMatch(m)}
              disabled={loadingMatchId === m.$id}
            >
              {loadingMatchId === m.$id ? "Cancelling..." : "❌ Cancel"}
            </button>
          ) : m.status === "finished" ? (
            <button disabled style={styles.finishedBtn}>
              ✅ Finished
            </button>
          ) : (
            <button
              style={styles.resumeBtn}
              onClick={() => goGame(m.gameId, m.stake)}
            >
              ▶ Resume
            </button>
          )}
        </div>
      ))}

      <h2 style={styles.section}>🎯 Available</h2>

      {matches.map((m) => (
        <div key={m.$id} style={styles.card}>
          <span>₦{m.stake}</span>

          <button
            onClick={() => joinMatch(m)}
            style={styles.joinBtn}
            disabled={loadingMatchId === m.$id}
          >
            {loadingMatchId === m.$id ? "Joining..." : "Join"}
          </button>
        </div>
      ))}

      <div style={styles.createBox}>
        <input
          type="number"
          placeholder="Stake ₦"
          value={stake}
          onChange={(e) => setStake(e.target.value)}
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
  container: {
    padding: 20,
    background: "#020617",
    color: "#fff",
    minHeight: "100vh"
  },
  title: { fontSize: 28, fontWeight: "bold" },
  section: { marginTop: 20, color: "gold" },
  card: {
    background: "#111827",
    padding: 15,
    margin: "10px 0",
    borderRadius: 10,
    display: "flex",
    justifyContent: "space-between"
  },
  joinBtn: { background: "gold", padding: 8 },
  resumeBtn: { background: "green", padding: 8, color: "#fff" },
  cancelBtn: { background: "#ef4444", padding: 8, color: "#fff" },
  finishedBtn: { background: "#16a34a", padding: 8, color: "#fff" },
  input: { width: "100%", padding: 10 },
  createBtn: { width: "100%", padding: 10, background: "blue", color: "#fff" },
  back: { marginTop: 20, padding: 10 }
};