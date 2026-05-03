import { useState, useEffect, useRef } from "react";
import {
  databases,
  DATABASE_ID,
  WALLET_COLLECTION,
  CASINO_COLLECTION,
  account,
  Query,
  ID
} from "../lib/appwrite";

const names = ["Emeka","Tunde","Chioma","Ibrahim","Mary","David","Zainab"];
const cities = ["Lagos","Abuja","Ibadan","Kano","Enugu"];

export default function CasinoWheel() {

  const [wallet, setWallet] = useState(null);
  const [stake, setStake] = useState("");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState("");
  const [won, setWon] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [canStop, setCanStop] = useState(false);
  const [feed, setFeed] = useState([]);
  const [flowers, setFlowers] = useState([]);
  const [glow, setGlow] = useState(false);
  const [flashIndex, setFlashIndex] = useState(null);

  const timeoutRef = useRef(null);
  const spinDataRef = useRef(null);

  const segments = [
    { label: "LOSE", type: "LOSE", color: "#ef4444" },
    { label: "x2", type: "X2", color: "#22c55e" },
    { label: "FREE", type: "FREE", color: "#3b82f6" },
    { label: "x3", type: "X3", color: "#a855f7" },
    { label: "LOSE", type: "LOSE2", color: "#ef4444" },
    { label: "x1", type: "X1", color: "#f59e0b" },
    { label: "😬", type: "ALMOST", color: "#fb923c" },
    { label: "💎30", type: "JACKPOT", color: "#eab308" }
  ];

  const segmentAngle = 360 / segments.length;

  const gradient = `conic-gradient(from -90deg, ${segments
    .map((s, i) => `${s.color} ${i * segmentAngle}deg ${(i + 1) * segmentAngle}deg`)
    .join(",")})`;

  const amount = Number(stake) || 0;

  useEffect(() => {
    loadWallet();

    const style = document.createElement("style");
    style.innerHTML = `
      @keyframes fall {
        to { transform: translateY(110vh) rotate(360deg); opacity: 0; }
      }
    `;
    document.head.appendChild(style);

    const interval = setInterval(() => {
      const name = names[Math.floor(Math.random() * names.length)];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const amt = Math.floor(Math.random() * 50000) + 2000;

      const id = Date.now();
      setFeed(prev => [...prev, {
        id,
        msg: `💰 ${name} from ${city} won ₦${amt}`
      }]);

      setTimeout(() => {
        setFeed(prev => prev.filter(f => f.id !== id));
      }, 3500);

    }, 4000);

    return () => clearInterval(interval);
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

  const getResult = () => {
    const r = Math.random();

    if (r < 0.45) return "LOSE";
    if (r < 0.65) return "LOSE2";
    if (r < 0.75) return "ALMOST";
    if (r < 0.83) return "FREE";
    if (r < 0.93) return "X1";
    if (r < 0.98) return "X2";
    return "X3";
  };

  function spawnFlowers() {
    const items = Array.from({ length: 25 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100
    }));
    setFlowers(items);
    setTimeout(() => setFlowers([]), 3000);
  }

  const spin = async () => {
    if (spinning || !wallet) return;

    const bet = Number(stake);
    if (!bet || bet < 50) return;
    if (wallet.balance < bet) return;

    setSpinning(true);
    setCanStop(true);
    setGlow(true);

    let deducted = wallet.balance - bet;

    await databases.updateDocument(
      DATABASE_ID,
      WALLET_COLLECTION,
      wallet.$id,
      { balance: deducted }
    );

    setWallet(prev => ({ ...prev, balance: deducted }));

    const outcome = getResult();
    let index = segments.findIndex(s => s.type === outcome);

    const jackpotIndex = segments.findIndex(s => s.type === "JACKPOT");
    if (index === jackpotIndex || index === -1) {
      index = segments.findIndex(s => s.type === "LOSE");
    }

    const centerAngle = index * segmentAngle + segmentAngle / 2;

    // 🎯 FIXED POINTER ALIGNMENT
    const pointerOffset = 90;

    const spins = 360 * 5;
    const finalAngle = spins + (360 - centerAngle + pointerOffset);

    spinDataRef.current = { outcome, bet, deducted, index };

    setRotation(finalAngle);
    timeoutRef.current = setTimeout(finishSpin, 4000);
  };

  const finishSpin = async () => {
    const data = spinDataRef.current;
    if (!data) return;

    const { outcome, bet, deducted, index } = data;

    let win = 0;
    const mult = { X1:1, X2:2, X3:3 }[outcome];

    if (outcome === "FREE") {
      win = bet;
      setResult("🎁 FREE SPIN");
    } else if (outcome === "ALMOST") {
      setResult("😬 ALMOST! TRY AGAIN");
    } else if (mult) {
      win = bet * mult;
      setResult(`🎉 YOU WON ₦${win}`);
      setWon(win);
      if (win > bet) spawnFlowers();
    } else {
      setResult("❌ YOU LOST");
    }

    const finalBalance = deducted + win;

    await databases.updateDocument(
      DATABASE_ID,
      WALLET_COLLECTION,
      wallet.$id,
      { balance: finalBalance }
    );

    setWallet(prev => ({ ...prev, balance: finalBalance }));

    try {
      await databases.createDocument(
        DATABASE_ID,
        CASINO_COLLECTION,
        ID.unique(),
        {
          userId: wallet.userId || wallet.$id,
          stake: bet,
          win,
          result: outcome,
          createdAt: new Date().toISOString()
        }
      );
    } catch {}

    setFlashIndex(index);
    setGlow(false);
    setSpinning(false);
    setCanStop(false);

    setTimeout(() => {
      setFlashIndex(null);
      setResult("");
      setWon(0);
      setRotation(0);
      setStake("");
    }, 4000);
  };

  const handleStop = () => {
    if (!spinning) return;
    clearTimeout(timeoutRef.current);
    finishSpin();
  };

  return (
    <div style={{ textAlign: "center", paddingTop: 120 }}>

      {/* RETURNS */}
      <div style={{
        position: "fixed",
        top: 10,
        left: 10,
        background: "#000",
        color: "gold",
        fontWeight: "bold",
        padding: 10,
        borderRadius: 10,
        border: "1px solid gold"
      }}>
        🎯 RETURNS
        <div>x1 → ₦{amount}</div>
        <div>x2 → ₦{amount * 2}</div>
        <div>x3 → ₦{amount * 3}</div>
        <div style={{ marginTop: 6, textShadow: "0 0 6px gold" }}>
          💎 JACKPOT → ₦100,000
        </div>
      </div>

      {/* FEED */}
      <div style={{ position: "fixed", top: 10, right: 10 }}>
        {feed.map(f => (
          <div key={f.id} style={{
            background: "#000",
            color: "gold",
            fontWeight: "bold",
            padding: 8,
            margin: 4,
            borderRadius: 6,
            border: "1px solid gold"
          }}>
            {f.msg}
          </div>
        ))}
      </div>

      <h3>💰 ₦{wallet?.balance || 0}</h3>

      <input
        type="number"
        placeholder="Min ₦50"
        value={stake}
        onChange={e => setStake(e.target.value)}
        style={{ padding: 10, textAlign: "center" }}
      />

      <p style={{ color: "red", fontWeight: "bold" }}>
        Stake: ₦{stake || 0}
      </p>

      {/* WHEEL */}
      <div style={{ position: "relative", width: 300, margin: "20px auto" }}>
        <div style={{
          position: "absolute",
          top: -5,
          left: "50%",
          transform: "translateX(-50%)",
          borderLeft: "14px solid transparent",
          borderRight: "14px solid transparent",
          borderBottom: "24px solid gold",
          zIndex: 10
        }} />

        <div style={{
          width: 280,
          height: 280,
          borderRadius: "50%",
          background: gradient,
          transform: `rotate(${rotation}deg)`,
          transition: spinning ? "transform 4s cubic-bezier(0.1,0.7,0.2,1)" : "none",
          boxShadow: glow ? "0 0 30px gold" : ""
        }}>
          {segments.map((s, i) => (
            <div key={i} style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `rotate(${i * segmentAngle}deg) translate(0,-140px) rotate(-${i * segmentAngle}deg)`,
              color: flashIndex === i ? "gold" : "#fff",
              fontWeight: "bold"
            }}>
              {s.label}
            </div>
          ))}
        </div>
      </div>

      {/* BUTTONS */}
      <button
        onClick={spin}
        disabled={spinning}
        style={{
          padding: "18px 30px",
          fontSize: 20,
          fontWeight: "bold",
          borderRadius: 14,
          background: "linear-gradient(135deg, gold, orange)",
          border: "none",
          boxShadow: "0 0 15px gold"
        }}
      >
        {spinning ? "Spinning..." : "SPIN"}
      </button>

      {spinning && (
        <div style={{ marginTop: 10 }}>
          <button onClick={handleStop}>STOP</button>
        </div>
      )}

      {/* RESULT */}
      <div style={{
        fontSize: 36,
        fontWeight: "bold",
        marginTop: 20,
        color:
          result.includes("WON") ? "gold" :
          result.includes("LOST") ? "red" :
          result.includes("ALMOST") ? "orange" : "#fff"
      }}>
        {result}
      </div>

      {won > 0 && <h2 style={{ color: "gold" }}>₦{won}</h2>}

      {/* FLOWERS */}
      {flowers.map(f => (
        <div key={f.id} style={{
          position: "fixed",
          top: "-10px",
          left: `${f.left}%`,
          animation: "fall 3s linear"
        }}>🌸</div>
      ))}

    </div>
  );
}