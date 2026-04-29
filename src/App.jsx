// =========================
// IMPORTS
// =========================
import { useEffect, useState } from "react";
import {
  HashRouter,   // 🔥 CHANGED
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
import WhotGame from "./WhotGame";

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
// PROTECTED ROUTE
// =========================
function ProtectedRoute({ children }) {
  const { loading, authed } = useAuth();

  if (loading) return <p style={{ color: "white" }}>Loading...</p>;

  return authed ? children : <Navigate to="/auth" replace />;
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
// GAME WRAPPER
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
              logout={async () => {
                await account.deleteSession("current");
                navigate("/auth");
              }}
            />
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
    <HashRouter> {/* 🔥 KEY FIX */}
      <AppRoutes />
    </HashRouter>
  );
}