import { useState, useRef, useEffect } from "react";
import {
  databases,
  DATABASE_ID,
  WALLET_COLLECTION,
  CASINO_COLLECTION,
  account,
  Query,
  ID
} from "../lib/appwrite";

export default function CasinoWheel({ goBack }) {

  const [wallet, setWallet] = useState(null);
  const [stake, setStake] = useState("");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState("");
  const [won, setWon] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [feed, setFeed] = useState([]);
  const [popup, setPopup] = useState(null);
  const [countdown, setCountdown] = useState(null);

  // ✅ NEW
  const [flowers, setFlowers] = useState([]);

  const tickerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const countdownRef = useRef(null); // ✅ FIX

  useEffect(() => {
    loadWallet();

    // ✅ inject animation once
    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes fall {
        to {
          transform: translateY(110vh) rotate(360deg);
          opacity: 0;
        }
      }
    `;
    document.head.appendChild(style);

  }, []);

  async function loadWallet() {
    const u = await account.get();
    const res = await databases.listDocuments(
      DATABASE_ID,
      WALLET_COLLECTION,
      [Query.equal("userId", u.$id)]
    );
    if (res.documents.length) setWallet(res.documents[0]);
  }

  // =========================
  // SEGMENTS
  // =========================
  const segments = [
    { label: "❌ LOSE", type: "LOSE", color: "#ef4444" },
    { label: "x2", type: "X2", color: "#22c55e" },
    { label: "🎁 FREE", type: "FREE", color: "#3b82f6" },
    { label: "x3", type: "X3", color: "#a855f7" },
    { label: "❌ LOSE", type: "LOSE2", color: "#ef4444" },
    { label: "x1", type: "X1", color: "#f59e0b" },
    { label: "🔥 x10", type: "X10", color: "#f97316" },
    { label: "💎 ×30", type: "JACKPOT", color: "#eab308" }
  ];

  const segmentAngle = 360 / segments.length;

  const gradient = `conic-gradient(${segments
    .map((s, i) => `${s.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
    .join(",")})`;

  const map = {
    LOSE: 0,
    X2: 1,
    FREE: 2,
    X3: 3,
    LOSE2: 4,
    X1: 5,
    X10: 6,
    JACKPOT: 7
  };

  // =========================
  // RESULT ENGINE
  // =========================
  const getResult = () => {
    const pool = [
      { type: "LOSE", w: 0.39 },
      { type: "LOSE2", w: 0.05 },
      { type: "X1", w: 0.1 },
      { type: "FREE", w: 0.24 },
      { type: "X2", w: 0.18 },
      { type: "X3", w: 0.03 },
      { type: "X10", w: 0.009 },
      { type: "JACKPOT", w: 0.001 }
    ];
    let r = Math.random(), sum = 0;
    for (let p of pool) {
      sum += p.w;
      if (r <= sum) return p.type;
    }
  };

  // =========================
  // SOUND
  // =========================
  const playTick = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    const ctx = audioCtxRef.current;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.frequency.value = 600;
    g.gain.value = 0.05;
    o.start();
    setTimeout(() => o.stop(), 40);
  };

  const startTicking = () => {
    let speed = 40;
    const loop = () => {
      playTick();
      speed += 6;
      tickerRef.current = setTimeout(loop, speed);
    };
    loop();
  };

  const stopTicking = () => clearTimeout(tickerRef.current);

  // =========================
  // 🌸 FLOWERS
  // =========================
  function spawnFlowers() {
    const items = Array.from({ length: 30 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100
    }));

    setFlowers(items);
    setTimeout(() => setFlowers([]), 3000);
  }

  // =========================
  // ⏳ FIXED COUNTDOWN
  // =========================
  function startCountdown() {
    if (countdownRef.current) clearInterval(countdownRef.current);

    let t = 4;
    setCountdown(t);

    countdownRef.current = setInterval(() => {
      t--;
      setCountdown(t);

      if (t <= 0) {
        clearInterval(countdownRef.current);
        countdownRef.current = null;

        setCountdown(null);
        setResult("");
        setWon(0);
        setPopup(null);
        setRotation(prev => prev % 360);
      }
    }, 1000);
  }

  // =========================
  // SPIN
  // =========================
  const spin = async () => {
    if (spinning || !wallet) return;

    const numericStake = Number(stake);

    if (!numericStake || numericStake < 50) {
      setResult("⚠️ Minimum stake ₦50");
      return;
    }

    if (wallet.balance < numericStake) {
      setResult("❌ Insufficient balance");
      return;
    }

    setSpinning(true);
    setResult("");
    setWon(0);

    const outcome = getResult();
    const index = map[outcome];

    const target = index * segmentAngle + segmentAngle / 2;
    const stop = 360 - target;

    const duration = 4500;

    startTicking();
    setRotation(prev => prev % 360 + 1800 + stop);

    setTimeout(async () => {
      stopTicking();

      let balanceBefore = wallet.balance;
      let newBalance = wallet.balance - numericStake;
      let win = 0;
      let status = "lose";
      let netChange = -numericStake;

      if (outcome === "FREE") {
        newBalance += numericStake;
        status = "free";
        netChange = 0;
        setResult("🎁 Free Spin!");

      } else if (outcome === "X1") {
        newBalance += numericStake;
        status = "neutral";
        netChange = 0;
        setResult("⚖️ Stake Returned");

      } else if (!(outcome === "LOSE" || outcome === "LOSE2")) {
        const mult = outcome === "JACKPOT" ? 30 : parseInt(outcome.replace("X",""));
        win = numericStake * mult;
        newBalance += win;

        status = "win";
        netChange = win - numericStake;

        setWon(win);
        setPopup("win");

        spawnFlowers(); // ✅ FIXED

        setFeed(prev => [
          ...prev,
          { id: Date.now(), msg: `🎉 You won ₦${win.toLocaleString()}` }
        ]);

        setResult(`🎉 ₦${win.toLocaleString()}`);
      } else {
        setResult(`❌ Lost ₦${numericStake}`);
      }

      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        { balance: newBalance }
      );

      setWallet(prev => ({ ...prev, balance: newBalance }));

      const user = await account.get();
      await databases.createDocument(
        DATABASE_ID,
        CASINO_COLLECTION,
        ID.unique(),
        {
          userId: user.$id,
          type: "spin",
          status,
          outcome,
          stake: numericStake,
          winAmount: win,
          netChange,
          balanceBefore,
          balanceAfter: newBalance,
          createdAt: new Date().toISOString()
        }
      );

      startCountdown(); // ✅ FIXED
      setSpinning(false);

    }, duration);
  };

  return (
    <div style={{ display: "flex", color: "#fff" }}>

      {/* LEFT */}
      <div style={{ width: 120, padding: 10 }}>
        <h4>Returns</h4>
        <div>x2 → ₦{stake * 2}</div>
        <div>x3 → ₦{stake * 3}</div>
        <div>x10 → ₦{stake * 10}</div>
        <div>x30 → ₦{stake * 30}</div>
      </div>

      {/* CENTER */}
      <div style={{ flex: 1, textAlign: "center" }}>

        <button onClick={goBack} style={{ position: "relative", zIndex: 9999 }}>
          ← Exit
        </button>

        <h2>🎡 Casino Wheel</h2>

        <h3>💰 ₦{Number(wallet?.balance || 0).toLocaleString()}</h3>

        <input
          type="number"
          value={stake}
          onChange={e => setStake(e.target.value)}
          placeholder="Enter stake (min ₦50)"
        />

        <div style={{ color: "#f87171", fontWeight: "700", fontSize: 12 }}>
          Minimum Stake: ₦50
        </div>

        <div style={{ fontSize: 26 }}>🔻</div>

        <div style={{
          width: 260,
          height: 260,
          margin: "20px auto",
          borderRadius: "50%",
          position: "relative",
          background: gradient,
          transform: `rotate(${rotation}deg)`,
          transition: "transform 4.5s cubic-bezier(.17,.67,.83,.67)"
        }}>
          {segments.map((seg, i) => {
            const angle = i * segmentAngle + segmentAngle / 2;
            return (
              <div key={i} style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: `rotate(${angle}deg) translate(0, -95px) rotate(-${angle}deg)`
              }}>
                <div style={{
                  fontWeight: "900",
                  fontSize: 13,
                  letterSpacing: "0.6px",
                  textShadow: "0 3px 6px black"
                }}>
                  {seg.label}
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={spin}>
          {spinning ? "Spinning..." : "SPIN"}
        </button>

        <h3>{result}</h3>
        <h2>₦{won}</h2>

        {countdown !== null && (
          <div style={{ color: "#facc15", fontWeight: "700" }}>
            Next spin in {countdown}s...
          </div>
        )}

        {popup === "win" && (
          <div style={{
            position: "fixed",
            top: "40%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "#000",
            padding: 20,
            borderRadius: 10,
            zIndex: 999
          }}>
            🎉 ₦{won.toLocaleString()}
          </div>
        )}

      </div>

      {/* RIGHT */}
      <div style={{ width: 150 }}>
        {feed.map(f => <div key={f.id}>{f.msg}</div>)}
      </div>

      {/* 🌸 FLOWERS */}
      {flowers.map(f => (
        <div key={f.id} style={{
          position: "fixed",
          top: "-20px",
          left: `${f.left}%`,
          fontSize: "20px",
          animation: "fall 3s linear forwards",
          pointerEvents: "none"
        }}>
          🌸
        </div>
      ))}

    </div>
  );
}