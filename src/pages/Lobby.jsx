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
const APP_VERSION = "1.0.7";

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
      turnStartTime: new Date().toISOString(),
      pot: match.pot // ✅ MOVE POT INTO GAME
    }
  );
}

// =========================
// COMPONENT
// =========================
export default function Lobby({ goGame, back }) {
  const [matches, setMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [gameMap, setGameMap] = useState({});
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
      [Query.equal("userId", u.$id), Query.limit(1)]
    );

    if (w.documents.length) setWallet(w.documents[0]);

    refresh(u.$id);
  }

  useEffect(() => {
    if (!user) return;

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${MATCH_COLLECTION}.documents`,
      () => refresh(user.$id)
    );

    return () => unsub();
  }, [user]);

  async function refresh(userId) {
    await Promise.all([
      loadMatches(userId),
      loadActiveMatches(userId)
    ]);
  }

  // =========================
  // AVAILABLE MATCHES
  // =========================
  async function loadMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.limit(100)]
    );

    const available = res.documents.filter(
      (m) =>
        m.status === "waiting" &&
        !m.opponentId &&
        m.hostId !== userId
    );

    setMatches(available);
  }

  // =========================
  // ACTIVE MATCHES
  // =========================
  async function loadActiveMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.limit(100), Query.orderDesc("$createdAt")]
    );

    const now = Date.now();

    const mine = [];

    for (let m of res.documents) {
      const isMine = m.hostId === userId || m.opponentId === userId;
      if (!isMine) continue;

      // 🧹 DELETE FINISHED AFTER 3 HOURS
      if (m.status === "finished") {
        const age = now - new Date(m.$updatedAt).getTime();
        if (age > 3 * 60 * 60 * 1000) {
          try {
            await databases.deleteDocument(
              DATABASE_ID,
              MATCH_COLLECTION,
              m.$id
            );
          } catch {}
          continue;
        }
      }

      if (m.status !== "cancelled") {
        mine.push(m);
      }
    }

    setActiveMatches(mine);

    const map = {};

    await Promise.all(
      mine.map(async (m) => {
        if (!m.gameId) return;

        try {
          const g = await databases.getDocument(
            DATABASE_ID,
            GAME_COLLECTION,
            m.gameId
          );
          map[m.gameId] = g;
        } catch {}
      })
    );

    setGameMap(map);
  }

  // =========================
  // CANCEL MATCH
  // =========================
  async function cancelMatch(match) {
    try {
      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        match.$id,
        { status: "cancelled", refunded: true }
      );

      await unlockFunds(user.$id, match.stake);
      refresh(user.$id);
    } catch {
      alert("Cancel failed");
    }
  }

  // =========================
  // JOIN MATCH
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

      // 💰 PAY ADMIN
      const adminRes = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION,
        [Query.equal("userId", ADMIN_ID), Query.limit(1)]
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

      // 🧾 UPDATE MATCH + MOVE POT OUT
      const updated = await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: 0, // 🔥 CLEAR MATCH POT
          adminPaid: true
        }
      );

      // 🎮 CREATE GAME WITH POT
      const game = await createGame(
        { ...updated, pot: finalPot },
        user.$id
      );

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

      {activeMatches.map(m => {
        const game = gameMap[m.gameId];

        let turnLabel = "";
        if (game && game.status !== "finished") {
          turnLabel =
            game.turn === user.$id
              ? "🟢 Your Turn"
              : "🔴 Opponent Turn";
        }

        return (
          <div key={m.$id} style={styles.card}>
            <div>
              <p>₦{m.stake}</p>
              <p>{m.status}</p>
              {turnLabel && <p style={{ fontSize: 12 }}>{turnLabel}</p>}
            </div>

            {!m.opponentId ? (
              <button
                onClick={() => cancelMatch(m)}
                style={styles.cancelBtn}
              >
                ❌ Cancel
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
        );
      })}

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
          placeholder="Stake ₦ (Min 50)"
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
    justifyContent: "space-between",
    alignItems: "center"
  },

  joinBtn: {
    background: "gold",
    padding: 10,
    border: "none",
    borderRadius: 6,
    fontWeight: "bold"
  },

  resumeBtn: {
    background: "#16a34a",
    padding: 10,
    color: "#fff",
    border: "none",
    borderRadius: 6
  },

  cancelBtn: {
    background: "#dc2626",
    padding: 10,
    color: "#fff",
    border: "none",
    borderRadius: 6
  },

  finishedBtn: {
    background: "#374151",
    padding: 10,
    color: "#fff",
    border: "none",
    borderRadius: 6
  },

  input: {
    width: "100%",
    padding: 10,
    marginTop: 10
  },

  createBtn: {
    width: "100%",
    padding: 10,
    background: "blue",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    marginTop: 5
  },

  back: { marginTop: 20 }
};