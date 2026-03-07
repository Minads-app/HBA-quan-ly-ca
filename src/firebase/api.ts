import { db, auth } from './config';
import { doc, runTransaction, getDoc } from 'firebase/firestore';

// Lấy maxSlot từ settings (cache gần nhất hoặc default)
const getMaxSlots = async () => {
  try {
    const rulesDoc = await getDoc(doc(db, 'settings', 'schedule_rules'));
    if (rulesDoc.exists() && rulesDoc.data().staffSlots) {
      return rulesDoc.data().staffSlots as Record<string, number>;
    }
  } catch (e) { console.error(e); }
  return { manager: 1, cashier: 1, ticket_checker: 1 } as Record<string, number>;
};

// ===== ĐĂNG KÝ CA (Nhân viên tự đăng ký) =====
export const registerShiftApi = async (weekId: string, shiftId: string, role: string, userName: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập.");

  const maxSlots = await getMaxSlots();
  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca làm việc không tồn tại.");
      
      const data = shiftDoc.data();
      if (data.status === 'locked') throw new Error("Ca làm việc đã khóa, không thể đăng ký.");

      if (!role) {
        throw new Error("Vai trò không hợp lệ.");
      }

      const roleKey = role;
      const currentStaff: any[] = data.staff?.[roleKey] || [];
      
      // Kiểm tra đã đăng ký chưa
      if (currentStaff.some((s: any) => s.userId === user.uid)) {
        throw new Error("Bạn đã đăng ký ca này rồi.");
      }

      // Kiểm tra slot còn trống
      const maxForRole = maxSlots[roleKey] || 1;
      if (currentStaff.length >= maxForRole) {
        throw new Error(`Đã đủ ${maxForRole} nhân viên cho vị trí này. Hãy đăng ký Dự bị nếu muốn.`);
      }

      const newStaff = {
        ...(data.staff || {}),
        [roleKey]: [...currentStaff, { userId: user.uid, name: userName, status: 'confirmed' }]
      };
      transaction.update(shiftRef, { staff: newStaff });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Register Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi đăng ký ca.");
  }
};

// ===== HỦY ĐĂNG KÝ CA (Nhân viên tự hủy) =====
export const cancelShiftApi = async (weekId: string, shiftId: string, role: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập.");

  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca làm việc không tồn tại.");
      
      const data = shiftDoc.data();
      if (data.status === 'locked') throw new Error("Ca làm việc đã khóa, không thể hủy.");

      const roleKey = role;
      const currentStaff: any[] = data.staff?.[roleKey] || [];

      // Tìm và xóa user hiện tại khỏi mảng
      const idx = currentStaff.findIndex((s: any) => s.userId === user.uid);
      if (idx === -1) {
        // Có thể đang ở danh sách dự bị
        const backups: any[] = data.backups?.[roleKey] || [];
        const bIdx = backups.findIndex((s: any) => s.userId === user.uid);
        if (bIdx === -1) throw new Error("Bạn không có trong danh sách đăng ký ca này.");
        
        // Xóa khỏi backup
        const newBackups = [...backups];
        newBackups.splice(bIdx, 1);
        transaction.update(shiftRef, { backups: { ...data.backups, [roleKey]: newBackups } });
        return;
      }

      const newStaff = [...currentStaff];
      newStaff.splice(idx, 1);
      
      const newBackupsDict = { ...(data.backups || {}) };
      let updatedBackupsForRole = [...(newBackupsDict[roleKey] || [])];
      
      // Đôn người dự bị lên nếu có
      if (updatedBackupsForRole.length > 0) {
        const backupUser = updatedBackupsForRole.shift(); // Lấy người đầu tiên ra
        newStaff.push({ userId: backupUser.userId, name: backupUser.name, status: 'pending' });
        newBackupsDict[roleKey] = updatedBackupsForRole;
        transaction.update(shiftRef, { 
          staff: { ...data.staff, [roleKey]: newStaff },
          backups: newBackupsDict
        });
      } else {
        transaction.update(shiftRef, { staff: { ...data.staff, [roleKey]: newStaff } });
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Cancel Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi hủy ca.");
  }
};

// ===== ĐĂNG KÝ DỰ BỊ =====
export const registerBackupApi = async (weekId: string, shiftId: string, role: string, userName: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập.");

  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca làm việc không tồn tại.");
      
      const data = shiftDoc.data();
      if (data.status === 'locked') throw new Error("Ca đã khóa.");

      if (!role) {
        throw new Error("Vai trò không hợp lệ.");
      }
      const roleKey = role;
      const backups: any[] = data.backups?.[roleKey] || [];
      if (backups.some((s: any) => s.userId === user.uid)) {
        throw new Error("Bạn đã đăng ký dự bị ca này rồi.");
      }

      transaction.update(shiftRef, {
        backups: { ...data.backups, [roleKey]: [...backups, { userId: user.uid, name: userName }] }
      });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Backup Register Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi đăng ký dự bị.");
  }
};

// ===== GÁN NHÂN VIÊN VÀO CA (Manager) =====
export const assignShiftApi = async (weekId: string, shiftId: string, role: string, targetUserId: string, targetUserName: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập quyền Quản lý.");

  const maxSlots = await getMaxSlots();
  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca làm việc không tồn tại.");
      
      const data = shiftDoc.data();
      const roleKey = role;
      const currentStaff: any[] = data.staff?.[roleKey] || [];

      // Kiểm tra đã có chưa
      if (currentStaff.some((s: any) => s.userId === targetUserId)) {
        throw new Error("Nhân viên này đã có trong ca.");
      }

      const maxForRole = maxSlots[roleKey] || 1;
      if (currentStaff.length >= maxForRole) {
        throw new Error(`Đã đủ ${maxForRole} nhân viên cho vị trí ${role}.`);
      }

      const newStaff = {
        ...(data.staff || {}),
        [roleKey]: [...currentStaff, { userId: targetUserId, name: targetUserName, status: 'confirmed' }]
      };
      transaction.update(shiftRef, { staff: newStaff });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Assign Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi gán ca.");
  }
};

// ===== XÓA NHÂN VIÊN KHỎI CA (Manager) =====
export const removeStaffFromShiftApi = async (weekId: string, shiftId: string, role: string, targetUserId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập quyền Quản lý.");

  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca làm việc không tồn tại.");
      
      const data = shiftDoc.data();
      if (data.status === 'locked') throw new Error("Ca đã khóa, không thể thay đổi.");

      const roleKey = role;
      const currentStaff: any[] = data.staff?.[roleKey] || [];
      const newStaff = currentStaff.filter((s: any) => s.userId !== targetUserId);

      const newBackupsDict = { ...(data.backups || {}) };
      let updatedBackupsForRole = [...(newBackupsDict[roleKey] || [])];
      
      if (currentStaff.length > newStaff.length && updatedBackupsForRole.length > 0) {
        const backupUser = updatedBackupsForRole.shift();
        newStaff.push({ userId: backupUser.userId, name: backupUser.name, status: 'pending' });
        newBackupsDict[roleKey] = updatedBackupsForRole;
        transaction.update(shiftRef, { 
          staff: { ...data.staff, [roleKey]: newStaff },
          backups: newBackupsDict
        });
      } else {
        transaction.update(shiftRef, { staff: { ...data.staff, [roleKey]: newStaff } });
      }
    });
    return { success: true };
  } catch (error: any) {
    console.error("Remove Staff Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi xóa nhân viên.");
  }
};

// ===== XÓA DỰ BỊ KHỎI CA (Manager) =====
export const removeBackupFromShiftApi = async (weekId: string, shiftId: string, role: string, targetUserId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập quyền Quản lý.");

  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca không tồn tại.");
      
      const data = shiftDoc.data();
      const roleKey = role;
      const backups: any[] = data.backups?.[roleKey] || [];
      const newBackups = backups.filter((s: any) => s.userId !== targetUserId);

      transaction.update(shiftRef, { backups: { ...data.backups, [roleKey]: newBackups } });
    });
    return { success: true };
  } catch (error: any) {
    console.error("Remove Backup Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi.");
  }
};

// ===== XÁC NHẬN CA VÀO LÀM CHÍNH THỨC (Dành cho nhân viên được đôn lên) =====
export const confirmShiftApi = async (weekId: string, shiftId: string, role: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập.");

  const shiftRef = doc(db, 'weekly_schedules', weekId, 'shifts', shiftId);

  try {
    await runTransaction(db, async (transaction) => {
      const shiftDoc = await transaction.get(shiftRef);
      if (!shiftDoc.exists()) throw new Error("Ca không tồn tại.");
      
      const data = shiftDoc.data();
      if (data.status === 'locked') throw new Error("Ca đã khóa, không thể xác nhận.");

      const roleKey = role;
      const currentStaff: any[] = data.staff?.[roleKey] || [];
      const idx = currentStaff.findIndex((s: any) => s.userId === user.uid);
      if (idx === -1) throw new Error("Bạn không có trong danh sách ca này.");
      
      if (currentStaff[idx].status !== 'pending') {
         throw new Error("Ca này đã được xác nhận.");
      }

      const newStaff = [...currentStaff];
      newStaff[idx] = { ...newStaff[idx], status: 'confirmed' };
      
      transaction.update(shiftRef, { staff: { ...data.staff, [roleKey]: newStaff } });
    });

    return { success: true };
  } catch (error: any) {
    console.error("Confirm Shift Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi xác nhận ca.");
  }
};

// ===== XÁC NHẬN TOÀN TẬP LỊCH TUẦN CỦA NHÂN VIÊN =====
export const confirmWeekApi = async (weekId: string) => {
  const user = auth.currentUser;
  if (!user) throw new Error("Vui lòng đăng nhập.");

  const weekRef = doc(db, 'weekly_schedules', weekId);

  try {
    await runTransaction(db, async (transaction) => {
      const weekDoc = await transaction.get(weekRef);
      if (!weekDoc.exists()) throw new Error("Lịch tuần không tồn tại.");

      const data = weekDoc.data();
      const currentConfirmed = data.confirmedBy || [];
      
      if (!currentConfirmed.includes(user.uid)) {
         transaction.update(weekRef, { confirmedBy: [...currentConfirmed, user.uid] });
      }
    });

    return { success: true };
  } catch (error: any) {
    console.error("Confirm Week Error:", error);
    throw new Error(error.message || "Đã xảy ra lỗi khi chốt lịch tuần.");
  }
};

