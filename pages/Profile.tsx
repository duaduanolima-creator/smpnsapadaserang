
import React, { useState } from 'react';
import { User as UserIcon, LogOut, IdCard, BadgeCheck, Briefcase, School, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import Header from '../components/Header';
import { User } from '../types';

interface ProfileProps {
  user: User;
  onLogout: () => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onLogout }) => {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const infoItems = [
    { 
      icon: <IdCard size={18} className="text-indigo-400" />, 
      label: 'NIP', 
      value: user.nip 
    },
    { 
      icon: <BadgeCheck size={18} className="text-emerald-400" />, 
      label: 'Status Pegawai', 
      value: user.employmentStatus 
    },
    { 
      icon: <Briefcase size={18} className="text-amber-400" />, 
      label: 'Jabatan', 
      value: user.role 
    },
    { 
      icon: <School size={18} className="text-blue-400" />, 
      label: 'Unit Kerja', 
      value: user.school 
    },
  ];

  const handleLogoutProcess = () => {
    // 1. Ubah state menjadi logging out (tampilkan notifikasi/loading)
    setIsLoggingOut(true);
    setShowLogoutConfirm(false); // Tutup modal konfirmasi

    // 2. Beri jeda waktu agar notifikasi terlihat sebelum pindah halaman
    setTimeout(() => {
        onLogout();
    }, 1500);
  };

  return (
    <div className="flex-1 pb-24 overflow-y-auto relative">
      <Header title="Profil Saya" />

      <div className="flex flex-col items-center pt-8 pb-6 px-6">
        <div className="relative">
          <div className="w-32 h-32 rounded-full p-1.5 bg-gradient-to-tr from-indigo-500 to-purple-500 shadow-2xl shadow-indigo-500/30">
            <img 
              src={user.avatar} 
              alt={user.name}
              className="w-full h-full rounded-full object-cover border-4 border-slate-950 bg-slate-800"
              onError={(e) => {
                e.currentTarget.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=random&size=256`;
              }}
            />
          </div>
          <div className="absolute bottom-1 right-1 w-8 h-8 bg-indigo-600 rounded-full border-4 border-slate-950 flex items-center justify-center text-white shadow-lg">
            <UserIcon size={14} />
          </div>
        </div>
        <h2 className="mt-5 text-xl font-bold text-white text-center">{user.name}</h2>
        <div className="mt-1 flex items-center gap-1.5 text-slate-500">
           <span className="text-xs font-medium uppercase tracking-wider">{user.role}</span>
        </div>
      </div>

      <div className="px-6 mb-8">
        <div className="bg-slate-900/50 border border-white/5 rounded-[2rem] p-5 shadow-inner">
          <h3 className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest mb-4 px-2">Data Kepegawaian</h3>
          <div className="space-y-4">
            {infoItems.map((item, idx) => (
              <div key={idx} className="flex items-start gap-4 p-1">
                <div className="mt-0.5 p-2 bg-slate-800 rounded-xl">
                  {item.icon}
                </div>
                <div className="flex-1 border-b border-white/5 pb-3">
                  <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tight block mb-0.5">{item.label}</span>
                  <span className="text-sm text-slate-200 font-semibold">{item.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="px-6 space-y-4">
        <div className="pt-2">
          <button 
            onClick={() => setShowLogoutConfirm(true)}
            className="w-full flex items-center justify-center gap-2 p-4 bg-red-600/10 border border-red-600/20 text-red-500 font-bold rounded-2xl hover:bg-red-600/20 transition-all active:scale-[0.98]"
          >
            <LogOut size={20} />
            Keluar dari Aplikasi
          </button>
        </div>
      </div>

      <div className="mt-12 text-center text-slate-600 text-[9px] uppercase tracking-widest pb-8">
        Sistem Informasi Kepegawaian v2.1.0<br/>SMPN 1 Padarincang
      </div>

      {/* --- MODAL KONFIRMASI LOGOUT --- */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowLogoutConfirm(false)} />
            <div className="relative w-full max-w-xs bg-slate-900 p-6 rounded-3xl border border-white/10 shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Konfirmasi Logout</h3>
                    <p className="text-sm text-slate-400 mb-6 leading-relaxed">
                        Apakah Anda yakin ingin keluar dari akun ini? Sesi Anda akan berakhir.
                    </p>
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setShowLogoutConfirm(false)}
                            className="flex-1 py-3 text-sm font-bold text-slate-300 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors"
                        >
                            Batal
                        </button>
                        <button 
                            onClick={handleLogoutProcess}
                            className="flex-1 py-3 text-sm font-bold text-white bg-red-600 rounded-xl hover:bg-red-700 shadow-lg shadow-red-600/20 transition-colors"
                        >
                            Ya, Keluar
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* --- NOTIFIKASI SUKSES / LOADING OVERLAY --- */}
      {isLoggingOut && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
            <div className="flex flex-col items-center">
                <div className="relative">
                    <div className="w-16 h-16 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin mb-4" />
                    <div className="absolute inset-0 flex items-center justify-center text-indigo-500 animate-in zoom-in delay-300 duration-500">
                        <CheckCircle2 size={24} />
                    </div>
                </div>
                <h3 className="text-lg font-bold text-white animate-pulse">Berhasil Logout</h3>
                <p className="text-xs text-slate-500 mt-1">Mengalihkan ke halaman login...</p>
            </div>
        </div>
      )}

    </div>
  );
};

export default Profile;
