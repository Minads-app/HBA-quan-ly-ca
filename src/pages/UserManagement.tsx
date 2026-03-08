import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Users, UserPlus, Settings, Calendar, CheckCircle, XCircle, Edit3, Trash2, Phone, BarChart3 } from 'lucide-react';
import { collection, onSnapshot, doc, getDoc, setDoc, deleteDoc, query, orderBy } from 'firebase/firestore';
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db, secondaryAuth } from '../firebase/config';
import { useCompanyInfo } from '../hooks/useCompanyInfo';

interface AppUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'cashier' | 'ticket_checker';
  positions?: string[];
  status: 'active' | 'inactive';
  createdAt?: string;
  phone?: string;
  cccd?: string;
  cccdDate?: string;
  cccdPlace?: string;
  birthDate?: string;
  address?: string;
  ward?: string;
  district?: string;
  city?: string;
}

const EMPTY_FORM = {
  name: '', email: '', password: '', role: 'cashier',
  positions: ['cashier'] as string[],
  phone: '', cccd: '', cccdDate: '', cccdPlace: '',
  birthDate: '', address: '', ward: '', district: '', city: ''
};

export default function UserManagement() {
  const { profile, logout } = useAuth();
  const { companyInfo } = useCompanyInfo();
  const navigate = useNavigate();
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [positionsConfig, setPositionsConfig] = useState<Record<string, {name: string, color?: string}>>({});
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newUser, setNewUser] = useState(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  
  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{msg: string, type: 'success'|'error'} | null>(null);

  const showToast = (msg: string, type: 'success'|'error' = 'success') => {
    setToastMessage({ msg, type });
    setTimeout(() => setToastMessage(null), 2000);
  };

  useEffect(() => {
    const q = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const dbUsers: AppUser[] = [];
      snapshot.forEach(doc => {
        dbUsers.push({ id: doc.id, ...doc.data() } as AppUser);
      });
      setUsers(dbUsers);
      setLoading(false);
    });

    const fetchPositions = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'settings', 'schedule_rules'));
        if (docSnap.exists() && docSnap.data().positionsConfig) {
          setPositionsConfig(docSnap.data().positionsConfig);
        } else {
          setPositionsConfig({
            manager: { name: "Quản lý" },
            cashier: { name: "Thu ngân" },
            ticket_checker: { name: "Soát vé" }
          });
        }
      } catch (e) {
        console.error("Lỗi lấy positionsConfig", e);
      }
    };
    fetchPositions();

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setErrorMsg('');
    try {
      const userCred = await createUserWithEmailAndPassword(secondaryAuth, newUser.email, newUser.password);
      
      await setDoc(doc(db, 'users', userCred.user.uid), {
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        positions: newUser.positions,
        status: 'active',
        phone: newUser.phone,
        cccd: newUser.cccd,
        cccdDate: newUser.cccdDate,
        cccdPlace: newUser.cccdPlace,
        birthDate: newUser.birthDate,
        address: newUser.address,
        ward: newUser.ward,
        district: newUser.district,
        city: newUser.city,
        createdAt: new Date().toISOString()
      });

      await signOut(secondaryAuth);
      
      setIsModalOpen(false);
      setNewUser(EMPTY_FORM);
      showToast('Tạo tài khoản Nhân sự thành công!');
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/email-already-in-use') {
        setErrorMsg('Email này đã được sử dụng.');
      } else if (error.code === 'auth/weak-password') {
        setErrorMsg('Mật khẩu quá yếu (cần tối thiểu 6 ký tự).');
      } else {
        setErrorMsg(error.message || 'Có lỗi xảy ra.');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (user: AppUser) => {
    if (user.role === 'admin' && profile?.role !== 'admin') {
      showToast('Bạn không có quyền thay đổi trạng thái của Quản trị viên cấp cao.', 'error');
      return;
    }
    try {
      const newStatus = user.status === 'active' ? 'inactive' : 'active';
      const actionTxt = newStatus === 'inactive' ? 'Khóa' : 'Mở khóa';
      if (!window.confirm(`Bạn có chắc muốn ${actionTxt} tài khoản ${user.name}?`)) return;
      
      const userRef = doc(db, 'users', user.id);
      await setDoc(userRef, { status: newStatus }, { merge: true });
    } catch(err) {
      console.error(err);
      showToast('Lỗi cập nhật trạng thái', 'error');
    }
  };

  const handleDeleteUser = async (user: AppUser) => {
    if (profile?.role !== 'admin') {
      showToast('Chỉ Admin mới có quyền xóa tài khoản.', 'error');
      return;
    }
    if (user.role === 'admin') {
      showToast('Không thể xóa tài khoản Admin.', 'error');
      return;
    }
    if (!window.confirm(`Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "${user.name}"?\n\nLưu ý: Thao tác này không thể hoàn tác. Dữ liệu hồ sơ sẽ bị xóa khỏi hệ thống.`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', user.id));
      showToast(`Đã xóa tài khoản "${user.name}" khỏi hệ thống.`);
    } catch (err) {
      console.error(err);
      showToast('Lỗi khi xóa tài khoản.', 'error');
    }
  };

  const openEditModal = (user: AppUser) => {
    setEditUser(user);
    setEditForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      role: user.role || 'cashier',
      positions: user.positions || [user.role || 'cashier'],
      phone: user.phone || '',
      cccd: user.cccd || '',
      cccdDate: user.cccdDate || '',
      cccdPlace: user.cccdPlace || '',
      birthDate: user.birthDate || '',
      address: user.address || '',
      ward: user.ward || '',
      district: user.district || '',
      city: user.city || '',
    });
    setIsEditModalOpen(true);
    setErrorMsg('');
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editUser) return;
    setSaving(true);
    setErrorMsg('');
    try {
      await setDoc(doc(db, 'users', editUser.id), {
        name: editForm.name,
        role: editForm.role,
        positions: editForm.positions,
        phone: editForm.phone,
        cccd: editForm.cccd,
        cccdDate: editForm.cccdDate,
        cccdPlace: editForm.cccdPlace,
        birthDate: editForm.birthDate,
        address: editForm.address,
        ward: editForm.ward,
        district: editForm.district,
        city: editForm.city,
      }, { merge: true });
      
      setIsEditModalOpen(false);
      setEditUser(null);
      showToast('Cập nhật thông tin thành công!');
    } catch (error: any) {
      console.error(error);
      setErrorMsg(error.message || 'Lỗi khi cập nhật.');
    } finally {
      setSaving(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-gray-800 text-white';
      case 'manager': return 'bg-purple-100 text-purple-700';
      case 'cashier': return 'bg-blue-100 text-blue-700';
      case 'ticket_checker': return 'bg-teal-100 text-teal-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getRoleLabel = (role: string) => {
    switch(role) {
      case 'admin': return 'Quản trị viên (Admin)';
      case 'manager': return 'Quản lý';
      case 'cashier': return 'Thu ngân';
      case 'ticket_checker': return 'Soát vé';
      default: return positionsConfig[role]?.name || role;
    }
  };

  // Form fields component reusable cho cả tạo mới và chỉnh sửa
  const renderPersonalFields = (formState: typeof EMPTY_FORM, setFormState: (val: typeof EMPTY_FORM) => void) => {
    const togglePosition = (pos: string) => {
      const current = formState.positions || [];
      if (current.includes(pos)) {
        setFormState({ ...formState, positions: current.filter(p => p !== pos) });
      } else {
        setFormState({ ...formState, positions: [...current, pos] });
      }
    };

    return (
    <>
      {/* Positions Selection */}
      <div className="mt-3">
        <label className="block text-xs font-medium text-gray-700 mb-2">Vị trí làm việc được phép đăng ký ca (chọn nhiều)</label>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(positionsConfig).map(([pos, config]) => (
            <label key={pos} className={`flex items-center gap-2 p-2 border rounded-lg cursor-pointer transition-colors ${(formState.positions || []).includes(pos) ? 'bg-indigo-50 border-indigo-200' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}>
              <input
                type="checkbox"
                checked={(formState.positions || []).includes(pos)}
                onChange={() => togglePosition(pos)}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-600"
              />
              <span className="text-xs font-medium text-gray-700">{config.name}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Separator */}
      <div className="border-t border-gray-200 pt-4 mt-4">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Thông tin cá nhân</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Số điện thoại *</label>
          <input
            type="tel"
            required
            value={formState.phone}
            onChange={e => setFormState({...formState, phone: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            placeholder="0901234567"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ngày sinh</label>
          <input
            type="date"
            value={formState.birthDate}
            onChange={e => setFormState({...formState, birthDate: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          />
        </div>
      </div>

      {/* CCCD */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Số CCCD</label>
        <input
          type="text"
          value={formState.cccd}
          onChange={e => setFormState({...formState, cccd: e.target.value})}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          placeholder="012345678901"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Ngày cấp CCCD</label>
          <input
            type="date"
            value={formState.cccdDate}
            onChange={e => setFormState({...formState, cccdDate: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nơi cấp</label>
          <input
            type="text"
            value={formState.cccdPlace}
            onChange={e => setFormState({...formState, cccdPlace: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            placeholder="Cục CS QLHC..."
          />
        </div>
      </div>

      {/* Địa chỉ */}
      <div className="border-t border-gray-200 pt-4 mt-2">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Nơi ở hiện tại</p>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Số nhà, Đường</label>
        <input
          type="text"
          value={formState.address}
          onChange={e => setFormState({...formState, address: e.target.value})}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
          placeholder="VD: 123 Nguyễn Huệ"
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phường/Xã</label>
          <input
            type="text"
            value={formState.ward}
            onChange={e => setFormState({...formState, ward: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            placeholder="Phường 1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Quận/Huyện</label>
          <input
            type="text"
            value={formState.district}
            onChange={e => setFormState({...formState, district: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            placeholder="Quận 1"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tỉnh/TP</label>
          <input
            type="text"
            value={formState.city}
            onChange={e => setFormState({...formState, city: e.target.value})}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
            placeholder="TP.HCM"
          />
        </div>
      </div>
    </>
  );
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
                <Users className="text-white w-5 h-5" />
              </div>
            )}
            <h1 className="text-xl font-bold text-white truncate">{companyInfo.companyName || 'Nhân sự'}</h1>
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
            <button className="px-3 md:px-4 py-2 text-sm font-medium rounded-md bg-white text-blue-800 shadow-sm flex items-center gap-1 md:gap-2 shrink-0">
              <Users size={16}/> Nhân sự
            </button>
            {profile?.role === 'admin' && (
              <button 
                onClick={() => navigate('/manager/settings')}
                className="px-3 md:px-4 py-2 text-sm font-medium rounded-md text-white/80 hover:bg-white/20 transition-colors flex items-center gap-1 md:gap-2 shrink-0"
              >
                <Settings size={16}/> Cài đặt
              </button>
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
            <h2 className="text-lg font-bold text-gray-900">Danh sách Tài khoản</h2>
            <p className="text-sm text-gray-500">Hệ thống phân quyền truy cập và chức vụ cho Database.</p>
          </div>
          <button 
            onClick={() => { setIsModalOpen(true); setErrorMsg(''); }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-all"
          >
            <UserPlus size={18} /> Cấp tài khoản mới
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-gray-500">Đang tải biểu đồ Nhân sự...</div>
        ) : users.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-xl border border-dashed border-gray-300 p-12">
            <Users size={48} className="text-gray-300 mb-4" />
            <p className="text-gray-500">Chưa có Nhân viên nào. Hãy cấp tài khoản đầu tiên.</p>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Nhân viên</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Vai trò</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Trạng thái</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                            <Users size={20} className="text-gray-400" />
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-bold text-gray-900">{user.name}</div>
                            <div className="text-xs text-gray-500">{user.email}</div>
                            {user.phone && (
                              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Phone size={10} /> {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getRoleBadgeColor(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {user.status === 'active' ? (
                          <span className="flex items-center gap-1 text-sm text-green-600 font-medium bg-green-50 px-2 py-1 inline-flex rounded-md">
                            <CheckCircle size={14} /> Hoạt động
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-sm text-red-600 font-medium bg-red-50 px-2 py-1 inline-flex rounded-md">
                            <XCircle size={14} /> Tạm Khóa
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          {/* Nút Sửa — cho Manager và Admin */}
                          {(profile?.role === 'admin' || (profile?.role === 'manager' && user.role !== 'admin')) && (
                            <button 
                              onClick={() => openEditModal(user)}
                              className="text-blue-600 hover:text-blue-900 font-medium flex items-center gap-1"
                            >
                              <Edit3 size={14} /> Sửa
                            </button>
                          )}
                          {/* Nút Khóa/Mở khóa */}
                          {(profile?.role === 'admin' || user.role !== 'admin') && (
                            <button 
                              onClick={() => handleToggleStatus(user)}
                              className={`${user.status === 'active' ? 'text-orange-600 hover:text-orange-900' : 'text-green-600 hover:text-green-900'} font-medium`}
                            >
                              {user.status === 'active' ? 'Khóa' : 'Mở khóa'}
                            </button>
                          )}
                          {/* Nút Xóa — chỉ Admin, không xóa Admin khác */}
                          {profile?.role === 'admin' && user.role !== 'admin' && (
                            <button 
                              onClick={() => handleDeleteUser(user)}
                              className="text-red-500 hover:text-red-800 font-medium flex items-center gap-1"
                            >
                              <Trash2 size={14} /> Xóa
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ===== MODAL TẠO MỚI ===== */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-5">
                <h3 className="text-xl font-bold text-gray-900">Cấp Tài khoản mới</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                  <XCircle size={24} />
                </button>
              </div>
              
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg font-medium border border-red-200">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleCreateUser} className="space-y-3">
                {/* Account info */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Họ và Tên *</label>
                  <input
                    type="text" required
                    value={newUser.name}
                    onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                    placeholder="VD: Nguyễn Văn A"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
                    <input
                      type="email" required
                      value={newUser.email}
                      onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                      placeholder="nv@hym.vn"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Mật khẩu *</label>
                    <input
                      type="password" required minLength={6}
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                      placeholder="Ít nhất 6 ký tự"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Chức vụ *</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none bg-white"
                  >
                    {profile?.role === 'admin' && (
                      <option value="admin">Quản trị viên (Admin)</option>
                    )}
                    <option value="manager">Quản lý (Manager)</option>
                    <option value="cashier">Thu ngân (Cashier)</option>
                    <option value="ticket_checker">Soát vé (Ticket Checker)</option>
                  </select>
                </div>
                
                {renderPersonalFields(newUser, setNewUser)}
                
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:bg-blue-400"
                  >
                    {creating ? 'Đang tạo...' : 'Tạo Tài Khoản'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ===== MODAL CHỈNH SỬA ===== */}
        {isEditModalOpen && editUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Chỉnh sửa Nhân viên</h3>
                  <p className="text-xs text-gray-500 mt-1">{editUser.email}</p>
                </div>
                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-700">
                  <XCircle size={24} />
                </button>
              </div>
              
              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg font-medium border border-red-200">
                  {errorMsg}
                </div>
              )}

              <form onSubmit={handleSaveEdit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Họ và Tên *</label>
                  <input
                    type="text" required
                    value={editForm.name}
                    onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Chức vụ *</label>
                  <select
                    value={editForm.role}
                    onChange={(e) => setEditForm({...editForm, role: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600 outline-none bg-white"
                    disabled={editUser.role === 'admin' && profile?.role !== 'admin'}
                  >
                    {profile?.role === 'admin' && (
                      <option value="admin">Quản trị viên (Admin)</option>
                    )}
                    <option value="manager">Quản lý (Manager)</option>
                    <option value="cashier">Thu ngân (Cashier)</option>
                    <option value="ticket_checker">Soát vé (Ticket Checker)</option>
                  </select>
                </div>

                {renderPersonalFields(editForm, setEditForm)}
                
                <div className="pt-4 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditModalOpen(false)}
                    className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-400"
                  >
                    {saving ? 'Đang lưu...' : 'Lưu Thay Đổi'}
                  </button>
                </div>
              </form>
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
