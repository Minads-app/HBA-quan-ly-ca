import { collection, addDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

export type AuditActionType =
  | 'CREATE_WEEK_SCHEDULE'
  | 'DELETE_SHIFT_CONFIG'
  | 'UPDATE_SHIFT_CONFIG'
  | 'ADD_SPECIAL_DATE'
  | 'REMOVE_SPECIAL_DATE'
  | 'CONFIRM_WEEK'
  | 'UPDATE_POSITION_CONFIG'
  | 'OTHER';

export interface AuditLog {
  action: AuditActionType;
  description: string;
  userId: string;
  userName: string;
  targetId?: string;
  timestamp: Timestamp;
}

/**
 * Ghi lại nhật ký các thao tác quan trọng vào hệ thống
 */
export const logAction = async (
  action: AuditActionType,
  description: string,
  userId: string,
  userName: string,
  targetId?: string
) => {
  try {
    if (!userId) return; // Không log nếu không có user (phòng hờ)

    const logRef = collection(db, 'audit_logs');
    const logData: AuditLog = {
      action,
      description,
      userId,
      userName,
      timestamp: Timestamp.now(),
    };

    if (targetId) {
      logData.targetId = targetId;
    }

    await addDoc(logRef, logData);
  } catch (error) {
    console.error('Lỗi khi ghi nhật ký thao tác:', error);
    // Lưu ý: Không throws ra ngoài để không làm gián đoạn luồng chính của app
  }
};
