import { Suspense, lazy, useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { CompanyProvider } from "./context/CompanyContext";
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
import Splash from "./components/Splash";

/**
 * Regresa a Inicio cada vez que la app carga (recarga, apertura o link
 * externo), desde PC, tablet o movil. La navegacion interna no se toca: solo
 * actua al montar, una vez por carga de pagina. No interfiere con /login y
 * /register para no pelear con el flujo de acceso.
 */
function LoadToHome() {
    const navigate = useNavigate();
    const location = useLocation();

    useEffect(() => {
        const { pathname } = location;
        if (pathname !== "/" && pathname !== "/login" && pathname !== "/register") {
            navigate("/", { replace: true });
        }
        // Intencionalmente solo al montar: los cambios de ruta posteriores son
        // navegacion del usuario y deben respetarse.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return null;
}

function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <CompanyProvider>
          <BrowserRouter>
            <LoadToHome />
            <Suspense fallback={<Splash label="Cargando módulo…" />}>
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
        </CompanyProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

export default App;