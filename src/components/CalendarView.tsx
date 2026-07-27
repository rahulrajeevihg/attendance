"use client";

import { useState, useEffect, useMemo } from "react";
import { ChevronLeft, ChevronRight, Clock, MapPin } from "lucide-react";
import { erpnext } from "@/lib/erpnext";

interface CalendarViewProps {
    employeeId: string;
    mobileLogs: any[];
    loadingMobileLogs: boolean;
    isManager: boolean;
}

export default function CalendarView({ employeeId, mobileLogs, loadingMobileLogs, isManager }: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(new Date().getDate());
    const [officialLogs, setOfficialLogs] = useState<any[]>([]);
    const [attendanceRows, setAttendanceRows] = useState<any[]>([]);
    const [loadingOfficialLogs, setLoadingOfficialLogs] = useState(false);
    const [monthCache, setMonthCache] = useState<Record<string, { officialLogs: any[]; attendanceRows: any[] }>>({});

    const getDateKey = (value?: string) => {
        if (!value) return "";
        const normalized = value.replace("T", " ");
        return normalized.slice(0, 10);
    };

    const monthKey = `${employeeId}-${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;

    const fetchLogs = async () => {
        const cached = monthCache[monthKey];
        if (cached) {
            setOfficialLogs(cached.officialLogs);
            setAttendanceRows(cached.attendanceRows);
            setLoadingOfficialLogs(false);
            return;
        }

        setLoadingOfficialLogs(true);
        try {
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth() + 1;
            const fromDate = `${year}-${String(month).padStart(2, '0')}-01 00:00:00`;
            const lastDay = new Date(year, month, 0).getDate();
            const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')} 23:59:59`;
            const fromDay = `${year}-${String(month).padStart(2, '0')}-01`;
            const toDay = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

            const [checkins, attendance] = await Promise.all([
                erpnext.getOfficialCheckins(employeeId, fromDate, toDate),
                erpnext.getAttendanceSummary(employeeId, fromDay, toDay),
            ]);
            setOfficialLogs(checkins);
            setAttendanceRows(attendance);
            setMonthCache((current) => ({
                ...current,
                [monthKey]: {
                    officialLogs: checkins,
                    attendanceRows: attendance,
                },
            }));
        } catch (err) {
            console.error("Calendar fetch error:", err);
        } finally {
            setLoadingOfficialLogs(false);
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
    }, [currentDate, employeeId, monthKey]);

    const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
    const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const padding = Array.from({ length: firstDayOfMonth }, (_, i) => i);

    const buildDayKey = (day: number) =>
        `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    const officialLogsByDay = useMemo(() => {
        const grouped: Record<string, any[]> = {};
        for (const log of officialLogs) {
            const key = getDateKey(log.time);
            if (!key) continue;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(log);
        }
        return grouped;
    }, [officialLogs]);

    const attendanceByDay = useMemo(() => {
        const grouped: Record<string, any> = {};
        for (const row of attendanceRows) {
            if (row.attendance_date) grouped[row.attendance_date] = row;
        }
        return grouped;
    }, [attendanceRows]);

    const getOfficialLogsForDay = (day: number) => officialLogsByDay[buildDayKey(day)] || [];

    const getMobileLogsForDay = (day: number) => {
        const dayKey = buildDayKey(day);
        return mobileLogs.filter((log) => getDateKey(log.checkin_time || log.time) === dayKey);
    };

    const selectedOfficialLogs = selectedDay ? getOfficialLogsForDay(selectedDay) : [];
    const selectedAttendance = selectedDay ? attendanceByDay[buildDayKey(selectedDay)] || null : null;
    const historyTitle = isManager ? "Team Mobile History" : "Mobile History";
    const historyEmptyText = isManager ? "No team mobile check-in history." : "No mobile check-in history.";

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
                        const dayOfficialLogs = getOfficialLogsForDay(day);
                        const totalLogCount = dayOfficialLogs.length;
                        const hasLogs = totalLogCount > 0;
                        const isToday = day === new Date().getDate() && currentDate.getMonth() === new Date().getMonth() && currentDate.getFullYear() === new Date().getFullYear();
                        const isSelected = selectedDay === day;

                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDay(day)}
                                className={`min-h-12 flex flex-col items-center justify-center rounded-2xl relative px-1 py-1 transition-all ${isSelected ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30 ring-2 ring-blue-400 ring-offset-2 dark:ring-offset-zinc-950' :
                                        isToday ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/5 ring-1 ring-blue-200 dark:ring-blue-500/20' :
                                            hasLogs ? 'bg-slate-50 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200' : 'text-slate-400 hover:bg-slate-50 dark:hover:bg-zinc-800'
                                    }`}
                            >
                                <span className="text-xs font-bold">{day}</span>
                                {hasLogs && (
                                    <div className="mt-0.5 flex max-w-full flex-wrap items-center justify-center gap-0.5">
                                        {Array.from({ length: totalLogCount }).map((_, i) => (
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
                {selectedDay && selectedAttendance && (
                    <div className="bg-white dark:bg-zinc-900 p-4 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Attendance Status</p>
                                <p className="mt-1 text-lg font-black tracking-tight text-slate-900 dark:text-white">
                                    {selectedAttendance.status || "Recorded"}
                                </p>
                            </div>
                            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                {selectedAttendance.attendance_date}
                            </span>
                        </div>
                    </div>
                )}
                {loadingOfficialLogs ? (
                    <div className="animate-pulse space-y-4">
                        {[1, 2].map(i => <div key={i} className="h-20 bg-white dark:bg-zinc-900 rounded-3xl" />)}
                    </div>
                ) : !selectedDay ? (
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-dashed border-slate-200 dark:border-zinc-800">
                        <p className="text-slate-400 text-sm font-medium">Click a date above to see entries.</p>
                    </div>
                ) : selectedOfficialLogs.length === 0 ? (
                    <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl text-center border border-dashed border-slate-200 dark:border-zinc-800">
                        <p className="text-slate-400 text-sm font-medium">No Employee Checkin logs for this day.</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {selectedOfficialLogs.slice().reverse().map((log: any) => (
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
                        ))}
                    </div>
                )}
            </div>

            <div className="space-y-4">
                <h3 className="text-lg font-bold px-2">{historyTitle}</h3>
                {loadingMobileLogs ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-28 w-full bg-slate-100 dark:bg-zinc-900 animate-pulse rounded-3xl" />
                        ))}
                    </div>
                ) : mobileLogs.length === 0 ? (
                    <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-zinc-800">
                        <p className="text-slate-400 font-medium">{historyEmptyText}</p>
                    </div>
                ) : (
                    mobileLogs.map((item: any) => (
                        <div key={item.name} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 space-y-4">
                            <div className="flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className={`w-2 h-8 rounded-full ${item.status === 'Approved' ? 'bg-green-500' :
                                        item.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-400'
                                        }`} />
                                    <div>
                                        <h4 className="font-bold text-sm tracking-tight">{item.log_type === 'IN' ? 'Check In' : 'Check Out'}</h4>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(item.checkin_time).toLocaleString()}</p>
                                        {isManager && (
                                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                                                {item.employee_name || item.employee}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <span className={`text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider ${item.status === 'Approved' ? 'bg-green-50 text-green-600 dark:bg-green-500/10' :
                                    item.status === 'Rejected' ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10' :
                                        'bg-amber-50 text-amber-600 dark:bg-amber-500/10'
                                    }`}>
                                    {item.status}
                                </span>
                            </div>
                            <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl flex items-start gap-2">
                                <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                                <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium leading-relaxed">{item.landmark || 'No address'}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
