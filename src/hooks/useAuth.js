import { useContext } from "react";
import { AuthContext } from "../context/auth-context";

/** Sesion activa y estado independiente del perfil del usuario. */
export const useAuth = () => useContext(AuthContext);
