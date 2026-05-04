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
// COMPONENT
// =========================
export default function Lobby({ goGame, back }) {
  const [matches, setMatches] = useState([]);
  const [activeMatches, setActiveMatches] = useState([]);
  const [gameMap, setGameMap] = useState({});
  const [stake, setStake] = useState("");
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);

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

  async function loadMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.limit(100)]
    );

    setMatches(
      res.documents.filter(
        (m) =>
          m.status === "waiting" &&
          !m.opponentId &&
          m.hostId !== userId
      )
    );
  }

  async function loadActiveMatches(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.limit(100)]
    );

    setActiveMatches(
      res.documents.filter(
        (m) =>
          (m.hostId === userId || m.opponentId === userId) &&
          m.status !== "cancelled"
      )
    );
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
    try {
      if ((wallet?.balance || 0) < match.stake) {
        throw new Error("Insufficient balance");
      }

      await lockFunds(user.$id, match.stake);

      const totalPot = match.stake * 2;
      const adminCut = Math.floor(totalPot * 0.1);
      const finalPot = totalPot - adminCut;

      // pay admin
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

      // update match
      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        match.$id,
        {
          opponentId: user.$id,
          status: "matched",
          pot: 0
        }
      );

      alert("Match joined successfully");

    } catch (err) {
      await unlockFunds(user.$id, match.stake);
      alert(err.message);
    }
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
          status: "waiting"
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
      <h1>🎮 Lobby</h1>

      <h2>🔥 Your Matches</h2>

      {activeMatches.map((m) => {
        const isHost = m.hostId === user.$id;

        return (
          <div key={m.$id} style={styles.card}>
            <div>
              <p>₦{m.stake}</p>
              <p>{m.status}</p>
            </div>

            {/* RIGHT SIDE BUTTON */}
            <div style={styles.actions}>
              {!m.opponentId && isHost && (
                <button
                  onClick={() => cancelMatch(m)}
                  style={styles.cancelBtn}
                >
                  ❌ Cancel
                </button>
              )}

              {m.opponentId && m.status !== "finished" && (
                <button
                  style={styles.resumeBtn}
                  onClick={() => goGame(m.gameId, m.stake)}
                >
                  ▶ Resume
                </button>
              )}

              {m.status === "finished" && (
                <button disabled style={styles.finishedBtn}>
                  ✅ Finished
                </button>
              )}
            </div>
          </div>
        );
      })}

      <h2>🎯 Available</h2>

      {matches.map((m) => (
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

  card: {
    background: "#111827",
    padding: 15,
    margin: "10px 0",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: 8
  },

  actions: {
    display: "flex",
    flexDirection: "column",
    gap: 6
  },

  joinBtn: {
    background: "gold",
    padding: 10,
    border: "none",
    borderRadius: 6
  },

  resumeBtn: {
    background: "green",
    padding: 10,
    color: "#fff",
    border: "none",
    borderRadius: 6
  },

  cancelBtn: {
    background: "red",
    padding: 10,
    color: "#fff",
    border: "none",
    borderRadius: 6
  },

  finishedBtn: {
    background: "gray",
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

  back: {
    marginTop: 20
  }
};