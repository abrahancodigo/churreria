import { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import Login from "./pages/Login";
import Register from "./pages/Register";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Transactions = lazy(() => import("./pages/Transactions"));
const StockAdjustment = lazy(() => import("./pages/StockAdjustment"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const Backup = lazy(() => import("./pages/Backup"));
import ProtectedRoute, { RequireAdmin } from "./components/ProtectedRoute";
import Layout from "./components/Layout";

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="min-h-screen bg-paper flex items-center justify-center text-sm font-bold text-ink-3">Cargando...</div>}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/stock-adjustments" element={<RequireAdmin><StockAdjustment /></RequireAdmin>} />
              <Route path="/reports" element={<RequireAdmin><Reports /></RequireAdmin>} />
              <Route path="/settings" element={<RequireAdmin><Settings /></RequireAdmin>} />
              <Route path="/backup" element={<RequireAdmin><Backup /></RequireAdmin>} />
            </Route>
          </Routes>
          </Suspense>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;
