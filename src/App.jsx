import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import { ThemeProvider } from "./context/ThemeContext";
import { CompanyProvider } from "./context/CompanyContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";

// Route-level code splitting: the POS, Reports (xlsx ~450KB) and Backup
// chunks are only downloaded when the user actually navigates there.
const Register = lazy(() => import("./pages/Register"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Transactions = lazy(() => import("./pages/Transactions"));
const StockAdjustment = lazy(() => import("./pages/StockAdjustment"));
const Settings = lazy(() => import("./pages/Settings"));
const Reports = lazy(() => import("./pages/Reports"));
const POS = lazy(() => import("./pages/POS"));
const Backup = lazy(() => import("./pages/Backup"));

function PageLoader() {
    return (
        <div className="flex items-center justify-center min-h-[60dvh] w-full">
            <div
                className="h-10 w-10 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin"
                role="status"
                aria-label="Cargando página"
            />
        </div>
    );
}

function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <AuthProvider>
                    <CompanyProvider>
                        <BrowserRouter>
                            <Suspense fallback={<PageLoader />}>
                                <Routes>
                                    <Route path="/login" element={<Login />} />
                                    <Route path="/register" element={<Register />} />

                                    <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
                                        <Route path="/" element={<Dashboard />} />
                                        <Route path="/inventory" element={<Inventory />} />
                                        <Route path="/transactions" element={<Transactions />} />
                                        <Route path="/stock-adjustments" element={<StockAdjustment />} />
                                        <Route path="/reports" element={<Reports />} />
                                        <Route path="/settings" element={<Settings />} />
                                        <Route path="/pos" element={<POS />} />
                                        <Route path="/backup" element={<Backup />} />
                                    </Route>
                                </Routes>
                            </Suspense>
                        </BrowserRouter>
                    </CompanyProvider>
                </AuthProvider>
            </ToastProvider>
        </ThemeProvider>
    );
}

export default App;
