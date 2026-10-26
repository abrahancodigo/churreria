import { createContext } from "react";

// Igual que `auth-context`: el contexto se declara aparte del Provider para que
// `ToastContext.jsx` solo exporte componentes (regla react-refresh).
export const ToastContext = createContext(null);
