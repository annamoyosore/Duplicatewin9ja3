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
// CREATE GAME (SIMPLE)
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

      // ✅ SIMPLE STRING
      players: `${match.hostId},${opponentId}`,

      hands: `${hand1.join(",")}|${hand2.join(",")}`,
      deck: deck.join(","),
      discard: top,

      // 🔥 opponent starts
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
  const [loading, setLoading] = useState(false);

  // =========================
  // INIT
  // =========================
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
  // REALTIME
  // =========================
  useEffect(() => {
    if (!user) return;

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${MATCH_COLLECTION}.documents`,
      (res) => {
        const m = res.payload;

        refresh(user.$id);

        // 🔥 AUTO ENTER GAME
        if (
          (m.hostId === user.$id || m.opponentId === user.$id) &&
          m.status === "matched" &&
          m.gameId
        ) {
          goGame(m.gameId, m.stake);
        }
      }
    );

    return () => unsub();
  }, [user]);

  async function refresh(userId) {
    await loadMatches();
    await loadActiveMatches(userId);
  }

  // =========================
  // LOAD AVAILABLE MATCHES
  // =========================
  async function loadMatches() {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.equal("status", "waiting")]
    );

    setMatches(res.documents);
  }

  // =========================
  // LOAD ACTIVE MATCHES
  // =========================
  async function loadActiveMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION
    );

    const mine = res.documents.filter(
      m =>
        m.hostId === userId ||
        m.opponentId === userId
    );

    setActiveMatches(mine);
  }

  // =========================
  // JOIN MATCH
  // =========================
  async function joinMatch(match) {
    if (loading) return;

    setLoading(true);

    try {
      const fresh = await databases.getDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        match.$id
      );

      if (fresh.opponentId) {
        alert("Already taken");
        return;
      }

      if ((wallet?.balance || 0) < fresh.stake) {
        alert("No balance");
        return;
      }

      await lockFunds(user.$id, fresh.stake);

      const updated = await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: fresh.stake * 2
        }
      );

      // 🔥 CREATE GAME
      const game = await createGame(updated, user.$id);

      // 🔥 SAVE GAME ID
      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        updated.$id,
        {
          gameId: game.$id
        }
      );

      // 🔥 GO GAME IMMEDIATELY
      goGame(game.$id, updated.stake);

    } catch (err) {
      alert(err.message);

      try {
        await unlockFunds(user.$id, match.stake);
      } catch {}
    }

    setLoading(false);
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
      return alert("No balance");
    }

    setLoading(true);

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
          gameId: ""
        }
      );

    } catch (err) {
      alert(err.message);
    }

    setLoading(false);
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>
      <h2>🎮 Lobby</h2>

      {/* ACTIVE */}
      <h3>Your Matches</h3>
      {activeMatches.map(m => (
        <div key={m.$id} style={styles.card}>
          <span>₦{m.stake}</span>

          <button
            onClick={() => {
              if (!m.gameId) {
                alert("Not ready");
                return;
              }

              goGame(m.gameId, m.stake);
            }}
          >
            Resume
          </button>
        </div>
      ))}

      {/* AVAILABLE */}
      <h3>Available</h3>
      {matches.map(m => (
        <div key={m.$id} style={styles.card}>
          <span>₦{m.stake}</span>

          <button onClick={() => joinMatch(m)}>
            Join
          </button>
        </div>
      ))}

      {/* CREATE */}
      <input
        placeholder="Stake"
        value={stake}
        onChange={e => setStake(e.target.value)}
      />

      <button onClick={createMatch}>
        Create Match
      </button>

      <button onClick={back}>Back</button>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  container: {
    padding: 20,
    color: "#fff",
    background: "#111",
    minHeight: "100vh"
  },
  card: {
    background: "#222",
    padding: 10,
    margin: 10,
    display: "flex",
    justifyContent: "space-between"
  }
};