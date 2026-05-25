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

// PAGES
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Wallet from "./pages/Wallet";
import Lobby from "./pages/Lobby";
import Transactions from "./pages/Transactions";
import WhotGame from "./WhotGame";
import AdminDashboard from "./pages/aaa";

// CASINO
import CasinoWheel from "./pages/CasinoWheel";

// 🐍 SNAKE
import SnakeLobby from "./pages/snakelobby";
import SnakeGame from "./pages/SnakeGame";

const ADMIN_ID = "69ef9fe863a02a7490b4";

// =========================
// AUTH HOOK
// =========================
function useAuth() {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    account
      .get()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false))
      .finally(() => setLoading(false));
  }, []);

  return { loading, authed };
}

// =========================
// USER HOOK
// =========================
function useUser() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    account
      .get()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}

// =========================
// ROUTE GUARDS
// =========================
function ProtectedRoute({ children }) {
  const { loading, authed } = useAuth();
  if (loading) return <p style={{ color: "white" }}>Loading...</p>;
  return authed ? children : <Navigate to="/auth" replace />;
}

function AdminRoute({ children }) {
  const { user, loading } = useUser();

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;
  if (!user) return <Navigate to="/auth" replace />;
  if (user.$id !== ADMIN_ID) return <Navigate to="/dashboard" replace />;

  return children;
}

function PublicRoute({ children }) {
  const { loading, authed } = useAuth();

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;
  return authed ? <Navigate to="/dashboard" replace /> : children;
}

// =========================
// WHOT WRAPPER
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
// SNAKE GAME WRAPPER
// =========================
function SnakeGameWrapper() {
  const { gameId } = useParams();
  const navigate = useNavigate();

  return (
    <SnakeGame
      gameId={gameId}
      back={() => navigate("/snake-lobby")}
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
              goCasino={() => navigate("/casino")}

              // ✅ FIXED SNAKE NAVIGATION
              goSnakeLobby={() => navigate("/snake-lobby")}

              goAdmin={() => navigate("/admin")}
              logout={async () => {
                await account.deleteSession("current");
                navigate("/auth");
              }}
            />
          </ProtectedRoute>
        }
      />

      {/* CASINO */}
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

      {/* WHOT LOBBY */}
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

      {/* WHOT GAME */}
      <Route
        path="/game/:gameId/:stake"
        element={
          <ProtectedRoute>
            <GameWrapper />
          </ProtectedRoute>
        }
      />

      {/* 🐍 SNAKE LOBBY */}
      <Route
        path="/snake-lobby"
        element={
          <ProtectedRoute>
            <SnakeLobby
              // ✅ THIS FIX IS IMPORTANT
              goGame={(gameId) =>
                navigate(`/snake-game/${gameId}`)
              }
              back={() => navigate("/dashboard")}
            />
          </ProtectedRoute>
        }
      />

      {/* 🐍 SNAKE GAME */}
      <Route
        path="/snake-game/:gameId"
        element={
          <ProtectedRoute>
            <SnakeGameWrapper />
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
// APP ROOT
// =========================
export default function App() {
  return (
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  );
}