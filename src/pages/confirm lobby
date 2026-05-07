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

const GAME_COLLECTION = "games";
const ADMIN_ID = "69ef9fe863a02a7490b4";

// =========================
// CREATE GAME
// =========================
async function createGame(match, opponentId) {
  return await databases.createDocument(
    DATABASE_ID,
    GAME_COLLECTION,
    ID.unique(),
    {
      matchId: match.$id,
      players: `${match.hostId},${opponentId}`,
      status: "running",
      turn: match.hostId,
      payoutDone: false
    }
  );
}

export default function Lobby({ goGame, back }) {
  const [matches, setMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [gameMap, setGameMap] = useState({});
  const [stake, setStake] = useState("");
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);

  const [loadingJoin, setLoadingJoin] = useState(null);
  const [creating, setCreating] = useState(false);

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

    await autoRefundExpiredMatches(u.$id);
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
  // AUTO REFUND (78 HOURS)
  // =========================
  async function autoRefundExpiredMatches(userId) {
    try {
      const res = await databases.listDocuments(
        DATABASE_ID,
        MATCH_COLLECTION,
        [
          Query.equal("hostId", userId),
          Query.equal("status", "waiting"),
          Query.equal("refundDone", false),
          Query.limit(100)
        ]
      );

      const now = Date.now();

      for (const m of res.documents) {
        if (m.opponentId) continue;

        const created = new Date(m.$createdAt).getTime();
        const diff = (now - created) / (1000 * 60 * 60);

        if (diff < 78) continue;

        // 🔒 mark first
        await databases.updateDocument(
          DATABASE_ID,
          MATCH_COLLECTION,
          m.$id,
          {
            status: "expired",
            refundDone: true
          }
        );

        // 💰 refund
        const walletRes = await databases.listDocuments(
          DATABASE_ID,
          WALLET_COLLECTION,
          [Query.equal("userId", m.hostId), Query.limit(1)]
        );

        if (!walletRes.documents.length) continue;

        const w = walletRes.documents[0];

        await databases.updateDocument(
          DATABASE_ID,
          WALLET_COLLECTION,
          w.$id,
          {
            balance: Number(w.balance || 0) + Number(m.stake || 0)
          }
        );
      }
    } catch (err) {
      console.error("Refund error:", err);
    }
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

    const mine = res.documents.filter(
      (m) =>
        (m.hostId === userId || m.opponentId === userId)
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
  // LIMIT CHECK
  // =========================
  function canPlayMore() {
    const running = activeMatches.filter(
      (m) => m.status !== "finished"
    );
    return running.length < 7;
  }

  // =========================
  // JOIN MATCH
  // =========================
  async function joinMatch(match) {
    if (loadingJoin) return;

    if (!canPlayMore()) {
      return alert("Max 7 running matches reached");
    }

    setLoadingJoin(match.$id);

    try {
      const fresh = await databases.getDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        match.$id
      );

      if (fresh.status !== "waiting" || fresh.opponentId) {
        throw new Error("Already taken");
      }

      if ((wallet?.balance || 0) < fresh.stake) {
        throw new Error("Insufficient balance");
      }

      // 💰 deduct opponent
      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        {
          balance: wallet.balance - fresh.stake
        }
      );

      const total = fresh.pot + fresh.stake;
      const adminCut = Math.floor(total * 0.1);
      const finalPot = total - adminCut;

      // 🏦 admin
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

      // update match
      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: finalPot
        }
      );

      const game = await createGame(fresh, user.$id);

      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        fresh.$id,
        { gameId: game.$id }
      );

      goGame(game.$id, fresh.stake);

    } catch (err) {
      alert(err.message);
    }

    setLoadingJoin(null);
  }

  // =========================
  // CREATE MATCH
  // =========================
  async function createMatch() {
    if (creating) return;

    if (!canPlayMore()) {
      return alert("Max 7 running matches");
    }

    const amount = Number(stake);

    if (!amount || amount < 50) {
      return alert("Minimum ₦50");
    }

    if ((wallet?.balance || 0) < amount) {
      return alert("Insufficient balance");
    }

    setCreating(true);

    try {
      // 💰 deduct host immediately
      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        {
          balance: wallet.balance - amount
        }
      );

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
          refundDone: false
        }
      );

      setStake("");

    } catch (err) {
      alert(err.message);
    }

    setCreating(false);
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>
      <h1>🎮 Lobby</h1>

      <p>
        Running Matches: {
          activeMatches.filter(m => m.status !== "finished").length
        } / 7
      </p>

      <h2>🔥 Your Matches</h2>

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
              {turnLabel && <p>{turnLabel}</p>}
            </div>

            {m.status === "finished" ? (
              <button style={styles.finishedBtn} disabled>
                ✅ Finished
              </button>
            ) : m.gameId ? (
              <button
                style={styles.resumeBtn}
                onClick={() => goGame(m.gameId, m.stake)}
              >
                ▶ Resume
              </button>
            ) : null}
          </div>
        );
      })}

      <h2>🎯 Available</h2>

      {matches.map(m => (
        <div key={m.$id} style={styles.card}>
          <span>₦{m.stake}</span>

          <button
            onClick={() => joinMatch(m)}
            disabled={loadingJoin === m.$id}
            style={styles.joinBtn}
          >
            {loadingJoin === m.$id ? "Joining..." : "Join"}
          </button>
        </div>
      ))}

      <input
        type="number"
        placeholder="Stake ₦"
        value={stake}
        onChange={e => setStake(e.target.value)}
      />

      <button onClick={createMatch} disabled={creating}>
        {creating ? "Creating..." : "Create Match"}
      </button>

      <button onClick={back}>Back</button>
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
    margin: "10px 0",
    display: "flex",
    justifyContent: "space-between",
    borderRadius: 10
  },
  joinBtn: {
    background: "gold",
    padding: "8px 14px",
    borderRadius: 8,
    border: "none"
  },
  resumeBtn: {
    background: "green",
    padding: "8px 14px",
    borderRadius: 8,
    color: "#fff",
    border: "none"
  },
  finishedBtn: {
    background: "#16a34a",
    padding: "8px 14px",
    borderRadius: 8,
    color: "#fff",
    border: "none"
  }
};