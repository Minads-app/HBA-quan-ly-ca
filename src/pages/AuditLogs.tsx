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
    <div className="flex-1 p-4 md:p-8 overflow-auto container mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="bg-red-100 p-2.5 rounded-lg text-red-600">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nhật Ký Thao Tác</h1>
          <p className="text-sm text-gray-500">Lịch sử hệ thống dùng để theo dõi thay đổi dữ liệu</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow border border-gray-200 overflow-hidden text-sm">
        {loading ? (
          <div className="p-10 text-center text-gray-500">Đang tải nhật ký...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Chưa có bản ghi nhật ký nào.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold text-gray-600 w-12 text-center">#</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">Thời gian</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">Người thực hiện</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">Thao tác</th>
                  <th className="px-6 py-4 font-semibold text-gray-600">Mô tả chi tiết</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 text-center text-gray-400">
                      {getActionIcon(log.action)}
                    </td>
                    <td className="px-6 py-4 text-gray-600 tabular-nums whitespace-nowrap">
                      {formatTime(log.timestamp)}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{log.userName}</div>
                      <div className="text-[10px] text-gray-400 mt-0.5">{log.userId}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10">
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-700">
                      {log.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {hasMore && !loading && (
        <div className="mt-6 text-center">
          <button 
            onClick={loadMore}
            className="px-6 py-2 bg-white border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 shadow-sm"
          >
            Tải thêm lịch sử cũ
          </button>
        </div>
      )}
    </div>
  );
}
