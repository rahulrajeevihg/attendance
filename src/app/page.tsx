"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { MapPin, Clock, LogIn, LogOut, CheckCircle2, AlertCircle, Map as MapIcon, ChevronDown, ChevronUp } from "lucide-react";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="h-48 w-full bg-slate-100 dark:bg-zinc-800 animate-pulse rounded-3xl flex items-center justify-center text-slate-400 font-medium">Loading Map...</div>
});

export default function Home() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isSecure, setIsSecure] = useState(true);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [status, setStatus] = useState<"IDLE" | "CHECKING_IN" | "CHECKED_IN" | "CHECKING_OUT">("IDLE");
  const [lastAction, setLastAction] = useState<{ type: string; time: Date } | null>(null);
  const [showMap, setShowMap] = useState(false);
  const [activities, setActivities] = useState<any[]>([
    { id: 1, type: "Check In", time: new Date(Date.now() - 36000000), lat: 25.1358, lng: 55.2411, status: "Approved" },
    { id: 2, type: "Check Out", time: new Date(Date.now() - 28000000), lat: 25.1401, lng: 55.2450, status: "Approved" }
  ]);
  const [historyMapLoc, setHistoryMapLoc] = useState<{ lat: number; lng: number } | null>(null);

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
      const watchId = navigator.geolocation.watchPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLocationError(null);
          navigator.geolocation.clearWatch(watchId);
        },
        (err) => {
          let msg = "Location access denied.";
          if (err.code === 1) msg = "Permission denied. Please enable GPS in settings.";
          else if (err.code === 2) msg = "Location unavailable. Check your signal.";
          else if (err.code === 3) msg = "Request timed out.";
          setLocationError(msg);
          console.error("Geolocation error:", err);
          navigator.geolocation.clearWatch(watchId);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setLocationError("Geolocation is not supported by your browser.");
    }
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

  const [loadingLandmark, setLoadingLandmark] = useState(false);

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

  const handleCheckIn = async () => {
    if (!location) return;
    setStatus("CHECKING_IN");
    setLoadingLandmark(true);

    const landmark = await fetchLandmark(location.lat, location.lng);

    setTimeout(() => {
      setStatus("CHECKED_IN");
      setLoadingLandmark(false);
      const newAction = { type: "Check-in", time: new Date() };
      setLastAction(newAction);
      setActivities(prev => [{
        id: Date.now(),
        type: "Check In",
        time: newAction.time,
        lat: location.lat,
        lng: location.lng,
        address: landmark,
        status: "Pending"
      }, ...prev]);
    }, 1500);
  };

  const handleCheckOut = async () => {
    if (!location) return;
    setStatus("CHECKING_OUT");
    setLoadingLandmark(true);

    const landmark = await fetchLandmark(location.lat, location.lng);

    setTimeout(() => {
      setStatus("IDLE");
      setLoadingLandmark(false);
      const newAction = { type: "Check-out", time: new Date() };
      setLastAction(newAction);
      setActivities(prev => [{
        id: Date.now(),
        type: "Check Out",
        time: newAction.time,
        lat: location.lat,
        lng: location.lng,
        address: landmark,
        status: "Pending"
      }, ...prev]);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 flex flex-col items-center p-4 sm:p-8 font-sans transition-colors duration-500 text-slate-900 dark:text-white">
      <header className="w-full max-w-md flex justify-between items-center mb-12">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/30">
            <Clock className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Attendance</h1>
            <a href="/hod" className="text-[10px] text-blue-500 font-bold hover:underline">HOD Portal</a>
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-medium text-slate-500 dark:text-zinc-400 capitalize">
            {currentTime.toLocaleDateString('en-US', { weekday: 'long' })}
          </p>
          <p className="text-lg font-bold">
            {currentTime.toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
      </header>

      <main className="w-full max-w-md space-y-6">
        {/* Status Card */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800 relative overflow-hidden transition-all hover:shadow-2xl hover:scale-[1.01] duration-300">
          <div className="absolute top-0 right-0 p-4">
            {location ? (
              <div className="flex items-center gap-1.5 bg-green-50 dark:bg-green-500/10 px-3 py-1 rounded-full border border-green-100 dark:border-green-500/20">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase tracking-wider">GPS Active</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-500/10 px-3 py-1 rounded-full border border-amber-100 dark:border-amber-500/20">
                <AlertCircle className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">No GPS</span>
              </div>
            )}
          </div>

          <div className="space-y-1">
            <p className="text-slate-500 dark:text-zinc-400 text-sm font-medium">Welcome back,</p>
            <h2 className="text-2xl font-bold">Rahul K.</h2>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4 transition-colors text-center">
              <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Last Action</p>
              <p className="text-sm font-bold">
                {lastAction ? lastAction.type : "No records today"}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">
                {lastAction ? lastAction.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-zinc-800/50 rounded-2xl p-4 transition-colors text-center">
              <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Current Shift</p>
              <p className="text-sm font-bold">
                General Shift
              </p>
              <p className="text-[10px] text-slate-500 dark:text-zinc-400 mt-1">09:00 AM - 06:00 PM</p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex flex-col items-center gap-6">
          <button
            onClick={status === "CHECKED_IN" ? handleCheckOut : handleCheckIn}
            disabled={status === "CHECKING_IN" || status === "CHECKING_OUT" || !location}
            className={`
              relative w-56 h-56 rounded-full flex flex-col items-center justify-center gap-3 transition-all duration-500 overflow-hidden
              ${status === "CHECKED_IN"
                ? "bg-rose-500 hover:bg-rose-600 shadow-2xl shadow-rose-500/40"
                : "bg-blue-600 hover:bg-blue-700 shadow-2xl shadow-blue-600/40"}
              ${(status === "CHECKING_IN" || status === "CHECKING_OUT" || !location) ? "opacity-60 grayscale cursor-not-allowed" : "active:scale-95"}
            `}
          >
            {/* Ripples */}
            <div className="absolute inset-0 bg-white/20 animate-ping opacity-20" />

            {(status === "CHECKING_IN" || status === "CHECKING_OUT") ? (
              <div className="w-12 h-12 border-4 border-white border-t-transparent rounded-full animate-spin" />
            ) : status === "CHECKED_IN" ? (
              <>
                <LogOut className="w-16 h-16 text-white" />
                <span className="text-xl font-bold text-white uppercase tracking-widest">Check Out</span>
              </>
            ) : (
              <>
                <LogIn className="w-16 h-16 text-white" />
                <span className="text-xl font-bold text-white uppercase tracking-widest">Check In</span>
              </>
            )}
          </button>

          {(!isSecure || locationError) && (
            <div className="w-full flex flex-col items-center gap-4">
              {!isSecure && (
                <div className="flex flex-col gap-2 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl w-full">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Insecure Context (HTTP)</span>
                  </div>
                  <p className="text-xs text-amber-500 dark:text-amber-500/80 leading-relaxed">
                    Browser security (SSL) is required for GPS. Please access via **HTTPS** or as a **Trusted PWA**.
                  </p>
                </div>
              )}
              {locationError && (
                <div className="flex items-center gap-2 text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 rounded-2xl text-sm font-medium border border-rose-100 dark:border-rose-500/20 w-full justify-center">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{locationError}</span>
                </div>
              )}
              <button
                onClick={requestLocation}
                className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-blue-600/30 active:scale-95 transition-all text-sm uppercase tracking-widest"
              >
                Enable Location Access
              </button>
            </div>
          )}

          {!locationError && location && (
            <div className="w-full flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowMap(!showMap);
                  setHistoryMapLoc(null); // Reset to live location
                }}
                className="flex items-center justify-between w-full bg-white dark:bg-zinc-900 px-4 py-3 rounded-2xl text-sm font-semibold border border-slate-100 dark:border-zinc-800 shadow-sm text-slate-700 dark:text-zinc-300 hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <MapIcon className="w-4 h-4 text-blue-500" />
                  <span>{historyMapLoc ? `Historical: ${historyMapLoc.lat.toFixed(4)}, ${historyMapLoc.lng.toFixed(4)}` : `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</span>
                </div>
                {showMap ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </button>

              {showMap && (
                <div className="h-64 w-full rounded-3xl overflow-hidden shadow-xl border-4 border-white dark:border-zinc-800 animate-in fade-in slide-in-from-top-4 duration-500">
                  <Map lat={historyMapLoc?.lat || location.lat} lng={historyMapLoc?.lng || location.lng} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Recent History Preview */}
        <div className="pt-4">
          <div className="flex justify-between items-center mb-4 px-2">
            <h3 className="text-sm font-bold uppercase tracking-wider">Recent Activity</h3>
            <button className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest hover:underline">View All</button>
          </div>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="bg-white dark:bg-zinc-900 p-4 rounded-2xl flex items-center justify-between border border-slate-100 dark:border-zinc-800 shadow-sm hover:border-blue-100 dark:hover:border-blue-900/30 transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-blue-50 dark:group-hover:bg-blue-950/30 transition-colors">
                    <CheckCircle2 className={`w-5 h-5 ${activity.type === "Check In" ? "text-green-500" : "text-rose-500"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold capitalize">{activity.type}</p>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 line-clamp-1 max-w-[150px]">
                      {activity.address || `Lat: ${activity.lat.toFixed(2)}, Lng: ${activity.lng.toFixed(2)}`}
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500">
                      {activity.time.toLocaleDateString([], { month: 'short', day: '2-digit', year: 'numeric' })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={() => {
                      setHistoryMapLoc({ lat: activity.lat, lng: activity.lng });
                      setShowMap(true);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="p-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-xl transition-colors text-blue-500"
                    title="View on Map"
                  >
                    <MapIcon className="w-4 h-4" />
                  </button>
                  <div className="text-right min-w-[70px]">
                    <p className="text-sm font-bold uppercase">{activity.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    <p className={`text-[10px] font-bold uppercase tracking-tighter ${activity.status === "Approved" ? "text-green-600" : "text-amber-500"}`}>
                      {activity.status}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer className="mt-auto py-8 text-center text-slate-400 dark:text-zinc-600 font-bold uppercase tracking-[0.2em] text-[10px]">
        Powered by ERPNext Harmony
      </footer>
    </div>
  );
}
