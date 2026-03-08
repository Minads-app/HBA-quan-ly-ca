import { db } from '../firebase/config';
import { collection, doc, writeBatch, getDoc, getDocs } from 'firebase/firestore';

export const generateWeekId = (date: Date) => {
  // ISO 8601 week number logic or simple year-week logic.
  // For simplicity: YYYY-Www
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
};

export const getVietnamDate = (date: Date = new Date()) => {
  const vietnamTime = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Ho_Chi_Minh"}));
  return vietnamTime;
}

export const getStartOfWeek = (date: Date) => {
  const d = getVietnamDate(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is sunday
  d.setDate(diff);
  d.setHours(0,0,0,0);
  return d;
};

export const formatVNDateString = (date: Date) => {
  const vnTime = getVietnamDate(date);
  const year = vnTime.getFullYear();
  const month = String(vnTime.getMonth() + 1).padStart(2, '0');
  const day = String(vnTime.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Lấy ngày chuẩn
const getDayKey = (date: Date): string => {
  const ds = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return ds[date.getDay()];
};

// Generates an entire week of shifts empty
export const generateWeeklySchedule = async (targetDate: Date = new Date()) => {
  const startOfWeek = getStartOfWeek(targetDate);
  const weekId = generateWeekId(startOfWeek);
  
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  // 1. Fetch settings from DB
  const docRef = doc(db, 'settings', 'schedule_rules');
  const snap = await getDoc(docRef);
  
  let rules: any = {
    shiftConfig: {
      ca1: { name: "Ca 1", startTime: "08:00", endTime: "12:00" },
      ca2: { name: "Ca 2", startTime: "13:00", endTime: "17:00" },
      ca3: { name: "Ca 3", startTime: "18:00", "endTime": "22:00" }
    },
    weeklyDefaults: {
      monday: ["ca3"], tuesday: ["ca3"], wednesday: ["ca3"],
      thursday: ["ca3"], friday: ["ca3"], 
      saturday: ["ca2", "ca3"], sunday: ["ca1", "ca2", "ca3"]
    },
    positionsConfig: {
      manager: { name: "Quản lý" },
      cashier: { name: "Thu ngân" },
      ticket_checker: { name: "Soát vé" }
    },
    specialDates: []
  };

  if (snap.exists()) {
    rules = { ...rules, ...snap.data() };
  }

  // Check if week already exists to prevent overwriting
  const weekRef = doc(db, 'weekly_schedules', weekId);
  const weekSnap = await getDoc(weekRef);
  
  if (weekSnap.exists()) {
    throw new Error('Lịch tuần này đã tồn tại, không thể tạo đè. Vui lòng xóa lịch cũ trước nếu muốn tạo lại.');
  }

  const batch = writeBatch(db);
  
  // Create Main week doc
  batch.set(weekRef, {
    startDate: formatVNDateString(startOfWeek),
    endDate: formatVNDateString(endOfWeek),
    isLocked: false,
    createdAt: new Date().toISOString()
  });

  const daysLabel = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
  
  for (let i = 0; i < 7; i++) {
    const shiftDate = new Date(startOfWeek);
    shiftDate.setDate(startOfWeek.getDate() + i);
    const dateStr = formatVNDateString(shiftDate);
    const displayDay = daysLabel[shiftDate.getDay()]; // Correct JS Day (0=Sun, 1=Mon)

    // Check Special Dates First
    const specialRules = rules.specialDates.find((d: any) => d.date === dateStr);
    let shiftIdsToCreate: string[] = [];

    if (specialRules) {
      if (specialRules.type === 'closed') {
        continue; // Bỏ qua không sinh ca nào ngày này
      } else {
        shiftIdsToCreate = specialRules.shifts || [];
      }
    } else {
      // Lookup Weekly Defaults
      const dayKey = getDayKey(shiftDate);
      shiftIdsToCreate = rules.weeklyDefaults[dayKey] || [];
    }

    // Generate Shifts for that day
    for (const shiftIdKey of shiftIdsToCreate) {
      const shiftConf = rules.shiftConfig[shiftIdKey];
      if (!shiftConf) continue;

      const shiftDocId = `${dateStr}-${shiftIdKey}`;
      const shiftRef = doc(collection(db, 'weekly_schedules', weekId, 'shifts'), shiftDocId);
      
      // Construct empty staff object based on positionsConfig
      const emptyStaff: Record<string, any[]> = {};
      if (rules.positionsConfig) {
        Object.keys(rules.positionsConfig).forEach(posId => {
          emptyStaff[posId] = [];
        });
      } else {
        emptyStaff.manager = [];
        emptyStaff.cashier = [];
        emptyStaff.ticket_checker = [];
      }

      batch.set(shiftRef, {
        date: displayDay,       // e.g "Thứ Hai"
        dateString: dateStr,    // e.g "2026-03-09"
        shiftName: shiftConf.name,
        timeString: `${shiftConf.startTime} - ${shiftConf.endTime}`,
        status: 'open',
        shiftIdBase: shiftIdKey, // e.g., ca1, ca2
        staff: emptyStaff,
        backups: []
      });
    }
  }

  await batch.commit();
  return weekId;
};

// Deletes an entire weekly schedule and its shifts
export const deleteWeeklySchedule = async (weekId: string) => {
  const batch = writeBatch(db);
  const shiftsSnap = await getDocs(collection(db, 'weekly_schedules', weekId, 'shifts'));
  shiftsSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  batch.delete(doc(db, 'weekly_schedules', weekId));
  await batch.commit();
};
