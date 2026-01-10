"use client";

import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { erpnext } from "@/lib/erpnext";

interface CalendarViewProps {
    employeeId: string;
}

export default function CalendarView({ employeeId }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
            const lastDay = new Date(year, month, 0).getDate();
            const toDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

            const data = await erpnext.getOfficialCheckins(employeeId, fromDate, toDate);
            setLogs(data);
        } catch (err) {
            console.error("Calendar fetch error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchLogs();
        // Default to today if current month matches
        const today = new Date();
        if (currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear()) {
            setSelectedDay(today.getDate());
        } else {
            setSelectedDay(null);
        }
    }, [currentDate, employeeId]);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const getLogsForDay = (day: number) => {
        const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        return logs.filter(log => log.time.startsWith(dateStr));
    };

    const selectedLogs = selectedDay ? getLogsForDay(selectedDay) : [];

    return (
        <div className="w-full max-w-md mx-auto space-y-6 pb-24">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Attendance</h2>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <span className="font-bold text-sm uppercase tracking-widest min-w-[120px] text-center">
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                    </span>
                    <button
                        onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                    >
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>
            </div>

            <div className="bg-white dark:bg-zinc-900 rounded-[2.5rem] p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800">
                <div className="grid grid-cols-7 gap-1 mb-4 text-center">
                    {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(day => (
                        <span key={day} className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">{day}</span>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-2">
                    {padding.map(i => <div key={`p-${i}`} className="h-10" />)}
                    {days.map(day => {
                        const dayLogs = getLogsForDay(day);
                        const hasLogs = dayLogs.length > 0;
                        const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                        const isSelected = selectedDay === day;

                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`h-12 flex flex-col items-center justify-center rounded-2xl relative transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-zinc-950' :
                                        isToday ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/5 ring-1 ring-blue-200 dark:ring-blue-500/20' :
                                            hasLogs ? 'bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                <span className="text-xs font-bold">{day}</span>
                                {hasLogs && (
                                    <div className="flex gap-0.5 mt-0.5">
                                        {dayLogs.map((_, i) => (
                                            <div key={i} className={`w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-blue-500'}`} />
                                        ))}
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold px-2">
                    {selectedDay
                        ? `Logs for ${currentDate.toLocaleString('default', { month: 'short' })} ${selectedDay}`
                        : "Select a day to view details"}
                </h3>
                {loading ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2].map(i => <div key={i} className="h-20 bg-white dark:bg-zinc-900 rounded-3xl" />)}
                    </div>
                ) : !selectedDay ? (
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-dashed border-slate-200 dark:border-zinc-800">
                        <p className="text-slate-400 text-sm font-medium">Click a date above to see entries.</p>
                    </div>
                ) : selectedLogs.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-dashed border-slate-200 dark:border-zinc-800">
                        <p className="text-slate-400 text-sm font-medium">No verified logs for this day.</p>
                    </div>
                ) : (
                    selectedLogs.slice().reverse().map((log: any) => (
                        <div key={log.name} className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${log.log_type === 'IN' ? 'bg-green-50 text-green-600 dark:bg-green-500/10' : 'bg-rose-50 text-rose-600 dark:bg-rose-500/10'
                                    }`}>
                                    <Clock className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">{log.log_type === 'IN' ? 'Check In' : 'Check Out'}</h4>
                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                        {new Date(log.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {new Date(log.time).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                    </p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="bg-slate-50 dark:bg-zinc-800 px-3 py-1 rounded-full flex items-center gap-1.5">
                                    <MapPin className="w-3 h-3 text-slate-400" />
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Verified</span>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
