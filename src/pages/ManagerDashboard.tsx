import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Calendar, ChevronLeft, ChevronRight, Users, PlaySquare, Trash2, Settings, XCircle, Lock, Unlock, CheckCircle, AlertCircle, BarChart3, ShieldAlert } from 'lucide-react';
import { collection, doc, onSnapshot, getDocs, query, orderBy, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { generateWeeklySchedule, getStartOfWeek, generateWeekId, deleteWeeklySchedule } from '../services/schedule';
import { Shift } from '../types';
import { assignShiftApi, removeStaffFromShiftApi, removeBackupFromShiftApi } from '../firebase/api';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { logAction } from '../services/auditLog';

interface AppUser {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier' | 'ticket_checker';
  positions?: string[];
}

export default function ManagerDashboard() {
  const { profile, logout } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const navigate = useNavigate();
  
  const [currentDate, setCurrentDate] = useState(new Date());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [weekExists, setWeekExists] = useState<boolean | null>(null);
  const [isWeekLocked, setIsWeekLocked] = useState(false);
  
  // Realtime settings rules để đối chiếu ẩn hiện lưới
  const [scheduleRules, setScheduleRules] = useState<any>(null);

  // States cho Trám Ca
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedShiftForAssign, setSelectedShiftForAssign] = useState<{shiftId: string, role: string, shiftName: string, date: string} | null>(null);
  const [usersList, setUsersList] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'success'|'error', id: number} | null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    const id = Date.now();
    setToastMessage({ msg, type, id });
    if (type === 'success') {
      setTimeout(() => {
        setToastMessage(prev => prev?.id === id ? null : prev);
      }, 2000);
    }
  };
  
  // Filter state
  const [selectedFilterDay, setSelectedFilterDay] = useState<string>('all');

  const startOfWeek = getStartOfWeek(currentDate);
  const weekId = generateWeekId(startOfWeek);
  
  const formatWeekLabel = (wId: string) => {
    if (!wId || !wId.includes('-W')) return wId;
    const [year, week] = wId.split('-W');
    return `Tuần ${week} - ${year}`;
  };

  useEffect(() => {
    setLoading(true);
    // Listen to weekly_schedule document directly first to check if it exists
    const weekRef = doc(db, 'weekly_schedules', weekId);
    const unsubWeek = onSnapshot(weekRef, (docSnap) => {
      if (!docSnap.exists()) {
        setWeekExists(false);
        setIsWeekLocked(false);
        setShifts([]);
        setLoading(false);
      } else {
        setWeekExists(true);
        setIsWeekLocked(docSnap.data()?.isLocked || false);
        // If week exists, listen to shifts subcollection
        const shiftsQuery = query(
          collection(db, 'weekly_schedules', weekId, 'shifts'),
          orderBy('dateString', 'asc')
        );
        
        const unsubShifts = onSnapshot(shiftsQuery, (snapshot) => {
          const loadedShifts: Shift[] = [];
          snapshot.forEach(doc => {
            loadedShifts.push({ id: doc.id, ...doc.data() } as Shift);
          });
          setShifts(loadedShifts);
          setLoading(false);
        }, (error) => {
          console.error("Error fetching shifts:", error);
          setLoading(false);
        });
        
        return () => unsubShifts();
      }
    });

    // Listen to schedule_rules to dynamically hide inactive shifts
    const rulesRef = doc(db, 'settings', 'schedule_rules');
    const unsubRules = onSnapshot(rulesRef, (docSnap) => {
      if (docSnap.exists()) {
        setScheduleRules(docSnap.data());
      }
    });

    return () => {
      unsubWeek();
      unsubRules();
    };
  }, [weekId]);

  // Load User List for Assignment
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersSnap = await getDocs(collection(db, 'users'));
        const usersData: AppUser[] = [];
        usersSnap.forEach(userDoc => {
          const data = userDoc.data();
          if (data.status !== 'inactive') {
            usersData.push({ 
              id: userDoc.id, 
              name: data.name, 
              role: data.role as 'manager'|'cashier'|'ticket_checker',
              positions: data.positions // Nạp list positions để hiển thị trong Modal Trám Ca
            });
          }
        });
        setUsersList(usersData);
      } catch (error) {
        console.error("Error fetching users for assignment Modal:", error);
      }
    };
    fetchUsers();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleGenerateWeek = async () => {
    if (!window.confirm(`Bạn có chắc muốn tự động khởi tạo lịch làm việc cho ${weekId}?`)) return;
    setGenerating(true);
    try {
      await generateWeeklySchedule(currentDate);
      logAction('CREATE_WEEK_SCHEDULE', `Khởi tạo lịch tuần mới: ${weekId}`, profile?.uid || 'system', profile?.fullName || 'Manager', weekId);
      showToast('Đã khởi tạo lịch thành công!');
    } catch (error: any) {
      showToast('Lỗi khởi tạo: ' + error.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleToggleLockWeek = async () => {
    if (!window.confirm(`Bạn có chắc muốn ${isWeekLocked ? 'Mở Khóa' : 'CHỐT'} Lịch Tuần này? Mọi thao tác đổi Ca/Trám Ca/Nhận Lịch sẽ bị Khóa.`)) return;
    try {
      await setDoc(doc(db, 'weekly_schedules', weekId), { isLocked: !isWeekLocked }, { merge: true });
      logAction('CONFIRM_WEEK', `${!isWeekLocked ? 'Khóa/Chốt' : 'Mở khóa'} lịch tuần: ${weekId}`, profile?.uid || 'system', profile?.fullName || 'Manager', weekId);
      showToast(`Đã ${isWeekLocked ? 'Mở khóa' : 'Chốt'} lịch tuần này thành công!`);
    } catch (error: any) {
      showToast("Lỗi thao tác chốt lịch: " + error.message, 'error');
    }
  };

  const handleDeleteWeek = async () => {
    if (!window.confirm(`🚨 BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ LỊCH CỦA TUẦN ${weekId}?\n\nHành động này không thể hoàn tác!`)) return;
    setGenerating(true);
    try {
      await deleteWeeklySchedule(weekId);
      logAction('OTHER', `Xóa toàn bộ lịch tuần: ${weekId}`, profile?.uid || 'system', profile?.fullName || 'Manager', weekId);
      showToast('Đã xóa lịch tuần thành công!');
    } catch (error: any) {
      showToast('Lỗi khi xóa: ' + error.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const changeWeek = (offset: number) => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + offset * 7);
    setCurrentDate(d);
  };

  // Render danh sách nhân viên trong 1 ô (mảng)
  const renderStaffCell = (staffList: any[], backupsList: any[], shiftId: string, role: string, shiftName: string, date: string, maxSlot: number) => {
    const members = staffList || [];
    const backups = backupsList || [];
    const isFull = members.length >= maxSlot;

    return (
      <div className="space-y-1 mt-1">
        {members.map((member: any, idx: number) => (
          <div key={member.userId || idx} className="group relative">
            <div className={`px-2 py-1 flex items-center justify-between rounded border text-xs ${
                member.status === 'pending' 
                ? 'bg-amber-50 text-amber-700 border-amber-200' 
                : 'bg-blue-50 text-blue-700 border-blue-100'
              }`}>
              <span className="font-medium truncate flex-1">{member.name}</span>
              {member.status === 'pending' && <span className="text-[9px] font-bold uppercase tracking-wider ml-1 text-amber-600">(Chờ Xác nhận)</span>}
            </div>
            {!isWeekLocked && (
              <button 
                onClick={() => handleRemoveStaff(shiftId, role, member.userId)}
                className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200"
                title="Xóa khỏi ca"
              >
                <XCircle size={14} />
              </button>
            )}
          </div>
        ))}
        
        {backups.length > 0 && (
          <div className="mt-1 pt-1 border-t border-gray-100">
            <div className="text-[9px] uppercase text-orange-400 font-bold mb-0.5">Dự Bị</div>
            {backups.map((b: any, bIdx: number) => (
              <div key={b.userId || bIdx} className="group relative">
                <div className="bg-orange-50 text-orange-700 px-2 py-0.5 rounded border border-orange-100 text-xs mt-0.5 truncate pr-5">
                  {b.name}
                </div>
                {!isWeekLocked && (
                  <button 
                    onClick={() => handleRemoveBackup(shiftId, role, b.userId)}
                    className="absolute top-1/2 -translate-y-1/2 right-1 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 rounded-full"
                    title="Hủy dự bị"
                  >
                    <XCircle size={12} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {!isFull && !isWeekLocked && (
          <button 
            onClick={() => {
              setSelectedShiftForAssign({ shiftId, role, shiftName, date });
              setIsAssignModalOpen(true);
            }}
            className="w-full bg-white border border-dashed border-gray-300 text-gray-400 hover:text-blue-500 hover:border-blue-400 hover:bg-blue-50 px-2 py-1 rounded text-xs flex items-center justify-center transition-colors mt-1"
          >
            + Bổ sung
          </button>
        )}
        {isWeekLocked && members.length === 0 && (
          <div className="w-full bg-gray-50 border border-dashed border-gray-200 text-gray-300 font-medium px-2 py-1 rounded text-xs flex items-center justify-center cursor-not-allowed mt-1">
            Trống
          </div>
        )}
      </div>
    );
  };

  const handleRemoveStaff = async (shiftId: string, role: string, targetUserId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa nhân sự này khỏi ca?")) return;
    try {
      await removeStaffFromShiftApi(weekId, shiftId, role, targetUserId);
      showToast("Đã xóa nhân sự khỏi ca!");
    } catch (error: any) {
      showToast("Lỗi: " + error.message, 'error');
    }
  };

  const handleRemoveBackup = async (shiftId: string, role: string, targetUserId: string) => {
    if (!window.confirm("Bạn có chắc muốn xóa nhân sự này khỏi danh sách dự bị?")) return;
    try {
      await removeBackupFromShiftApi(weekId, shiftId, role, targetUserId);
      showToast("Đã xóa khỏi danh sách dự bị!");
    } catch (error: any) {
      showToast("Lỗi: " + error.message, 'error');
    }
  };

  const submitAssignment = async () => {
    if (!selectedShiftForAssign || !selectedUserId) return;
    
    const userToAssign = usersList.find(u => u.id === selectedUserId);
    if (!userToAssign) return;

    setIsAssigning(true);
    try {
      await assignShiftApi(
        weekId, 
        selectedShiftForAssign.shiftId, 
        selectedShiftForAssign.role, 
        userToAssign.id, 
        userToAssign.name
      );
      setIsAssignModalOpen(false);
      setSelectedUserId('');
      showToast("Trám ca thành công!");
    } catch (error: any) {
      showToast("Lỗi trám ca: " + error.message, 'error');
    } finally {
      setIsAssigning(false);
    }
  };

  const todayVN = new Date().toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"});
  const todayObj = new Date(todayVN);
  const todayDateStr = `${todayObj.getDate().toString().padStart(2, '0')}/${(todayObj.getMonth() + 1).toString().padStart(2, '0')}/${todayObj.getFullYear()}`;

  const allDaysLabels = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(d.getDate() + i);
    const dayNames = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    return {
      dayName: dayNames[d.getDay()],
      dateStr: dateStr,
      isToday: dateStr === todayDateStr
    };
  });
  
  const daysLabels = selectedFilterDay === 'all' 
    ? allDaysLabels 
    : allDaysLabels.filter(d => d.dateStr === selectedFilterDay);
  
  // Lấy danh sách Ca từ SETTINGS trước (ưu tiên), fallback sang DB data
  const shiftTypes = (() => {
    if (scheduleRules?.shiftConfig) {
      return Object.keys(scheduleRules.shiftConfig)
        .sort()
        .map(k => scheduleRules.shiftConfig[k].name as string);
    }
    const uniqueShiftNames = Array.from(new Set(shifts.map(s => s.shiftName))).sort();
    return uniqueShiftNames.length > 0 ? uniqueShiftNames : ['Ca 1', 'Ca 2', 'Ca 3'];
  })();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg relative z-20 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3 md:gap-4 lg:justify-between">
          <div className="flex items-center gap-3 min-w-[200px] flex-1 lg:flex-none">
            {companyInfo.logoBase64 ? (
              <img src={companyInfo.logoBase64} alt="Logo" className="w-9 h-9 object-contain rounded-lg border border-white/30 bg-white/10 p-0.5 shrink-0" />
            ) : (
              <div className="bg-white/20 p-2 rounded-lg shrink-0">
                <Calendar className="text-white w-5 h-5" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white truncate">{companyInfo.companyName || 'Lịch Quản Lý'}</h1>
          </div>
          
          {/* Nav Tabs */}
          <div className="flex w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0 gap-1 bg-white/10 p-1 rounded-lg order-3 lg:order-2">
            <button 
              className="px-3 md:px-4 py-2 text-sm font-medium rounded-md bg-white text-blue-800 shadow-sm flex items-center gap-1 md:gap-2 shrink-0"
            >
              <Calendar size={16}/> Lịch
            </button>
            <button 
              onClick={() => navigate('/manager/dashboard')}
              className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
            >
              <BarChart3 size={16}/> Thống kê
            </button>
            <button 
              onClick={() => navigate('/manager/users')}
              className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
            >
              <Users size={16}/> Nhân sự
            </button>
            {profile?.role === 'admin' && (
              <>
                <button 
                  onClick={() => navigate('/manager/settings')}
                  className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
                >
                  <Settings size={16}/> Cài đặt
                </button>
                <button 
                  onClick={() => navigate('/manager/audit-logs')}
                  className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
                >
                  <ShieldAlert size={16}/> Nhật ký
                </button>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 lg:gap-4 order-2 lg:order-3 ml-auto shrink-0 justify-end flex-wrap">
            <div className="flex items-center gap-1 sm:gap-2 bg-white/15 rounded-lg p-1 shrink-0">
              <button onClick={() => changeWeek(-1)} className="p-1 hover:bg-white/20 rounded text-white/80 transition-colors"><ChevronLeft size={18} /></button>
              <span className="font-bold text-white px-2 text-xs sm:text-sm whitespace-nowrap">{formatWeekLabel(weekId)}</span>
              <button onClick={() => changeWeek(1)} className="p-1 hover:bg-white/20 rounded text-white/80 transition-colors"><ChevronRight size={18} /></button>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 shrink-0">
              <span className="text-sm font-medium text-white/90 hidden sm:block whitespace-nowrap">{profile?.fullName || 'Manager'}</span>
              
              {weekExists && (
                <div className="flex items-center gap-1.5 shrink-0">
                  <button 
                    onClick={handleToggleLockWeek}
                    className={`flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 rounded-md font-medium transition-colors shadow-sm ${
                      isWeekLocked 
                        ? 'bg-amber-400/90 hover:bg-amber-400 text-amber-900' 
                        : 'bg-emerald-400/90 hover:bg-emerald-400 text-emerald-900'
                    }`}
                    title={isWeekLocked ? 'Mở khóa để tiếp tục xếp lịch' : 'Chốt lịch: Không cho phép đổi thông tin nữa'}
                  >
                    {isWeekLocked ? <Lock size={16} /> : <Unlock size={16} />}
                    <span className="hidden sm:inline ml-1.5 text-xs whitespace-nowrap">{isWeekLocked ? 'Đã Chốt' : 'Đang Mở'}</span>
                  </button>
                  <button 
                    onClick={handleDeleteWeek}
                    disabled={generating}
                    title="Xóa Lịch Tuần này"
                    className="flex items-center justify-center w-8 h-8 sm:w-auto sm:px-3 sm:py-1.5 bg-red-400/80 hover:bg-red-400 text-white rounded-md font-medium transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
              
              <button 
                onClick={handleLogout} 
                className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white/90 rounded-md font-medium transition-colors shrink-0"
              >
                Thoát
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 w-full flex flex-col">
        {/* Filter Day Mobile */}
        <div className="md:hidden flex mb-4 items-center bg-white border border-gray-200 rounded-lg px-2 shadow-sm text-sm w-full">
          <span className="text-gray-500 font-medium pl-2 pr-1 py-3">Hiển thị:</span>
          <select 
            value={selectedFilterDay}
            onChange={(e) => setSelectedFilterDay(e.target.value)}
            className="flex-1 bg-transparent text-gray-800 font-semibold py-3 border-none focus:ring-0 outline-none cursor-pointer"
          >
            <option value="all">Toàn bộ 7 ngày</option>
            {allDaysLabels.map(d => (
              <option key={d.dateStr} value={d.dateStr} className="font-medium">
                {d.dayName} {d.isToday ? '- Hôm nay' : ''}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Đang tải biểu đồ lịch...</div>
        ) : !weekExists ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 p-12">
            <Calendar size={64} className="text-gray-300 mb-4" />
            <h2 className="text-xl font-bold text-gray-700 mb-2">Chưa có lịch cho {formatWeekLabel(weekId)}</h2>
            <p className="text-gray-500 mb-6 max-w-md text-center">Tuần này chưa được khởi tạo trên hệ thống. Hãy bấm nút dưới đây để tạo sẵn danh sách 21 ca làm việc trống.</p>
            <button 
              onClick={handleGenerateWeek}
              disabled={generating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-3 rounded-lg font-medium shadow-sm transition-all"
            >
              <PlaySquare size={20} />
              {generating ? 'Đang tạo danh sách...' : 'Khởi tạo Lịch Tuần'}
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 overflow-auto custom-scrollbar relative max-h-[75vh] md:max-h-[calc(100vh-200px)]">
              <table className="w-full border-collapse md:table-fixed">
                <thead className="sticky top-0 z-40 shadow-sm relative">
                  <tr className="bg-gray-100">
                    <th className="p-4 text-center text-sm font-bold text-gray-500 border-b border-gray-200 sticky left-0 top-0 bg-gray-100 z-50 w-28 lg:w-36 shadow-[2px_0_5px_rgba(0,0,0,0.02)] align-middle border-r">
                      Ca Làm Việc
                    </th>
                    {daysLabels.map((day) => (
                      <th key={day.dateStr} className={`p-4 text-center border-b border-r border-gray-200 min-w-[120px] md:min-w-0 md:w-[12%] sticky top-0 bg-gray-50 z-30 align-middle ${day.isToday ? 'bg-blue-50/90' : ''}`}>
                        <div className="flex flex-col items-center relative">
                          {day.isToday && <span className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full z-10">Hôm nay</span>}
                          <span className={`font-bold mt-1 ${day.isToday ? 'text-blue-800' : 'text-gray-700'}`}>{day.dayName}</span>
                          <span className={`text-xs font-medium ${day.isToday ? 'text-blue-600' : 'text-gray-500'}`}>{day.dateStr}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>

                {shiftTypes.map((shiftName) => {
                  const shiftIdKey = scheduleRules ? Object.keys(scheduleRules.shiftConfig || {}).find(
                    k => scheduleRules.shiftConfig[k].name === shiftName
                  ) : null;
                  const shiftTimeRange = shiftIdKey && scheduleRules?.shiftConfig[shiftIdKey]
                    ? `${scheduleRules.shiftConfig[shiftIdKey].startTime} - ${scheduleRules.shiftConfig[shiftIdKey].endTime}`
                    : shifts.find(s => s.shiftName === shiftName)?.timeString || '--:--';

                  return (
                    <tr key={shiftName} className="border-b border-gray-200 last:border-0 hover:bg-gray-50/40 transition-colors">
                      <td className="p-4 border-r border-gray-200 bg-white sticky left-0 z-20 shadow-[2px_0_5px_rgba(0,0,0,0.02)] align-middle">
                        <div className="flex flex-col justify-center">
                          <span className="font-bold text-gray-900">{shiftName}</span>
                          <span className="text-xs text-gray-500 mt-1">{shiftTimeRange}</span>
                        </div>
                      </td>

                      {daysLabels.map((day) => {
                    const dbSearchMap: Record<string, string> = {
                      'Thứ Hai': 'Thứ 2', 'Thứ Ba': 'Thứ 3', 'Thứ Tư': 'Thứ 4',
                      'Thứ Năm': 'Thứ 5', 'Thứ Sáu': 'Thứ 6', 'Thứ Bảy': 'Thứ 7', 'Chủ Nhật': 'Thứ 8'
                    };
                    const searchDay = dbSearchMap[day.dayName] || day.dayName;
                    
                    // Fallback try both 'Thứ 2' and 'Thứ Hai' format
                    const shift = shifts.find(s => (s.date === searchDay || s.date === day.dayName || s.date === 'CN') && s.shiftName === shiftName);
                    
                    // Logic check rules realtime
                    let isShiftActiveInSettings = false;
                    if (scheduleRules) {
                      const getDayKey = (dName: string) => {
                        const map: Record<string, string> = {
                          'Chủ Nhật': 'sunday', 'Thứ Hai': 'monday', 'Thứ Ba': 'tuesday',
                          'Thứ Tư': 'wednesday', 'Thứ Năm': 'thursday', 'Thứ Sáu': 'friday', 'Thứ Bảy': 'saturday'
                        };
                        return map[dName] || 'monday';
                      };
                      
                      const dayKeyStr = getDayKey(day.dayName);
                      // Format the day's date
                      const targetDateParts = day.dateStr.split('/'); // DD/MM/YYYY
                      const targetDateStr = `${targetDateParts[2]}-${targetDateParts[1]}-${targetDateParts[0]}`; // YYYY-MM-DD
                      
                      // Check special dates first
                      const specialRule = scheduleRules.specialDates?.find((d: any) => d.date === targetDateStr);
                      // Tìm shiftId tương ứng với shiftName này (e.g. 'ca1', 'ca2')
                      const shiftIdConfig = Object.keys(scheduleRules.shiftConfig || {}).find(
                        k => scheduleRules.shiftConfig[k].name === shiftName
                      );

                      if (shiftIdConfig) {
                        if (specialRule) {
                          if (specialRule.type !== 'closed') {
                            isShiftActiveInSettings = !!(specialRule.shifts && specialRule.shifts.includes(shiftIdConfig));
                          }
                          // type === 'closed' → isShiftActiveInSettings stays false
                        } else {
                          const dayShifts = scheduleRules.weeklyDefaults?.[dayKeyStr];
                          isShiftActiveInSettings = !!(dayShifts && Array.isArray(dayShifts) && dayShifts.includes(shiftIdConfig));
                        }
                      }
                    } else {
                      // Nếu chưa load dc rules, render tạm bằng default shifts state
                      isShiftActiveInSettings = !!shift;
                    }
                    // Hiển thị "Nghỉ" nếu: không có shift trong DB VÀ settings nói không khả dụng
                    if (!shift && !isShiftActiveInSettings) {
                      return (
                        <td key={day.dayName} className={`border-r border-gray-200 p-3 align-top ${day.isToday ? 'bg-blue-50/20' : 'bg-gray-100/50'}`}>
                          <div className={`w-full h-full min-h-[80px] border-2 border-dashed ${day.isToday ? 'border-blue-200' : 'border-gray-200'} rounded-lg flex items-center justify-center relative overflow-hidden`}>
                            <div className={`absolute w-full h-0.5 ${day.isToday ? 'bg-blue-200' : 'bg-gray-200'} transform -rotate-45`}></div>
                            <span className={`text-xs font-medium z-10 px-2 rounded ${day.isToday ? 'bg-blue-50 text-blue-400' : 'bg-gray-100/80 text-gray-400'}`}>Nghỉ</span>
                          </div>
                        </td>
                      );
                    }

                    if (!shift) {
                      return (
                        <td key={day.dayName} className={`border-r border-gray-200 p-3 align-top ${day.isToday ? 'bg-blue-50/20' : 'bg-yellow-50/50'}`}>
                          <div className={`w-full h-full min-h-[80px] border-2 border-dashed ${day.isToday ? 'border-blue-300' : 'border-yellow-200'} rounded-lg flex items-center justify-center`}>
                            <span className={`${day.isToday ? 'text-blue-500' : 'text-yellow-400'} text-xs font-medium`}>Chưa tạo</span>
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={day.dayName} className={`p-3 border-r border-gray-200 align-top ${day.isToday ? 'bg-blue-50/30' : ''}`}>
                        <div className="flex flex-col gap-2 h-full">
                          {scheduleRules && Object.entries(scheduleRules.positionsConfig || {})
                              .sort((a,b) => ((a[1] as any).order || 0) - ((b[1] as any).order || 0))
                              .map(([posId, posInfo]: [string, any]) => (
                              <div key={posId} className="flex border-t border-gray-100/50 pt-2 first:border-t-0 first:pt-0">
                                <div className="w-20 text-[11px] font-semibold text-gray-500 pt-1 pr-2 uppercase truncate" title={posInfo.name}>{posInfo.name}</div>
                                <div className="flex-1">
                                {renderStaffCell(shift.staff?.[posId] || [], shift.backups?.[posId] || [], shift.id, posId, shift.shiftName, day.dateStr, scheduleRules?.staffSlots?.[posId] || 1)}
                                </div>
                              </div>
                            ))}
                        </div>
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
      </main>

      {/* MODAL TRÁM CA */}
      {isAssignModalOpen && selectedShiftForAssign && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Trám / Bổ sung Ca</h3>
            <p className="text-sm text-gray-500 mb-6">
              Chỉ định nhân viên thay thế cho <b>{selectedShiftForAssign.shiftName} - Ngày {selectedShiftForAssign.date}</b>.
            </p>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chọn người đảm nhận vị trí: <span className="uppercase text-blue-600 font-bold">{
                  scheduleRules?.positionsConfig?.[selectedShiftForAssign.role]?.name || selectedShiftForAssign.role
                }</span>
              </label>
              <select 
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full border-gray-300 rounded-lg shadow-sm p-2.5 bg-gray-50 border focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">-- Chọn nhân sự (cùng Vị trí) --</option>
                {usersList
                  .filter(u => (u.positions && u.positions.includes(selectedShiftForAssign.role)) || u.role === selectedShiftForAssign.role)
                  .map(user => (
                    <option key={user.id} value={user.id}>{user.name}</option>
                  ))
                }
              </select>
            </div>

            <div className="flex justify-end gap-3 mt-8">
              <button 
                onClick={() => {
                  setIsAssignModalOpen(false);
                  setSelectedUserId('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={submitAssignment}
                disabled={!selectedUserId || isAssigning}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-medium rounded-lg flex items-center justify-center min-w-[120px]"
              >
                {isAssigning ? 'Đang xử lý...' : 'Xác nhận Trám'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white font-medium z-[100] transform transition-all duration-300 translate-y-0 opacity-100 flex items-center gap-2 ${toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600 pl-4 py-2 pr-2'}`}>
          {toastMessage.type === 'success' ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
          <div className="flex-1 mr-4">{toastMessage.msg}</div>
          {toastMessage.type === 'error' && (
            <button onClick={() => setToastMessage(null)} className="p-1.5 hover:bg-red-700 rounded-lg transition-colors bg-red-500/20">
              <XCircle size={18} />
            </button>
          )}
        </div>
      )}

      {/* Footer bản quyền */}
      <footer className="bg-gradient-to-r from-blue-900 to-blue-800 py-2 text-center shrink-0">
        <p className="text-[11px] text-white/50">© {new Date().getFullYear()} <span className="font-semibold text-white/70">MinAds Soft</span></p>
      </footer>
    </div>
  );
}
