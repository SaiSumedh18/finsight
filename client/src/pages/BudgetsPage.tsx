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

import "./budgets.css";

interface Category {
    id: number;
    name: string;

    category_type:
    | "INCOME"
    | "EXPENSE";
}

interface Budget {
    id: number;
    category_id: number;
    category_name: string;
    month_start: string;
    amount: number;
    spent: number;
    remaining: number;
    percent_used: number;
    created_at: string;
    updated_at: string;
}

interface BudgetForm {
    categoryId: string;
    amount: string;
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

function monthLabel(
    value: string
) {
    const [
        year,
        month,
    ] =
        value
            .slice(0, 7)
            .split("-")
            .map(Number);

    return new Intl.DateTimeFormat(
        "en-US",
        {
            month: "long",
            year: "numeric",
        }
    ).format(
        new Date(
            year,
            month - 1,
            1
        )
    );
}

export default function BudgetsPage() {
    const currentMonth =
        new Date()
            .toISOString()
            .slice(0, 7);

    const [
        selectedMonth,
        setSelectedMonth,
    ] =
        useState(
            currentMonth
        );

    const [
        budgets,
        setBudgets,
    ] =
        useState<
            Budget[]
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
        useState<BudgetForm>({
            categoryId: "",
            amount: "",
        });

    const expenseCategories =
        useMemo(
            () =>
                categories.filter(
                    (category) =>
                        category.category_type ===
                        "EXPENSE"
                ),
            [
                categories,
            ]
        );

    const availableCategories =
        useMemo(
            () =>
                expenseCategories.filter(
                    (category) =>
                        !budgets.some(
                            (budget) =>
                                budget.category_id ===
                                category.id
                        )
                ),
            [
                expenseCategories,
                budgets,
            ]
        );

    const totalBudget =
        useMemo(
            () =>
                budgets.reduce(
                    (
                        total,
                        budget
                    ) =>
                        total +
                        budget.amount,
                    0
                ),
            [
                budgets,
            ]
        );

    const totalSpent =
        useMemo(
            () =>
                budgets.reduce(
                    (
                        total,
                        budget
                    ) =>
                        total +
                        budget.spent,
                    0
                ),
            [
                budgets,
            ]
        );

    const totalRemaining =
        totalBudget -
        totalSpent;

    async function loadData() {
        setError("");

        try {
            const [
                budgetResponse,
                categoryResponse,
            ] =
                await Promise.all([
                    api.get(
                        "/budgets",
                        {
                            params: {
                                month:
                                    `${selectedMonth}-01`,
                            },
                        }
                    ),

                    api.get(
                        "/categories"
                    ),
                ]);

            setBudgets(
                budgetResponse
                    .data
                    .budgets
            );

            setCategories(
                categoryResponse
                    .data
                    .categories
            );
        } catch {
            setError(
                "Unable to load budget data."
            );
        }
    }

    useEffect(() => {
        async function initialize() {
            setLoading(true);

            await loadData();

            setLoading(false);
        }

        initialize();
    }, [
        selectedMonth,
    ]);

    function openCreateModal() {
        if (
            availableCategories.length ===
            0
        ) {
            setError(
                "Every expense category already has a budget for this month."
            );

            return;
        }

        setEditingId(null);

        setForm({
            categoryId:
                availableCategories[0]
                    .id
                    .toString(),

            amount: "",
        });

        setError("");
        setShowModal(true);
    }

    function openEditModal(
        budget: Budget
    ) {
        setEditingId(
            budget.id
        );

        setForm({
            categoryId:
                budget.category_id
                    .toString(),

            amount:
                budget.amount
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
            categoryId: "",
            amount: "",
        });
    }

    async function handleSubmit(
        event: FormEvent
    ) {
        event.preventDefault();

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
                "Budget amount must be greater than zero."
            );

            return;
        }

        setSubmitting(true);
        setError("");

        try {
            if (
                editingId ===
                null
            ) {
                if (
                    !form.categoryId
                ) {
                    setError(
                        "Select an expense category."
                    );

                    setSubmitting(
                        false
                    );

                    return;
                }

                await api.post(
                    "/budgets",
                    {
                        categoryId:
                            Number(
                                form.categoryId
                            ),

                        monthStart:
                            `${selectedMonth}-01`,

                        amount,
                    }
                );
            } else {
                await api.patch(
                    `/budgets/${editingId}`,
                    {
                        amount,
                    }
                );
            }

            setShowModal(false);
            setEditingId(null);

            setForm({
                categoryId: "",
                amount: "",
            });

            await loadData();
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
                    "Unable to save budget."
                );
            } else {
                setError(
                    "Unable to save budget."
                );
            }
        } finally {
            setSubmitting(false);
        }
    }

    async function deleteBudget(
        budget: Budget
    ) {
        const confirmed =
            window.confirm(
                `Delete the ${budget.category_name} budget for ${monthLabel(selectedMonth)}?`
            );

        if (!confirmed) {
            return;
        }

        setError("");

        try {
            await api.delete(
                `/budgets/${budget.id}`
            );

            await loadData();
        } catch {
            setError(
                "Unable to delete budget."
            );
        }
    }

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader" />

                <p>
                    Loading budgets...
                </p>
            </div>
        );
    }

    return (
        <main className="budgets-page">
            <header className="budgets-header">
                <div>
                    <p className="eyebrow">
                        SPENDING PLAN
                    </p>

                    <h1>
                        Budgets
                    </h1>

                    <p className="muted">
                        Set monthly spending
                        targets and track how
                        much remains.
                    </p>
                </div>

                <div className="budget-header-actions">
                    <label className="budget-month-picker">
                        Month

                        <input
                            type="month"
                            value={
                                selectedMonth
                            }
                            onChange={(
                                event
                            ) =>
                                setSelectedMonth(
                                    event.target
                                        .value
                                )
                            }
                        />
                    </label>

                    <button
                        className="primary-button add-budget-button"
                        onClick={
                            openCreateModal
                        }
                    >
                        + Add budget
                    </button>
                </div>
            </header>

            {error && (
                <div className="error-banner budgets-error">
                    {error}
                </div>
            )}

            <section className="budget-summary-grid">
                <article className="summary-card">
                    <span>
                        Monthly budget
                    </span>

                    <strong>
                        {money(
                            totalBudget
                        )}
                    </strong>

                    <small>
                        {
                            budgets.length
                        }{" "}
                        categor
                        {budgets.length ===
                            1
                            ? "y"
                            : "ies"}
                    </small>
                </article>

                <article className="summary-card expense-card">
                    <span>
                        Spent
                    </span>

                    <strong>
                        {money(
                            totalSpent
                        )}
                    </strong>

                    <small>
                        {monthLabel(
                            selectedMonth
                        )}
                    </small>
                </article>

                <article className="summary-card">
                    <span>
                        Remaining
                    </span>

                    <strong
                        className={
                            totalRemaining >=
                                0
                                ? "positive"
                                : "negative"
                        }
                    >
                        {money(
                            totalRemaining
                        )}
                    </strong>

                    <small>
                        Budget minus spending
                    </small>
                </article>
            </section>

            {budgets.length ===
                0 ? (
                <section className="panel budgets-empty">
                    <h2>
                        No budgets for{" "}
                        {monthLabel(
                            selectedMonth
                        )}
                    </h2>

                    <p>
                        Create a budget for an
                        expense category to
                        start tracking monthly
                        spending.
                    </p>

                    <button
                        className="primary-button"
                        onClick={
                            openCreateModal
                        }
                    >
                        Create a budget
                    </button>
                </section>
            ) : (
                <section className="budget-cards-grid">
                    {budgets.map(
                        (budget) => {
                            const progress =
                                Math.min(
                                    100,
                                    Math.max(
                                        0,
                                        budget
                                            .percent_used
                                    )
                                );

                            const overspent =
                                budget.remaining <
                                0;

                            return (
                                <article
                                    className="budget-card"
                                    key={
                                        budget.id
                                    }
                                >
                                    <div className="budget-card-header">
                                        <div>
                                            <span className="budget-category-label">
                                                EXPENSE
                                            </span>

                                            <h2>
                                                {
                                                    budget.category_name
                                                }
                                            </h2>
                                        </div>

                                        <div className="budget-card-actions">
                                            <button
                                                onClick={() =>
                                                    openEditModal(
                                                        budget
                                                    )
                                                }
                                            >
                                                Edit
                                            </button>

                                            <button
                                                className="danger"
                                                onClick={() =>
                                                    deleteBudget(
                                                        budget
                                                    )
                                                }
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    <div className="budget-amounts">
                                        <div>
                                            <span>
                                                Budget
                                            </span>

                                            <strong>
                                                {money(
                                                    budget.amount
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Spent
                                            </span>

                                            <strong>
                                                {money(
                                                    budget.spent
                                                )}
                                            </strong>
                                        </div>

                                        <div>
                                            <span>
                                                Remaining
                                            </span>

                                            <strong
                                                className={
                                                    overspent
                                                        ? "negative"
                                                        : "positive"
                                                }
                                            >
                                                {money(
                                                    budget.remaining
                                                )}
                                            </strong>
                                        </div>
                                    </div>

                                    <div className="budget-progress-header">
                                        <span>
                                            {
                                                budget.percent_used
                                            }
                                            % used
                                        </span>

                                        {overspent && (
                                            <strong>
                                                Over budget
                                            </strong>
                                        )}
                                    </div>

                                    <div className="budget-progress-track">
                                        <div
                                            className={
                                                overspent
                                                    ? "budget-progress-fill overspent"
                                                    : "budget-progress-fill"
                                            }
                                            style={{
                                                width:
                                                    `${progress}%`,
                                            }}
                                        />
                                    </div>
                                </article>
                            );
                        }
                    )}
                </section>
            )}

            {showModal && (
                <div
                    className="budget-modal-backdrop"
                    onMouseDown={
                        closeModal
                    }
                >
                    <section
                        className="budget-modal"
                        onMouseDown={(
                            event
                        ) =>
                            event.stopPropagation()
                        }
                    >
                        <div className="budget-modal-header">
                            <div>
                                <p className="eyebrow">
                                    {editingId ===
                                        null
                                        ? "NEW BUDGET"
                                        : "UPDATE BUDGET"}
                                </p>

                                <h2>
                                    {editingId ===
                                        null
                                        ? "Create budget"
                                        : "Edit budget"}
                                </h2>

                                <p className="muted">
                                    {monthLabel(
                                        selectedMonth
                                    )}
                                </p>
                            </div>

                            <button
                                type="button"
                                className="budget-modal-close"
                                onClick={
                                    closeModal
                                }
                            >
                                ×
                            </button>
                        </div>

                        <form
                            className="budget-form"
                            onSubmit={
                                handleSubmit
                            }
                        >
                            <label>
                                Expense category

                                <select
                                    value={
                                        form.categoryId
                                    }
                                    disabled={
                                        editingId !==
                                        null
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
                                    {editingId ===
                                        null ? (
                                        availableCategories.map(
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
                                        )
                                    ) : (
                                        expenseCategories
                                            .filter(
                                                (
                                                    category
                                                ) =>
                                                    category.id ===
                                                    Number(
                                                        form.categoryId
                                                    )
                                            )
                                            .map(
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
                                            )
                                    )}
                                </select>
                            </label>

                            <label>
                                Monthly budget

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

                            <div className="budget-modal-actions">
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
                                    className="primary-button budget-save-button"
                                    disabled={
                                        submitting
                                    }
                                >
                                    {submitting
                                        ? "Saving..."
                                        : editingId ===
                                            null
                                            ? "Create budget"
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