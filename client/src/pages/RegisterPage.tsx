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

export default function RegisterPage() {
    const {
        register,
        user,
    } =
        useAuth();

    const navigate =
        useNavigate();

    const [
        name,
        setName,
    ] =
        useState("");

    const [
        email,
        setEmail,
    ] =
        useState("");

    const [
        password,
        setPassword,
    ] =
        useState("");

    const [
        error,
        setError,
    ] =
        useState("");

    const [
        submitting,
        setSubmitting,
    ] =
        useState(false);

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
            await register(
                name,
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
                    "Unable to create account"
                );
            } else {
                setError(
                    "Unable to create account"
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
                    <div className="brand-mark">
                        F
                    </div>

                    <h1>
                        FinSight
                    </h1>

                    <p className="auth-tagline">
                        Make every dollar easier
                        to understand.
                    </p>

                    <p className="auth-description">
                        Build budgets, organize
                        transactions, and see a
                        clear picture of your
                        finances.
                    </p>
                </div>
            </section>

            <section className="auth-panel">
                <div className="auth-card">
                    <p className="eyebrow">
                        GET STARTED
                    </p>

                    <h2>
                        Create your account
                    </h2>

                    <p className="muted">
                        Start tracking your
                        finances with FinSight.
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
                            Full name

                            <input
                                type="text"
                                value={name}
                                onChange={(
                                    event
                                ) =>
                                    setName(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Your name"
                                required
                            />
                        </label>

                        <label>
                            Email address

                            <input
                                type="email"
                                value={email}
                                onChange={(
                                    event
                                ) =>
                                    setEmail(
                                        event.target
                                            .value
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
                                value={
                                    password
                                }
                                onChange={(
                                    event
                                ) =>
                                    setPassword(
                                        event.target
                                            .value
                                    )
                                }
                                placeholder="Minimum 8 characters"
                                minLength={8}
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
                                ? "Creating account..."
                                : "Create account"}
                        </button>
                    </form>

                    <p className="auth-switch">
                        Already have an
                        account?{" "}

                        <Link to="/login">
                            Sign in
                        </Link>
                    </p>
                </div>
            </section>
        </main>
    );
}