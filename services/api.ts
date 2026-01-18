
export interface SheetUser {
  Username: string;
  Password: string;
  Nama: string;
  NIP: string;
  Role: string;
  Sekolah: string;
  Status: string;
  Avatar?: string;
  [key: string]: any;
}

// URL CSV GOOGLE SHEET SMPN 1 PADARINCANG
export const SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTAeRvcKVaxjf8e87icZwsr8vFIQneEAsuCcpokxciZGSshpMmU_i8NX2riKVlr3KEbH7jgt9o3P-LS/pub?gid=42211978&single=true&output=csv";

// URL GOOGLE APPS SCRIPT WEB APP (UPDATED)
export const GAS_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbx1iJP10MEILibj6NCEg-hqGm9hklC6208u05_MbQuPBsDSHtqEmjCAyJRenGAcKwntrg/exec";

export const fetchUsersFromSheet = async (): Promise<SheetUser[]> => {
  // Helper to validate CSV content
  const isValidCSV = (text: string) => {
    return text && text.length > 0 && !text.trim().startsWith("<!DOCTYPE html>");
  };

  try {
    // Attempt 1: Direct Fetch
    const response = await fetch(SHEET_CSV_URL);
    if (response.ok) {
      const text = await response.text();
      if (isValidCSV(text)) {
        return parseCSV(text);
      }
    }
    throw new Error("Direct fetch failed or invalid content");
  } catch (directError) {
    console.warn("Direct fetch failed, attempting proxy fallback...", directError);
    
    try {
      // Attempt 2: CORS Proxy Fallback (using allorigins.win)
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(SHEET_CSV_URL)}`;
      const response = await fetch(proxyUrl);
      if (response.ok) {
        const text = await response.text();
        if (isValidCSV(text)) {
          return parseCSV(text);
        }
      }
      throw new Error("Proxy fetch failed");
    } catch (proxyError) {
      console.error("All fetch attempts failed. Using dummy data.", proxyError);
      return getDummyData();
    }
  }
};

// --- FUNGSI BARU: FETCH DATA DASHBOARD ---
export const fetchDashboardData = async () => {
  try {
    // Add timestamp to prevent caching
    const url = `${GAS_WEBAPP_URL}?action=GET_DASHBOARD_DATA&t=${new Date().getTime()}`;
    
    // Google Apps Script redirect response handling
    const response = await fetch(url, { 
      method: 'GET',
      redirect: "follow"
    });
    
    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Gagal mengambil data dashboard:", error);
    return null;
  }
};

// --- FUNGSI PENGIRIMAN DATA KE GOOGLE APPS SCRIPT ---

export interface SubmissionPayload {
  action: 'ATTENDANCE' | 'TEACHING' | 'LEAVE';
  user: {
    name: string;
    nip: string;
    role: string;
  };
  data: any;
}

export const submitToGoogleSheets = async (payload: SubmissionPayload): Promise<boolean> => {
  try {
    // Menggunakan fetch dengan method POST (no-cors agar tidak blocked browser)
    await fetch(GAS_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors", 
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // text/plain prevents preflight OPTIONS check which GAS doesn't support
      },
      body: JSON.stringify(payload),
    });

    return true;
  } catch (error) {
    console.error("Gagal mengirim data:", error);
    return false;
  }
};

// --- END FUNGSI PENGIRIMAN ---

// Fungsi Helper untuk mapping nama kolom
const normalizeHeader = (header: string): string => {
  const h = header.toLowerCase().replace(/[^a-z0-9]/g, ''); 
  
  if (['username', 'user', 'id', 'user_name'].includes(h)) return 'Username';
  if (['password', 'pass', 'sandi', 'katasandi', 'pin'].includes(h)) return 'Password';
  if (['nama', 'name', 'namalengkap', 'fullname', 'nama_lengkap'].includes(h)) return 'Nama';
  if (['nip', 'nomorinduk', 'idpegawai'].includes(h)) return 'NIP';
  if (['role', 'peran', 'jabatan', 'level', 'akses'].includes(h)) return 'Role';
  if (['sekolah', 'school', 'unitkerja', 'instansi'].includes(h)) return 'Sekolah';
  if (['status', 'statuspegawai', 'kepegawaian'].includes(h)) return 'Status';
  if (['avatar', 'foto', 'photo', 'gambar', 'urlfoto'].includes(h)) return 'Avatar';
  
  return header;
};

// Fungsi Helper Parsing 1 Baris CSV
const parseLine = (line: string): string[] => {
  const values: string[] = [];
  let currentVal = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        currentVal += '"';
        i++; 
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(currentVal); 
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  values.push(currentVal);
  return values.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
};

const parseCSV = (text: string): SheetUser[] => {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];

  const rawHeaders = parseLine(lines[0]);
  const headers = rawHeaders.map(h => normalizeHeader(h));
  
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const user: any = {};
    
    headers.forEach((header, index) => {
      if (header && values[index] !== undefined) {
        user[header] = values[index];
      }
    });

    return user as SheetUser;
  });
};

const getDummyData = (): SheetUser[] => [
  {
    Username: 'guru1',
    Password: '123',
    Nama: 'Bpk. Ahmad Suherman, S.Pd',
    NIP: '198506122010011005',
    Role: 'Guru',
    Sekolah: 'SMPN 1 Padarincang',
    Status: 'PNS / ASN',
    Avatar: 'https://picsum.photos/200?random=1'
  },
  {
    Username: 'admin1',
    Password: '123',
    Nama: 'Hj. Siti Aminah, M.Pd',
    NIP: '197005121995012001',
    Role: 'Admin',
    Sekolah: 'SMPN 1 Padarincang',
    Status: 'Kepala Sekolah',
    Avatar: 'https://picsum.photos/200?random=2'
  }
];
