import { lazy, Suspense, useState } from "react";
import { Link, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext.jsx";

const Auth = lazy(() => import("./pages/Auth.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail.jsx"));
const Invoices = lazy(() => import("./pages/Invoices.jsx"));
const PaymentResult = lazy(() => import("./pages/PaymentResult.jsx"));

function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/auth");
  };

  const closeMenu = () => setOpen(false);

  return (
    <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 relative">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="font-bold text-lg text-indigo-600"
          onClick={closeMenu}
        >
          InvoicePay
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-6 text-sm">
          <Link to="/dashboard" className="hover:text-indigo-600">
            Dashboard
          </Link>
          <Link to="/invoices" className="hover:text-indigo-600">
            Invoices
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-slate-600">{user.name}</span>
            <button
              onClick={handleLogout}
              className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
            >
              Logout
            </button>
          </div>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen((prev) => !prev)}
          className="md:hidden p-2 -mr-2 text-slate-600 hover:text-indigo-600"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden mt-3 pb-1 flex flex-col gap-1 text-sm border-t border-slate-100 pt-3">
          <Link
            to="/dashboard"
            onClick={closeMenu}
            className="px-2 py-2 rounded hover:bg-slate-50 hover:text-indigo-600"
          >
            Dashboard
          </Link>
          <Link
            to="/invoices"
            onClick={closeMenu}
            className="px-2 py-2 rounded hover:bg-slate-50 hover:text-indigo-600"
          >
            Invoices
          </Link>
          <div className="flex items-center justify-between px-2 py-2">
            <span className="text-slate-600">{user.name}</span>
            <button
              onClick={() => {
                closeMenu();
                handleLogout();
              }}
              className="px-3 py-1 rounded bg-slate-100 hover:bg-slate-200"
            >
              Logout
            </button>
          </div>
        </div>
      )}
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

function PageFallback() {
  return <div className="p-10">Loading…</div>;
}

export default function App() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <Navbar />

      <main>
        <Suspense fallback={<PageFallback />}>
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
        </Suspense>
      </main>
    </div>
  );
}
