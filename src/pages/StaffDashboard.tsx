import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Calendar, Users, Settings, ChevronLeft, ChevronRight, Filter } from 'lucide-react';
import { collection, onSnapshot, query, orderBy, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { getStartOfWeek, generateWeekId } from '../services/schedule';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

interface StaffEntry {
  userId: string;
  name: string;
}

interface ShiftDoc {
  id?: string;
  date: string;
  dateString: string;
  shiftName: string;
  staff: {
    manager: StaffEntry[];
    cashier: StaffEntry[];
    ticket_checker: StaffEntry[];
  };
  backups: StaffEntry[];
}

type ViewMode = 'week' | 'month';

export default function StaffDashboard() {
  const { profile, logout } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const navigate = useNavigate();

  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [weekOffset, setWeekOffset] = useState(0);
  const [monthOffset, setMonthOffset] = useState(0);
  const [allUsers, setAllUsers] = useState<{id: string; name: string; role: string}[]>([]);

  // Week data
  const [weekShifts, setWeekShifts] = useState<ShiftDoc[]>([]);
  const [weekLoading, setWeekLoading] = useState(false);

  // Month data: multiple weeks
  const [monthShifts, setMonthShifts] = useState<ShiftDoc[]>([]);
  const [monthLoading, setMonthLoading] = useState(false);

  const [scheduleRules, setScheduleRules] = useState<any>(null);

  // Load Rules
  useEffect(() => {
    const rulesRef = doc(db, 'settings', 'schedule_rules');
    const unsub = onSnapshot(rulesRef, (docSnap) => {
      if (docSnap.exists()) {
        setScheduleRules(docSnap.data());
      }
    });
    return () => unsub();
  }, []);

  // Load users
  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('name'));
    const unsub = onSnapshot(q, (snap) => {
      const users: any[] = [];
      snap.forEach(d => users.push({ id: d.id, ...d.data() }));
      setAllUsers(users);
    });
    return () => unsub();
  }, []);

  // Week view: load shifts for single week
  useEffect(() => {
    if (viewMode !== 'week') return;
    setWeekLoading(true);

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const startOfWeek = getStartOfWeek(targetDate);
    const weekId = generateWeekId(startOfWeek);

    const unsub = onSnapshot(
      collection(db, 'weekly_schedules', weekId, 'shifts'),
      (snap) => {
        const shifts: ShiftDoc[] = [];
        snap.forEach(d => shifts.push({ id: d.id, ...d.data() } as ShiftDoc));
        setWeekShifts(shifts);
        setWeekLoading(false);
      },
      () => { setWeekShifts([]); setWeekLoading(false); }
    );
    return () => unsub();
  }, [viewMode, weekOffset]);

  // Month view: load shifts for all weeks in the month
  useEffect(() => {
    if (viewMode !== 'month') return;
    setMonthLoading(true);

    const now = new Date();
    const targetMonth = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const year = targetMonth.getFullYear();
    const month = targetMonth.getMonth();

    // Find all week IDs that overlap with this month
    const weekIds: string[] = [];
    const d = new Date(year, month, 1);
    // Go back to Monday of the first week
    while (d.getDay() !== 1) d.setDate(d.getDate() - 1);

    while (d.getMonth() <= month || (d.getMonth() === 0 && month === 11)) {
      const weekStart = getStartOfWeek(d);
      const wid = generateWeekId(weekStart);
      if (!weekIds.includes(wid)) weekIds.push(wid);
      d.setDate(d.getDate() + 7);
      if (d > new Date(year, month + 1, 7)) break;
    }

    const allShifts: ShiftDoc[] = [];
    let completed = 0;
    const unsubs: (() => void)[] = [];

    if (weekIds.length === 0) {
      setMonthShifts([]);
      setMonthLoading(false);
      return;
    }

    weekIds.forEach(wid => {
      const unsub = onSnapshot(
        collection(db, 'weekly_schedules', wid, 'shifts'),
        (snap) => {
          snap.forEach(snapDoc => {
            const data = snapDoc.data() as ShiftDoc;
            const ds = data.dateString;
            // Only include shifts whose date falls in the target month
            if (ds) {
              const shiftDate = new Date(ds);
              if (shiftDate.getMonth() === month && shiftDate.getFullYear() === year) {
                // Remove existing entry if re-fetched
                const existIdx = allShifts.findIndex(s => s.id === snapDoc.id);
                if (existIdx >= 0) allShifts.splice(existIdx, 1);
                allShifts.push({ id: snapDoc.id, ...data });
              }
            }
          });
          completed++;
          if (completed >= weekIds.length) {
            setMonthShifts([...allShifts]);
            setMonthLoading(false);
          }
        },
        () => {
          completed++;
          if (completed >= weekIds.length) {
            setMonthShifts([...allShifts]);
            setMonthLoading(false);
          }
        }
      );
      unsubs.push(unsub);
    });

    return () => unsubs.forEach(u => u());
  }, [viewMode, monthOffset]);

  // Aggregate stats
  const activeShifts = viewMode === 'week' ? weekShifts : monthShifts;

  const staffStats = useMemo(() => {
    const stats: Record<string, {
      name: string;
      role: string;
      totalShifts: number;
      totalBackups: number;
      shiftDetails: { date: string; shiftName: string }[];
    }> = {};

    // Initialize from allUsers
    allUsers.forEach(u => {
      if (u.role === 'admin') return; // Skip admin in stats
      stats[u.id] = {
        name: u.name,
        role: u.role,
        totalShifts: 0,
        totalBackups: 0,
        shiftDetails: [],
      };
    });

    activeShifts.forEach(shift => {
      const roles = ['manager', 'cashier', 'ticket_checker'] as const;
      roles.forEach(role => {
        const staffArr = shift.staff?.[role] || [];
        staffArr.forEach((s: StaffEntry) => {
          if (!stats[s.userId]) {
            stats[s.userId] = { name: s.name, role, totalShifts: 0, totalBackups: 0, shiftDetails: [] };
          }
          stats[s.userId].totalShifts++;
          stats[s.userId].shiftDetails.push({ date: shift.dateString, shiftName: shift.shiftName });
        });
      });
      (shift.backups || []).forEach((s: StaffEntry) => {
        if (!stats[s.userId]) {
          stats[s.userId] = { name: s.name, role: 'backup', totalShifts: 0, totalBackups: 0, shiftDetails: [] };
        }
        stats[s.userId].totalBackups++;
      });
    });

    return Object.entries(stats)
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.totalShifts - a.totalShifts);
  }, [activeShifts, allUsers]);

  // Labels
  const getWeekLabel = () => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + weekOffset * 7);
    const startOfWeek = getStartOfWeek(targetDate);
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const fmt = (d: Date) => `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}`;
    return `${fmt(startOfWeek)} - ${fmt(endOfWeek)}/${endOfWeek.getFullYear()}`;
  };

  const getMonthLabel = () => {
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    return `Tháng ${target.getMonth() + 1}/${target.getFullYear()}`;
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'manager': return 'Quản lý';
      case 'cashier': return 'Thu ngân';
      case 'ticket_checker': return 'Soát vé';
      default: return role;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'manager': return 'bg-purple-100 text-purple-700';
      case 'cashier': return 'bg-blue-100 text-blue-700';
      case 'ticket_checker': return 'bg-teal-100 text-teal-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const isLoading = viewMode === 'week' ? weekLoading : monthLoading;

  // Filter valid shifts based on real-time rules
  const validTotalShifts = activeShifts.filter(shift => {
    if (!scheduleRules || !scheduleRules.shiftConfig) return true; // fallback
    
    // Find the config key for this shift name
    const shiftIdConfig = Object.keys(scheduleRules.shiftConfig).find(
      k => scheduleRules.shiftConfig[k].name === shift.shiftName
    );
    if (!shiftIdConfig) return true;

    // Convert shift.dateString (YYYY-MM-DD) to Date to get weekday key
    const shiftDateObj = new Date(shift.dateString);
    const dayMap = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dayKeyStr = dayMap[shiftDateObj.getDay()];

    const specialRule = scheduleRules.specialDates?.find((d: any) => d.date === shift.dateString);
    
    if (specialRule) {
      if (specialRule.type === 'closed') return false;
      return specialRule.shifts?.includes(shiftIdConfig);
    } else {
      const defaultShifts = scheduleRules.weeklyDefaults?.[dayKeyStr] || [];
      return defaultShifts.includes(shiftIdConfig);
    }
  });

  const totalShiftsInPeriod = validTotalShifts.filter(shift => {
    let hasStaff = false;
    const roles = ['manager', 'cashier', 'ticket_checker'] as const;
    roles.forEach(role => {
      if (shift.staff && shift.staff[role] && shift.staff[role].length > 0) {
        hasStaff = true;
      }
    });
    return hasStaff;
  }).length;
  
  const totalRegistered = staffStats.reduce((sum, s) => sum + s.totalShifts, 0);
  const totalBackups = staffStats.reduce((sum, s) => sum + s.totalBackups, 0);
  const activeStaffCount = staffStats.filter(s => s.totalShifts > 0).length;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg relative z-20 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3 md:gap-4 lg:justify-between">
          <div className="flex items-center gap-3 flex-1 lg:flex-none">
            {companyInfo.logoBase64 ? (
              <img src={companyInfo.logoBase64} alt="Logo" className="w-9 h-9 object-contain rounded-lg border border-white/30 bg-white/10 p-0.5 shrink-0" />
            ) : (
              <div className="bg-white/20 p-2 rounded-lg shrink-0">
                <BarChart3 className="text-white w-5 h-5" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white truncate">{companyInfo.companyName || 'Thống kê'}</h1>
          </div>
          
          {/* Nav Tabs - luôn hiển thị, cuộn ngang trên mobile */}
          <div className="flex w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0 gap-1 bg-white/10 p-1 rounded-lg order-3 lg:order-2">
            <button
              onClick={() => navigate('/manager')}
              className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
            >
              <Calendar size={16} /> Lịch
            </button>
            <button className="px-3 md:px-4 py-2 text-sm font-medium rounded-md bg-white text-blue-800 shadow-sm flex items-center gap-1 md:gap-2 shrink-0">
              <BarChart3 size={16} /> Thống kê
            </button>
            <button
              onClick={() => navigate('/manager/users')}
              className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
            >
              <Users size={16} /> Nhân sự
            </button>
            {profile?.role === 'admin' && (
              <button
                onClick={() => navigate('/manager/settings')}
                className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
              >
                <Settings size={16} /> Cài đặt
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 sm:gap-4 order-2 lg:order-3 ml-auto shrink-0">
            <span className="text-sm font-medium text-white/90 hidden sm:block whitespace-nowrap">{profile?.fullName || 'Admin'}</span>
            <button
              onClick={async () => { await logout(); navigate('/login'); }}
              className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white/90 rounded-md font-medium transition-colors shrink-0"
            >
              Thoát
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        {/* Filters */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Bảng Thống kê Ca làm việc</h2>
            <p className="text-sm text-gray-500">Tổng hợp số ca đăng ký theo nhân viên</p>
          </div>

          <div className="flex items-center gap-3">
            {/* View Mode Toggle */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setViewMode('week')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'week' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <Filter size={14} /> Tuần
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${viewMode === 'month' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-600 hover:text-gray-800'}`}
              >
                <Calendar size={14} /> Tháng
              </button>
            </div>

            {/* Navigation */}
            <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5">
              <button
                onClick={() => viewMode === 'week' ? setWeekOffset(o => o - 1) : setMonthOffset(o => o - 1)}
                className="text-gray-500 hover:text-gray-800"
              >
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-semibold text-gray-800 min-w-[140px] text-center">
                {viewMode === 'week' ? getWeekLabel() : getMonthLabel()}
              </span>
              <button
                onClick={() => viewMode === 'week' ? setWeekOffset(o => o + 1) : setMonthOffset(o => o + 1)}
                className="text-gray-500 hover:text-gray-800"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">Tổng Ca</p>
            <p className="text-2xl font-bold text-gray-900 mt-1">{totalShiftsInPeriod}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">Lượt đăng ký</p>
            <p className="text-2xl font-bold text-green-600 mt-1">{totalRegistered}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">NV tham gia</p>
            <p className="text-2xl font-bold text-blue-600 mt-1">{activeStaffCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <p className="text-xs font-semibold text-gray-400 uppercase">Dự bị</p>
            <p className="text-2xl font-bold text-orange-500 mt-1">{totalBackups}</p>
          </div>
        </div>

        {/* Staff Table */}
        {isLoading ? (
          <div className="flex justify-center py-20 text-gray-500">Đang tải dữ liệu...</div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nhân viên</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chức vụ</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Số Ca</th>
                    <th className="px-6 py-4 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Dự bị</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Chi tiết Ca</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {staffStats.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                        Không có dữ liệu trong khoảng thời gian này.
                      </td>
                    </tr>
                  ) : (
                    staffStats.map((staff, idx) => (
                      <tr key={staff.id} className={`hover:bg-gray-50 transition-colors ${staff.totalShifts === 0 && staff.totalBackups === 0 ? 'opacity-40' : ''}`}>
                        <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-400 font-medium">{idx + 1}</td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-indigo-600 font-bold text-xs">{staff.name.charAt(0).toUpperCase()}</span>
                            </div>
                            <span className="ml-3 text-sm font-semibold text-gray-900">{staff.name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap">
                          <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getRoleBadge(staff.role)}`}>
                            {getRoleLabel(staff.role)}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <span className={`text-lg font-bold ${staff.totalShifts > 0 ? 'text-green-600' : 'text-gray-300'}`}>
                            {staff.totalShifts}
                          </span>
                        </td>
                        <td className="px-6 py-3 whitespace-nowrap text-center">
                          <span className={`text-sm font-bold ${staff.totalBackups > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
                            {staff.totalBackups}
                          </span>
                        </td>
                        <td className="px-6 py-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {staff.shiftDetails.length === 0 ? (
                              <span className="text-xs text-gray-300">—</span>
                            ) : (
                              staff.shiftDetails.map((d, i) => {
                                const dateObj = new Date(d.date);
                                const dayLabel = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
                                return (
                                  <span key={i} className="inline-flex items-center px-2 py-0.5 bg-indigo-50 text-indigo-700 text-[11px] font-medium rounded border border-indigo-100">
                                    {dayLabel} · {d.shiftName}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* Footer bản quyền */}
      <footer className="bg-gradient-to-r from-blue-900 to-blue-800 py-2 text-center shrink-0">
        <p className="text-[11px] text-white/50">© {new Date().getFullYear()} <span className="font-semibold text-white/70">MinAds Soft</span></p>
      </footer>
    </div>
  );
}
