import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { collection, query, orderBy, limit, onSnapshot, getDocs, startAfter, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ShieldAlert, CalendarClock, Trash2, Edit, Save, PlusCircle, MinusCircle, UserCheck } from 'lucide-react';
import { AuditLog } from '../services/auditLog';

export default function AuditLogs() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<(AuditLog & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(false);
  const PAGE_SIZE = 50;

  useEffect(() => {
    // Chỉ admin mới được vào màn hình này
    if (profile?.role !== 'admin') {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, 'audit_logs'),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );

    const unsub = onSnapshot(q, (snapshot) => {
      const fetchedLogs: any[] = [];
      snapshot.forEach((doc) => {
        fetchedLogs.push({ id: doc.id, ...doc.data() });
      });
      setLogs(fetchedLogs);

      const lastVisible = snapshot.docs[snapshot.docs.length - 1];
      setLastDoc(lastVisible);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    return () => unsub();
  }, [profile]);

  const loadMore = async () => {
    if (!lastDoc || !hasMore) return;
    try {
      const q = query(
        collection(db, 'audit_logs'),
        orderBy('timestamp', 'desc'),
        startAfter(lastDoc),
        limit(PAGE_SIZE)
      );
      const snapshot = await getDocs(q);
      const newLogs: any[] = [];
      snapshot.forEach((doc) => {
        newLogs.push({ id: doc.id, ...doc.data() });
      });

      setLogs(prev => [...prev, ...newLogs]);
      setLastDoc(snapshot.docs[snapshot.docs.length - 1]);
      setHasMore(snapshot.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error(e);
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'CREATE_WEEK_SCHEDULE': return <CalendarClock className="text-green-500 w-5 h-5" />;
      case 'DELETE_SHIFT_CONFIG': return <Trash2 className="text-red-500 w-5 h-5" />;
      case 'UPDATE_SHIFT_CONFIG': return <Save className="text-blue-500 w-5 h-5" />;
      case 'ADD_SPECIAL_DATE': return <PlusCircle className="text-purple-500 w-5 h-5" />;
      case 'REMOVE_SPECIAL_DATE': return <MinusCircle className="text-orange-500 w-5 h-5" />;
      case 'CONFIRM_WEEK': return <UserCheck className="text-teal-500 w-5 h-5" />;
      case 'UPDATE_POSITION_CONFIG': return <Edit className="text-indigo-500 w-5 h-5" />;
      default: return <ShieldAlert className="text-gray-500 w-5 h-5" />;
    }
  };

  const formatTime = (ts: Timestamp) => {
    if (!ts) return '';
    const d = ts.toDate();
    return d.toLocaleString('vi-VN', {
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  if (profile?.role !== 'admin') {
    return (
      <div className="flex-1 p-8 text-center text-red-500">
        <ShieldAlert className="w-12 h-12 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Bạn không có quyền truy cập trang này.</h2>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50/50 relative overflow-hidden">
      {/* Header */}
      <header className="bg-indigo-600 shadow-md z-10 sticky top-0">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-3">
              <button onClick={() => window.history.back()} className="text-white hover:bg-white/10 p-2 rounded-full transition-colors flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-arrow-left"><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></svg>
              </button>
              <h1 className="text-lg sm:text-xl font-bold text-white tracking-tight">HBA Quận 3</h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-4 overflow-x-auto custom-scrollbar no-scrollbar scroll-smooth snap-x">
              <span className="text-white/80 font-medium text-sm">Trang Quản Trị</span>
            </div>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-6 lg:p-8 max-w-[1600px] w-full mx-auto flex-1 overflow-auto custom-scrollbar">
        <div className="mb-6 flex items-start flex-col gap-1 bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-2 bg-red-100 rounded-lg shrink-0">
              <ShieldAlert className="text-red-500 w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 truncate">Nhật Ký Thao Tác</h1>
              <p className="text-sm text-gray-500 truncate mt-0.5">Lịch sử hệ thống dùng để theo dõi thay đổi dữ liệu</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-200">
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold text-gray-600 w-16 text-center shrink-0">#</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold text-gray-600 w-48 shrink-0">Thời gian</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold text-gray-600 w-64 shrink-0">Người thực hiện</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold text-gray-600 w-48 shrink-0">Thao tác</th>
                  <th className="px-4 lg:px-6 py-4 text-xs font-semibold text-gray-600 lg:w-auto">Mô tả chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Đang tải nhật ký...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-gray-500">Chưa có nhật ký nào được ghi nhận.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="hover:bg-blue-50/30 transition-colors group">
                      <td className="px-4 lg:px-6 py-4 text-center align-top">
                        <div className="inline-flex items-center justify-center p-1.5 rounded-lg bg-gray-50 border border-gray-100 group-hover:bg-white group-hover:border-blue-100 transition-colors">
                          {getActionIcon(log.action)}
                        </div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 align-top">
                        <div className="text-sm text-gray-500 font-medium font-mono">{formatTime(log.timestamp)}</div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 align-top">
                        <div className="font-medium text-gray-900 text-sm whitespace-nowrap">{log.userName || 'Không rõ'}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5 max-w-[150px] truncate">{log.userId}</div>
                      </td>
                      <td className="px-4 lg:px-6 py-4 align-top">
                        <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 border border-gray-200 text-xs font-medium text-gray-600 whitespace-nowrap">{log.action}</span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 align-top">
                        <div className="text-sm text-gray-700 whitespace-pre-wrap">{log.description}</div>
                        {log.targetId && (
                          <div className="text-[11px] text-gray-400 mt-1 uppercase">Target: {log.targetId}</div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {hasMore && (
            <div className="p-4 bg-gray-50 border-t border-gray-100 text-center">
              <button
                onClick={loadMore}
                className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-blue-600 transition-colors shadow-sm"
              >
                Tải thêm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
