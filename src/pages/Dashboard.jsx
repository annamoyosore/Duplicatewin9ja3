// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import {
  account,
  databases,
  DATABASE_ID,
  WALLET_COLLECTION,
  Query
} from "../lib/appwrite";

// 🔒 ADMIN ID
const ADMIN_ID = "69ef9fe863a02a7490b4";

// =========================
// FAKE ACTIVITY DATA
// =========================
const names = [
  "Emeka","Tunde","Blessing","Chioma","Ibrahim",
  "Sadiq","Zainab","Kelvin","Uche","Mary",
  "Aisha","David","Samuel","Joy","Paul",
  "Esther","Yusuf","Musa","Favour","Henry",
  "Olamide","Chinedu","Ngozi","Bola","Sule"
];

const cities = [
  "Lagos","Abuja","Port Harcourt","Ibadan","Kano",
  "Enugu","Benin","Jos","Owerri","Abeokuta"
];

// =========================
// SOUND
// =========================
function playPop() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.frequency.value = 600;
    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, 200);
  } catch {}
}

// =========================
// COMPONENT
// =========================
export default function Dashboard({
  goLobby,
  goCasino,   // ✅ NEW
  goWallet,
  goTransactions,
  goAdmin,
  logout
}) {
  const [user, setUser] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);

  // =========================
  // LOAD USER + WALLET
  // =========================
  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const u = await account.get();
      setUser(u);

      const res = await databases.listDocuments(
        DATABASE_ID,
        WALLET_COLLECTION,
        [Query.equal("userId", u.$id)]
      );

      if (res.documents.length) {
        setWallet(res.documents[0]);
      }

    } catch (err) {
      console.error("Dashboard load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // RANDOM POPUPS
  // =========================
  useEffect(() => {
    const interval = setInterval(() => {
      const name = names[Math.floor(Math.random() * names.length)];
      const city = cities[Math.floor(Math.random() * cities.length)];
      const amount = (Math.floor(Math.random() * 50000) + 2000);
      const type = Math.random() > 0.5 ? "won" : "withdrew";

      const message =
        type === "won"
          ? `${name} from ${city} just won ₦${amount.toLocaleString()} 🎉`
          : `${name} from ${city} just withdrew ₦${amount.toLocaleString()} 💸`;

      const id = Date.now();

      playPop();

      setNotifications((prev) => [...prev, { id, message }]);

      setTimeout(() => {
        setNotifications((prev) =>
          prev.filter((n) => n.id !== id)
        );
      }, 4000);

    }, 5000);

    return () => clearInterval(interval);
  }, []);

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return (
      <div style={styles.loading}>
        <h2>🎮 Win9ja</h2>
        <p>Loading dashboard...</p>
      </div>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>
      <h1 style={styles.logo}>🎮 Win9ja</h1>

      <h2>Welcome, {user?.name || "Player"}</h2>

      {/* WALLET */}
      <div style={styles.card}>
        💰 Balance: ₦{Number(wallet?.balance || 0).toLocaleString()}
      </div>

      <button style={styles.btn} onClick={() => goWallet?.()}>
        💳 Wallet
      </button>

      <button style={styles.txBtn} onClick={() => goTransactions?.()}>
        📊 Transactions
      </button>

      {/* 🎲 WHOT (UNCHANGED) */}
      <button style={styles.btn} onClick={() => goLobby?.()}>
        🎲 Play WHOT
      </button>

      {/* 🎰 CASINO (NEW) */}
      <button
        style={{ ...styles.btn, background: "#22c55e" }}
        onClick={() => goCasino?.()}
      >
        🎰 Play Casino Jackpot
      </button>

      {/* ADMIN */}
      {user?.$id === ADMIN_ID && (
        <button
          style={{ ...styles.btn, background: "#9333ea" }}
          onClick={() => goAdmin?.()}
        >
          🛠 Admin Panel
        </button>
      )}

      <button
        style={{ ...styles.btn, background: "#ef4444" }}
        onClick={logout}
      >
        🚪 Logout
      </button>

      {/* NOTIFICATIONS */}
      <div style={styles.toastContainer}>
        {notifications.map((n) => (
          <div key={n.id} style={styles.toast}>
            {n.message}
          </div>
        ))}
      </div>

      <div style={styles.games}>
        <h3>🚀 Coming Soon</h3>
        <p>Poker • Blackjack • Dice</p>
      </div>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  container: {
    textAlign: "center",
    padding: 20,
    color: "white",
    background: "linear-gradient(135deg,#020617,#0f172a)",
    minHeight: "100vh",
    position: "relative"
  },
  logo: {
    color: "gold",
    fontSize: 28
  },
  card: {
    background: "#111827",
    padding: 20,
    margin: "15px 0",
    borderRadius: 12
  },
  btn: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    background: "gold",
    border: "none",
    borderRadius: 10,
    fontWeight: "bold"
  },
  txBtn: {
    width: "100%",
    padding: 12,
    marginTop: 10,
    background: "#38bdf8",
    border: "none",
    borderRadius: 10,
    fontWeight: "bold",
    color: "#000"
  },
  toastContainer: {
    position: "fixed",
    top: 10,
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: 999
  },
  toast: {
    background: "#22c55e",
    padding: "10px 15px",
    marginTop: 8,
    borderRadius: 8,
    fontSize: 14
  },
  games: {
    marginTop: 30,
    opacity: 0.6
  },
  loading: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0f172a",
    color: "white"
  }
};