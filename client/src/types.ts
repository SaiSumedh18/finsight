export interface User {
    id: number;
    name: string;
    email: string;
    created_at?: string;
}

export interface Account {
    id: number;
    name: string;
    account_type: string;
    initial_balance: number;
    current_balance: number;
    transaction_count: number;
    created_at: string;
    updated_at: string;
}

export interface Transaction {
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
    notes?: string | null;
    created_at?: string;
    updated_at?: string;
}

export interface SpendingCategory {
    category_name: string;
    amount: number;
}

export interface MonthlyTrend {
    month_start: string;
    income: number;
    expenses: number;
}

export interface DashboardSummary {
    totalBalance: number;
    accountCount: number;
    monthlyIncome: number;
    monthlyExpenses: number;
    netCashFlow: number;
    transactionCount: number;
    budgetTotal: number;
    budgetSpent: number;
    budgetRemaining: number;
}

export interface DashboardData {
    success: boolean;
    month: string;
    summary: DashboardSummary;
    spendingByCategory:
    SpendingCategory[];
    recentTransactions:
    Transaction[];
    monthlyTrend:
    MonthlyTrend[];
}