import { useEffect, useRef, useState } from "react";
import { databases, DATABASE_ID, account } from "./lib/appwrite";

const GAME_COLLECTION = "games";
const MATCH_COLLECTION = "matches";
const WALLET_COLLECTION = "wallets";

const ADMIN_ID = "69ef9fe863a02a7490b4";

// =========================
// 🔊 SOUND
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
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    ctx.currentTime + duration / 1000
  );

  setTimeout(() => {
    osc.stop();
    ctx.close();
  }, duration);
}

// =========================
// 🎴 DECK
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
// CARD DECODE
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
// 🎨 CARD DRAW
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

  const cx = 35,
    cy = 50;

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
// PARSE GAME
// =========================
function parseGame(g) {
  return {
    ...g,
    players: g.players?.split(",") || [],
    deck: g.deck?.split(",").filter(Boolean) || [],
    hands:
      g.hands?.split("|").map((p) => p.split(",").filter(Boolean)) || [[], []],
    pendingPick: Number(g.pendingPick || 0),
    history: g.history?.split("||").filter(Boolean) || [],
    scores: g.scores?.split(",").map(Number) || [0, 0],
    round: Number(g.round || 1),
    hostName: g.hostName || "Player 1",
    opponentName: g.opponentName || "Player 2",
    payoutDone: Boolean(g.payoutDone)
  };
}

// =========================
// ENCODE
// =========================
function encodeGame(g) {
  return {
    hands: g.hands.map((p) => p.join(",")).join("|"),
    deck: g.deck.join(","),
    discard: g.discard,
    pendingPick: String(g.pendingPick),
    history: g.history.slice(-12).join("||"),
    scores: g.scores.join(","),
    round: String(g.round)
  };
}

// =========================
// COMPONENT
// =========================
export default function WhotGame({ gameId, goHome }) {
  const [game, setGame] = useState(null);
  const [match, setMatch] = useState(null); // ✅ FIX
  const [userId, setUserId] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [invalidMove, setInvalidMove] = useState(false); // ✅ FIX

  const payoutRef = useRef(false);

  useEffect(() => {
    account.get().then((u) => setUserId(u.$id));
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

      // ✅ LOAD MATCH
      if (g.matchId) {
        const m = await databases.getDocument(
          DATABASE_ID,
          MATCH_COLLECTION,
          g.matchId
        );
        setMatch(m);
      }
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      (res) => {
        const parsed = parseGame(res.payload);
        setGame(parsed);

        if (
          parsed.status === "finished" &&
          !parsed.payoutDone &&
          !payoutRef.current
        ) {
          payoutRef.current = true;
          handlePayout(parsed);
        }
      }
    );

    return () => unsub();
  }, [gameId, userId]);

  if (!game || !userId) return <div>Loading...</div>;

  const myIdx = game.players.indexOf(userId);
  const oppIdx = myIdx === 0 ? 1 : 0;

  const hand = game.hands[myIdx];
  const opponentHand = game.hands[oppIdx];
  const top = decodeCard(game.discard);

  const myName = myIdx === 0 ? game.hostName : game.opponentName;

  // =========================
  // PLAY CARD (FIXED)
  // =========================
  async function playCard(i) {
    if (processing) return;
    setProcessing(true);

    const g = parseGame(
      await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId)
    );

    if (g.turn !== userId) return setProcessing(false);

    const card = g.hands[myIdx][i];
    const current = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    // ❌ INVALID MOVE FIX
    if (
      current.number !== topDecoded.number &&
      current.shape !== topDecoded.shape &&
      current.number !== 14
    ) {
      beep(150, 200);
      setInvalidMove(true);
      setTimeout(() => setInvalidMove(false), 800);
      return setProcessing(false);
    }

    g.hands[myIdx].splice(i, 1);

    let nextTurn = g.players[oppIdx];

    beep(500, 80);

    g.history.push(`${myName}: ${current.shape} ${current.number}`);

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

    setProcessing(false);
  }

  // =========================
  // DRAW
  // =========================
  async function drawMarket() {
    const g = parseGame(
      await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId)
    );

    if (g.turn !== userId) return;

    const card = g.deck.pop();
    g.hands[myIdx].push(card);

    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      {
        ...encodeGame(g),
        turn: g.players[oppIdx]
      }
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.bg}>
      <div style={styles.box}>
        <h2>🎮 WHOT GAME</h2>

        <div style={styles.row}>
          <span>{game.hostName}</span>
          <span>VS</span>
          <span>{game.opponentName}</span>
        </div>

        <div style={styles.row}>
          <span>Round {game.round}</span>
          <span>
            {game.scores[0]} - {game.scores[1]}
          </span>
        </div>

        {/* ✅ FIXED STAKE + POT */}
        <div style={styles.row}>
          <span>₦{match?.stake || 0}</span>
          <span>🏦 ₦{match?.pot || 0}</span>
        </div>

        {/* ❌ INVALID MOVE MESSAGE */}
        {invalidMove && (
          <p style={{ color: "red", fontWeight: "bold" }}>
            ❌ Invalid move
          </p>
        )}

        <p style={{ color: game.turn === userId ? "#22c55e" : "#f87171" }}>
          {game.turn === userId ? "YOUR TURN" : "OPPONENT"}
        </p>

        <p>Opponent Cards: {opponentHand.length}</p>

        <div style={styles.center}>
          {top && <img src={drawCard(top)} />}
          <button style={styles.marketBtn} onClick={drawMarket}>
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
    maxWidth: 450,
    background: "#000000cc",
    padding: 12,
    color: "#fff",
    borderRadius: 10
  },
  row: {
    display: "flex",
    justifyContent: "space-between"
  },
  hand: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: 10
  },
  card: {
    width: 65,
    cursor: "pointer"
  },
  center: {
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
  marketBtn: {
    background: "gold",
    padding: 10,
    borderRadius: 8,
    border: "none",
    fontWeight: "bold"
  }
};