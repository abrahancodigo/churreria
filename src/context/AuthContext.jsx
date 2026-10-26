import { useEffect, useRef, useState } from "react";
import {
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut
} from "firebase/auth";
import { auth, db } from "../firebase.config";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { AuthContext } from "./auth-context";
import Splash from "../components/Splash";

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [profileLoading, setProfileLoading] = useState(true);
    const [profileError, setProfileError] = useState(null);
    const profileRequest = useRef(0);
    const profileUid = useRef(null);
    const profileRequestUid = useRef(null);

    useEffect(() => {
        let active = true;

        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!active) return;

            setUser(currentUser);
            setLoading(false);

            if (!currentUser) {
                profileRequest.current += 1;
                profileUid.current = null;
                profileRequestUid.current = null;
                setUserData(null);
                setProfileError(null);
                setProfileLoading(false);
                return;
            }

            // Los refrescos de token vuelven a emitir el mismo usuario. No hace
            // falta descargar de nuevo su perfil ni ocultar la interfaz.
            if (profileUid.current === currentUser.uid || profileRequestUid.current === currentUser.uid) {
                return;
            }

            const requestId = ++profileRequest.current;
            profileRequestUid.current = currentUser.uid;
            setUserData(null);
            setProfileError(null);
            setProfileLoading(true);

            getDoc(doc(db, "users", currentUser.uid))
                .then((docSnap) => {
                    if (!active || requestId !== profileRequest.current) return;
                    profileUid.current = currentUser.uid;
                    setUserData(docSnap.exists() ? docSnap.data() : null);
                })
                .catch((error) => {
                    if (!active || requestId !== profileRequest.current) return;
                    console.error("Error fetching user data:", error);
                    setProfileError(error);
                })
                .finally(() => {
                    if (!active || requestId !== profileRequest.current) return;
                    profileRequestUid.current = null;
                    setProfileLoading(false);
                });
        });

        return () => {
            active = false;
            unsubscribe();
        };
    }, []);

    const login = (email, password) => signInWithEmailAndPassword(auth, email, password);

    const register = async (email, password, name, role = "cashier") => {
        const res = await createUserWithEmailAndPassword(auth, email, password);
        const profile = {
            uid: res.user.uid,
            email,
            name,
            role,
            createdAt: new Date()
        };
        await setDoc(doc(db, "users", res.user.uid), profile);

        // El listener de autenticacion puede leer el perfil antes de que termine
        // este setDoc. Invalidamos esa lectura y dejamos el perfil confirmado.
        profileRequest.current += 1;
        profileUid.current = res.user.uid;
        profileRequestUid.current = null;
        setUserData(profile);
        setProfileError(null);
        setProfileLoading(false);
        return res;
    };

    const logout = () => signOut(auth);

    if (loading) return <Splash label="Verificando sesión…" />;

    return (
        <AuthContext.Provider value={{
            user,
            userData,
            loading,
            profileLoading,
            profileError,
            login,
            register,
            logout
        }}>
            {children}
        </AuthContext.Provider>
    );
};