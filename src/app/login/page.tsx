"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { erpnext } from "@/lib/erpnext";
import { LogIn, Lock, User, AlertCircle, Clock } from "lucide-react";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Authenticate with ERPNext
            await erpnext.login(email, password);

            // 2. Fetch linked Employee record
            const employee = await erpnext.getEmployee(email);

            if (!employee) {
                throw new Error("No Employee record linked to this user in ERPNext.");
            }

            // Store session info
            localStorage.setItem("user_email", email);
            localStorage.setItem("employee_id", employee.name);
            localStorage.setItem("employee_name", employee.employee_name);
            localStorage.setItem("reports_to", employee.reports_to || "");
            localStorage.setItem("employee_image", employee.image || "");

            router.push("/");
        } catch (err: any) {
            setError(err.message || "Login failed. Check credentials.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-6 font-sans">
            <div className="w-full max-w-md space-y-8">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center shadow-xl shadow-blue-500/30 mx-auto">
                        <Clock className="text-white w-8 h-8" />
                    </div>
                    <div>
                        <h1 className="text-3xl font-extrabold tracking-tight">Welcome Back</h1>
                        <p className="text-slate-500 dark:text-zinc-400 font-medium">Log in with your ERPNext credentials</p>
                    </div>
                </div>

                <div className="bg-white dark:bg-zinc-900 p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Email / Username</label>
                            <div className="relative">
                                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="text"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="name@ihgind.com"
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-xs font-bold uppercase tracking-widest text-slate-400 px-1">Password</label>
                            <div className="relative">
                                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                                <input
                                    type="password"
                                    required
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-slate-50 dark:bg-zinc-800 border-none rounded-2xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-500 transition-all font-medium"
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-500/10 p-4 rounded-2xl text-rose-500 text-sm font-bold border border-rose-100 dark:border-rose-500/20">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <p>{error}</p>
                            </div>
                        )}

                        <button
                            disabled={loading}
                            className={`
                w-full bg-blue-600 hover:bg-blue-700 text-white rounded-2xl py-4 font-bold text-sm uppercase tracking-widest shadow-lg shadow-blue-500/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2
                ${loading ? "opacity-70 cursor-not-allowed" : ""}
              `}
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                <>
                                    <LogIn className="w-5 h-5" />
                                    Sign In
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Secure Access for ihgind Employees
                </p>
            </div>
        </div>
    );
}
