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
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-slate-100 dark:border-zinc-800 p-2 pb-8 grid grid-cols-5 items-center z-50">
            {tabs.map((tab) => {
                const Icon = tab.icon;

                if (tab.isFab) {
                    return (
                        <div key={tab.id} className="relative flex justify-center">
                            <button
                                onClick={onFabClick}
                                className="absolute -top-12 w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center shadow-xl shadow-blue-500/40 text-white transition-all active:scale-95 border-4 border-white dark:border-zinc-900 z-[60]"
                            >
                                <Plus className="w-10 h-10" />
                            </button>
                        </div>
                    );
                }

                const isActive = activeTab === tab.id;

                return (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400 dark:text-zinc-500'
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
