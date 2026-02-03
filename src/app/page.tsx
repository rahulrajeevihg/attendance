"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  MapPin,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  User,
  History as HistoryIcon,
  Calendar as CalendarIcon,
  CheckCircle,
  Home as HomeIcon,
  XCircle
} from "lucide-react";

import { erpnext } from "@/lib/erpnext";
import { useRouter } from "next/navigation";

import BottomNav from "@/components/BottomNav";
import CalendarView from "@/components/CalendarView";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-48 w-full bg-slate-100 dark:bg-zinc-800 animate-pulse rounded-3xl flex items-center justify-center text-slate-400 font-medium">Loading Map...</div>
});

export default function Home() {
  const router = useRouter();
  const [employeeInfo, setEmployeeInfo] = useState<{ id: string; name: string; hod: string; isManager: boolean; image?: string } | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeTab, setActiveTab] = useState("dashboard"); // dashboard, history, approvals, calendar

  const [isSecure, setIsSecure] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [status, setStatus] = useState<"IDLE" | "CHECKING_IN" | "CHECKED_IN" | "CHECKING_OUT">("IDLE");
  const [lastAction, setLastAction] = useState<{ type: string; time: Date } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [loadingLandmark, setLoadingLandmark] = useState(false);
  const [myCheckins, setMyCheckins] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [teamCheckins, setTeamCheckins] = useState<any[]>([]);
  const [loadingTeamHistory, setLoadingTeamHistory] = useState(false);
  const [totalWorkTime, setTotalWorkTime] = useState(0); // in seconds
  const [activeStartTime, setActiveStartTime] = useState<Date | null>(null);

  const [pendingActivities, setPendingActivities] = useState<any[]>([]);
  const [empImages, setEmpImages] = useState<Record<string, string>>({});
  const [selectedApprovalMap, setSelectedApprovalMap] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);

  useEffect(() => {
    const email = localStorage.getItem("user_email");
    const id = localStorage.getItem("employee_id");
    const name = localStorage.getItem("employee_name");
    const hod = localStorage.getItem("reports_to");
    const image = localStorage.getItem("employee_image");

    if (!email || !id) {
      router.push("/login");
    } else {
      erpnext.isManager(id).then(isMgr => {
        const info = {
          id,
          name: name || "Employee",
          hod: hod || "",
          isManager: isMgr,
          image: image || ""
        };
        setEmployeeInfo(info);
        fetchEverything(id, isMgr);
      });
    }
  }, [router]);

  const fetchEverything = async (id: string, isManager: boolean) => {
    await fetchMyHistory(id);
    if (isManager) {
      await fetchTeamHistory(id);
      await fetchPendingApprovals(id);
    }
  };

  const fetchMyHistory = async (empId: string) => {
    setLoadingHistory(true);
    try {
      const data = await erpnext.getMyCheckins(empId);
      setMyCheckins(data);

      // Calculate today's status and duration
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaysLogs = data.filter((log: any) => new Date(log.checkin_time) >= today);

      // Determine if checked in (start timer even if pending)
      const lastLog = todaysLogs[0]; // Ordered by checkin_time desc
      if (lastLog && lastLog.log_type === 'IN' && lastLog.status !== 'Rejected') {
        setStatus("CHECKED_IN");
        setActiveStartTime(new Date(lastLog.checkin_time));
      } else {
        setStatus("IDLE");
        setActiveStartTime(null);
      }

      // Calculate total approved duration for today
      let totalSeconds = 0;
      const approvedTodaysLogs = todaysLogs.filter((l: any) => l.status === 'Approved').reverse();

      for (let i = 0; i < approvedTodaysLogs.length; i += 2) {
        const inLog = approvedTodaysLogs[i];
        const outLog = approvedTodaysLogs[i + 1];
        if (inLog && outLog && inLog.log_type === 'IN' && outLog.log_type === 'OUT') {
          totalSeconds += (new Date(outLog.checkin_time).getTime() - new Date(inLog.checkin_time).getTime()) / 1000;
        }
      }
      setTotalWorkTime(totalSeconds);

    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchTeamHistory = async (hodId: string) => {
    setLoadingTeamHistory(true);
    try {
      const data = await erpnext.getTeamCheckins(hodId);
      setTeamCheckins(data);
    } catch (error) {
      console.error("Failed to fetch team history:", error);
    } finally {
      setLoadingTeamHistory(false);
    }
  };

  const fetchPendingApprovals = async (hodId: string) => {
    setLoadingApprovals(true);
    try {
      const data = await erpnext.getPendingCheckins(hodId);
      const uniqueEmpIds = Array.from(new Set(data.map((i: any) => i.employee))) as string[];
      const imageMap = await erpnext.getEmployeeImages(uniqueEmpIds);
      setEmpImages(imageMap);

      const formatted = data.map((item: any) => ({
        id: item.name,
        name: item.employee,
        employee_name: item.employee_name,
        type: item.log_type === "IN" ? "Check In" : "Check Out",
        time: new Date(item.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        date: new Date(item.checkin_time).toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' }),
        lat: item.latitude,
        lng: item.longitude,
        address: item.landmark || "No address captured"
      }));
      setPendingActivities(formatted);
      setApprovalsError(null);
    } catch (err: any) {
      setApprovalsError("Failed to load activities from ERPNext");
      console.error(err);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm("Are you sure you want to delete this pending check-in?")) return;
    try {
      await erpnext.deleteCheckin(name);
      if (employeeInfo) fetchMyHistory(employeeInfo.id);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleApprovalAction = async (id: string, status: 'Approved' | 'Rejected') => {
    try {
      await erpnext.updateStatus(id, status);
      setPendingActivities(prev => prev.filter(a => a.id !== id));
    } catch (err) {
      alert(`Failed to ${status} activity`);
    }
  };

  const formatDuration = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const dayLogs = myCheckins.filter((log: any) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(log.checkin_time) >= today;
  });

  const getActiveDuration = () => {
    let seconds = totalWorkTime;
    if (activeStartTime) {
      seconds += (currentTime.getTime() - activeStartTime.getTime()) / 1000;
    }
    return formatDuration(seconds);
  };

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    if (typeof window !== "undefined") {
      setIsSecure(window.isSecureContext);
    }
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    requestLocation();
  }, []);

  const requestLocation = () => {
    setLocationError(null);
    if (typeof window !== "undefined") {
      setIsSecure(window.isSecureContext);
      if (!window.isSecureContext) {
        setLocationError("Insecure context. HTTPS is required for GPS on mobile.");
        return;
      }
    }

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
        },
        (err) => {
          let msg = "Location access denied.";
          if (err.code === 1) msg = "Permission denied. Please enable GPS in settings.";
          else if (err.code === 2) msg = "Location unavailable. Check your signal.";
          else if (err.code === 3) msg = "Request timed out.";
          setLocationError(msg);
          console.error("Geolocation error:", err);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
  };


  const fetchLandmark = async (lat: number, lng: number) => {
    try {
      const MAPBOX_TOKEN = 'pk.eyJ1IjoicmFodWxyYWplZXYzMTIiLCJhIjoiY21rODdtMjBwMTdqZTNjcjVlZDQwZnBlaSJ9.3uKDZg_IkLtHrKoELv7w0Q';
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${MAPBOX_TOKEN}&types=poi,address,neighborhood&limit=1`
      );
      const data = await response.json();
      return data.features?.[0]?.place_name || "Unknown Location";
    } catch (error) {
      console.error("Geocoding error:", error);
      return "Address unavailable";
    }
  };

  const handleAction = async (type: "IN" | "OUT") => {
    if (!location || !employeeInfo) {
      setLocationError("Location and Session are required.");
      return;
    }

    setStatus(type === "IN" ? "CHECKING_IN" : "CHECKING_OUT");
    setLoadingLandmark(true);

    try {
      const landmark = await fetchLandmark(location.lat, location.lng);
      const checkinTime = new Date();

      await erpnext.postCheckin({
        employee: employeeInfo.id,
        log_type: type,
        checkin_time: checkinTime.toISOString(),
        latitude: location.lat,
        longitude: location.lng,
        landmark: landmark,
        status: "Pending",
        hod: employeeInfo.hod
      });

      setStatus(type === "IN" ? "CHECKED_IN" : "IDLE");
      setLoadingLandmark(false);
      setShowMap(false);
      setLastAction({ type: type === "IN" ? "Check-in" : "Check-out", time: checkinTime });
      fetchMyHistory(employeeInfo.id);
    } catch (error: any) {
      console.error("ERPNext Sync Error:", error);
      setLocationError(`Sync Error: ${error.message}`);
      setStatus(type === "IN" ? "IDLE" : "CHECKED_IN");
      setLoadingLandmark(false);
    }
  };

  const renderContent = () => {
    if (!employeeInfo) return null;

    if (activeTab === 'calendar') {
      return <CalendarView employeeId={employeeInfo.id} />;
    }

    if (activeTab === 'approvals') {
      return (
        <div className="space-y-8 pb-20">
          {employeeInfo.isManager && (
            <div className="space-y-4">
              <div className="flex justify-between items-end px-2">
                <div>
                  <h3 className="text-xl font-bold">Team Approvals</h3>
                  <p className="text-sm text-slate-500 dark:text-zinc-400">Pending requests from your team</p>
                </div>
                <button
                  onClick={() => fetchPendingApprovals(employeeInfo.id)}
                  className="text-[10px] font-bold text-blue-600 uppercase tracking-widest hover:underline"
                >
                  Refresh
                </button>
              </div>

              {approvalsError && (
                <div className="bg-rose-50 dark:bg-rose-500/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-500/20 text-rose-500 text-sm font-medium flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  {approvalsError}
                </div>
              )}

              {selectedApprovalMap && (
                <div className="bg-white dark:bg-zinc-900 rounded-3xl p-4 shadow-xl border border-blue-100 dark:border-blue-900/30 animate-in fade-in zoom-in duration-300">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold">{selectedApprovalMap.name}'s Location</span>
                    </div>
                    <button onClick={() => setSelectedApprovalMap(null)} className="text-[10px] font-bold text-rose-500 uppercase tracking-widest">Close Map</button>
                  </div>
                  <div className="h-64 w-full rounded-2xl overflow-hidden border border-slate-100 dark:border-zinc-800">
                    <Map lat={selectedApprovalMap.lat} lng={selectedApprovalMap.lng} />
                  </div>
                </div>
              )}

              <div className="space-y-4">
                {loadingApprovals ? (
                  <div className="space-y-4">
                    {[1, 2].map(i => (
                      <div key={i} className="h-48 w-full bg-slate-100 dark:bg-zinc-900 animate-pulse rounded-3xl" />
                    ))}
                  </div>
                ) : pendingActivities.length === 0 ? (
                  <div className="text-center py-16 bg-white dark:bg-zinc-900 rounded-3xl border border-dashed border-slate-200 dark:border-zinc-800">
                    <CheckCircle2 className="w-12 h-12 text-green-500/30 mx-auto mb-4" />
                    <p className="text-slate-400 font-medium">All caught up!</p>
                  </div>
                ) : (
                  pendingActivities.map(activity => (
                    <div key={activity.id} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center overflow-hidden border border-slate-100 dark:border-zinc-800 shadow-sm">
                            {empImages[activity.name] ? (
                              <img
                                src={empImages[activity.name]}
                                alt={activity.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <User className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <h4 className="font-bold text-lg">{activity.employee_name || activity.name}</h4>
                            <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                              <Clock className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">{activity.type} - {activity.time}</span>
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => setSelectedApprovalMap({ lat: activity.lat, lng: activity.lng, name: activity.name })}
                          className="p-3 bg-blue-50 dark:bg-blue-900/10 text-blue-600 dark:text-blue-400 rounded-2xl hover:bg-blue-100 transition-colors shadow-sm"
                        >
                          <MapIcon className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="bg-slate-50 dark:bg-zinc-800/50 p-3 rounded-2xl mb-4 flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5" />
                        <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium leading-relaxed line-clamp-2">
                          {activity.address}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <button
                          onClick={() => handleApprovalAction(activity.id, 'Rejected')}
                          className="flex items-center justify-center gap-2 py-3 bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 rounded-2xl font-bold text-xs uppercase tracking-widest hover:bg-rose-100 transition-all active:scale-95"
                        >
                          <XCircle className="w-4 h-4" />
                          Reject
                        </button>
                        <button
                          onClick={() => handleApprovalAction(activity.id, 'Approved')}
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
            </div>
          )}

          <div className="space-y-4">
            <h3 className="text-lg font-bold px-2 text-slate-900 dark:text-white">My Pending Mobile Logs</h3>
            {myCheckins.filter(c => c.status === 'Pending').length === 0 ? (
              <div className="text-center py-10 bg-white dark:bg-zinc-900 rounded-[2rem] border border-dashed border-slate-200 dark:border-zinc-800">
                <p className="text-slate-400 text-sm font-medium">No pending mobile logs.</p>
              </div>
            ) : (
              myCheckins.filter(c => c.status === 'Pending').map((item: any) => (
                <div key={item.name} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-2xl bg-amber-50 dark:bg-amber-500/10 text-amber-500 flex items-center justify-center">
                      <Clock className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-sm tracking-tight">{item.log_type === 'IN' ? 'Check In' : 'Check Out'}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {new Date(item.checkin_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Pending</div>
                    <button
                      onClick={() => handleDelete(item.name)}
                      className="p-2 hover:bg-rose-50 text-rose-400 rounded-xl transition-colors"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'history') {
      const isManager = employeeInfo.isManager;
      const historyItems = isManager ? teamCheckins : myCheckins;
      const isLoading = isManager ? loadingTeamHistory : loadingHistory;
      const emptyText = isManager ? "No team mobile check-in history." : "No mobile check-in history.";
      return (
        <div className="space-y-6 pb-24">
          <h2 className="text-2xl font-bold px-2">{isManager ? "Team Mobile History" : "Mobile History"}</h2>
          <div className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-28 w-full bg-slate-100 dark:bg-zinc-900 animate-pulse rounded-3xl" />
                ))}
              </div>
            ) : historyItems.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-zinc-800">
                <p className="text-slate-400 font-medium">{emptyText}</p>
              </div>
            ) : (
              historyItems.map((item: any) => (
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

    // Default: Dashboard
    return (
      <div className="w-full space-y-10 pb-24">
        <div className="flex flex-col items-center">
          <div className="w-44 h-44 bg-white dark:bg-zinc-900 rounded-[4rem] shadow-2xl shadow-blue-500/10 flex items-center justify-center mb-8 border border-slate-100 dark:border-zinc-800 relative group transition-transform hover:scale-105 duration-500">
            <Clock className={`w-20 h-20 ${status === 'CHECKED_IN' ? 'text-green-500' : 'text-blue-600'} group-hover:rotate-12 transition-transform duration-500`} />
            <div className={`absolute inset-0 bg-blue-600/5 rounded-[4rem] animate-ping opacity-20 ${status === 'CHECKED_IN' ? 'bg-green-600/5' : ''}`} />
          </div>

          <div className="space-y-3 text-center">
            <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">Total Hours Today</p>
            <h2 className="text-6xl font-black tracking-tighter font-mono">
              {getActiveDuration()}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em]">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800">
          <div className="flex justify-between items-center px-2 mb-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-800 dark:text-zinc-200">Today's Logs</h3>
            <button
              onClick={() => employeeInfo && fetchMyHistory(employeeInfo.id)}
              className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline"
            >
              Sync Now
            </button>
          </div>

          <div className="space-y-3">
            {dayLogs.length === 0 ? (
              <p className="text-center py-6 text-slate-400 text-xs font-bold uppercase tracking-widest">No logs yet today</p>
            ) : (
              dayLogs.map((log: any) => (
                <div key={log.name} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-2xl border border-slate-100/50 dark:border-zinc-800/50 group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.log_type === 'IN' ? 'bg-green-100 text-green-600' : 'bg-rose-100 text-rose-600'}`}>
                      {log.log_type === 'IN' ? <LogIn className="w-5 h-5" /> : <LogOut className="w-5 h-5" />}
                    </div>
                    <div>
                      <p className="font-bold text-sm tracking-tight">{log.log_type === 'IN' ? 'Check In' : 'Check Out'}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(log.checkin_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-[9px] font-black px-2 py-1 rounded-full uppercase tracking-tighter ${log.status === 'Approved' ? 'bg-green-500 text-white' :
                      log.status === 'Rejected' ? 'bg-rose-500 text-white' : 'bg-amber-400 text-white'
                      }`}>
                      {log.status}
                    </span>
                    {log.status === 'Pending' && (
                      <button
                        onClick={() => handleDelete(log.name)}
                        className="p-2 hover:bg-rose-50 text-rose-400 rounded-xl transition-colors"
                        title="Discard Log"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="px-6 text-center">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed italic opacity-60">
            "Work with intent. Precision in every second."
          </p>
        </div>
      </div>
    );
  };

  if (!employeeInfo) return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center justify-center p-8">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center p-4 sm:p-8 font-sans transition-colors duration-500 text-slate-900 dark:text-white pb-32">
      <header className="w-full max-w-md flex justify-between items-center mb-12 animate-in fade-in slide-in-from-top duration-700">
        <div className="space-y-1">
          <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-[0.2em]">Employee Console</p>
          <h1 className="text-2xl font-black tracking-tight">{employeeInfo.name}</h1>
        </div>
        <button onClick={() => { localStorage.clear(); router.push('/login'); }} className="relative group">
          <div className="w-12 h-12 rounded-2xl overflow-hidden border-2 border-white dark:border-zinc-800 shadow-lg group-hover:scale-105 transition-transform duration-300">
            {employeeInfo.image ? (
              <img
                src={`https://erp.ihgind.com${employeeInfo.image}`}
                alt={employeeInfo.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-slate-100 dark:bg-zinc-800 flex items-center justify-center">
                <User className="w-6 h-6 text-blue-500" />
              </div>
            )}
          </div>
          <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white dark:border-zinc-950 rounded-full" />
        </button>
      </header>

      <main className="w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-1000">
        {renderContent()}
      </main>

      {showMap && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-300">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowMap(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-zinc-900 rounded-t-[3.5rem] sm:rounded-[4rem] p-8 shadow-2xl overflow-hidden animate-in slide-in-from-bottom duration-500">
            <div className="w-12 h-1.5 bg-slate-100 dark:bg-zinc-800 rounded-full mx-auto mb-8 sm:hidden" />

            <div className="flex justify-between items-center mb-8">
              <h3 className="text-2xl font-black">Sync Location</h3>
              <button onClick={() => setShowMap(false)} className="bg-slate-50 dark:bg-zinc-800 p-3 rounded-full hover:rotate-90 transition-transform duration-300">
                <Clock className="w-6 h-6 rotate-45 text-slate-400" />
              </button>
            </div>

            <div className="h-64 w-full rounded-[3rem] overflow-hidden border border-slate-100 dark:border-zinc-800 mb-8 relative">
              <Map lat={location?.lat || 25.2048} lng={location?.lng || 55.2708} />
              {!location && (
                <div className="absolute inset-0 bg-white/50 dark:bg-zinc-900/50 flex items-center justify-center backdrop-blur-sm">
                  <span className="font-bold text-xs uppercase tracking-widest text-blue-600 animate-pulse">Locating...</span>
                </div>
              )}
            </div>

            {locationError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 p-5 rounded-3xl mb-8 text-rose-500 text-sm font-bold flex items-center gap-3 border border-rose-100 dark:border-rose-500/20">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <span>{locationError}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-6">
              <button
                onClick={() => handleAction("IN")}
                disabled={status === "CHECKING_IN" || status === "CHECKED_IN" || !location}
                className={`flex flex-col items-center gap-3 py-8 rounded-[3rem] font-black text-xs uppercase tracking-widest transition-all ${status === "CHECKED_IN" ? "bg-slate-50 text-slate-300 dark:bg-zinc-800/50 cursor-not-allowed" :
                  "bg-blue-600 text-white shadow-xl shadow-blue-500/30 active:scale-95"
                  }`}
              >
                {status === "CHECKING_IN" ? <span className="animate-spin text-3xl">⏳</span> : <LogIn className="w-10 h-10 mb-2" />}
                Check In
              </button>
              <button
                onClick={() => handleAction("OUT")}
                disabled={status === "CHECKING_OUT" || status === "IDLE" || !location}
                className={`flex flex-col items-center gap-3 py-8 rounded-[3rem] font-black text-xs uppercase tracking-widest transition-all ${status === "IDLE" ? "bg-slate-50 text-slate-300 dark:bg-zinc-800/50 cursor-not-allowed" :
                  "bg-rose-600 text-white shadow-xl shadow-rose-500/30 active:scale-95"
                  }`}
              >
                {status === "CHECKING_OUT" ? <span className="animate-spin text-3xl">⏳</span> : <LogOut className="w-10 h-10 mb-2" />}
                Check Out
              </button>
            </div>
            {loadingLandmark && (
              <p className="text-center mt-6 text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] animate-pulse">
                Verifying Reverse Geocode...
              </p>
            )}
          </div>
        </div>
      )}

      <BottomNav
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onFabClick={() => {
          setShowMap(true);
          requestLocation();
        }}
        isManager={employeeInfo.isManager}
      />
    </div>
  );
}
