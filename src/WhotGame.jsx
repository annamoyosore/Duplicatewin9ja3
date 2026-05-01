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

    gain.gain.setValueAtTime(0.25, ctx.currentTime);
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
// 🎴 HELPERS
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

function cardLabel(cardStr) {
  const c = decodeCard(cardStr);
  if (!c) return "";

  const shapeMap = {
    circle: "●",
    triangle: "▲",
    square: "■",
    star: "★",
    cross: "✚"
  };

  return `${shapeMap[c.shape]} ${c.number}`;
}

// =========================
// 🎴 PARSE
// =========================
function parseGame(g) {
  return {
    ...g,
    players: g.players?.split(",") || [],
    deck: g.deck?.split(",").filter(Boolean) || [],
    hands: g.hands?.split("|").map(p => p.split(",").filter(Boolean)) || [[], []],
    discard: g.discard || null,
    turn: g.turn || null,
    pendingPick: Number(g.pendingPick || 0),
    history: g.history ? g.history.split("||").filter(Boolean) : [],
    scores: g.scores?.split(",").map(Number) || [0, 0],
    round: Number(g.round || 1),
    status: g.status || "playing",
    payoutDone: Boolean(g.payoutDone),
    winnerId: g.winnerId || null,
    matchId: g.matchId || null
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

  useEffect(() => {
    account.get().then(u => setUserId(u.$id));
  }, []);

  useEffect(() => {
    if (!gameId || !userId) return;

    const load = async () => {
      const g = await databases.getDocument(DATABASE_ID, GAME_COLLECTION, gameId);
      setGame(parseGame(g));

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

          // 🔒 prevent double payout
          if (payoutRef.current) return;

          const fresh = await databases.getDocument(
            DATABASE_ID,
            GAME_COLLECTION,
            parsed.$id
          );

          if (fresh.payoutDone) return;

          payoutRef.current = true;

          try {
            const m = parsed.matchId
              ? await databases.getDocument(
                  DATABASE_ID,
                  MATCH_COLLECTION,
                  parsed.matchId
                )
              : null;

            const pot = Number(m?.pot || 0);

            // =========================
            // 💰 PAY ONLY WINNER
            // =========================
            const winnerWallet = await databases.listDocuments(
              DATABASE_ID,
              WALLET_COLLECTION,
              [Query.equal("userId", parsed.winnerId)]
            );

            if (winnerWallet.documents.length) {
              const w = winnerWallet.documents[0];

              await databases.updateDocument(
                DATABASE_ID,
                WALLET_COLLECTION,
                w.$id,
                {
                  balance: Number(w.balance || 0) + pot
                }
              );
            }

            // =========================
            // 🔓 CLEAR LOCKED FOR EACH PLAYER
            // =========================
            for (let pid of parsed.players) {
              const wallets = await databases.listDocuments(
                DATABASE_ID,
                WALLET_COLLECTION,
                [Query.equal("userId", pid)]
              );

              if (wallets.documents.length) {
                const w = wallets.documents[0];

                await databases.updateDocument(
                  DATABASE_ID,
                  WALLET_COLLECTION,
                  w.$id,
                  {
                    locked: 0 // 🔥 IMPORTANT FIX
                  }
                );
              }
            }

            // =========================
            // ✅ MARK COMPLETE
            // =========================
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

  if (!game) return <div>Loading...</div>;

  return (
    <div style={styles.bg}>
      <div style={styles.box}>
        <h2>🎮 WHOT GAME</h2>

        <div style={styles.row}>
          <span>Stake: ₦{match?.stake}</span>
          <span>Pot: ₦{match?.pot}</span>
        </div>

        <p>
          {game.status === "finished"
            ? "🏁 GAME FINISHED"
            : game.turn === userId
            ? "🟢 YOUR TURN"
            : "⏳ OPPONENT"}
        </p>

        {showWin && (
          <div style={styles.winBox}>
            🎉 YOU WON ₦{match?.pot}
          </div>
        )}

        <button onClick={goHome}>Exit</button>
      </div>
    </div>
  );
}

// =========================
// 🎨 STYLES (RESTORED)
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
    justifyContent: "space-between",
    marginBottom: 6
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