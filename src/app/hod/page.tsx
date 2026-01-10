"use client";

import { useState } from "react";
import { CheckCircle2, XCircle, Map as MapIcon, ChevronLeft, User, Clock, MapPin } from "lucide-react";
import dynamic from "next/dynamic";

const Map = dynamic(() => import("@/components/Map"), {
    ssr: false,
    loading: () => <div className="h-48 w-full bg-slate-100 dark:bg-zinc-800 animate-pulse rounded-3xl flex items-center justify-center text-slate-400 font-medium">Loading Map...</div>
});

export default function HODDashboard() {
    const [pendingActivities, setPendingActivities] = useState([
        { id: 101, name: "Rahul K.", type: "Check In", time: "09:12 AM", date: "Jan 10, 2026", lat: 25.1358, lng: 55.2411, address: "Business Bay, Dubai, UAE" },
        { id: 102, name: "Sarah M.", type: "Check In", time: "08:45 AM", date: "Jan 10, 2026", lat: 25.1972, lng: 55.2744, address: "Downtown Dubai, UAE" },
        { id: 103, name: "James L.", type: "Check Out", time: "05:30 PM", date: "Jan 09, 2026", lat: 25.0781, lng: 55.1358, address: "Dubai Marina, UAE" },
    ]);

    const [selectedMap, setSelectedMap] = useState<{ lat: number; lng: number; name: string } | null>(null);

    const handleApprove = (id: number) => {
        setPendingActivities(prev => prev.filter(a => a.id !== id));
    };

    const handleReject = (id: number) => {
        setPendingActivities(prev => prev.filter(a => a.id !== id));
    };

    return (
        <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center p-4 sm:p-8 transition-colors duration-500 text-slate-900 dark:text-white font-sans">
            <header className="w-full max-w-md flex justify-between items-center mb-8">
                <a href="/" className="flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors">
                    <ChevronLeft className="w-5 h-5" />
                    <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                </a>
                <div className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-blue-500/30">
                    Admin / HOD
                </div>
            </header>

            <main className="w-full max-w-md space-y-6">
                <div className="mb-2">
                    <h2 className="text-2xl font-bold">Pending Approvals</h2>
                    <p className="text-sm text-slate-500 dark:text-zinc-400">Review check-in activity for your team.</p>
                </div>

                {selectedMap && (
                    <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 shadow-xl border border-blue-100 dark:border-blue-900/30 animate-in fade-in zoom-in duration-300">
                        <div className="flex justify-between items-center mb-4 px-2">
                            <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-bold">{selectedMap.name}'s Location</span>
                            </div>
                            <button onClick={() => setSelectedMap(null)} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Close Map</button>
                        </div>
                        <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-zinc-800">
                            <Map lat={selectedMap.lat} lng={selectedMap.lng} />
                        </div>
                    </div>
                )}

                <div className="space-y-4">
                    {pendingActivities.length === 0 ? (
                        <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                            <CheckCircle2 className="w-12 h-12 text-green-500/30 mx-auto mb-4" />
                            <p className="text-slate-400 font-medium">All caught up!</p>
                        </div>
                    ) : (
                        pendingActivities.map(activity => (
                            <div key={activity.id} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center">
                                            <User className="w-6 h-6 text-slate-400" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-lg">{activity.name}</h4>
                                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                                                <Clock className="w-3 h-3" />
                                                <span className="text-[10px] font-bold uppercase tracking-wider">{activity.type} • {activity.time}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setSelectedMap({ lat: activity.lat, lng: activity.lng, name: activity.name })}
                                        className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl hover:bg-blue-100 transition-colors shadow-sm"
                                    >
                                        <MapIcon className="w-5 h-5" />
                                    </button>
                                </div>

                                <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl mb-4 flex items-start gap-2">
                                    <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                                    <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">
                                        Captured: {activity.address}
                                    </p>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <button
                                        onClick={() => handleReject(activity.id)}
                                        className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Reject
                                    </button>
                                    <button
                                        onClick={() => handleApprove(activity.id)}
                                        className="flex items-center justify-center gap-2 py-3 bg-green-50 text-green-600 dark:bg-green-500/10 dark:text-green-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-green-100 transition-all active:scale-95 border border-green-100 dark:border-green-500/20"
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        Approve
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </main>

            <footer className="mt-auto py-8 text-center text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-[0.2em] text-[10px]">
                HOD Approval System • ihgind
            </footer>
        </div>
    );
}
