export type ShiftStatus = 'open' | 'locked';
export type StaffMember = { 
  userId: string; 
  name: string; 
  status?: 'confirmed' | 'pending'; 
};

export interface Shift {
  id: string; // Document ID
  date: string; // e.g., 'Thứ 2'
  dateString: string; // e.g. '2026-03-09'
  shiftName: string;
  shiftIdBase?: string; // e.g. 'ca1', 'ca2'
  timeString: string;
  status: ShiftStatus;
  staff: Record<string, StaffMember[]>;
  backups: Record<string, StaffMember[]>; // Danh sách nhân viên dự bị chia theo vị trí
}

export interface WeeklySchedule {
  id: string; // Week ID
  startDate: string;
  endDate: string;
  isLocked: boolean;
}
