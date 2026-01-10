"use client";

import { Home, History, CheckCircle, Calendar, Plus } from "lucide-react";

interface BottomNavProps {
    activeTab: string;
    setActiveTab: (tab: string) => void;
    onFabClick: () => void;
    isManager: boolean;
}

export default function BottomNav({ activeTab, setActiveTab, onFabClick, isManager }: BottomNavProps) {
    const tabs = [
        { id: 'dashboard', label: 'Home', icon: Home },
        { id: 'history', label: 'History', icon: History },
        { id: 'fab', label: '', icon: Plus, isFab: true },
        { id: 'approvals', label: 'Approvals', icon: CheckCircle },
        { id: 'calendar', label: 'Calendar', icon: Calendar },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 px-6 py-3 pb-8 flex justify-between items-center z-50">
            {tabs.map((tab) => {
                const Icon = tab.icon;

                if (tab.isFab) {
                    return (
                        <button
                            key={tab.id}
                            onClick={onFabClick}
                            className="absolute left-1/2 -translate-x-1/2 -top-6 w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/40 text-white transition-transform active:scale-90 border-4 border-white dark:border-zinc-900"
                        >
                            <Plus className="w-8 h-8" />
                        </button>
                    );
                }

                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 dark:text-zinc-500'
                            }`}
                    >
                        <Icon className={`w-6 h-6 ${isActive ? 'fill-blue-600/10' : ''}`} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">{tab.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}
