// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import {
  HashRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useParams
} from "react-router-dom";

import { account } from "./lib/appwrite";

import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Lobby from "./pages/Lobby";
import Transactions from "./pages/Transactions";
import WhotGame from "./WhotGame";
import AdminDashboard from "./pages/aaa";

// ✅ CASINO IMPORT
import CasinoWheel from "./pages/CasinoWheel";

// 🔒 ADMIN ID
const ADMIN_ID = "69ef9fe863a02a7490b4";

// =========================
// AUTH HOOK
// =========================
function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    account.get()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  return { loading, authed };
}

// =========================
// GET USER HOOK
// =========================
function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    account.get()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

// =========================
// PROTECTED ROUTE
// =========================
function ProtectedRoute({ children }) {
  const { loading, authed } = useAuth();

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;

  return authed ? children : <Navigate to="/auth" replace />;
}

// =========================
// ADMIN ROUTE
// =========================
function AdminRoute({ children }) {
  const { user, loading } = useUser();

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;

  if (!user) return <Navigate to="/auth" replace />;

  if (user.$id !== ADMIN_ID) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

// =========================
// PUBLIC ROUTE
// =========================
function PublicRoute({ children }) {
  const { loading, authed } = useAuth();

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;

  return authed ? <Navigate to="/dashboard" replace /> : children;
}

// =========================
// WHOT GAME WRAPPER
// =========================
function GameWrapper() {
  const { gameId, stake } = useParams();
  const navigate = useNavigate();

  return (
    <WhotGame
      gameId={gameId}
      stake={Number(stake)}
      goHome={() => navigate("/dashboard")}
    />
  );
}

// =========================
// ROUTES
// =========================
function AppRoutes() {
  const navigate = useNavigate();

  return (
    <Routes>

      {/* AUTH */}
      <Route
        path="/auth"
        element={
          <PublicRoute>
            <Auth onLogin={() => navigate("/dashboard")} />
          </PublicRoute>
        }
      />

      {/* DASHBOARD */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard
              goLobby={() => navigate("/lobby")}
              goWallet={() => navigate("/wallet")}
              goTransactions={() => navigate("/transactions")}
              goAdmin={() => navigate("/admin")}
              goCasino={() => navigate("/casino")} // ✅ NEW
              logout={async () => {
                await account.deleteSession("current");
                navigate("/auth");
              }}
            />
          </ProtectedRoute>
        }
      />

      {/* ✅ CASINO ROUTE */}
      <Route
        path="/casino"
        element={
          <ProtectedRoute>
            <CasinoWheel />
          </ProtectedRoute>
        }
      />

      {/* WALLET */}
      <Route
        path="/wallet"
        element={
          <ProtectedRoute>
            <Wallet />
          </ProtectedRoute>
        }
      />

      {/* TRANSACTIONS */}
      <Route
        path="/transactions"
        element={
          <ProtectedRoute>
            <Transactions back={() => navigate("/dashboard")} />
          </ProtectedRoute>
        }
      />

      {/* LOBBY */}
      <Route
        path="/lobby"
        element={
          <ProtectedRoute>
            <Lobby
              goGame={(id, stake) =>
                navigate(`/game/${id}/${stake}`)
              }
              back={() => navigate("/dashboard")}
            />
          </ProtectedRoute>
        }
      />

      {/* GAME */}
      <Route
        path="/game/:gameId/:stake"
        element={
          <ProtectedRoute>
            <GameWrapper />
          </ProtectedRoute>
        }
      />

      {/* ADMIN */}
      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminDashboard back={() => navigate("/dashboard")} />
          </AdminRoute>
        }
      />

      {/* DEFAULT */}
      <Route path="*" element={<Navigate to="/auth" replace />} />

    </Routes>
  );
}

// =========================
// MAIN APP
// =========================
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}