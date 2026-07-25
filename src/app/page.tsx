"use client";

import { useState, useEffect } from "react";
import {
  MapPin,
  Clock,
  LogIn,
  LogOut,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Map as MapIcon,
  Briefcase,
  User,
  MoonStar,
  XCircle
} from "lucide-react";

import { AttendanceRecord, erpnext, OvertimeAllocationRecord, SalarySlipComponent, SalarySlipDetail } from "@/lib/erpnext";
import { useRouter } from "next/navigation";

import BottomNav from "@/components/BottomNav";
import CalendarView from "@/components/CalendarView";
import Map from "@/components/Map";

export default function Home() {
  type KpiPeriodKey = "thisMonth" | "previousMonth";
  type MonthlyKpi = {
    present: number;
    absent: number;
    onLeave: number;
    otMinutes: number;
  };
  type OfficialCheckinRecord = {
    name?: string;
    log_type?: string;
    time?: string;
  };

  const today = new Date();
  const router = useRouter();
  const [employeeInfo, setEmployeeInfo] = useState<{ id: string; name: string; hod: string; isManager: boolean; image?: string } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
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
  const [todayOfficialCheckins, setTodayOfficialCheckins] = useState<OfficialCheckinRecord[]>([]);
  const [teamCheckins, setTeamCheckins] = useState<any[]>([]);
  const [loadingTeamHistory, setLoadingTeamHistory] = useState(false);
  const [totalWorkTime, setTotalWorkTime] = useState(0); // in seconds
  const [activeStartTime, setActiveStartTime] = useState<Date | null>(null);

  const [pendingActivities, setPendingActivities] = useState<any[]>([]);
  const [empImages, setEmpImages] = useState<Record<string, string>>({});
  const [selectedApprovalMap, setSelectedApprovalMap] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [loadingApprovals, setLoadingApprovals] = useState(false);
  const [approvalsError, setApprovalsError] = useState<string | null>(null);
  const [previousPendingCount, setPreviousPendingCount] = useState(0);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const [isOnline, setIsOnline] = useState(true);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [selectedKpiPeriod, setSelectedKpiPeriod] = useState<KpiPeriodKey>("thisMonth");
  const [monthlyKpis, setMonthlyKpis] = useState<Record<KpiPeriodKey, MonthlyKpi>>({
    thisMonth: { present: 0, absent: 0, onLeave: 0, otMinutes: 0 },
    previousMonth: { present: 0, absent: 0, onLeave: 0, otMinutes: 0 },
  });
  const [loadingKpis, setLoadingKpis] = useState(false);
  const [selectedSalaryYear, setSelectedSalaryYear] = useState(today.getFullYear());
  const [selectedSalaryMonth, setSelectedSalaryMonth] = useState(today.getMonth() + 1);
  const [salarySlip, setSalarySlip] = useState<SalarySlipDetail | null>(null);
  const [loadingSalarySlips, setLoadingSalarySlips] = useState(false);
  const [salaryError, setSalaryError] = useState<string | null>(null);
  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

  const calculateTodayWorkSummary = (logs: OfficialCheckinRecord[]) => {
    const sortedLogs = [...logs]
      .filter((log) => log.time && log.log_type)
      .sort((a, b) => new Date(a.time as string).getTime() - new Date(b.time as string).getTime());

    let totalSeconds = 0;
    let openInTime: Date | null = null;

    for (const log of sortedLogs) {
      const logTime = new Date(log.time as string);
      const normalizedLogType = (log.log_type || "").trim().toUpperCase();

      if (normalizedLogType === "IN") {
        openInTime = logTime;
      } else if (normalizedLogType === "OUT" && openInTime) {
        totalSeconds += Math.max(0, (logTime.getTime() - openInTime.getTime()) / 1000);
        openInTime = null;
      }
    }

    return {
      totalSeconds,
      activeStartTime: openInTime,
      isCheckedIn: Boolean(openInTime),
    };
  };

  // Register service worker on mount
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => {
        registration.unregister();
      });
    }).catch((error) => console.error('[App] Service Worker cleanup failed:', error));

    if ("caches" in window) {
      caches.keys().then((cacheNames) => {
        cacheNames.forEach((cacheName) => {
          caches.delete(cacheName);
        });
      }).catch((error) => console.error('[App] Cache cleanup failed:', error));
    }
  }, []);

  // Monitor online/offline status
  useEffect(() => {
    const updateOnlineStatus = () => {
      setIsOnline(navigator.onLine);
      if (navigator.onLine) {
        console.log('[App] Back online! Triggering sync...');
        // Trigger background sync
        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.ready.then(reg => {
            // Type guard for sync API
            if ('sync' in reg) {
              return (reg as any).sync.register('sync-checkins');
            }
          }).catch(err => console.error('[App] Sync registration failed:', err));
        }
      }
    };

    setIsOnline(navigator.onLine);
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, []);

  // Listen for service worker messages (sync events)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'SYNC_START') {
          console.log('[App] Sync started:', event.data.count, 'items');
        } else if (event.data.type === 'SYNC_COMPLETE') {
          console.log('[App] Sync completed');
          setOfflineQueueCount(0);
          if (employeeInfo) fetchMyHistory(employeeInfo.id);
        }
      });
    }
  }, [employeeInfo]);

  // Check offline queue count on mount
  useEffect(() => {
    checkOfflineQueue();
  }, []);

  const checkOfflineQueue = async () => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction('queue', 'readonly');
      const store = tx.objectStore('queue');
      const count = await new Promise<number>((resolve) => {
        const req = store.count();
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(0);
      });
      setOfflineQueueCount(count);
    } catch (error) {
      console.error('[App] Failed to check offline queue:', error);
    }
  };

  const openOfflineDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('offline-checkins', 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains('queue')) {
          db.createObjectStore('queue', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  };

  const saveToOfflineQueue = async (checkin: any) => {
    try {
      const db = await openOfflineDB();
      const tx = db.transaction('queue', 'readwrite');
      const store = tx.objectStore('queue');
      await new Promise((resolve, reject) => {
        const req = store.add({ data: checkin, timestamp: Date.now() });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      await checkOfflineQueue();
      console.log('[App] Saved to offline queue');
    } catch (error) {
      console.error('[App] Failed to save to offline queue:', error);
      throw error;
    }
  };

  // Request notification permission for managers
  useEffect(() => {
    if (employeeInfo?.isManager && 'Notification' in window) {
      if (Notification.permission === 'default') {
        Notification.requestPermission().then(permission => {
          setNotificationPermission(permission);
          console.log('[Notifications] Permission:', permission);
        });
      } else {
        setNotificationPermission(Notification.permission);
      }
    }
  }, [employeeInfo]);

  // Auto-refresh pending approvals for managers (every 30 seconds)
  useEffect(() => {
    if (!employeeInfo?.isManager) return;

    const interval = setInterval(() => {
      fetchPendingApprovals(employeeInfo.id);
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [employeeInfo]);

  useEffect(() => {
    const email = localStorage.getItem("user_email");
    const id = localStorage.getItem("employee_id");
    const name = localStorage.getItem("employee_name");
    const hod = localStorage.getItem("reports_to");
    const image = localStorage.getItem("employee_image");

    if (!email || !id) {
      setBootstrapping(false);
      router.push("/login");
    } else {
      const baseInfo = {
        id,
        name: name || "Employee",
        hod: hod || "",
        isManager: false,
        image: image || ""
      };

      setEmployeeInfo(baseInfo);
      setBootstrapping(false);

      erpnext.isManager(id).then(isMgr => {
        const info = { ...baseInfo, isManager: isMgr };
        setEmployeeInfo(info);
        fetchEverything(id, isMgr);
      }).catch((error) => {
        console.error("Failed to resolve manager status:", error);
        fetchMyHistory(id);
        fetchMonthlyKpis(id);
      });
    }
  }, [router]);

  useEffect(() => {
    if (!employeeInfo) return;
    fetchSalarySlip(employeeInfo.id, selectedSalaryYear, selectedSalaryMonth);
  }, [employeeInfo, selectedSalaryMonth, selectedSalaryYear]);

  const fetchEverything = async (id: string, isManager: boolean) => {
    await fetchMyHistory(id);
    await fetchMonthlyKpis(id);
    if (isManager) {
      await fetchTeamHistory(id);
      await fetchPendingApprovals(id);
    }
  };

  const getMonthRange = (monthOffset: number) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + monthOffset + 1, 0);

    const toDateString = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    return {
      start: toDateString(start),
      end: toDateString(end),
      label: monthOffset === 0 ? "This Month" : "Previous Month",
    };
  };

  const sumOvertimeMinutes = (rows: OvertimeAllocationRecord[]) => {
    const candidateFields = [
      "overtime_hours",
      "ot_hours",
      "allocated_hours",
      "total_hours",
      "hours",
      "actual_hours",
      "approved_hours",
      "total_overtime_hours",
      "overtime_mins",
      "ot_minutes",
      "minutes",
    ];

    return rows.reduce((total, row) => {
      for (const field of candidateFields) {
        const raw = row[field];
        if (typeof raw === "number" && Number.isFinite(raw)) {
          return total + (field.includes("minute") || field.includes("mins") ? raw : raw * 60);
        }
        if (typeof raw === "string" && raw.trim() !== "" && !Number.isNaN(Number(raw))) {
          const value = Number(raw);
          return total + (field.includes("minute") || field.includes("mins") ? value : value * 60);
        }
      }
      return total;
    }, 0);
  };

  const buildMonthlyKpi = (attendance: AttendanceRecord[], overtime: OvertimeAllocationRecord[]): MonthlyKpi => {
    return attendance.reduce<MonthlyKpi>((summary, record) => {
      const normalizedStatus = (record.status || "").trim().toLowerCase();

      if (normalizedStatus === "present") summary.present += 1;
      else if (normalizedStatus === "absent") summary.absent += 1;
      else if (normalizedStatus.includes("leave")) summary.onLeave += 1;

      return summary;
    }, {
      present: 0,
      absent: 0,
      onLeave: 0,
      otMinutes: sumOvertimeMinutes(overtime),
    });
  };

  const filterAttendanceByDateRange = (
    attendance: AttendanceRecord[],
    startDate: string,
    endDate: string
  ) => {
    return attendance.filter((record) => {
      const attendanceDate = record.attendance_date;
      return Boolean(attendanceDate && attendanceDate >= startDate && attendanceDate <= endDate);
    });
  };

  const fetchMonthlyKpis = async (employeeId: string) => {
    setLoadingKpis(true);

    try {
      const thisMonth = getMonthRange(0);
      const previousMonth = getMonthRange(-1);

      console.log("[KPI Debug] Starting monthly KPI fetch", {
        employeeId,
        thisMonth,
        previousMonth,
      });

      const [
        attendanceResult,
        thisMonthOvertimeResult,
        previousMonthOvertimeResult,
      ] = await Promise.allSettled([
        erpnext.getAttendanceSummary(employeeId, previousMonth.start, thisMonth.end),
        erpnext.getOvertimeAllocations(employeeId, thisMonth.start, thisMonth.end),
        erpnext.getOvertimeAllocations(employeeId, previousMonth.start, previousMonth.end),
      ]);

      if (attendanceResult.status !== "fulfilled") {
        throw attendanceResult.reason;
      }

      const attendance = attendanceResult.value;
      console.log("[KPI Debug] Attendance rows returned from ERP", {
        employeeId,
        rangeStart: previousMonth.start,
        rangeEnd: thisMonth.end,
        totalRows: attendance.length,
        rows: attendance,
      });

      const thisMonthOvertime = thisMonthOvertimeResult.status === "fulfilled" ? thisMonthOvertimeResult.value : [];
      const previousMonthOvertime = previousMonthOvertimeResult.status === "fulfilled" ? previousMonthOvertimeResult.value : [];

      if (thisMonthOvertimeResult.status !== "fulfilled") {
        console.error("Failed to fetch this month overtime:", thisMonthOvertimeResult.reason);
      }

      if (previousMonthOvertimeResult.status !== "fulfilled") {
        console.error("Failed to fetch previous month overtime:", previousMonthOvertimeResult.reason);
      }

      const thisMonthAttendance = filterAttendanceByDateRange(attendance, thisMonth.start, thisMonth.end);
      const previousMonthAttendance = filterAttendanceByDateRange(attendance, previousMonth.start, previousMonth.end);

      console.log("[KPI Debug] Attendance rows grouped by month", {
        employeeId,
        thisMonth: {
          start: thisMonth.start,
          end: thisMonth.end,
          totalRows: thisMonthAttendance.length,
          rows: thisMonthAttendance,
        },
        previousMonth: {
          start: previousMonth.start,
          end: previousMonth.end,
          totalRows: previousMonthAttendance.length,
          rows: previousMonthAttendance,
        },
      });

      setMonthlyKpis({
        thisMonth: buildMonthlyKpi(thisMonthAttendance, thisMonthOvertime),
        previousMonth: buildMonthlyKpi(previousMonthAttendance, previousMonthOvertime),
      });
    } catch (error) {
      console.error("Failed to fetch monthly KPIs:", error);
    } finally {
      setLoadingKpis(false);
    }
  };

  const getMonthKey = (value?: string) => {
    if (!value) return "";
    return value.slice(0, 7);
  };

  const buildMonthDateRange = (year: number, month: number) => {
    const start = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = new Date(year, month, 0);
    const end = `${year}-${String(month).padStart(2, "0")}-${String(endDate.getDate()).padStart(2, "0")}`;

    return { start, end };
  };

  const monthOptions = [
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
  ];

  const salaryYearOptions = Array.from({ length: 6 }, (_, index) => today.getFullYear() - index);

  const formatCurrency = (value: number | string | null | undefined, currency = "AED") => {
    const numericValue = typeof value === "number" ? value : Number(value || 0);
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(numericValue) ? numericValue : 0);
  };

  const fetchSalarySlip = async (employeeId: string, year: number, month: number) => {
    setLoadingSalarySlips(true);
    setSalaryError(null);

    try {
      const { start, end } = buildMonthDateRange(year, month);
      const slips = await erpnext.getSalarySlips(employeeId, start, end);
      const targetMonthKey = `${year}-${String(month).padStart(2, "0")}`;
      const matchedSlip = slips.find((slip) =>
        getMonthKey(slip.start_date || slip.end_date || slip.posting_date) === targetMonthKey
      );

      if (!matchedSlip?.name) {
        setSalarySlip(null);
        return;
      }

      const detail = await erpnext.getSalarySlipDetail(matchedSlip.name);
      setSalarySlip(detail);
    } catch (error) {
      console.error("Failed to fetch salary slip:", error);
      setSalaryError("Failed to load salary slip from ERPNext.");
      setSalarySlip(null);
    } finally {
      setLoadingSalarySlips(false);
    }
  };

  const fetchMyHistory = async (empId: string) => {
    setLoadingHistory(true);
    try {
      const today = new Date();
      const formatLocalDateTime = (date: Date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hours = String(date.getHours()).padStart(2, "0");
        const minutes = String(date.getMinutes()).padStart(2, "0");
        const seconds = String(date.getSeconds()).padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      };

      const startOfToday = new Date(today);
      startOfToday.setHours(0, 0, 0, 0);
      const endOfToday = new Date(today);
      endOfToday.setHours(23, 59, 59, 999);

      const [data, officialCheckins] = await Promise.all([
        erpnext.getMyCheckins(empId),
        erpnext.getOfficialCheckins(empId, formatLocalDateTime(startOfToday), formatLocalDateTime(endOfToday)),
      ]);

      setMyCheckins(data);
      setTodayOfficialCheckins(officialCheckins);

      const officialTodaySummary = calculateTodayWorkSummary(officialCheckins);
      if (officialCheckins.length > 0) {
        setTotalWorkTime(officialTodaySummary.totalSeconds);
        setActiveStartTime(officialTodaySummary.activeStartTime);
        setStatus(officialTodaySummary.isCheckedIn ? "CHECKED_IN" : "IDLE");
        return;
      }

      // Calculate today's status and duration
      today.setHours(0, 0, 0, 0);
      const todaysLogs = data.filter((log: any) => new Date(log.checkin_time) >= today);

      // Determine if checked in (start timer even if pending)
      // Sort by time descending to get the most recent log first
      const sortedLogs = [...todaysLogs].sort((a, b) =>
        new Date(b.checkin_time).getTime() - new Date(a.checkin_time).getTime()
      );
      const lastLog = sortedLogs[0];
      if (lastLog && lastLog.log_type === 'IN' && lastLog.status !== 'Rejected') {
        setStatus("CHECKED_IN");
        setActiveStartTime(new Date(lastLog.checkin_time));
      } else {
        setStatus("IDLE");
        setActiveStartTime(null);
      }

      // Calculate total work duration for today (includes Pending and Approved, excludes Rejected)
      let totalSeconds = 0;
      const validTodaysLogs = todaysLogs.filter((l: any) => l.status !== 'Rejected').reverse();

      for (let i = 0; i < validTodaysLogs.length; i += 2) {
        const inLog = validTodaysLogs[i];
        const outLog = validTodaysLogs[i + 1];
        if (inLog && outLog && inLog.log_type === 'IN' && outLog.log_type === 'OUT') {
          totalSeconds += (new Date(outLog.checkin_time).getTime() - new Date(inLog.checkin_time).getTime()) / 1000;
        }
      }
      setTotalWorkTime(totalSeconds);

    } catch (error) {
      console.error("Failed to fetch history:", error);
      setTodayOfficialCheckins([]);
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

      // Trigger notification if count increased
      const newCount = formatted.length;
      if (previousPendingCount > 0 && newCount > previousPendingCount) {
        const newItems = newCount - previousPendingCount;
        const latestItem = formatted[0];
        showNotification(
          `New Check-in Request${newItems > 1 ? 's' : ''}`,
          `${latestItem.employee_name || latestItem.name} has submitted a ${latestItem.type} request${newItems > 1 ? ` (+${newItems - 1} more)` : ''}`,
          newCount
        );
      }
      setPreviousPendingCount(newCount);

      setPendingActivities(formatted);
      setApprovalsError(null);
    } catch (err: any) {
      setApprovalsError("Failed to load activities from ERPNext");
      console.error(err);
    } finally {
      setLoadingApprovals(false);
    }
  };

  const showNotification = (title: string, body: string, badge?: number) => {
    if (notificationPermission !== 'granted') return;

    if ('Notification' in window) {
      new Notification(title, {
        body,
        icon: '/app_icon_192.png',
        badge: '/app_icon_192.png',
        tag: 'approval-notification',
        requireInteraction: false,
      });
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

  const formatMinutesAsHours = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = Math.round(minutes % 60);
    return `${String(hours).padStart(2, "0")}h ${String(remainingMinutes).padStart(2, "0")}m`;
  };

  const formatSalaryPeriod = (startDate?: string, endDate?: string) => {
    if (!startDate || !endDate) return "";
    return `${startDate} to ${endDate}`;
  };

  const shouldHideSalaryComponent = (componentName?: string) => {
    const normalized = (componentName || "").trim().toLowerCase();
    return normalized.includes("gratuity") || normalized.includes("leave salary");
  };

  const getSalaryComponentRate = (item: SalarySlipComponent) => {
    const candidates = [
      item.rate,
      item.default_amount,
      item.base,
      item.stat_amount,
      item.additional_amount,
      item.amount,
    ];

    for (const candidate of candidates) {
      const numericValue = typeof candidate === "number" ? candidate : Number(candidate);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }

    return null;
  };

  const buildSalaryRows = (slip: SalarySlipDetail | null) => {
    if (!slip) return [];

    const mapRows = (items: SalarySlipComponent[] | undefined, type: "Earning" | "Deduction") =>
      (items || [])
        .filter((item) => !shouldHideSalaryComponent(item.salary_component))
        .map((item) => ({
          type,
          component: item.salary_component || type,
          rate: getSalaryComponentRate(item),
          amount: item.amount,
        }));

    return [
      ...mapRows(slip.earnings, "Earning"),
      ...mapRows(slip.deductions, "Deduction"),
    ];
  };

  const formatRateValue = (value: number | string | null | undefined) => {
    const numericValue = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(numericValue)) return "";
    return numericValue.toFixed(2);
  };

  const getTodayValidMobileLogs = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return myCheckins
      .filter((log: any) => new Date(log.checkin_time) >= today && log.status !== "Rejected")
      .sort((a: any, b: any) => new Date(a.checkin_time).getTime() - new Date(b.checkin_time).getTime());
  };

  const dayLogs = myCheckins.filter((log: any) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return new Date(log.checkin_time) >= today;
  });

  const validMobileLogs = getTodayValidMobileLogs();
  const officialInLog = todayOfficialCheckins.find((log) => log.log_type === "IN");
  const officialOutLogs = todayOfficialCheckins.filter((log) => log.log_type === "OUT");
  const officialOutLog = officialOutLogs.length > 0 ? officialOutLogs[officialOutLogs.length - 1] : null;
  const mobileInLogs = validMobileLogs.filter((log: any) => log.log_type === "IN");
  const mobileOutLogs = validMobileLogs.filter((log: any) => log.log_type === "OUT");
  const latestMobileInLog = mobileInLogs.length > 0 ? mobileInLogs[mobileInLogs.length - 1] : null;
  const latestMobileOutLog = mobileOutLogs.length > 0 ? mobileOutLogs[mobileOutLogs.length - 1] : null;
  const formatOfficialTime = (value?: string) =>
    value ? new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--";
  const officialTodaySummary = calculateTodayWorkSummary(todayOfficialCheckins);
  const hasExistingCheckIn = Boolean(officialInLog || latestMobileInLog);
  const hasExistingCheckOut = Boolean(officialOutLog || latestMobileOutLog);
  const checkInDisplayTime = officialInLog?.time || latestMobileInLog?.checkin_time;
  const checkOutDisplayTime = officialOutLog?.time || latestMobileOutLog?.checkin_time;
  const checkInSourceLabel = officialInLog ? "Official" : latestMobileInLog ? latestMobileInLog.status : "Not Created";
  const checkOutSourceLabel = officialOutLog ? "Official" : latestMobileOutLog ? latestMobileOutLog.status : "Not Created";
  const canCreateCheckIn = !hasExistingCheckIn;
  const canCreateCheckOut = hasExistingCheckIn && !hasExistingCheckOut;

  const getActiveDuration = () => {
    if (todayOfficialCheckins.length > 0) {
      let seconds = officialTodaySummary.totalSeconds;
      if (officialTodaySummary.activeStartTime) {
        seconds += Math.max(0, (currentTime.getTime() - officialTodaySummary.activeStartTime.getTime()) / 1000);
      }
      return formatDuration(seconds);
    }

    let seconds = totalWorkTime;
    if (activeStartTime) {
      seconds += Math.max(0, (currentTime.getTime() - activeStartTime.getTime()) / 1000);
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
      if (!mapboxToken) {
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }

      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${mapboxToken}&types=poi,address,neighborhood&limit=1`
      );
      const data = await response.json();
      return data.features?.[0]?.place_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    } catch (error) {
      console.error("Geocoding error:", error);
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  // Format local datetime for ERPNext (not UTC)
  const formatLocalDatetime = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const handleAction = async (type: "IN" | "OUT") => {
    if (!location || !employeeInfo) {
      setLocationError("Location and Session are required.");
      return;
    }

    if (type === "IN" && !canCreateCheckIn) {
      alert("Today's check-in already exists. You cannot create another check-in.");
      return;
    }

    if (type === "OUT" && !canCreateCheckOut) {
      const message = !hasExistingCheckIn
        ? "You need to create today's check-in before creating check-out."
        : "Today's check-out already exists. You cannot create another check-out.";
      alert(message);
      return;
    }

    setStatus(type === "IN" ? "CHECKING_IN" : "CHECKING_OUT");
    setLoadingLandmark(true);

    try {
      const landmark = await fetchLandmark(location.lat, location.lng);
      const checkinTime = new Date();

      const checkinData = {
        employee: employeeInfo.id,
        log_type: type,
        checkin_time: formatLocalDatetime(checkinTime),
        latitude: location.lat,
        longitude: location.lng,
        landmark: landmark,
        status: "Pending",
        hod: employeeInfo.hod
      };

      // Check if offline
      if (!isOnline) {
        console.log('[App] Offline - queuing check-in');
        await saveToOfflineQueue(checkinData);
        setStatus(type === "IN" ? "CHECKED_IN" : "IDLE");
        setLoadingLandmark(false);
        setShowMap(false);
        setLastAction({ type: type === "IN" ? "Check-in" : "Check-out", time: checkinTime });
        alert(`${type === "IN" ? "Check-in" : "Check-out"} saved offline. Will sync when online.`);
        return;
      }

      // Online - post directly
      console.log('[App] Posting check-in online:', checkinData);
      const result = await erpnext.postCheckin({
        employee: employeeInfo.id,
        log_type: type,
        checkin_time: formatLocalDatetime(checkinTime),
        latitude: location.lat,
        longitude: location.lng,
        landmark: landmark,
        status: "Pending",
        hod: employeeInfo.hod
      });
      console.log('[App] Check-in posted successfully:', result);

      setStatus(type === "IN" ? "CHECKED_IN" : "IDLE");
      setLoadingLandmark(false);
      setShowMap(false);
      setLastAction({ type: type === "IN" ? "Check-in" : "Check-out", time: checkinTime });

      console.log('[App] Fetching updated history...');
      await fetchMyHistory(employeeInfo.id);
      console.log('[App] History refreshed');
    } catch (error: any) {
      console.error("[App] ERPNext Sync Error:", error);
      setLocationError(`Sync Error: ${error.message}`);
      setStatus(type === "IN" ? "IDLE" : "CHECKED_IN");
      setLoadingLandmark(false);
      alert(`Failed to ${type === "IN" ? "check in" : "check out"}: ${error.message}`);
    }
  };

  const renderContent = () => {
    if (!employeeInfo) return null;

    const thisMonthLabel = getMonthRange(0).label;
    const previousMonthLabel = getMonthRange(-1).label;
    const activeSalarySlip = salarySlip;

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
                    <Map lat={selectedApprovalMap.lat} lng={selectedApprovalMap.lng} isOnline={isOnline} />
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

    if (activeTab === 'salary') {
      const salaryRows = buildSalaryRows(activeSalarySlip);
      const totalEarnings = salaryRows
        .filter((row) => row.type === "Earning")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const totalDeductions = salaryRows
        .filter((row) => row.type === "Deduction")
        .reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return (
        <div className="space-y-6 pb-24">
          <div className="px-2">
            <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">Salary Slips</p>
            <h2 className="text-2xl font-black tracking-tight">Salary Details</h2>
          </div>

          <div className="bg-white dark:bg-zinc-900 p-6 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800 space-y-6">
            <div className="grid grid-cols-2 gap-3">
              <label className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Year</span>
                <select
                  value={selectedSalaryYear}
                  onChange={(event) => setSelectedSalaryYear(Number(event.target.value))}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {salaryYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-2">
                <span className="block text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Month</span>
                <select
                  value={selectedSalaryMonth}
                  onChange={(event) => setSelectedSalaryMonth(Number(event.target.value))}
                  className="w-full rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900 outline-none transition focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                >
                  {monthOptions.map((month) => (
                    <option key={month.value} value={month.value}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {salaryError && (
              <div className="bg-rose-50 dark:bg-rose-500/10 p-4 rounded-2xl border border-rose-100 dark:border-rose-500/20 text-rose-500 text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                {salaryError}
              </div>
            )}

            {loadingSalarySlips ? (
              <div className="space-y-4">
                <div className="h-28 rounded-[2rem] bg-slate-100 dark:bg-zinc-800 animate-pulse" />
                <div className="h-72 rounded-[2rem] bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              </div>
            ) : !activeSalarySlip ? (
              <div className="text-center py-12 bg-slate-50 dark:bg-zinc-800/40 rounded-[2rem] border border-dashed border-slate-200 dark:border-zinc-700">
                <p className="text-slate-500 dark:text-zinc-400 text-sm font-bold">
                  No salary slip has been created for {monthOptions.find((month) => month.value === selectedSalaryMonth)?.label} {selectedSalaryYear}.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="rounded-[2rem] border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/40 p-5">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                    Salary Slip #{activeSalarySlip.name}
                  </p>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-slate-900 dark:text-white">
                    {activeSalarySlip.employee_name || employeeInfo.name}
                  </h3>
                  <p className="mt-1 text-xs font-bold uppercase tracking-widest text-slate-400">
                    {formatSalaryPeriod(activeSalarySlip.start_date, activeSalarySlip.end_date)}
                  </p>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Gross Pay</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                        {formatCurrency(activeSalarySlip.gross_pay, activeSalarySlip.currency)}
                      </p>
                    </div>
                    <div className="rounded-2xl bg-white dark:bg-zinc-900 p-4 border border-slate-100 dark:border-zinc-800">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Net Pay</p>
                      <p className="mt-2 text-2xl font-black tracking-tight text-emerald-600">
                        {formatCurrency(activeSalarySlip.net_pay ?? activeSalarySlip.rounded_total, activeSalarySlip.currency)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="overflow-hidden rounded-[2rem] border border-slate-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
                  <div className="border-b border-slate-100 dark:border-zinc-800 px-5 py-4">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                      Earnings & Deductions
                    </p>
                  </div>

                  {salaryRows.length === 0 ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm font-bold text-slate-500 dark:text-zinc-400">
                        No earnings or deductions are available for this salary slip.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-zinc-800/70">
                          <tr>
                            <th className="px-5 py-3 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Component</th>
                            <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Rate AED</th>
                            <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Earnings AED</th>
                            <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">Deductions AED</th>
                          </tr>
                        </thead>
                        <tbody>
                          {salaryRows.map((row, index) => (
                            <tr
                              key={`${row.type}-${row.component}-${index}`}
                              className="border-t border-slate-100 dark:border-zinc-800"
                            >
                              <td className="px-5 py-4 font-bold text-slate-900 dark:text-white">{row.component}</td>
                              <td className="px-5 py-4 text-right font-semibold text-slate-700 dark:text-zinc-300">
                                {formatRateValue(row.rate)}
                              </td>
                              <td className="px-5 py-4 text-right font-black text-emerald-700 dark:text-emerald-300">
                                {row.type === "Earning" ? formatCurrency(row.amount, activeSalarySlip.currency) : ""}
                              </td>
                              <td className="px-5 py-4 text-right font-black text-slate-900 dark:text-white">
                                {row.type === "Deduction" ? formatCurrency(row.amount, activeSalarySlip.currency) : ""}
                              </td>
                            </tr>
                          ))}
                          <tr className="border-t-2 border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/60">
                            <td className="px-5 py-4 font-black uppercase tracking-widest text-slate-900 dark:text-white">Total</td>
                            <td className="px-5 py-4" />
                            <td className="px-5 py-4 text-right font-black text-emerald-700 dark:text-emerald-300">
                              {formatCurrency(totalEarnings, activeSalarySlip.currency)}
                            </td>
                            <td className="px-5 py-4 text-right font-black text-rose-700 dark:text-rose-300">
                              {formatCurrency(totalDeductions, activeSalarySlip.currency)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="rounded-[2rem] border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/20 px-5 py-4">
                  <p className="text-sm font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">
                    Net Pay : {formatCurrency(activeSalarySlip.net_pay ?? activeSalarySlip.rounded_total, activeSalarySlip.currency)}
                  </p>
                </div>
              </div>
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
    const kpi = monthlyKpis[selectedKpiPeriod];
    const kpiCards = [
      {
        title: "Total Present",
        value: kpi.present,
        accent: "text-emerald-600",
        bg: "bg-emerald-50 dark:bg-emerald-500/10",
        icon: <CheckCircle2 className="w-5 h-5" />,
      },
      {
        title: "Total Absent",
        value: kpi.absent,
        accent: "text-rose-600",
        bg: "bg-rose-50 dark:bg-rose-500/10",
        icon: <XCircle className="w-5 h-5" />,
      },
      {
        title: "Total On Leave",
        value: kpi.onLeave,
        accent: "text-amber-600",
        bg: "bg-amber-50 dark:bg-amber-500/10",
        icon: <MoonStar className="w-5 h-5" />,
      },
      {
        title: "Total OT Time",
        value: formatMinutesAsHours(kpi.otMinutes),
        accent: "text-blue-600",
        bg: "bg-blue-50 dark:bg-blue-500/10",
        icon: <Briefcase className="w-5 h-5" />,
      },
    ];

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
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900/40 bg-emerald-50/80 dark:bg-emerald-950/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-300">Official In</p>
                <p className="mt-2 text-xl font-black tracking-tight text-emerald-800 dark:text-emerald-100">
                  {formatOfficialTime(officialInLog?.time)}
                </p>
              </div>
              <div className="rounded-2xl border border-rose-100 dark:border-rose-900/40 bg-rose-50/80 dark:bg-rose-950/20 p-4">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-700 dark:text-rose-300">Official Out</p>
                <p className="mt-2 text-xl font-black tracking-tight text-rose-800 dark:text-rose-100">
                  {formatOfficialTime(officialOutLog?.time)}
                </p>
              </div>
            </div>

          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 p-6 rounded-[3rem] shadow-xl shadow-slate-200/50 dark:shadow-none border border-slate-100 dark:border-zinc-800 space-y-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-slate-500 dark:text-zinc-400 text-[10px] font-black uppercase tracking-[0.3em]">Monthly KPIs</p>
              <h3 className="text-xl font-black tracking-tight">Attendance Summary</h3>
            </div>
            <Calendar className="w-6 h-6 text-slate-300 dark:text-zinc-700" />
          </div>

          <div className="grid grid-cols-2 gap-3 rounded-[2rem] bg-slate-100/80 dark:bg-zinc-800/70 p-2">
            <button
              onClick={() => setSelectedKpiPeriod("thisMonth")}
              className={`rounded-[1.4rem] px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${selectedKpiPeriod === "thisMonth"
                ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-zinc-400"
                }`}
            >
              {thisMonthLabel}
            </button>
            <button
              onClick={() => setSelectedKpiPeriod("previousMonth")}
              className={`rounded-[1.4rem] px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${selectedKpiPeriod === "previousMonth"
                ? "bg-white dark:bg-zinc-900 text-slate-900 dark:text-white shadow-sm"
                : "text-slate-500 dark:text-zinc-400"
                }`}
            >
              {previousMonthLabel}
            </button>
          </div>

          {loadingKpis ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className="h-28 rounded-[2rem] bg-slate-100 dark:bg-zinc-800 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {kpiCards.map((card) => (
                <div key={card.title} className={`rounded-[2rem] p-4 border border-slate-100 dark:border-zinc-800 ${card.bg}`}>
                  <div className={`mb-4 inline-flex rounded-2xl p-3 ${card.accent} bg-white/70 dark:bg-zinc-900/60`}>
                    {card.icon}
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">{card.title}</p>
                  <p className={`mt-2 text-2xl font-black tracking-tight ${card.accent}`}>{card.value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 text-center">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] leading-relaxed italic opacity-60">
            "Work with intent. Precision in every second."
          </p>
        </div>
      </div>
    );
  };

  if (bootstrapping || !employeeInfo) return (
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
          {/* Offline indicator */}
          {!isOnline && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-amber-600 uppercase tracking-wider">Offline Mode</span>
              {offlineQueueCount > 0 && (
                <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-900/20 text-amber-700 px-2 py-0.5 rounded-full">
                  {offlineQueueCount} queued
                </span>
              )}
            </div>
          )}
          {isOnline && offlineQueueCount > 0 && (
            <div className="flex items-center gap-2 mt-2">
              <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
              <span className="text-[9px] font-bold text-blue-600 uppercase tracking-wider">Syncing...</span>
            </div>
          )}
        </div>
        <button onClick={async () => { await erpnext.logout(); localStorage.clear(); router.push('/login'); }} className="relative group">
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

            <div className="h-64 w-full rounded-[3rem] overflow-hidden border border-slate-100 dark:border-zinc-800 mb-8 relative bg-slate-50 dark:bg-zinc-800/50">
              {mapboxToken ? (
                <Map lat={location?.lat || 25.2048} lng={location?.lng || 55.2708} isOnline={isOnline} />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 dark:text-zinc-400">
                    GPS Coordinates
                  </p>
                  <p className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                    {location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : "--, --"}
                  </p>
                </div>
              )}
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
                disabled={status === "CHECKING_IN" || !canCreateCheckIn || !location}
                className={`flex flex-col items-center gap-3 py-8 rounded-[3rem] font-black text-xs uppercase tracking-widest transition-all ${!canCreateCheckIn ? "bg-slate-50 text-slate-300 dark:bg-zinc-800/50 cursor-not-allowed" :
                  "bg-blue-600 text-white shadow-xl shadow-blue-500/30 active:scale-95"
                  }`}
              >
                {status === "CHECKING_IN" ? <span className="animate-spin text-3xl">⏳</span> : <LogIn className="w-10 h-10 mb-2" />}
                Check In
              </button>
              <button
                onClick={() => handleAction("OUT")}
                disabled={status === "CHECKING_OUT" || !canCreateCheckOut || !location}
                className={`flex flex-col items-center gap-3 py-8 rounded-[3rem] font-black text-xs uppercase tracking-widest transition-all ${!canCreateCheckOut ? "bg-slate-50 text-slate-300 dark:bg-zinc-800/50 cursor-not-allowed" :
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
