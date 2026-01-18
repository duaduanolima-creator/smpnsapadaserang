
export interface User {
  id: string;
  name: string;
  nip: string;
  role: 'Guru' | 'Admin';
  avatar: string;
  school: string;
  employmentStatus: string;
}

export type AttendanceStatus = 'present' | 'absent' | 'sick' | 'permission' | 'teaching';

export interface DailyAttendance {
  id: string;
  name: string;
  nip: string;
  timeIn: string | null;
  timeOut: string | null;
  status: 'HADIR' | 'IZIN' | 'SAKIT' | 'BELUM HADIR';
  photoUrl?: string | null;
  monthlyAttendance?: number; // Data rekap kehadiran bulan ini (0-20)
}

export interface TeachingActivity {
  id: string;
  name: string;
  subject: string;
  className: string;
  timeRange: string;
  endTime?: string; // Field baru untuk validasi status Live
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}
