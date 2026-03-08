import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, User, LogOut, ChevronLeft, ChevronRight, CheckCircle, XCircle } from 'lucide-react';
import { collection, doc, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateWeekId, getStartOfWeek } from '../services/schedule';
import { Shift } from '../types';
import { registerShiftApi, cancelShiftApi, registerBackupApi, confirmShiftApi, confirmWeekApi } from '../firebase/api';

interface DailySchedule {
  date: string; // "YYYY-MM-DD"
  dayName: string; // "Thứ 2"
  shifts: Shift[];
}

export default function StaffRegistration() {
  const { profile, logout } = useAuth();
  const navigate = useNavigate();
  
  const [scheduleData, setScheduleData] = useState<DailySchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isWeekLocked, setIsWeekLocked] = useState(false);
  const [hasConfirmedWeek, setHasConfirmedWeek] = useState(false);
  const [scheduleRules, setScheduleRules] = useState<any>(null);
  const [registeringTask, setRegisteringTask] = useState<string | null>(null);

  const [weekOffset, setWeekOffset] = useState(1); // Default is Next Week (Tuần Mới)
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showMyScheduleModal, setShowMyScheduleModal] = useState(false);
  
  const [selectedPosition, setSelectedPosition] = useState<string>('');
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 2000);
  };

  useEffect(() => {
    if (!selectedPosition && profile) {
      if (profile.positions && profile.positions.length > 0) {
        setSelectedPosition(profile.positions[0]);
      } else if (profile.role) {
        setSelectedPosition(profile.role);
      }
    }
  }, [profile, selectedPosition]);

  const userRole = selectedPosition || 'cashier';
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + weekOffset * 7);
  const startOfWeek = getStartOfWeek(targetDate);
  const weekId = generateWeekId(startOfWeek);
  
  const formatWeekLabel = (wId: string) => {
    if (!wId || !wId.includes('-W')) return wId;
    const [year, week] = wId.split('-W');
    return `Tuần ${week} - ${year}`;
  };

  // Check deadline Khóa sổ
  const isDeadlinePassed = () => {
    if (!scheduleRules?.deadline) return false;
    // Deadline applies to registering for NEXT WEEK (weekOffset = 1)
    if (weekOffset > 1) return false; // Future weeks are open (unless globally locked)
    if (weekOffset < 1) return true;  // Past/Current weeks are always closed

    const now = new Date();
    // Calculate the actual deadline Date object based on current week (weekOffset = 0)
    const currentWeekStart = getStartOfWeek(new Date());
    const dayMap: Record<string, number> = {
      'monday': 0, 'tuesday': 1, 'wednesday': 2, 'thursday': 3,
      'friday': 4, 'saturday': 5, 'sunday': 6
    };
    
    const deadlineDayOffset = dayMap[scheduleRules.deadline.dayOfWeek] || 6;
    const deadlineDate = new Date(currentWeekStart);
    deadlineDate.setDate(deadlineDate.getDate() + deadlineDayOffset);
    
    const [hours, minutes] = (scheduleRules.deadline.time || "23:59").split(':').map(Number);
    deadlineDate.setHours(hours, minutes, 0, 0);

    return now > deadlineDate;
  };

  useEffect(() => {
    setLoading(true);

    const weekRef = doc(db, 'weekly_schedules', weekId);
    const unsubWeek = onSnapshot(weekRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setIsWeekLocked(data?.isLocked || isDeadlinePassed());
        setHasConfirmedWeek((data?.confirmedBy || []).includes(profile?.uid));
      } else {
        setIsWeekLocked(isDeadlinePassed());
        setHasConfirmedWeek(false);
      }
    });

    const rulesRef = doc(db, 'settings', 'schedule_rules');
    const unsubRules = onSnapshot(rulesRef, (docSnap) => {
      if (docSnap.exists()) {
        setScheduleRules(docSnap.data());
      }
    });

    const shiftsQuery = query(
      collection(db, 'weekly_schedules', weekId, 'shifts'),
      orderBy('dateString', 'asc')
    );

    const unsubscribeShifts = onSnapshot(shiftsQuery, (snapshot) => {
      const grouped = new Map<string, { dayName: string; shifts: Shift[] }>();
      
      snapshot.forEach(doc => {
        const shift = { id: doc.id, ...doc.data() } as Shift;
        if (!grouped.has(shift.dateString)) {
          grouped.set(shift.dateString, { dayName: shift.date, shifts: [] });
        }
        grouped.get(shift.dateString)!.shifts.push(shift);
      });

      const processedData: DailySchedule[] = Array.from(grouped.entries()).map(([dateStr, data]) => {
        const fullDayMap: Record<string, string> = {
          'Thứ 2': 'Thứ Hai', 'Thứ 3': 'Thứ Ba', 'Thứ 4': 'Thứ Tư',
          'Thứ 5': 'Thứ Năm', 'Thứ 6': 'Thứ Sáu', 'Thứ 7': 'Thứ Bảy', 'CN': 'Chủ Nhật'
        };
        return {
          date: dateStr || 'Unknown',
          dayName: fullDayMap[data.dayName] || data.dayName || 'Unknown',
          shifts: data.shifts || []
        };
      });

      // Bỏ các ngày đã qua (So sánh theo Lịch múi giờ Việt Nam)
      const vietnamTime = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
      const vnDate = new Date(vietnamTime);
      const todayStr = `${vnDate.getFullYear()}-${String(vnDate.getMonth() + 1).padStart(2, '0')}-${String(vnDate.getDate()).padStart(2, '0')}`;
      
      const filteredData = processedData.filter(day => day.date === 'Unknown' || day.date >= todayStr);

      setScheduleData(filteredData);
      
      // Auto expand first day if not set
      if (filteredData.length > 0) {
        // No longer expanding days, so this logic is removed.
      }
      
      setLoading(false); // ALWAYS call this regardless of length
    }, (error) => {
      console.error("Error fetching shifts:", error);
      setLoading(false);
    });

    // Fallback: Nếu mạng chậm / Firestore rỗng ban đầu, tắt loading sau 2.5s
    const fallbackTimer = setTimeout(() => {
      setLoading(false);
    }, 2500);

    return () => {
      clearTimeout(fallbackTimer);
      unsubWeek();
      unsubRules();
      unsubscribeShifts();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekId]); // Removed scheduleRules?.deadline which is an object causing infinite loop

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const changeWeek = (direction: number) => {
    const newOffset = weekOffset + direction;
    if (newOffset < 1) return; // Mặc định không cho về tuần này/tuần trước
    setWeekOffset(newOffset);
  };

  const handleRegister = async (shiftId: string) => {
    setRegisteringTask(shiftId);
    try {
      await registerShiftApi(weekId, shiftId, userRole, profile?.fullName || 'Nhân viên');
      showToast('Đăng ký ca thành công!');
    } catch (error: any) {
      showToast("Lỗi: " + error.message, 'error');
    } finally {
      setRegisteringTask(null);
    }
  };

  const handleConfirmShift = async (shiftId: string) => {
    setRegisteringTask(shiftId + '_confirm');
    try {
      await confirmShiftApi(weekId, shiftId, userRole);
      showToast('Đã xác nhận nhận ca thành công!');
    } catch (error: any) {
      showToast("Lỗi: " + error.message, 'error');
    } finally {
      setRegisteringTask(null);
    }
  };

  const handleCancel = async (shiftId: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn hủy đăng ký ca này?")) return;
    setRegisteringTask(shiftId);
    try {
      await cancelShiftApi(weekId, shiftId, userRole);
      showToast('Đã hủy ca thành công!');
    } catch (error: any) {
      showToast("Lỗi khi hủy ca: " + error.message, 'error');
    } finally {
      setRegisteringTask(null);
    }
  };

  const handleRegisterBackup = async (shiftId: string) => {
    setRegisteringTask(shiftId + '_backup');
    try {
      await registerBackupApi(weekId, shiftId, userRole, profile?.fullName || 'Nhân viên');
      showToast('Đăng ký dự bị thành công!');
    } catch (error: any) {
      showToast("Lỗi: " + error.message, 'error');
    } finally {
      setRegisteringTask(null);
    }
  };

  // Count how many shifts current user registered this week
  const countMyShifts = () => {
    let count = 0;
    scheduleData.forEach(day => {
      day.shifts?.forEach(shift => {
        const staffArr: any[] = (shift.staff as any)?.[userRole] || [];
        if (staffArr.some((s: any) => s.userId === profile?.uid)) {
          count++;
        }
      });
    });
    return count;
  };

  const registeredCount = countMyShifts();

  const handleConfirmWeek = async () => {
    setRegisteringTask('confirm_week');
    try {
      await confirmWeekApi(weekId);
      setHasConfirmedWeek(true); // Cập nhật UI tức thì, không cần chờ onSnapshot
      showToast('Đã xác nhận & chốt sổ tuần thành công!');
      setShowConfirmModal(false);
    } catch (error: any) {
      showToast("Lỗi: " + error.message, 'error');
    } finally {
      setRegisteringTask(null);
    }
  };

  // Gom danh sách các Ca đã đăng ký của User này trên TẤT CẢ VỊ TRÍ (bao gồm cả Dự bị, Chờ Xác nhận)
  const getMyRegisteredShifts = () => {
    const myShifts: {dayName: string; shiftName: string; timeRange: string; roleName: string; myStatus: 'confirmed' | 'pending' | 'backup'}[] = [];
    scheduleData.forEach(day => {
      day.shifts?.forEach(shift => {
        const staffObj = shift.staff || {};
        const backupObj = shift.backups || {};
        
        // Quét tất cả các vị trí trong ca này để tìm UID của nhân viên
        const userRolesInShift = new Set<string>();
        
        Object.keys(staffObj).forEach(r => {
           if ((staffObj as any)[r]?.some((s:any) => s.userId === profile?.uid)) userRolesInShift.add(r);
        });
        Object.keys(backupObj).forEach(r => {
           if ((backupObj as any)[r]?.some((s:any) => s.userId === profile?.uid)) userRolesInShift.add(r);
        });

        // Mỗi vị trí tìm thấy sẽ là 1 record trong lịch
        userRolesInShift.forEach(roleKey => {
           const myReg = (staffObj as any)[roleKey]?.find((s:any) => s.userId === profile?.uid);
           const myBackup = (backupObj as any)[roleKey]?.find((s:any) => s.userId === profile?.uid);
           
           if (myReg || myBackup) {
             let timeRange = shift.timeString;
             if (scheduleRules?.shiftConfig) {
               const conf = Object.values(scheduleRules.shiftConfig).find((c: any) => c.name === shift.shiftName) as any;
               if (conf) timeRange = `${conf.startTime} - ${conf.endTime}`;
             }
             
             let status: 'confirmed' | 'pending' | 'backup' = 'confirmed';
             if (myReg?.status === 'pending') status = 'pending';
             else if (myBackup) status = 'backup';

             myShifts.push({
               dayName: day.dayName,
               shiftName: shift.shiftName,
               timeRange,
               roleName: scheduleRules?.positionsConfig?.[roleKey]?.name || roleKey,
               myStatus: status
             });
           }
        });
      });
    });
    return myShifts;
  };

  // Tính khoảng ngày của tuần đang hiển thị
  const getWeekDateRange = () => {
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 6);
    const fmt = (d: Date) => `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth()+1).toString().padStart(2,'0')}`;
    return `${fmt(startOfWeek)} - ${fmt(endOfWeek)}`;
  };

  // Deadline label
  const getDeadlineLabel = () => {
    if (!scheduleRules?.deadline) return '';
    const dayLabel: Record<string, string> = {
      'monday': 'Thứ Hai', 'tuesday': 'Thứ Ba', 'wednesday': 'Thứ Tư',
      'thursday': 'Thứ Năm', 'friday': 'Thứ Sáu', 'saturday': 'Thứ Bảy', 'sunday': 'Chủ Nhật'
    };
    return `${scheduleRules.deadline.time} ${dayLabel[scheduleRules.deadline.dayOfWeek] || ''}`;
  };

  const renderGridCell = (shift: Shift) => {
    const isLocked = shift.status === 'locked' || isWeekLocked || hasConfirmedWeek;
    const staffArr: any[] = (shift.staff as any)?.[userRole] || [];
    const myRegistration = staffArr.find((s: any) => s.userId === profile?.uid);
    const isMyShift = !!myRegistration;
    const isPending = myRegistration?.status === 'pending';
    
    const backups: any[] = (shift as any).backups?.[userRole] || [];
    const isMyBackup = backups.some((s: any) => s.userId === profile?.uid);
    
    const maxSlot = scheduleRules?.staffSlots?.[userRole] || 1;
    const isFull = staffArr.length >= maxSlot;
    
    const isWorkingOn = registeringTask === shift.id || registeringTask === shift.id + '_backup' || registeringTask === shift.id + '_confirm';

    // UI Styles based on state
    let bgClass = "bg-white border-blue-100 text-blue-600 hover:border-blue-400 hover:bg-blue-50";
    let label = "Đăng ký";

    if (isPending) {
      bgClass = "bg-amber-100 border-amber-400 text-amber-700 animate-pulse ring-2 ring-amber-200 ring-offset-1";
      label = "Xác nhận";
    } else if (isMyShift) {
      bgClass = "bg-green-600 border-green-700 text-white hover:bg-green-700";
      label = "Hủy nhận";
    } else if (isMyBackup) {
      bgClass = "bg-orange-500 border-orange-600 text-white hover:bg-orange-600";
      label = "Hủy dự bị";
    } else if (isFull) {
      bgClass = "bg-gray-100 border-gray-200 text-gray-400 hover:bg-orange-50 hover:text-orange-500 hover:border-orange-300";
      label = "Dự bị";
    }

    if (isLocked) {
      bgClass = isMyShift ? "bg-green-200 border-green-300 text-green-700 cursor-not-allowed" : "bg-gray-50 border-gray-100 text-gray-300 cursor-not-allowed";
      return (
        <div className={`w-full h-12 flex flex-col items-center justify-center rounded-lg border text-[10px] font-bold ${bgClass}`}>
          {isMyShift ? "Đã chốt" : ""}
        </div>
      );
    }

    const handleClick = () => {
       if (isPending) {
          if (window.confirm(`Bạn có đồng ý nhận ca ${shift.shiftName} không?`)) {
             handleConfirmShift(shift.id);
          } else {
             handleCancel(shift.id);
          }
       } else if (isMyShift || isMyBackup) {
          handleCancel(shift.id);
       } else if (isFull) {
          if (window.confirm("Ca đã đầy chính thức. Bạn muốn đăng ký Dự bị chứ?")) {
             handleRegisterBackup(shift.id);
          }
       } else {
          handleRegister(shift.id);
       }
    };

    return (
      <button
        onClick={handleClick}
        disabled={isWorkingOn}
        className={`w-full min-h-[48px] px-1 py-1 flex flex-col items-center justify-center rounded-lg border-2 transition-all duration-200 shadow-sm font-bold text-[10px] leading-tight ${bgClass}`}
      >
        {isWorkingOn ? (
          <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <>
            <div className="uppercase tracking-tighter mb-0.5">{label}</div>
            <div className={`text-[8px] font-normal ${isMyShift || isMyBackup ? 'text-white/80' : 'text-gray-400'}`}>
              {isFull && !isMyShift ? '(Hết chỗ)' : `${staffArr.length}/${maxSlot}`}
            </div>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="h-[100dvh] flex flex-col bg-gray-100 overflow-hidden">
      {/* Mobile Header */}
      <header className="bg-blue-600 text-white shadow-md z-50 shrink-0">
        <div className="px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <button onClick={() => changeWeek(-1)} disabled={weekOffset <= 1} className="p-1 hover:bg-blue-700 disabled:opacity-50 rounded-full transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div className="flex flex-col items-center justify-center min-w-[100px]">
              <h1 className="text-lg font-bold">Lịch {formatWeekLabel(weekId)}</h1>
              <span className="text-[10px] text-blue-200">
                {weekOffset === 1 ? '(Tuần Sau)' : `(Tới +${weekOffset} tuần)`}
              </span>
            </div>
            <button onClick={() => changeWeek(1)} className="p-1 hover:bg-blue-700 rounded-full transition-colors">
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>
          <button onClick={handleLogout} className="p-2 hover:bg-blue-700 rounded-full transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </div>
        <div className="px-4 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-blue-500 p-1.5 rounded-full">
              <User className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{profile?.fullName || 'Nhân viên'}</p>
              <p className="text-xs text-blue-200 capitalize">
                {(() => {
                  const roleKey = selectedPosition || profile?.role || 'cashier';
                  if (scheduleRules && scheduleRules.positionsConfig && scheduleRules.positionsConfig[roleKey]) {
                    return scheduleRules.positionsConfig[roleKey].name;
                  }
                  const legacyMap: Record<string, string> = {
                    manager: 'Quản lý', cashier: 'Thu ngân', ticket_checker: 'Soát vé'
                  };
                  return legacyMap[roleKey] || roleKey;
                })()}
              </p>
            </div>
          </div>
          <button 
            onClick={() => setShowMyScheduleModal(true)}
            className="text-right bg-blue-700/50 hover:bg-blue-800/50 p-2 rounded-xl transition-colors min-w-[80px]"
          >
            <p className="text-xs text-blue-100 flex items-center justify-end gap-1 mb-0.5">
              <Calendar className="w-3 h-3" /> Lịch của tôi
            </p>
            <p className="text-lg font-bold leading-none">{registeredCount} <span className="text-xs font-normal opacity-80">ca</span></p>
          </button>
        </div>

        {/* Cụm Chọn Vị Trí (Chỉ hiện nếu NV có > 1 vị trí) */}
        {profile?.positions && profile.positions.length > 1 && (
          <div className="px-4 pb-4">
            <div className="bg-blue-700/50 p-1.5 rounded-lg flex overflow-x-auto hide-scrollbar gap-1 custom-scrollbar">
              {[...profile.positions]
                .sort((a,b) => (scheduleRules?.positionsConfig?.[a]?.order || 0) - (scheduleRules?.positionsConfig?.[b]?.order || 0))
                .map(pos => {
                const getPosLabel = (p: string) => {
                  return scheduleRules?.positionsConfig?.[p]?.name || p;
                };
                return (
                  <button
                    key={pos}
                    onClick={() => setSelectedPosition(pos)}
                    className={`flex-1 min-w-[100px] py-1.5 px-3 rounded-md text-sm font-medium transition-all ${selectedPosition === pos ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:text-white hover:bg-blue-600/50'}`}
                  >
                    {getPosLabel(pos)}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Main Content - Grid Table */}
      <main className="flex-1 p-3 max-w-md mx-auto w-full flex flex-col min-h-0 gap-3 pb-safe">
        {loading ? (
          <div className="text-center text-gray-500 py-10">Đang tải lịch làm việc...</div>
        ) : scheduleData.length === 0 ? (
          <div className="text-center text-gray-500 py-10 bg-white rounded-xl border border-gray-200 shadow-sm p-6">
            <p className="font-medium text-gray-700">Chưa có lịch {formatWeekLabel(weekId)}</p>
            <p className="text-sm mt-2">Quản lý chưa thiết lập ca làm việc cho tuần này. Vui lòng quay lại sau.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0 bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
            {/* Thanh Vị trí (Không cần sticky vì cấu trúc flex) */}
            <div className="bg-blue-50/90 border-b border-blue-100 p-3 flex items-center justify-between shrink-0 z-30 shadow-sm relative">
              <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Đăng ký lịch tuần</span>
              <div className="flex gap-4">
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-green-500 rounded-sm"></div><span className="text-[10px] font-medium text-gray-600">Đã nhận</span></div>
                 <div className="flex items-center gap-1.5"><div className="w-3 h-3 bg-orange-500 rounded-sm"></div><span className="text-[10px] font-medium text-gray-600">Dự bị</span></div>
              </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar relative">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-40 shadow-sm">
                  <tr className="bg-gray-100">
                    <th className="p-3 text-left text-sm font-extrabold text-gray-700 uppercase border-b border-gray-200 sticky left-0 top-0 bg-gray-100 z-50 w-24 shadow-[2px_0_5px_rgba(0,0,0,0.02)]">Ngày</th>
                    {(() => {
                      const shiftTypes = scheduleRules?.shiftConfig ? Object.values(scheduleRules.shiftConfig) as any[] : [];
                      return shiftTypes.sort((a,b) => (a.startTime || '').localeCompare(b.startTime || '')).map((conf) => (
                        <th key={conf.name} className="p-3 text-center text-sm font-extrabold text-gray-700 uppercase border-b border-gray-100 min-w-[110px] sticky top-0 bg-gray-100 z-40">
                          <div>{conf.name}</div>
                          <div className="text-[9px] font-normal text-gray-400 lowercase">{conf.startTime}-{conf.endTime}</div>
                        </th>
                      ));
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {scheduleData.map((day) => {
                    const shiftTypes = scheduleRules?.shiftConfig ? Object.values(scheduleRules.shiftConfig) as any[] : [];
                    const sortedShiftTypes = shiftTypes.sort((a,b) => (a.startTime || '').localeCompare(b.startTime || ''));
                    
                    return (
                      <tr key={day.date} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors">
                        <td className="p-3 sticky left-0 bg-white z-20 border-r border-gray-100 shadow-[2px_0_5px_rgba(0,0,0,0.03)]">
                          <div className="font-bold text-gray-900 text-sm whitespace-nowrap">{day.dayName}</div>
                          <div className="text-[10px] text-gray-500">{day.date.split('-').reverse().slice(0,2).join('/')}</div>
                        </td>
                        
                        {sortedShiftTypes.map((conf) => {
                          const shift = day.shifts.find(s => s.shiftName === conf.name);
                          
                          // Check if shift is valid for today (based on rules)
                          const getDayKey = (dName: string) => {
                             const map: any = { 'Chủ Nhật': 'sunday', 'Thứ Hai': 'monday', 'Thứ Ba': 'tuesday', 'Thứ Tư': 'wednesday', 'Thứ Năm': 'thursday', 'Thứ Sáu': 'friday', 'Thứ Bảy': 'saturday' };
                             return map[dName] || 'monday';
                          };
                          const dayKey = getDayKey(day.dayName);
                          const targetDateStr = day.date;
                          const specialRule = scheduleRules?.specialDates?.find((d: any) => d.date === targetDateStr);
                          
                          const shiftIdConfig = Object.keys(scheduleRules?.shiftConfig || {}).find(k => scheduleRules.shiftConfig[k].name === conf.name);
                          let isValid = true;
                          if (shiftIdConfig) {
                             if (specialRule) {
                               isValid = specialRule.type !== 'closed' && (specialRule.shifts || []).includes(shiftIdConfig);
                             } else {
                               isValid = (scheduleRules?.weeklyDefaults?.[dayKey] || []).includes(shiftIdConfig);
                             }
                          }

                          if (!shift || !isValid) {
                            return <td key={conf.name} className="p-2 bg-gray-50/30"><div className="w-full h-8 border border-dashed border-gray-200 rounded flex items-center justify-center text-[9px] text-gray-300">Nghỉ</div></td>;
                          }

                          return (
                            <td key={conf.name} className="p-2 text-center align-middle">
                              {renderGridCell(shift)}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        
        {/* Nút Xác Nhận Tuần */}
        {registeredCount > 0 && !isWeekLocked && !hasConfirmedWeek && (
          <div className="shrink-0 pt-2">
            <button
              onClick={() => setShowConfirmModal(true)}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base shadow-[0_4px_14px_0_rgba(37,99,235,0.39)] flex items-center justify-center gap-2 transition-colors active:bg-blue-800 ring-2 ring-white"
            >
              <CheckCircle className="w-5 h-5" />
              Xác nhận tuần ({registeredCount} ca)
            </button>
          </div>
        )}
      </main>

      {/* MODAL XÁC NHẬN TUẦN */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="bg-green-500 text-white p-6 rounded-t-2xl text-center">
              <CheckCircle className="w-12 h-12 mx-auto mb-2" />
              <h2 className="text-xl font-bold">Đăng ký ca thành công!</h2>
              <p className="text-sm text-green-100 mt-1">
                Cảm ơn Bạn <b>{profile?.fullName}</b> đã hoàn tất đăng ký lịch làm việc cho Tuần <b>{getWeekDateRange()}</b>.
              </p>
            </div>

            {/* Body */}
            <div className="p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" /> Các ca bạn vừa đăng ký:
              </h3>
              <div className="space-y-2 max-h-[40vh] overflow-y-auto custom-scrollbar pr-1">
                {getMyRegisteredShifts().filter(s => s.myStatus !== 'backup').map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-100">
                    <div className="bg-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded min-w-[60px] text-center">
                      {item.dayName}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-gray-900">{item.shiftName} ({item.timeRange})</p>
                      <p className="text-xs text-gray-500">Vị trí: {item.roleName}</p>
                    </div>
                    {item.myStatus === 'pending' && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold animate-pulse">Chờ XN</span>}
                  </div>
                ))}
              </div>

              {/* Cảnh báo Kỷ luật */}
              <div className="mt-5 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="font-bold text-yellow-800 text-sm mb-2">⚠️ Lưu ý quan trọng:</h4>
                <ul className="text-xs text-yellow-700 space-y-1.5">
                  {getDeadlineLabel() && (
                    <li>• Hệ thống khóa sổ vào <b>{getDeadlineLabel()}</b>. Sau thời gian này, bạn không thể tự hủy ca trên app.</li>
                  )}
                  <li>• Việc vắng mặt không báo trước hoặc không có lý do chính đáng sẽ bị xử lý kỷ luật theo quy định của công ty.</li>
                </ul>
              </div>
            </div>

            {/* Footer */}
            <div className="p-5 pt-0 flex gap-3">
              <button
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold transition-colors"
                disabled={registeringTask === 'confirm_week'}
              >
                Đóng lại
              </button>
              <button
                onClick={handleConfirmWeek}
                className="flex-1 py-3 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold transition-colors shadow-lg"
                disabled={registeringTask === 'confirm_week'}
              >
                {registeringTask === 'confirm_week' ? 'Đang chốt...' : 'Chốt Lịch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white font-medium z-[100] transform transition-all duration-300 translate-y-0 opacity-100 flex items-center gap-2 ${toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMessage.msg}
        </div>
      )}

      {/* MODAL LỊCH CỦA TÔI (MY SCHEDULE) */}
      {showMyScheduleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between shrink-0">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-600" /> Lịch Của Tôi
              </h2>
              <button onClick={() => setShowMyScheduleModal(false)} className="p-1 rounded-full hover:bg-gray-100 transition-colors">
                <XCircle className="w-6 h-6 text-gray-400" />
              </button>
            </div>
            
            <div className="p-4 flex-1 overflow-y-auto custom-scrollbar bg-gray-50/50">
              <div className="flex justify-between items-end mb-4">
                <div>
                  <p className="text-sm text-gray-500">Tuần hiện tại</p>
                  <p className="font-bold text-blue-700">{getWeekDateRange()}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs px-2 py-1 rounded-full font-bold uppercase ${hasConfirmedWeek || isWeekLocked ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                    {hasConfirmedWeek || isWeekLocked ? 'Đã chốt sổ' : 'Chưa chốt'}
                  </span>
                </div>
              </div>

              {(() => {
                const shifts = getMyRegisteredShifts();
                if (shifts.length === 0) {
                  return (
                    <div className="text-center py-10 bg-white border border-dashed border-gray-200 rounded-xl">
                      <Calendar className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                      <p className="text-gray-500 font-medium text-sm">Bạn chưa có ca làm việc nào tuần này</p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {shifts.map((item: any, idx: number) => {
                      const isBackup = item.myStatus === 'backup';
                      const isPending = item.myStatus === 'pending';
                      
                      let containerClass = "bg-white border-gray-200 border-l-4 border-l-green-500";
                      let dayBadgeClass = "bg-gray-100 text-gray-700";
                      
                      if (isBackup) {
                        containerClass = "bg-orange-50/50 border-orange-200 border-l-4 border-l-orange-400";
                        dayBadgeClass = "bg-orange-100 text-orange-700";
                      } else if (isPending) {
                        containerClass = "bg-amber-50 border-amber-300 border-l-4 border-l-amber-500 shadow-md animate-pulse";
                        dayBadgeClass = "bg-amber-100 text-amber-800";
                      }

                      return (
                        <div key={idx} className={`flex items-center gap-3 p-3 rounded-xl border shadow-sm ${containerClass}`}>
                          <div className={`text-[10px] font-bold px-2 py-1 rounded min-w-[60px] text-center shrink-0 ${dayBadgeClass}`}>
                            {item.dayName}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <p className={`text-sm font-bold truncate pr-2 ${isBackup ? 'text-orange-900' : isPending ? 'text-amber-900' : 'text-gray-900'}`}>
                                {item.shiftName}
                              </p>
                              {isBackup && <span className="shrink-0 text-[10px] bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded font-bold">Dự bị</span>}
                              {isPending && <span className="shrink-0 text-[10px] bg-amber-500 text-white px-1.5 py-0.5 rounded font-bold">Xác nhận!</span>}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-[11px] text-gray-500 font-medium bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">{item.timeRange}</p>
                              <p className="text-[10px] text-gray-400 capitalize truncate">{item.roleName}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              
              {!(hasConfirmedWeek || isWeekLocked) && (
                <div className="mt-6 text-center">
                  <p className="text-xs text-gray-400 italic">Thoát ra để tiếp tục chọn ca trên bảng,<br/>hoặc "Xác nhận tuần" để chốt sổ báo Quản lý.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer bản quyền */}
      <footer className="bg-white border-t border-gray-200 py-2 text-center shrink-0">
        <p className="text-[11px] text-gray-400">© {new Date().getFullYear()} <span className="font-semibold text-gray-500">MinAds Soft</span></p>
      </footer>

    </div>
  );
}
