import {
    NavLink,
    Outlet,
} from "react-router-dom";

import {
    useAuth,
} from "../context/AuthContext";

export default function AppLayout() {
    const {
        user,
        logout,
    } =
        useAuth();

    function navClass({
        isActive,
    }: {
        isActive: boolean;
    }) {
        return isActive
            ? "nav-item active"
            : "nav-item";
    }

    return (
        <div className="app-shell">
            <aside className="sidebar">
                <div>
                    <div className="sidebar-brand">
                        <span>
                            FinSight
                        </span>
                    </div>

                    <nav className="sidebar-nav">
                        <NavLink
                            to="/"
                            end
                            className={
                                navClass
                            }
                            style={{
                                textDecoration:
                                    "none",
                            }}
                        >
                            Overview
                        </NavLink>

                        <NavLink
                            to="/transactions"
                            className={
                                navClass
                            }
                            style={{
                                textDecoration:
                                    "none",
                            }}
                        >
                            Transactions
                        </NavLink>

                        <NavLink
                            to="/accounts"
                            className={
                                navClass
                            }
                            style={{
                                textDecoration:
                                    "none",
                            }}
                        >
                            Accounts
                        </NavLink>

                        <NavLink
                            to="/budgets"
                            className={
                                navClass
                            }
                            style={{
                                textDecoration:
                                    "none",
                            }}
                        >
                            Budgets
                        </NavLink>
                    </nav>
                </div>

                <div className="sidebar-footer">
                    <div className="user-avatar">
                        {user?.name
                            ?.charAt(0)
                            .toUpperCase()}
                    </div>

                    <div className="sidebar-user">
                        <strong>
                            {user?.name}
                        </strong>

                        <span>
                            {user?.email}
                        </span>
                    </div>

                    <button
                        className="logout-button"
                        onClick={
                            logout
                        }
                    >
                        Sign out
                    </button>
                </div>
            </aside>

            <Outlet />
        </div>
    );
}