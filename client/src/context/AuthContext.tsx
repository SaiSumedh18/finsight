import {
    createContext,
    useContext,
    useEffect,
    useState,
    type ReactNode,
} from "react";

import { api } from "../lib/api";
import type {
    User,
} from "../types";

interface AuthContextType {
    user: User | null;
    loading: boolean;
    login: (
        email: string,
        password: string
    ) => Promise<void>;
    register: (
        name: string,
        email: string,
        password: string
    ) => Promise<void>;
    logout: () => void;
}

const AuthContext =
    createContext<
        AuthContextType | undefined
    >(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export function AuthProvider({
    children,
}: AuthProviderProps) {
    const [
        user,
        setUser,
    ] =
        useState<User | null>(
            null
        );

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    useEffect(() => {
        async function loadUser() {
            const token =
                localStorage.getItem(
                    "finsight_token"
                );

            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const response =
                    await api.get(
                        "/auth/me"
                    );

                setUser(
                    response.data.user
                );
            } catch {
                localStorage.removeItem(
                    "finsight_token"
                );

                setUser(null);
            } finally {
                setLoading(false);
            }
        }

        loadUser();
    }, []);

    async function login(
        email: string,
        password: string
    ) {
        const response =
            await api.post(
                "/auth/login",
                {
                    email,
                    password,
                }
            );

        localStorage.setItem(
            "finsight_token",
            response.data.token
        );

        setUser(
            response.data.user
        );
    }

    async function register(
        name: string,
        email: string,
        password: string
    ) {
        const response =
            await api.post(
                "/auth/register",
                {
                    name,
                    email,
                    password,
                }
            );

        localStorage.setItem(
            "finsight_token",
            response.data.token
        );

        setUser(
            response.data.user
        );
    }

    function logout() {
        localStorage.removeItem(
            "finsight_token"
        );

        setUser(null);
    }

    return (
        <AuthContext.Provider
            value={{
                user,
                loading,
                login,
                register,
                logout,
            }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context =
        useContext(
            AuthContext
        );

    if (!context) {
        throw new Error(
            "useAuth must be used inside AuthProvider"
        );
    }

    return context;
}