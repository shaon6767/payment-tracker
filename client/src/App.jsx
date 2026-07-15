import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";
import Auth from "./pages/Auth.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import InvoiceDetail from "./pages/InvoiceDetail.jsx";
import Invoices from "./pages/Invoices.jsx";
import PaymentResult from "./pages/PaymentResult.jsx";

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;
  return (
    <nav className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between">
      <Link to="/dashboard" className="font-bold text-lg text-indigo-600">
        InvoicePay
      </Link>
      <div className="flex items-center gap-6 text-sm">
        <Link to="/dashboard" className="hover:text-indigo-600">
          Dashboard
        </Link>
        <Link to="/invoices" className="hover:text-indigo-600">
          Invoices
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-slate-600">{user.name}</span>
          <button
            onClick={() => {
              logout();
              navigate("/auth");
            }}
            className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="p-10">Loading...</div>;
  }
  if (!user) {
    return <Navigate to="/auth" replace />;
  }
  return children;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <Navbar />

      <Routes>
        <Route path="/auth" element={<Auth />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoices"
          element={
            <ProtectedRoute>
              <Invoices />
            </ProtectedRoute>
          }
        />

        <Route
          path="/invoices/:id"
          element={
            <ProtectedRoute>
              <InvoiceDetail />
            </ProtectedRoute>
          }
        />

        <Route path="/payment/result" element={<PaymentResult />} />

        {/* Root route */}
        <Route
          path="/"
          element={<Navigate to={user ? "/dashboard" : "/auth"} replace />}
        />

        {/* Catch all unknown routes */}
        <Route
          path="*"
          element={<Navigate to={user ? "/dashboard" : "/auth"} replace />}
        />
      </Routes>
    </div>
  );
}
