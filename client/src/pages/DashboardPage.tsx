import {
    useEffect,
    useState,
} from "react";

import {
    api,
} from "../lib/api";

import {
    useAuth,
} from "../context/AuthContext";

import type {
    Account,
    DashboardData,
} from "../types";

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
            .slice(0, 10)
            .split("-")
            .map(Number);

    return new Intl.DateTimeFormat(
        "en-US",
        {
            month: "short",
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

function dateLabel(
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

export default function DashboardPage() {
    const {
        user,
    } =
        useAuth();

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
        dashboard,
        setDashboard,
    ] =
        useState<
            DashboardData | null
        >(null);

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

    useEffect(() => {
        async function loadDashboard() {
            setLoading(true);
            setError("");

            try {
                const monthStart =
                    `${selectedMonth}-01`;

                const [
                    dashboardResponse,
                    accountsResponse,
                ] =
                    await Promise.all([
                        api.get(
                            "/dashboard/summary",
                            {
                                params: {
                                    month:
                                        monthStart,
                                },
                            }
                        ),

                        api.get(
                            "/accounts"
                        ),
                    ]);

                setDashboard(
                    dashboardResponse
                        .data
                );

                setAccounts(
                    accountsResponse
                        .data
                        .accounts
                );
            } catch {
                setError(
                    "Unable to load your dashboard."
                );
            } finally {
                setLoading(false);
            }
        }

        loadDashboard();
    }, [
        selectedMonth,
    ]);

    if (loading) {
        return (
            <div className="page-loader">
                <div className="loader" />

                <p>
                    Loading your finances...
                </p>
            </div>
        );
    }

    if (
        error ||
        !dashboard
    ) {
        return (
            <div className="page-loader">
                <p className="error-banner">
                    {error ||
                        "Dashboard unavailable"}
                </p>
            </div>
        );
    }

    const {
        summary,
    } =
        dashboard;

    const maxTrendValue =
        Math.max(
            1,
            ...dashboard.monthlyTrend
                .flatMap(
                    (month) => [
                        month.income,
                        month.expenses,
                    ]
                )
        );

    const maxSpending =
        Math.max(
            1,
            ...dashboard
                .spendingByCategory
                .map(
                    (item) =>
                        item.amount
                )
        );

    return (
        <main className="dashboard">
            <header className="dashboard-header">
                <div>
                    <p className="eyebrow">
                        FINANCIAL OVERVIEW
                    </p>

                    <h1>
                        Welcome back,{" "}
                        {user?.name
                            .split(" ")[0]}
                    </h1>

                    <p className="muted">
                        Here is what is happening
                        with your money.
                    </p>
                </div>

                <label className="month-picker">
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
            </header>

            <section className="summary-grid">
                <article className="summary-card">
                    <span>
                        Total balance
                    </span>

                    <strong>
                        {money(
                            summary.totalBalance
                        )}
                    </strong>

                    <small>
                        {
                            summary.accountCount
                        }{" "}
                        accounts
                    </small>
                </article>

                <article className="summary-card income-card">
                    <span>
                        Monthly income
                    </span>

                    <strong>
                        {money(
                            summary.monthlyIncome
                        )}
                    </strong>

                    <small>
                        {
                            summary.transactionCount
                        }{" "}
                        transactions this
                        month
                    </small>
                </article>

                <article className="summary-card expense-card">
                    <span>
                        Monthly expenses
                    </span>

                    <strong>
                        {money(
                            summary.monthlyExpenses
                        )}
                    </strong>

                    <small>
                        {monthLabel(
                            dashboard.month
                        )}
                    </small>
                </article>

                <article className="summary-card">
                    <span>
                        Net cash flow
                    </span>

                    <strong
                        className={
                            summary.netCashFlow >=
                                0
                                ? "positive"
                                : "negative"
                        }
                    >
                        {money(
                            summary.netCashFlow
                        )}
                    </strong>

                    <small>
                        Income minus expenses
                    </small>
                </article>
            </section>

            <section className="dashboard-grid">
                <article className="panel trend-panel">
                    <div className="panel-header">
                        <div>
                            <h2>
                                Cash flow
                            </h2>

                            <p>
                                Income and expenses
                                over six months
                            </p>
                        </div>

                        <div className="legend">
                            <span>
                                <i className="legend-income" />
                                Income
                            </span>

                            <span>
                                <i className="legend-expense" />
                                Expenses
                            </span>
                        </div>
                    </div>

                    <div className="trend-chart">
                        {dashboard.monthlyTrend.map(
                            (month) => (
                                <div
                                    className="trend-column"
                                    key={
                                        month.month_start
                                    }
                                >
                                    <div className="trend-bars">
                                        <div
                                            className="bar income-bar"
                                            style={{
                                                height:
                                                    `${Math.max(
                                                        3,
                                                        (
                                                            month.income /
                                                            maxTrendValue
                                                        ) *
                                                        100
                                                    )}%`,
                                            }}
                                            title={
                                                money(
                                                    month.income
                                                )
                                            }
                                        />

                                        <div
                                            className="bar expense-bar"
                                            style={{
                                                height:
                                                    `${Math.max(
                                                        3,
                                                        (
                                                            month.expenses /
                                                            maxTrendValue
                                                        ) *
                                                        100
                                                    )}%`,
                                            }}
                                            title={
                                                money(
                                                    month.expenses
                                                )
                                            }
                                        />
                                    </div>

                                    <span>
                                        {monthLabel(
                                            month.month_start
                                        ).split(" ")[0]}
                                    </span>
                                </div>
                            )
                        )}
                    </div>
                </article>

                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>
                                Spending
                            </h2>

                            <p>
                                By category
                            </p>
                        </div>
                    </div>

                    <div className="spending-list">
                        {dashboard
                            .spendingByCategory
                            .length === 0 ? (
                            <p className="empty-state">
                                No expenses this
                                month.
                            </p>
                        ) : (
                            dashboard
                                .spendingByCategory
                                .map(
                                    (item) => (
                                        <div
                                            className="spending-item"
                                            key={
                                                item.category_name
                                            }
                                        >
                                            <div className="spending-row">
                                                <span>
                                                    {
                                                        item.category_name
                                                    }
                                                </span>

                                                <strong>
                                                    {money(
                                                        item.amount
                                                    )}
                                                </strong>
                                            </div>

                                            <div className="progress-track">
                                                <div
                                                    className="progress-fill"
                                                    style={{
                                                        width:
                                                            `${(
                                                                item.amount /
                                                                maxSpending
                                                            ) *
                                                            100}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    )
                                )
                        )}
                    </div>
                </article>
            </section>

            <section className="dashboard-grid lower-grid">
                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>
                                Budget progress
                            </h2>

                            <p>
                                {monthLabel(
                                    dashboard.month
                                )}
                            </p>
                        </div>
                    </div>

                    <div className="budget-overview">
                        <div>
                            <span>
                                Budget
                            </span>

                            <strong>
                                {money(
                                    summary.budgetTotal
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Spent
                            </span>

                            <strong>
                                {money(
                                    summary.budgetSpent
                                )}
                            </strong>
                        </div>

                        <div>
                            <span>
                                Remaining
                            </span>

                            <strong>
                                {money(
                                    summary.budgetRemaining
                                )}
                            </strong>
                        </div>
                    </div>

                    <div className="progress-track large">
                        <div
                            className="progress-fill"
                            style={{
                                width:
                                    summary.budgetTotal >
                                        0
                                        ? `${Math.min(
                                            100,
                                            (
                                                summary.budgetSpent /
                                                summary.budgetTotal
                                            ) *
                                            100
                                        )}%`
                                        : "0%",
                            }}
                        />
                    </div>
                </article>

                <article className="panel">
                    <div className="panel-header">
                        <div>
                            <h2>
                                Accounts
                            </h2>

                            <p>
                                Current balances
                            </p>
                        </div>
                    </div>

                    <div className="account-list">
                        {accounts.map(
                            (account) => (
                                <div
                                    className="account-row"
                                    key={
                                        account.id
                                    }
                                >
                                    <div>
                                        <strong>
                                            {
                                                account.name
                                            }
                                        </strong>

                                        <span>
                                            {
                                                account.account_type
                                            }
                                        </span>
                                    </div>

                                    <strong>
                                        {money(
                                            account.current_balance
                                        )}
                                    </strong>
                                </div>
                            )
                        )}
                    </div>
                </article>
            </section>

            <section className="panel transactions-panel">
                <div className="panel-header">
                    <div>
                        <h2>
                            Recent transactions
                        </h2>

                        <p>
                            Latest account
                            activity
                        </p>
                    </div>
                </div>

                <div className="transaction-table-wrapper">
                    <table className="transaction-table">
                        <thead>
                            <tr>
                                <th>
                                    Description
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
                            </tr>
                        </thead>

                        <tbody>
                            {dashboard
                                .recentTransactions
                                .map(
                                    (
                                        transaction
                                    ) => (
                                        <tr
                                            key={
                                                transaction.id
                                            }
                                        >
                                            <td>
                                                <strong>
                                                    {
                                                        transaction.description
                                                    }
                                                </strong>
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
                                                {dateLabel(
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
                                        </tr>
                                    )
                                )}
                        </tbody>
                    </table>
                </div>
            </section>
        </main>
    );
}