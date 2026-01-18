
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { LogIn, LogOut, Coffee, GraduationCap, MapPin, Clock, Camera, Check, X, RefreshCw, Fingerprint, FileText, Calendar as CalendarIcon, Image as ImageIcon, AlertCircle, ShieldCheck, Navigation, UploadCloud, Smartphone } from 'lucide-react';
import Header from '../components/Header';
import { User } from '../types';
import { submitToGoogleSheets, SubmissionPayload } from '../services/api';

interface HomeProps { user: User; }

// School coordinates for SMPN 1 Padarincang (Updated)
const SCHOOL_LAT = -6.207676212766887;
const SCHOOL_LNG = 105.97295421490682;
const ALLOWED_RADIUS_METERS = 50; 

const Home: React.FC<HomeProps> = ({ user }) => {
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Status Global Aplikasi (berdasarkan sesi login saat ini)
  const [status, setStatus] = useState<'IDLE' | 'PRESENT' | 'OUT'>('IDLE');
  
  // Status Local Device (berdasarkan memori HP)
  const [deviceLock, setDeviceLock] = useState<{in: boolean, out: boolean}>({in: false, out: false});
  
  const [showTeachingModal, setShowTeachingModal] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('PAI');
  const [selectedClass, setSelectedClass] = useState('VII - 1');

  const [leaveType, setLeaveType] = useState<'Izin' | 'Sakit' | 'Dinas'>('Izin');
  const [leaveStartDate, setLeaveStartDate] = useState('');
  const [leaveEndDate, setLeaveEndDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');
  const [leaveAttachment, setLeaveAttachment] = useState<string | null>(null);

  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceType, setAttendanceType] = useState<'IN' | 'OUT' | 'TEACHING' | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const roomOptions = [
    'VI - 1', 'VI - 2', 'VI - 3', 'VI - 4', 'VI - 5', 'VI - 6', 'VI - 7',
    'VII - 1', 'VII - 2', 'VII - 3', 'VII - 4', 'VII - 5', 'VII - 6', 'VII - 7',
    'IX - 1', 'IX - 2', 'IX - 3', 'IX - 4', 'IX - 5', 'IX - 6', 'IX - 7'
  ];

  // --- DEVICE LOCK LOGIC ---
  const getDeviceLockKey = () => {
    const today = new Date();
    // Format YYYY-MM-DD
    const dateStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    return `device_lock_${dateStr}`;
  };

  useEffect(() => {
    // 1. Timer Jam
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);

    // 2. Cek Local Storage saat mount
    const key = getDeviceLockKey();
    const savedLock = localStorage.getItem(key);
    if (savedLock) {
      try {
        const parsed = JSON.parse(savedLock);
        setDeviceLock(parsed);
        // Sinkronisasi status aplikasi jika device sudah pernah absen masuk
        if (parsed.in && !parsed.out) {
            setStatus('PRESENT');
        } else if (parsed.out) {
            setStatus('OUT');
        }
      } catch (e) {
        console.error("Error parsing device lock", e);
      }
    }

    return () => clearInterval(timer);
  }, []);

  const updateDeviceLock = (type: 'IN' | 'OUT') => {
    const key = getDeviceLockKey();
    const currentLock = JSON.parse(localStorage.getItem(key) || '{"in": false, "out": false}');
    
    if (type === 'IN') currentLock.in = true;
    if (type === 'OUT') currentLock.out = true;

    localStorage.setItem(key, JSON.stringify(currentLock));
    setDeviceLock(currentLock);
  };
  // --- END DEVICE LOCK LOGIC ---

  // --- LOGIKA JADWAL KEPULANGAN ---
  const pulangSchedule = useMemo(() => {
    const day = currentTime.getDay(); // 0 = Minggu, 1 = Senin, ... 6 = Sabtu
    let targetH = 14;
    let targetM = 45;

    // Jumat: 11:00
    if (day === 5) {
      targetH = 11;
      targetM = 0;
    } 
    // Kamis: 14:10
    else if (day === 4) {
      targetH = 14;
      targetM = 10;
    }
    // Senin (1), Selasa (2), Rabu (3) : 14:45
    else {
      targetH = 14;
      targetM = 45;
    }

    return { h: targetH, m: targetM };
  }, [currentTime]);

  const isAfterPulangTime = useMemo(() => {
    const currentH = currentTime.getHours();
    const currentM = currentTime.getMinutes();
    const currentTotalMinutes = currentH * 60 + currentM;
    const targetTotalMinutes = pulangSchedule.h * 60 + pulangSchedule.m;

    return currentTotalMinutes >= targetTotalMinutes;
  }, [currentTime, pulangSchedule]);

  const pulangTimeLabel = useMemo(() => {
    return `${pulangSchedule.h.toString().padStart(2, '0')}:${pulangSchedule.m.toString().padStart(2, '0')}`;
  }, [pulangSchedule]);

  // Tombol Pulang disable jika: Belum Absen Masuk ATAU Belum Waktunya ATAU Device sudah pernah Absen Pulang hari ini
  const isPulangDisabled = status !== 'PRESENT' || !isAfterPulangTime || deviceLock.out;
  
  // Tombol Masuk disable jika: Status bukan IDLE ATAU Device sudah pernah Absen Masuk hari ini
  const isMasukDisabled = status !== 'IDLE' || deviceLock.in;

  // --- END LOGIKA JADWAL ---

  // Haversine formula to calculate distance in meters
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // in metres
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('id-ID', { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('id-ID', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const clearErrors = () => setErrors({});

  const handleOpenTeaching = () => {
    const now = new Date();
    const start = now.toTimeString().slice(0, 5);
    const endObj = new Date(now.getTime() + 60 * 60 * 1000);
    const end = endObj.toTimeString().slice(0, 5);

    setStartTime(start);
    setEndTime(end);
    setAttendanceType('TEACHING');
    setPhoto(null);
    clearErrors();
    setShowTeachingModal(true);
    startCamera();
  };

  const openAttendanceModal = (type: 'IN' | 'OUT') => {
    setAttendanceType(type);
    setShowAttendanceModal(true);
    setPhoto(null);
    clearErrors();
    getLocation();
    startCamera();
  };

  const closeAttendanceModal = () => {
    setShowAttendanceModal(false);
    stopCamera();
    setAttendanceType(null);
    setPhoto(null);
    setDistance(null);
    setLocation(null);
    clearErrors();
    setIsSubmitting(false);
  };

  const closeTeachingModal = () => {
    setShowTeachingModal(false);
    stopCamera();
    setAttendanceType(null);
    setPhoto(null);
    clearErrors();
    setIsSubmitting(false);
  };

  const closeLeaveModal = () => {
    setShowLeaveModal(false);
    clearErrors();
    setIsSubmitting(false);
  };

  const getLocation = () => {
    setGpsLoading(true);
    setErrors(prev => {
        const next = {...prev};
        delete next.location;
        return next;
    });
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setLocation(coords);
          const dist = calculateDistance(coords.lat, coords.lng, SCHOOL_LAT, SCHOOL_LNG);
          setDistance(dist);
          
          if (dist > ALLOWED_RADIUS_METERS) {
            setErrors(prev => ({...prev, location: `Anda berada di luar radius sekolah (${Math.round(dist)}m). Maksimal radius: ${ALLOWED_RADIUS_METERS}m.`}));
          }

          setGpsLoading(false);
        },
        (error) => {
          console.error("Error getting location", error);
          setGpsLoading(false);
          setErrors(prev => ({...prev, location: "Gagal mendapatkan koordinat GPS. Pastikan izin lokasi aktif."}));
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          aspectRatio: { ideal: 3/4 },
          width: { ideal: 1200 },
          height: { ideal: 1600 }
        }, 
        audio: false 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("Error accessing camera", err);
      setIsCameraActive(false);
      setErrors(prev => ({...prev, photo: "Kamera tidak dapat diakses."}));
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const vWidth = video.videoWidth;
      const vHeight = video.videoHeight;
      const targetAspect = 3 / 4;
      
      canvas.width = 600;
      canvas.height = 800;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const currentAspect = vWidth / vHeight;
        let sWidth, sHeight, sx, sy;

        if (currentAspect > targetAspect) {
          sHeight = vHeight;
          sWidth = vHeight * targetAspect;
          sx = (vWidth - sWidth) / 2;
          sy = 0;
        } else {
          sWidth = vWidth;
          sHeight = vWidth / targetAspect;
          sx = 0;
          sy = (vHeight - sHeight) / 2;
        }

        ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, 600, 800);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhoto(dataUrl);
        setErrors(prev => {
            const next = {...prev};
            delete next.photo;
            return next;
        });
        stopCamera();
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
          setErrors(prev => ({...prev, attachment: "File terlalu besar (Maks 5MB)."}));
          return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setLeaveAttachment(reader.result as string);
        setErrors(prev => {
            const next = {...prev};
            delete next.attachment;
            return next;
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitAttendance = async () => {
    const newErrors: Record<string, string> = {};
    if (!photo) newErrors.photo = "Wajib mengambil foto selfie sebagai bukti kehadiran.";
    if (!location) newErrors.location = "Wajib mengaktifkan GPS untuk mencatat lokasi presensi.";
    if (distance !== null && distance > ALLOWED_RADIUS_METERS) {
        newErrors.location = `Gagal! Jarak Anda (${Math.round(distance)}m) terlalu jauh dari sekolah.`;
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsSubmitting(true);

    const typeLabel = attendanceType === 'IN' ? 'Masuk' : 'Pulang';
    const payload: SubmissionPayload = {
      action: 'ATTENDANCE',
      user: {
        name: user.name,
        nip: user.nip,
        role: user.role
      },
      data: {
        type: attendanceType, // 'IN' or 'OUT'
        timestamp: new Date().toISOString(),
        location: location ? `${location.lat}, ${location.lng}` : '',
        distance: distance,
        photoBase64: photo
      }
    };

    const success = await submitToGoogleSheets(payload);
    
    setIsSubmitting(false);

    if (success) {
      // Update Status Aplikasi
      if (attendanceType === 'IN') setStatus('PRESENT');
      else setStatus('OUT');

      // Update Device Lock (Local Storage)
      if (attendanceType === 'IN' || attendanceType === 'OUT') {
         updateDeviceLock(attendanceType);
      }
      
      alert(`Presensi ${typeLabel} Berhasil Disimpan!\nData telah terkirim ke server.`);
      closeAttendanceModal();
    } else {
      alert("Gagal mengirim data. Cek koneksi internet atau coba lagi nanti.");
    }
  };

  const handleSubmitTeaching = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!startTime) newErrors.startTime = "Jam mulai wajib diisi.";
    if (!endTime) newErrors.endTime = "Jam selesai wajib diisi.";
    if (startTime && endTime && startTime >= endTime) {
        newErrors.endTime = "Jam selesai harus setelah jam mulai.";
    }
    if (!photo) newErrors.photo = "Bukti foto mengajar wajib dilampirkan.";

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }

    setIsSubmitting(true);

    const payload: SubmissionPayload = {
      action: 'TEACHING',
      user: {
        name: user.name,
        nip: user.nip,
        role: user.role
      },
      data: {
        subject: selectedSubject,
        className: selectedClass,
        startTime: startTime,
        endTime: endTime,
        timestamp: new Date().toISOString(),
        photoBase64: photo
      }
    };

    const success = await submitToGoogleSheets(payload);
    setIsSubmitting(false);

    if (success) {
      alert(`Jurnal Mengajar Berhasil Disimpan!\nMapel: ${selectedSubject}\nKelas: ${selectedClass}`);
      closeTeachingModal();
    } else {
      alert("Gagal mengirim data. Cek koneksi internet.");
    }
  };

  const handleSubmitLeave = async () => {
    const newErrors: Record<string, string> = {};
    
    if (!leaveStartDate) newErrors.leaveStartDate = "Pilih tanggal mulai.";
    if (!leaveEndDate) newErrors.leaveEndDate = "Pilih tanggal selesai.";
    if (leaveStartDate && leaveEndDate && leaveEndDate < leaveStartDate) {
        newErrors.leaveEndDate = "Tanggal selesai tidak boleh mendahului tanggal mulai.";
    }
    if (!leaveReason || leaveReason.trim().length < 10) {
        newErrors.leaveReason = "Keterangan minimal 10 karakter.";
    }

    if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
    }

    setIsSubmitting(true);

    const payload: SubmissionPayload = {
      action: 'LEAVE',
      user: {
        name: user.name,
        nip: user.nip,
        role: user.role
      },
      data: {
        leaveType: leaveType,
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason,
        timestamp: new Date().toISOString(),
        attachmentBase64: leaveAttachment
      }
    };

    const success = await submitToGoogleSheets(payload);
    setIsSubmitting(false);

    if (success) {
      alert(`Pengajuan ${leaveType} Berhasil Dikirim!`);
      setShowLeaveModal(false);
      setLeaveReason('');
      setLeaveStartDate('');
      setLeaveEndDate('');
      setLeaveAttachment(null);
      clearErrors();
    } else {
      alert("Gagal mengirim pengajuan. Coba lagi.");
    }
  };

  const ErrorMsg = ({ name }: { name: string }) => errors[name] ? (
    <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
      <AlertCircle size={10} /> {errors[name]}
    </p>
  ) : null;

  return (
    <div className="flex-1 pb-24 overflow-y-auto">
      <Header title="Dashboard" />
      
      <div className="px-6 mb-6">
        <div className="p-6 rounded-2xl glass overflow-hidden relative border-indigo-500/20">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <LogOut size={100} className="rotate-180" />
          </div>
          <h2 className="text-slate-400 text-sm font-medium">Halo, selamat pagi!</h2>
          <p className="text-xl font-bold text-white mt-1 truncate">{user.name}</p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <div className="flex items-center gap-2 text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse"></span>
                <span className="text-[10px] font-semibold uppercase">{user.role}</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full border border-white/5">
                NIP: {user.nip}
            </div>
          </div>
        </div>
      </div>

      <div className="px-6 mb-10 text-center">
        <div className="inline-block px-8 py-6 bg-slate-900/40 rounded-3xl border border-white/5 shadow-inner">
            <div className="text-4xl font-mono font-bold tracking-tighter text-indigo-400 mb-1">
                {formatTime(currentTime)}
            </div>
            <div className="text-slate-400 text-sm font-medium">
                {formatDate(currentTime)}
            </div>
        </div>
      </div>

      {/* Tampilan jika Device Locked */}
      {(deviceLock.in || deviceLock.out) && (
        <div className="px-6 mb-4">
             <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                 <div className="p-2 bg-red-500 rounded-lg text-white">
                     <Smartphone size={16} />
                 </div>
                 <div className="flex-1">
                     <p className="text-[10px] text-red-400 font-bold uppercase tracking-wider">Perangkat Terkunci</p>
                     <p className="text-[10px] text-slate-400 leading-tight">
                        HP ini sudah digunakan untuk absen {deviceLock.in && 'Masuk'}{deviceLock.in && deviceLock.out && ' & '}{deviceLock.out && 'Pulang'} hari ini.
                     </p>
                 </div>
             </div>
        </div>
      )}

      <div className="px-6 grid grid-cols-2 gap-4">
        <button 
            onClick={() => openAttendanceModal('IN')}
            disabled={isMasukDisabled}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-emerald-600/10 border border-emerald-500/20 hover:bg-emerald-600/20 transition-all disabled:opacity-50 disabled:grayscale group"
        >
            <div className="p-3 bg-emerald-500 rounded-2xl shadow-lg shadow-emerald-500/20 group-active:scale-95 transition-transform">
                <LogIn className="text-white" size={24} />
            </div>
            <span className="text-white font-bold text-xs">
                {deviceLock.in ? 'Sudah Absen di HP Ini' : 'Absen Masuk'}
            </span>
        </button>

        <button 
            onClick={() => openAttendanceModal('OUT')}
            disabled={isPulangDisabled}
            className="flex flex-col items-center justify-center gap-2 p-5 rounded-3xl bg-indigo-600/10 border border-indigo-500/20 hover:bg-indigo-600/20 transition-all disabled:opacity-50 disabled:grayscale group relative overflow-hidden"
        >
            <div className="p-3 bg-indigo-500 rounded-2xl shadow-lg shadow-indigo-500/20 group-active:scale-95 transition-transform">
                <LogOut className="text-white" size={24} />
            </div>
            <span className="text-white font-bold text-xs">
                 {deviceLock.out ? 'Sudah Pulang' : 'Absen Pulang'}
            </span>
            {status === 'PRESENT' && !isAfterPulangTime && !deviceLock.out && (
              <span className="text-[9px] text-amber-400 font-bold bg-amber-400/10 px-2 py-0.5 rounded-full border border-amber-400/20">
                Pukul {pulangTimeLabel}
              </span>
            )}
        </button>

        <button 
            onClick={handleOpenTeaching}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-amber-600/10 border border-amber-500/20 hover:bg-amber-600/20 transition-all group"
        >
            <div className="p-3 bg-amber-500 rounded-2xl shadow-lg shadow-amber-500/20 group-active:scale-95 transition-transform">
                <GraduationCap className="text-white" size={24} />
            </div>
            <span className="text-white font-bold text-xs text-center leading-tight">Absen Mengajar</span>
        </button>

        <button 
            onClick={() => {
                clearErrors();
                setShowLeaveModal(true);
            }}
            className="flex flex-col items-center justify-center gap-3 p-5 rounded-3xl bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 transition-all group"
        >
            <div className="p-3 bg-blue-500 rounded-2xl shadow-lg shadow-blue-500/20 group-active:scale-95 transition-transform">
                <Coffee className="text-white" size={24} />
            </div>
            <span className="text-white font-bold text-xs">Ijin / Sakit</span>
        </button>
      </div>

      {showAttendanceModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeAttendanceModal} />
          <div className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] p-6 border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-300 my-auto">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-white">Absen {attendanceType === 'IN' ? 'Masuk' : 'Pulang'}</h3>
              <button onClick={closeAttendanceModal} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"><X size={20}/></button>
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <div className="relative">
                  <label className="text-[10px] text-indigo-400 uppercase font-bold absolute -top-2 left-4 bg-slate-900 px-2 z-10 tracking-widest">Identitas Pegawai</label>
                  <div className="w-full flex items-center justify-between p-4 bg-slate-800/40 border border-white/10 rounded-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-indigo-500/20 rounded-2xl flex items-center justify-center text-indigo-400">
                        <ShieldCheck size={24} />
                      </div>
                      <div>
                        <span className="text-sm text-white font-bold block">{user.name}</span>
                        <span className="text-[11px] text-slate-400 font-mono font-medium block">NIP: {user.nip}</span>
                      </div>
                    </div>
                    {distance !== null && (
                        <div className={`px-3 py-1.5 rounded-xl border flex flex-col items-end ${distance <= ALLOWED_RADIUS_METERS ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <span className="text-[9px] text-slate-500 uppercase font-bold">Jarak</span>
                            <span className={`text-xs font-black ${distance <= ALLOWED_RADIUS_METERS ? 'text-emerald-500' : 'text-red-500'}`}>
                                {Math.round(distance)}m
                            </span>
                        </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={`p-4 rounded-2xl border transition-colors flex items-center justify-between ${errors.location ? 'bg-red-500/5 border-red-500/40' : 'bg-indigo-500/5 border-indigo-500/20'}`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${location ? (distance !== null && distance <= ALLOWED_RADIUS_METERS ? 'bg-emerald-500/20 text-emerald-500' : 'bg-red-500/20 text-red-500') : 'bg-slate-700 text-slate-500'}`}>
                    <Navigation size={18} className={location ? '' : 'animate-pulse'} />
                  </div>
                  <div className="flex-1">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Live GPS Location</span>
                    <span className="text-xs text-white font-mono block truncate max-w-[180px]">
                      {gpsLoading ? 'Melacak Posisi...' : location ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}` : 'Gagal melacak'}
                    </span>
                    <ErrorMsg name="location" />
                  </div>
                </div>
                <button onClick={getLocation} className="p-2 text-indigo-400 hover:text-indigo-300 transition-colors">
                  <RefreshCw size={18} className={gpsLoading ? 'animate-spin' : ''}/>
                </button>
              </div>

              <div className={`relative aspect-[3/4] w-full max-w-[280px] mx-auto bg-slate-950 rounded-[2rem] overflow-hidden border-2 shadow-2xl transition-colors ${errors.photo ? 'border-red-500/50' : 'border-indigo-500/30'}`}>
                {photo ? (
                  <>
                    <img src={photo} alt="Selfie preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                    <div className="absolute top-4 left-4 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1 shadow-lg">
                      <Check size={12} /> BERHASIL DIAMBIL
                    </div>
                    <button 
                      onClick={() => { setPhoto(null); startCamera(); }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 p-4 bg-white/10 backdrop-blur-md text-white rounded-full border border-white/20 shadow-lg active:scale-90 transition-transform"
                    >
                      <RefreshCw size={24} />
                    </button>
                  </>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                    <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1 rounded-full flex items-center gap-1 border border-white/10">
                      <Camera size={12} className="text-indigo-400" /> MODE POTRAIT
                    </div>
                    {isCameraActive && (
                      <button onClick={capturePhoto} className="absolute bottom-6 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white p-1 border-4 border-slate-900 shadow-2xl active:scale-90 transition-transform flex items-center justify-center">
                        <div className="w-full h-full bg-slate-100 rounded-full border border-slate-300" />
                      </button>
                    )}
                  </>
                )}
                <canvas ref={canvasRef} className="hidden" />
              </div>
              <div className="text-center"><ErrorMsg name="photo" /></div>

              <button 
                onClick={handleSubmitAttendance}
                disabled={distance !== null && distance > ALLOWED_RADIUS_METERS || isSubmitting}
                className={`w-full py-5 text-white font-bold rounded-2xl shadow-xl active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-2 ${distance !== null && distance > ALLOWED_RADIUS_METERS ? 'bg-slate-700 cursor-not-allowed opacity-60' : 'bg-indigo-600 shadow-indigo-600/30 hover:bg-indigo-700'}`}
              >
                {isSubmitting ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <UploadCloud size={20} />
                    {distance !== null && distance > ALLOWED_RADIUS_METERS ? 'Di luar Jangkauan Sekolah' : 'Kirim Laporan Presensi'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTeachingModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeTeachingModal} />
            <div className="relative w-full max-w-md bg-slate-900 rounded-[2.5rem] p-6 border border-white/10 shadow-2xl animate-in fade-in zoom-in duration-300 my-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2">
                        <GraduationCap className="text-amber-500" /> Sesi Mengajar
                    </h3>
                    <button onClick={closeTeachingModal} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-800/50 rounded-xl border border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wider">Identitas Guru</span>
                            <span className="text-xs text-white font-medium truncate block">{user.name}</span>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-xl border border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wider">NIP (Verified)</span>
                            <span className="text-xs text-indigo-400 font-mono font-bold block">{user.nip}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1">
                               <Clock size={10}/> Jam Mulai
                            </label>
                            <input 
                              type="time" 
                              value={startTime}
                              onChange={(e) => {
                                setStartTime(e.target.value);
                                setErrors(prev => ({...prev, startTime: "", endTime: ""}));
                              }}
                              className={`w-full p-4 bg-slate-800 border rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/50 ${errors.startTime ? 'border-red-500' : 'border-slate-700'}`} 
                            />
                            <ErrorMsg name="startTime" />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1">
                               <Clock size={10}/> Jam Selesai
                            </label>
                            <input 
                              type="time" 
                              value={endTime}
                              onChange={(e) => {
                                setEndTime(e.target.value);
                                setErrors(prev => ({...prev, endTime: ""}));
                              }}
                              className={`w-full p-4 bg-slate-800 border rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/50 ${errors.endTime ? 'border-red-500' : 'border-slate-700'}`} 
                            />
                            <ErrorMsg name="endTime" />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                          <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1">
                             <MapPin size={10}/> Ruang / Kelas
                          </label>
                          <select 
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs"
                          >
                              {roomOptions.map(room => (
                                <option key={room} value={room}>{room}</option>
                              ))}
                          </select>
                      </div>
                      <div>
                          <label className="text-[10px] font-bold text-indigo-400 uppercase mb-2 flex items-center gap-1">
                             <FileText size={10}/> Mata Pelajaran
                          </label>
                          <select 
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                            className="w-full p-4 bg-slate-800 border border-slate-700 rounded-xl text-white outline-none focus:ring-2 focus:ring-indigo-500/50 text-xs"
                          >
                              <option>PAI</option>
                              <option>PKN</option>
                              <option>B. INDONESIA</option>
                              <option>B. INGGRIS</option>
                              <option>IPA</option>
                              <option>IPS</option>
                              <option>PJOK</option>
                              <option>SBD</option>
                              <option>TIK</option>
                              <option>MATEMATIKA</option>
                              <option>KASERANGAN</option>
                              <option>BTQ</option>
                              <option>PRAKARYA</option>
                              <option>BP/BK</option>
                          </select>
                      </div>
                    </div>

                    <div className={`relative aspect-[3/4] w-full max-w-[200px] mx-auto bg-slate-950 rounded-2xl overflow-hidden border-2 shadow-xl mt-2 transition-colors ${errors.photo ? 'border-red-500' : 'border-amber-500/30'}`}>
                        {photo ? (
                          <>
                            <img src={photo} alt="Teaching selfie" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => { setPhoto(null); startCamera(); }}
                              className="absolute bottom-3 left-1/2 -translate-x-1/2 p-2 bg-white/10 backdrop-blur-md text-white rounded-full border border-white/20 shadow-lg active:scale-90 transition-transform"
                            >
                              <RefreshCw size={18} />
                            </button>
                          </>
                        ) : (
                          <>
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover scale-x-[-1]" />
                            <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-md text-white text-[8px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-white/10 uppercase">
                              <Camera size={10} className="text-amber-500" /> Bukti Ngajar
                            </div>
                            {isCameraActive && (
                              <button onClick={capturePhoto} className="absolute bottom-3 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-white p-1 border-2 border-slate-900 shadow-xl active:scale-90 transition-transform flex items-center justify-center">
                                <div className="w-full h-full bg-slate-100 rounded-full border border-slate-300" />
                              </button>
                            )}
                          </>
                        )}
                        <canvas ref={canvasRef} className="hidden" />
                    </div>
                    <div className="text-center"><ErrorMsg name="photo" /></div>

                    <button 
                        onClick={handleSubmitTeaching}
                        disabled={isSubmitting}
                        className="w-full py-5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-2xl shadow-lg shadow-amber-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-slate-900/30 border-t-slate-950 rounded-full animate-spin" />
                        ) : (
                          <>
                            <UploadCloud size={20} strokeWidth={3} />
                            Konfirmasi Sesi
                          </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}

      {showLeaveModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-6 overflow-y-auto">
            <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md" onClick={closeLeaveModal} />
            <div className="relative w-full max-w-md bg-slate-900 rounded-[2rem] p-6 border border-white/10 shadow-2xl animate-in zoom-in duration-300 my-auto">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-blue-500 rounded-lg"><Coffee size={20} className="text-white"/></div>
                        Pengajuan Izin
                    </h3>
                    <button onClick={closeLeaveModal} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white"><X size={20}/></button>
                </div>
                
                <div className="space-y-5">
                    {/* Teacher Identity Block */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-800/50 rounded-xl border border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wider">Identitas Guru</span>
                            <span className="text-xs text-white font-medium truncate block">{user.name}</span>
                        </div>
                        <div className="p-3 bg-slate-800/50 rounded-xl border border-white/5">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1 tracking-wider">NIP (Verified)</span>
                            <span className="text-xs text-indigo-400 font-mono font-bold block">{user.nip}</span>
                        </div>
                    </div>

                    <div className="flex bg-slate-800/50 p-1 rounded-xl border border-white/5">
                        {(['Izin', 'Sakit', 'Dinas'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setLeaveType(type)}
                                className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${leaveType === type ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                               <CalendarIcon size={12}/> Tgl Mulai
                            </label>
                            <input 
                                type="date" 
                                value={leaveStartDate}
                                onChange={(e) => {
                                    setLeaveStartDate(e.target.value);
                                    setErrors(prev => ({...prev, leaveStartDate: "", leaveEndDate: ""}));
                                }}
                                className={`w-full p-4 bg-slate-800 border rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${errors.leaveStartDate ? 'border-red-500' : 'border-slate-700'}`} 
                            />
                            <ErrorMsg name="leaveStartDate" />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider flex items-center gap-1.5 px-1">
                               <CalendarIcon size={12}/> Tgl Selesai
                            </label>
                            <input 
                                type="date" 
                                value={leaveEndDate}
                                onChange={(e) => {
                                    setLeaveEndDate(e.target.value);
                                    setErrors(prev => ({...prev, leaveEndDate: ""}));
                                }}
                                className={`w-full p-4 bg-slate-800 border rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 ${errors.leaveEndDate ? 'border-red-500' : 'border-slate-700'}`} 
                            />
                            <ErrorMsg name="leaveEndDate" />
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-1">Keterangan / Alasan</label>
                        <textarea 
                            value={leaveReason}
                            onChange={(e) => {
                                setLeaveReason(e.target.value);
                                if (e.target.value.trim().length >= 10) {
                                    setErrors(prev => ({...prev, leaveReason: ""}));
                                }
                            }}
                            placeholder="Tuliskan detail pengajuan izin..."
                            className={`w-full p-4 bg-slate-800/50 border rounded-xl text-white text-sm outline-none focus:ring-2 focus:ring-indigo-500/50 h-28 resize-none ${errors.leaveReason ? 'border-red-500' : 'border-white/10'}`}
                        />
                        <ErrorMsg name="leaveReason" />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-indigo-400 uppercase tracking-wider px-1">Lampiran (Optional)</label>
                        <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`w-full border-2 border-dashed rounded-2xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer hover:bg-white/5 transition-all group ${errors.attachment ? 'border-red-500' : 'border-white/10'}`}
                        >
                            {leaveAttachment ? (
                                <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                                    <img src={leaveAttachment} alt="Attachment" className="w-full h-full object-cover" />
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); setLeaveAttachment(null); }}
                                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full shadow-lg"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <div className="p-3 bg-slate-800 rounded-full text-slate-500 group-hover:text-indigo-400 transition-colors">
                                        <ImageIcon size={24} />
                                    </div>
                                    <span className="text-[10px] text-slate-500 font-medium">Klik untuk pilih foto dari galeri</span>
                                </>
                            )}
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*" 
                                onChange={handleFileUpload}
                            />
                        </div>
                        <ErrorMsg name="attachment" />
                    </div>

                    <button 
                        onClick={handleSubmitLeave}
                        disabled={isSubmitting}
                        className="w-full py-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl shadow-xl shadow-indigo-600/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        {isSubmitting ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <UploadCloud size={20} />
                            Kirim Pengajuan
                          </>
                        )}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Home;
