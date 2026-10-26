import { useContext } from "react";
import { ToastContext } from "../context/toast-context";

/** Avisos flotantes: `{ addToast }`. */
export const useToast = () => useContext(ToastContext);
