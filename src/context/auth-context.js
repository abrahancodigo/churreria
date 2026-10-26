import { createContext } from "react";

// El contexto vive en su propio modulo (y no en el del Provider) para que un
// archivo exporte solo componentes y React Fast Refresh funcione sin recargar
// la pagina completa. Los consumidores importan `useAuth` de `../hooks/useAuth`.
export const AuthContext = createContext(null);
