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
    valid[shape].forEach(n => {
      deck.push(shape + n);
    });
  });

  // ✅ BETTER SHUFFLE
  for (let i = deck.length - 1; i > 0; i--) {

    const j = Math.floor(
      Math.random() * (i + 1)
    );

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

  // ✅ CORRUPT DATA GUARD
  if (!shape || isNaN(number)) {
    return null;
  }

  return {
    shape,
    number
  };
}

const cache = new Map();

function drawCard(card) {

  if (!card) return null;

  const key = `${card.shape}_${card.number}`;

  if (cache.has(key)) {
    return cache.get(key);
  }

  const c = document.createElement("canvas");

  c.width = 70;
  c.height = 100;

  const ctx = c.getContext("2d");

  if (!ctx) return null;

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, 70, 100);

  ctx.strokeStyle = "#e11d48";
  ctx.strokeRect(2, 2, 66, 96);

  ctx.fillStyle = "#e11d48";
  ctx.font = "bold 14px Arial";

  ctx.fillText(card.number, 6, 18);

  const cx = 35;
  const cy = 55;

  if (card.shape === "circle") {

    ctx.beginPath();

    ctx.arc(
      cx,
      cy,
      12,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  if (card.shape === "square") {

    ctx.fillRect(
      cx - 12,
      cy - 12,
      24,
      24
    );
  }

  if (card.shape === "triangle") {

    ctx.beginPath();

    ctx.moveTo(cx, cy - 12);

    ctx.lineTo(
      cx - 12,
      cy + 12
    );

    ctx.lineTo(
      cx + 12,
      cy + 12
    );

    ctx.fill();
  }

  if (card.shape === "star") {

    ctx.fillText(
      "★",
      cx - 8,
      cy + 8
    );
  }

  if (card.shape === "cross") {

    ctx.fillRect(
      cx - 3,
      cy - 12,
      6,
      24
    );

    ctx.fillRect(
      cx - 12,
      cy - 3,
      24,
      6
    );
  }

  const img = c.toDataURL();

  // ✅ MEMORY GUARD
  if (cache.size < 200) {
    cache.set(key, img);
  }

  return img;
}

function drawBack() {

  // ✅ CACHE BACK CARD
  if (cache.has("BACK_CARD")) {
    return cache.get("BACK_CARD");
  }

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

// =========================
// 🧠 SAFE GAME PARSER
// =========================
function parseGame(g) {

  const split = (v, s) =>
    typeof v === "string"
      ? v.split(s).filter(Boolean)
      : [];

  const parsedScores =
    split(g.scores, ",").map(Number);

  return {
    ...g,

    // ✅ SAFE PLAYERS
    players:
      Array.isArray(g.players)
        ? g.players
        : split(g.players, ","),

    // ✅ SAFE HANDS
    hands:
      typeof g.hands === "string"
        ? split(g.hands, "|").map(
            p => split(p, ",")
          )
        : Array.isArray(g.hands)
        ? g.hands
        : [[], []],

    // ✅ SAFE DECK
    deck:
      typeof g.deck === "string"
        ? split(g.deck, ",")
        : Array.isArray(g.deck)
        ? g.deck
        : [],

    discard: g.discard || null,

    turn: g.turn || null,

    pendingPick: Number(
      g.pendingPick || 0
    ),

    history:
      typeof g.history === "string"
        ? split(g.history, "||")
        : Array.isArray(g.history)
        ? g.history
        : [],

    // ✅ SAFE SCORES
    scores:
      parsedScores.length === 2
        ? parsedScores
        : Array.isArray(g.scores)
        ? g.scores
        : [0, 0],

    round: Number(g.round || 1),

    // ✅ NEVER OVERRIDE FINISHED
    status:
      g.status === "finished"
        ? "finished"
        : "playing",

    // ✅ BOOLEAN FIX
    payoutDone:
      g.payoutDone === true ||
      g.payoutDone === "true",

    winnerId: g.winnerId || null,

    matchId: g.matchId || null,

    hostName:
      g.hostName || "Player 1",

    opponentName:
      g.opponentName || "Player 2"
  };
}

// 🧠 SAFE INIT
function ensureGameReady(g) {

  // 🛑 NEVER REBUILD FINISHED / PAID GAME
  if (
    g.status === "finished" ||
    g.payoutDone ||
    g.winnerId
  ) {
    return g;
  }

  // 🛑 ONLY INIT TRULY EMPTY GAME
  const invalidGame =
    !g.deck?.length ||
    !g.hands?.length ||
    g.hands.length < 2 ||
    !g.hands?.[0] ||
    !g.hands?.[1] ||
    !g.discard;

  if (invalidGame) {

    const deck = createDeck();

    return {
      ...g,

      hands: [
        deck.splice(0, 6),
        deck.splice(0, 6)
      ],

      discard: deck.pop(),

      deck,

      pendingPick: 0,

      history: [],

      // ✅ SAFE SCORES
      scores: [0, 0],

      round: 1,

      status: "playing",

      payoutDone: false,

      winnerId: null
    };
  }

  return g;
}

// 📝 HISTORY
function pushHistory(g, text) {
  return [...(g.history || []), text]
    .slice(-10);
}

// ✅ EMPTY MARKET HANDLER
function handleEmptyMarket(g) {

  // 🛑 NEVER TOUCH FINISHED GAME
  if (
    g.status === "finished" ||
    g.payoutDone ||
    g.winnerId
  ) {
    return g;
  }

  const p0 = g.hands[0].length;
  const p1 = g.hands[1].length;

  let winnerIdx = null;

  if (p0 < p1) winnerIdx = 0;
  else if (p1 < p0) winnerIdx = 1;

  // ⚖️ DRAW
  if (winnerIdx === null) {

    return {
      ...g,

      history: pushHistory(
        g,
        "⚖️ Round draw (market finished)"
      )
    };
  }

  // ✅ SAFE SCORE UPDATE
  const scores = [...(g.scores || [0, 0])];

  scores[winnerIdx]++;

  // 🏁 MATCH FINISH
  if (scores[winnerIdx] >= 2) {

    return {
      ...g,

      scores,

      status: "finished",

      winnerId: g.players[winnerIdx],

      payoutDone: false,

      turn: null,

      history: pushHistory(
        g,
        `🏆 ${
          winnerIdx === 0
            ? "Player 1"
            : "Player 2"
        } wins (market empty)`
      )
    };
  }

  // 🔁 NEXT ROUND
  const deck = createDeck();

  return {
    ...g,

    scores,

    hands: [
      deck.splice(0, 6),
      deck.splice(0, 6)
    ],

    discard: deck.pop(),

    deck,

    pendingPick: 0,

    round: (g.round || 1) + 1,

    history: pushHistory(
      g,
      "♻️ New round (market empty)"
    )
  };
}

export default function WhotGame({
  gameId,
  goHome
}) {

  const [game, setGame] = useState(null);

  const [match, setMatch] = useState(null);

  const [userId, setUserId] = useState(null);

  const [error, setError] = useState("");

  const [showWin, setShowWin] =
    useState(false);

  // 🆕 CHAT STATE
  const [showChat, setShowChat] =
    useState(false);

  // 🏁 FINISH COUNTDOWN
  const [countdown, setCountdown] =
    useState(4);

  // ✅ payout guard
  const payoutRef = useRef(false);

  // ✅ logout guard
  const finishRef = useRef(false);

  const actionLock = useRef(false);

  function invalidMove(msg) {

    beep(120, 300);

    setError(msg);

    setTimeout(() => {
      setError("");
    }, 1200);
  }

  // 🔑 GET USER
  useEffect(() => {

    account.get()
      .then(u => setUserId(u.$id));

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

        console.warn(
          "Game not found, checking recovery..."
        );
      }

      // 🔹 RECOVER ONLY ACTIVE MATCH
      if (!g) {

        try {

          const matchRes =
            await databases.listDocuments(
              DATABASE_ID,
              MATCH_COLLECTION,
              [
                Query.equal(
                  "gameId",
                  gameId
                )
              ]
            );

          if (matchRes.documents.length) {

            const m =
              matchRes.documents[0];

            // 🛑 NEVER RECOVER FINISHED MATCH
            if (
              m.status === "finished" ||
              m.payoutDone ||
              m.winnerId
            ) {

              goHome();
              return;
            }

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

              opponentName:
                m.opponentName,

              payoutDone: false,

              winnerId: null
            };

            // ✅ IMPORTANT:
            // USE SAME GAME ID
            g = await databases.createDocument(
              DATABASE_ID,
              GAME_COLLECTION,
              gameId,
              encodeGame(newGame)
            );
          }

        } catch (err) {

          console.error(
            "Recovery failed:",
            err
          );
        }
      }

      // 🔹 LOAD MATCH
      if (g?.matchId) {

        try {

          const m =
            await databases.getDocument(
              DATABASE_ID,
              MATCH_COLLECTION,
              g.matchId
            );

          setMatch(m);

        } catch {}
      }

      // 🔹 SET GAME
      if (g) {

        const parsed =
          ensureGameReady(
            parseGame(g)
          );

        setGame(parsed);

        // 🏁 FINISHED GAME
        if (
          parsed.status === "finished"
        ) {

          // 💰 PAYOUT WINNER ONLY
          if (
            parsed.winnerId === userId &&
            !parsed.payoutDone &&
            !payoutRef.current
          ) {

            payoutRef.current = true;

            handlePayout(parsed);
          }

          // 🎉 SHOW WIN MESSAGE
          if (
            parsed.winnerId === userId
          ) {

            setShowWin(true);

            successSound();
          }

          // ⏳ AUTO EXIT BOTH PLAYERS
          if (!finishRef.current) {

            finishRef.current = true;

            let time = 4;

            setCountdown(4);

            const timer =
              setInterval(() => {

                time--;

                setCountdown(time);

                if (time <= 0) {

                  clearInterval(timer);

                  goHome();
                }

              }, 1000);
          }

          return;
        }
      }
    };

    load();

    // =========================
    // 🔄 REALTIME SUBSCRIBE
    // =========================
    const unsub =
      databases.client.subscribe(
        `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
        (res) => {

          const parsed =
            ensureGameReady(
              parseGame(res.payload)
            );

          setGame(parsed);

          // 🏁 FINISHED GAME
          if (
            parsed.status === "finished"
          ) {

            // 💰 PAYOUT WINNER ONLY
            if (
              parsed.winnerId === userId &&
              !parsed.payoutDone &&
              !payoutRef.current
            ) {

              payoutRef.current = true;

              handlePayout(parsed);
            }

            // 🎉 WIN UI
            if (
              parsed.winnerId === userId
            ) {

              setShowWin(true);

              successSound();
            }

            // ⏳ AUTO EXIT
            if (!finishRef.current) {

              finishRef.current = true;

              let time = 4;

              setCountdown(4);

              const timer =
                setInterval(() => {

                  time--;

                  setCountdown(time);

                  if (time <= 0) {

                    clearInterval(timer);

                    goHome();
                  }

                }, 1000);
            }
          }
        }
      );

    return () => unsub();

  }, [gameId, userId]);

    // 🔹 LOAD MATCH
if (g?.matchId) {
  try {
    const m = await databases.getDocument(
      DATABASE_ID,
      MATCH_COLLECTION,
      g.matchId
    );

    setMatch(m);

  } catch (err) {
    console.error("Match load failed:", err);
  }
}

// 🔹 SET GAME
if (g) {

  // ✅ IMPORTANT:
  // Never recreate finished games
  const parsed = parseGame(g);

  // 🛑 LOCK FINISHED GAME
  if (parsed.status === "finished") {

    setGame(parsed);

    // 💰 PAYOUT RUNS ONLY ONCE
    if (
      parsed.winnerId &&
      !parsed.payoutDone &&
      !payoutRef.current
    ) {

      payoutRef.current = true;

      // 💰 run payout in background
      handlePayout(parsed);
    }

    return; // ✅ STOP
  }

  // ✅ ONLY repair broken ACTIVE games
  const safeGame = ensureGameReady(parsed);

  setGame(safeGame);
}

};

load();

// 🔄 REALTIME
const unsub = databases.client.subscribe(
  `databases.${DATABASE_ID}.collections.${GAME_COLLECTION}.documents.${gameId}`,
  async (res) => {

    const parsed = parseGame(res.payload);

    // =========================
    // 🛑 GAME FINISHED
    // =========================
    if (parsed.status === "finished") {

      setGame(parsed);

      // =========================
      // 🏆 WINNER FLOW
      // =========================
      if (parsed.winnerId === userId) {

        setShowWin(true);

        successSound();

        // 💰 PAYOUT ONLY ONCE
        if (
          !parsed.payoutDone &&
          !payoutRef.current
        ) {

          payoutRef.current = true;

          await handlePayout(parsed);
        }

        // ⏳ SHOW COUNTDOWN
        let count = 4;

        setError(`🎉 You won! Leaving in ${count}...`);

        const timer = setInterval(() => {

          count--;

          if (count > 0) {
            setError(`🎉 You won! Leaving in ${count}...`);
          }

          if (count <= 0) {

            clearInterval(timer);

            goHome?.();
          }

        }, 1000);
      }

      // =========================
      // ❌ LOSER FLOW
      // =========================
      else {

        beep(150, 700);

        let count = 4;

        setError(`❌ You lost! Leaving in ${count}...`);

        const timer = setInterval(() => {

          count--;

          if (count > 0) {
            setError(`❌ You lost! Leaving in ${count}...`);
          }

          if (count <= 0) {

            clearInterval(timer);

            goHome?.();
          }

        }, 1000);
      }

      return; // ✅ STOP ALL GAME LOGIC
    }

    // ✅ NORMAL GAME UPDATE
    setGame(parsed);
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

    // 🔒 GET MATCH
    const matchDoc = await databases.getDocument(
      DATABASE_ID,
      MATCH_COLLECTION,
      g.matchId
    );

    // ✅ already paid
    if (matchDoc.payoutDone) return;

    const pot = Number(matchDoc.pot || 0);

    // ✅ no money
    if (pot <= 0) return;

    // =========================
    // 🏦 FIND WINNER WALLET
    // =========================
    const walletRes = await databases.listDocuments(
      DATABASE_ID,
      WALLET_COLLECTION,
      [
        Query.equal("userId", g.winnerId),
        Query.limit(1)
      ]
    );

    if (!walletRes.documents.length) {

      console.error("Winner wallet not found");

      return;
    }

    const wallet = walletRes.documents[0];

    // =========================
    // 💰 CREDIT WINNER
    // =========================
    await databases.updateDocument(
      DATABASE_ID,
      WALLET_COLLECTION,
      wallet.$id,
      {
        balance: Number(wallet.balance || 0) + pot
      }
    );

    // =========================
    // 🧹 EMPTY POT
    // =========================
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

    // =========================
    // 🔒 LOCK GAME
    // =========================
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

  } catch (err) {

    console.error("❌ Payout error:", err);
  }
}
         
// =========================
// 🎮 PLAY CARD
// =========================
async function playCard(i) {

  // 🔒 BLOCK ACTIONS
  if (
    actionLock.current ||
    game.status === "finished"
  ) return;

  // 🔒 TURN CHECK
  if (game.turn !== userId) {
    return invalidMove("Not your turn");
  }

  actionLock.current = true;

  try {

    // ✅ SAFE CLONE
    const g = JSON.parse(JSON.stringify(game));

    // ✅ SAFE INDEX
    const myIdx = g.players.indexOf(userId);

    if (myIdx === -1) {
      actionLock.current = false;
      return;
    }

    const oppIdx = myIdx === 0 ? 1 : 0;

    const myLabel =
      myIdx === 0 ? "Player 1" : "Player 2";

    // ✅ SAFE CARD
    const card = g.hands?.[myIdx]?.[i];

    if (!card) {
      actionLock.current = false;
      return invalidMove("Invalid card");
    }

    const current = decodeCard(card);
    const topDecoded = decodeCard(g.discard);

    // ✅ SAFETY
    if (!current || !topDecoded) {

      actionLock.current = false;

      return invalidMove("Game error");
    }

    // =========================
    // 🔒 PICK STACK RULE
    // =========================
    if (
      g.pendingPick > 0 &&
      ![2, 14].includes(current.number)
    ) {

      actionLock.current = false;

      return invalidMove("Use 2 or 14");
    }

    // =========================
    // ❌ INVALID MOVE
    // =========================
    if (
      current.number !== topDecoded.number &&
      current.shape !== topDecoded.shape &&
      current.number !== 14
    ) {

      actionLock.current = false;

      return invalidMove("Wrong move");
    }

    // =========================
    // ✅ REMOVE CARD
    // =========================
    g.hands[myIdx].splice(i, 1);

    // ✅ NEW TOP CARD
    g.discard = card;

    let nextTurn = g.players[oppIdx];

    // =========================
    // 🔁 SPECIAL RULES
    // =========================
    if (
      current.number === 1 ||
      current.number === 8
    ) {
      nextTurn = userId;
    }

    if (current.number === 2) {
      g.pendingPick += 2;
    }

    if (current.number === 14) {
      g.pendingPick += 1;
    }

    // =========================
    // 📝 HISTORY
    // =========================
    g.history = pushHistory(
      g,
      `${myLabel} played ${card}`
    );

    // =========================
    // 🏆 ROUND WIN
    // =========================
    if (!g.hands[myIdx].length) {

      const newScores = [...(g.scores || [0, 0])];

      newScores[myIdx]++;

      // =========================
      // 🏁 MATCH FINISH
      // =========================
      if (newScores[myIdx] >= 2) {

        await databases.updateDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId,
          {

            // ✅ SAFE DATABASE FORMAT
            hands: g.hands
              .map(p => p.join(","))
              .join("|"),

            deck: g.deck.join(","),

            discard: card,

            turn: null,

            pendingPick: String(g.pendingPick || 0),

            scores: newScores.join(","),

            round: String(g.round || 1),

            // 🔒 FINISH GAME
            status: "finished",

            winnerId: userId,

            payoutDone: false,

            // 📝 FINAL HISTORY
            history: pushHistory(
              g,
              `🏆 ${myLabel} wins the match`
            ).join("||")
          }
        );

        return;
      }

      // =========================
      // 🔁 NEXT ROUND
      // =========================
      const deck = createDeck();

      g.hands = [
        deck.splice(0, 6),
        deck.splice(0, 6)
      ];

      g.discard = deck.pop();

      g.deck = deck;

      g.pendingPick = 0;

      g.round = (g.round || 1) + 1;

      g.scores = newScores;

      g.history = pushHistory(
        g,
        `♻️ Round ${g.round} started`
      );

      // ✅ SAVE ROUND
      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        encodeGame(g)
      );

      return;
    }

    // =========================
    // 🎮 NORMAL TURN
    // =========================
    await databases.updateDocument(
      DATABASE_ID,
      GAME_COLLECTION,
      gameId,
      {

        // ✅ SAFE FORMAT
        hands: g.hands
          .map(p => p.join(","))
          .join("|"),

        deck: g.deck.join(","),

        discard: card,

        turn: nextTurn,

        pendingPick: String(g.pendingPick || 0),

        scores: g.scores.join(","),

        round: String(g.round || 1),

        status: g.status || "playing",

        payoutDone: g.payoutDone || false,

        winnerId: g.winnerId || null,

        history: g.history.join("||")
      }
    );

  } catch (err) {

    console.error("playCard error:", err);

  } finally {

    actionLock.current = false;
  }
}

// =========================
// 🎮 ACTION: DRAW FROM MARKET
// =========================
async function drawMarket() {

  // 🔒 LOCK FINISHED GAME
  if (
    actionLock.current ||
    game.status === "finished" ||
    game.payoutDone
  ) return;

  if (game.turn !== userId) {
    return invalidMove("Not your turn");
  }

  actionLock.current = true;

  try {

    const g = JSON.parse(JSON.stringify(game));

    // ✅ SAFE INDEX
    const myIdx = g.players.indexOf(userId);

    if (myIdx === -1) {
      actionLock.current = false;
      return;
    }

    const oppIdx = myIdx === 0 ? 1 : 0;

    const myLabel =
      myIdx === 0
        ? "Player 1"
        : "Player 2";

    const drawCount =
      g.pendingPick > 0
        ? g.pendingPick
        : 1;

    // =========================
    // 🧠 EMPTY MARKET
    // =========================
    if (!g.deck.length) {

      const updated = handleEmptyMarket(g);

      // 🏁 GAME ENDED
      if (updated.status === "finished") {

        await databases.updateDocument(
          DATABASE_ID,
          GAME_COLLECTION,
          gameId,
          {
            ...encodeGame(updated),

            status: "finished",

            payoutDone: false,

            turn: null
          }
        );

        return;
      }

      // 🔁 NORMAL SAVE
      await databases.updateDocument(
        DATABASE_ID,
        GAME_COLLECTION,
        gameId,
        encodeGame(updated)
      );

      return;
    }

    // =========================
    // 🃏 DRAW CARDS
    // =========================
    for (let i = 0; i < drawCount; i++) {

      if (!g.deck.length) break;

      g.hands[myIdx].push(
        g.deck.pop()
      );
    }

    // =========================
    // 🔁 RESET STATE
    // =========================
    g.pendingPick = 0;

    g.turn = g.players[oppIdx];

    // =========================
    // 📝 HISTORY
    // =========================
    g.history = pushHistory(
      g,
      `${myLabel} drew ${drawCount} card${drawCount > 1 ? "s" : ""}`
    );

    // =========================
    // 💾 SAVE GAME
    // =========================
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

if (myIdx === -1) return null;

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

      {/* ERROR / COUNTDOWN */}
      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      <h3
        style={{
          textAlign: "center",
          marginBottom: 6
        }}
      >
        🎮 Whot Game
      </h3>

      {/* PLAYERS */}
      <div style={styles.row}>
        <span>
          Player 1 ({game.hostName})
        </span>

        <span>VS</span>

        <span>
          Player 2 ({game.opponentName})
        </span>
      </div>

      {/* OPPONENT CARDS */}
      <div style={{ textAlign: "center" }}>

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
          {oppLabel} Cards: {oppCards}
        </div>
      </div>

      {/* SCORE */}
      <div style={styles.row}>
        <span>
          Round {game.round}
        </span>

        <span>
          {game.scores[0]} - {game.scores[1]}
        </span>
      </div>

      {/* MONEY */}
      <div style={styles.row}>
        <span>
          ₦{match?.stake || 0}
        </span>

        <span>
          🏦 ₦{match?.pot || 0}
        </span>
      </div>

      {/* STATUS */}
      <div
        style={{
          textAlign: "center",
          marginTop: 6
        }}
      >
        <p>

          {game.status === "finished"
            ? "🏁 FINISHED"

            : game.turn === userId
            ? "🟢 YOUR TURN"

            : "⏳ OPPONENT"}

        </p>

        <button
          style={styles.chatBtn}
          onClick={() =>
            setShowChat(true)
          }
        >
          💬 Message
        </button>
      </div>

      {/* MARKET */}
      <div style={styles.center}>

        {top && (
          <img
            src={drawCard(top)}
            style={styles.card}
          />
        )}

        <button
          style={{
            ...styles.marketBtn,

            opacity:
              game.turn !== userId ||
              game.status === "finished"
                ? 0.5
                : 1
          }}

          disabled={
            game.turn !== userId ||
            game.status === "finished"
          }

          onClick={drawMarket}
        >
          🃏 {game.deck.length}
        </button>
      </div>

      {/* PLAYER HAND */}
      <div style={styles.hand}>

        {hand.map((c, i) => (

          <img
            key={i}

            src={drawCard(
              decodeCard(c)
            )}

            style={{
              ...styles.card,

              opacity:
                game.status === "finished"
                  ? 0.6
                  : 1
            }}

            onClick={() => {

              // 🔒 LOCK FINISHED GAME
              if (
                game.status === "finished"
              ) return;

              playCard(i);
            }}
          />

        ))}
      </div>

      {/* WIN BOX */}
      {showWin && (
        <div style={styles.winBox}>
          🎉 You Won ₦{match?.pot || 0}
        </div>
      )}

      {/* HISTORY */}
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

      {/* CHAT BUTTON */}
      <div
        style={{
          textAlign: "center",
          marginTop: 6
        }}
      >
        <button
          style={{
            ...styles.chatBtn,
            position: "relative"
          }}

          onClick={() => {

            setShowChat(true);

            setMatch(prev =>
              prev
                ? {
                    ...prev,
                    hasUnread: false
                  }
                : prev
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

      {/* EXIT */}
      <button onClick={goHome}>
        Exit
      </button>

      {/* CHAT POPUP */}
      {showChat && game?.matchId && (

        <div style={styles.chatOverlay}>

          <div style={styles.chatBox}>

            <div style={styles.chatHeader}>

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

              onRead={() => {

                setMatch(prev =>
                  prev
                    ? {
                        ...prev,
                        hasUnread: false
                      }
                    : prev
                );
              }}
            />

          </div>

        </div>
      )}

    </div>
  </div>
);


// =====================
// 🎨 STYLES (FINAL)
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

    borderRadius: 12,

    backdropFilter: "blur(6px)",

    boxShadow:
      "0 0 20px rgba(0,0,0,0.6)",

    position: "relative",

    overflow: "hidden"
  },

  row: {
    display: "flex",

    justifyContent: "space-between",

    alignItems: "center",

    marginBottom: 6,

    fontSize: 13,

    gap: 6
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

    transition:
      "transform 0.15s ease",

    borderRadius: 8
  },

  // 🔥 small UX boost
  cardHover: {
    transform: "scale(1.08)"
  },

  center: {
    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    gap: 10,

    marginTop: 10
  },

  marketBtn: {
    background: "gold",

    padding: 10,

    borderRadius: 8,

    border: "none",

    fontWeight: "bold",

    cursor: "pointer",

    minWidth: 70
  },

  chatBtn: {
    background: "#2563eb",

    color: "#fff",

    border: "none",

    padding: "8px 14px",

    borderRadius: 8,

    cursor: "pointer",

    fontWeight: "bold",

    marginTop: 5
  },

  error: {
    background: "#dc2626",

    padding: 10,

    borderRadius: 8,

    marginBottom: 10,

    textAlign: "center",

    fontWeight: "bold",

    animation:
      "pulse 0.8s infinite alternate"
  },

  history: {
    marginTop: 10,

    background: "#111",

    padding: 8,

    borderRadius: 8,

    maxHeight: 140,

    overflowY: "auto",

    fontSize: 12
  },

  winBox: {
    marginTop: 10,

    background:
      "linear-gradient(135deg,#16a34a,#22c55e)",

    padding: 14,

    borderRadius: 10,

    textAlign: "center",

    fontWeight: "bold",

    fontSize: 18,

    animation:
      "pulse 1s infinite alternate"
  },

  chatOverlay: {
    position: "fixed",

    inset: 0,

    background:
      "rgba(0,0,0,0.7)",

    zIndex: 999,

    display: "flex",

    justifyContent: "center",

    alignItems: "center",

    padding: 10
  },

  chatBox: {
    width: "100%",

    maxWidth: 420,

    height: "80vh",

    background: "#0f172a",

    borderRadius: 12,

    overflow: "hidden",

    display: "flex",

    flexDirection: "column"
  },

  chatHeader: {
    display: "flex",

    justifyContent: "space-between",

    alignItems: "center",

    padding: 10,

    background: "#1e293b",

    borderBottom:
      "1px solid rgba(255,255,255,0.1)",

    fontWeight: "bold"
  }
};