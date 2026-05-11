import { useEffect, useState, useRef } from "react";
import {
  account,
  databases,
  DATABASE_ID,
  Query
} from "../lib/appwrite";

import boardImg from "./board.png";

const SNAKE_GAME_COLLECTION = "snakegame";
const WALLET_COLLECTION = "wallets";

const SIZE = 100;

// 🐍 snakes
const snakes = {
  50: 5,
  43: 17,
  56: 8,
  68: 15,
  84: 58,
  87: 49,
  98: 40,
};

// 🪜 ladders
const ladders = {
  2: 23,
  6: 45,
  20: 59,
  52: 72,
  57: 96,
  71: 92,
};

// =========================
// HELPERS
// =========================
function getCoords(pos) {
  const index = pos - 1;
  const row = Math.floor(index / 10);
  let col = index % 10;

  if (row % 2 === 1) col = 9 - col;

  return {
    left: `${col * 10 + 5}%`,
    top: `${(9 - row) * 10 + 5}%`,
  };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function rollDice() {
  return Math.floor(Math.random() * 6) + 1;
}

// =========================
// MAIN
// =========================
export default function SnakeGame({ gameId }) {
  const [user, setUser] = useState(null);
  const [game, setGame] = useState(null);
  const [dice, setDice] = useState(1);
  const [rolling, setRolling] = useState(false);

  const lock = useRef(false);

  // =========================
  // LOAD USER + GAME
  // =========================
  useEffect(() => {
    async function init() {
      const u = await account.get();
      setUser(u);

      const g = await databases.getDocument(
        DATABASE_ID,
        SNAKE_GAME_COLLECTION,
        gameId
      );

      setGame(g);
    }

    init();
  }, [gameId]);

  // =========================
  // REALTIME SYNC
  // =========================
  useEffect(() => {
    if (!gameId) return;

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${SNAKE_GAME_COLLECTION}.documents.${gameId}`,
      (res) => {
        setGame(res.payload);
      }
    );

    return () => unsub();
  }, [gameId]);

  // =========================
  // HELPERS
  // =========================
  function isMyTurn() {
    if (!game || !user) return false;
    return game.turn === user.$id;
  }

  function myOpponentId() {
    return game.hostId === user.$id
      ? game.opponentId
      : game.hostId;
  }

  // =========================
  // ANIMATE MOVE
  // =========================
  async function animateMove(playerId, start, end) {
    let current = start;

    while (current < end) {
      await sleep(180);
      current++;
    }

    let final = current;

    if (snakes[final]) final = snakes[final];
    if (ladders[final]) final = ladders[final];

    return final;
  }

  // =========================
  // PLAY TURN
  // =========================
  async function playTurn() {
    if (!game || !user || rolling) return;
    if (!isMyTurn()) return alert("Not your turn");

    lock.current = true;
    setRolling(true);

    try {
      const fresh = await databases.getDocument(
        DATABASE_ID,
        SNAKE_GAME_COLLECTION,
        gameId
      );

      const d = rollDice();
      setDice(d);

      const pos = JSON.parse(fresh.positions || "{}");

      const start = pos[user.$id] || 1;
      let end = start + d;

      if (end > SIZE) end = SIZE;

      const finalPos = await animateMove(user.$id, start, end);

      const opponentId = myOpponentId();

      const updatedPositions = {
        ...pos,
        [user.$id]: finalPos
      };

      const nextTurn =
        game.turn === user.$id
          ? opponentId
          : user.$id;

      const history = [
        ...(JSON.parse(fresh.history || "[]")),
        `${user.name || "Player"} rolled ${d} → ${finalPos}`
      ].slice(-10);

      const updated = await databases.updateDocument(
        DATABASE_ID,
        SNAKE_GAME_COLLECTION,
        gameId,
        {
          positions: JSON.stringify(updatedPositions),
          turn: nextTurn,
          history: JSON.stringify(history),
        }
      );

      setGame(updated);

    } catch (err) {
      console.error(err);
    } finally {
      setRolling(false);
      lock.current = false;
    }
  }

  // =========================
  // SAFE LOAD
  // =========================
  if (!game || !user) return <div>Loading...</div>;

  const positions = JSON.parse(game.positions || "{}");

  const myPos = positions[user.$id] || 1;
  const oppPos = positions[game.hostId === user.$id ? game.opponentId : game.hostId] || 1;

  const myCoords = getCoords(myPos);
  const oppCoords = getCoords(oppPos);

  const myTurn = isMyTurn();

  // =========================
  // UI
  // =========================
  return (
    <div style={{ textAlign: "center", background: "#0f172a", color: "#fff", minHeight: "100vh" }}>
      <h2>🐍 Snake Game</h2>

      <div style={{ marginBottom: 10 }}>
        {myTurn ? "🟢 Your Turn" : "⏳ Opponent Turn"}
      </div>

      <div style={{ position: "relative", width: 360, height: 360, margin: "auto" }}>
        <img src={boardImg} style={{ width: "100%", height: "100%" }} />

        {/* YOU */}
        <div style={{
          position: "absolute",
          ...myCoords,
          width: 25,
          height: 25,
          background: "red",
          borderRadius: "50%"
        }}/>

        {/* OPPONENT */}
        <div style={{
          position: "absolute",
          ...oppCoords,
          width: 25,
          height: 25,
          background: "blue",
          borderRadius: "50%"
        }}/>
      </div>

      <div style={{ marginTop: 20 }}>
        🎲 Dice: {dice}
      </div>

      <button
        onClick={playTurn}
        disabled={!myTurn || rolling}
        style={{
          marginTop: 10,
          padding: 10,
          background: myTurn ? "gold" : "gray",
          border: "none",
          borderRadius: 8
        }}
      >
        {rolling ? "Rolling..." : "Roll Dice"}
      </button>

      <div style={{ marginTop: 10, fontSize: 12 }}>
        {(JSON.parse(game.history || "[]")).slice(-5).map((h, i) => (
          <div key={i}>{h}</div>
        ))}
      </div>
    </div>
  );
}