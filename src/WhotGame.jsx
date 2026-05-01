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
// 🔊 SOUND
// =========================
function beep(freq = 400, duration = 120) {
  try {
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
// PARSE / ENCODE
// =========================
function parseGame(g) {
  return {
    ...g,
    players: g.players?.split(",") || [],
    deck: g.deck?.split(",").filter(Boolean) || [],
    hands: g.hands?.split("|").map(p => p.split(",").filter(Boolean)) || [[], []],
    pendingPick: Number(g.pendingPick || 0),
    history: g.history?.split("||").filter(Boolean) || [],
    scores: g.scores?.split(",").map(Number) || [0, 0],
    round: Number(g.round || 1),
    status: g.status || "playing",
    payoutDone: Boolean(g.payoutDone),
    hostName: g.hostName || "Player 1",
    opponentName: g.opponentName || "Player 2"
  };
}

function encodeGame(g) {
  return {
    hands: g.hands.map(p => p.join(",")).join("|"),
    deck: g.deck.join(","),
    discard: g.discard,
    pendingPick: String(g.pendingPick),
    history: g.history.slice(-30).join("||"),
    scores: g.scores.join(","),
    round: String(g.round),
    status: g.status
  };
}

// =========================
// COMPONENT
// =========================
export default function WhotGame({ gameId, goHome }) {
  const [game, setGame] = useState(null);
  const [match, setMatch] = useState(null);
  const [userId, setUserId] = useState(null);
  const [showWin, setShowWin] = useState(false);

  const payoutRef = useRef(false);
  const actionLock = useRef(false);

  useEffect(() => {
    account.get().then(u => setUserId(u.$id)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      const g = await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId);
      setGame(parseGame(g));

      if (g.matchId) {
        const m = await databases.getDocument(DATABASE_ID, MATCH_COLLECTION, g.matchId);
        setMatch(m);
      }
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      async (res) => {
        const parsed = parseGame(res.payload);
        setGame(parsed);

        if (parsed.status === "finished") {

          if (parsed.winnerId === userId) {
            setShowWin(true);
            setTimeout(goHome, 3000);
          } else {
            setTimeout(goHome, 2500);
          }

          if (payoutRef.current) return;

          const freshGame = await databases.getDocument(
            DATABASE_ID,
            GAME_COLLECTION,
            parsed.$id
          );

          if (freshGame.payoutDone) return;

          payoutRef.current = true;

          try {
            const freshMatch = parsed.matchId
              ? await databases.getDocument(DATABASE_ID, MATCH_COLLECTION, parsed.matchId)
              : null;

            const total = Number(freshMatch?.pot || 0);

            const w = await databases.listDocuments(
              DATABASE_ID,
              WALLET_COLLECTION,
              [Query.equal("userId", parsed.winnerId)]
            );

            if (w.documents.length) {
              await databases.updateDocument(
                DATABASE_ID,
                WALLET_COLLECTION,
                w.documents[0].$id,
                {
                  balance: Number(w.documents[0].balance || 0) + total
                }
              );
            }

            for (let pid of parsed.players) {
              const wallets = await databases.listDocuments(
                DATABASE_ID,
                WALLET_COLLECTION,
                [Query.equal("userId", pid)]
              );

              if (wallets.documents.length) {
                await databases.updateDocument(
                  DATABASE_ID,
                  WALLET_COLLECTION,
                  wallets.documents[0].$id,
                  { locked: 0 }
                );
              }
            }

            await databases.updateDocument(
              DATABASE_ID,
              GAME_COLLECTION,
              parsed.$id,
              { payoutDone: true }
            );

            if (parsed.matchId) {
              await databases.updateDocument(
                DATABASE_ID,
                MATCH_COLLECTION,
                parsed.matchId,
                { status: "finished" }
              );
            }

          } catch (e) {
            console.log("payout error", e);
          }
        }
      }
    );

    return () => unsub();
  }, [gameId, userId]);

  if (!game || !userId) return <div>Loading...</div>;

  const myIdx = game.players.indexOf(userId);
  const oppIdx = myIdx === 0 ? 1 : 0;

  const hand = game.hands[myIdx];
  const oppCards = game.hands[oppIdx].length;
  const top = decodeCard(game.discard);

  const myName = myIdx === 0 ? game.hostName : game.opponentName;
  const oppName = myIdx === 0 ? game.opponentName : game.hostName;

  async function endRound(g, winnerIdx) {
    g = JSON.parse(JSON.stringify(g));

    g.scores[winnerIdx]++;

    const p1 = g.scores[0];
    const p2 = g.scores[1];

    if (p1 >= 2 || p2 >= 2) {
      await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
        ...encodeGame(g),
        status: "finished",
        winnerId: g.players[winnerIdx]
      });
      return;
    }

    if (g.round === 3 && p1 === 1 && p2 === 1) {
      g.history.push("⚖️ DRAW → FINAL ROUND");
    }

    const deck = createDeck();
    g.hands = [deck.splice(0, 6), deck.splice(0, 6)];
    g.discard = deck.pop();
    g.deck = deck;
    g.pendingPick = 0;
    g.round = Math.min(g.round + 1, 4);

    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      encodeGame(g)
    );
  }

  async function playCard(i) {
    if (actionLock.current) return;
    if (game.status === "finished") return;
    if (game.turn !== userId) {
      beep(150);
      return;
    }

    actionLock.current = true;

    const g = JSON.parse(JSON.stringify(game));

    const card = g.hands[myIdx][i];
    const current = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    if (g.pendingPick > 0 && current.number !== 2) {
      beep(200);
      actionLock.current = false;
      return;
    }

    if (
      current.number !== topDecoded.number &&
      current.shape !== topDecoded.shape &&
      current.number !== 14
    ) {
      beep(120);
      actionLock.current = false;
      return;
    }

    g.hands[myIdx].splice(i, 1);

    g.history = [...g.history.slice(-20), `👤 ${myName} → ${card}`];

    let nextTurn = g.players[oppIdx];

    if (current.number === 2) {
      g.pendingPick += 2;
      g.history.push(`🔥 PICK 2 → ${g.pendingPick}`);
    }

    if ([1,8,14].includes(current.number)) nextTurn = userId;

    setGame({ ...g, discard: card, turn: nextTurn });

    if (!g.hands[myIdx].length) {
      await endRound(g, myIdx);
      actionLock.current = false;
      return;
    }

    await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
      ...encodeGame(g),
      discard: card,
      turn: nextTurn
    });

    actionLock.current = false;
  }

  async function drawMarket() {
    if (actionLock.current) return;
    if (game.status === "finished") return;
    if (game.turn !== userId) return;

    actionLock.current = true;

    const g = JSON.parse(JSON.stringify(game));

    let count = g.pendingPick > 0 ? g.pendingPick : 1;

    for (let i = 0; i < count; i++) {
      if (!g.deck.length) break;
      g.hands[myIdx].push(g.deck.pop());
    }

    g.pendingPick = 0;
    g.history.push(`📦 DRAW ${count}`);

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
        <h2>🎮 WHOT GAME</h2>

        <div style={styles.row}>
          <span>{myName}</span>
          <span>VS</span>
          <span>{oppName}</span>
        </div>

        <div style={{ textAlign: "center" }}>
          {Array.from({ length: oppCards }).map((_, i) => (
            <img key={i} src={drawBack()} style={{ width: 40 }} />
          ))}
          <div>{oppName}: {oppCards}</div>
        </div>

        <div style={styles.row}>
          <span>Round {game.round}</span>
          <span>{game.scores[0]} - {game.scores[1]}</span>
        </div>

        <div style={styles.row}>
          <span>₦{match?.stake || 0}</span>
          <span>🏦 ₦{match?.pot || 0}</span>
        </div>

        <p>{game.status === "finished"
          ? "🏁 GAME FINISHED"
          : game.turn === userId
          ? "🟢 YOUR TURN"
          : "⏳ OPPONENT"}</p>

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
              onClick={() => playCard(i)}
            />
          ))}
        </div>

        {showWin && (
          <div style={styles.winBox}>
            🎉 You Won ₦{match?.pot || 0}
          </div>
        )}

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
  marketBtn: {
    background: "gold",
    padding: 10,
    borderRadius: 8,
    border: "none"
  },
  history: {
    marginTop: 10,
    maxHeight: 120,
    overflow: "auto",
    fontSize: 12,
    color: "#ff4d4d"
  },
  winBox: {
    position: "fixed",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "gold",
    color: "#000",
    padding: 20,
    borderRadius: 10,
    fontWeight: "bold",
    zIndex: 999
  }
};