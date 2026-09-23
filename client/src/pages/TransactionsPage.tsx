import {
    useEffect,
    useMemo,
    useState,
    type FormEvent,
} from "react";

import axios from "axios";

import {
    Link,
} from "react-router-dom";

import {
    api,
} from "../lib/api";

import "./transactions.css";

interface Account {
    id: number;
    name: string;
    account_type: string;
    current_balance: number;
}

interface Category {
    id: number;
    name: string;
    category_type:
    | "INCOME"
    | "EXPENSE";
}

interface Transaction {
    id: number;
    account_id: number;
    account_name: string;
    category_id: number | null;
    category_name: string | null;
    transaction_type:
    | "INCOME"
    | "EXPENSE";
    amount: number;
    description: string;
    transaction_date: string;
    notes: string | null;
}

interface TransactionForm {
    accountId: string;
    categoryId: string;
    transactionType:
    | "INCOME"
    | "EXPENSE";
    amount: string;
    description: string;
    transactionDate: string;
    notes: string;
}

function today() {
    return new Date()
        .toISOString()
        .slice(0, 10);
}

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

function displayDate(
    value: string
) {
    const [
        year,
        month,
        day,
    ] =
        value
            .slice(0, 10)
            .split("-")
            .map(Number);

    return new Intl.DateTimeFormat(
        "en-US",
        {
            month: "short",
            day: "numeric",
            year: "numeric",
        }
    ).format(
        new Date(
            year,
            month - 1,
            day
        )
    );
}

const emptyForm:
    TransactionForm = {
    accountId: "",
    categoryId: "",
    transactionType:
        "EXPENSE",
    amount: "",
    description: "",
    transactionDate:
        today(),
    notes: "",
};

export default function TransactionsPage() {
    const [
        transactions,
        setTransactions,
    ] =
        useState<
            Transaction[]
        >([]);

    const [
        accounts,
        setAccounts,
    ] =
        useState<
            Account[]
        >([]);

    const [
        categories,
        setCategories,
    ] =
        useState<
            Category[]
        >([]);

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
        submitting,
        setSubmitting,
    ] =
        useState(false);

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
        form,
        setForm,
    ] =
        useState<
            TransactionForm
        >(emptyForm);

    const [
        search,
        setSearch,
    ] =
        useState("");

    const [
        typeFilter,
        setTypeFilter,
    ] =
        useState("");

    const [
        accountFilter,
        setAccountFilter,
    ] =
        useState("");

    const [
        categoryFilter,
        setCategoryFilter,
    ] =
        useState("");

    const [
        startDate,
        setStartDate,
    ] =
        useState("");

    const [
        endDate,
        setEndDate,
    ] =
        useState("");

    const formCategories =
        useMemo(
            () =>
                categories.filter(
                    (category) =>
                        category.category_type ===
                        form.transactionType
                ),
            [
                categories,
                form.transactionType,
            ]
        );

    async function loadReferenceData() {
        const [
            accountResponse,
            categoryResponse,
        ] =
            await Promise.all([
                api.get(
                    "/accounts"
                ),

                api.get(
                    "/categories"
                ),
            ]);

        setAccounts(
            accountResponse
                .data
                .accounts
        );

        setCategories(
            categoryResponse
                .data
                .categories
        );

        return {
            loadedAccounts:
                accountResponse
                    .data
                    .accounts as Account[],

            loadedCategories:
                categoryResponse
                    .data
                    .categories as Category[],
        };
    }

    async function loadTransactions() {
        try {
            const params: Record<
                string,
                string
            > = {};

            if (
                search.trim()
            ) {
                params.search =
                    search.trim();
            }

            if (typeFilter) {
                params.type =
                    typeFilter;
            }

            if (
                accountFilter
            ) {
                params.accountId =
                    accountFilter;
            }

            if (
                categoryFilter
            ) {
                params.categoryId =
                    categoryFilter;
            }

            if (startDate) {
                params.startDate =
                    startDate;
            }

            if (endDate) {
                params.endDate =
                    endDate;
            }

            const response =
                await api.get(
                    "/transactions",
                    {
                        params,
                    }
                );

            setTransactions(
                response
                    .data
                    .transactions
            );
        } catch {
            setError(
                "Unable to load transactions."
            );
        }
    }

    useEffect(() => {
        async function initialize() {
            setLoading(true);
            setError("");

            try {
                await loadReferenceData();
                await loadTransactions();
            } catch {
                setError(
                    "Unable to load transaction data."
                );
            } finally {
                setLoading(false);
            }
        }

        initialize();
    }, []);

    useEffect(() => {
        if (loading) {
            return;
        }

        const timer =
            window.setTimeout(
                () => {
                    loadTransactions();
                },
                250
            );

        return () => {
            window.clearTimeout(
                timer
            );
        };
    }, [
        search,
        typeFilter,
        accountFilter,
        categoryFilter,
        startDate,
        endDate,
    ]);

    function openCreateModal() {
        const defaultType:
            | "INCOME"
            | "EXPENSE" =
            "EXPENSE";

        const firstExpenseCategory =
            categories.find(
                (category) =>
                    category.category_type ===
                    defaultType
            );

        setEditingId(null);

        setForm({
            accountId:
                accounts[0]
                    ?.id
                    .toString() ??
                "",

            categoryId:
                firstExpenseCategory
                    ?.id
                    .toString() ??
                "",

            transactionType:
                defaultType,

            amount: "",

            description: "",

            transactionDate:
                today(),

            notes: "",
        });

        setError("");
        setShowModal(true);
    }

    function openEditModal(
        transaction:
            Transaction
    ) {
        setEditingId(
            transaction.id
        );

        setForm({
            accountId:
                transaction
                    .account_id
                    .toString(),

            categoryId:
                transaction
                    .category_id
                    ?.toString() ??
                "",

            transactionType:
                transaction
                    .transaction_type,

            amount:
                transaction.amount
                    .toString(),

            description:
                transaction.description,

            transactionDate:
                transaction
                    .transaction_date
                    .slice(
                        0,
                        10
                    ),

            notes:
                transaction.notes ??
                "",
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
        setForm(emptyForm);
    }

    function changeTransactionType(
        transactionType:
            | "INCOME"
            | "EXPENSE"
    ) {
        const firstCategory =
            categories.find(
                (category) =>
                    category.category_type ===
                    transactionType
            );

        setForm(
            (current) => ({
                ...current,

                transactionType,

                categoryId:
                    firstCategory
                        ?.id
                        .toString() ??
                    "",
            })
        );
    }

    async function handleSubmit(
        event: FormEvent
    ) {
        event.preventDefault();

        if (
            !form.accountId ||
            !form.amount ||
            !form.description ||
            !form.transactionDate
        ) {
            setError(
                "Please complete all required transaction fields."
            );

            return;
        }

        const amount =
            Number(
                form.amount
            );

        if (
            !Number.isFinite(
                amount
            ) ||
            amount <= 0
        ) {
            setError(
                "Amount must be greater than zero."
            );

            return;
        }

        setSubmitting(true);
        setError("");

        const payload = {
            accountId:
                Number(
                    form.accountId
                ),

            categoryId:
                form.categoryId
                    ? Number(
                        form.categoryId
                    )
                    : null,

            transactionType:
                form.transactionType,

            amount,

            description:
                form.description,

            transactionDate:
                form.transactionDate,

            notes:
                form.notes.trim()
                    ? form.notes.trim()
                    : null,
        };

        try {
            if (
                editingId === null
            ) {
                await api.post(
                    "/transactions",
                    payload
                );
            } else {
                await api.patch(
                    `/transactions/${editingId}`,
                    payload
                );
            }

            setShowModal(false);
            setEditingId(null);
            setForm(emptyForm);

            await loadTransactions();
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
                    "Unable to save transaction."
                );
            } else {
                setError(
                    "Unable to save transaction."
                );
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteTransaction(
        transaction:
            Transaction
    ) {
        const confirmed =
            window.confirm(
                `Delete "${transaction.description}"?`
            );

        if (!confirmed) {
            return;
        }

        setError("");

        try {
            await api.delete(
                `/transactions/${transaction.id}`
            );

            await loadTransactions();
        } catch {
            setError(
                "Unable to delete transaction."
            );
        }
    }

    function clearFilters() {
        setSearch("");
        setTypeFilter("");
        setAccountFilter("");
        setCategoryFilter("");
        setStartDate("");
        setEndDate("");
    }

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader" />

                <p>
                    Loading transactions...
                </p>
            </div>
        );
    }

    return (
        <main className="transactions-page">
            <header className="transactions-topbar">
                <div>
                    <Link
                        to="/"
                        className="back-link"
                    >
                        ← Overview
                    </Link>

                    <p className="eyebrow">
                        MONEY ACTIVITY
                    </p>

                    <h1>
                        Transactions
                    </h1>

                    <p className="muted">
                        Track income and
                        expenses across all of
                        your accounts.
                    </p>
                </div>

                <button
                    className="primary-button transaction-add-button"
                    onClick={
                        openCreateModal
                    }
                >
                    + Add transaction
                </button>
            </header>

            {error && (
                <div className="error-banner transactions-error">
                    {error}
                </div>
            )}

            <section className="panel transaction-filter-panel">
                <div className="transaction-filters">
                    <label className="transaction-search">
                        Search

                        <input
                            type="search"
                            value={search}
                            onChange={(
                                event
                            ) =>
                                setSearch(
                                    event.target
                                        .value
                                )
                            }
                            placeholder="Search description or notes"
                        />
                    </label>

                    <label>
                        Type

                        <select
                            value={
                                typeFilter
                            }
                            onChange={(
                                event
                            ) =>
                                setTypeFilter(
                                    event.target
                                        .value
                                )
                            }
                        >
                            <option value="">
                                All types
                            </option>

                            <option value="INCOME">
                                Income
                            </option>

                            <option value="EXPENSE">
                                Expense
                            </option>
                        </select>
                    </label>

                    <label>
                        Account

                        <select
                            value={
                                accountFilter
                            }
                            onChange={(
                                event
                            ) =>
                                setAccountFilter(
                                    event.target
                                        .value
                                )
                            }
                        >
                            <option value="">
                                All accounts
                            </option>

                            {accounts.map(
                                (account) => (
                                    <option
                                        key={
                                            account.id
                                        }
                                        value={
                                            account.id
                                        }
                                    >
                                        {
                                            account.name
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        Category

                        <select
                            value={
                                categoryFilter
                            }
                            onChange={(
                                event
                            ) =>
                                setCategoryFilter(
                                    event.target
                                        .value
                                )
                            }
                        >
                            <option value="">
                                All categories
                            </option>

                            {categories.map(
                                (category) => (
                                    <option
                                        key={
                                            category.id
                                        }
                                        value={
                                            category.id
                                        }
                                    >
                                        {
                                            category.name
                                        }
                                    </option>
                                )
                            )}
                        </select>
                    </label>

                    <label>
                        Start date

                        <input
                            type="date"
                            value={
                                startDate
                            }
                            onChange={(
                                event
                            ) =>
                                setStartDate(
                                    event.target
                                        .value
                                )
                            }
                        />
                    </label>

                    <label>
                        End date

                        <input
                            type="date"
                            value={endDate}
                            onChange={(
                                event
                            ) =>
                                setEndDate(
                                    event.target
                                        .value
                                )
                            }
                        />
                    </label>
                </div>

                <div className="filter-actions">
                    <span>
                        {
                            transactions.length
                        }{" "}
                        transaction
                        {transactions.length ===
                            1
                            ? ""
                            : "s"}
                    </span>

                    <button
                        className="secondary-button"
                        onClick={
                            clearFilters
                        }
                    >
                        Clear filters
                    </button>
                </div>
            </section>

            <section className="panel transaction-list-panel">
                {transactions.length ===
                    0 ? (
                    <div className="transaction-empty">
                        <h2>
                            No transactions found
                        </h2>

                        <p>
                            Add a transaction or
                            adjust your filters.
                        </p>
                    </div>
                ) : (
                    <div className="transaction-table-wrapper">
                        <table className="transaction-table transaction-page-table">
                            <thead>
                                <tr>
                                    <th>
                                        Description
                                    </th>

                                    <th>
                                        Type
                                    </th>

                                    <th>
                                        Category
                                    </th>

                                    <th>
                                        Account
                                    </th>

                                    <th>
                                        Date
                                    </th>

                                    <th>
                                        Amount
                                    </th>

                                    <th>
                                        Actions
                                    </th>
                                </tr>
                            </thead>

                            <tbody>
                                {transactions.map(
                                    (
                                        transaction
                                    ) => (
                                        <tr
                                            key={
                                                transaction.id
                                            }
                                        >
                                            <td>
                                                <div className="transaction-description">
                                                    <strong>
                                                        {
                                                            transaction.description
                                                        }
                                                    </strong>

                                                    {transaction.notes && (
                                                        <span>
                                                            {
                                                                transaction.notes
                                                            }
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td>
                                                <span
                                                    className={
                                                        transaction.transaction_type ===
                                                            "INCOME"
                                                            ? "type-badge income"
                                                            : "type-badge expense"
                                                    }
                                                >
                                                    {
                                                        transaction.transaction_type
                                                    }
                                                </span>
                                            </td>

                                            <td>
                                                {transaction.category_name ??
                                                    "Uncategorized"}
                                            </td>

                                            <td>
                                                {
                                                    transaction.account_name
                                                }
                                            </td>

                                            <td>
                                                {displayDate(
                                                    transaction.transaction_date
                                                )}
                                            </td>

                                            <td
                                                className={
                                                    transaction.transaction_type ===
                                                        "INCOME"
                                                        ? "positive"
                                                        : "negative"
                                                }
                                            >
                                                {transaction.transaction_type ===
                                                    "INCOME"
                                                    ? "+"
                                                    : "-"}

                                                {money(
                                                    transaction.amount
                                                )}
                                            </td>

                                            <td>
                                                <div className="table-actions">
                                                    <button
                                                        className="table-action-button"
                                                        onClick={() =>
                                                            openEditModal(
                                                                transaction
                                                            )
                                                        }
                                                    >
                                                        Edit
                                                    </button>

                                                    <button
                                                        className="table-action-button danger"
                                                        onClick={() =>
                                                            deleteTransaction(
                                                                transaction
                                                            )
                                                        }
                                                    >
                                                        Delete
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {showModal && (
                <div
                    className="modal-backdrop"
                    onMouseDown={
                        closeModal
                    }
                >
                    <section
                        className="transaction-modal"
                        onMouseDown={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="modal-header">
                            <div>
                                <p className="eyebrow">
                                    {editingId ===
                                        null
                                        ? "NEW ACTIVITY"
                                        : "UPDATE ACTIVITY"}
                                </p>

                                <h2>
                                    {editingId ===
                                        null
                                        ? "Add transaction"
                                        : "Edit transaction"}
                                </h2>
                            </div>

                            <button
                                className="modal-close"
                                onClick={
                                    closeModal
                                }
                                type="button"
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="transaction-form"
                            onSubmit={
                                handleSubmit
                            }
                        >
                            <label>
                                Type

                                <select
                                    value={
                                        form.transactionType
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        changeTransactionType(
                                            event.target
                                                .value as
                                            | "INCOME"
                                            | "EXPENSE"
                                        )
                                    }
                                >
                                    <option value="EXPENSE">
                                        Expense
                                    </option>

                                    <option value="INCOME">
                                        Income
                                    </option>
                                </select>
                            </label>

                            <label>
                                Account

                                <select
                                    value={
                                        form.accountId
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                accountId:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    required
                                >
                                    <option value="">
                                        Select account
                                    </option>

                                    {accounts.map(
                                        (
                                            account
                                        ) => (
                                            <option
                                                key={
                                                    account.id
                                                }
                                                value={
                                                    account.id
                                                }
                                            >
                                                {
                                                    account.name
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label>
                                Category

                                <select
                                    value={
                                        form.categoryId
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                categoryId:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                >
                                    <option value="">
                                        Uncategorized
                                    </option>

                                    {formCategories.map(
                                        (
                                            category
                                        ) => (
                                            <option
                                                key={
                                                    category.id
                                                }
                                                value={
                                                    category.id
                                                }
                                            >
                                                {
                                                    category.name
                                                }
                                            </option>
                                        )
                                    )}
                                </select>
                            </label>

                            <label>
                                Amount

                                <input
                                    type="number"
                                    min="0.01"
                                    step="0.01"
                                    value={
                                        form.amount
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                amount:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    placeholder="0.00"
                                    required
                                />
                            </label>

                            <label className="transaction-form-wide">
                                Description

                                <input
                                    type="text"
                                    value={
                                        form.description
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                description:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    placeholder="What was this transaction for?"
                                    required
                                />
                            </label>

                            <label>
                                Date

                                <input
                                    type="date"
                                    value={
                                        form.transactionDate
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                transactionDate:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    required
                                />
                            </label>

                            <label className="transaction-form-wide">
                                Notes

                                <textarea
                                    value={
                                        form.notes
                                    }
                                    onChange={(
                                        event
                                    ) =>
                                        setForm(
                                            (
                                                current
                                            ) => ({
                                                ...current,

                                                notes:
                                                    event
                                                        .target
                                                        .value,
                                            })
                                        )
                                    }
                                    placeholder="Optional notes"
                                    rows={3}
                                />
                            </label>

                            <div className="modal-actions transaction-form-wide">
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
                                    className="primary-button modal-save-button"
                                    disabled={
                                        submitting
                                    }
                                >
                                    {submitting
                                        ? "Saving..."
                                        : editingId ===
                                            null
                                            ? "Add transaction"
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