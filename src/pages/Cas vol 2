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

const APP_VERSION = "1.0.4";

export default function CasinoWheel({ goBack }) {

  const [wallet, setWallet] = useState(null);
  const [stake, setStake] = useState("");
  const [rotation, setRotation] = useState(0);
  const [result, setResult] = useState("");
  const [won, setWon] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [flowers, setFlowers] = useState([]);

  const tickerRef = useRef(null);
  const audioCtxRef = useRef(null);

  // =========================
  // 🎯 PROBABILITY POOL
  // =========================
  const pool = [
    { type: "LOSE", w: 0.45 },
    { type: "LOSE2", w: 0.15 },
    { type: "X1", w: 0.1 },
    { type: "FREE", w: 0.1 },
    { type: "X2", w: 0.12 },
    { type: "X3", w: 0.03 },
    { type: "X10", w: 0.009 },
    { type: "JACKPOT", w: 0.001 }
  ];

  const probabilityMap = Object.fromEntries(pool.map(p => [p.type, p.w]));

  useEffect(() => {
    loadWallet();

    const savedVersion = localStorage.getItem("app_version");
    if (savedVersion !== APP_VERSION) {
      localStorage.setItem("app_version", APP_VERSION);
      if (!sessionStorage.getItem("reloaded")) {
        sessionStorage.setItem("reloaded", "true");
        window.location.reload();
      }
    }
  }, []);

  async function loadWallet() {
    try {
      const u = await account.get();
      const res = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION,
        [Query.equal("userId", u.$id)]
      );
      if (res.documents.length) setWallet(res.documents[0]);
    } catch (err) {
      console.error("Wallet load failed:", err);
    }
  }

  // =========================
  // RESULT ENGINE
  // =========================
  const getResult = () => {
    let r = Math.random(), sum = 0;
    for (let p of pool) {
      sum += p.w;
      if (r <= sum) return p.type;
    }
  };

  // =========================
  // SPIN
  // =========================
  const spin = async () => {
    if (spinning || !wallet) return;

    const numericStake = Number(stake);

    if (!numericStake || numericStake < 50) {
      setResult("Minimum ₦50");
      return;
    }

    if (wallet.balance < numericStake) {
      setResult("Insufficient balance");
      return;
    }

    setSpinning(true);

    const outcome = getResult();

    let balanceBefore = wallet.balance;
    let newBalance = wallet.balance - numericStake;
    let win = 0;
    let status = "lose";

    if (outcome === "FREE") {
      newBalance += numericStake;
      status = "free";
      setResult("Free Spin");

    } else if (outcome === "X1") {
      newBalance += numericStake;
      status = "neutral";
      setResult("Stake Returned");

    } else if (!(outcome === "LOSE" || outcome === "LOSE2")) {
      const mult = outcome === "JACKPOT" ? 30 : parseInt(outcome.replace("X",""));
      win = numericStake * mult;
      newBalance += win;

      status = "win";
      setWon(win);
      setResult(`Won ₦${win}`);
    } else {
      setResult(`Lost ₦${numericStake}`);
    }

    // =========================
    // 💰 UPDATE WALLET
    // =========================
    try {
      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        { balance: Number(newBalance) }
      );
      setWallet(prev => ({ ...prev, balance: newBalance }));
    } catch (err) {
      console.error("Wallet update failed:", err);
      alert("Wallet update failed");
    }

    // =========================
    // 🧾 SAVE TRANSACTION
    // =========================
    try {
      const user = await account.get();

      await databases.createDocument(
        DATABASE_ID,
        CASINO_COLLECTION,
        ID.unique(),
        {
          userId: String(user.$id),
          type: "spin",
          status: String(status),
          outcome: String(outcome),
          stake: Number(numericStake),
          winAmount: Number(win),
          netChange: Number(win - numericStake),
          balanceBefore: Number(balanceBefore),
          balanceAfter: Number(newBalance),
          createdAt: new Date().toISOString()
        }
      );

    } catch (err) {
      console.error("CASINO SAVE ERROR:", err);
      alert("Spin not recorded: " + err.message);
    }

    setSpinning(false);
  };

  return (
    <div style={{ textAlign: "center", color: "#fff" }}>
      <h2>🎡 Casino Wheel</h2>

      <h3>₦{wallet?.balance || 0}</h3>

      <input
        type="number"
        value={stake}
        onChange={e => setStake(e.target.value)}
        placeholder="Stake"
      />

      <button onClick={spin}>
        {spinning ? "Spinning..." : "SPIN"}
      </button>

      <h3>{result}</h3>

      {/* 🎯 SHOW % */}
      <div style={{ marginTop: 20 }}>
        {Object.entries(probabilityMap).map(([k, v]) => (
          <div key={k}>
            {k} → {(v * 100).toFixed(1)}%
          </div>
        ))}
      </div>

      <button onClick={goBack}>Back</button>
    </div>
  );
}