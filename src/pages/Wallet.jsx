// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { account, databases, DATABASE_ID } from "../lib/appwrite";
import { getWallet } from "../lib/wallet";
import { ID, Query } from "appwrite";

const PROMO_COLLECTION = "promocodes";

// =========================
// COMPONENT
// =========================
export default function Wallet() {
  const navigate = useNavigate();

  const [wallet, setWallet] = useState(null);
  const [loading, setLoading] = useState(true);

  const [promo, setPromo] = useState(null);

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
  // LOAD WALLET + PROMO
  // =========================
  useEffect(() => {
    load();
  }, []);

  async function load() {
    try {
      const user = await account.get();
      const w = await getWallet(user.$id);
      setWallet(w);

      // Load promo
      const res = await databases.listDocuments(
        DATABASE_ID,
        PROMO_COLLECTION,
        [Query.equal("ownerId", user.$id)]
      );

      if (res.documents.length > 0) {
        setPromo(res.documents[0]);
      }

    } catch (err) {
      console.error("Wallet load error:", err);
    } finally {
      setLoading(false);
    }
  }

  // =========================
  // CREATE PROMO
  // =========================
  function generateCode(name) {
    const base = (name || "USER")
      .replace(/\s+/g, "")
      .toUpperCase()
      .slice(0, 5);

    return base + Math.floor(1000 + Math.random() * 9000);
  }

  async function createPromo() {
    try {
      const user = await account.get();
      const code = generateCode(wallet?.name);

      const doc = await databases.createDocument(
        DATABASE_ID,
        PROMO_COLLECTION,
        ID.unique(),
        {
          code,
          ownerId: user.$id,
          usedCount: 0,
          isActive: true
        }
      );

      setPromo(doc);
      alert("Promo code created ✅");

    } catch (err) {
      alert(err.message);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(promo.code);
    alert("Copied ✅");
  }

  function copyInvite() {
    if (!promo?.code) return alert("Generate code first");

    const text = `Join Win9ja 🎮

Use my promo code: ${promo.code}

https://win9jalife.vercel.app`;

    navigator.clipboard.writeText(text);
    alert("Invite copied ✅");
  }

  // =========================
  // DEPOSIT
  // =========================
  async function makeDeposit() {
    if (processing) return;

    if (!amount || Number(amount) < 200) {
      return alert("Minimum deposit ₦200");
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

    if (!withdrawAmount || Number(withdrawAmount) < 1500) {
      return alert("Minimum withdrawal ₦1500");
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
      
      {/* HEADER WITH PROMO */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>💳 Wallet</h1>

        {promo ? (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            <span style={{ fontSize: 12 }}>{promo.code}</span>
            <button onClick={copyCode}>📋</button>
          </div>
        ) : (
          <button onClick={createPromo}>+ Code</button>
        )}
      </div>

      {promo && (
        <p style={{ fontSize: 12, color: "#9ca3af" }}>
          👥 {promo.usedCount || 0} users joined
        </p>
      )}

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

      {/* COPY INVITE */}
      <button style={styles.btn} onClick={copyInvite}>
        📋 Copy Invite Text
      </button>

      {/* ================= DEPOSIT MODAL ================= */}
      {showDeposit && (
        <div style={styles.modal}>
          <h3>Deposit</h3>

          <input
            placeholder="Min ₦200"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            style={styles.input}
          />

          {amount && Number(amount) < 200 && (
            <p style={{ color: "#ef4444", fontSize: 12 }}>
              Minimum deposit is ₦200
            </p>
          )}

          <input
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={styles.input}
          />

          <input
            placeholder="Promo Code (Coming Soon)"
            disabled
            style={{
              ...styles.input,
              opacity: 0.6,
              cursor: "not-allowed"
            }}
          />

          <button
            style={styles.btn}
            onClick={makeDeposit}
            disabled={processing || !amount || Number(amount) < 200}
          >
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
            placeholder="Min ₦1500"
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

      {/* WHATSAPP (UNCHANGED POSITION) */}
      <a
        href="https://chat.whatsapp.com/JX0vmuEcEUvLeYCXVIBn1L?mode=gi_t"
        target="_blank"
        rel="noreferrer"
        style={styles.whatsapp}
      >
        💬 Join WhatsApp Updates Group
      </a>
    </div>
  );
}