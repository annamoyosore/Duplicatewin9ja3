import { useEffect, useRef, useState } from "react";
import { databases, DATABASE_ID, account } from "./lib/appwrite";

const GAME_COLLECTION = "games";

// =========================
// SOUND EFFECTS
// =========================
const playSound = new Audio("/sounds/play.mp3");
const drawSound = new Audio("/sounds/draw.mp3");

// =========================
// PARSE GAME
// =========================
function parseGame(g) {
  return {
    ...g,
    players: g.players ? g.players.split(",").filter(Boolean) : [],
    deck: g.deck ? g.deck.split(",").filter(Boolean) : [],
    discard: g.discard || "",
    hands: g.hands
      ? g.hands.split("|").map(p => (p ? p.split(",").filter(Boolean) : []))
      : [[], []],
    pendingPick: Number(g.pendingPick || 0),
    history: g.history ? g.history.split("||") : []
  };
}

// =========================
// ENCODE GAME
// =========================
function encodeGame(g) {
  return {
    hands: g.hands.map(p => p.join(",")).join("|"),
    deck: g.deck.join(","),
    discard: g.discard,
    pendingPick: String(g.pendingPick || 0),
    history: g.history.slice(-20).join("||") // 🔥 keep more history
  };
}

// =========================
// DECODE CARD
// =========================
function decodeCard(str) {
  if (!str) return null;

  const map = {
    c: "circle",
    t: "triangle",
    s: "square",
    r: "star",
    x: "cross"
  };

  return {
    shape: map[str[0]],
    number: Number(str.slice(1))
  };
}

// =========================
// CANVAS CARD
// =========================
const cache = new Map();

function drawCard(card) {
  if (!card) return null;

  const key = `${card.shape}_${card.number}`;
  if (cache.has(key)) return cache.get(key);

  const c = document.createElement("canvas");
  c.width = 80;
  c.height = 120;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 80, 120);

  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 76, 116);

  ctx.fillStyle = "#e11d48";
  ctx.font = "bold 14px Arial";
  ctx.fillText(card.number, 6, 18);

  const cx = 40, cy = 60;

  if (card.shape === "circle") {
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
  }

  if (card.shape === "square") ctx.fillRect(cx - 12, cy - 12, 24, 24);

  if (card.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx - 14, cy + 14);
    ctx.lineTo(cx + 14, cy + 14);
    ctx.fill();
  }

  if (card.shape === "star") ctx.fillText("★", cx - 8, cy + 5);

  if (card.shape === "cross") {
    ctx.fillRect(cx - 3, cy - 14, 6, 28);
    ctx.fillRect(cx - 14, cy - 3, 28, 6);
  }

  const img = c.toDataURL();
  cache.set(key, img);
  return img;
}

// =========================
// COMPONENT
// =========================
export default function WhotGame({ gameId, goHome, stake = 0, pot = 0 }) {
  const [game, setGame] = useState(null);
  const [userId, setUserId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  const gameRef = useRef(null);

  function notify(msg) {
    setMessage(msg);
  }

  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      const g = await databases.getDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId
      );
      const parsed = parseGame(g);
      setGame(parsed);
      gameRef.current = parsed;
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      res => {
        const parsed = parseGame(res.payload);
        setGame({ ...parsed });
        gameRef.current = parsed;
      }
    );

    return () => unsub();
  }, [gameId, userId]);

  if (!game || !userId) {
    return <div style={styles.center}>Loading...</div>;
  }

  const myIdx = game.players.indexOf(userId);
  const oppIdx = myIdx === 0 ? 1 : 0;

  const hand = game.hands[myIdx] || [];
  const opponentHand = game.hands[oppIdx] || [];
  const top = decodeCard(game.discard);

  // =========================
  // PLAY CARD
  // =========================
  async function playCard(i) {
    if (processing) return;
    setProcessing(true);

    try {
      const g = parseGame(
        await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId)
      );

      if (g.turn !== userId) return notify("Not your turn");

      const myIdx = g.players.indexOf(userId);
      const oppIdx = myIdx === 0 ? 1 : 0;

      const card = g.hands[myIdx][i];
      const current = decodeCard(card);
      const topDecoded = decodeCard(g.discard);

      if (
        current.number !== topDecoded.number &&
        current.shape !== topDecoded.shape &&
        current.number !== 14
      ) return notify("Invalid move");

      g.hands[myIdx].splice(i, 1);

      playSound.play();

      g.history.push(`${current.shape} ${current.number}`);

      let nextTurn = g.players[oppIdx];

      if (current.number === 2) {
        g.pendingPick += 2;
        g.history.push("Pick 2 🔥");
      } else if (current.number === 8) {
        nextTurn = userId;
        g.history.push("Suspension ⛔");
      } else if (current.number === 1) {
        nextTurn = userId;
        g.history.push("Hold On 🔁");
      } else if (current.number === 14) {
        g.pendingPick += 1;
        g.history.push("General Market 🛒");
      }

      // WIN
      if (g.hands[myIdx].length === 0) {
        await databases.updateDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId,
          {
            ...encodeGame(g),
            discard: card,
            status: "finished",
            winnerId: userId
          }
        );
        return;
      }

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        {
          ...encodeGame(g),
          discard: card,
          turn: nextTurn
        }
      );

    } finally {
      setProcessing(false);
    }
  }

  // =========================
  // DRAW
  // =========================
  async function drawMarket() {
    if (processing) return;
    setProcessing(true);

    try {
      const g = parseGame(
        await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId)
      );

      if (g.turn !== userId) return;

      let count = g.pendingPick || 1;

      const myIdx = g.players.indexOf(userId);
      const oppIdx = myIdx === 0 ? 1 : 0;

      for (let i = 0; i < count; i++) {
        if (!g.deck.length) break;
        g.hands[myIdx].push(g.deck.pop());
      }

      drawSound.play();

      g.history.push(`Drew ${count}`);

      g.pendingPick = 0;

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        {
          ...encodeGame(g),
          turn: g.players[oppIdx]
        }
      );

    } finally {
      setProcessing(false);
    }
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.bg}>
      <div style={styles.box}>
        <h2>🎮 WHOT</h2>

        <p>💰 Stake: ₦{stake} | Pot: ₦{pot}</p>

        <p>{game.turn === userId ? "🟢 Your Turn" : "⏳ Opponent Turn"}</p>

        {game.pendingPick > 0 && (
          <p style={{ color: "red" }}>Pick {game.pendingPick}</p>
        )}

        {/* OPPONENT */}
        <p>Opponent Cards: {opponentHand.length}</p>

        <div style={styles.row}>
          {opponentHand.map((_, i) => (
            <div key={i} style={styles.back}></div>
          ))}
        </div>

        {/* CENTER */}
        <div style={styles.centerRow}>
          {top && <img src={drawCard(top)} style={{ width: 70 }} />}
          <button onClick={drawMarket}>
            MARKET ({game.deck.length})
          </button>
        </div>

        {/* PLAYER HAND */}
        <div style={styles.hand}>
          {hand.map((c, i) => {
            const d = decodeCard(c);
            return (
              <img
                key={i}
                src={drawCard(d)}
                style={styles.card}
                onClick={() => playCard(i)}
              />
            );
          })}
        </div>

        {/* HISTORY */}
        <div style={styles.history}>
          <h4>Moves</h4>
          {game.history.slice().reverse().map((h, i) => (
            <div key={i}>{h}</div>
          ))}
        </div>

        <button onClick={goHome}>Exit</button>
      </div>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  bg: {
    minHeight: "100vh",
    background: "green",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  box: {
    width: "95%",
    maxWidth: 420,
    background: "#000000cc",
    padding: 10,
    color: "#fff"
  },
  row: {
    display: "flex",
    gap: 3,
    justifyContent: "center",
    flexWrap: "wrap"
  },
  back: {
    width: 20,
    height: 30,
    background: "#222",
    border: "1px solid gold"
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    margin: "10px 0"
  },
  hand: {
    display: "flex",
    overflowX: "auto",
    gap: 5,
    padding: 5
  },
  card: {
    width: 60,
    cursor: "pointer"
  },
  history: {
    marginTop: 10,
    maxHeight: 120,
    overflowY: "auto",
    background: "#111",
    padding: 5
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh"
  }
};