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

  setTimeout(() => {
    beep(800, 200);
  }, 150);
}

// 🎴 CREATE DECK
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
    valid[shape].forEach(num => {
      deck.push(shape + num);
    });
  });

  // ✅ FISHER-YATES SHUFFLE
  for (let i = deck.length - 1; i > 0; i--) {

    const j = Math.floor(Math.random() * (i + 1));

    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  return deck;
}

// 🎴 DECODE CARD
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

  // ✅ SAFETY
  if (!shape || isNaN(number)) {
    return null;
  }

  return {
    shape,
    number
  };
}

// 🧠 IMAGE CACHE
const cache = new Map();

// 🎴 DRAW CARD
function drawCard(card) {

  if (!card) return null;

  const key = `${card.shape}_${card.number}`;

  // ✅ CACHE HIT
  if (cache.has(key)) {
    return cache.get(key);
  }

  const c = document.createElement("canvas");

  c.width = 70;
  c.height = 100;

  const ctx = c.getContext("2d");

  if (!ctx) return null;

  // 🧾 CARD BG
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 70, 100);

  // 🔴 BORDER
  ctx.strokeStyle = "#e11d48";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 66, 96);

  // 🔢 NUMBER
  ctx.fillStyle = "#e11d48";
  ctx.font = "bold 14px Arial";
  ctx.fillText(card.number, 6, 18);

  const cx = 35;
  const cy = 55;

  // ⭕ CIRCLE
  if (card.shape === "circle") {

    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
  }

  // ⬛ SQUARE
  if (card.shape === "square") {

    ctx.fillRect(cx - 12, cy - 12, 24, 24);
  }

  // 🔺 TRIANGLE
  if (card.shape === "triangle") {

    ctx.beginPath();

    ctx.moveTo(cx, cy - 12);
    ctx.lineTo(cx - 12, cy + 12);
    ctx.lineTo(cx + 12, cy + 12);

    ctx.fill();
  }

  // ⭐ STAR
  if (card.shape === "star") {

    ctx.font = "22px Arial";
    ctx.fillText("★", cx - 10, cy + 8);
  }

  // ➕ CROSS
  if (card.shape === "cross") {

    ctx.fillRect(cx - 3, cy - 12, 6, 24);
    ctx.fillRect(cx - 12, cy - 3, 24, 6);
  }

  const img = c.toDataURL();

  // ✅ MEMORY SAFE CACHE
  if (cache.size < 200) {
    cache.set(key, img);
  }

  return img;
}

// 🎴 DRAW BACK CARD
function drawBack() {

  // ✅ SINGLE CACHE
  if (cache.has("BACK_CARD")) {
    return cache.get("BACK_CARD");
  }

  const c = document.createElement("canvas");

  c.width = 65;
  c.height = 100;

  const ctx = c.getContext("2d");

  if (!ctx) return null;

  // 🖤 BACKGROUND
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, 65, 100);

  // 🤍 BORDER
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, 61, 96);

  // 🎴 ICON
  ctx.fillStyle = "#fff";
  ctx.font = "20px Arial";
  ctx.fillText("🂠", 18, 60);

  const img = c.toDataURL();

  cache.set("BACK_CARD", img);

  return img;
}
function parseGame(g) {

  const split = (v, s) =>
    typeof v === "string"
      ? v.split(s).filter(Boolean)
      : [];

  const parsedScores = split(g.scores, ",").map(Number);

  return {
    ...g,

    // 👥 PLAYERS
    players: Array.isArray(g.players)
      ? g.players
      : split(g.players, ","),

    // 🃏 HANDS
    hands: split(g.hands, "|").map(p =>
      split(p, ",")
    ),

    // 🎴 MARKET
    deck: split(g.deck, ","),

    // 🪙 DISCARD
    discard: g.discard || null,

    // 🔄 TURN
    turn: g.turn || null,

    // ➕ PICK STACK
    pendingPick: Number(g.pendingPick || 0),

    // 📝 HISTORY
    history: split(g.history, "||"),

    // 🏆 SCORES
    scores:
      parsedScores.length === 2
        ? parsedScores
        : [0, 0],

    // 🔁 ROUND
    round: Number(g.round || 1),

    // 🎮 STATUS
    status: g.status || "playing",

    // 💰 PAYOUT
    payoutDone: Boolean(g.payoutDone),

    // 👑 WINNER
    winnerId: g.winnerId || null,

    // 🔗 MATCH
    matchId: g.matchId || null,

    // 👤 NAMES
    hostName: g.hostName || "Player 1",
    opponentName: g.opponentName || "Player 2"
  };
}

// =========================
// 🧠 ENCODE GAME
// =========================
function encodeGame(g) {

  return {

    // 🃏 HANDS
    hands: g.hands
      .map(p => p.join(","))
      .join("|"),

    // 🎴 DECK
    deck: g.deck.join(","),

    // 🪙 DISCARD
    discard: g.discard || "",

    // 🔄 TURN
    turn: g.turn || null,

    // ➕ PICK STACK
    pendingPick: String(g.pendingPick || 0),

    // 📝 HISTORY
    history: (g.history || [])
      .slice(-10)
      .join("||"),

    // 🏆 SCORES
    scores: (g.scores || [0, 0]).join(","),

    // 🔁 ROUND
    round: String(g.round || 1),

    // 🎮 STATUS
    status: g.status || "playing",

    // 💰 PAYOUT
    payoutDone: Boolean(g.payoutDone),

    // 👑 WINNER
    winnerId: g.winnerId || null
  };
}

// =========================
// 🧠 SAFE GAME INIT
// =========================
function ensureGameReady(g) {

  // 🏁 DO NOT RESET FINISHED GAME
  if (g.status === "finished") {
    return g;
  }

  // ✅ KEEP VALID GAME
  if (
    g.deck?.length &&
    g.hands?.[0]?.length &&
    g.hands?.[1]?.length &&
    g.discard
  ) {
    return g;
  }

  // 🎴 CREATE NEW ROUND
  const deck = createDeck();

  return {
    ...g,

    // 🃏 HANDS
    hands: [
      deck.splice(0, 6),
      deck.splice(0, 6)
    ],

    // 🎴 MARKET
    deck,

    // 🪙 FIRST CARD
    discard: deck.pop(),

    // 🔄 START TURN
    turn: g.players?.[0] || null,

    // ➕ PICK STACK
    pendingPick: 0,

    // 📝 HISTORY
    history: [],

    // 🏆 SCORES
    scores:
      Array.isArray(g.scores) &&
      g.scores.length === 2
        ? g.scores
        : [0, 0],

    // 🔁 ROUND
    round: Number(g.round || 1),

    // 🎮 STATUS
    status: "playing",

    // 💰 PAYOUT
    payoutDone: false,

    // 👑 WINNER
    winnerId: null
  };
}

// ===============
// 📝 HISTORY
function pushHistory(g, text) {
  return [...(g.history || []), text].slice(-10);
}

// ✅ EMPTY MARKET → END ROUND / MATCH
function handleEmptyMarket(g) {
  const p0 = g.hands[0].length;
  const p1 = g.hands[1].length;

  let winnerIdx = null;

  // ✅ FEWEST CARDS WINS ROUND
  if (p0 < p1) winnerIdx = 0;
  else if (p1 < p0) winnerIdx = 1;

  // ⚖️ DRAW ROUND
  if (winnerIdx === null) {
    // ✅ AFTER ROUND 3 FORCE FINISH
    if (g.round >= 3) {
      return {
        ...g,
        status: "finished",
        payoutDone: false,
        turn: null,
        history: pushHistory(
          g,
          "⚖️ Match ended in draw (market empty)"
        )
      };
    }

    // 🔁 NEXT ROUND
    const deck = createDeck();

    return {
      ...g,
      hands: [deck.splice(0, 6), deck.splice(0, 6)],
      discard: deck.pop(),
      deck,
      pendingPick: 0,
      round: g.round + 1,
      history: pushHistory(
        g,
        "⚖️ Round draw (market empty)"
      )
    };
  }

  // ✅ AWARD ROUND SCORE
  g.scores[winnerIdx]++;

  // 🏁 FIRST TO 2 WINS MATCH
  if (g.scores[winnerIdx] >= 2) {
    return {
      ...g,
      status: "finished",
      winnerId: g.players[winnerIdx],
      payoutDone: false,
      turn: null,
      history: pushHistory(
        g,
        `🏆 ${
          winnerIdx === 0 ? g.hostName : g.opponentName
        } wins match`
      )
    };
  }

  // 🏁 MAX 3 ROUNDS REACHED
  if (g.round >= 3) {
    let finalWinner = null;

    if (g.scores[0] > g.scores[1]) finalWinner = 0;
    else if (g.scores[1] > g.scores[0]) finalWinner = 1;

    return {
      ...g,
      status: "finished",
      winnerId:
        finalWinner !== null
          ? g.players[finalWinner]
          : null,
      payoutDone: false,
      turn: null,
      history: pushHistory(
        g,
        finalWinner !== null
          ? `🏆 ${
              finalWinner === 0
                ? g.hostName
                : g.opponentName
            } wins after 3 rounds`
          : "⚖️ Match draw after 3 rounds"
      )
    };
  }

  // 🔁 START NEXT ROUND
  const deck = createDeck();

  return {
    ...g,
    hands: [deck.splice(0, 6), deck.splice(0, 6)],
    discard: deck.pop(),
    deck,
    pendingPick: 0,
    round: g.round + 1,
    turn: g.players[0],
    history: pushHistory(
      g,
      `♻️ New round started (${g.round + 1}/3)`
    )
  };
}

export default function WhotGame({ gameId, goHome }) {

  const [game, setGame] = useState(null);
  const [match, setMatch] = useState(null);
  const [userId, setUserId] = useState(null);
  const [error, setError] = useState("");
  const [showWin, setShowWin] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // ✅ COUNTDOWN
  const [countdown, setCountdown] = useState(5);

  // ✅ payout guard
  const payoutRef = useRef(false);

  // ✅ action guard
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

  let exitTimer = null;
  let countdownTimer = null;

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

            hands: [
              deck.splice(0, 6),
              deck.splice(0, 6)
            ],

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
            gameId,
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
}

};

load();

// 🔄 REALTIME SUBSCRIBE
const unsub = databases.client.subscribe(
  `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
  async (res) => {

    const parsed = parseGame(res.payload);

    setGame(parsed);

    // 💰 ONLY WINNER CAN PAYOUT ONCE
    if (
      parsed.status === "finished" &&
      parsed.winnerId === userId &&
      !parsed.payoutDone &&
      !payoutRef.current
    ) {

      payoutRef.current = true;

      await handlePayout(parsed);
    }

    // 🏁 FINISHED
    if (parsed.status === "finished") {

      // 🎉 WIN SOUND
      if (parsed.winnerId === userId) {

        setShowWin(true);

        successSound();
      }

      // ⏳ COUNTDOWN
      let sec = 5;

      setCountdown(sec);

      clearInterval(countdownTimer);

      countdownTimer = setInterval(() => {

        sec--;

        setCountdown(sec);

        if (sec <= 0) {

          clearInterval(countdownTimer);
        }

      }, 1000);

      // 🚪 EXIT TO HOME
      clearTimeout(exitTimer);

      exitTimer = setTimeout(async () => {

        try {

          // ✅ FINISH GAME
          await databases.updateDocument(
            DATABASE_ID,
            GAME_COLLECTION,
            gameId,
            {
              status: "finished",
              turn: null
            }
          );

          // ✅ FINISH MATCH
          if (parsed.matchId) {

            await databases.updateDocument(
              DATABASE_ID,
              MATCH_COLLECTION,
              parsed.matchId,
              {
                status: "finished"
              }
            );
          }

        } catch (err) {

          console.error(
            "finish cleanup failed:",
            err
          );
        }

        // 🚪 FORCE HOME
        goHome();

      }, 5000);
    }
  }
);

return () => {

  unsub();

  clearTimeout(exitTimer);

  clearInterval(countdownTimer);
};

}, [gameId, userId]);

// =========================
// 💰 PAYOUT
// =========================
async function handlePayout(g) {

  // ✅ HARD LOCK
  if (payoutRef.current === "paid") {
    return;
  }

  try {

    if (!g.matchId) return;

    // ✅ ONLY WINNER DEVICE
    if (g.winnerId !== userId) {
      return;
    }

    const matchDoc = await databases.getDocument(
      DATABASE_ID,
      MATCH_COLLECTION,
      g.matchId
    );

    const pot = Number(matchDoc.pot || 0);

    // ✅ NOTHING LEFT TO PAY
    if (pot <= 0) {

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        {
          payoutDone: true,
          status: "finished"
        }
      );

      payoutRef.current = "paid";

      return;
    }

    // ✅ DRAW MATCH
    if (!g.winnerId) {

      await databases.updateDocument(
        DATABASE_ID,
        MATCH_COLLECTION,
        matchDoc.$id,
        {
          pot: 0,
          payoutDone: true,
          status: "finished"
        }
      );

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        {
          payoutDone: true,
          status: "finished",
          turn: null
        }
      );

      payoutRef.current = "paid";

      return;
    }

    // 🏦 GET WINNER WALLET
    const walletRes = await databases.listDocuments(
      DATABASE_ID,
      WALLET_COLLECTION,
      [
        Query.equal("userId", g.winnerId),
        Query.limit(1)
      ]
    );

    if (!walletRes.documents.length) {

      console.warn("Winner wallet not found");

      return;
    }

    const wallet = walletRes.documents[0];

    const currentBalance = Number(
      wallet.balance || 0
    );

    // 💰 CREDIT WINNER
    await databases.updateDocument(
      DATABASE_ID,
      WALLET_COLLECTION,
      wallet.$id,
      {
        balance: currentBalance + pot
      }
    );

    // 🧹 EMPTY POT
    await databases.updateDocument(
      DATABASE_ID,
      MATCH_COLLECTION,
      matchDoc.$id,
      {
        pot: 0,
        payoutDone: true,
        status: "finished"
      }
    );

    // ✅ MARK GAME FINISHED
    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      {
        payoutDone: true,
        status: "finished",
        turn: null
      }
    );

    console.log("✅ payout success");

    // 🔒 LOCK FOREVER
    payoutRef.current = "paid";

  } catch (err) {

    console.error(
      "❌ payout error:",
      err
    );
  }
}

// =========================
// =========================
// 🎮 PLAY CARD
// =========================
async function playCard(i) {

  if (!game) return;

  if (actionLock.current) return;

  if (game.status === "finished") return;

  if (game.turn !== userId) {
    return invalidMove("Not your turn");
  }

  actionLock.current = true;

  try {

    const g = JSON.parse(JSON.stringify(game));

    const card = g.hands[myIdx][i];

    if (!card) {
      actionLock.current = false;
      return;
    }

    const current = decodeCard(card);

    const topDecoded = decodeCard(g.discard);

    if (!current || !topDecoded) {
      actionLock.current = false;
      return;
    }

    // 🔒 STACK RULE
    if (
      g.pendingPick > 0 &&
      ![2, 14].includes(current.number)
    ) {
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

    // ✅ REMOVE PLAYED CARD
    g.hands[myIdx].splice(i, 1);

    // ✅ SET DISCARD
    g.discard = card;

    // 🔁 NEXT TURN
    let nextTurn = g.players[oppIdx];

    // 🔥 SPECIAL CARDS
    if (current.number === 1) {
      nextTurn = userId;
    }

    if (current.number === 8) {
      nextTurn = userId;
    }

    if (current.number === 2) {
      g.pendingPick += 2;
    }

    if (current.number === 14) {
      g.pendingPick += 1;
    }

    // 📝 HISTORY
    g.history = pushHistory(
      g,
      `${myLabel} played ${card}`
    );

    // 🏆 ROUND WIN
    if (g.hands[myIdx].length === 0) {

      // ✅ SCORE ROUND
      g.scores[myIdx]++;

      g.history = pushHistory(
        g,
        `🏆 ${myLabel} won round ${g.round}`
      );

      // 🏁 FIRST TO 2 WINS MATCH
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

        actionLock.current = false;

        return;
      }

      // 🏁 MAX 3 ROUNDS
      if (g.round >= 3) {

        let finalWinner = null;

        if (g.scores[0] > g.scores[1]) {
          finalWinner = g.players[0];
        }

        if (g.scores[1] > g.scores[0]) {
          finalWinner = g.players[1];
        }

        await databases.updateDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId,
          {
            ...encodeGame(g),

            status: "finished",

            winnerId: finalWinner,

            payoutDone: false,

            turn: null
          }
        );

        actionLock.current = false;

        return;
      }

      // 🔁 START NEW ROUND
      const deck = createDeck();

      g.hands = [
        deck.splice(0, 6),
        deck.splice(0, 6)
      ];

      g.discard = deck.pop();

      g.deck = deck;

      g.pendingPick = 0;

      g.round += 1;

      g.turn = g.players[0];

      g.history = pushHistory(
        g,
        `♻️ Round ${g.round} started`
      );

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        encodeGame(g)
      );

      actionLock.current = false;

      return;
    }

    // ✅ NORMAL SAVE
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

    console.error("playCard error:", err);

  } finally {

    actionLock.current = false;
  }
}
// =========================
// 🎮 DRAW MARKET
// =========================
async function drawMarket() {

  if (!game) return;

  if (actionLock.current) return;

  if (game.status === "finished") return;

  if (game.turn !== userId) {
    return invalidMove("Not your turn");
  }

  actionLock.current = true;

  try {

    const g = JSON.parse(JSON.stringify(game));

    const drawCount =
      g.pendingPick > 0
        ? g.pendingPick
        : 1;

    // 🧠 MARKET EMPTY
    if (!g.deck.length) {

      const updated = handleEmptyMarket(g);

      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        {
          ...encodeGame(updated),

          status: updated.status,

          winnerId: updated.winnerId || null,

          payoutDone:
            updated.payoutDone || false,

          turn: updated.turn || null
        }
      );

      actionLock.current = false;

      return;
    }

    // 🃏 DRAW CARD(S)
    for (let i = 0; i < drawCount; i++) {

      if (!g.deck.length) break;

      const picked = g.deck.pop();

      if (picked) {
        g.hands[myIdx].push(picked);
      }
    }

    // 🔁 RESET STACK
    g.pendingPick = 0;

    // 🔄 NEXT TURN
    g.turn = g.players[oppIdx];

    // 📝 HISTORY
    g.history = pushHistory(
      g,
      `${myLabel} drew ${drawCount} card${
        drawCount > 1 ? "s" : ""
      }`
    );

    // 💾 SAVE
    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      encodeGame(g)
    );

  } catch (err) {

    console.error(
      "drawMarket error:",
      err
    );

  } finally {

    actionLock.current = false;
  }
}

// =========================
// 🧠 DERIVED STATE
// =========================
if (!game || !userId) return null;

const myIdx =
  game.players.indexOf(userId);

const oppIdx =
  myIdx === 0 ? 1 : 0;

const hand =
  game.hands?.[myIdx] || [];

const oppCards =
  game.hands?.[oppIdx]?.length || 0;

const top =
  decodeCard(game.discard);

const myLabel =
  myIdx === 0
    ? "Player 1"
    : "Player 2";

const oppLabel =
  myIdx === 0
    ? "Player 2"
    : "Player 1";

// =====================
// 🎨 UI RENDER
// =====================
return (
  <div style={styles.bg}>

    <div style={styles.box}>

      {/* ❌ ERROR */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      {/* 🎮 TITLE */}
      <h3
        style={{
          textAlign: "center",
          marginBottom: 8
        }}
      >
        🎮 Whot Game
      </h3>

      {/* 👥 PLAYERS */}
      <div style={styles.row}>
        <span>
          Player 1 ({game.hostName})
        </span>

        <span>VS</span>

        <span>
          Player 2 ({game.opponentName})
        </span>
      </div>

      {/* 🃏 OPPONENT */}
      <div
        style={{
          textAlign: "center"
        }}
      >
        {Array.from({
          length: oppCards
        }).map((_, i) => (
          <img
            key={i}
            src={drawBack()}
            style={{ width: 40 }}
          />
        ))}

        <div>
          {oppLabel} Cards:{" "}
          {oppCards}
        </div>
      </div>

      {/* 🏆 SCORE */}
      <div style={styles.row}>
        <span>
          Round {game.round}/3
        </span>

        <span>
          {game.scores[0]} -{" "}
          {game.scores[1]}
        </span>
      </div>

      {/* 💰 POT */}
      <div style={styles.row}>
        <span>
          ₦{match?.stake || 0}
        </span>

        <span>
          🏦 ₦{match?.pot || 0}
        </span>
      </div>

      {/* 🎯 STATUS */}
      <div
        style={{
          textAlign: "center",
          marginTop: 8
        }}
      >

        <p>
          {game.status === "finished"
            ? "🏁 MATCH FINISHED"
            : game.turn === userId
            ? "🟢 YOUR TURN"
            : "⏳ OPPONENT TURN"}
        </p>

        {/* ⏳ EXIT */}
        {game.status === "finished" && (
          <div
            style={{
              color: "gold",
              fontWeight: "bold",
              marginBottom: 8
            }}
          >
            Leaving match in{" "}
            {countdown}s...
          </div>
        )}

        {/* 💬 SINGLE CHAT BUTTON */}
        <button
          style={styles.chatBtn}
          onClick={() =>
            setShowChat(true)
          }
        >
          💬 Message
        </button>

      </div>

      {/* 🎴 CENTER */}
      <div style={styles.center}>

        {top && (
          <img
            src={drawCard(top)}
            style={styles.card}
          />
        )}

        <button
          style={styles.marketBtn}
          onClick={drawMarket}
        >
          🃏 {game.deck.length}
        </button>

      </div>

      {/* 🖐️ PLAYER HAND */}
      <div style={styles.hand}>

        {hand.map((c, i) => (

          <img
            key={i}

            src={drawCard(decodeCard(c))}

            style={styles.card}

            onClick={() =>
              playCard(i)
            }
          />

        ))}

      </div>

      {/* 🎉 WIN BOX */}
      {showWin && (
        <div style={styles.winBox}>
          🎉 You Won ₦
          {match?.pot || 0}
        </div>
      )}

      {/* 📜 HISTORY */}
      <div style={styles.history}>

        {(game.history || [])
          .slice()
          .reverse()
          .map((h, i) => (
            <div key={i}>
              {h}
            </div>
          ))}

      </div>

      {/* 🚪 EXIT */}
      <button
        style={{
          marginTop: 10,
          width: "100%"
        }}
        onClick={goHome}
      >
        Exit
      </button>

      {/* 💬 CHAT POPUP */}
      {showChat &&
        game?.matchId && (

        <div
          style={styles.chatOverlay}
        >

          <div style={styles.chatBox}>

            <div
              style={styles.chatHeader}
            >

              <span>
                💬 Match Chat
              </span>

              <button
                onClick={() =>
                  setShowChat(false)
                }
              >
                ❌
              </button>

            </div>

            <Messages
              matchId={game.matchId}
            />

          </div>

        </div>

      )}

    </div>

  </div>
);
}
// =====================
// 🎨 STYLES
// =====================
const styles = {

  bg: {
    minHeight: "100vh",

    background:
      "linear-gradient(135deg, #065f46, #064e3b)",

    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    padding: 10
  },

  box: {
    width: "95%",

    maxWidth: 450,

    background: "#000000cc",

    padding: 12,

    color: "#fff",

    borderRadius: 14,

    backdropFilter: "blur(6px)",

    boxShadow:
      "0 0 20px rgba(0,0,0,0.6)",

    border:
      "1px solid rgba(255,255,255,0.08)"
  },

  row: {
    display: "flex",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 8,

    fontSize: 13,

    gap: 8
  },

  hand: {
    display: "flex",

    flexWrap: "wrap",

    gap: 6,

    justifyContent: "center",

    marginTop: 12
  },

  card: {
    width: 65,

    cursor: "pointer",

    borderRadius: 8,

    transition:
      "transform 0.15s ease",

    userSelect: "none"
  },

  center: {
    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    gap: 12,

    marginTop: 12
  },

  marketBtn: {
    background: "gold",

    color: "#000",

    padding: 10,

    borderRadius: 10,

    border: "none",

    cursor: "pointer",

    fontWeight: "bold",

    minWidth: 70,

    boxShadow:
      "0 0 10px rgba(255,215,0,0.4)"
  },

  winBox: {
    position: "fixed",

    top: "40%",

    left: "50%",

    transform:
      "translate(-50%, -50%)",

    background: "gold",

    color: "#000",

    padding: 20,

    borderRadius: 12,

    zIndex: 9999,

    fontWeight: "bold",

    fontSize: 18,

    boxShadow:
      "0 0 20px rgba(255,215,0,0.7)"
  },

  error: {
    background: "#dc2626",

    padding: 8,

    textAlign: "center",

    marginBottom: 8,

    borderRadius: 8,

    fontSize: 12,

    fontWeight: "bold"
  },

  history: {
    marginTop: 12,

    maxHeight: 130,

    overflowY: "auto",

    fontSize: 12,

    color: "#ff4d4d",

    background: "#111",

    padding: 8,

    borderRadius: 8,

    border:
      "1px solid rgba(255,255,255,0.05)"
  },

  chatBtn: {
    background: "#2563eb",

    color: "#fff",

    padding: "8px 14px",

    borderRadius: 8,

    border: "none",

    cursor: "pointer",

    fontSize: 13,

    fontWeight: "bold",

    marginTop: 4
  },

  chatOverlay: {
    position: "fixed",

    top: 0,

    left: 0,

    width: "100%",

    height: "100%",

    background:
      "rgba(0,0,0,0.75)",

    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    zIndex: 99999
  },

  chatBox: {
    width: "95%",

    maxWidth: 400,

    background: "#111",

    padding: 10,

    borderRadius: 12,

    boxShadow:
      "0 0 15px rgba(0,0,0,0.6)"
  },

  chatHeader: {
    display: "flex",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 10,

    fontSize: 14,

    fontWeight: "bold"
  }
};