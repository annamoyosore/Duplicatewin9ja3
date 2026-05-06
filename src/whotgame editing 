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

// 🔊 SOUND (SAFE)
function beep(freq = 200, duration = 200) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
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
      try {
        osc.stop();
        ctx.close();
      } catch {}
    }, duration);
  } catch {}
}

function successSound() {
  beep(600, 200);
  setTimeout(() => beep(800, 200), 150);
}

// 🎴 DECK (SAFE SHUFFLE)
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

  // ✅ better shuffle (prevents bias)
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
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

  const shape = map[str[0]];
  const number = Number(str.slice(1));

  // ✅ guard against corrupted data
  if (!shape || isNaN(number)) return null;

  return { shape, number };
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
  if (!ctx) return null; // ✅ safety

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

  if (card.shape === "square") {
    ctx.fillRect(cx - 12, cy - 12, 24, 24);
  }

  if (card.shape === "triangle") {
    ctx.beginPath();
    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.lineTo(cx + 12, cy + 12);
    ctx.fill();
  }

  if (card.shape === "star") {
    ctx.fillText("★", cx - 8, cy + 8);
  }

  if (card.shape === "cross") {
    ctx.fillRect(cx - 3, cy - 12, 6, 24);
    ctx.fillRect(cx - 12, cy - 3, 24, 6);
  }

  const img = c.toDataURL();

  // ✅ prevent memory explosion (important for long play)
  if (cache.size < 200) {
    cache.set(key, img);
  }

  return img;
}

function drawBack() {
  // ✅ cache single back card (performance boost)
  if (cache.has("BACK_CARD")) return cache.get("BACK_CARD");

  const c = document.createElement("canvas");
  c.width = 65;
  c.height = 100;

  const ctx = c.getContext("2d");
  if (!ctx) return null;

  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 65, 100);

  ctx.strokeStyle = "#fff";
  ctx.strokeRect(2, 2, 61, 96);

  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.fillText("🂠", 18, 60);

  const img = c.toDataURL();
  cache.set("BACK_CARD", img);

  return img;
}
function parseGame(g) {
  const split = (v, s) =>
    typeof v === "string" ? v.split(s).filter(Boolean) : [];

  const parsedScores = split(g.scores, ",").map(Number);

  return {
    ...g,
    players: Array.isArray(g.players) ? g.players : split(g.players, ","),

    hands: split(g.hands, "|").map(p => split(p, ",")),
    deck: split(g.deck, ","),

    discard: g.discard || null,
    turn: g.turn || null,

    pendingPick: Number(g.pendingPick || 0),

    history: split(g.history, "||"),

    // ✅ FIX: prevent empty []
    scores: parsedScores.length === 2 ? parsedScores : [0, 0],

    round: Number(g.round || 1),

    status: g.status || "playing",

    // ✅ keep as boolean (safe)
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

    status: g.status,

    // ✅ FIX: persist payout + winner (NO DUPLICATE PAYOUT)
    payoutDone: g.payoutDone || false,
    winnerId: g.winnerId || null
  };
}

// 🧠 SAFE INIT
function ensureGameReady(g) {
  if (g.status === "finished") return g;

  if (
    !g.deck?.length ||
    !g.hands?.[0]?.length ||
    !g.hands?.[1]?.length ||
    !g.discard
  ) {
    const deck = createDeck();

    return {
      ...g,
      hands: [deck.splice(0,6), deck.splice(0,6)],
      discard: deck.pop(),
      deck,

      pendingPick: 0,
      history: [],

      // ✅ FIX: always valid scores
      scores: [0,0],

      round: 1,
      status: "playing",

      // ✅ FIX: initialize payout flag
      payoutDone: false
    };
  }

  return g;
}
// 📝 HISTORY
function pushHistory(g, text) {
  return [...(g.history || []), text].slice(-10);
}

// ✅ FIXED
function handleEmptyMarket(g, gameId) {
  const p0 = g.hands[0].length;
  const p1 = g.hands[1].length;

  let winnerIdx = null;

  if (p0 < p1) winnerIdx = 0;
  else if (p1 < p0) winnerIdx = 1;

  if (winnerIdx === null) {
    return {
      ...g,
      history: pushHistory(g, "⚖️ Round draw (market finished)")
    };
  }

  g.scores[winnerIdx]++;

  // 🏁 MATCH FINISH
  if (g.scores[winnerIdx] >= 2) {
    return {
      ...g,
      status: "finished",
      winnerId: g.players[winnerIdx],
      payoutDone: false, // ✅ ensure payout will run
      turn: null,
      history: pushHistory(
        g,
        `🏆 ${winnerIdx === 0 ? "Player 1" : "Player 2"} wins (market empty)`
      )
    };
  }

  // 🔁 NEW ROUND
  const deck = createDeck();

  return {
    ...g,
    hands: [deck.splice(0,6), deck.splice(0,6)],
    discard: deck.pop(),
    deck,
    pendingPick: 0,
    round: g.round + 1,
    history: pushHistory(g, "♻️ New round (market empty)")
  };
}

export default function WhotGame({ gameId, goHome }) {

  const [game, setGame] = useState(null);
  const [match, setMatch] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState("");
  const [showWin, setShowWin] = useState(false);

  // 🆕 CHAT STATE
  const [showChat, setShowChat] = useState(false);

  // ✅ payout guard
  const payoutRef = useRef(false);

  const actionLock = useRef(false);

  function invalidMove(msg) {
    beep(120, 300);
    setError(msg);
    setTimeout(() => setError(""), 1200);
  }

  // 🔑 GET USER
  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

// =========================
// 🔄 LOAD + REALTIME
// =========================
useEffect(() => {
  if (!gameId || !userId) return;

  const load = async () => {
    let g = null;

    // 🔹 LOAD GAME
    try {
      g = await databases.getDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId
      );
    } catch {
      console.warn("Game not found, recovering...");
    }

    // 🔹 RECOVER FROM MATCH
    if (!g) {
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
            opponentName: m.opponentName,
            payoutDone: false
          };

          g = await databases.createDocument(
            DATABASE_ID,
            GAME_COLLECTION,
            ID.unique(),
            encodeGame(newGame)
          );
        }
      } catch (err) {
        console.error("Recovery failed:", err);
      }
    }

    // 🔹 LOAD MATCH
    if (g?.matchId) {
      try {
        const m = await databases.getDocument(
          DATABASE_ID,
          MATCH_COLLECTION,
          g.matchId
        );
        setMatch(m);
      } catch {}
    }

    // 🔹 SET GAME
    if (g) {
      const parsed = ensureGameReady(parseGame(g));
      setGame(parsed);

      // 💰 PAYOUT (ON LOAD)
      if (
        parsed.status === "finished" &&
        parsed.winnerId &&
        !parsed.payoutDone &&
        !payoutRef.current
      ) {
        payoutRef.current = true;
        handlePayout(parsed);
      }
    }
  };

  load();

  // 🔄 REALTIME
  const unsub = databases.client.subscribe(
    `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
    (res) => {
      const parsed = parseGame(res.payload);
      setGame(parsed);

      // 💰 PAYOUT (REALTIME)
      if (
        parsed.status === "finished" &&
        parsed.winnerId &&
        !parsed.payoutDone &&
        !payoutRef.current
      ) {
        payoutRef.current = true;
        handlePayout(parsed);
      }

      // 🏁 GAME END UI
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
// 💰 PAYOUT
// =========================
async function handlePayout(g) {
  try {
    if (!g.matchId || !g.winnerId) return;

    const matchDoc = await databases.getDocument(
      DATABASE_ID,
      MATCH_COLLECTION,
      g.matchId
    );

    // already paid
    if (matchDoc.payoutDone) return;

    const pot = Number(matchDoc.pot || 0);
    if (!pot) return;

    // 🏦 winner wallet
    const walletRes = await databases.listDocuments(
      DATABASE_ID,
      WALLET_COLLECTION,
      [Query.equal("userId", g.winnerId), Query.limit(1)]
    );

    if (!walletRes.documents.length) return;

    const wallet = walletRes.documents[0];

    // 💰 CREDIT
    await databases.updateDocument(
      DATABASE_ID,
      WALLET_COLLECTION,
      wallet.$id,
      {
        balance: Number(wallet.balance || 0) + pot
      }
    );

    // 🧹 CLEAR MATCH
    await databases.updateDocument(
      DATABASE_ID,
      MATCH_COLLECTION,
      matchDoc.$id,
      {
        pot: 0,
        payoutDone: true
      }
    );

    // 🧠 MARK GAME
    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      {
        payoutDone: true
      }
    );

  } catch (err) {
    console.error("Payout error:", err);
  }
}
// =========================
// 🎮 PLAY CARD
// =========================
async function playCard(i) {
  if (actionLock.current || game.status === "finished") return;
  if (game.turn !== userId) return invalidMove("Not your turn");

  actionLock.current = true;

  try {
    const g = JSON.parse(JSON.stringify(game));

    const card = g.hands[myIdx][i];
    const current = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    // 🔒 PICK STACK RULE
    if (g.pendingPick > 0 && ![2, 14].includes(current.number)) {
      actionLock.current = false;
      return invalidMove("Use 2 or 14");
    }

    // ❌ INVALID MOVE
    if (
      current.number !== topDecoded.number &&
      current.shape !== topDecoded.shape &&
      current.number !== 14
    ) {
      actionLock.current = false;
      return invalidMove("Wrong move");
    }

    // ✅ REMOVE CARD
    g.hands[myIdx].splice(i, 1);

    let nextTurn = g.players[oppIdx];

    // 🔁 SPECIAL RULES
    if (current.number === 1 || current.number === 8) nextTurn = userId;
    if (current.number === 2) g.pendingPick += 2;
    if (current.number === 14) g.pendingPick += 1;

    g.history = pushHistory(g, `${myLabel} played ${card}`);

    // 🏆 ROUND WIN
    if (!g.hands[myIdx].length) {
      g.scores[myIdx]++;

      // 🏁 MATCH WIN
      if (g.scores[myIdx] >= 2) {
        await databases.updateDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId,
          {
            ...encodeGame(g),
            status: "finished",
            winnerId: userId,
            payoutDone: false,
            turn: null
          }
        );

        return;
      }

      // 🔁 NEW ROUND
      const deck = createDeck();

      g.hands = [deck.splice(0, 6), deck.splice(0, 6)];
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

      return;
    }

    // ✅ NORMAL TURN
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

  } catch (err) {
    console.error(err);
  } finally {
    // ✅ ALWAYS RELEASE LOCK
    actionLock.current = false;
  }
}
// =========================
// 🎮 ACTION: DRAW FROM MARKET
// =========================
async function drawMarket() {
  if (actionLock.current || game.status === "finished") return;
  if (game.turn !== userId) return invalidMove("Not your turn");

  actionLock.current = true;

  try {
    const g = JSON.parse(JSON.stringify(game));

    const drawCount = g.pendingPick > 0 ? g.pendingPick : 1;

    // 🧠 HANDLE EMPTY MARKET
    if (!g.deck.length) {
      const updated = handleEmptyMarket(g, gameId);

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        encodeGame(updated)
      );

      return;
    }

    // 🃏 DRAW CARDS
    for (let i = 0; i < drawCount; i++) {
      if (!g.deck.length) break;
      g.hands[myIdx].push(g.deck.pop());
    }

    // 🔁 RESET STATE
    g.pendingPick = 0;
    g.turn = g.players[oppIdx];

    // 📝 HISTORY
    g.history = pushHistory(
      g,
      `${myLabel} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`
    );

    // 💾 SAVE
    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      encodeGame(g)
    );
} catch (err) {
    console.error("drawMarket error:", err);
  } finally {
    actionLock.current = false;
  }
} // ✅ ONLY ONE closing brace here


// =========================
// 🧠 DERIVED STATE (ONLY ONCE)
// =========================
if (!game || !userId) return null;

const myIdx = game.players.indexOf(userId);
const oppIdx = myIdx === 0 ? 1 : 0;

const hand = game.hands?.[myIdx] || [];
const oppCards = game.hands?.[oppIdx]?.length || 0;

const top = decodeCard(game.discard);

const myLabel = myIdx === 0 ? "Player 1" : "Player 2";
const oppLabel = myIdx === 0 ? "Player 2" : "Player 1";


// =====================
// 🎨 UI RENDER
// =====================
return (
  <div style={styles.bg}>
    <div style={styles.box}>

      {error && <div style={styles.error}>{error}</div>}

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
          onClick={() => setShowChat(true)}
        >
          💬 Message
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

  <div style={styles.history}>
    {(game.history || [])
      .slice()
      .reverse()
      .map((h, i) => (
        <div key={i}>{h}</div>
      ))}
  </div>

  {/* CHAT BUTTON WITH RED DOT */}
  <div style={{ textAlign: "center", marginTop: 6 }}>
    <button
      style={{ ...styles.chatBtn, position: "relative" }}
      onClick={() => {
        setShowChat(true);
        setMatch(prev =>
          prev ? { ...prev, hasUnread: false } : prev
        );
      }}
    >
      💬 Message

      {match?.hasUnread && (
        <span
          style={{
            position: "absolute",
            top: -3,
            right: -3,
            width: 10,
            height: 10,
            background: "red",
            borderRadius: "50%"
          }}
        />
      )}
    </button>
  </div>

  <button onClick={goHome}>Exit</button>

  {/* CHAT POPUP */}
  {showChat && game?.matchId && (
    <div style={styles.chatOverlay}>
      <div style={styles.chatBox}>

        <div style={styles.chatHeader}>
          <span>💬 Match Chat</span>
          <button onClick={() => setShowChat(false)}>❌</button>
        </div>

        <Messages
          matchId={game.matchId}
          onRead={() => {
            setMatch(prev =>
              prev ? { ...prev, hasUnread: false } : prev
            );
          }}
        />

      </div>
    </div>
  )}

</div>
</div>
); // ✅ CLOSE JSX

} // ✅ CLOSE COMPONENT


// =====================
// 🎨 STYLES (FINAL)
// =====================
const styles = {
  bg: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #065f46, #064e3b)", // nicer gradient
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
    borderRadius: 12,
    backdropFilter: "blur(6px)", // 🔥 smoother UI
    boxShadow: "0 0 20px rgba(0,0,0,0.6)"
  },

  row: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 6,
    fontSize: 13
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
    cursor: "pointer",
    transition: "transform 0.15s ease"
  },

  center: {
    display: "flex",
    justifyContent: "center",
    gap: 10,
    marginTop: 10
  },

  marketBtn: {
    background: "gold",
    padding: 10,
    borderRadius: 8,
    border: "none",
    cursor: "pointer",
    fontWeight: "bold"
  },

  winBox: {
    position: "fixed",
    top: "40%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "gold",
    color: "#000",
    padding: 20,
    borderRadius: 12,
    zIndex: 999,
    fontWeight: "bold",
    boxShadow: "0 0 20px rgba(255,215,0,0.7)"
  },

  error: {
    background: "#dc2626",
    padding: 6,
    textAlign: "center",
    marginBottom: 6,
    borderRadius: 6,
    fontSize: 12
  },

  history: {
    marginTop: 10,
    maxHeight: 120,
    overflowY: "auto",
    fontSize: 12,
    color: "#ff4d4d",
    background: "#111",
    padding: 6,
    borderRadius: 6
  },

  chatBtn: {
    background: "#2563eb",
    color: "#fff",
    padding: "6px 12px",
    borderRadius: 6,
    border: "none",
    cursor: "pointer",
    position: "relative",
    fontSize: 13
  },

  chatOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.75)",
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
    borderRadius: 12,
    boxShadow: "0 0 15px rgba(0,0,0,0.6)"
  },

  chatHeader: {
    display: "flex",
    justifyContent: "space-between",
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "bold"
  }
};