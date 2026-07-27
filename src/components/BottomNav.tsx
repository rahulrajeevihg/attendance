"use client";

import { Home, CheckCircle, Calendar, Plus, Wallet } from "lucide-react";

interface BottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onFabClick: () => void;
    isManager: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, onFabClick, isManager }: BottomNavProps) {
    const tabs = [
        { id: 'dashboard', label: 'Home', icon: Home },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
        { id: 'spacer', label: '', icon: Plus, isSpacer: true },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle },
        { id: 'salary', label: 'Salary', icon: Wallet },
    ];

    return (
        <nav
            className="fixed inset-x-0 bottom-0 w-screen max-w-none bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 px-0 pt-2 flex items-stretch z-[100]"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 0.75rem)" }}
        >
            <button
                onClick={onFabClick}
                className="absolute left-1/2 -translate-x-1/2 -top-12 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/40 text-white transition-all active:scale-95 border-4 border-white dark:border-zinc-900 z-[60]"
            >
                <Plus className="w-10 h-10" />
            </button>
            {tabs.map((tab) => {
                const Icon = tab.icon;

                if (tab.isSpacer) {
                    return (
                        <div key={tab.id} aria-hidden="true" className="h-10 flex-1" />
                    );
                }

                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-1 h-full w-full flex-col items-center justify-center gap-1 py-2 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 dark:text-zinc-500'
                            }`}
                    >
                        <Icon className={`w-5 h-5 ${isActive ? 'fill-blue-600/10' : ''}`} />
                        <span className="text-[9px] font-bold uppercase tracking-tight truncate w-full text-center">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
