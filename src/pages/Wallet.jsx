// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom"; // 🔥 NEW
import { account } from "../lib/appwrite";
import { getWallet } from "../lib/wallet";

// =========================
// COMPONENT
// =========================
export default function Wallet() {
  const navigate = useNavigate(); // 🔥 NEW

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  // =========================
  // LOAD WALLET
  // =========================
  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const user = await account.get();
      const w = await getWallet(user.$id);
      setWallet(w);
    } catch (err) {
      console.error("Wallet load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // LOADING UI
  // =========================
  if (loading) {
    return (
      <div style={styles.container}>
        <h2>💳 Wallet</h2>
        <p>Loading wallet...</p>
      </div>
    );
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>
      <h1>💳 Wallet</h1>

      <div style={styles.card}>
        <p>
          💰 Balance: ₦{Number(wallet?.balance || 0).toLocaleString()}
        </p>

        <p>
          🔒 Locked: ₦{Number(wallet?.locked || 0).toLocaleString()}
        </p>
      </div>

      {/* ACTIONS */}
      <button type="button" style={styles.btn}>
        ➕ Deposit (coming soon)
      </button>

      <button type="button" style={styles.btn}>
        ➖ Withdraw (coming soon)
      </button>

      {/* BACK */}
      <button
        type="button"
        style={styles.back}
        onClick={() => navigate("/dashboard")} // 🔥 FIXED
      >
        ⬅ Back
      </button>
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
    background: "#0f172a",
    color: "white",
    minHeight: "100vh"
  },

  card: {
    padding: 20,
    background: "#111827",
    borderRadius: 10,
    marginBottom: 20,
    fontSize: 18
  },

  btn: {
    display: "block",
    width: "100%",
    padding: 12,
    marginTop: 10,
    background: "gold",
    border: "none",
    borderRadius: 8,
    fontWeight: "bold",
    cursor: "pointer"
  },

  back: {
    marginTop: 20,
    padding: 10,
    background: "gray",
    border: "none",
    borderRadius: 8,
    cursor: "pointer"
  }
};