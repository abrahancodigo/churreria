import { useContext } from "react";
import { AuthContext } from "../context/auth-context";

/** Sesion activa: `{ user, userData, login, register, logout }`. */
export const useAuth = () => useContext(AuthContext);
