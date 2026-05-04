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
const APP_VERSION = "1.0.7"; // 🔥 UPDATED VERSION

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
// CREATE GAME (NOW HOLDS POT)
// =========================
async function createGame(match, opponentId, pot) {
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
      pot: pot, // 🔥 IMPORTANT
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
  const [gameMap, setGameMap] = useState({});
  const [stake, setStake] = useState("");
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loadingMatchId, setLoadingMatchId] = useState(null);

  // =========================
  // 🔥 VERSION CHECK (AUTO UPDATE)
  // =========================
  useEffect(() => {
    const stored = localStorage.getItem("app_version");

    if (stored !== APP_VERSION) {
      localStorage.setItem("app_version", APP_VERSION);
      window.location.reload(true);
    }
  }, []);

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

  // =========================
  // REALTIME
  // =========================
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
      loadActiveMatches(userId),
      cleanupOldMatches()
    ]);
  }

  // =========================
  // DELETE FINISHED > 3 HOURS
  // =========================
  async function cleanupOldMatches() {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.equal("status", "finished"), Query.limit(100)]
    );

    const now = Date.now();

    await Promise.all(
      res.documents.map(async (m) => {
        const created = new Date(m.$createdAt).getTime();

        if (now - created > 3 * 60 * 60 * 1000) {
          try {
            if (m.gameId) {
              await databases.deleteDocument(
                DATABASE_ID,
                GAME_COLLECTION,
                m.gameId
              );
            }

            await databases.deleteDocument(
              DATABASE_ID,
              MATCH_COLLECTION,
              m.$id
            );
          } catch {}
        }
      })
    );
  }

  // =========================
  // LOAD MATCHES
  // =========================
  async function loadMatches(userId) {
    let all = [];
    let offset = 0;

    while (true) {
      const res = await databases.listDocuments(
        DATABASE_ID,
        MATCH_COLLECTION,
        [Query.limit(100), Query.offset(offset)]
      );

      all = [...all, ...res.documents];

      if (res.documents.length < 100) break;
      offset += 100;
    }

    const available = all.filter(
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
    let all = [];
    let offset = 0;

    while (true) {
      const res = await databases.listDocuments(
        DATABASE_ID,
        MATCH_COLLECTION,
        [Query.limit(100), Query.offset(offset)]
      );

      all = [...all, ...res.documents];

      if (res.documents.length < 100) break;
      offset += 100;
    }

    const mine = all.filter(
      (m) =>
        (m.hostId === userId || m.opponentId === userId) &&
        m.status !== "cancelled"
    );

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
  // JOIN MATCH (🔥 FIXED FLOW)
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

      // lock opponent funds
      await lockFunds(user.$id, fresh.stake);

      const total = fresh.stake * 2;
      const adminCut = Math.floor(total * 0.1);
      const gamePot = total - adminCut;

      // pay admin
      const adminRes = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION,
        [Query.equal("userId", ADMIN_ID), Query.limit(1)]
      );

      if (adminRes.documents.length) {
        const adminWallet = adminRes.documents[0];

        await databases.updateDocument(
          DATABASE_ID,
          WALLET_COLLECTION,
          adminWallet.$id,
          {
            balance: Number(adminWallet.balance || 0) + adminCut
          }
        );
      }

      // move pot to game + clear match pot
      const updated = await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: 0, // 🔥 cleared
          adminPaid: true
        }
      );

      // create game with pot
      const game = await createGame(updated, user.$id, gamePot);

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

    if (!amount || amount < 50) return alert("Minimum ₦50");

    if ((wallet?.balance || 0) < amount)
      return alert("Insufficient balance");

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
          refunded: false
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
      <h1>🎮 Game Lobby</h1>

      <h2>🔥 Your Matches</h2>

      {activeMatches.map((m) => {
        const game = gameMap[m.gameId];

        let turnLabel = "";
        if (game && game.status !== "finished") {
          turnLabel =
            game.turn === user?.$id
              ? "🟢 Your Turn"
              : "🔴 Opponent Turn";
        }

        return (
          <div key={m.$id} style={styles.card}>
            <div>
              <p>₦{m.stake}</p>
              <p>{m.status}</p>
              {turnLabel && <p>{turnLabel}</p>}
            </div>

            {m.status === "finished" ? (
              <button disabled>✅ Finished</button>
            ) : (
              <button onClick={() => goGame(m.gameId, m.stake)}>
                ▶ Resume
              </button>
            )}
          </div>
        );
      })}

      <h2>🎯 Available</h2>

      {matches.map((m) => (
        <div key={m.$id} style={styles.card}>
          <span>₦{m.stake}</span>
          <button onClick={() => joinMatch(m)}>Join</button>
        </div>
      ))}

      <input
        type="number"
        value={stake}
        onChange={(e) => setStake(e.target.value)}
        placeholder="Stake ₦"
      />

      <button onClick={createMatch}>Create Match</button>

      <button onClick={back}>← Back</button>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  container: { padding: 20, background: "#020617", color: "#fff" },
  card: {
    background: "#111827",
    padding: 10,
    margin: 10,
    display: "flex",
    justifyContent: "space-between"
  }
};