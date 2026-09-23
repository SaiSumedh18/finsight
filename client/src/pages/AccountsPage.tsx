import {
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import axios from "axios";

import {
    api,
} from "../lib/api";

import "./accounts.css";

interface Account {
    id: number;
    name: string;

    account_type:
    | "CHECKING"
    | "SAVINGS"
    | "CREDIT"
    | "CASH"
    | "INVESTMENT"
    | "OTHER";

    initial_balance: number;
    current_balance: number;
    transaction_count: number;
    created_at: string;
    updated_at: string;
}

type AccountType =
    Account["account_type"];

interface AccountForm {
    name: string;
    accountType:
    AccountType;
    initialBalance: string;
}

const emptyForm:
    AccountForm = {
    name: "",
    accountType:
        "CHECKING",
    initialBalance: "0",
};

function money(
    amount: number
) {
    return new Intl.NumberFormat(
        "en-US",
        {
            style: "currency",
            currency: "USD",
        }
    ).format(amount);
}

function accountTypeLabel(
    type: AccountType
) {
    const labels:
        Record<
            AccountType,
            string
        > = {
        CHECKING:
            "Checking",
        SAVINGS:
            "Savings",
        CREDIT:
            "Credit Card",
        CASH:
            "Cash",
        INVESTMENT:
            "Investment",
        OTHER:
            "Other",
    };

    return labels[type];
}

export default function AccountsPage() {
    const [
        accounts,
        setAccounts,
    ] =
        useState<Account[]>(
            []
        );

    const [
        loading,
        setLoading,
    ] =
        useState(true);

    const [
        error,
        setError,
    ] =
        useState("");

    const [
        showModal,
        setShowModal,
    ] =
        useState(false);

    const [
        editingId,
        setEditingId,
    ] =
        useState<
            number | null
        >(null);

    const [
        submitting,
        setSubmitting,
    ] =
        useState(false);

    const [
        form,
        setForm,
    ] =
        useState<AccountForm>(
            emptyForm
        );

    const totalBalance =
        useMemo(
            () =>
                accounts.reduce(
                    (
                        total,
                        account
                    ) =>
                        total +
                        account.current_balance,
                    0
                ),
            [
                accounts,
            ]
        );

    const totalTransactions =
        useMemo(
            () =>
                accounts.reduce(
                    (
                        total,
                        account
                    ) =>
                        total +
                        account.transaction_count,
                    0
                ),
            [
                accounts,
            ]
        );

    async function loadAccounts() {
        try {
            const response =
                await api.get(
                    "/accounts"
                );

            setAccounts(
                response
                    .data
                    .accounts
            );
        } catch {
            setError(
                "Unable to load accounts."
            );
        }
    }

    useEffect(() => {
        async function initialize() {
            setLoading(true);
            setError("");

            await loadAccounts();

            setLoading(false);
        }

        initialize();
    }, []);

    function openCreateModal() {
        setEditingId(null);

        setForm({
            ...emptyForm,
        });

        setError("");
        setShowModal(true);
    }

    function openEditModal(
        account: Account
    ) {
        setEditingId(
            account.id
        );

        setForm({
            name:
                account.name,

            accountType:
                account.account_type,

            initialBalance:
                account
                    .initial_balance
                    .toString(),
        });

        setError("");
        setShowModal(true);
    }

    function closeModal() {
        if (submitting) {
            return;
        }

        setShowModal(false);
        setEditingId(null);

        setForm({
            ...emptyForm,
        });
    }

    async function handleSubmit(
        event: FormEvent
    ) {
        event.preventDefault();

        if (
            form.name
                .trim()
                .length < 2
        ) {
            setError(
                "Account name must contain at least 2 characters."
            );

            return;
        }

        const balance =
            Number(
                form.initialBalance
            );

        if (
            !Number.isFinite(
                balance
            )
        ) {
            setError(
                "Please enter a valid starting balance."
            );

            return;
        }

        setSubmitting(true);
        setError("");

        const payload = {
            name:
                form.name.trim(),

            accountType:
                form.accountType,

            initialBalance:
                balance,
        };

        try {
            if (
                editingId ===
                null
            ) {
                await api.post(
                    "/accounts",
                    payload
                );
            } else {
                await api.patch(
                    `/accounts/${editingId}`,
                    payload
                );
            }

            setShowModal(false);
            setEditingId(null);

            setForm({
                ...emptyForm,
            });

            await loadAccounts();
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
                    "Unable to save account."
                );
            } else {
                setError(
                    "Unable to save account."
                );
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteAccount(
        account: Account
    ) {
        if (
            account.transaction_count >
            0
        ) {
            setError(
                `"${account.name}" has ${account.transaction_count} transaction(s). Delete or move those transactions before deleting this account.`
            );

            return;
        }

        const confirmed =
            window.confirm(
                `Delete "${account.name}"?`
            );

        if (!confirmed) {
            return;
        }

        setError("");

        try {
            await api.delete(
                `/accounts/${account.id}`
            );

            await loadAccounts();
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
                    "Unable to delete account."
                );
            } else {
                setError(
                    "Unable to delete account."
                );
            }
        }
    }

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader" />

                <p>
                    Loading accounts...
                </p>
            </div>
        );
    }

    return (
        <main className="accounts-page">
            <header className="accounts-header">
                <div>
                    <p className="eyebrow">
                        YOUR MONEY
                    </p>

                    <h1>
                        Accounts
                    </h1>

                    <p className="muted">
                        Manage the accounts
                        that make up your
                        financial picture.
                    </p>
                </div>

                <button
                    className="primary-button add-account-button"
                    onClick={
                        openCreateModal
                    }
                >
                    + Add account
                </button>
            </header>

            {error && (
                <div className="error-banner accounts-error">
                    {error}
                </div>
            )}

            <section className="account-summary-grid">
                <article className="summary-card">
                    <span>
                        Total balance
                    </span>

                    <strong>
                        {money(
                            totalBalance
                        )}
                    </strong>

                    <small>
                        Across all accounts
                    </small>
                </article>

                <article className="summary-card">
                    <span>
                        Accounts
                    </span>

                    <strong>
                        {
                            accounts.length
                        }
                    </strong>

                    <small>
                        Active financial
                        accounts
                    </small>
                </article>

                <article className="summary-card">
                    <span>
                        Transactions
                    </span>

                    <strong>
                        {
                            totalTransactions
                        }
                    </strong>

                    <small>
                        Recorded activity
                    </small>
                </article>
            </section>

            {accounts.length ===
                0 ? (
                <section className="panel accounts-empty">
                    <h2>
                        No accounts yet
                    </h2>

                    <p>
                        Create your first
                        financial account to
                        start tracking money.
                    </p>

                    <button
                        className="primary-button"
                        onClick={
                            openCreateModal
                        }
                    >
                        Add your first account
                    </button>
                </section>
            ) : (
                <section className="accounts-grid">
                    {accounts.map(
                        (account) => (
                            <article
                                className="account-card"
                                key={
                                    account.id
                                }
                            >
                                <div className="account-card-header">
                                    <div>
                                        <span className="account-type-badge">
                                            {accountTypeLabel(
                                                account.account_type
                                            )}
                                        </span>

                                        <h2>
                                            {
                                                account.name
                                            }
                                        </h2>
                                    </div>

                                    <div className="account-card-actions">
                                        <button
                                            onClick={() =>
                                                openEditModal(
                                                    account
                                                )
                                            }
                                        >
                                            Edit
                                        </button>

                                        <button
                                            className="danger"
                                            onClick={() =>
                                                deleteAccount(
                                                    account
                                                )
                                            }
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>

                                <div className="account-current-balance">
                                    <span>
                                        Current balance
                                    </span>

                                    <strong>
                                        {money(
                                            account.current_balance
                                        )}
                                    </strong>
                                </div>

                                <div className="account-card-details">
                                    <div>
                                        <span>
                                            Starting balance
                                        </span>

                                        <strong>
                                            {money(
                                                account.initial_balance
                                            )}
                                        </strong>
                                    </div>

                                    <div>
                                        <span>
                                            Transactions
                                        </span>

                                        <strong>
                                            {
                                                account.transaction_count
                                            }
                                        </strong>
                                    </div>
                                </div>
                            </article>
                        )
                    )}
                </section>
            )}

            {showModal && (
                <div
                    className="account-modal-backdrop"
                    onMouseDown={
                        closeModal
                    }
                >
                    <section
                        className="account-modal"
                        onMouseDown={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="account-modal-header">
                            <div>
                                <p className="eyebrow">
                                    {editingId ===
                                        null
                                        ? "NEW ACCOUNT"
                                        : "UPDATE ACCOUNT"}
                                </p>

                                <h2>
                                    {editingId ===
                                        null
                                        ? "Add account"
                                        : "Edit account"}
                                </h2>
                            </div>

                            <button
                                type="button"
                                className="account-modal-close"
                                onClick={
                                    closeModal
                                }
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="account-form"
                            onSubmit={
                                handleSubmit
                            }
                        >
                            <label>
                                Account name

                                <input
                                    type="text"
                                    value={
                                        form.name
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                name:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    placeholder="Example: Main Checking"
                                    required
                                />
                            </label>

                            <label>
                                Account type

                                <select
                                    value={
                                        form.accountType
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                accountType:
                                                    event
                                                        .target
                                                        .value as
                                                    AccountType,
                                            })
                                        )
                                    }
                                >
                                    <option value="CHECKING">
                                        Checking
                                    </option>

                                    <option value="SAVINGS">
                                        Savings
                                    </option>

                                    <option value="CREDIT">
                                        Credit Card
                                    </option>

                                    <option value="CASH">
                                        Cash
                                    </option>

                                    <option value="INVESTMENT">
                                        Investment
                                    </option>

                                    <option value="OTHER">
                                        Other
                                    </option>
                                </select>
                            </label>

                            <label>
                                Starting balance

                                <input
                                    type="number"
                                    step="0.01"
                                    value={
                                        form.initialBalance
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                initialBalance:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    required
                                />
                            </label>

                            <div className="account-modal-actions">
                                <button
                                    type="button"
                                    className="secondary-button"
                                    onClick={
                                        closeModal
                                    }
                                    disabled={
                                        submitting
                                    }
                                >
                                    Cancel
                                </button>

                                <button
                                    type="submit"
                                    className="primary-button account-save-button"
                                    disabled={
                                        submitting
                                    }
                                >
                                    {submitting
                                        ? "Saving..."
                                        : editingId ===
                                            null
                                            ? "Add account"
                                            : "Save changes"}
                                </button>
                            </div>
                        </form>
                    </section>
                </div>
            )}
        </main>
    );
}