import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Calendar, Users, Save, Plus, Trash2, AlertCircle, CheckCircle, XCircle, BarChart3, Upload, Building2, Phone, MapPin, Type, Image, ChevronUp, ChevronDown, ShieldAlert } from 'lucide-react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useCompanyInfo } from '../hooks/useCompanyInfo';
import { logAction } from '../services/auditLog';

interface ShiftConfig {
  name: string;
  startTime: string;
  endTime: string;
}

interface SpecialDate {
  date: string; // YYYY-MM-DD
  reason: string;
  type: 'closed' | 'custom';
  shifts: string[]; // ['ca1', 'ca2']
}

interface PositionConfig {
  name: string;
  color?: string; // Tương lai có thể map color riêng tư
  order?: number; // Thứ tự hiển thị
}

interface ScheduleRules {
  shiftConfig: Record<string, ShiftConfig>;
  positionsConfig: Record<string, PositionConfig>;
  weeklyDefaults: {
    monday: string[];
    tuesday: string[];
    wednesday: string[];
    thursday: string[];
    friday: string[];
    saturday: string[];
    sunday: string[];
  };
  deadline: {
    dayOfWeek: string;
    time: string;
  };
  staffSlots: Record<string, number>;
  specialDates: SpecialDate[];
}

const DEFAULT_RULES: ScheduleRules = {
  shiftConfig: {
    ca1: { name: "Ca 1", startTime: "08:00", endTime: "12:00" },
    ca2: { name: "Ca 2", startTime: "13:00", endTime: "17:00" },
    ca3: { name: "Ca 3", startTime: "18:00", "endTime": "22:00" }
  },
  weeklyDefaults: {
    monday: ["ca3"],
    tuesday: ["ca3"],
    wednesday: ["ca3"],
    thursday: ["ca3"],
    friday: ["ca3"],
    saturday: ["ca2", "ca3"],
    sunday: ["ca1", "ca2", "ca3"]
  },
  positionsConfig: {
    manager: { name: "Quản lý", order: 0 },
    cashier: { name: "Thu ngân", order: 1 },
    ticket_checker: { name: "Soát vé", order: 2 }
  },
  deadline: {
    dayOfWeek: 'sunday',
    time: '23:59'
  },
  staffSlots: {
    manager: 1,
    cashier: 1,
    ticket_checker: 1
  },
  specialDates: []
};

const DAY_NAMES = [
  { key: 'monday', label: 'Thứ Hai' },
  { key: 'tuesday', label: 'Thứ Ba' },
  { key: 'wednesday', label: 'Thứ Tư' },
  { key: 'thursday', label: 'Thứ Năm' },
  { key: 'friday', label: 'Thứ Sáu' },
  { key: 'saturday', label: 'Thứ Bảy' },
  { key: 'sunday', label: 'Chủ Nhật' },
];

export default function Settings() {
  const { profile, logout } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const navigate = useNavigate();
  
  const [rules, setRules] = useState<ScheduleRules>(DEFAULT_RULES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Company Info states
  const [companyName, setCompanyName] = useState('');
  const [companySlogan, setCompanySlogan] = useState('');
  const [companyLogoBase64, setCompanyLogoBase64] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [savingCompany, setSavingCompany] = useState(false);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Form states cho Special Date
  const [newSpecialDate, setNewSpecialDate] = useState<SpecialDate>({
    date: '',
    reason: '',
    type: 'closed',
    shifts: []
  });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'schedule_rules');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as ScheduleRules;
          // Fallback cho db cũ chưa có positionsConfig
          if (!data.positionsConfig) {
            data.positionsConfig = DEFAULT_RULES.positionsConfig;
          }
          setRules({ ...DEFAULT_RULES, ...data });
        } else {
          // Khởi tạo mặc định nếu chưa có
          await setDoc(docRef, DEFAULT_RULES);
        }
      } catch (error) {
        console.error("Lỗi tải cài đặt:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  // Fetch Company Info
  useEffect(() => {
    const fetchCompanyInfo = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'company_info'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          setCompanyName(data.companyName || '');
          setCompanySlogan(data.slogan || '');
          setCompanyLogoBase64(data.logoBase64 || '');
          setCompanyAddress(data.address || '');
          setCompanyPhone(data.phone || '');
        }
      } catch (e) {
        console.error('Lỗi tải thông tin công ty:', e);
      }
    };
    fetchCompanyInfo();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleSaveCompanyInfo = async () => {
    setSavingCompany(true);
    try {
      await setDoc(doc(db, 'settings', 'company_info'), {
        companyName: companyName.trim(),
        slogan: companySlogan.trim(),
        logoBase64: companyLogoBase64,
        address: companyAddress.trim(),
        phone: companyPhone.trim(),
      });
      showToast('Đã lưu thông tin Công ty!');
    } catch (error) {
      console.error(error);
      showToast('Lỗi khi lưu thông tin', 'error');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 200 * 1024) {
      showToast('Logo phải nhỏ hơn 200KB!', 'error');
      return;
    }
    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn file ảnh!', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCompanyLogoBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'schedule_rules'), rules);
      logAction('UPDATE_SHIFT_CONFIG', 'Cập nhật cấu hình và quy luật chia ca tuần', profile?.uid || 'system', profile?.fullName || 'Admin', 'schedule_rules');
      showToast('Đã lưu cấu hình Lịch thành công!');
    } catch (error) {
      console.error(error);
      showToast('Lỗi khi lưu cấu hình', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleWeeklyShiftToggle = (dayKey: keyof ScheduleRules['weeklyDefaults'], shiftId: string) => {
    setRules(prev => {
      const dayShifts = prev.weeklyDefaults[dayKey];
      let newShifts = [...dayShifts];
      if (dayShifts.includes(shiftId)) {
        newShifts = newShifts.filter(id => id !== shiftId);
      } else {
        newShifts.push(shiftId);
        newShifts.sort(); // Keep order
      }
      return {
        ...prev,
        weeklyDefaults: {
          ...prev.weeklyDefaults,
          [dayKey]: newShifts
        }
      };
    });
  };

  // CRUD Ca làm việc
  const handleAddShift = () => {
    setRules(prev => {
      const existingIds = Object.keys(prev.shiftConfig).map(k => parseInt(k.replace('ca', ''))).filter(n => !isNaN(n));
      const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
      const newKey = `ca${nextId}`;
      return {
        ...prev,
        shiftConfig: {
          ...prev.shiftConfig,
          [newKey]: { name: `Ca ${nextId}`, startTime: "08:00", endTime: "12:00" }
        }
      };
    });
  };

  const handleUpdateShift = (key: string, field: keyof ShiftConfig, value: string) => {
    setRules(prev => ({
      ...prev,
      shiftConfig: {
        ...prev.shiftConfig,
        [key]: {
          ...prev.shiftConfig[key],
          [field]: value
        }
      }
    }));
  };

  const handleRemoveShift = (key: string) => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa Ca này? Lịch sử tuần cũ có thể bị ảnh hưởng nếu tuần đó chưa chốt.")) return;
    
    // Log the current shift name before removal
    const shiftName = rules.shiftConfig[key]?.name || key;
    logAction('DELETE_SHIFT_CONFIG', `Xóa khung giờ ca làm việc: ${shiftName}`, profile?.uid || 'system', profile?.fullName || 'Admin', key);

    setRules(prev => {
      const newConfig = { ...prev.shiftConfig };
      delete newConfig[key];
      
      const newWeekly = { ...prev.weeklyDefaults };
      Object.keys(newWeekly).forEach(day => {
        newWeekly[day as keyof typeof newWeekly] = newWeekly[day as keyof typeof newWeekly].filter(id => id !== key);
      });

      const newSpecial = prev.specialDates.map(sd => ({
        ...sd,
        shifts: sd.shifts.filter(id => id !== key)
      }));

      return {
        ...prev,
        shiftConfig: newConfig,
        weeklyDefaults: newWeekly,
        specialDates: newSpecial
      };
    });
  };

  const handleAddSpecialDate = () => {
    if (!newSpecialDate.date || !newSpecialDate.reason) {
      showToast("Vui lòng nhập Ngày và Lý do/Tên sự kiện", 'error');
      return;
    }
    
    logAction('ADD_SPECIAL_DATE', `Thêm ngày ngoại lệ: ${newSpecialDate.date} (${newSpecialDate.reason})`, profile?.uid || 'system', profile?.fullName || 'Admin', newSpecialDate.date);

    setRules(prev => ({
      ...prev,
      specialDates: [...prev.specialDates, newSpecialDate].sort((a, b) => a.date.localeCompare(b.date))
    }));
    setNewSpecialDate({ date: '', reason: '', type: 'closed', shifts: [] });
  };

  const handleRemoveSpecialDate = (index: number) => {
    setRules(prev => {
      const newDates = [...prev.specialDates];
      const removed = newDates.splice(index, 1)[0];
      logAction('REMOVE_SPECIAL_DATE', `Xóa ngày ngoại lệ: ${removed.date} (${removed.reason})`, profile?.uid || 'system', profile?.fullName || 'Admin', removed.date);
      return { ...prev, specialDates: newDates };
    });
  };

  const handleSpecialDateShiftToggle = (shiftId: string) => {
    setNewSpecialDate(prev => {
      let newShifts = [...prev.shifts];
      if (newShifts.includes(shiftId)) {
        newShifts = newShifts.filter(id => id !== shiftId);
      } else {
        newShifts.push(shiftId);
        newShifts.sort();
      }
      return { ...prev, shifts: newShifts };
    });
  };

  // --- CRUD Vị Trí (Position) ---
  const [newPosId, setNewPosId] = useState('');
  const [newPosName, setNewPosName] = useState('');

  const handleAddPosition = () => {
    if (!newPosId.trim() || !newPosName.trim()) {
      showToast("Vui lòng nhập Mã và Tên vị trí", 'error');
      return;
    }
    const cleanId = newPosId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (rules.positionsConfig[cleanId]) {
      showToast("Mã vị trí đã tồn tại!", 'error');
      return;
    }

    setRules(prev => {
      // Tìm số order lớn nhất hiện tại
      const maxOrder = Math.max(-1, ...Object.values(prev.positionsConfig).map(p => p.order || 0));
      
      return {
        ...prev,
        positionsConfig: {
          ...prev.positionsConfig,
          [cleanId]: { name: newPosName.trim(), order: maxOrder + 1 }
        },
        staffSlots: {
          ...prev.staffSlots,
          [cleanId]: 1 // Default 1 slot cho vị trí mới
        }
      };
    });
    setNewPosId('');
    setNewPosName('');
  };

  const handleUpdatePositionName = (id: string, newName: string) => {
    setRules(prev => ({
      ...prev,
      positionsConfig: {
        ...prev.positionsConfig,
        [id]: { ...prev.positionsConfig[id], name: newName }
      }
    }));
  };

  const handleRemovePosition = (id: string) => {
    if (['manager', 'cashier', 'ticket_checker'].includes(id)) {
      if (!window.confirm("Đây là vị trí hệ thống mặc định. Bạn có chắc chắn muốn xóa? Lịch sử cũ có thể bị mất nếu chưa chốt.")) return;
    } else {
      if (!window.confirm(`Bạn có chắc muốn xóa vị trí "${rules.positionsConfig[id].name}"?`)) return;
    }

    const positionName = rules.positionsConfig[id]?.name || id;
    logAction('UPDATE_POSITION_CONFIG', `Xóa chức vụ/vị trí: ${positionName}`, profile?.uid || 'system', profile?.fullName || 'Admin', id);

    setRules(prev => {
      const newConfig = { ...prev.positionsConfig };
      delete newConfig[id];
      const newSlots = { ...prev.staffSlots };
      delete newSlots[id];

      return {
        ...prev,
        positionsConfig: newConfig,
        staffSlots: newSlots
      };
    });
  };

  const handleMovePosition = (id: string, direction: 'up' | 'down') => {
    setRules(prev => {
      const positionsObj = { ...prev.positionsConfig };
      const posArray = Object.entries(positionsObj).sort((a,b) => (a[1].order || 0) - (b[1].order || 0));
      const idx = posArray.findIndex(p => p[0] === id);
      
      if (idx < 0) return prev;
      if (direction === 'up' && idx === 0) return prev;
      if (direction === 'down' && idx === posArray.length - 1) return prev;
      
      const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
      
      // Hoán đổi giá trị order của 2 vị trí
      const currentOrder = posArray[idx][1].order || idx;
      const targetOrder = posArray[targetIdx][1].order || targetIdx;
      
      positionsObj[id] = { ...positionsObj[id], order: targetOrder };
      positionsObj[posArray[targetIdx][0]] = { ...positionsObj[posArray[targetIdx][0]], order: currentOrder };

      return { ...prev, positionsConfig: positionsObj };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-gradient-to-r from-blue-800 to-blue-600 shadow-lg relative z-20 shrink-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center gap-3 md:gap-4 lg:justify-between">
          <div className="flex items-center gap-3 flex-1 lg:flex-none">
            {companyInfo.logoBase64 ? (
              <img src={companyInfo.logoBase64} alt="Logo" className="w-9 h-9 object-contain rounded-lg border border-white/30 bg-white/10 p-0.5 shrink-0" />
            ) : (
              <div className="bg-white/20 p-2 rounded-lg shrink-0">
                <SettingsIcon className="text-white w-5 h-5" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white truncate">{companyInfo.companyName || 'Cài đặt'}</h1>
          </div>
          
          {/* Nav Tabs - luôn hiển thị, cuộn ngang trên mobile */}
          <div className="flex w-full md:w-auto overflow-x-auto custom-scrollbar pb-1 md:pb-0 gap-1 bg-white/10 p-1 rounded-lg order-3 lg:order-2">
            <button 
              onClick={() => navigate('/manager')}
              className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
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
                  className="px-3 md:px-4 py-2 text-sm font-medium rounded-md bg-white text-blue-800 shadow-sm flex items-center gap-1 md:gap-2 shrink-0"
                >
                  <SettingsIcon size={16}/> Cài đặt
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

          <div className="flex items-center gap-2 sm:gap-4 order-2 lg:order-3 ml-auto shrink-0">
            <span className="text-sm font-medium text-white/90 hidden sm:block whitespace-nowrap">{profile?.fullName || 'Admin'}</span>
            <button 
              onClick={handleLogout} 
              className="text-xs sm:text-sm px-2 sm:px-3 py-1.5 bg-white/15 hover:bg-white/25 text-white/90 rounded-md font-medium transition-colors shrink-0"
            >
              Thoát
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Thiết lập Sinh Lịch Tự Động</h2>
            <p className="text-sm text-gray-500 mt-1">Cấu hình Ca làm việc mặc định và Các ngày lễ ngoại lệ.</p>
          </div>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all"
          >
            <Save size={18} /> {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
          </button>
        </div>

        {/* === SECTION: THÔNG TIN CÔNG TY === */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="text-indigo-500" size={22} /> Thông tin Công ty
            </h3>
            <button
              onClick={handleSaveCompanyInfo}
              disabled={savingCompany}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-sm transition-all"
            >
              <Save size={16} /> {savingCompany ? 'Đang lưu...' : 'Lưu Thông Tin'}
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Logo Upload */}
            <div className="md:col-span-2 flex flex-col sm:flex-row items-start gap-4">
              <div className="flex-shrink-0">
                {companyLogoBase64 ? (
                  <img src={companyLogoBase64} alt="Logo" className="w-24 h-24 object-contain rounded-xl border-2 border-gray-200 bg-gray-50 p-1" />
                ) : (
                  <div className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 flex flex-col items-center justify-center text-gray-400">
                    <Image size={28} />
                    <span className="text-[10px] mt-1">Chưa có logo</span>
                  </div>
                )}
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo Công ty</label>
                <p className="text-xs text-gray-500 mb-2">Ảnh PNG/JPG, tối đa 200KB. Hiển thị trên Login, Header và biểu mẫu.</p>
                <label className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm cursor-pointer transition-colors">
                  <Upload size={16} /> Chọn ảnh
                  <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                </label>
                {companyLogoBase64 && (
                  <button onClick={() => setCompanyLogoBase64('')} className="ml-2 text-xs text-red-500 hover:text-red-700 font-medium">Xóa logo</button>
                )}
              </div>
            </div>
            {/* Tên Công ty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Type size={14} /> Tên Công ty</label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="VD: HBA Spa & Beauty"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
              />
            </div>
            {/* Slogan */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slogan / Mô tả ngắn</label>
              <input
                type="text"
                value={companySlogan}
                onChange={e => setCompanySlogan(e.target.value)}
                placeholder="VD: Ứng dụng Quản lý Ca làm việc"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
              />
            </div>
            {/* Địa chỉ */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14} /> Địa chỉ</label>
              <input
                type="text"
                value={companyAddress}
                onChange={e => setCompanyAddress(e.target.value)}
                placeholder="VD: 123 Nguyễn Huệ, Q.1, TP.HCM"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
              />
            </div>
            {/* SĐT */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1"><Phone size={14} /> Số điện thoại</label>
              <input
                type="tel"
                value={companyPhone}
                onChange={e => setCompanyPhone(e.target.value)}
                placeholder="VD: 0901234567"
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 outline-none"
              />
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-gray-500">Đang tải cấu hình...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* CỘT TRÁI: CẤU HÌNH TUẦN MẶC ĐỊNH */}
            <div className="space-y-6">
              {/* Định nghĩa Ca (Thông tin) */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                  <ClockIcon /> Khung Giờ Ca Làm Việc
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(rules.shiftConfig).sort((a,b) => a[0].localeCompare(b[0])).map(([key, shift]) => (
                    <div key={key} className="bg-gray-50 p-3 rounded-lg border border-gray-100 flex flex-col gap-2 relative group">
                      <input 
                        type="text" 
                        value={shift.name} 
                        onChange={e => handleUpdateShift(key, 'name', e.target.value)}
                        className="font-bold text-gray-800 text-sm bg-white border border-gray-200 rounded px-2 py-1 w-full"
                      />
                      <div className="flex gap-2 items-center">
                        <input 
                          type="time" 
                          value={shift.startTime}
                          onChange={e => handleUpdateShift(key, 'startTime', e.target.value)}
                          className="text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 w-full"
                        />
                        <span className="text-gray-400">-</span>
                        <input 
                          type="time" 
                          value={shift.endTime}
                          onChange={e => handleUpdateShift(key, 'endTime', e.target.value)}
                          className="text-xs text-gray-700 bg-white border border-gray-200 rounded px-2 py-1 w-full"
                        />
                      </div>
                      <button 
                        onClick={() => handleRemoveShift(key)}
                        className="absolute -top-2 -right-2 bg-red-100 text-red-600 rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-200 shadow-sm"
                        title="Xóa Ca này"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                  <button 
                    onClick={handleAddShift}
                    className="flex flex-col items-center justify-center min-h-[90px] p-3 rounded-lg border-2 border-dashed border-blue-200 text-blue-500 hover:bg-blue-50 hover:border-blue-400 transition-colors"
                  >
                    <Plus size={24} className="mb-1" />
                    <span className="text-sm font-medium">Thêm Ca Mới</span>
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-4 italic">* Các thay đổi về khung giờ ca sẽ áp dụng cho những lịch tuần được TẠO MỚI. Tuần đã lên lịch sẽ không bị thay đổi.</p>
              </div>

              {/* Deadline Hạn Chót Đăng Ký */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Hạn chót Đăng ký Ca (Deadline)</h3>
                <p className="text-sm text-gray-500 mb-5">Hệ thống sẽ tự động Khóa đăng ký ca/hủy ca của tuần tiếp theo sau thời điểm này hàng tuần.</p>
                <div className="flex gap-4 items-center bg-blue-50/50 p-4 border border-blue-100 rounded-lg">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Thứ tự động chốt</label>
                    <select
                      value={rules.deadline.dayOfWeek}
                      onChange={e => setRules(prev => ({ ...prev, deadline: { ...prev.deadline, dayOfWeek: e.target.value } }))}
                      className="w-full font-medium px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    >
                      {DAY_NAMES.map(day => (
                        <option key={day.key} value={day.key}>{day.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-gray-700 mb-1">Giờ chốt sổ</label>
                    <input
                      type="time"
                      value={rules.deadline.time}
                      onChange={e => setRules(prev => ({ ...prev, deadline: { ...prev.deadline, time: e.target.value } }))}
                      className="w-full font-medium px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Danh sách Vị Trí Làm Việc */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-bold text-gray-900 mb-1">Cấu hình Vị trí Làm việc</h3>
                  <p className="text-sm text-gray-500">Quản lý các loại vị trí làm việc có trong hệ thống (Trực hồ, Pha chế, Thu ngân...)</p>
                </div>
                <div className="p-6 space-y-4">
                  {Object.entries(rules.positionsConfig)
                    .sort((a,b) => (a[1].order || 0) - (b[1].order || 0))
                    .map(([id, config], idx, arr) => (
                    <div key={id} className="flex items-center gap-4 bg-gray-50 p-4 rounded-lg border border-gray-100">
                      <div className="flex flex-col gap-1 items-center justify-center mr-2 pt-5">
                        <button 
                          onClick={() => handleMovePosition(id, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-colors shadow-sm"
                          title="Di chuyển Lên"
                        >
                          <ChevronUp size={16} />
                        </button>
                        <button 
                          onClick={() => handleMovePosition(id, 'down')}
                          disabled={idx === arr.length - 1}
                          className="p-1 rounded bg-white border border-gray-200 text-gray-400 hover:text-blue-600 hover:border-blue-300 disabled:opacity-30 transition-colors shadow-sm"
                          title="Di chuyển Xuống"
                        >
                          <ChevronDown size={16} />
                        </button>
                      </div>
                      <div className="w-1/3">
                        <label className="text-xs text-gray-500 font-medium block mb-1">Mã Vị Trí (ẩn)</label>
                        <input type="text" disabled value={id} className="w-full px-3 py-2 bg-gray-100/50 text-gray-500 text-sm border border-gray-200 rounded-md font-mono" />
                      </div>
                      <div className="flex-1">
                        <label className="text-xs text-gray-500 font-medium block mb-1">Tên Hiển Thị</label>
                        <input
                          type="text"
                          value={config.name}
                          onChange={(e) => handleUpdatePositionName(id, e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-medium text-gray-900"
                        />
                      </div>
                      <div className="pt-5 pl-2 border-l border-gray-200">
                        <button
                          onClick={() => handleRemovePosition(id)}
                          className="text-red-500 hover:bg-red-50 p-2 rounded-md transition-colors"
                          title="Xóa vị trí"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Add Position Form */}
                  <div className="flex items-end gap-4 p-4 border-2 border-dashed border-gray-200 rounded-lg bg-gray-50/50">
                    <div className="w-1/3">
                      <label className="text-xs text-gray-500 font-medium block mb-1">Mã Vị Trí mới</label>
                      <input
                        type="text"
                        placeholder="vd: pha_che"
                        value={newPosId}
                        onChange={(e) => setNewPosId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 font-mono"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 font-medium block mb-1">Tên Vị Trí mới</label>
                      <input
                        type="text"
                        placeholder="vd: Pha chế"
                        value={newPosName}
                        onChange={(e) => setNewPosName(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        onKeyDown={(e) => e.key === 'Enter' && handleAddPosition()}
                      />
                    </div>
                    <div>
                      <button
                        onClick={handleAddPosition}
                        disabled={!newPosId || !newPosName}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-md font-medium hover:bg-blue-200 transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Thêm</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Số lượng Nhân sự mỗi Ca */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Số lượng Slot / Ca</h3>
                <p className="text-sm text-gray-500 mb-5">Số người tối đa cho mỗi vị trí trong 1 ca làm việc. Ô nhập tự động sinh dựa trên danh sách vị trí ở trên.</p>
                <div className="flex flex-wrap gap-4 items-end">
                  {Object.entries(rules.positionsConfig).map(([posId, config]) => (
                    <div key={posId} className="w-[120px]">
                      <label className="block text-xs font-bold text-gray-700 mb-1 truncate" title={config.name}>{config.name}</label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={rules.staffSlots[posId] || 1}
                        onChange={e => setRules(prev => ({ ...prev, staffSlots: { ...prev.staffSlots, [posId]: Math.max(1, parseInt(e.target.value) || 1) } }))}
                        className="w-full font-bold text-center px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Lịch Tuần Mặc Định */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Quy luật Phân Ca Mặc Định</h3>
                <p className="text-sm text-gray-500 mb-5">Chọn các Ca sẽ được mở cố định theo mỗi Thứ trong Tuần.</p>
                
                <div className="space-y-3">
                  {DAY_NAMES.map(day => {
                    const activeShifts = rules.weeklyDefaults[day.key as keyof ScheduleRules['weeklyDefaults']];
                    return (
                      <div key={day.key} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-blue-100 transition-colors">
                        <span className="font-semibold text-gray-700 w-24">{day.label}</span>
                        <div className="flex gap-2 flex-wrap justify-end">
                          {Object.keys(rules.shiftConfig).sort((a,b) => a.localeCompare(b)).map(shiftId => {
                            const isActive = activeShifts.includes(shiftId);
                            const shiftName = rules.shiftConfig[shiftId]?.name || `Ca ${shiftId.replace('ca', '')}`;
                            return (
                              <button
                                key={shiftId}
                                onClick={() => handleWeeklyShiftToggle(day.key as any, shiftId)}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all ${
                                  isActive 
                                    ? 'bg-blue-100 border-blue-200 text-blue-700' 
                                    : 'bg-white border-gray-200 text-gray-400 hover:border-blue-300'
                                }`}
                              >
                                {shiftName}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* CỘT PHẢI: NGÀY NGOẠI LỆ */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-yellow-200 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-50 rounded-bl-full -z-10"></div>
                
                <h3 className="text-lg font-bold text-gray-900 mb-1 flex items-center gap-2">
                  <AlertCircle className="text-yellow-500" size={20} />
                  Ngày Ngoại Lệ (Lễ/Nghỉ)
                </h3>
                <p className="text-sm text-gray-500 mb-5">
                  Các ngày được thiết lập tại đây có <b>Mức Ưu Tiên Cao Nhất</b>, ghi đè toàn bộ Quy luật mặc định bên trái khi Tự động Sinh Lịch.
                </p>

                {/* Form Thêm Mới */}
                <div className="bg-yellow-50/50 p-4 rounded-lg border border-yellow-100 mb-6 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Ngày diễn ra</label>
                      <input 
                        type="date" 
                        value={newSpecialDate.date}
                        onChange={e => setNewSpecialDate({...newSpecialDate, date: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1">Tên Dịp/Sự kiện</label>
                      <input 
                        type="text" 
                        placeholder="VD: Lễ 30/4"
                        value={newSpecialDate.reason}
                        onChange={e => setNewSpecialDate({...newSpecialDate, reason: e.target.value})}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-yellow-500 focus:border-yellow-500"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-xs font-bold text-gray-700 mb-2">Hình thức Hoạt động</label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input 
                          type="radio" 
                          checked={newSpecialDate.type === 'closed'} 
                          onChange={() => setNewSpecialDate({...newSpecialDate, type: 'closed'})} 
                          className="text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="font-medium text-red-600">Nghỉ đóng cửa (0 Ca)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input 
                          type="radio" 
                          checked={newSpecialDate.type === 'custom'} 
                          onChange={() => setNewSpecialDate({...newSpecialDate, type: 'custom'})} 
                          className="text-yellow-600 focus:ring-yellow-500"
                        />
                        <span className="font-medium text-blue-600">Số ca phục vụ riêng</span>
                      </label>
                    </div>
                  </div>

                  {newSpecialDate.type === 'custom' && (
                    <div className="pt-2 border-t border-yellow-200/50">
                      <label className="block text-xs font-medium text-gray-600 mb-2">Chọn ca mở cửa cho ngày này:</label>
                      <div className="flex gap-2 flex-wrap">
                        {Object.keys(rules.shiftConfig).map(shiftId => {
                          const isActive = newSpecialDate.shifts.includes(shiftId);
                          const shiftName = rules.shiftConfig[shiftId]?.name || `Ca ${shiftId.replace('ca', '')}`;
                          return (
                            <button
                              key={shiftId}
                              onClick={() => handleSpecialDateShiftToggle(shiftId)}
                              className={`px-3 py-1.5 text-xs font-bold rounded-md border transition-all ${
                                isActive 
                                  ? 'bg-yellow-100 border-yellow-300 text-yellow-800' 
                                  : 'bg-white border-gray-200 text-gray-400'
                              }`}
                            >
                              {shiftName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <button 
                    onClick={handleAddSpecialDate}
                    className="w-full mt-2 bg-yellow-500 hover:bg-yellow-600 text-white flex items-center justify-center gap-2 py-2 rounded-md font-bold text-sm transition-colors shadow-sm"
                  >
                    <Plus size={16} /> Thêm Ngày Ngoại Lệ
                  </button>
                </div>

                {/* Danh sách đã thêm */}
                <div className="space-y-3">
                  <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Danh sách đã lên lịch</h4>
                  {rules.specialDates.length === 0 ? (
                    <div className="text-center text-gray-400 py-6 text-sm italic">
                      Chưa có ngày ngoại lệ nào được cấu hình
                    </div>
                  ) : (
                    rules.specialDates.map((sd, i) => (
                      <div key={i} className="flex justify-between items-center p-3 bg-white border border-gray-200 rounded-lg shadow-sm">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-900">{sd.date.split('-').reverse().join('/')}</span>
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded-full text-gray-600 font-medium">{sd.reason}</span>
                          </div>
                          <div className="text-xs mt-1 font-medium">
                            {sd.type === 'closed' ? (
                              <span className="text-red-500">❌ Nghỉ toàn bộ</span>
                            ) : (
                              <span className="text-blue-600">🕒 Mở ca: {sd.shifts.map(s => s.replace('ca', '')).join(', ') || '(Trống)'}</span>
                            )}
                          </div>
                        </div>
                        <button 
                          onClick={() => handleRemoveSpecialDate(i)}
                          className="text-gray-400 hover:text-red-500 p-2 transition-colors"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            </div>

          </div>
        )}
      </main>

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white font-medium z-[100] transform transition-all duration-300 translate-y-0 opacity-100 flex items-center gap-2 ${toastMessage.type === 'success' ? 'bg-green-600' : 'bg-red-600'}`}>
          {toastMessage.type === 'success' ? <CheckCircle size={20} /> : <XCircle size={20} />}
          {toastMessage.msg}
        </div>
      )}

      {/* Footer bản quyền */}
      <footer className="bg-gradient-to-r from-blue-900 to-blue-800 py-2 text-center shrink-0">
        <p className="text-[11px] text-white/50">© {new Date().getFullYear()} <span className="font-semibold text-white/70">MinAds Soft</span></p>
      </footer>
    </div>
  );
}

const ClockIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500">
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);
