import { useEffect, useRef, useState } from "react";
import { databases, DATABASE_ID, account } from "./lib/appwrite";

const GAME_COLLECTION = "games";

// =========================
// SOUND (NO FILES)
// =========================
function beep(freq = 400, duration = 120) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.frequency.value = freq;
  osc.type = "square";

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start();

  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration / 1000);

  setTimeout(() => {
    osc.stop();
    ctx.close();
  }, duration);
}

// =========================
// HELPERS
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
// PARSE / ENCODE
// =========================
function parseGame(g) {
  return {
    ...g,
    players: g.players ? g.players.split(",") : [],
    deck: g.deck ? g.deck.split(",").filter(Boolean) : [],
    hands: g.hands
      ? g.hands.split("|").map(p => p.split(",").filter(Boolean))
      : [[], []],
    pendingPick: Number(g.pendingPick || 0),
    history: g.history ? g.history.split("||") : [],
    scores: g.scores ? g.scores.split(",").map(Number) : [0, 0],
    round: Number(g.round || 1),
    stake: Number(g.stake || 0),
    pot: Number(g.pot || 0),
    hostName: g.hostName || "Host",
    opponentName: g.opponentName || "Opponent",
    payoutDone: g.payoutDone || false
  };
}

function encodeGame(g) {
  return {
    hands: g.hands.map(p => p.join(",")).join("|"),
    deck: g.deck.join(","),
    discard: g.discard,
    pendingPick: String(g.pendingPick),
    history: g.history.slice(-10).join("||"),
    scores: g.scores.join(","),
    round: String(g.round)
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
  c.width = 70;
  c.height = 100;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 70, 100);

  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 66, 96);

  ctx.fillStyle = "#e11d48";
  ctx.font = "bold 12px Arial";
  ctx.fillText(card.number, 5, 15);

  const cx = 35, cy = 50;

  if (card.shape === "circle") {
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.fill();
  }

  if (card.shape === "square") ctx.fillRect(cx - 10, cy - 10, 20, 20);

  if (card.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 10);
    ctx.lineTo(cx - 10, cy + 10);
    ctx.lineTo(cx + 10, cy + 10);
    ctx.fill();
  }

  if (card.shape === "star") ctx.fillText("★", cx - 6, cy + 5);

  if (card.shape === "cross") {
    ctx.fillRect(cx - 2, cy - 10, 4, 20);
    ctx.fillRect(cx - 10, cy - 2, 20, 4);
  }

  const img = c.toDataURL();
  cache.set(key, img);
  return img;
}

// =========================
// COMPONENT
// =========================
export default function WhotGame({ gameId, goHome }) {
  const [game, setGame] = useState(null);
  const [userId, setUserId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [showWin, setShowWin] = useState(false);

  const winnerRef = useRef(null);

  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      const g = await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId);
      setGame(parseGame(g));
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      res => {
        const parsed = parseGame(res.payload);
        setGame(parsed);

        // 🎉 Trophy trigger
        if (parsed.status === "finished" && !winnerRef.current) {
          winnerRef.current = true;
          setShowWin(true);
          beep(800, 200);
          beep(1000, 200);
        }
      }
    );

    return () => unsub();
  }, [gameId, userId]);

  if (!game || !userId) return <div style={styles.center}>Loading...</div>;

  const myIdx = game.players.indexOf(userId);
  const oppIdx = myIdx === 0 ? 1 : 0;

  const hand = game.hands[myIdx];
  const opponentHand = game.hands[oppIdx];
  const top = decodeCard(game.discard);

  // =========================
  // END GAME
  // =========================
  async function endGame(winnerIdx, g) {
    if (g.payoutDone) return;

    const adminFee = Math.floor(g.pot * 0.1);

    await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
      status: "pending_admin_payout",
      winnerId: g.players[winnerIdx],
      adminFee,
      payoutDone: true
    });
  }

  // =========================
  // PLAY
  // =========================
  async function playCard(i) {
    if (processing) return;
    setProcessing(true);

    const g = parseGame(await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId));

    if (g.turn !== userId) {
      setProcessing(false);
      return alert("Not your turn");
    }

    const card = g.hands[myIdx][i];
    const current = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    if (
      current.number !== topDecoded.number &&
      current.shape !== topDecoded.shape &&
      current.number !== 14
    ) {
      setProcessing(false);
      return alert("Invalid move");
    }

    g.hands[myIdx].splice(i, 1);

    let nextTurn = g.players[oppIdx];
    let text = `${current.shape} ${current.number}`;

    beep(500, 80);

    if (current.number === 2) {
      g.pendingPick += 2;
      text = "🔥 PICK 2";
    } else if (current.number === 8) {
      nextTurn = userId;
      text = "⛔ SUSPENSION";
    } else if (current.number === 1) {
      nextTurn = userId;
      text = "🔁 HOLD ON";
    } else if (current.number === 14) {
      g.pendingPick += 1;
      nextTurn = userId;
      text = "🛒 GENERAL MARKET";
    }

    g.history.push(text);

    // 🎯 ROUND WIN
    if (g.hands[myIdx].length === 0) {
      g.scores[myIdx]++;
      beep(900, 200);

      if (g.scores[myIdx] >= 2) {
        await endGame(myIdx, g);
        setProcessing(false);
        return;
      }
    }

    await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
      ...encodeGame(g),
      discard: card,
      turn: nextTurn
    });

    setProcessing(false);
  }

  // =========================
  // DRAW
  // =========================
  async function drawMarket() {
    if (processing) return;
    setProcessing(true);

    const g = parseGame(await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId));

    if (g.turn !== userId) {
      setProcessing(false);
      return alert("Not your turn");
    }

    let count = g.pendingPick || 1;

    for (let i = 0; i < count; i++) {
      if (!g.deck.length) break;
      g.hands[myIdx].push(g.deck.pop());
    }

    beep(300, 100);

    g.pendingPick = 0;
    g.history.push(`📦 Drew ${count}`);

    await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
      ...encodeGame(g),
      turn: g.players[oppIdx]
    });

    setProcessing(false);
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.bg}>
      {showWin && (
        <div style={styles.winBox}>
          🏆 WINNER!
        </div>
      )}

      <div style={styles.box}>
        <h2>🎮 WHOT GAME</h2>

        <div style={styles.rowBetween}>
          <span>👤 {game.hostName}</span>
          <span>VS</span>
          <span>👤 {game.opponentName}</span>
        </div>

        <div style={styles.rowBetween}>
          <span>Round {game.round}/3</span>
          <span>{game.scores[0]} - {game.scores[1]}</span>
        </div>

        <div style={styles.rowBetween}>
          <span>💰 ₦{game.stake}</span>
          <span>🏦 ₦{game.pot}</span>
        </div>

        <p style={{
          color: game.turn === userId ? "#22c55e" : "#f87171",
          fontWeight: "bold"
        }}>
          {game.turn === userId ? "🟢 YOUR TURN" : "⏳ OPPONENT"}
        </p>

        <p>Opponent Cards: {opponentHand.length}</p>

        <div style={styles.centerRow}>
          {top && <img src={drawCard(top)} />}
          <button onClick={drawMarket}>
            🃏 MARKET ({game.deck.length})
          </button>
        </div>

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

        <div style={styles.history}>
          {game.history.slice().reverse().map((h, i) => (
            <div key={i} style={{
              color: h.includes("PICK") || h.includes("SUSPENSION") || h.includes("HOLD") || h.includes("MARKET")
                ? "#ef4444"
                : "#fff",
              fontWeight: "bold"
            }}>
              {h}
            </div>
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
    maxWidth: 450,
    background: "#000000cc",
    padding: 12,
    color: "#fff",
    borderRadius: 10
  },
  winBox: {
    position: "absolute",
    top: "40%",
    background: "#000",
    color: "gold",
    padding: 20,
    fontSize: 24,
    borderRadius: 10
  },
  rowBetween: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6
  },
  hand: {
    display: "flex",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 6,
    marginTop: 10
  },
  card: {
    width: 65,
    cursor: "pointer"
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    gap: 10
  },
  history: {
    marginTop: 10,
    maxHeight: 120,
    overflow: "auto",
    fontSize: 12
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh"
  }
};