import { useEffect, useRef, useState } from "react";
import {
  databases,
  DATABASE_ID,
  account,
  Query
} from "./lib/appwrite";

const GAME_COLLECTION = "games";
const MATCH_COLLECTION = "matches";
const WALLET_COLLECTION = "wallets";

// =========================
// 🔊 SOUND + ERROR
// =========================
function beep(freq = 200, duration = 200) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = freq;
    osc.type = "square";

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + duration / 1000
    );

    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, duration);
  } catch {}
}

// =========================
// 🎴 DECK
// =========================
function createDeck() {
  const valid = {
    c: [1,2,3,4,5,7,8,10,11,12,13,14],
    t: [1,2,3,4,5,7,8,10,11,12,13,14],
    s: [1,2,3,5,7,10,11,13,14],
    x: [1,2,3,5,7,10,11,13,14],
    r: [1,2,3,4,5,7,8]
  };

  let deck = [];
  Object.keys(valid).forEach(shape => {
    valid[shape].forEach(n => deck.push(shape + n));
  });

  return deck.sort(() => Math.random() - 0.5);
}

// =========================
// 🎴 DECODE
// =========================
function decodeCard(str) {
  if (!str || typeof str !== "string") return null;

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
// 🎴 DRAW CARD
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
  ctx.font = "bold 14px Arial";
  ctx.fillText(card.number, 6, 18);

  const cx = 35, cy = 55;

  if (card.shape === "circle") {
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  if (card.shape === "square") ctx.fillRect(cx - 12, cy - 12, 24, 24);

  if (card.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.fill();
  }

  if (card.shape === "star") {
    ctx.font = "20px Arial";
    ctx.fillText("★", cx - 8, cy + 8);
  }

  if (card.shape === "cross") {
    ctx.fillRect(cx - 3, cy - 12, 6, 24);
    ctx.fillRect(cx - 12, cy - 3, 24, 6);
  }

  const img = c.toDataURL();
  cache.set(key, img);
  return img;
}

function drawBack() {
  const c = document.createElement("canvas");
  c.width = 65;
  c.height = 100;
  const ctx = c.getContext("2d");

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 65, 100);

  ctx.strokeStyle = "#fff";
  ctx.strokeRect(2, 2, 61, 96);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 20px Arial";
  ctx.fillText("🂠", 18, 60);

  return c.toDataURL();
}

// =========================
// INIT GAME FIX
// =========================
async function ensureGameReady(g) {
  let updated = false;
  const copy = JSON.parse(JSON.stringify(g));

  if (!copy.deck?.length || !copy.hands?.length || !copy.discard) {
    const deck = createDeck();

    copy.hands = [deck.splice(0, 6), deck.splice(0, 6)];
    copy.discard = deck.pop();
    copy.deck = deck;
    copy.pendingPick = 0;
    copy.turn = copy.players?.[0] || null;
    copy.round = 1;
    copy.scores = [0, 0];
    copy.status = "playing";

    updated = true;
  }

  if (updated) {
    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      g.$id,
      encodeGame(copy)
    );
  }

  return copy;
}

// =========================
// PARSE / ENCODE
// =========================
function parseGame(g) {
  const safeSplit = (v, sep) =>
    typeof v === "string" ? v.split(sep).filter(Boolean) : [];

  return {
    ...g,
    players: Array.isArray(g.players) ? g.players : safeSplit(g.players, ","),
    hands: safeSplit(g.hands, "|").map(p => safeSplit(p, ",")),
    deck: safeSplit(g.deck, ","),
    discard: g.discard || null,
    turn: g.turn || null,
    pendingPick: Number(g.pendingPick || 0),
    history: safeSplit(g.history, "||"),
    scores: safeSplit(g.scores, ",").map(Number) || [0,0],
    round: Number(g.round || 1),
    status: g.status || "playing",
    pot: Number(g.pot || 0)
  };
}

function encodeGame(g) {
  return {
    hands: g.hands.map(p => p.join(",")).join("|"),
    deck: g.deck.join(","),
    discard: g.discard || "",
    turn: g.turn,
    pendingPick: String(g.pendingPick),
    history: (g.history || []).slice(-10).join("||"),
    scores: g.scores.join(","),
    round: String(g.round),
    status: g.status
  };
}

// =========================
// COMPONENT
// =========================
export default function WhotGame({ gameId, goHome, openChat }) {

  const [game, setGame] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState("");
  const [unread, setUnread] = useState(0);

  const actionLock = useRef(false);

  function invalidMove(msg) {
    beep(120, 300);
    setError(msg);
    setTimeout(() => setError(""), 1000);
  }

  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      const g = await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId);
      let parsed = parseGame(g);
      parsed = await ensureGameReady(parsed);
      setGame(parsed);
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      async (res) => {
        let parsed = parseGame(res.payload);
        parsed = await ensureGameReady(parsed);
        setGame(parsed);
      }
    );

    return () => unsub();
  }, [gameId, userId]);

  if (!game || !userId) return <div>Loading...</div>;

  const myIdx = game.players.indexOf(userId);
  const oppIdx = myIdx === 0 ? 1 : 0;

  const hand = game.hands[myIdx] || [];
  const oppCards = game.hands[oppIdx]?.length || 0;
  const top = decodeCard(game.discard);

  async function drawMarket() {
    if (actionLock.current) return;
    if (game.turn !== userId) return invalidMove("Wait");

    actionLock.current = true;

    const g = JSON.parse(JSON.stringify(game));

    if (!g.deck.length) {
      const winner = g.hands[0].length <= g.hands[1].length ? 0 : 1;
      await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
        status: "finished",
        winnerId: g.players[winner]
      });
      actionLock.current = false;
      return;
    }

    g.hands[myIdx].push(g.deck.pop());

    setGame({ ...g, turn: g.players[oppIdx] });

    await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
      ...encodeGame(g),
      turn: g.players[oppIdx]
    });

    actionLock.current = false;
  }

  return (
    <div style={styles.bg}>
      <div style={styles.box}>

        <button style={styles.chatBtn} onClick={() => openChat(gameId)}>
          💬 {unread > 0 && <span style={styles.badge}>{unread}</span>}
        </button>

        <h2>🎮 WHOT GAME</h2>

        {error && <div style={styles.error}>{error}</div>}

        <div style={styles.row}>
          <span>YOU</span>
          <span>VS</span>
          <span>OPP</span>
        </div>

        <div style={{ textAlign: "center" }}>
          {Array.from({ length: oppCards }).map((_, i) => (
            <img key={i} src={drawBack()} style={{ width: 40 }} />
          ))}
        </div>

        <div style={styles.row}>
          <span>Round {game.round}</span>
          <span>{game.scores[0]} - {game.scores[1]}</span>
        </div>

        <div style={styles.row}>
          <span>🏦 ₦{game.pot}</span>
        </div>

        <div style={styles.center}>
          {top && <img src={drawCard(top)} style={styles.card} />}
          <button style={styles.marketBtn} onClick={drawMarket}>
            🃏 {game.deck.length}
          </button>
        </div>

        <div style={styles.hand}>
          {hand.map((c, i) => (
            <img
              key={i}
              src={drawCard(decodeCard(c))}
              style={styles.card}
            />
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
  bg: { minHeight: "100vh", background: "green", display: "flex", justifyContent: "center", alignItems: "center" },
  box: { width: "95%", maxWidth: 450, background: "#000000cc", padding: 12, color: "#fff", borderRadius: 10, position: "relative" },
  row: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  hand: { display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", marginTop: 10 },
  card: { width: 65 },
  center: { display: "flex", justifyContent: "center", gap: 10, marginTop: 10 },
  marketBtn: { background: "gold", padding: 10, borderRadius: 8, border: "none" },

  chatBtn: {
    position: "absolute",
    top: 10,
    left: 10,
    background: "#111",
    color: "#fff",
    border: "none",
    padding: "10px 14px",
    borderRadius: "50px",
    zIndex: 999
  },

  badge: { background: "red", marginLeft: 6, padding: "2px 6px", borderRadius: 10, fontSize: 12 },
  error: { background: "red", padding: 6, textAlign: "center", marginBottom: 6 }
};