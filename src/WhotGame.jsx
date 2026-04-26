import { useEffect, useRef, useState } from "react";
import { databases, DATABASE_ID, account } from "./lib/appwrite";

const GAME_COLLECTION = "games";
const MATCH_COLLECTION = "matches";

// =========================
// SAFE PARSE GAME
// =========================
function parseGame(g) {
  return {
    ...g,
    players: g.players ? g.players.split(",").filter(Boolean) : [],
    deck: g.deck ? g.deck.split(",").filter(Boolean) : [],
    discard: g.discard || "",
    hands: g.hands
      ? g.hands.split("|").map(p =>
          p ? p.split(",").filter(Boolean) : []
        )
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
    history: g.history.slice(-10).join("||")
  };
}

// =========================
// SAFE DECODE CARD
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

  const shape = map[str[0]];
  const number = Number(str.slice(1));

  if (!shape || !number) return null;

  return { shape, number };
}

// =========================
// DRAW CARD (CANVAS)
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

  if (card.shape === "square") {
    ctx.fillRect(cx - 12, cy - 12, 24, 24);
  }

  if (card.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 14);
    ctx.lineTo(cx - 14, cy + 14);
    ctx.lineTo(cx + 14, cy + 14);
    ctx.fill();
  }

  if (card.shape === "star") {
    ctx.fillText("★", cx - 8, cy + 5);
  }

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
export default function WhotGame({ gameId, goHome }) {
  const [game, setGame] = useState(null);
  const [match, setMatch] = useState(null);
  const [userId, setUserId] = useState(null);
  const [processing, setProcessing] = useState(false);

  const gameRef = useRef(null);

  // LOAD USER
  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

  // LOAD GAME + REALTIME
  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      try {
        const g = await databases.getDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId
        );

        const parsed = parseGame(g);
        setGame(parsed);
        gameRef.current = parsed;
      } catch {
        setTimeout(load, 800);
      }
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      res => {
        const parsed = parseGame(res.payload);
        setGame(parsed);
        gameRef.current = parsed;
      }
    );

    return () => unsub();
  }, [gameId, userId]);

  // LOAD MATCH
  useEffect(() => {
    if (!game?.matchId) return;

    databases
      .getDocument(DATABASE_ID, MATCH_COLLECTION, game.matchId)
      .then(setMatch)
      .catch(() => {});
  }, [game]);

  // =========================
  // GUARDS
  // =========================
  if (!game || !userId) {
    return <div style={styles.center}>Loading...</div>;
  }

  if (!game.players.includes(userId)) {
    return <div style={styles.center}>Not your game</div>;
  }

  const pIndex = game.players.indexOf(userId);
  const oIndex = pIndex === 0 ? 1 : 0;

  const hand = game.hands[pIndex] || [];
  const opponentHand = game.hands[oIndex] || [];

  const top = decodeCard(game.discard);

  // =========================
  // PLAY CARD (FIXED)
  // =========================
  async function playCard(i) {
  if (processing) return;

  const currentGame = gameRef.current;
  if (!currentGame) return;

  if (currentGame.turn !== userId) {
    alert("⏳ Not your turn");
    return;
  }

  const myIndex = currentGame.players.indexOf(userId);
  const cardStr = currentGame.hands[myIndex]?.[i];

  if (!cardStr) {
    alert("Invalid card");
    return;
  }

  const current = decodeCard(cardStr);
  const top = decodeCard(currentGame.discard);

  if (!current || !top) {
    alert("Game sync error");
    return;
  }

  // ❌ INVALID MOVE
  if (
    current.number !== top.number &&
    current.shape !== top.shape &&
    current.number !== 14
  ) {
    alert("❌ Invalid move");
    return;
  }

  setProcessing(true);

  try {
    const fresh = await databases.getDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId
    );

    const g = parseGame(fresh);

    const myIdx = g.players.indexOf(userId);
    const oppIdx = myIdx === 0 ? 1 : 0;

    const card = g.hands[myIdx]?.[i];
    if (!card) return;

    const decoded = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    if (!decoded || !topDecoded) return;

    if (
      decoded.number !== topDecoded.number &&
      decoded.shape !== topDecoded.shape &&
      decoded.number !== 14
    ) return;

    // ✅ PLAY CARD
    g.hands[myIdx].splice(i, 1);

    let nextTurn = g.players[oppIdx];

    if (decoded.number === 2) g.pendingPick += 2;
    else if (decoded.number === 8 || decoded.number === 1)
      nextTurn = userId;
    else if (decoded.number === 14) g.pendingPick += 1;

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
  // DRAW MARKET (FIXED)
  // =========================
  async function drawMarket() {
  if (processing) return;

  const currentGame = gameRef.current;
  if (!currentGame) return;

  if (currentGame.turn !== userId) {
    alert("⏳ Not your turn");
    return;
  }

  setProcessing(true);

  try {
    const fresh = await databases.getDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId
    );

    const g = parseGame(fresh);

    const myIdx = g.players.indexOf(userId);
    const oppIdx = myIdx === 0 ? 1 : 0;

    let count = g.pendingPick || 1;

    if (!g.deck.length) {
      alert("No cards in market");
      return;
    }

    for (let i = 0; i < count; i++) {
      if (!g.deck.length) break;
      g.hands[myIdx].push(g.deck.pop());
    }

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
        <h2>WHOT GAME</h2>

        {match && (
          <div style={styles.info}>
            💰 Stake: ₦{match.stake} | 🏆 Pot: ₦{match.pot}
          </div>
        )}

        <p>
          Turn: {game.turn === userId ? "🟢 You" : "⏳ Opponent"}
        </p>

        <div>
          Opponent: {opponentHand.length} cards
          <div style={styles.row}>
            {opponentHand.map((_, i) => (
              <div key={i} style={styles.back}></div>
            ))}
          </div>
        </div>

        <div style={styles.centerRow}>
          {top ? (
            <img src={drawCard(top)} style={{ width: 65 }} />
          ) : (
            <div style={styles.error}>No Card</div>
          )}

          <button onClick={drawMarket}>
            MARKET ({game.deck.length})
          </button>
        </div>

        <div style={styles.row}>
          {hand.map((c, i) => {
            const decoded = decodeCard(c);
            if (!decoded) return <div key={i} style={styles.error}>?</div>;

            return (
              <img
                key={i}
                src={drawCard(decoded)}
                style={{
                  width: 65,
                  cursor: "pointer",
                  border:
                    game.turn === userId
                      ? "2px solid gold"
                      : "2px solid transparent"
                }}
                onClick={() => playCard(i)}
              />
            );
          })}
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
    alignItems: "center",
    padding: 10
  },
  box: {
    width: "100%",
    maxWidth: 420,
    background: "#00000088",
    padding: 10,
    color: "#fff"
  },
  row: {
    display: "flex",
    gap: 5,
    justifyContent: "center"
  },
  back: {
    width: 30,
    height: 45,
    background: "#222",
    border: "2px solid gold"
  },
  centerRow: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    margin: "10px 0"
  },
  info: {
    background: "#111",
    padding: 8,
    marginBottom: 10
  },
  error: {
    width: 65,
    height: 90,
    background: "red",
    display: "flex",
    justifyContent: "center",
    alignItems: "center"
  },
  center: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    height: "100vh"
  }
};