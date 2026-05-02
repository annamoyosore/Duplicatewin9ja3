// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import {
  account,
  databases,
  DATABASE_ID,
  WALLET_COLLECTION,
  Query,
  ID
} from "../lib/appwrite";

const DEPOSIT_COLLECTION = "deposit_requests";
const WITHDRAW_COLLECTION = "withdrawal_requests";
const MATCH_COLLECTION = "matches";
const TRANSACTION_COLLECTION = "transactions";

// 🔒 ADMIN ID
const ADMIN_ID = "69ef9fe863a02a7490b4";

// =========================
// COMPONENT
// =========================
export default function AdminDashboard({ back }) {
  const [user, setUser] = useState(null);
  const [deposits, setDeposits] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(false);

  // =========================
  // INIT
  // =========================
  useEffect(() => {
    init();
  }, []);

  async function init() {
    const u = await account.get();

    if (u.$id !== ADMIN_ID) {
      alert("Access denied");
      return;
    }

    setUser(u);
    loadAll();
  }

  async function loadAll() {
    await Promise.all([
      loadDeposits(),
      loadWithdrawals(),
      loadMatches()
    ]);
  }

  // =========================
  // LOAD DATA
  // =========================
  async function loadDeposits() {
    const res = await databases.listDocuments(
      DATABASE_ID,
      DEPOSIT_COLLECTION,
      [Query.equal("status", "pending")]
    );
    setDeposits(res.documents);
  }

  async function loadWithdrawals() {
    const res = await databases.listDocuments(
      DATABASE_ID,
      WITHDRAW_COLLECTION,
      [Query.equal("status", "pending")]
    );
    setWithdrawals(res.documents);
  }

  async function loadMatches() {
    const res = await databases.listDocuments(
      DATABASE_ID,
      MATCH_COLLECTION,
      [Query.orderDesc("$createdAt"), Query.limit(6)]
    );

    const active = res.documents.filter(
      m => m.status !== "finished" && m.status !== "cancelled"
    );

    setMatches(active);
  }

  // =========================
  // WALLET HELPER
  // =========================
  async function getWallet(userId) {
    const res = await databases.listDocuments(
      DATABASE_ID,
      WALLET_COLLECTION,
      [Query.equal("userId", userId)]
    );

    if (!res.documents.length) throw new Error("Wallet not found");

    return res.documents[0];
  }

  // =========================
  // APPROVE DEPOSIT
  // =========================
  async function approveDeposit(d) {
    if (loading) return;
    setLoading(true);

    try {
      if (d.status !== "pending") {
        alert("Already processed");
        return;
      }

      const wallet = await getWallet(d.userId);

      // 💰 CREDIT USER
      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        {
          balance: Number(wallet.balance || 0) + Number(d.amount)
        }
      );

      // ✅ UPDATE STATUS
      await databases.updateDocument(
        DATABASE_ID,
        DEPOSIT_COLLECTION,
        d.$id,
        { status: "completed" }
      );

      // 🧾 LOG TRANSACTION
      await databases.createDocument(
        DATABASE_ID,
        TRANSACTION_COLLECTION,
        ID.unique(),
        {
          userId: d.userId,
          type: "deposit",
          amount: d.amount,
          status: "completed",
          createdAt: new Date().toISOString()
        }
      );

      loadDeposits();

    } catch (e) {
      alert(e.message);
    }

    setLoading(false);
  }

  // =========================
  // REJECT DEPOSIT
  // =========================
  async function rejectDeposit(d) {
    await databases.updateDocument(
      DATABASE_ID,
      DEPOSIT_COLLECTION,
      d.$id,
      { status: "rejected" }
    );

    loadDeposits();
  }

  // =========================
  // APPROVE WITHDRAWAL
  // =========================
  async function approveWithdrawal(w) {
    if (loading) return;
    setLoading(true);

    try {
      if (w.status !== "pending") {
        alert("Already processed");
        return;
      }

      const wallet = await getWallet(w.userId);

      if (wallet.balance < w.amount) {
        alert("Insufficient balance");
        return;
      }

      // 💸 DEDUCT USER BALANCE
      await databases.updateDocument(
        DATABASE_ID,
        WALLET_COLLECTION,
        wallet.$id,
        {
          balance: Number(wallet.balance || 0) - Number(w.amount)
        }
      );

      // ✅ UPDATE STATUS
      await databases.updateDocument(
        DATABASE_ID,
        WITHDRAW_COLLECTION,
        w.$id,
        { status: "paid" }
      );

      // 🧾 LOG TRANSACTION
      await databases.createDocument(
        DATABASE_ID,
        TRANSACTION_COLLECTION,
        ID.unique(),
        {
          userId: w.userId,
          type: "withdrawal",
          amount: w.amount,
          status: "completed",
          createdAt: new Date().toISOString()
        }
      );

      loadWithdrawals();

    } catch (e) {
      alert(e.message);
    }

    setLoading(false);
  }

  // =========================
  // REJECT WITHDRAWAL
  // =========================
  async function rejectWithdrawal(w) {
    await databases.updateDocument(
      DATABASE_ID,
      WITHDRAW_COLLECTION,
      w.$id,
      { status: "rejected" }
    );

    loadWithdrawals();
  }

  // =========================
  // UI
  // =========================
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>🛠 Admin Dashboard</h1>

      {/* DEPOSITS */}
      <h2>💰 Pending Deposits</h2>
      {deposits.map(d => (
        <div key={d.$id} style={styles.card}>
          <div>
            <strong>₦{d.amount}</strong>
            <div style={styles.subText}>
              {d.name || "Unknown"} ({d.userId})
            </div>
          </div>
          <div>
            <button onClick={() => approveDeposit(d)}>Approve</button>
            <button onClick={() => rejectDeposit(d)}>Reject</button>
          </div>
        </div>
      ))}

      {/* WITHDRAWALS */}
      <h2>💸 Withdrawals</h2>
      {withdrawals.map(w => (
        <div key={w.$id} style={styles.card}>
          <div>
            <strong>₦{w.amount}</strong>
            <div style={styles.subText}>
              {w.name || "Unknown"} ({w.userId})
            </div>
          </div>
          <div>
            <button onClick={() => approveWithdrawal(w)}>Approve</button>
            <button onClick={() => rejectWithdrawal(w)}>Reject</button>
          </div>
        </div>
      ))}

      {/* MATCHES */}
      <h2>🎮 Active Matches</h2>
      {matches.map(m => (
        <div key={m.$id} style={styles.card}>
          <div>
            <p>Stake: ₦{m.stake}</p>
            <p>Pot: ₦{m.pot}</p>
            <p>Status: {m.status}</p>
          </div>
        </div>
      ))}

      <button onClick={back}>⬅ Back</button>
    </div>
  );
}

// =========================
// STYLES
// =========================
const styles = {
  container: {
    padding: 20,
    background: "#020617",
    color: "#fff",
    minHeight: "100vh"
  },
  title: {
    fontSize: 26,
    marginBottom: 10
  },
  card: {
    background: "#111827",
    padding: 12,
    marginTop: 10,
    display: "flex",
    justifyContent: "space-between",
    borderRadius: 8,
    alignItems: "center"
  },
  subText: {
    fontSize: 12,
    opacity: 0.7
  }
};