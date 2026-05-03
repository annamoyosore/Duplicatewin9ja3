// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { account, databases, DATABASE_ID } from "../lib/appwrite";
import { getWallet } from "../lib/wallet";
import { ID } from "appwrite";

// =========================
// COMPONENT
// =========================
export default function Wallet() {
  const navigate = useNavigate();

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  // Deposit states
  const [showDeposit, setShowDeposit] = useState(false);
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");

  // Withdraw states
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [bank, setBank] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [processing, setProcessing] = useState(false);

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
  // DEPOSIT
  // =========================
  async function makeDeposit() {
    if (processing) return;

    if (!amount || Number(amount) < 100) {
      return alert("Minimum deposit ₦100");
    }

    if (!name) {
      return alert("Enter full name");
    }

    setProcessing(true);

    try {
      const user = await account.get();
      const ref = "DEP-" + Date.now();

      await databases.createDocument(
        DATABASE_ID,
        "deposit_requests",
        ID.unique(),
        {
          userId: user.$id,
          amount: Number(amount),
          name,
          status: "pending",
          reference: ref,
          createdAt: new Date().toISOString()
        }
      );

      // 🔗 Redirect to Flutterwave
      window.location.href = `https://flutterwave.com/pay/qiattof2hy2w`;

    } catch (err) {
      alert(err.message);
    }

    setProcessing(false);
  }

  // =========================
  // WITHDRAW
  // =========================
  async function requestWithdraw() {
    if (processing) return;

    if (!withdrawAmount || Number(withdrawAmount) < 100) {
      return alert("Minimum withdrawal ₦100");
    }

    if (Number(withdrawAmount) > (wallet?.balance || 0)) {
      return alert("Insufficient balance");
    }

    if (!bank) return alert("Enter bank name");

    if (!accountNumber || accountNumber.length < 10) {
      return alert("Enter valid account number");
    }

    if (!accountName) {
      return alert("Enter account name");
    }

    setProcessing(true);

    try {
      const user = await account.get();

      await databases.createDocument(
        DATABASE_ID,
        "withdrawal_requests",
        ID.unique(),
        {
          userId: user.$id,
          amount: Number(withdrawAmount),
          bank,
          accountNumber,
          accountName,
          status: "pending",
          createdAt: new Date().toISOString()
        }
      );

      alert("Withdrawal request sent");

      // reset form
      setShowWithdraw(false);
      setWithdrawAmount("");
      setBank("");
      setAccountNumber("");
      setAccountName("");

    } catch (err) {
      alert(err.message);
    }

    setProcessing(false);
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
        <p>💰 Balance: ₦{Number(wallet?.balance || 0).toLocaleString()}</p>
        <p>🔒 Locked: ₦{Number(wallet?.locked || 0).toLocaleString()}</p>
      </div>

      {/* ACTIONS */}
      <button style={styles.btn} onClick={() => setShowDeposit(true)}>
        ➕ Deposit
      </button>

      <button style={styles.btn} onClick={() => setShowWithdraw(true)}>
        ➖ Withdraw
      </button>

      {/* ================= DEPOSIT MODAL ================= */}
      {showDeposit && (
        <div style={styles.modal}>
          <h3>Deposit</h3>

          <input
            placeholder="Amount ₦"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />

          <button style={styles.btn} onClick={makeDeposit} disabled={processing}>
            Make Payment
          </button>

          <button style={styles.cancel} onClick={() => setShowDeposit(false)}>
            Cancel
          </button>
        </div>
      )}

      {/* ================= WITHDRAW MODAL ================= */}
      {showWithdraw && (
        <div style={styles.modal}>
          <h3>Withdraw</h3>

          <input
            placeholder="Amount ₦"
            type="number"
            value={withdrawAmount}
            onChange={(e) => setWithdrawAmount(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Bank Name"
            value={bank}
            onChange={(e) => setBank(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Account Number"
            value={accountNumber}
            onChange={(e) => setAccountNumber(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Account Name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            style={styles.input}
          />

          <button style={styles.btn} onClick={requestWithdraw} disabled={processing}>
            Submit Request
          </button>

          <button style={styles.cancel} onClick={() => setShowWithdraw(false)}>
            Cancel
          </button>
        </div>
      )}

      {/* BACK */}
      <button style={styles.back} onClick={() => navigate("/dashboard")}>
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
    fontSize: 16
  },

  btn: {
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
    background: "#475569",
    border: "none",
    borderRadius: 8,
    color: "#fff"
  },

  modal: {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    background: "#111827",
    padding: 20,
    borderRadius: 10,
    width: "85%",
    maxWidth: 320,
    display: "flex",
    flexDirection: "column",
    gap: 10
  },

  input: {
    width: "100%",
    padding: 10,
    borderRadius: 6,
    border: "none"
  },

  cancel: {
    padding: 10,
    background: "#ef4444",
    border: "none",
    borderRadius: 6,
    color: "#fff"
  }
};