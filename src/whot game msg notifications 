import { useEffect, useRef, useState } from "react";
import {
  databases,
  DATABASE_ID,
  account,
  Query,
  ID
} from "./lib/appwrite";

// 🆕 CHAT
import Messages from "./pages/Messages";

const GAME_COLLECTION = "games";
const MATCH_COLLECTION = "matches";
const WALLET_COLLECTION = "wallets";

// 🔊 SOUND
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

function successSound() {
  beep(600, 200);
  setTimeout(() => beep(800, 200), 150);
}

// 🎴 DECK
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

// 🎴 DECODE
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

  if (card.shape === "star") ctx.fillText("★", cx - 8, cy + 8);

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
  ctx.fillText("🂠", 18, 60);

  return c.toDataURL();
}

function parseGame(g) {
  const split = (v, s) => typeof v === "string" ? v.split(s).filter(Boolean) : [];

  return {
    ...g,
    players: Array.isArray(g.players) ? g.players : split(g.players, ","),
    hands: split(g.hands, "|").map(p => split(p, ",")),
    deck: split(g.deck, ","),
    discard: g.discard || null,
    turn: g.turn || null,
    pendingPick: Number(g.pendingPick || 0),
    history: split(g.history, "||"),
    scores: split(g.scores, ",").map(Number) || [0,0],
    round: Number(g.round || 1),
    status: g.status || "playing",
    payoutDone: Boolean(g.payoutDone),
    winnerId: g.winnerId || null,
    matchId: g.matchId || null,
    hostName: g.hostName || "Player 1",
    opponentName: g.opponentName || "Player 2"
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

// 🧠 SAFE INIT
function ensureGameReady(g) {
  if (g.status === "finished") return g;

  if (!g.deck?.length || !g.hands?.[0]?.length || !g.hands?.[1]?.length || !g.discard) {
    const deck = createDeck();
    return {
      ...g,
      hands: [deck.splice(0,6), deck.splice(0,6)],
      discard: deck.pop(),
      deck,
      pendingPick: 0,
      history: [],
      scores: [0,0],
      round: 1,
      status: "playing"
    };
  }
  return g;
}

// 📝 HISTORY
function pushHistory(g, text) {
  return [...(g.history || []), text].slice(-10);
}
export default function WhotGame({ gameId, goHome }) {

  const [game, setGame] = useState(null);
  const [match, setMatch] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState("");
  const [showWin, setShowWin] = useState(false);

  // 🆕 CHAT STATE
  const [showChat, setShowChat] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);

  const payoutRef = useRef(false);
  const actionLock = useRef(false);

  function invalidMove(msg) {
    beep(120, 300);
    setError(msg);
    setTimeout(() => setError(""), 1200);
  }

  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      let g = null;

      // 🔹 TRY LOAD GAME
      try {
        g = await databases.getDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId
        );
      } catch (e) {
        console.warn("Game not found, recovering...");
      }

      // 🔹 RECOVER FROM MATCH
      if (!g && gameId) {
        try {
          const matchRes = await databases.listDocuments(
            DATABASE_ID,
            MATCH_COLLECTION,
            [Query.equal("gameId", gameId)]
          );

          if (matchRes.documents.length) {
            const m = matchRes.documents[0];
            setMatch(m);

            const deck = createDeck();

            const newGame = {
              players: m.players,
              hands: [deck.splice(0, 6), deck.splice(0, 6)],
              discard: deck.pop(),
              deck,
              turn: m.players[0],
              pendingPick: 0,
              history: [],
              scores: [0, 0],
              round: 1,
              status: "playing",
              matchId: m.$id,
              hostName: m.hostName,
              opponentName: m.opponentName
            };

            const created = await databases.createDocument(
              DATABASE_ID,
              GAME_COLLECTION,
              ID.unique(),
              encodeGame(newGame)
            );

            g = created;
          }
        } catch (err) {
          console.error("Recovery failed:", err);
        }
      }

      if (g) {
        const parsed = ensureGameReady(parseGame(g));
        setGame(parsed);

        if (g.matchId) {
          const m = await databases.getDocument(
            DATABASE_ID,
            MATCH_COLLECTION,
            g.matchId
          );
          setMatch(m);
        }
      }
    };

    load();

    const unsub = databases.client.subscribe(
      `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
      (res) => {
        const parsed = parseGame(res.payload);
        setGame(parsed);

        if (parsed.status === "finished") {
          if (parsed.winnerId === userId) {
            setShowWin(true);
            successSound();
            setTimeout(goHome, 3000);
          } else {
            setTimeout(goHome, 2500);
          }
        }
      }
    );

    return () => unsub();
  }, [gameId, userId]);
// =========================
// 💰 PAYOUT EFFECT
// =========================
useEffect(() => {
  if (!game || !game.matchId) return;

  if (game.status !== "finished") return;
  if (!game.winnerId) return;
  if (game.payoutDone) return;

  // only winner runs payout
  if (userId !== game.winnerId) return;

  if (payoutRef.current) return;

  const runPayout = async () => {
    try {
      // 🔹 GET FRESH MATCH
      const freshMatch = await databases.getDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        game.matchId
      );

      const winAmount = Number(freshMatch?.pot || 0);

      if (!winAmount || winAmount <= 0) {
        console.warn("⚠️ Invalid pot:", freshMatch?.pot);
        return;
      }

      // 🔹 GET WALLET
      const res = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION,
        [Query.equal("userId", game.winnerId)]
      );

      if (!res.documents.length) {
        console.error("❌ Wallet not found");
        return;
      }

      const wallet = res.documents[0];

      // 🔒 LOCK FIRST
      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        game.$id,
        { payoutDone: true }
      );

      payoutRef.current = true;

      // 💰 PAY
      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        {
          balance: Number(wallet.balance || 0) + winAmount
        }
      );

      console.log("✅ Payout success:", winAmount);

    } catch (e) {
      payoutRef.current = false;
      console.error("❌ Payout failed:", e);
    }
  };

  runPayout();

}, [game, userId]);

// =========================
// 💬 MESSAGE INDICATOR
// =========================
useEffect(() => {
  if (!game?.matchId || !userId) return;

  const unsub = databases.client.subscribe(
    `databases.${DATABASE_ID}.collections.messages.documents`,
    (res) => {
      const msg = res.payload;

      // only this match
      if (msg.matchId !== game.matchId) return;

      // ignore own messages
      if (msg.senderId === userId) return;

      // 🔴 mark unread
      setHasUnread(true);
    }
  );

  return () => unsub();
}, [game?.matchId, userId]);

// ⛔ MUST STAY AFTER ALL useEffect
if (!game || !userId) return <div>Loading...</div>;

  const myIdx = game.players.indexOf(userId);
  const oppIdx = myIdx === 0 ? 1 : 0;

  const myLabel = myIdx === 0 ? "Player 1" : "Player 2";
  const oppLabel = oppIdx === 0 ? "Player 1" : "Player 2";

  const hand = game.hands[myIdx] || [];
  const oppCards = game.hands[oppIdx]?.length || 0;
  const top = decodeCard(game.discard);

  async function playCard(i) {
    if (actionLock.current || game.status === "finished") return;
    if (game.turn !== userId) return invalidMove("Not your turn");

    actionLock.current = true;

    const g = JSON.parse(JSON.stringify(game));
    const card = g.hands[myIdx][i];
    const current = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    if (g.pendingPick > 0 && ![2,14].includes(current.number)) {
      actionLock.current = false;
      return invalidMove("Use 2 or 14");
    }

    if (
      current.number !== topDecoded.number &&
      current.shape !== topDecoded.shape &&
      current.number !== 14
    ) {
      actionLock.current = false;
      return invalidMove("Wrong move");
    }

    g.hands[myIdx].splice(i, 1);

    let nextTurn = g.players[oppIdx];

    if (current.number === 1 || current.number === 8) nextTurn = userId;
    if (current.number === 2) g.pendingPick += 2;
    if (current.number === 14) g.pendingPick += 1;

    g.history = pushHistory(g, `${myLabel} played ${card}`);

    if (!g.hands[myIdx].length) {
      g.scores[myIdx]++;

      if (g.scores[myIdx] >= 2) {
        await databases.updateDocument(DATABASE_ID, GAME_COLLECTION, gameId, {
          ...encodeGame(g),
          status: "finished",
          winnerId: userId,
          turn: null
        });

        if (g.matchId) {
          await databases.updateDocument(DATABASE_ID, MATCH_COLLECTION, g.matchId, {
            status: "finished",
            winnerId: userId
          });
        }

        actionLock.current = false;
        return;
      }

      const deck = createDeck();
      g.hands = [deck.splice(0,6), deck.splice(0,6)];
      g.discard = deck.pop();
      g.deck = deck;
      g.pendingPick = 0;
      g.round++;

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        encodeGame(g)
      );

      actionLock.current = false;
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

    actionLock.current = false;
  }

  async function drawMarket() {
    if (game.status === "finished") return;
    if (game.turn !== userId) return invalidMove("Wait your turn");

    const g = JSON.parse(JSON.stringify(game));
    let count = g.pendingPick > 0 ? g.pendingPick : 1;

    g.history = pushHistory(g, `${myLabel} picked ${count}`);

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
  }
return (
    <div style={styles.bg}>
      <div style={styles.box}>

        {error && <div style={styles.error}>{error}</div>}

        {/* 🆕 TITLE */}
        <h3 style={{ textAlign: "center", marginBottom: 6 }}>
          🎮 Whot Game
        </h3>

        <div style={styles.row}>
          <span>Player 1 ({game.hostName})</span>
          <span>VS</span>
          <span>Player 2 ({game.opponentName})</span>
        </div>

        <div style={{ textAlign: "center" }}>
          {Array.from({ length: oppCards }).map((_, i) => (
            <img key={i} src={drawBack()} style={{ width: 40 }} />
          ))}
          <div>{oppLabel} Cards: {oppCards}</div>
        </div>

        <div style={styles.row}>
          <span>Round {game.round}</span>
          <span>{game.scores[0]} - {game.scores[1]}</span>
        </div>

        <div style={styles.row}>
          <span>₦{match?.stake || 0}</span>
          <span>🏦 ₦{match?.pot || 0}</span>
        </div>

        {/* 🆕 TURN + MESSAGE BUTTON */}
        <div style={{ textAlign: "center", marginTop: 6 }}>
          <p>
            {game.status === "finished"
              ? "🏁 FINISHED"
              : game.turn === userId
              ? "🟢 YOUR TURN"
              : "⏳ OPPONENT"}
          </p>

          <button
  style={styles.chatBtn}
  onClick={() => {
    setShowChat(true);
    setHasUnread(false); // ✅ clear red dot
  }}
>
  💬 Message {hasUnread && <span style={styles.badge}></span>}
</button>
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
              onClick={() => playCard(i)}
            />
          ))}
        </div>

        {showWin && (
          <div style={styles.winBox}>
            🎉 You Won ₦{match?.pot || 0}
          </div>
        )}

        {/* 📝 HISTORY */}
        <div style={styles.history}>
          {game.history.slice().reverse().map((h, i) => (
            <div key={i}>{h}</div>
          ))}
        </div>

        <button onClick={goHome}>Exit</button>

        {/* ===================== */}
        {/* 💬 CHAT POPUP */}
        {/* ===================== */}
        {showChat && (
          <div style={styles.chatOverlay}>
            <div style={styles.chatBox}>

              {/* ❌ EXIT */}
              <div style={styles.chatHeader}>
                <span>💬 Match Chat</span>
                <button onClick={() => setShowChat(false)}>❌</button>
              </div>

              {/* 📩 LOAD YOUR CHAT PAGE */}
              {/* 👉 IMPORTANT: Messages.jsx must accept matchId */}
              <Messages matchId={game.matchId} />

            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// 🎨 FINAL STYLES
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
    justifyContent: "space-between",
    marginBottom: 6
  },
  hand: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    justifyContent: "center",
    marginTop: 10
  },
  card: { width: 65, cursor: "pointer" },
  center: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 10
  },
  marketBtn: {
    background: "gold",
    padding: 10,
    borderRadius: 8
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
    zIndex: 999
  },
  error: {
    background: "red",
    padding: 6,
    textAlign: "center",
    marginBottom: 6
  },
  history: {
    marginTop: 10,
    maxHeight: 120,
    overflow: "auto",
    fontSize: 12,
    color: "#ff4d4d"
  },

  // 💬 CHAT UI
  chatBtn: {
    background: "#2563eb",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer"
  },
  chatOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999
  },
  chatBox: {
    width: "95%",
    maxWidth: 400,
    background: "#111",
    padding: 10,
    borderRadius: 10
  },
  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8
  },

  // 🔴 ADD THIS
  badge: {
    display: "inline-block",
    width: 8,
    height: 8,
    background: "red",
    borderRadius: "50%",
    marginLeft: 6
  }
};