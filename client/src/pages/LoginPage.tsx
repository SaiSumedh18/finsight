import {
    useState,
    type FormEvent,
} from "react";

import axios from "axios";

import {
    Link,
    Navigate,
    useNavigate,
} from "react-router-dom";

import {
    useAuth,
} from "../context/AuthContext";

export default function LoginPage() {
    const {
        login,
        user,
    } = useAuth();

    const navigate =
        useNavigate();

    const [
        email,
        setEmail,
    ] = useState("");

    const [
        password,
        setPassword,
    ] = useState("");

    const [
        error,
        setError,
    ] = useState("");

    const [
        submitting,
        setSubmitting,
    ] = useState(false);

    if (user) {
        return (
            <Navigate
                to="/"
                replace
            />
        );
    }

    async function handleSubmit(
        event: FormEvent
    ) {
        event.preventDefault();

        setError("");
        setSubmitting(true);

        try {
            await login(
                email,
                password
            );

            navigate("/");
        } catch (requestError) {
            if (
                axios.isAxiosError(
                    requestError
                )
            ) {
                setError(
                    requestError
                        .response
                        ?.data
                        ?.message ??
                    "Unable to sign in"
                );
            } else {
                setError(
                    "Unable to sign in"
                );
            }
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <main className="auth-page">
            <section className="auth-brand">
                <div>
                    <p className="eyebrow auth-eyebrow">
                        PERSONAL FINANCE,
                        SIMPLIFIED
                    </p>

                    <h1>
                        FinSight
                    </h1>

                    <p className="auth-tagline">
                        Understand where your
                        money goes.
                    </p>

                    <p className="auth-description">
                        Track accounts, manage
                        budgets, monitor cash
                        flow, and understand your
                        spending from one
                        dashboard.
                    </p>
                </div>
            </section>

            <section className="auth-panel">
                <div className="auth-card">
                    <p className="eyebrow">
                        WELCOME BACK
                    </p>

                    <h2>
                        Sign in to FinSight
                    </h2>

                    <p className="muted">
                        Continue to your personal
                        finance dashboard.
                    </p>

                    {error && (
                        <div className="error-banner">
                            {error}
                        </div>
                    )}

                    <form
                        onSubmit={
                            handleSubmit
                        }
                        className="auth-form"
                    >
                        <label>
                            Email address

                            <input
                                type="email"
                                value={email}
                                onChange={(
                                    event
                                ) =>
                                    setEmail(
                                        event.target.value
                                    )
                                }
                                placeholder="you@example.com"
                                required
                            />
                        </label>

                        <label>
                            Password

                            <input
                                type="password"
                                value={password}
                                onChange={(
                                    event
                                ) =>
                                    setPassword(
                                        event.target.value
                                    )
                                }
                                placeholder="Enter your password"
                                required
                            />
                        </label>

                        <button
                            className="primary-button"
                            type="submit"
                            disabled={
                                submitting
                            }
                        >
                            {submitting
                                ? "Signing in..."
                                : "Sign in"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        New to FinSight?{" "}

                        <Link to="/register">
                            Create an account
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    );
}