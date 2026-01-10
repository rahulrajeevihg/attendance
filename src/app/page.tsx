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
  Home as HomeIcon
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
        setEmployeeInfo({
          id,
          name: name || "Employee",
          hod: hod || "",
          isManager: isMgr,
          image: image || ""
        });
      });
      fetchMyHistory(id);
    }
  }, [router]);

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

  const fetchMyHistory = async (empId: string) => {
    setLoadingHistory(true);
    try {
      const data = await erpnext.getMyCheckins(empId);
      setMyCheckins(data);
    } catch (error) {
      console.error("Failed to fetch history:", error);
    } finally {
      setLoadingHistory(false);
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
            <div className="bg-blue-600 rounded-[2.5rem] p-6 text-white shadow-xl shadow-blue-500/20">
              <h3 className="text-xl font-bold mb-2">Team Approvals</h3>
              <p className="text-sm opacity-80 mb-4">You have pending requests from your team.</p>
              <button
                onClick={() => router.push('/hod')}
                className="bg-white text-blue-600 px-6 py-3 rounded-2xl font-bold text-xs uppercase tracking-widest shadow-lg"
              >
                Open HOD Portal
              </button>
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
                      <h4 className="font-bold text-sm">{item.log_type === 'IN' ? 'Check In' : 'Check Out'}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        {new Date(item.checkin_time).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                  <div className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">Pending</div>
                </div>
              ))
            )}
          </div>
        </div>
      );
    }

    if (activeTab === 'history') {
      return (
        <div className="space-y-6 pb-24">
          <h2 className="text-2xl font-bold px-2">Mobile History</h2>
          <div className="space-y-4">
            {myCheckins.length === 0 ? (
              <div className="text-center py-20 bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-zinc-800">
                <p className="text-slate-400 font-medium">No mobile check-in history.</p>
              </div>
            ) : (
              myCheckins.map((item: any) => (
                <div key={item.name} className="bg-white dark:bg-zinc-900 p-5 rounded-3xl shadow-sm border border-slate-100 dark:border-zinc-800 space-y-4">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-8 rounded-full ${item.status === 'Approved' ? 'bg-green-500' :
                        item.status === 'Rejected' ? 'bg-rose-500' : 'bg-amber-400'
                        }`} />
                      <div>
                        <h4 className="font-bold text-sm tracking-tight">{item.log_type === 'IN' ? 'Check In' : 'Check Out'}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(item.checkin_time).toLocaleString()}</p>
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
      <div className="w-full space-y-12 pb-24 text-center">
        <div className="flex flex-col items-center">
          <div className="w-48 h-48 bg-white dark:bg-zinc-900 rounded-[4rem] shadow-2xl shadow-blue-500/10 flex items-center justify-center mb-8 border border-slate-100 dark:border-zinc-800 relative group transition-transform hover:scale-105 duration-500">
            <Clock className="w-24 h-24 text-blue-600 group-hover:rotate-12 transition-transform duration-500" />
            <div className="absolute inset-0 bg-blue-600/5 rounded-[4rem] animate-ping opacity-20" />
          </div>

          <div className="space-y-4">
            <p className="text-slate-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-[0.3em]">DAILY OVERVIEW</p>
            <h2 className="text-5xl font-extrabold tracking-tight">
              {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </h2>
            <div className="flex items-center justify-center gap-2">
              <span className="text-sm font-bold text-slate-400 uppercase tracking-widest">
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-8 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800">
          <div className="flex justify-between items-center px-2">
            <div className="text-left">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">CURRENT STATUS</p>
              <p className={`text-lg font-bold ${status === 'CHECKED_IN' ? 'text-green-500' : 'text-slate-400'}`}>
                {status === "CHECKED_IN" ? "Currently On-Shift" : "Inactive"}
              </p>
            </div>
            {lastAction && (
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">LAST LOG</p>
                <p className="text-sm font-bold">{lastAction.type} • {lastAction.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 px-4">
          <p className="text-slate-400 text-xs font-medium leading-relaxed italic">
            "Tap the + button to capture your location and log your activity."
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
