
import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { User, DailyAttendance, TeachingActivity } from '../types';
import { fetchDashboardData, fetchUsersFromSheet } from '../services/api';
import { 
  Users, BookOpen, Clock, CheckCircle, XCircle, Search, 
  IdCard, GraduationCap, ArrowRight, UserCheck, UserMinus, 
  MapPin, X, Calendar, Phone, MessageSquare, AlertCircle, RefreshCw,
  BarChart3, Trophy
} from 'lucide-react';

interface AdminDashboardProps {
  user: User;
}

const AdminDashboard: React.FC<AdminDashboardProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<'attendance' | 'teaching' | 'recap'>('attendance');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState<DailyAttendance | null>(null);
  
  const [attendanceData, setAttendanceData] = useState<DailyAttendance[]>([]);
  const [teachingData, setTeachingData] = useState<TeachingActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  const getInitials = (name: string) => {
    const n = name.replace(/[^a-zA-Z ]/g, "").trim();
    const parts = n.split(' ').filter(p => p.length > 0);
    if (parts.length === 0) return "U";
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // 1. Ambil semua user (Guru)
      const allUsers = await fetchUsersFromSheet();
      const teachers = allUsers.filter(u => u.Role !== 'Admin' && u.Role !== 'Superadmin');
      
      // 2. Ambil log hari ini dari GAS
      const dashboardData = await fetchDashboardData();
      
      if (dashboardData) {
        const { attendance, teaching, leaves } = dashboardData;

        // Helper: Format Time ISO String or HH:mm to HH:mm
        const formatTime = (val: string) => {
           if (!val) return '--:--';
           // Jika format sudah HH:mm atau HH:mm:ss, ambil 5 karakter pertama
           if (typeof val === 'string' && val.match(/^\d{1,2}:\d{2}/)) {
              return val.substring(0, 5);
           }
           // Jika formatnya ISO Date (mengandung T atau -)
           if (val.includes('T') || val.includes('-')) {
             try {
                const d = new Date(val);
                if (isNaN(d.getTime())) return val;
                // Format ke HH:mm
                return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', hour12: false }).replace('.', ':');
             } catch {
                return val;
             }
           }
           return val;
        };

        // 3. Proses Log Mengajar
        const teachingFormatted: TeachingActivity[] = teaching.map((t: any) => ({
          id: `teach-${t.id}`,
          name: t.name,
          subject: t.subject,
          className: t.className,
          timeRange: `${formatTime(t.startTime)} - ${formatTime(t.endTime)}`,
          endTime: t.endTime 
        }));
        setTeachingData(teachingFormatted);

        // 4. Proses Log Absensi (Gabungkan User + Log Masuk + Log Izin)
        const dailyAttendance: DailyAttendance[] = teachers.map((teacher) => {
          // Cari log absen (bisa ada 2 log: IN dan OUT)
          const teacherLogs = attendance.filter((log: any) => log.nip === teacher.NIP);
          const logIn = teacherLogs.find((log: any) => log.type === 'IN');
          const logOut = teacherLogs.find((log: any) => log.type === 'OUT');
          
          // Cari log izin
          const leaveLog = leaves.find((l: any) => l.nip === teacher.NIP);

          // Tentukan Status
          let status: 'HADIR' | 'IZIN' | 'SAKIT' | 'BELUM HADIR' = 'BELUM HADIR';
          if (logIn) status = 'HADIR';
          else if (leaveLog) status = leaveLog.status === 'Sakit' ? 'SAKIT' : 'IZIN';

          // --- REKAP BULANAN REAL ---
          // Kita hapus simulasi random. 
          // Karena backend saat ini hanya mengirim data hari ini, 
          // kita hitung 1 jika HADIR hari ini, 0 jika tidak.
          const actualCount = status === 'HADIR' ? 1 : 0;

          return {
            id: teacher.NIP,
            name: teacher.Nama || teacher.Username,
            nip: teacher.NIP,
            timeIn: logIn ? new Date(logIn.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : null,
            timeOut: logOut ? new Date(logOut.timestamp).toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'}) : null,
            status: status,
            photoUrl: logIn ? logIn.photo : null,
            monthlyAttendance: actualCount 
          };
        });

        setAttendanceData(dailyAttendance);
      }
      setLastUpdated(new Date());
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const dataInterval = setInterval(loadData, 60000);
    const timeInterval = setInterval(() => setCurrentTime(new Date()), 1000);
    
    return () => {
      clearInterval(dataInterval);
      clearInterval(timeInterval);
    };
  }, []);

  // Logic Sorting untuk Tab Presensi Hari Ini
  const filteredAttendance = attendanceData
    .filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.nip.includes(searchQuery)
    )
    .sort((a, b) => {
      const getStatusPriority = (status: string) => {
        if (status === 'HADIR') return 0;
        if (status === 'IZIN' || status === 'SAKIT') return 1;
        return 2;
      };
      const priorityA = getStatusPriority(a.status);
      const priorityB = getStatusPriority(b.status);
      if (priorityA !== priorityB) return priorityA - priorityB;
      if (a.status === 'HADIR' && b.status === 'HADIR') {
        if (a.timeIn && b.timeIn) return a.timeIn.localeCompare(b.timeIn);
      }
      return a.name.localeCompare(b.name);
    });

  // Logic Sorting untuk Tab Rekap Bulanan (Ranking kehadiran tertinggi)
  const rankedAttendance = [...attendanceData]
    .filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.nip.includes(searchQuery)
    )
    .sort((a, b) => (b.monthlyAttendance || 0) - (a.monthlyAttendance || 0));


  const filteredTeaching = teachingData.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.subject.toLowerCase().includes(searchQuery)
  );

  const stats = {
    total: attendanceData.length,
    present: attendanceData.filter(i => i.status === 'HADIR').length,
    teaching: teachingData.length,
    absent: attendanceData.filter(i => i.status === 'IZIN' || i.status === 'SAKIT').length
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HADIR': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'IZIN': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'SAKIT': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'BELUM HADIR': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-800 text-slate-500 border-white/5';
    }
  };

  const checkIsLive = (isoEndTime?: string) => {
    if (!isoEndTime) return false;
    try {
      let endHours = 0;
      let endMinutes = 0;
      const timeMatch = typeof isoEndTime === 'string' ? isoEndTime.match(/^(\d{1,2}):(\d{2})/) : null;

      if (timeMatch) {
         endHours = parseInt(timeMatch[1], 10);
         endMinutes = parseInt(timeMatch[2], 10);
      } else {
         const endDate = new Date(isoEndTime);
         if (isNaN(endDate.getTime())) return false;
         endHours = endDate.getHours();
         endMinutes = endDate.getMinutes();
      }
      
      const endToday = new Date(
        currentTime.getFullYear(), 
        currentTime.getMonth(), 
        currentTime.getDate(), 
        endHours, 
        endMinutes, 
        0
      );
      return currentTime < endToday;
    } catch (e) {
      return false;
    }
  };

  const handleCloseModal = () => setSelectedTeacher(null);

  // --- RENDER HELPERS UNTUK PROGRESS BAR ---
  const renderProgressBar = (presentCount: number) => {
    const target = 20; // Target hari kerja
    const percentage = Math.min((presentCount / target) * 100, 100);
    
    let colorClass = 'bg-red-500';
    if (percentage >= 85) colorClass = 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]';
    else if (percentage >= 50) colorClass = 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]';

    return (
      <div className="w-full mt-3">
        <div className="flex justify-between items-end mb-1">
          <span className="text-[10px] text-slate-400 font-medium">Target: {target} Hari Kerja</span>
          <span className={`text-xs font-black ${percentage >= 85 ? 'text-emerald-400' : percentage >= 50 ? 'text-amber-400' : 'text-slate-500'}`}>
            {Math.round(percentage)}%
          </span>
        </div>
        <div className="h-2.5 w-full bg-slate-950 rounded-full border border-white/5 overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ease-out ${colorClass}`} 
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 pb-24 overflow-y-auto bg-slate-950">
      <Header title="Admin Dashboard" />

      {/* Stats Section */}
      <div className="px-6 mb-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-5 rounded-[2rem] bg-indigo-600/10 border border-indigo-500/20 relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform text-indigo-500">
              <Users size={80} />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-indigo-500 rounded-xl text-white shadow-lg shadow-indigo-500/20">
                <UserCheck size={18} />
              </div>
              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Presensi</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-3xl font-black text-white">{isLoading ? '-' : stats.present}</span>
              <span className="text-slate-500 text-xs font-bold">/ {isLoading ? '-' : stats.total}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">Guru Telah Hadir</p>
          </div>

          <div className="p-5 rounded-[2rem] bg-amber-600/10 border border-amber-500/20 relative overflow-hidden group">
            <div className="absolute -right-2 -bottom-2 opacity-5 group-hover:scale-110 transition-transform text-amber-500">
              <BookOpen size={80} />
            </div>
            <div className="flex items-center gap-2 mb-3">
              <div className="p-2 bg-amber-500 rounded-xl text-white shadow-lg shadow-amber-500/20">
                <BookOpen size={18} />
              </div>
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">KBM</span>
            </div>
            <span className="text-3xl font-black text-white">{isLoading ? '-' : stats.teaching}</span>
            <p className="text-[10px] text-slate-500 font-bold mt-1 uppercase tracking-tight">Sesi Mengajar Aktif</p>
          </div>
        </div>
      </div>

      {/* Control Area: Search & Tabs */}
      <div className="px-6 space-y-4 sticky top-[80px] z-30 bg-slate-950/80 backdrop-blur-md pb-4">
        <div className="flex items-center justify-between">
           <span className="text-[10px] text-slate-500 font-mono">
              Last update: {lastUpdated.toLocaleTimeString('id-ID')}
           </span>
           <button 
             onClick={loadData} 
             disabled={isLoading}
             className="p-2 bg-slate-800 rounded-full text-indigo-400 hover:text-white transition-colors"
           >
             <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} />
           </button>
        </div>
        
        <div className="relative group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-500 group-focus-within:text-indigo-400 transition-colors">
            <Search size={18} />
          </div>
          <input 
            type="text"
            placeholder="Cari Nama Guru atau NIP..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-4 bg-slate-900/50 border border-white/10 rounded-2xl text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50 transition-all placeholder-slate-600"
          />
        </div>

        <div className="bg-slate-900/50 p-1.5 rounded-2xl border border-white/5 flex gap-1 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('attendance')}
            className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'attendance' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Clock size={14} />
            Harian
          </button>
          <button 
            onClick={() => setActiveTab('teaching')}
            className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'teaching' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <GraduationCap size={14} />
            Mengajar
          </button>
          <button 
            onClick={() => setActiveTab('recap')}
            className={`flex-1 min-w-[100px] py-3 text-[10px] font-black uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 ${activeTab === 'recap' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <BarChart3 size={14} />
            Bulanan
          </button>
        </div>
      </div>

      {/* Main Content List Area */}
      <div className="px-6 space-y-3 mt-2">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
             <div className="w-8 h-8 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
             <p className="text-xs text-slate-500">Mengambil data terbaru...</p>
          </div>
        ) : (
          <>
            {/* --- TAB 1: PRESENSI HARIAN --- */}
            {activeTab === 'attendance' && (
              filteredAttendance.length > 0 ? (
                filteredAttendance.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => setSelectedTeacher(item)}
                    className="p-4 bg-slate-900/40 border border-white/5 rounded-3xl hover:bg-slate-900/60 transition-all group border-l-4 border-l-transparent hover:border-l-indigo-500 cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div className="flex items-center gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors leading-tight">{item.name}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[10px] text-slate-500 font-mono">NIP: {item.nip}</span>
                          </div>
                        </div>
                      </div>
                      <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getStatusColor(item.status)}`}>
                        {item.status}
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-slate-950/50 rounded-2xl border border-white/5">
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500">
                          <Clock size={14} />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[8px] text-slate-500 font-black uppercase">Masuk</span>
                          <span className="text-xs text-white font-mono font-bold">{item.timeIn || '--:--'}</span>
                        </div>
                      </div>
                      
                      <div className="h-6 w-px bg-white/5" />
                      
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500">
                          <Clock size={14} />
                        </div>
                        <div className="flex flex-col text-right">
                          <span className="text-[8px] text-slate-500 font-black uppercase">Pulang</span>
                          <span className="text-xs text-white font-mono font-bold">{item.timeOut || '--:--'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                  <div className="p-6 bg-slate-900 rounded-full"><UserMinus size={48} /></div>
                  <p className="text-slate-500 text-sm font-medium tracking-wide uppercase">Data guru tidak ditemukan</p>
                </div>
              )
            )}

            {/* --- TAB 2: JADWAL MENGAJAR --- */}
            {activeTab === 'teaching' && (
              filteredTeaching.length > 0 ? (
                filteredTeaching.map((item) => {
                  const [start, end] = item.timeRange.split(' - ');
                  const isLive = checkIsLive(item.endTime);
                  
                  return (
                  <div key={item.id} className={`p-4 border rounded-3xl relative overflow-hidden group transition-all ${isLive ? 'bg-slate-900/40 border-white/5 hover:bg-slate-900/60' : 'bg-slate-900/20 border-white/5 opacity-80 grayscale-[0.5]'}`}>
                    {isLive && (
                      <div className="absolute -right-4 -top-4 p-4 opacity-5 group-hover:scale-125 group-hover:opacity-10 transition-all rotate-12">
                        <GraduationCap size={100} />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-4">
                      <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center transition-colors ${isLive ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-slate-800 border-white/5 text-slate-500'}`}>
                        <GraduationCap size={24} />
                      </div>
                      <div>
                        <h4 className={`text-sm font-bold leading-tight transition-colors ${isLive ? 'text-white group-hover:text-amber-400' : 'text-slate-400'}`}>{item.name}</h4>
                        {isLive ? (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] text-emerald-500 uppercase font-bold tracking-widest">Live Mengajar</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                            <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Selesai</span>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 relative z-10">
                      <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase font-black mb-1">Mata Pelajaran</span>
                        <div className="flex items-center gap-2">
                          <BookOpen size={14} className={isLive ? "text-amber-400" : "text-slate-500"} />
                          <span className={`text-xs font-bold truncate ${isLive ? "text-white" : "text-slate-400"}`}>{item.subject}</span>
                        </div>
                      </div>
                      <div className="p-3 bg-slate-950/50 rounded-2xl border border-white/5 flex flex-col">
                        <span className="text-[8px] text-slate-500 uppercase font-black mb-1">Ruang Kelas</span>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className={isLive ? "text-indigo-400" : "text-slate-500"} />
                          <span className={`text-xs font-bold ${isLive ? "text-white" : "text-slate-400"}`}>{item.className}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <div className="flex items-center gap-2 p-2 bg-slate-950/30 rounded-xl border border-white/5">
                        <Clock size={14} className={isLive ? "text-indigo-500" : "text-slate-500"} />
                        <div className="flex flex-col">
                           <span className="text-[8px] text-slate-500 font-bold uppercase">Mulai</span>
                           <span className={`text-xs font-mono font-bold ${isLive ? "text-white" : "text-slate-400"}`}>{start}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 p-2 bg-slate-950/30 rounded-xl border border-white/5">
                        <Clock size={14} className={isLive ? "text-amber-500" : "text-slate-500"} />
                        <div className="flex flex-col">
                           <span className="text-[8px] text-slate-500 font-bold uppercase">Selesai</span>
                           <span className={`text-xs font-mono font-bold ${isLive ? "text-white" : "text-slate-400"}`}>{end}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                  <div className="p-6 bg-slate-900 rounded-full"><BookOpen size={48} /></div>
                  <p className="text-slate-500 text-sm font-medium tracking-wide uppercase">Belum ada KBM dimulai</p>
                </div>
              )
            )}

            {/* --- TAB 3: REKAP BULANAN --- */}
            {activeTab === 'recap' && (
              rankedAttendance.length > 0 ? (
                rankedAttendance.map((item, index) => (
                  <div key={item.id} className="p-4 bg-slate-900/40 border border-white/5 rounded-3xl mb-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 font-bold text-xs border border-white/10">
                          {index + 1}
                        </div>
                        <div>
                           <h4 className="text-sm font-bold text-white leading-tight">{item.name}</h4>
                           <div className="flex items-center gap-2 mt-1">
                              <span className="text-[10px] text-slate-500 font-mono">Hadir: <span className="text-white font-bold">{item.monthlyAttendance} Hari</span></span>
                           </div>
                        </div>
                      </div>
                      {index === 0 && (
                        <div className="p-1.5 bg-amber-500/10 rounded-lg text-amber-500">
                           <Trophy size={16} />
                        </div>
                      )}
                    </div>
                    
                    {renderProgressBar(item.monthlyAttendance || 0)}
                  </div>
                ))
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
                  <div className="p-6 bg-slate-900 rounded-full"><BarChart3 size={48} /></div>
                  <p className="text-slate-500 text-sm font-medium tracking-wide uppercase">Data rekap belum tersedia</p>
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selectedTeacher && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center px-0 sm:px-4">
          <div 
            className="fixed inset-0 bg-slate-950/90 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={handleCloseModal} 
          />
          <div className="relative w-full max-w-md bg-slate-900 rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden border-t border-x sm:border border-white/10 shadow-2xl animate-in slide-in-from-bottom-10 sm:zoom-in duration-300">
            {/* Modal Header */}
            <div className="px-6 pt-8 pb-4 flex justify-between items-start relative">
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl p-1 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-xl shadow-indigo-500/20 overflow-hidden">
                    {selectedTeacher.photoUrl ? (
                      <img 
                        src={selectedTeacher.photoUrl} 
                        alt={selectedTeacher.name} 
                        className="w-full h-full rounded-xl object-cover border-2 border-slate-900"
                      />
                    ) : (
                      <div className="w-full h-full rounded-xl bg-slate-800 border-2 border-slate-900 flex items-center justify-center">
                        <span className="text-xl font-black text-white tracking-widest">{getInitials(selectedTeacher.name)}</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white leading-tight">{selectedTeacher.name}</h3>
                    <p className="text-xs text-slate-500 font-mono mt-1">NIP: {selectedTeacher.nip}</p>
                  </div>
               </div>
               <button 
                onClick={handleCloseModal} 
                className="p-2 bg-slate-800/80 text-slate-400 rounded-full hover:text-white transition-colors"
               >
                 <X size={20} />
               </button>
            </div>

            {/* Modal Content Scrollable Area */}
            <div className="px-6 pb-12 max-h-[70vh] overflow-y-auto space-y-6 pt-4">
               {/* Daily Status Card */}
               <div className="bg-slate-950/50 rounded-3xl border border-white/5 p-5 space-y-4">
                  <div className="flex justify-between items-center pb-3 border-b border-white/5">
                    <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Presensi Hari Ini</span>
                    <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${getStatusColor(selectedTeacher.status)}`}>
                      {selectedTeacher.status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 font-black uppercase">Jam Masuk</span>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-emerald-500/10 rounded-lg text-emerald-500">
                          <Clock size={14} />
                        </div>
                        <span className="text-sm text-white font-bold">{selectedTeacher.timeIn || '--:--'}</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-[9px] text-slate-500 font-black uppercase">Jam Pulang</span>
                      <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-indigo-500/10 rounded-lg text-indigo-500">
                          <Clock size={14} />
                        </div>
                        <span className="text-sm text-white font-bold">{selectedTeacher.timeOut || '--:--'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="flex items-center gap-2 p-3 bg-slate-800/40 rounded-xl border border-white/5">
                       <MapPin size={14} className="text-slate-500" />
                       <span className="text-[10px] text-slate-400 font-medium">Status Data: <span className="text-white">Sinkronisasi Real-time</span></span>
                    </div>
                  </div>
               </div>

               {/* Monthly Progress in Modal */}
               <div className="bg-slate-900/40 rounded-3xl border border-white/5 p-5">
                 <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest block mb-4">Performa Bulan Ini</span>
                 {renderProgressBar(selectedTeacher.monthlyAttendance || 0)}
               </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Bottom Info */}
      <div className="mt-8 text-center px-10 pb-10">
        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest leading-relaxed">
          Menampilkan data presensi harian secara real-time berdasarkan koordinat GPS dan bukti foto.
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;
