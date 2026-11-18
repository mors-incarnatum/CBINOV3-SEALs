"use client";

import type { DummyAccount } from "@/models/auth";
import { useAuthViewModel } from "@/viewmodels/useAuthViewModel";

function AccountCard({
    account,
    roleLabel,
    onQuickLogin,
    onFill,
}: {
    account: DummyAccount;
    roleLabel: string;
    onQuickLogin: (userId: string) => void;
    onFill: (account: DummyAccount) => void;
}) {
    const { user } = account;

    return (
        <div className="border border-slate-200 rounded-lg p-3 bg-slate-50 flex flex-col gap-2">
            <div>
                <div className="font-semibold text-sm text-slate-900">
                    {user.name} ({roleLabel})
                </div>
                <div className="text-xs text-slate-600 mt-0.5">
                    Username: <code>{account.username}</code>
                    {user.email && (
                        <>
                            {" "}
                            · Email: <code>{user.email}</code>
                        </>
                    )}{" "}
                    · Password: <code>{account.password}</code>
                </div>
            </div>
            <div className="flex flex-wrap gap-2">
                <button
                    type="button"
                    className="primary px-3 py-1.5 text-xs font-semibold rounded-md border"
                    onClick={() => onQuickLogin(user.id)}
                >
                    Log in as {user.name}
                </button>
                <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded-md border border-slate-300 bg-white text-slate-800 hover:bg-slate-100"
                    onClick={() => onFill(account)}
                >
                    Fill credentials
                </button>
            </div>
        </div>
    );
}

export default function LoginView() {
    const { state: s, actions: a } = useAuthViewModel();

    return (
        <div className="min-h-dvh flex flex-col bg-slate-200 text-slate-900">
            <header className="bg-white border-b border-slate-300 px-4 py-3 flex items-center justify-between">
                <div className="brand">
                    <b>W</b> WiKahon
                </div>
                <span className="text-xs text-slate-600">
                    Active board profile: <strong>{s.activeProfileName}</strong>
                </span>
            </header>

            <main className="flex-1 flex items-center justify-center p-4">
                <div className="w-full max-w-4xl grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start">
                    <section
                        aria-labelledby="login-heading"
                        className="bg-white border border-slate-300 rounded-xl p-6 shadow-sm"
                    >
                        <h1 id="login-heading" className="text-xl font-bold text-slate-900">
                            Sign in to WiKahon
                        </h1>
                        <p className="text-sm text-slate-600 mt-1">
                            Log in as a child to use the essential AAC board, or as a guardian for full settings access.
                        </p>

                        <form
                            className="mt-5 space-y-4"
                            onSubmit={e => {
                                e.preventDefault();
                                a.login();
                            }}
                        >
                            <label className="block text-sm font-semibold text-slate-800">
                                Username or email
                                <input
                                    type="text"
                                    autoComplete="username"
                                    value={s.identifier}
                                    onChange={e => a.setIdentifier(e.target.value)}
                                    placeholder="e.g., kyle or lily"
                                    className="mt-1 w-full px-3 py-2 border border-slate-400 rounded-md bg-white text-slate-900 font-normal"
                                />
                            </label>

                            <label className="block text-sm font-semibold text-slate-800">
                                Password / PIN
                                <input
                                    type="password"
                                    autoComplete="current-password"
                                    value={s.password}
                                    onChange={e => a.setPassword(e.target.value)}
                                    placeholder="Enter password or PIN"
                                    className="mt-1 w-full px-3 py-2 border border-slate-400 rounded-md bg-white text-slate-900 font-normal"
                                />
                            </label>

                            {s.error && (
                                <p
                                    role="alert"
                                    className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-md px-3 py-2"
                                >
                                    {s.error}
                                </p>
                            )}

                            <button
                                type="submit"
                                className="primary w-full py-2.5 px-4 rounded-md font-semibold text-sm border"
                            >
                                Sign in
                            </button>
                        </form>
                    </section>

                    <div className="space-y-4">
                        <section
                            aria-labelledby="guardian-accounts-heading"
                            className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm"
                        >
                            <h2 id="guardian-accounts-heading" className="text-base font-bold text-slate-900">
                                Guardian Account
                            </h2>
                            <p className="text-xs text-slate-600 mt-0.5 mb-3">
                                Full unrestricted access to every toggle, layout setting, catalog, and tile editor.
                            </p>
                            <div className="grid gap-3">
                                {s.guardianAccounts.map(account => (
                                    <AccountCard
                                        key={account.user.id}
                                        account={account}
                                        roleLabel="Guardian"
                                        onQuickLogin={a.quickLogin}
                                        onFill={a.fillAccount}
                                    />
                                ))}
                            </div>
                        </section>

                        <section
                            aria-labelledby="child-accounts-heading"
                            className="bg-white border border-slate-300 rounded-xl p-5 shadow-sm"
                        >
                            <h2 id="child-accounts-heading" className="text-base font-bold text-slate-900">
                                Child Account
                            </h2>
                            <p className="text-xs text-slate-600 mt-0.5 mb-3">
                                Essential AAC communication board only. Reflects all guardian settings and toggles.
                            </p>
                            <div className="grid gap-3">
                                {s.childAccounts.map(account => (
                                    <AccountCard
                                        key={account.user.id}
                                        account={account}
                                        roleLabel="Child"
                                        onQuickLogin={a.quickLogin}
                                        onFill={a.fillAccount}
                                    />
                                ))}
                            </div>
                        </section>
                    </div>
                </div>
            </main>
        </div>
    );
}
