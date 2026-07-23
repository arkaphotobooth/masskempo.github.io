/**
 * MASS - Martial Arts Scoring System (FIREBASE ONLINE VERSION)
 */

// 1. Konfigurasi Rahasia Firebase Anda
const firebaseConfig = {
    apiKey: "AIzaSyA63UtPlhEdC9qKmmHVpDjGv_4RqWjK47k",
    authDomain: "mass-pro-turnamen.firebaseapp.com",
    projectId: "mass-pro-turnamen",
    databaseURL: "https://mass-pro-turnamen-default-rtdb.asia-southeast1.firebasedatabase.app/",
    storageBucket: "mass-pro-turnamen.firebasestorage.app",
    messagingSenderId: "268290671498",
    appId: "1:268290671498:web:d55e4960e392f7dfc8fe73"
};

// 2. Inisialisasi Firebase (Utama: MASS KEMPO)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// =========================================================
// KONEKSI SEKUNDER (JEMBATAN KE SISTEM PENDAFTARAN)
// =========================================================
const pendaftaranConfig = {
    apiKey: "AIzaSyD0MSNQBRpfZBzRgMdz726lnB5YX_TnLpo",
    authDomain: "integrasi-sistem-kempo.firebaseapp.com",
    projectId: "integrasi-sistem-kempo",
    storageBucket: "integrasi-sistem-kempo.firebasestorage.app",
    messagingSenderId: "255724075177",
    appId: "1:255724075177:web:c54fa5dee560b66e1611b8"
};
// Kita beri nama "PendaftaranApp" agar tidak bentrok dengan Firebase utama
const pendaftaranApp = firebase.initializeApp(pendaftaranConfig, "PendaftaranApp");
const firestoreDB = pendaftaranApp.firestore();

// 3. Deklarasi State Global (WAJIB DI ATAS SEBELUM FIREBASE)
let STATE = { categories: [], participants: [], matches: [], barcodes: [], settings: { numJudges: 5, minPesertaJuara: 1, enableVerifikator: false } };
const UI = { tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'juara', 'admin'], timerInterval: null, timerSeconds: 0 };
let RANDORI_STATE = { merah: { score: 0, warn1: false, warn2: false }, putih: { score: 0, warn1: false, warn2: false } };
let RANDORI_HISTORY = []
let SWAP_SELECTION = null;
let EMBU_SWAP_SELECTION = null; // Memori untuk menyimpan atlet pertama yang diklik
let TEMP_RINCIAN_WASIT = {};
// --- SUNTIKAN PERBAIKAN: VARIABEL GLOBAL WAJIB DI ATAS ---
let DEVICE_ROLE = localStorage.getItem('mass_device_role') || 'admin';
let IS_TV_LIVE = false;
let currentAthletePage = 1;
const ATHLETES_PER_PAGE = 50;

// =========================================================
// PABRIK FORMAT NAMA (CENTRALIZED FORMATTER)
// =========================================================
function formatNama(namaMentah, mode = 'html') {
    if (!namaMentah) return "-";

    // Memecah nama berdasarkan koma (,), plus (+), atau dan (&)
    let names = String(namaMentah).split(/[,+&]/).map(n => n.trim()).filter(n => n);
    if (names.length <= 1) return namaMentah; // Jika nama tunggal, kembalikan utuh

    if (mode === 'html') {
        return names.join('<br>'); // Ganti baris di Layar Web
    } else if (mode === 'excel') {
        return names.join('\n'); // Ganti baris di File Excel/CSV
    } else if (mode === 'inline') {
        return names.join(' & '); // Format sebaris
    }
    return namaMentah;
}

// --- SENSOR KONEKSI FIREBASE ---
const statusDot = document.getElementById('koneksi-dot');
const statusText = document.getElementById('koneksi-text');

// --- 1. DEKLARASI GEMBOK KEAMANAN (Taruh di atas fungsi Firebase) ---
let isDataLoaded = false;

// 2. SINKRONISASI DATA REAL-TIME DARI SERVER
database.ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
        if (statusDot) statusDot.className = 'w-2.5 h-2.5 bg-green-500 rounded-full transition-colors duration-300 shadow-[0_0_8px_rgba(34,197,94,0.8)]';
        if (statusText) statusText.innerText = 'ONLINE (FIREBASE)';
    } else {
        if (statusDot) statusDot.className = 'w-2.5 h-2.5 bg-red-500 rounded-full transition-colors duration-300';
        if (statusText) statusText.innerText = 'MENGHUBUNGKAN...';
    }
});

database.ref('turnamen_data').on('value', (snapshot) => {
    isDataLoaded = true;

    const data = snapshot.val();
    if (data) {
        STATE.categories = data.categories || [];
        STATE.participants = data.participants || [];
        STATE.matches = data.matches || [];
        STATE.barcodes = data.barcodes || [];
        if (data.settings) STATE.settings = data.settings;
    } else {
        STATE.categories = []; STATE.participants = []; STATE.matches = [];
    }

    // --- FIX BUG SCORING KOSONG: ---
    // PENGAMAN ABSOLUT: Selalu isi dropdown di SEMUA TAB tiap kali data turun!
    updateAllDropdowns();

    // --- DIET RENDER: HANYA REFRESH TAB YANG SEDANG DIBUKA! ---
    const activeSection = UI.tabs.find(tab => {
        const el = document.getElementById(`section-${tab}`);
        return el && !el.classList.contains('hidden');
    });

    if (activeSection === 'kategori') renderCategoryList();
    if (activeSection === 'atlet') renderParticipantTable();
    if (activeSection === 'drawing') { checkExistingDrawing(); }
    if (activeSection === 'scoring') filterPesertaScoring();
    if (activeSection === 'ranking') renderRanking();
    if (activeSection === 'juara') renderJuaraUmum();
    if (activeSection === 'admin') {
        let minEl = document.getElementById('setting-min-peserta');
        if (minEl) minEl.value = STATE.settings.minPesertaJuara || 1;
        let modeEl = document.getElementById('setting-tournament-mode');
        if (modeEl) modeEl.value = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';
        let maxPoolEl = document.getElementById('setting-max-pool-embu');
        if (maxPoolEl) maxPoolEl.value = (STATE.settings && STATE.settings.maxPesertaPoolEmbu) ? STATE.settings.maxPesertaPoolEmbu : 12;

        // 👇 TAMBAHKAN 2 BARIS INI DI SINI 👇
        let eksibisiEl = document.getElementById('setting-eksibisi-final');
        if (eksibisiEl) eksibisiEl.checked = !!(STATE.settings && STATE.settings.eksibisiLangsungFinal);

        // 👇 TAMBAHKAN 2 BARIS INI UNTUK SINKRONISASI DROPDOWN BABAK 2 👇
        let embuB2El = document.getElementById('setting-embu-mode');
        if (embuB2El) embuB2El.value = (STATE.settings && STATE.settings.embuB2Mode) ? STATE.settings.embuB2Mode : 'reverse';

        let vfEl = document.getElementById('setting-verifikator');
        if (vfEl) vfEl.checked = !!(STATE.settings && STATE.settings.enableVerifikator);
    }
});

// 5. UBAH FUNGSI LOKAL MENJADI CLOUD
// Membajak fungsi asli Anda agar menembak ke Firebase, bukan ke laptop lokal
function saveToLocalStorage() {
    // PELINDUNG ANTI-WIPE (Mencegah Database Tertimpa Data Kosong saat awal web dibuka)
    if (!isDataLoaded) {
        console.warn("⛔ BLOKIR: Mencoba menyimpan sebelum data Firebase selesai dimuat.");
        return;
    }

    console.log("Mencoba menyimpan data ke Firebase...", STATE);
    database.ref('turnamen_data').set({
        categories: STATE.categories,
        participants: STATE.participants,
        matches: STATE.matches,
        barcodes: STATE.barcodes,
        settings: STATE.settings
    }).then(() => {
        console.log("SUKSES: Data berhasil disimpan ke server Google!");
    }).catch((error) => {
        console.error("GAGAL SIMPAN:", error);
        alert("Gagal menyimpan data ke database. Cek pengaturan 'Rules' di Firebase Console.");
    });
}

document.addEventListener('DOMContentLoaded', () => {
    refreshAllData();
    let savedJ = parseInt(localStorage.getItem('local_judges')) || 5; // Baca setingan laptop ini
    setJudges(savedJ);
    injectAdminExportButtons();
});

function injectAdminExportButtons() {
    const adminExportSection = document.querySelector('#section-admin .bg-dark-card.text-center');
    if (adminExportSection) {
        let currentMode = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';
        let currentFinalMode = (STATE.settings && STATE.settings.finalRandoriMode) ? STATE.settings.finalRandoriMode : 'single';
        let currentEmbuMode = (STATE.settings && STATE.settings.embuB2Mode) ? STATE.settings.embuB2Mode : 'reverse';

        // Membaca setting maksimal pool dari database
        let currentMaxPool = (STATE.settings && STATE.settings.maxPesertaPoolEmbu) ? STATE.settings.maxPesertaPoolEmbu : 12;

        adminExportSection.innerHTML = `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 text-left shadow-lg">
                    <h3 class="text-md font-black text-red-400 mb-2"><i class="fas fa-cogs mr-2"></i>SISTEM RANDORI (UTAMA)</h3>
                    <p class="text-[10px] text-slate-400 mb-3">Aturan bagan untuk penyisihan Pool.</p>
                    <select id="setting-tournament-mode" onchange="saveTournamentMode()" class="w-full text-sm bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold cursor-pointer hover:border-red-500 transition-colors mb-4">
                        <option value="double" ${currentMode === 'double' ? 'selected' : ''}>Double Elimination (Perkemi)</option>
                        <option value="single" ${currentMode === 'single' ? 'selected' : ''}>Single Elimination (Gugur Biasa)</option>
                    </select>
                    
                    <h3 class="text-md font-black text-orange-400 mb-2 border-t border-slate-700 pt-3"><i class="fas fa-project-diagram mr-2"></i>SISTEM FINAL RANDORI</h3>
                    <p class="text-[10px] text-slate-400 mb-3">Aturan khusus bagan "FINAL" (Crossover).</p>
                    <select id="setting-final-mode" onchange="saveFinalMode()" class="w-full text-sm bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold cursor-pointer hover:border-orange-500 transition-colors">
                        <option value="single" ${currentFinalMode === 'single' ? 'selected' : ''}>Gugur Biasa (Crossover Standar)</option>
                        <option value="double" ${currentFinalMode === 'double' ? 'selected' : ''}>Double Elimination (Perkemi Crossover)</option>
                    </select>
                </div>
                
                <div class="bg-slate-800 p-5 rounded-xl border border-slate-700 text-left shadow-lg flex flex-col">
                    <h3 class="text-md font-black text-blue-400 mb-2"><i class="fas fa-sync-alt mr-2"></i>URUTAN EMBU B2</h3>
                    <p class="text-[10px] text-slate-400 mb-3">Sistem urut Babak 2 (Khusus Single Pool).</p>
                    <select id="setting-embu-mode" onchange="saveEmbuB2Mode()" class="w-full text-sm bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold cursor-pointer hover:border-blue-500 transition-colors mb-4">
                        <option value="reverse" ${currentEmbuMode === 'reverse' ? 'selected' : ''}>Dibalik dari Babak 1 (Baku)</option>
                        <option value="redraw" ${currentEmbuMode === 'redraw' ? 'selected' : ''}>Diacak Ulang (Re-Draw)</option>
                        <option value="highscore" ${currentEmbuMode === 'highscore' ? 'selected' : ''}>Peringkat Nilai B1 (Tertinggi Tampil Terakhir)</option>
                    </select>

                    <h3 class="text-md font-black text-cyan-400 mb-2 border-t border-slate-700 pt-4 mt-auto"><i class="fas fa-users-cog mr-2"></i>MAKSIMAL PESERTA POOL</h3>
                    <p class="text-[10px] text-slate-400 mb-3">Batas Kenshi per Pool (Embu). Lebih dari ini = Dipecah Rata.</p>
                    <div class="flex items-center gap-2">
                        <input type="number" id="setting-max-pool-embu" min="4" value="${currentMaxPool}" class="w-full text-sm bg-slate-900 border border-slate-600 rounded p-2 text-white font-bold focus:border-cyan-500 outline-none transition-colors">
                        <button onclick="saveMaxPoolSetting()" class="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm shadow-md">Simpan</button>
                    </div>
                </div>
            </div>
            
            <h2 class="text-xl font-black text-white mb-2"><i class="fas fa-download text-green-500 mr-2"></i>Pusat Export Data (Makro)</h2>
            <p class="text-sm text-slate-400 mb-6">Unduh seluruh rekapitulasi data global (semua kategori).</p>
            
            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
               <button onclick="exportDrawingExcel()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl shadow-lg text-sm flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105">
                    <i class="fas fa-list-ol text-2xl"></i>
                    <span class="text-center">Download Hasil<br>Drawing</span>
                </button>
                <button onclick="exportRekapJuaraCSV()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-4 rounded-xl shadow-lg text-sm flex flex-col items-center justify-center gap-2"><i class="fas fa-trophy text-2xl"></i><span class="text-center">Rekapitulasi<br>Pemenang</span></button>
                <button onclick="exportMedaliCSV()" class="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-4 rounded-xl shadow-lg text-sm flex flex-col items-center justify-center gap-2"><i class="fas fa-medal text-2xl"></i><span class="text-center">Klasemen<br>Medali Akhir</span></button>
                
                <input type="file" id="excel-template-upload" accept=".xlsx" class="hidden" onchange="generateBaganExcel(event)">
                <button onclick="document.getElementById('excel-template-upload').click()" class="bg-green-700 border-2 border-green-500 hover:bg-green-600 text-white font-bold py-4 px-4 rounded-xl shadow-[0_0_15px_rgba(34,197,94,0.4)] text-sm flex flex-col items-center justify-center gap-2 transition-transform hover:scale-105">
                    <i class="fas fa-file-excel text-2xl"></i>
                    <span class="text-center">Cetak Bagan<br>(Excel)</span>
                </button>
            </div>
        `;
    }
}

// =========================================================
// LOGIKA KEAMANAN & PEMBATASAN AKSES PANITERA (RBAC) - REVISI 2
// =========================================================
const role = sessionStorage.getItem('role');
const courtId = sessionStorage.getItem('courtId');
const btnBack = document.getElementById('btn-back-portal');
const btnText = document.getElementById('text-back-portal');
const btnIcon = document.getElementById('icon-back-portal');

if (btnBack) {
    if (role === 'seksi_pertandingan') {
        btnText.innerText = "DASHBOARD";
        btnIcon.className = "fas fa-home";
        btnBack.classList.add('bg-indigo-600', 'hover:bg-indigo-500', 'hover:scale-105');
        btnBack.onclick = () => { window.location.href = '../dashboard.html'; };

    } else if (role === 'panitera') {
        btnText.innerText = "KELUAR";
        btnIcon.className = "fas fa-sign-out-alt";
        btnBack.classList.add('bg-red-600', 'hover:bg-red-500', 'border', 'border-red-400');
        btnBack.onclick = () => {
            if (confirm('Akhiri sesi penjurian untuk Court ini dan kembali ke portal utama?')) {
                sessionStorage.clear();
                window.location.href = '../index.html';
            }
        };

        const hiddenTabs = ['tab-kategori', 'tab-atlet', 'tab-drawing', 'tab-ranking', 'tab-juara'];
        hiddenTabs.forEach(id => {
            const tab = document.getElementById(id);
            if (tab) tab.style.display = 'none';
        });

        setTimeout(() => switchTab('scoring'), 100);

        const roleSelect = document.getElementById('setting-device-role');
        if (roleSelect && courtId) {
            const safeCourtId = courtId.toLowerCase().replace(' ', '_');
            roleSelect.value = safeCourtId;
            DEVICE_ROLE = safeCourtId;
            localStorage.setItem('mass_device_role', safeCourtId);

            roleSelect.disabled = true;
            roleSelect.classList.add('opacity-60', 'cursor-not-allowed', 'bg-slate-900');

            // PAKSA TAMPILKAN TOMBOL TV MENGGUNAKAN JAVASCRIPT MURNI
            const btnTV = document.getElementById('btn-open-tv');
            if (btnTV) {
                btnTV.classList.remove('hidden');
                btnTV.style.display = 'flex';
                btnTV.href = `display.html?court=${safeCourtId}`;
            }
        }

        // SAPU BERSIH TAB ADMIN DENGAN JAVASCRIPT (Pasti Berhasil)
        setTimeout(() => {
            const adminContainer = document.querySelector('#section-admin .max-w-3xl');
            if (adminContainer) {
                Array.from(adminContainer.children).forEach(child => {
                    // Berikan pengecualian untuk 3 kotak: Broadcast, Paperless, DAN Integrasi (untuk diubah)
                    if (child.id !== 'admin-broadcast-zone' && child.id !== 'admin-paperless-zone' && child.id !== 'containerIntegrasi') {
                        child.style.display = 'none';
                    }
                });
            }

            // --- SUNTIKAN BARU: SULAP TOMBOL INTEGRASI JADI CACHE LOKAL ---
            const titleIntegrasi = document.getElementById("titleIntegrasi");
            const descIntegrasi = document.getElementById("descIntegrasi");
            const btnSync = document.getElementById("btnSyncData");

            if (titleIntegrasi && descIntegrasi && btnSync) {
                titleIntegrasi.innerHTML = "<i class='fas fa-download mr-2'></i>Tarik Data Atlet Lokal";
                descIntegrasi.innerText = "Simpan data jadwal dan waza khusus court ini ke memori laptop (Cache) agar siap dikirim ke wasit tanpa lag.";

                // Ubah gaya tombol jadi warna Hijau (Emerald)
                btnSync.innerHTML = "<i class='fas fa-save mr-2'></i>TARIK & SIMPAN DATA LOKAL";
                btnSync.className = "bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-8 rounded-xl transition-transform hover:scale-105 shadow-[0_0_15px_rgba(16,185,129,0.5)] text-sm tracking-wider";

                // Ubah fungsinya jadi simpan lokal (Karena STATE sudah ditarik otomatis oleh RTDB di kode Anda)
                btnSync.onclick = function () {
                    btnSync.innerHTML = "<i class='fas fa-spinner fa-spin mr-2'></i>Menyimpan ke Laptop...";
                    btnSync.disabled = true;
                    try {
                        localStorage.setItem("CACHE_DATA_EMBU", JSON.stringify(STATE));
                        setTimeout(() => {
                            btnSync.innerHTML = "<i class='fas fa-check-circle mr-2'></i>DATA TERSIMPAN DI LAPTOP";
                            btnSync.disabled = false;
                        }, 1000);
                    } catch (err) {
                        alert("Gagal menyimpan ke memori lokal laptop.");
                        btnSync.disabled = false;
                    }
                };
            }
        }, 150);
    }
}

function saveTournamentMode() {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.tournamentMode = document.getElementById('setting-tournament-mode').value;
    saveToLocalStorage();
    alert("Sistem penyisihan berhasil diubah menjadi: " + (STATE.settings.tournamentMode === 'single' ? "SINGLE ELIMINATION" : "DOUBLE ELIMINATION"));
}
function saveFinalMode() {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.finalRandoriMode = document.getElementById('setting-final-mode').value;
    saveToLocalStorage();
    alert("Sistem Final Randori (Crossover) berhasil disimpan.");
}

function saveEmbuB2Mode() {
    if (!STATE.settings) STATE.settings = {};
    const newMode = document.getElementById('setting-embu-mode').value;
    STATE.settings.embuB2Mode = newMode;

    let syncUpdates = {};

    // KUNCI ATOMIK: Masukkan setting langsung ke dalam paket Firebase!
    syncUpdates['turnamen_data/settings/embuB2Mode'] = newMode;

    let hasUpdates = false;

    // Looping keliling ke semua kategori Embu
    STATE.categories.filter(c => c.discipline === 'embu').forEach(cat => {
        let list = STATE.participants.filter(p => p.kategori === cat.name && p.urut > 0);

        // Hanya proses yang jalurnya Single Pool
        if (list.length > 0 && !list.some(p => p.pool !== '-' && p.pool !== 'SINGLE')) {
            if (newMode === 'reverse') {
                let sorted = [...list].sort((a, b) => b.urut - a.urut);
                sorted.forEach((p, i) => {
                    p.urutB2 = i + 1;
                    let idx = STATE.participants.findIndex(x => x.id === p.id);
                    syncUpdates[`turnamen_data/participants/${idx}/urutB2`] = i + 1;
                    hasUpdates = true;
                });
            } else if (newMode === 'highscore') {
                let hasPlayed = list.filter(p => p.scores.b1.final > 0);
                let sorted = hasPlayed.sort((a, b) => a.scores.b1.final - b.scores.b1.final || a.scores.b1.tech - b.scores.b1.tech);
                list.forEach(p => {
                    let rankIdx = sorted.findIndex(x => x.id === p.id);
                    let newUrut = rankIdx > -1 ? rankIdx + 1 : 0; // 0 jika belum main B1
                    if (p.urutB2 !== newUrut) {
                        p.urutB2 = newUrut;
                        let idx = STATE.participants.findIndex(x => x.id === p.id);
                        syncUpdates[`turnamen_data/participants/${idx}/urutB2`] = newUrut;
                        hasUpdates = true;
                    }
                });
            } else if (newMode === 'redraw') {
                list.forEach(p => {
                    if (p.urutB2 !== 0) {
                        p.urutB2 = 0; // Reset ke 0 agar wajib diundi ulang
                        let idx = STATE.participants.findIndex(x => x.id === p.id);
                        syncUpdates[`turnamen_data/participants/${idx}/urutB2`] = 0;
                        hasUpdates = true;
                    }
                });
            }
        }
    });

    // Tembak massal ke Firebase! (Pasti tereksekusi karena kita mengunggah setting)
    database.ref().update(syncUpdates).then(() => {
        alert("Aturan Urutan Babak 2 berhasil disimpan" + (hasUpdates ? " & Posisi Atlet disinkronisasi!" : "!"));
        checkExistingDrawing();
        filterPesertaScoring();
    }).catch(err => alert("Gagal Sinkronisasi: " + err));
}

function refreshAllData() {
    renderCategoryList();
    updateAllDropdowns();
    renderParticipantTable();
    filterPesertaScoring(); // FIX BUG 1: Langsung muat daftar atlet di tab Scoring saat web dibuka
}

function switchTab(targetTab) {
    UI.tabs.forEach(tab => {
        const sectionEl = document.getElementById(`section-${tab}`); const tabEl = document.getElementById(`tab-${tab}`);
        if (sectionEl) { sectionEl.classList.add('hidden'); sectionEl.classList.remove('block'); }
        if (tabEl) { tabEl.classList.remove('active-tab', 'text-blue-500', 'text-red-400', 'text-yellow-400'); if (tab === 'admin') tabEl.classList.add('text-red-400'); else if (tab === 'juara') tabEl.classList.add('text-yellow-500'); else tabEl.classList.add('text-slate-400'); }
    });
    const activeSection = document.getElementById(`section-${targetTab}`); const activeTab = document.getElementById(`tab-${targetTab}`);
    if (activeSection) { activeSection.classList.remove('hidden'); activeSection.classList.add('block'); }
    if (activeTab) { if (targetTab === 'admin') { activeTab.classList.remove('text-red-400'); activeTab.classList.add('active-tab', 'text-red-500'); } else if (targetTab === 'juara') { activeTab.classList.remove('text-yellow-500'); activeTab.classList.add('active-tab', 'text-yellow-400'); } else { activeTab.classList.remove('text-slate-400'); activeTab.classList.add('active-tab', 'text-blue-500'); } }

    // --- FIX BUG SCORING KOSONG: ---
    // PENGAMAN ABSOLUT: Pastikan dropdown terisi ulang saat tab diklik
    updateAllDropdowns();

    // Paksa gambar ulang data SAAT tab diklik 
    if (targetTab === 'kategori') renderCategoryList();
    if (targetTab === 'atlet') renderParticipantTable();
    if (targetTab === 'ranking') renderRanking();
    if (targetTab === 'scoring') filterPesertaScoring();
    if (targetTab === 'drawing') { SWAP_SELECTION = null; checkExistingDrawing(); }
    if (targetTab === 'juara') renderJuaraUmum();
    if (targetTab === 'admin') {
        let minEl = document.getElementById('setting-min-peserta');
        if (minEl) minEl.value = (STATE.settings && STATE.settings.minPesertaJuara) ? STATE.settings.minPesertaJuara : 1;

        let modeEl = document.getElementById('setting-tournament-mode');
        if (modeEl) modeEl.value = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';

        let judulEl = document.getElementById('setting-judul-tv');
        if (judulEl) judulEl.value = (STATE.settings && STATE.settings.judulTV) ? STATE.settings.judulTV : "KEJUARAAN NASIONAL BELADIRI SENI 2024";

        let maxPoolEl = document.getElementById('setting-max-pool-embu');
        if (maxPoolEl) maxPoolEl.value = (STATE.settings && STATE.settings.maxPesertaPoolEmbu) ? STATE.settings.maxPesertaPoolEmbu : 12;

        // 👇 TAMBAHKAN 2 BARIS INI DI SINI JUGA 👇
        let eksibisiEl = document.getElementById('setting-eksibisi-final');
        if (eksibisiEl) eksibisiEl.checked = !!(STATE.settings && STATE.settings.eksibisiLangsungFinal);

        // 👇 TAMBAHKAN 2 BARIS INI DI SINI JUGA 👇
        let embuB2El = document.getElementById('setting-embu-mode');
        if (embuB2El) embuB2El.value = (STATE.settings && STATE.settings.embuB2Mode) ? STATE.settings.embuB2Mode : 'reverse';

        let vfEl = document.getElementById('setting-verifikator');
        if (vfEl) vfEl.checked = !!(STATE.settings && STATE.settings.enableVerifikator);

    }
}
document.getElementById('form-kategori').addEventListener('submit', (e) => { e.preventDefault(); const name = document.getElementById('cat-name').value.trim(); const type = parseInt(document.getElementById('cat-type').value); const discipline = document.getElementById('cat-discipline').value; if (!name) return; if (STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert("Kategori sudah ada!"); STATE.categories.push({ id: Date.now(), name, type, discipline }); saveToLocalStorage(); refreshAllData(); e.target.reset(); });
function renderCategoryList() { const container = document.getElementById('list-kategori'); if (STATE.categories.length === 0) return container.innerHTML = `<span class="text-sm text-slate-500 italic">Belum ada kategori.</span>`; container.innerHTML = STATE.categories.map(c => { let badgeColor = c.discipline === 'randori' ? 'bg-red-700' : (c.discipline === 'festival' ? 'bg-green-600' : 'bg-blue-600'); let disciplineText = c.discipline ? c.discipline.toUpperCase() : 'EMBU'; return `<div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm"><span class="${badgeColor} text-[9px] px-1.5 py-0.5 rounded font-bold">${disciplineText}</span><span class="font-bold text-white">${c.name}</span><span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span><button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button></div>` }).join(''); }
function deleteCategory(id) {
    if (confirm("🚨 BAHAYA!\n\nHapus kategori ini?\n\nPERHATIAN: Seluruh data ATLET dan BAGAN PERTANDINGAN yang ada di dalam kategori ini juga akan IKUT TERHAPUS PERMANEN!\n\nLanjutkan?")) {

        const cat = STATE.categories.find(c => c.id === id);

        if (cat) {
            // EKSEKUSI CASCADING DELETE: Bakar semua data yang terhubung
            STATE.participants = STATE.participants.filter(p => p.kategori !== cat.name);
            STATE.matches = STATE.matches.filter(m => m.kategori !== cat.name);
        }

        // Hapus nama kategorinya
        STATE.categories = STATE.categories.filter(c => c.id !== id);

        saveToLocalStorage();
        refreshAllData();
    }
}

function updateAllDropdowns() {
    // Pengaman Anti-Crash
    const elP = document.getElementById('p-kategori');
    const elEdit = document.getElementById('edit-kategori');
    const elDraw = document.getElementById('draw-select-kategori');
    const elSelect = document.getElementById('select-kategori');
    const elRank = document.getElementById('rank-filter-kategori');
    const elFilterAtlet = document.getElementById('filter-atlet-kategori');

    // 1. Simpan memori dengan aman
    const valP = elP ? elP.value : null;
    const valEdit = elEdit ? elEdit.value : null;
    const valDraw = elDraw ? elDraw.value : null;
    const valSelect = elSelect ? elSelect.value : null;
    const valRank = elRank ? elRank.value : null;
    const valFilterAtlet = elFilterAtlet ? elFilterAtlet.value : null;

    // 2. Buat ulang daftar <option>
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`;
    const allOpt = '<option value="all">Semua Kategori</option>';

    // 3. Masukkan daftar baru (HANYA jika elemennya ada)
    if (elP) elP.innerHTML = emptyOpt + options;
    if (elEdit) elEdit.innerHTML = emptyOpt + options;
    if (elDraw) elDraw.innerHTML = emptyOpt + options;
    if (elSelect) elSelect.innerHTML = emptyOpt + options;
    if (elRank) elRank.innerHTML = emptyOpt + options;
    if (elFilterAtlet) elFilterAtlet.innerHTML = allOpt + options;

    // 4. Kembalikan pilihan user
    if (valP && elP) elP.value = valP;
    if (valEdit && elEdit) elEdit.value = valEdit;
    if (valDraw && elDraw) elDraw.value = valDraw;
    if (valSelect && elSelect) elSelect.value = valSelect;
    if (valRank && elRank) elRank.value = valRank;
    if (valFilterAtlet && elFilterAtlet) elFilterAtlet.value = valFilterAtlet;
}

function handleCSVUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const rows = e.target.result.split('\n');
        let count = 0;
        rows.forEach((row, i) => {
            if (i === 0 || !row.trim()) return;
            let cols = []; let curr = ''; let inQuotes = false;
            for (let char of row) {
                if (char === '"') inQuotes = !inQuotes;
                else if (char === ',' && !inQuotes) { cols.push(curr); curr = ''; }
                else curr += char;
            }
            cols.push(curr);
            cols = cols.map(item => item.replace(/^"|"$/g, '').trim());

            if (cols.length >= 3) {
                const nama = cols[0], kontingen = cols[1], kategori = cols[2];

                // --- PROTEKSI & PARSING KOLOM BARU ---
                let kyuRaw = cols[3] ? String(cols[3]).trim() : "";
                // Memeras hanya angka, sekotor apa pun ketikannya (misal: "15 Thn" jadi 15)
                let umurRaw = cols[4] ? parseInt(String(cols[4]).replace(/\D/g, '')) || 0 : 0;

                if (nama && STATE.categories.some(c => c.name.toLowerCase() === kategori.toLowerCase())) {
                    STATE.participants.push({
                        id: Date.now() + i,
                        idFirestore: "", // <--- TAMBAHAN: Tanda import lokal manual
                        nama, kontingen, kategori,
                        kyu: kyuRaw, umur: umurRaw,
                        urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0,
                        scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } },
                        finalScore: 0, techScore: 0
                    });
                    count++;
                }
            }
        });
        saveToLocalStorage(); refreshAllData(); event.target.value = ''; alert(`${count} Tim/Atlet diimport sukses.`);
    };
    reader.readAsText(file);
}

// Fungsi Baru: Upload CSV Khusus Kategori (Mendukung Festival)
function handleCategoryCSVUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const rows = e.target.result.split('\n');
        let count = 0;
        rows.forEach((row, i) => {
            if (i === 0 || !row.trim()) return; // Lewati baris pertama (header)
            let cols = row.split(',').map(item => item.replace(/^"|"$/g, '').trim());
            if (cols.length >= 3) {

                // --- FIX ALGORITMA IMPORT DISIPLIN ---
                let discRaw = cols[0].toLowerCase();
                let discipline = discRaw.includes('randori') ? 'randori' : (discRaw.includes('festival') ? 'festival' : 'embu');

                const name = cols[1];
                const type = parseInt(cols[2]) || 1;

                // Cek agar tidak duplikat
                if (name && !STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
                    STATE.categories.push({ id: Date.now() + i, name, type, discipline });
                    count++;
                }
            }
        });
        saveToLocalStorage(); refreshAllData(); event.target.value = ''; alert(`${count} Kategori berhasil diimport.`);
    };
    reader.readAsText(file);
}
// Fungsi Baru: Simpan Setting Minimal Peserta
function saveJudulTV() {
    const val = document.getElementById('setting-judul-tv').value;
    if (!val) return alert("Judul tidak boleh kosong!");
    if (!STATE.settings) STATE.settings = {};

    STATE.settings.judulTV = val.toUpperCase();
    saveToLocalStorage(); // Ini akan otomatis menembak ke Firebase!
    alert("Sip! Judul TV berhasil diubah menjadi:\n" + val.toUpperCase());
}

function saveEksibisiSetting() {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.eksibisiLangsungFinal = document.getElementById('setting-eksibisi-final').checked;
    saveToLocalStorage();
}

function saveMinPesertaSetting() {
    const val = parseInt(document.getElementById('setting-min-peserta').value);
    if (!val || val < 1) return alert("Angka minimal adalah 1.");
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.minPesertaJuara = val;
    saveToLocalStorage();
    alert("Syarat Minimal Peserta diperbarui menjadi " + val);
    renderJuaraUmum();
}

document.getElementById('form-peserta').addEventListener('submit', (e) => {
    e.preventDefault();
    const catName = document.getElementById('p-kategori').value;
    if (!catName) return alert("Pilih kategori!");
    STATE.participants.push({
        id: Date.now(),
        idFirestore: "", // <--- TAMBAHAN: Tanda bahwa ini "Warga Lokal Lapangan"
        nama: document.getElementById('p-nama').value,
        kontingen: document.getElementById('p-kontingen').value,
        kategori: catName,
        kyu: "", umur: 0,
        urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0,
        scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } },
        finalScore: 0, techScore: 0
    });
    saveToLocalStorage();
    renderParticipantTable();
    document.getElementById('p-nama').value = '';
    document.getElementById('p-nama').focus();
});

function saveMaxPoolSetting() {
    const val = parseInt(document.getElementById('setting-max-pool-embu').value);
    if (!val || val < 4) return alert("Angka minimal untuk batas Pool adalah 4.");

    if (!STATE.settings) STATE.settings = {};
    STATE.settings.maxPesertaPoolEmbu = val;

    saveToLocalStorage(); // Otomatis nembak ke server Firebase
    alert("Batas Maksimal Peserta per Pool (Embu) berhasil diperbarui menjadi " + val);
}

function renderParticipantTable(resetPage = false) {
    if (resetPage) currentAthletePage = 1; // Reset ke halaman 1 jika filter berubah

    const body = document.getElementById('table-peserta-body');
    const filter = document.getElementById('filter-atlet-kategori').value;
    let list = filter && filter !== 'all' ? STATE.participants.filter(p => p.kategori === filter) : STATE.participants;

    // --- UPDATE UI PAGINATION ---
    const totalItems = list.length;
    const totalPages = Math.ceil(totalItems / ATHLETES_PER_PAGE) || 1;
    if (currentAthletePage > totalPages) currentAthletePage = totalPages;

    const infoEl = document.getElementById('pagination-info');
    const btnPrev = document.getElementById('btn-prev-page');
    const btnNext = document.getElementById('btn-next-page');

    if (totalItems === 0) {
        if (infoEl) infoEl.innerText = `Menampilkan 0 atlet`;
        if (btnPrev) btnPrev.disabled = true;
        if (btnNext) btnNext.disabled = true;
        return body.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Tidak ada data.</td></tr>`;
    }

    const startIndex = (currentAthletePage - 1) * ATHLETES_PER_PAGE;
    const endIndex = Math.min(startIndex + ATHLETES_PER_PAGE, totalItems);

    if (infoEl) infoEl.innerText = `Menampilkan ${startIndex + 1} - ${endIndex} dari ${totalItems} Atlet`;
    if (btnPrev) btnPrev.disabled = currentAthletePage === 1;
    if (btnNext) btnNext.disabled = currentAthletePage === totalPages;
    // ----------------------------

    let sortedList = [...list].sort((a, b) => a.kategori === b.kategori ? a.urut - b.urut : a.kategori.localeCompare(b.kategori));

    // POTONG DATA UNTUK HALAMAN INI SAJA (MAX 50)
    let paginatedList = sortedList.slice(startIndex, endIndex);

    // --- STRATEGI A: MEMOIZATION (BUKU CONTEKAN) ---
    let cachedRandoriResults = {};
    let cachedRandoriDrawn = {};
    let uniqueCategories = [...new Set(paginatedList.map(p => p.kategori))];

    uniqueCategories.forEach(catName => {
        let catObj = STATE.categories.find(c => c.name === catName);
        if (catObj && catObj.discipline === 'randori') {
            let isDrawn = STATE.matches.some(m => m.kategori === catName);
            cachedRandoriDrawn[catName] = isDrawn;
            if (isDrawn) {
                cachedRandoriResults[catName] = calculateRandoriFinalists(catName);
            }
        }
    });
    // -----------------------------------------------

    body.innerHTML = paginatedList.map(p => {
        let catObj = STATE.categories.find(c => c.name === p.kategori);
        let isRandori = catObj && catObj.discipline === 'randori';
        let isRandoriDrawn = isRandori ? cachedRandoriDrawn[p.kategori] : false;

        let baseStatus = '';
        let resultBadge = '';

        // 1. TENTUKAN STATUS UNDIAN (Dasar)
        if (isRandori) {
            if (isRandoriDrawn) {
                baseStatus = p.pool !== '-' ? `POOL ${p.pool}` : 'Bagan Utama';
            } else {
                baseStatus = `<span class="text-red-400 italic">Belum Undian</span>`;
            }
        } else {
            if (p.urut > 0) {
                let poolLabel = p.pool !== '-' && p.pool !== 'SINGLE' ? ` | POOL ${p.pool}` : '';
                baseStatus = `No.${p.urut}${poolLabel}`;
            } else {
                baseStatus = `<span class="text-red-400 italic">Belum Undian</span>`;
            }
        }

        // 2. TENTUKAN STATUS JUARA / GUGUR (Lencana)
        let isJuara = false;

        if (isRandori && isRandoriDrawn) {
            const poolResults = cachedRandoriResults[p.kategori];
            if (poolResults) {
                poolResults.forEach(res => {
                    if (res.emas === p.nama) {
                        isJuara = true; resultBadge = `<span class="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 1</span>`;
                    } else if (res.perak === p.nama) {
                        isJuara = true; resultBadge = `<span class="bg-slate-300 text-black text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 2</span>`;
                    } else if (res.perunggu.some(br => br.nama === p.nama)) {
                        isJuara = true; resultBadge = `<span class="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 3</span>`;
                    }
                });
            }
        } else if (!isRandori && p.urut > 0) {
            if (p.isFinalist && p.scores.b2.final > 0) {
                let catParts = STATE.participants.filter(x => x.kategori === p.kategori && x.isFinalist && x.scores.b2.final > 0).sort((a, b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech);
                let rank = catParts.findIndex(x => x.id === p.id);
                if (rank === 0) { isJuara = true; resultBadge = `<span class="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 1</span>`; }
                else if (rank === 1) { isJuara = true; resultBadge = `<span class="bg-slate-300 text-black text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 2</span>`; }
                else if (rank === 2) { isJuara = true; resultBadge = `<span class="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 3</span>`; }
            } else if (!p.isFinalist && p.scores.b1.final > 0 && !STATE.participants.some(x => x.kategori === p.kategori && x.isFinalist)) {
                let catParts = STATE.participants.filter(x => x.kategori === p.kategori && x.pool === p.pool && x.scores.b1.final > 0).sort((a, b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
                let rank = catParts.findIndex(x => x.id === p.id);
                if (rank === 0) { isJuara = true; resultBadge = `<span class="bg-yellow-500 text-black text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 1</span>`; }
                else if (rank === 1) { isJuara = true; resultBadge = `<span class="bg-slate-300 text-black text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 2</span>`; }
                else if (rank === 2) { isJuara = true; resultBadge = `<span class="bg-amber-600 text-white text-[10px] px-2 py-0.5 rounded ml-2 font-bold shadow-sm">Juara 3</span>`; }
            }
        }

        if (!isJuara) {
            let isDrawn = isRandori ? isRandoriDrawn : p.urut > 0;
            if (p.losses === 1 && isDrawn) resultBadge = `<span class="bg-orange-600 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold shadow-sm">Loser Bracket</span>`;
            else if (p.losses >= 2 && isDrawn) resultBadge = `<span class="bg-red-800 text-white text-[10px] px-1.5 py-0.5 rounded ml-2 font-bold shadow-sm">Gugur</span>`;
        }

        let statusHTML = `<div class="text-xs text-blue-300 font-semibold mt-1 flex items-center">${baseStatus} ${resultBadge}</div>`;

        return `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
            <td class="p-3 align-top font-bold text-blue-300 w-[35%] whitespace-normal break-words leading-tight">
                ${p.nama} ${p.isFinalist ? '<br><span class="text-[10px] text-yellow-500 font-bold mt-1">FINALIS</span>' : ''}
            </td>
            <td class="p-3 align-top w-[25%] whitespace-normal break-words text-sm text-slate-200">
                ${p.kontingen}
            </td>
            <td class="p-3 align-top text-xs text-slate-400 w-[25%] whitespace-normal break-words leading-relaxed">
                <span class="text-blue-400 font-semibold">${p.kategori}</span>${statusHTML}
            </td>
            <td class="p-3 align-top text-right w-[15%] whitespace-nowrap">
                <button onclick="openEditModal(${p.id})" class="text-blue-400 mr-2 hover:bg-blue-900/50 p-2 rounded transition-colors"><i class="fas fa-edit"></i></button>
                <button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 hover:bg-red-900/30 p-2 rounded transition-colors"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// --- SENSOR UI DRAWING ---
let isSidebarCollapsed = false;

function toggleSidebar() {
    isSidebarCollapsed = !isSidebarCollapsed;
    const catName = document.getElementById('draw-select-kategori').value;
    if (catName) renderVisualBracket(catName);
}

function highlightAthlete(id) {
    if (id == null || id === -1) return;
    document.querySelectorAll(`.athlete-match-${id}`).forEach(el => {
        el.classList.add('ring-4', 'ring-yellow-400', 'shadow-[0_0_20px_rgba(250,204,21,0.6)]', 'scale-[1.03]', 'z-40');
        el.style.borderColor = '#facc15';
    });
}

function removeHighlightAthlete(id) {
    if (id == null || id === -1) return;
    document.querySelectorAll(`.athlete-match-${id}`).forEach(el => {
        el.classList.remove('ring-4', 'ring-yellow-400', 'shadow-[0_0_20px_rgba(250,204,21,0.6)]', 'scale-[1.03]', 'z-40');
        el.style.borderColor = '';
    });
}

// FUNGSI UNTUK PINDAH HALAMAN
function changeAthletePage(delta) {
    currentAthletePage += delta;
    renderParticipantTable();
}

function deletePeserta(id) { if (confirm('Hapus atlet ini?')) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }
function openEditModal(id) { const p = STATE.participants.find(x => x.id === id); if (!p) return; document.getElementById('edit-id').value = p.id; document.getElementById('edit-nama').value = p.nama; document.getElementById('edit-kontingen').value = p.kontingen; document.getElementById('edit-kategori').value = p.kategori; document.getElementById('edit-modal').classList.remove('hidden'); }
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
document.getElementById('form-edit-peserta').addEventListener('submit', (e) => { e.preventDefault(); const id = parseInt(document.getElementById('edit-id').value); const newKategori = document.getElementById('edit-kategori').value; const idx = STATE.participants.findIndex(p => p.id === id); if (idx > -1) { if (STATE.participants[idx].kategori !== newKategori) { STATE.participants[idx].urut = 0; STATE.participants[idx].pool = '-'; STATE.participants[idx].isFinalist = false; STATE.participants[idx].losses = 0; STATE.participants[idx].scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }; STATE.participants[idx].finalScore = 0; STATE.participants[idx].techScore = 0; } STATE.participants[idx].nama = document.getElementById('edit-nama').value; STATE.participants[idx].kontingen = document.getElementById('edit-kontingen').value; STATE.participants[idx].kategori = newKategori; saveToLocalStorage(); renderParticipantTable(); closeEditModal(); alert("Data diperbarui."); } });

const TEMPLATE_4_STANDARD = [
    { matchNum: 1, babak: "Semi-Final", col: 1, slot1: 1, slot2: 2, nextW: 3, nextWSlot: 1, nextL: 4, nextLSlot: 1 },
    { matchNum: 2, babak: "Semi-Final", col: 1, slot1: 3, slot2: 4, nextW: 3, nextWSlot: 2, nextL: 4, nextLSlot: 2 },
    { matchNum: 3, babak: "FINAL ATAS", col: 2, slot1: null, slot2: null, nextW: 6, nextWSlot: 1, nextL: 5, nextLSlot: 1 },
    { matchNum: 4, babak: "LB S-Final", col: 2, slot1: null, slot2: null, nextW: 5, nextWSlot: 2, nextL: null },
    { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 6, nextWSlot: 2, nextL: null },
    { matchNum: 6, babak: "GRAND FINAL", col: 4, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
const TEMPLATE_4_CROSS = [
    { matchNum: 1, babak: "S-Final Crossover", col: 1, slot1: 1, slot2: 4, nextW: 3, nextWSlot: 1, nextL: 4, nextLSlot: 1 },
    { matchNum: 2, babak: "S-Final Crossover", col: 1, slot1: 3, slot2: 2, nextW: 3, nextWSlot: 2, nextL: 4, nextLSlot: 2 },
    { matchNum: 3, babak: "FINAL ATAS", col: 2, slot1: null, slot2: null, nextW: 6, nextWSlot: 1, nextL: 5, nextLSlot: 2 },
    { matchNum: 4, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 5, nextWSlot: 1, nextL: null },
    { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 6, nextWSlot: 2, nextL: null },
    { matchNum: 6, babak: "GRAND FINAL", col: 4, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
const TEMPLATE_8_PERKEMI = [
    { matchNum: 1, babak: "Penyisihan 1", col: 1, slot1: 1, slot2: 2, nextW: 7, nextWSlot: 1, nextL: 5, nextLSlot: 1 },
    { matchNum: 2, babak: "Penyisihan 2", col: 1, slot1: 3, slot2: 4, nextW: 7, nextWSlot: 2, nextL: 5, nextLSlot: 2 },
    { matchNum: 3, babak: "Penyisihan 3", col: 1, slot1: 5, slot2: 6, nextW: 8, nextWSlot: 1, nextL: 6, nextLSlot: 1 },
    { matchNum: 4, babak: "Penyisihan 4", col: 1, slot1: 7, slot2: 8, nextW: 8, nextWSlot: 2, nextL: 6, nextLSlot: 2 },
    { matchNum: 7, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextWSlot: 1, nextL: 10, nextLSlot: 1 },
    { matchNum: 8, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextWSlot: 2, nextL: 9, nextLSlot: 1 },
    { matchNum: 11, babak: "FINAL ATAS", col: 3, slot1: null, slot2: null, nextW: 14, nextWSlot: 1, nextL: 13, nextLSlot: 1 }, // <-- nextLSlot diubah jadi 1 (Pita Merah) 
    { matchNum: 5, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 9, nextWSlot: 2, nextL: null },
    { matchNum: 6, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 10, nextWSlot: 2, nextL: null },
    { matchNum: 9, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextWSlot: 1, nextL: null },
    { matchNum: 10, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextWSlot: 2, nextL: null },
    { matchNum: 12, babak: "LB S-FINAL", col: 3, slot1: null, slot2: null, nextW: 13, nextWSlot: 2, nextL: null }, // <-- nextWSlot diubah jadi 2 (Pita Putih)
    { matchNum: 13, babak: "FINAL BAWAH", col: 4, slot1: null, slot2: null, nextW: 14, nextWSlot: 2, nextL: null },
    { matchNum: 14, babak: "GRAND FINAL", col: 5, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
const TEMPLATE_16 = [
    { matchNum: 1, babak: "WB R1", col: 1, slot1: 1, slot2: 2, nextW: 9, nextWSlot: 1, nextL: 13, nextLSlot: 1 },
    { matchNum: 2, babak: "WB R1", col: 1, slot1: 3, slot2: 4, nextW: 9, nextWSlot: 2, nextL: 13, nextLSlot: 2 },
    { matchNum: 3, babak: "WB R1", col: 1, slot1: 5, slot2: 6, nextW: 10, nextWSlot: 1, nextL: 14, nextLSlot: 1 },
    { matchNum: 4, babak: "WB R1", col: 1, slot1: 7, slot2: 8, nextW: 10, nextWSlot: 2, nextL: 14, nextLSlot: 2 },
    { matchNum: 5, babak: "WB R1", col: 1, slot1: 9, slot2: 10, nextW: 11, nextWSlot: 1, nextL: 15, nextLSlot: 1 },
    { matchNum: 6, babak: "WB R1", col: 1, slot1: 11, slot2: 12, nextW: 11, nextWSlot: 2, nextL: 15, nextLSlot: 2 },
    { matchNum: 7, babak: "WB R1", col: 1, slot1: 13, slot2: 14, nextW: 12, nextWSlot: 1, nextL: 16, nextLSlot: 1 },
    { matchNum: 8, babak: "WB R1", col: 1, slot1: 15, slot2: 16, nextW: 12, nextWSlot: 2, nextL: 16, nextLSlot: 2 },
    { matchNum: 9, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextWSlot: 1, nextL: 20, nextLSlot: 1 },
    { matchNum: 10, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextWSlot: 2, nextL: 19, nextLSlot: 1 },
    { matchNum: 11, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextWSlot: 1, nextL: 18, nextLSlot: 1 },
    { matchNum: 12, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextWSlot: 2, nextL: 17, nextLSlot: 1 },
    { matchNum: 13, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 17, nextWSlot: 2, nextL: null },
    { matchNum: 14, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 18, nextWSlot: 2, nextL: null },
    { matchNum: 15, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 19, nextWSlot: 2, nextL: null },
    { matchNum: 16, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 20, nextWSlot: 2, nextL: null },
    { matchNum: 17, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextWSlot: 1, nextL: null },
    { matchNum: 18, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextWSlot: 2, nextL: null },
    { matchNum: 19, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextWSlot: 1, nextL: null },
    { matchNum: 20, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextWSlot: 2, nextL: null },
    { matchNum: 21, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextWSlot: 1, nextL: 26, nextLSlot: 1 },
    { matchNum: 22, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextWSlot: 2, nextL: 25, nextLSlot: 1 },
    { matchNum: 23, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 25, nextWSlot: 2, nextL: null },
    { matchNum: 24, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 26, nextWSlot: 2, nextL: null },
    { matchNum: 25, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextWSlot: 1, nextL: null },
    { matchNum: 26, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextWSlot: 2, nextL: null },
    { matchNum: 27, babak: "FINAL ATAS", col: 6, slot1: null, slot2: null, nextW: 30, nextWSlot: 1, nextL: 29, nextLSlot: 1 },
    { matchNum: 28, babak: "LB SF", col: 6, slot1: null, slot2: null, nextW: 29, nextWSlot: 2, nextL: null },
    { matchNum: 29, babak: "FINAL BAWAH", col: 7, slot1: null, slot2: null, nextW: 30, nextWSlot: 2, nextL: null },
    { matchNum: 30, babak: "GRAND FINAL", col: 8, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
// --- TEMPLATE SINGLE ELIMINATION (SISTEM GUGUR BIASA) ---
const SINGLE_TEMPLATE_4 = [
    { matchNum: 1, babak: "Semi-Final", col: 1, slot1: 1, slot2: 2, nextW: 3, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 2, babak: "Semi-Final", col: 1, slot1: 3, slot2: 4, nextW: 3, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 3, babak: "FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
const SINGLE_TEMPLATE_4_CROSS = [
    { matchNum: 1, babak: "S-Final Crossover", col: 1, slot1: 1, slot2: 4, nextW: 3, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 2, babak: "S-Final Crossover", col: 1, slot1: 3, slot2: 2, nextW: 3, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 3, babak: "GRAND FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
const SINGLE_TEMPLATE_8 = [
    { matchNum: 1, babak: "Quarter-Final", col: 1, slot1: 1, slot2: 2, nextW: 5, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 2, babak: "Quarter-Final", col: 1, slot1: 3, slot2: 4, nextW: 5, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 3, babak: "Quarter-Final", col: 1, slot1: 5, slot2: 6, nextW: 6, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 4, babak: "Quarter-Final", col: 1, slot1: 7, slot2: 8, nextW: 6, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 5, babak: "Semi-Final", col: 2, slot1: null, slot2: null, nextW: 7, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 6, babak: "Semi-Final", col: 2, slot1: null, slot2: null, nextW: 7, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 7, babak: "FINAL", col: 3, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];
const SINGLE_TEMPLATE_16 = [
    { matchNum: 1, babak: "Babak 16", col: 1, slot1: 1, slot2: 2, nextW: 9, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 2, babak: "Babak 16", col: 1, slot1: 3, slot2: 4, nextW: 9, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 3, babak: "Babak 16", col: 1, slot1: 5, slot2: 6, nextW: 10, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 4, babak: "Babak 16", col: 1, slot1: 7, slot2: 8, nextW: 10, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 5, babak: "Babak 16", col: 1, slot1: 9, slot2: 10, nextW: 11, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 6, babak: "Babak 16", col: 1, slot1: 11, slot2: 12, nextW: 11, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 7, babak: "Babak 16", col: 1, slot1: 13, slot2: 14, nextW: 12, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 8, babak: "Babak 16", col: 1, slot1: 15, slot2: 16, nextW: 12, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 9, babak: "Quarter-Final", col: 2, slot1: null, slot2: null, nextW: 13, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 10, babak: "Quarter-Final", col: 2, slot1: null, slot2: null, nextW: 13, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 11, babak: "Quarter-Final", col: 2, slot1: null, slot2: null, nextW: 14, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 12, babak: "Quarter-Final", col: 2, slot1: null, slot2: null, nextW: 14, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 13, babak: "Semi-Final", col: 3, slot1: null, slot2: null, nextW: 15, nextWSlot: 1, nextL: null, nextLSlot: null },
    { matchNum: 14, babak: "Semi-Final", col: 3, slot1: null, slot2: null, nextW: 15, nextWSlot: 2, nextL: null, nextLSlot: null },
    { matchNum: 15, babak: "FINAL", col: 4, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];

// ==========================================
// MESIN GENERATOR BAGAN RANDORI (1:1 LOCAL MAPPING - CLEAN)
// ==========================================
function generateRandoriBracket() {
    const container = document.getElementById('randori-bracket-view');
    const wrapper = document.getElementById('randori-bracket-container');
    SWAP_SELECTION = null;

    try {
        const catName = document.getElementById('draw-select-kategori').value;
        if (!catName) return alert("Pilih kategori Randori terlebih dahulu!");

        const isFinalCategory = catName.toUpperCase().includes('FINAL');
        let athletes = STATE.participants.filter(p => p.kategori === catName);
        if (isFinalCategory) athletes = athletes.sort((a, b) => a.id - b.id);

        const count = athletes.length;
        if (count === 0) return alert("Belum ada peserta di kategori ini!");

        const existingMatches = STATE.matches.filter(m => m.kategori === catName);
        if (existingMatches.length > 0) {
            if (!confirm("Bagan sudah ada! Mengacak ulang akan menghapus semua data pertandingan dan BAGAN AKAN BERUBAH. Yakin?")) return;
            STATE.matches = STATE.matches.filter(m => m.kategori !== catName);
            STATE.participants.filter(p => p.kategori === catName).forEach(p => p.losses = 0);
        }

        let poolConfigs = [];
        let mode = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';
        // Ambil setting mode khusus untuk final
        let finalMode = (STATE.settings && STATE.settings.finalRandoriMode) ? STATE.settings.finalRandoriMode : 'single';

        if (count <= 4) {
            let temp4;
            if (isFinalCategory) {
                temp4 = finalMode === 'single' ? SINGLE_TEMPLATE_4_CROSS : TEMPLATE_4_CROSS;
            } else {
                temp4 = mode === 'single' ? SINGLE_TEMPLATE_4 : TEMPLATE_4_STANDARD;
            }
            poolConfigs.push({ name: '-', template: temp4, size: 4, athletes: athletes, isCrossover: isFinalCategory });
        } else if (count <= 8) {
            let temp8 = mode === 'single' ? SINGLE_TEMPLATE_8 : TEMPLATE_8_PERKEMI;
            poolConfigs.push({ name: '-', template: temp8, size: 8, athletes: athletes, isCrossover: false });
        } else if (count <= 32) {
            if (!confirm(`Terdapat ${count} peserta. Sistem akan memecah menjadi 2 Pool (A dan B). Lanjutkan?`)) return;
            let shuffledAthletes = [...athletes];

            if (!isFinalCategory) {
                for (let i = shuffledAthletes.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    let temp = shuffledAthletes[i]; shuffledAthletes[i] = shuffledAthletes[j]; shuffledAthletes[j] = temp;
                }
            }

            let mid = Math.ceil(count / 2);
            let poolA = shuffledAthletes.slice(0, mid);
            let poolB = shuffledAthletes.slice(mid);

            poolA.forEach(a => { const p = STATE.participants.find(x => x.id === a.id); if (p) p.pool = 'A'; });
            poolB.forEach(a => { const p = STATE.participants.find(x => x.id === a.id); if (p) p.pool = 'B'; });

            let sizeA = poolA.length <= 4 ? 4 : (poolA.length <= 8 ? 8 : 16);
            let tempA = mode === 'single' ? (sizeA === 4 ? SINGLE_TEMPLATE_4 : (sizeA === 8 ? SINGLE_TEMPLATE_8 : SINGLE_TEMPLATE_16)) : (sizeA === 4 ? TEMPLATE_4_STANDARD : (sizeA === 8 ? TEMPLATE_8_PERKEMI : TEMPLATE_16));
            poolConfigs.push({ name: 'A', template: tempA, size: sizeA, athletes: poolA, isCrossover: false });

            let sizeB = poolB.length <= 4 ? 4 : (poolB.length <= 8 ? 8 : 16);
            let tempB = mode === 'single' ? (sizeB === 4 ? SINGLE_TEMPLATE_4 : (sizeB === 8 ? SINGLE_TEMPLATE_8 : SINGLE_TEMPLATE_16)) : (sizeB === 4 ? TEMPLATE_4_STANDARD : (sizeB === 8 ? TEMPLATE_8_PERKEMI : TEMPLATE_16));
            poolConfigs.push({ name: 'B', template: tempB, size: sizeB, athletes: poolB, isCrossover: false });

            // 🌟 BLOK PRE-GENERATE POOL "-" KOSONG TELAH DICABUT DARI SINI 🌟

        } else {
            return alert("Sistem saat ini mendukung maksimal 32 peserta per nomor.");
        }

        let globalMatchIdCounter = Date.now();

        // 🔄 PERULANGAN UTAMA PER-POOL
        poolConfigs.forEach((config) => {
            const slotsCount = config.size;
            const athleteCount = config.athletes.length;
            const byeCount = slotsCount - athleteCount;
            const totalMatchesR1 = slotsCount / 2;

            if (config.isCrossover && byeCount > 0 && athleteCount > 0) return alert("Template Crossover Final membutuhkan 4 peserta penuh (tanpa BYE).");

            let finalSlots = new Array(slotsCount).fill(null);

            if (athleteCount > 0) {
                const shuffledAthletes = [...config.athletes];

                if (!isFinalCategory) {
                    for (let i = shuffledAthletes.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        let temp = shuffledAthletes[i]; shuffledAthletes[i] = shuffledAthletes[j]; shuffledAthletes[j] = temp;
                    }
                }

                if (byeCount === 0) {
                    shuffledAthletes.forEach((p, idx) => finalSlots[idx] = p.id);
                } else {
                    let athleteIds = shuffledAthletes.map(a => a.id);
                    let oddSlots = [], evenSlots = [];
                    for (let i = 1; i <= slotsCount; i++) { if (i % 2 !== 0) oddSlots.push(i); else evenSlots.push(i); }
                    if (byeCount > totalMatchesR1) return alert("Kesalahan Fatal: Jumlah BYE melebihi jumlah partai Babak 1.");

                    let evenSlotsDistributed = [];
                    const matchesPerQuarter = totalMatchesR1 / 4;

                    if (matchesPerQuarter >= 1) {
                        const quartersEvenRaw = [
                            evenSlots.slice(0, matchesPerQuarter),
                            evenSlots.slice(matchesPerQuarter, matchesPerQuarter * 2),
                            evenSlots.slice(matchesPerQuarter * 2, matchesPerQuarter * 3),
                            evenSlots.slice(matchesPerQuarter * 3)
                        ];
                        for (let i = 0; i < matchesPerQuarter; i++) {
                            [0, 2, 1, 3].forEach(qIdx => { evenSlotsDistributed.push(quartersEvenRaw[qIdx][i]); });
                        }
                    } else {
                        evenSlotsDistributed = [...evenSlots];
                    }

                    for (let b = 0; b < byeCount; b++) { finalSlots[evenSlotsDistributed[b] - 1] = -1; }
                    for (let o = 0; o < totalMatchesR1; o++) { finalSlots[oddSlots[o] - 1] = athleteIds.shift(); }
                    const unfilledEvenIndices = evenSlotsDistributed.slice(byeCount).map(s => s - 1);
                    unfilledEvenIndices.forEach(idx => { finalSlots[idx] = athleteIds.shift(); });
                }
            }

            // 🌟 LOCAL BRACKET 1:1 MAPPING 🌟
            // Sistem akan selalu mulai dari matchNum 1, 2, 3... per setiap pergantian Pool
            config.template.forEach(t => {
                let mrhId = null;
                let pthId = null;

                if (config.isCrossover && athleteCount === 0) {
                    mrhId = null; pthId = null;
                } else {
                    mrhId = t.slot1 !== null ? finalSlots[t.slot1 - 1] : null;
                    pthId = t.slot2 !== null ? finalSlots[t.slot2 - 1] : null;
                }

                let match = {
                    id: globalMatchIdCounter++,
                    kategori: catName,
                    pool: config.name,
                    matchNum: t.matchNum, // <-- Mengikuti murni angka Template
                    babak: t.babak,
                    col: t.col,
                    nextW: t.nextW,
                    nextWSlot: t.nextWSlot || null,
                    nextL: t.nextL,
                    nextLSlot: t.nextLSlot || null,
                    merahId: mrhId,
                    putihId: pthId,
                    winnerId: null, loserId: null, status: 'pending', skorMerah: 0, skorPutih: 0
                };
                STATE.matches.push(match);
            });
        });

        processAutoWins(catName);
        saveToLocalStorage();
        renderVisualBracket(catName);
        setTimeout(() => alert(`Bagan berhasil di-generate menggunakan Local Bracket Mapping!`), 300);
    } catch (err) { console.error(err); }
}

function resetNilaiKategoriLokal() {
    const catName = document.getElementById('draw-select-kategori').value;
    if (!catName) return alert("Pilih kategori terlebih dahulu.");
    const categoryObj = STATE.categories.find(c => c.name === catName);
    if (!categoryObj) return;

    if (!confirm(`⚠️ PERHATIAN!\nAnda akan MENGHAPUS SEMUA HASIL NILAI di kategori "${catName}".\n\nBagan atau Urutan Tampil TIDAK AKAN BERUBAH.\n\nApakah Anda yakin ingin mengosongkan nilai?`)) return;

    if (categoryObj.discipline === 'randori') {
        STATE.matches = STATE.matches.filter(m => !(m.kategori === catName && m.babak === "SUDDEN DEATH"));
        let catMatches = STATE.matches.filter(m => m.kategori === catName);
        catMatches.forEach(m => {
            if (m.col > 1) { m.merahId = null; m.putihId = null; }
            m.status = 'pending'; m.winnerId = null; m.loserId = null; m.skorMerah = 0; m.skorPutih = 0;
        });
        STATE.participants.filter(p => p.kategori === catName).forEach(p => p.losses = 0);
        processAutoWins(catName);
    } else {
        STATE.participants.filter(p => p.kategori === catName).forEach(p => {
            p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } };
            p.finalScore = 0; p.techScore = 0;
        });
    }

    saveToLocalStorage();
    checkExistingDrawing();
    alert('Data nilai berhasil dikosongkan. Susunan bagan/urutan tetap aman!');
}

function handleSwap(matchId, corner, participantId, event) {
    if (event) event.stopPropagation();
    let match = STATE.matches.find(m => m.id === matchId);
    if (!match) return;
    let hasStarted = STATE.matches.some(x => x.kategori === match.kategori && x.status === 'done');
    if (hasStarted) return alert("❌ PERINGATAN DIRECTOR:\nTidak bisa menukar posisi! Turnamen di kategori ini sudah berjalan.\n\nKosongkan seluruh nilai jika Anda harus menukar posisi.");
    if (!SWAP_SELECTION) {
        SWAP_SELECTION = { matchId, corner, participantId };
        renderVisualBracket(match.kategori);
    } else {
        if (SWAP_SELECTION.matchId === matchId && SWAP_SELECTION.corner === corner) {
            SWAP_SELECTION = null;
            renderVisualBracket(match.kategori);
            return;
        }
        let matchA = STATE.matches.find(m => m.id === SWAP_SELECTION.matchId);
        let matchB = match;
        let tempId = matchA[SWAP_SELECTION.corner + 'Id'];
        matchA[SWAP_SELECTION.corner + 'Id'] = matchB[corner + 'Id'];
        matchB[corner + 'Id'] = tempId;

        SWAP_SELECTION = null;
        recalculateBracket(match.kategori);
    }
}

function recalculateBracket(catName) {
    let catMatches = STATE.matches.filter(m => m.kategori === catName);
    catMatches.forEach(m => {
        if (m.col > 1) { m.merahId = null; m.putihId = null; }
        m.status = 'pending'; m.winnerId = null; m.loserId = null; m.skorMerah = 0; m.skorPutih = 0;
    });
    processAutoWins(catName);
    saveToLocalStorage();
    renderVisualBracket(catName);
}

function recalculateAllLosses(catName) {
    STATE.participants.filter(p => p.kategori === catName).forEach(p => p.losses = 0);
    STATE.matches.filter(m => m.kategori === catName && (m.status === 'done' || m.status === 'auto-win')).forEach(m => {
        let actualLoserId = m.loserId;
        if (actualLoserId === undefined || actualLoserId === null) {
            if (m.winnerId !== null) {
                if (m.winnerId === m.merahId) actualLoserId = m.putihId;
                else if (m.winnerId === m.putihId) actualLoserId = m.merahId;
            }
        }
        if (actualLoserId && actualLoserId !== -1) {
            let loserP = STATE.participants.find(p => p.id === actualLoserId);
            if (loserP) loserP.losses += 1;
        }
    });
    saveToLocalStorage();
}

function undoMatchResult(matchId) {
    let match = STATE.matches.find(m => m.id === matchId);
    if (!match || match.status !== 'done') return;

    if (!confirm(`⚠️ Batalkan hasil pertandingan G-${match.matchNum % 50 === 0 ? 50 : match.matchNum % 50}?`)) return;

    let nextWMatch = STATE.matches.find(m => m.kategori === match.kategori && m.matchNum === match.nextW && m.pool === match.pool);
    let nextLMatch = STATE.matches.find(m => m.kategori === match.kategori && m.matchNum === match.nextL && m.pool === match.pool);

    if (nextWMatch && nextWMatch.status !== 'pending' && nextWMatch.status !== 'auto-win') { return alert("❌ UNDO DITOLAK:\nPartai lanjutan dari pemenang sudah terlanjur dimainkan."); }
    if (nextLMatch && nextLMatch.status !== 'pending' && nextLMatch.status !== 'auto-win') { return alert("❌ UNDO DITOLAK:\nPartai lanjutan dari yang kalah sudah terlanjur dimainkan."); }

    if (nextWMatch) {
        if (nextWMatch.merahId === match.winnerId) nextWMatch.merahId = null;
        if (nextWMatch.putihId === match.winnerId) nextWMatch.putihId = null;
    }

    let loserId = match.loserId;
    if (!loserId) { loserId = (match.winnerId === match.merahId) ? match.putihId : match.merahId; }

    if (nextLMatch && loserId) {
        if (nextLMatch.merahId === loserId) nextLMatch.merahId = null;
        if (nextLMatch.putihId === loserId) nextLMatch.putihId = null;
    }

    if (match.nextW === 'WINNER') {
        STATE.matches = STATE.matches.filter(m => !(m.kategori === match.kategori && m.pool === match.pool && m.babak === "SUDDEN DEATH"));
    }

    match.status = 'pending'; match.winnerId = null; match.loserId = null; match.skorMerah = 0; match.skorPutih = 0;

    recalculateAllLosses(match.kategori);
    processAutoWins(match.kategori);

    // --- STRATEGI B: BRANCH UPDATE ---
    let updates = {};
    updates['turnamen_data/matches'] = STATE.matches;
    updates['turnamen_data/participants'] = STATE.participants;

    database.ref().update(updates).then(() => {
        renderVisualBracket(match.kategori); filterPesertaScoring();
    }).catch(err => alert("Gagal Undo: " + err));
}

function forwardParticipant(targetMatchNum, participantId, catName, poolName, targetSlot = null) {
    if (!targetMatchNum || targetMatchNum === 'WINNER' || targetMatchNum === 'SECOND' || participantId == null) return;
    let targetMatch = STATE.matches.find(m => m.kategori === catName && m.matchNum === targetMatchNum && m.pool === poolName);
    if (targetMatch) {
        if (participantId !== -1 && (targetMatch.merahId === participantId || targetMatch.putihId === participantId)) return;

        // Memaksa atlet masuk ke Pita Merah (1) atau Putih (2)
        if (targetSlot === 1) targetMatch.merahId = participantId;
        else if (targetSlot === 2) targetMatch.putihId = participantId;
        else {
            if (targetMatch.merahId == null) targetMatch.merahId = participantId;
            else if (targetMatch.putihId == null) targetMatch.putihId = participantId;
        }
    }
}

function processAutoWins(catName) {
    let changed = true; let loopGuard = 0;
    while (changed && loopGuard < 100) {
        changed = false; loopGuard++;
        STATE.matches.filter(m => m.kategori === catName && m.status === 'pending').forEach(match => {
            if (match.merahId != null && match.putihId != null) {
                if (match.merahId === -1 || match.putihId === -1) {
                    match.status = 'auto-win';
                    if (match.merahId === -1 && match.putihId === -1) { match.winnerId = -1; match.loserId = -1; }
                    else { match.winnerId = match.merahId === -1 ? match.putihId : match.merahId; match.loserId = -1; }

                    forwardParticipant(match.nextW, match.winnerId, catName, match.pool, match.nextWSlot);
                    if (match.nextL) forwardParticipant(match.nextL, match.loserId, catName, match.pool, match.nextLSlot);
                    changed = true;
                }
            }
        });
    }
    recalculateAllLosses(catName);
}

function renderVisualBracket(catName) {
    const container = document.getElementById('randori-bracket-view');
    const oldWrapper = document.getElementById('randori-bracket-container');
    const newWrapper = document.getElementById('randori-layout-wrapper');
    const sidebar = document.getElementById('randori-sidebar');

    // Buka KEDUA jubah gaib secara paksa
    if (newWrapper) newWrapper.classList.remove('hidden');
    if (oldWrapper) oldWrapper.classList.remove('hidden');

    try {
        container.innerHTML = '';
        if (sidebar) sidebar.innerHTML = '';

        const catMatches = STATE.matches.filter(m => m.kategori === catName);
        if (catMatches.length === 0) return;

        let pools = []; catMatches.forEach(m => { if (pools.indexOf(m.pool) === -1) pools.push(m.pool); });
        pools.sort();

        // 🎯 DETEKSI MODE: Single Pool / Final vs Multi Pool
        const isSinglePool = pools.length === 1 && (pools[0] === '-' || pools[0] === 'SINGLE');
        const mode = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';
        let poolResults = calculateRandoriFinalists(catName) || [];

        // ==========================================
        // 1. RENDER PANEL KIRI (SIDEBAR SLOT MAP)
        // ==========================================
        if (sidebar) {
            if (isSidebarCollapsed) {
                // Mode Disembunyikan (Collapsed)
                sidebar.className = "w-full lg:w-12 bg-dark-card border border-slate-700 rounded-2xl shadow-xl flex-shrink-0 lg:sticky top-20 flex flex-col transition-all duration-300 cursor-pointer hover:bg-slate-800 z-30";
                sidebar.innerHTML = `
                    <div onclick="toggleSidebar()" class="h-full w-full py-6 flex flex-col items-center justify-start gap-4 text-slate-400" title="Buka Daftar Slot Atlet">
                        <i class="fas fa-expand-arrows-alt text-xl mt-4"></i>
                        <div class="writing-vertical-rl transform -rotate-90 font-bold tracking-widest uppercase mt-20 whitespace-nowrap">DAFTAR ATLET</div>
                    </div>
                `;
            } else {
                // Mode Terbuka Penuh
                sidebar.className = "w-full lg:w-1/3 xl:w-2/5 bg-dark-card border border-slate-700 rounded-2xl shadow-xl flex-shrink-0 lg:sticky top-20 flex flex-col transition-all duration-300 max-h-[85vh] z-30";

                let sidebarHTML = `
                    <div class="p-3 border-b border-slate-700 flex justify-between items-center bg-slate-800 rounded-t-2xl z-20 sticky top-0 shadow-sm">
                        <h3 class="font-black text-white text-sm"><i class="fas fa-list-ol text-blue-500 mr-2"></i>Peta Slot Undian</h3>
                        <button onclick="toggleSidebar()" class="text-slate-400 hover:text-white transition-colors bg-slate-700 hover:bg-slate-600 w-7 h-7 rounded flex items-center justify-center" title="Sembunyikan Daftar"><i class="fas fa-compress-arrows-alt"></i></button>
                    </div>
                    <div class="p-4 overflow-y-auto custom-scrollbar flex-1">
                `;

                // 🎯 DYNAMIC GRID: 1 Kolom (Single Pool) vs 2 Kolom (Multi Pool)
                let gridClass = isSinglePool ? "grid grid-cols-1 gap-6" : "grid grid-cols-1 lg:grid-cols-2 gap-4";
                sidebarHTML += `<div class="${gridClass}">`;

                pools.forEach(poolName => {
                    let poolResult = poolResults.find(r => r.pool === poolName);
                    let juara1 = poolResult ? poolResult.emas : null;

                    sidebarHTML += `<div class="flex flex-col gap-2">`;
                    if (!isSinglePool) {
                        sidebarHTML += `<h4 class="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 border-b border-slate-700 pb-1 text-center">POOL ${poolName}</h4>`;
                    }

                    // 👉 REVERSE LOOKUP: Membaca Bagan Babak Penyisihan (col === 1)
                    let r1Matches = catMatches.filter(m => m.pool === poolName && m.col === 1).sort((a, b) => a.matchNum - b.matchNum);

                    let slotCounter = 1;
                    r1Matches.forEach(m => {
                        sidebarHTML += generateSlotCard(slotCounter++, m.merahId, mode, juara1); // Slot Merah
                        sidebarHTML += generateSlotCard(slotCounter++, m.putihId, mode, juara1); // Slot Putih
                    });

                    sidebarHTML += `</div>`;
                });

                sidebarHTML += `</div>`; // Tutup Grid

                // LEGENDA WARNA
                sidebarHTML += `
                    <div class="pt-3 mt-4 border-t border-slate-700">
                        <div class="flex flex-wrap gap-y-2 gap-x-4 text-[9px] text-slate-400 font-bold uppercase tracking-wider justify-center">
                            <div class="flex items-center gap-1.5"><div class="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.8)]"></div> Aktif</div>
                            <div class="flex items-center gap-1.5"><i class="fas fa-exclamation-triangle text-orange-500"></i> Loser Bracket</div>
                            <div class="flex items-center gap-1.5"><i class="fas fa-skull-crossbones text-red-500"></i> Gugur</div>
                            <div class="flex items-center gap-1.5"><i class="fas fa-crown text-yellow-500 text-[10px]"></i> Juara</div>
                        </div>
                    </div>
                </div>`;
                sidebar.innerHTML = sidebarHTML;
            }
        }

        // ==========================================
        // 2. RENDER PANEL KANAN (INFINITE HORIZONTAL CANVAS)
        // ==========================================
        let poolHTML = '<div class="flex flex-row items-start gap-12 p-2 w-full min-w-max">'; // 🌟 KUNCI: Flex-Row mengalirkan Pool A & B ke kanan

        pools.forEach((poolName, poolIndex) => {
            let poolMatches = catMatches.filter(m => m.pool === poolName);

            // Jika ini pool kedua (Pool B), sisipkan dinding pembatas visual yang kontras
            if (poolIndex > 0) {
                poolHTML += `
                <div class="flex flex-col items-center justify-stretch self-stretch w-1 bg-gradient-to-b from-red-600/50 via-slate-700 to-red-600/50 rounded-full mx-4 relative shrink-0">
                    <div class="absolute top-1/4 transform -translate-y-1/2 bg-slate-900 border border-red-500/40 text-[9px] font-black text-red-400 px-2 py-4 rounded-md tracking-widest uppercase [writing-mode:vertical-lr] shadow-lg">
                        Batas Pool B ➡️
                    </div>
                </div>`;
            }

            poolHTML += `
            <div class="flex flex-col shrink-0">
                <div class="flex items-center gap-3 mb-6 border-b border-slate-700 pb-2">
                    <h3 class="text-xl font-black text-yellow-400 m-0 uppercase tracking-wider"><i class="fas fa-sitemap text-red-500 mr-2"></i>Bagan ${poolName !== '-' ? 'Pool ' + poolName : 'Utama'}</h3>
                    <span class="text-[10px] text-slate-500 font-mono ml-2 border-l border-slate-700 pl-3 hidden md:block">Swap: Klik Nama</span>
                    <button onclick="resetNilaiKategoriLokal()" class="ml-auto bg-red-900/50 border border-red-700 text-red-400 hover:bg-red-500 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors" title="Kosongkan Nilai Saja (Bagan Tetap)">
                        <i class="fas fa-eraser text-xs"></i>
                    </button>
                </div>
                
                <div class="flex flex-row gap-8 items-stretch">`; // 🌟 Setiap babak di dalam pool mengalir horisontal

            let columns = [];
            poolMatches.forEach(m => { if (columns.indexOf(m.col) === -1) columns.push(m.col); });
            columns.sort((a, b) => a - b);
            let maxCol = columns[columns.length - 1];

            columns.forEach(colNum => {
                let colMatches = poolMatches.filter(m => m.col === colNum).sort((a, b) => a.matchNum - b.matchNum);
                if (colMatches.length === 0) return;

                let colHTML = `<div class="flex flex-col min-w-[240px]">`;
                colHTML += `<h4 class="text-center text-xs font-black uppercase text-slate-500 mb-6 tracking-widest shrink-0">Babak ${colNum}</h4>`;
                colHTML += `<div class="flex flex-col gap-6 justify-center flex-1">`;

                colMatches.forEach(m => {
                    let displayNum = m.matchNum % 50 === 0 ? 50 : m.matchNum % 50;
                    let pMerah = STATE.participants.find(p => p.id === m.merahId);
                    let pPutih = STATE.participants.find(p => p.id === m.putihId);

                    let nMerahRaw = m.merahId === -1 ? "BYE" : (pMerah ? (pMerah.nama.includes(',') ? pMerah.kontingen : pMerah.nama) : (m.merahId ? "Hantu" : "Menunggu..."));
                    let nPutihRaw = m.putihId === -1 ? "BYE" : (pPutih ? (pPutih.nama.includes(',') ? pPutih.kontingen : pPutih.nama) : (m.putihId ? "Hantu" : "Menunggu..."));

                    let bgStyle = m.status === 'done' ? 'border-green-500 bg-slate-800' : m.status === 'auto-win' ? 'border-slate-600 bg-slate-900 opacity-50' : 'border-blue-500 bg-slate-800';
                    let wMerah = m.winnerId === m.merahId ? 'text-green-400' : m.winnerId && m.winnerId !== m.merahId ? 'text-slate-500 line-through' : 'text-red-400';
                    let wPutih = m.winnerId === m.putihId ? 'text-green-400' : m.winnerId && m.winnerId !== m.putihId ? 'text-slate-500 line-through' : 'text-white';

                    let isInteractive = (m.col === 1 && (m.status === 'pending' || m.status === 'auto-win'));

                    if (isInteractive) {
                        nMerahRaw = `<i class="fas fa-exchange-alt text-[8px] text-yellow-500 mr-1"></i>` + nMerahRaw;
                        nPutihRaw = `<i class="fas fa-exchange-alt text-[8px] text-yellow-500 mr-1"></i>` + nPutihRaw;
                    }

                    let activeM = (SWAP_SELECTION && SWAP_SELECTION.matchId === m.id && SWAP_SELECTION.corner === 'merah') ? 'bg-yellow-600/80 px-1 rounded text-white shadow-[0_0_10px_rgba(234,179,8,0.5)]' : '';
                    let activeP = (SWAP_SELECTION && SWAP_SELECTION.matchId === m.id && SWAP_SELECTION.corner === 'putih') ? 'bg-yellow-600/80 px-1 rounded text-white shadow-[0_0_10px_rgba(234,179,8,0.5)]' : '';
                    let cursorM = isInteractive ? `cursor-pointer hover:text-yellow-400 border-b border-dashed border-slate-500 ${activeM}` : '';
                    let cursorP = isInteractive ? `cursor-pointer hover:text-yellow-400 border-b border-dashed border-slate-500 ${activeP}` : '';

                    let nMerahHTML = `
                        <div class="group relative flex-1 min-w-0 mr-2 flex items-center">
                            <span class="${wMerah} truncate block w-full ${cursorM}" ${isInteractive ? `onclick="handleSwap(${m.id}, 'merah', ${m.merahId}, event)" title="Klik untuk Tukar"` : ''}>${nMerahRaw}</span>
                        </div>`;

                    let nPutihHTML = `
                        <div class="group relative flex-1 min-w-0 mr-2 flex items-center">
                            <span class="${wPutih} truncate block w-full ${cursorP}" ${isInteractive ? `onclick="handleSwap(${m.id}, 'putih', ${m.putihId}, event)" title="Klik untuk Tukar"` : ''}>${nPutihRaw}</span>
                        </div>`;

                    let undoBtn = m.status === 'done' ? `<button onclick="undoMatchResult(${m.id})" class="absolute -bottom-2 -right-2 bg-red-600 hover:bg-red-500 text-white text-[10px] w-7 h-7 rounded-full shadow-lg border border-slate-800 z-10 flex items-center justify-center transition-transform hover:scale-110" title="Batalkan Hasil Partai Ini"><i class="fas fa-undo"></i></button>` : '';

                    // 🌟 LOGIKA TOOLTIP VERIFIKASI (PAPERLESS) 🌟
                    let vfBadge = '';
                    if (m.status === 'done' && m.verifikator) {
                        let tW = m.verifikator.wasit || 'Belum Verifikasi';
                        let tM = m.verifikator.officialMerah || 'Belum Verifikasi';
                        let tP = m.verifikator.officialPutih || 'Belum Verifikasi';
                        let isFull = (m.verifikator.wasit && m.verifikator.officialMerah && m.verifikator.officialPutih);
                        let vColor = isFull ? 'bg-green-500 border-green-700' : 'bg-yellow-500 border-yellow-700';

                        vfBadge = `
                        <div class="absolute -top-3 -right-3 group/tooltip z-50">
                            <div class="${vColor} text-black w-6 h-6 rounded-full flex items-center justify-center font-black border-2 shadow-md cursor-help text-[10px]">!</div>
                            <div class="absolute bottom-full right-0 mb-2 w-56 bg-slate-800 border border-slate-600 rounded-lg shadow-2xl p-3 opacity-0 group-hover/tooltip:opacity-100 transition-opacity pointer-events-none text-[10px] z-50">
                                <div class="font-black text-white border-b border-slate-700 pb-1 mb-1.5 text-center flex items-center justify-center gap-1"><i class="fas fa-qrcode text-blue-400"></i> STATUS VERIFIKASI</div>
                                <div class="text-slate-300 flex justify-between"><b>Wasit:</b><span class="text-blue-400 text-right truncate w-24">${tW}</span></div>
                                <div class="text-slate-300 mt-1 flex justify-between"><b>Off. Merah:</b><span class="text-red-400 text-right truncate w-24">${tM}</span></div>
                                <div class="text-slate-300 mt-1 flex justify-between"><b>Off. Putih:</b><span class="text-white text-right truncate w-24">${tP}</span></div>
                            </div>
                        </div>`;
                    }

                    let dMerah = m.skorMerah > 0 ? m.skorMerah : '';
                    let dPutih = m.skorPutih > 0 ? m.skorPutih : '';

                    if (m.status === 'done' && m.skorMerah > 0 && m.skorMerah === m.skorPutih) {
                        if (m.tbMerahW1 !== undefined && m.tbPutihW1 !== undefined) {
                            dMerah += `/${m.tbMerahW1}`;
                            dPutih += `/${m.tbPutihW1}`;
                            if (m.tbMerahW1 === m.tbPutihW1 && m.tbMerahAll !== undefined) {
                                dMerah += `/${m.tbMerahAll || 0}`;
                                dPutih += `/${m.tbPutihAll || 0}`;
                            }
                        }
                    }

                    colHTML += `
                        <div class="bracket-match p-3 rounded-lg border-2 ${bgStyle} relative shadow-lg transition-all flex-none athlete-match-${m.merahId} athlete-match-${m.putihId}">
                            <span class="absolute -top-3 -left-3 bg-slate-700 text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-black border border-slate-500">G${displayNum}</span>
                            ${undoBtn}
                            ${vfBadge}
                            <span class="text-[9px] uppercase text-slate-400 block mb-2 font-bold">${m.babak}</span>
                            <div class="flex justify-between items-center text-sm font-bold border-b border-slate-700 pb-1 mb-1">
                                ${nMerahHTML}
                                <span class="text-xs text-slate-500 shrink-0">${dMerah}</span>
                            </div>
                            <div class="flex justify-between items-center text-sm font-bold">
                                ${nPutihHTML}
                                <span class="text-xs text-slate-500 shrink-0">${dPutih}</span>
                            </div>
                        </div>
                    `;
                });

                colHTML += `</div></div>`;

                if (colNum < maxCol) colHTML += `<div class="flex flex-col justify-center"><div class="w-8 border-b-2 border-slate-600"></div></div>`;

                poolHTML += colHTML;
            });
            poolHTML += `</div></div>`; // Tutup bungkus per-pool
        });

        poolHTML += '</div>'; // Tutup bungkus besar flex-row
        container.innerHTML = poolHTML;

    } catch (err) { console.error(err); }
}

// ==========================================
// FUNGSI GENERATOR KARTU SLOT (PANEL KIRI)
// ==========================================
function generateSlotCard(slotNum, athleteId, mode, juara1Nama) {
    if (athleteId === -1) {
        // SLOT BYE (Redup)
        return `
        <div class="flex items-center gap-2 p-1.5 rounded-lg border border-slate-700 bg-slate-800/30 text-slate-500 text-xs shadow-sm">
            <div class="w-6 h-6 rounded flex items-center justify-center bg-slate-700/60 font-black flex-shrink-0 text-[10px] border border-slate-600">${slotNum}</div>
            <div class="font-bold tracking-widest uppercase opacity-50 text-[10px]">BYE (KOSONG)</div>
        </div>`;
    }

    let p = STATE.participants.find(x => x.id === athleteId);
    if (!p) {
        // MENUNGGU (Blank Slot dari babak lanjutan)
        return `
        <div class="flex items-center gap-2 p-1.5 rounded-lg border border-slate-700/50 bg-slate-800/20 text-slate-500 text-xs shadow-sm">
            <div class="w-6 h-6 rounded flex items-center justify-center bg-slate-700/30 font-bold flex-shrink-0 text-[10px] border border-slate-600/50">${slotNum}</div>
            <div class="font-bold tracking-widest italic opacity-50 text-[10px]">Menunggu...</div>
        </div>`;
    }

    // ATLET AKTIF
    let statusColor = "border-slate-700 bg-slate-800/90 text-slate-200"; // Netral
    let statusIcon = ""; // <--- HILANGKAN BULLET BIRU SECARA DEFAULT

    // Pindahkan Ikon (Mahkota/Tengkorak) agar menempel di sebelah NAMA ATLET, bukan di bawah angka
    if (p.nama === juara1Nama) {
        statusColor = "border-yellow-500 bg-yellow-900/20 text-yellow-400 shadow-[0_0_10px_rgba(234,179,8,0.15)]";
        statusIcon = "<i class='fas fa-crown text-yellow-500 text-[10px] ml-1.5 drop-shadow-md' title='Juara 1'></i>";
    } else if ((mode === 'double' && p.losses >= 2) || (mode === 'single' && p.losses >= 1)) {
        statusColor = "border-red-900/50 bg-red-950/20 text-slate-500 opacity-60";
        statusIcon = "<i class='fas fa-skull-crossbones text-red-500/70 text-[10px] ml-1.5' title='Gugur'></i>";
    } else if (mode === 'double' && p.losses === 1) {
        statusColor = "border-orange-700 bg-orange-900/20 text-orange-400";
        statusIcon = "<i class='fas fa-exclamation-triangle text-orange-500 text-[10px] ml-1.5 drop-shadow-sm' title='Loser Bracket'></i>";
    }

    // 🎯 SENSOR HOVER ON/OFF (Dan perbaikan struktur Flex)
    return `
    <div onmouseenter="highlightAthlete(${p.id})" onmouseleave="removeHighlightAthlete(${p.id})" class="flex items-center gap-2.5 p-1.5 rounded-lg border ${statusColor} text-xs transition-all cursor-pointer hover:bg-slate-700 hover:border-slate-400 shadow-sm group">
        <div class="w-6 flex items-center justify-center flex-shrink-0">
            <div class="w-6 h-6 rounded flex items-center justify-center bg-slate-700/80 font-black border border-slate-600 text-[10px] text-white shadow-inner">${slotNum}</div>
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center">
            <div class="font-bold truncate leading-tight group-hover:text-yellow-400 transition-colors text-[11px] flex items-center">
                ${p.nama} ${statusIcon}
            </div>
            <div class="text-[9px] font-bold opacity-70 mt-0.5 uppercase tracking-wider flex items-center"><i class="fas fa-shield-alt mr-1 text-slate-500"></i><span class="truncate">${p.kontingen}</span></div>
        </div>
    </div>`;
}

function renderEmbuLayout(catName, container, poolsConfig) {
    let gridCols = poolsConfig.length > 1 ? 'md:grid-cols-2' : 'grid-cols-1';
    let html = `
    <div class="col-span-full w-full shadow-lg rounded-xl overflow-hidden border border-slate-700">
        <div class="flex justify-between items-center bg-slate-800 p-4 border-b border-slate-700">
            <div class="flex items-center gap-3">
                <span class="bg-blue-600 text-white text-[10px] px-2 py-1 rounded font-black tracking-wider">DRAWING EMBU</span>
                <span class="text-sm font-bold text-yellow-400 truncate">${catName}</span>
            </div>
            <span class="text-[10px] text-slate-400 font-mono hidden md:block">Swap: Klik Nama ke Nama Lain</span>
            <button onclick="resetNilaiKategoriLokal()" class="bg-red-900/50 border border-red-700 text-red-400 hover:bg-red-500 hover:text-white w-8 h-8 rounded flex items-center justify-center transition-colors shadow-sm" title="Kosongkan Nilai (Urutan Tetap)"><i class="fas fa-eraser text-sm"></i></button>
        </div>
        <div class="grid grid-cols-1 ${gridCols} gap-6 bg-slate-900 p-5">`;

    poolsConfig.forEach(pool => {
        let borderColor = pool.isFinal || pool.isB2 ? 'border-yellow-600' : 'border-slate-600';
        let titleColor = pool.isFinal || pool.isB2 ? 'text-yellow-500' : 'text-purple-400';

        let poolType = pool.isFinal ? 'final' : (pool.isB2 ? 'b2' : 'b1');

        html += `<div class="bg-slate-800 p-4 md:p-5 rounded-xl border ${borderColor} shadow-sm w-full h-full flex flex-col">
            <h3 class="font-black text-center ${titleColor} mb-4 border-b border-slate-700 pb-3">${pool.title}</h3>
            <div class="space-y-3 flex-1">`;

        // FIX: Tambahkan parameter 'index' di sini untuk menghitung baris
        pool.data.forEach((p, index) => {
            let noUrut = pool.isFinal ? p.urutFinal : (pool.isB2 ? p.urutB2 : p.urut);

            // FIX "UNDEFINED": Jika noUrut kosong/undefined, gunakan nomor baris (index + 1)
            if (!noUrut) noUrut = index + 1;

            let isSelected = (EMBU_SWAP_SELECTION && EMBU_SWAP_SELECTION.id === p.id && EMBU_SWAP_SELECTION.type === poolType);
            let activeClass = isSelected
                ? 'bg-yellow-600/40 border-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.3)]'
                : 'bg-slate-900/50 border-slate-700/50 hover:bg-slate-700/40';

            // --- FIX TATA LETAK: 1 Baris, Kontingen di Kanan, Nama Truncate (...) ---
            html += `<div onclick="handleEmbuSwap(${p.id}, '${poolType}')" class="cursor-pointer flex flex-row items-center justify-between text-sm p-3 rounded-lg border gap-3 transition-all duration-200 ${activeClass}">
                
                <div class="flex gap-2 items-center w-full min-w-0">
                    <span class="font-mono ${isSelected ? 'text-yellow-400' : 'text-slate-500'} w-5 text-right flex-shrink-0">${noUrut}.</span>
                    <span class="font-bold ${isSelected ? 'text-yellow-400' : 'text-white'} truncate block w-full">${p.nama}</span>
                </div>
                
                <div class="flex-shrink-0">
                    <span class="text-[10px] ${isSelected ? 'text-yellow-200 bg-yellow-900/50 border-yellow-600' : 'text-slate-400 bg-slate-800 border-slate-700'} px-2 py-1 rounded border whitespace-nowrap shadow-sm">${p.kontingen}</span>
                </div>
                
            </div>`;
        });
        html += `</div></div>`;
    });
    html += `</div></div>`;
    container.innerHTML = html;
}

// INJEKSI DOM UNTUK TOMBOL UNDUH JADWAL (MIKRO)
function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    const panelEmbu = document.getElementById('draw-panel-embu');
    const panelRandori = document.getElementById('draw-panel-randori');
    const panelEmpty = document.getElementById('draw-panel-empty');
    const resultDiv = document.getElementById('drawing-result');

    panelEmbu.classList.add('hidden');
    panelRandori.classList.add('hidden');
    panelEmpty.classList.add('hidden');
    resultDiv.innerHTML = '';

    // 👇 GANTI BAGIAN PENUTUP WADAH LAMA MENJADI INI 👇
    let wrapper = document.getElementById('randori-layout-wrapper');
    if (wrapper) wrapper.classList.add('hidden');
    document.getElementById('randori-bracket-container').classList.add('hidden');

    let drawHeader = document.querySelector('#section-drawing > div:first-child');
    let microDrawBtn = document.getElementById('btn-micro-draw-export');
    if (!microDrawBtn && drawHeader) {
        microDrawBtn = document.createElement('button');
        microDrawBtn.id = 'btn-micro-draw-export';
        microDrawBtn.className = 'w-full md:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm flex items-center justify-center gap-2 mt-4 md:mt-0';
        // --- DIUBAH MENJADI ICON EXCEL DAN TEKS BARU ---
        microDrawBtn.innerHTML = '<i class="fas fa-file-excel"></i> UNDUH HASIL DRAWING';
        microDrawBtn.onclick = () => exportDrawingExcel(document.getElementById('draw-select-kategori').value);
        drawHeader.appendChild(microDrawBtn);
    }

    if (!catName) {
        panelEmpty.classList.remove('hidden');
        if (microDrawBtn) microDrawBtn.classList.add('hidden');
        return;
    }
    if (microDrawBtn) microDrawBtn.classList.remove('hidden');

    const categoryObj = STATE.categories.find(c => c.name === catName);
    let list = STATE.participants.filter(p => p.kategori === catName);

    if (categoryObj && categoryObj.discipline === 'randori') {
        panelRandori.classList.remove('hidden');
        renderVisualBracket(catName);
    } else if (categoryObj && categoryObj.discipline === 'festival') {
        // --- RENDER DRAWING FESTIVAL ---
        panelEmbu.classList.remove('hidden');
        if (list.some(p => p.urut > 0)) {
            let uniquePools = [...new Set(list.map(p => p.pool))].sort();
            let poolsData = uniquePools.map(poolName => {
                let poolList = list.filter(p => p.pool === poolName).sort((a, b) => a.urut - b.urut);
                return { data: poolList, title: "KELOMPOK " + poolName, isFinal: false, isB2: false };
            });
            renderEmbuLayout(catName, resultDiv, poolsData);
        } else {
            resultDiv.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Belum diundi.</div>`;
        }
    } else {
        // --- RENDER DRAWING EMBU (ASLI) ---
        panelEmbu.classList.remove('hidden');
        const isFinalMode = list.some(p => p.isFinalist);

        if (isFinalMode) {
            let finalL = list.filter(p => p.isFinalist);
            if (finalL.some(p => p.urutFinal > 0)) {
                finalL.sort((a, b) => a.urutFinal - b.urutFinal);
                renderEmbuLayout(catName, resultDiv, [{ data: finalL, title: "POOL FINAL", isFinal: true }]);
            } else {
                resultDiv.innerHTML = `<div class="col-span-full text-center text-yellow-500 py-10 border-2 border-dashed border-yellow-600 rounded-xl">Peserta Final dipilih. Klik Acak Urutan.</div>`;
            }
        } else if (list.some(p => p.urut > 0)) {
            // SUDAH DIUNDI BABAK 1
            // SUDAH DIUNDI BABAK 1 DINAMIS
            if (list.some(p => p.pool !== 'SINGLE' && p.pool !== '-')) {
                list.sort((a, b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
                let uniquePools = [...new Set(list.map(p => p.pool))].sort();
                let poolsData = uniquePools.map(poolName => {
                    return {
                        data: list.filter(p => p.pool === poolName),
                        title: "POOL " + poolName,
                        isFinal: false
                    };
                });
                renderEmbuLayout(catName, resultDiv, poolsData);
            } else {
                // JALUR SINGLE POOL - Cek setting Admin (Dibalik, Diacak Ulang, atau Peringkat)
                let modeB2 = (STATE.settings && STATE.settings.embuB2Mode) ? STATE.settings.embuB2Mode : 'reverse';

                // --- CEK SYARAT EKSIBISI 1 BABAK ---
                let minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;
                let isEksibisi = (list.length < minPeserta && STATE.settings && STATE.settings.eksibisiLangsungFinal === true);

                // --- PENYIMPANAN OTOMATIS URUTAN B2 UNTUK PRINT CENTER ---
                let needsFirebaseSync = false;
                let syncUpdates = {};
                // -----------------------------------------------------------

                // BYPASS DRAWING: Jika masuk mode eksibisi, JANGAN BIKIN KOTAK BABAK 2!
                if (isEksibisi) {
                    let listB1 = [...list].sort((a, b) => a.urut - b.urut);
                    renderEmbuLayout(catName, resultDiv, [
                        { data: listB1, title: "BABAK 1 (LANGSUNG FINAL / EKSIBISI)", isFinal: false, isB2: false }
                    ]);
                }
                else if (modeB2 === 'redraw') {
                    let listB1 = [...list].sort((a, b) => a.urut - b.urut);
                    let listB2 = [...list].filter(p => p.urutB2 > 0).sort((a, b) => a.urutB2 - b.urutB2);
                    let poolsData = [{ data: listB1, title: "BABAK 1", isFinal: false, isB2: false }];

                    if (listB2.length > 0) poolsData.push({ data: listB2, title: "BABAK 2", isFinal: false, isB2: true });
                    renderEmbuLayout(catName, resultDiv, poolsData);

                    resultDiv.innerHTML += `<div class="col-span-full mt-6 text-center"><button onclick="startDrawingB2()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg border border-purple-400 transition-transform hover:scale-105"><i class="fas fa-random mr-2"></i>ACAK URUTAN BABAK 2 SEKARANG</button></div>`;

                } else if (modeB2 === 'highscore') {
                    let listB1 = [...list].sort((a, b) => a.urut - b.urut);
                    // Filter yang sudah main B1, urutkan dari nilai TERENDAH ke TERTINGGI (Ascending)
                    let listB2 = [...list].filter(p => p.scores.b1.final > 0).sort((a, b) => a.scores.b1.final - b.scores.b1.final || a.scores.b1.tech - b.scores.b1.tech);

                    // --- SAVE KE FIREBASE (HIGHSCORE) ---
                    listB2.forEach((p, index) => {
                        let newUrut = index + 1;
                        if (p.urutB2 !== newUrut) {
                            p.urutB2 = newUrut; // Update UI Lokal
                            let pIndex = STATE.participants.findIndex(x => x.id === p.id);
                            syncUpdates[`turnamen_data/participants/${pIndex}/urutB2`] = newUrut; // Siapkan paket Firebase
                            needsFirebaseSync = true;
                        }
                    });

                    let poolsData = [{ data: listB1, title: "BABAK 1", isFinal: false, isB2: false }];

                    if (listB2.length > 0) poolsData.push({ data: listB2, title: "BABAK 2 (BERDASARKAN PERINGKAT)", isFinal: false, isB2: true });
                    renderEmbuLayout(catName, resultDiv, poolsData);

                    if (listB2.length < list.length) {
                        resultDiv.innerHTML += `<div class="col-span-full mt-4 text-center text-slate-500 italic text-sm">Selesaikan penilaian Babak 1 untuk melihat susunan penuh Babak 2.</div>`;
                    }
                } else {
                    // MODE DIBALIK (REVERSE)
                    let listB1 = [...list].sort((a, b) => a.urut - b.urut);
                    let listB2 = [...list].sort((a, b) => b.urut - a.urut);

                    // --- SAVE KE FIREBASE (REVERSE) ---
                    listB2.forEach((p, index) => {
                        let newUrut = index + 1;
                        if (p.urutB2 !== newUrut) {
                            p.urutB2 = newUrut; // Update UI Lokal
                            let pIndex = STATE.participants.findIndex(x => x.id === p.id);
                            syncUpdates[`turnamen_data/participants/${pIndex}/urutB2`] = newUrut; // Siapkan paket Firebase
                            needsFirebaseSync = true;
                        }
                    });

                    renderEmbuLayout(catName, resultDiv, [
                        { data: listB1, title: "BABAK 1", isFinal: false, isB2: false },
                        { data: listB2, title: "BABAK 2 (URUTAN DIBALIK)", isFinal: false, isB2: true }
                    ]);
                }

                // --- EKSEKUSI FIREBASE BATCH UPDATE ---
                if (needsFirebaseSync && Object.keys(syncUpdates).length > 0) {
                    database.ref().update(syncUpdates).catch(err => console.error("Gagal sync urutB2:", err));
                }
            }
        } else {
            resultDiv.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Belum diundi.</div>`;
        }
    }
    // --- SINKRONISASI KE PROYEKTOR TM ---
    database.ref('turnamen_data/settings/projectorCategory').set(catName);

    // Tampilkan dropdown fase hanya jika Embu/Festival
    const projControls = document.getElementById('projector-controls');
    if (projControls) {
        if (categoryObj && categoryObj.discipline !== 'randori') {
            projControls.classList.remove('hidden');
        } else {
            projControls.classList.add('hidden');
        }
    }
}

// MESIN PENGACAK KHUSUS BABAK 2
function startDrawingB2() {
    const catName = document.getElementById('draw-select-kategori').value;
    if (!catName) return alert("Pilih kategori!");
    let list = STATE.participants.filter(p => p.kategori === catName && p.urut > 0);
    if (list.length === 0) return alert("Undi Babak 1 terlebih dahulu!");

    if (list.some(p => p.urutB2 > 0)) { if (!confirm("⚠️ Babak 2 SUDAH DIUNDI.\nYakin ingin mengacak ulang Babak 2?")) return; }

    let ids = list.map(p => p.id);
    shuffleArray(ids); // Gunakan mesin kocok yang sudah ada

    ids.forEach((id, index) => {
        const found = STATE.participants.find(item => item.id === id);
        if (found) found.urutB2 = index + 1;
    });

    saveToLocalStorage(); checkExistingDrawing(); filterPesertaScoring();
}

function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    if (!catName) return alert("Pilih kategori!");
    let list = STATE.participants.filter(p => p.kategori === catName);
    if (list.length === 0) return alert("Belum ada peserta!");
    const catObj = STATE.categories.find(c => c.name === catName);

    // --- ALGORITMA KHUSUS FESTIVAL (PEMBAGI KELOMPOK CERDAS) ---
    if (catObj && catObj.discipline === 'festival') {
        if (list.some(p => p.urut > 0)) {
            if (!confirm("⚠️ Kategori FESTIVAL ini SUDAH DIUNDI.\nYakin ingin mengacak ulang dan mereset nilai?")) return;
            list.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }; p.finalScore = 0; p.techScore = 0; });
        }

        // 1. KAMUS BOBOT SABUK (Huruf kecil semua untuk pencocokan)
        const kyuMap = { "minarai": 0, "kyu 8": 1, "kyu 7": 2, "kyu 6": 3, "kyu 5": 4, "kyu 4": 5, "kyu 3": 6, "kyu 2": 7, "kyu 1": 8, "dan 1": 9, "dan 2": 10, "dan 3": 11 };

        // 2. MULTI-LEVEL SORTING (Sabuk dulu, kalau sama, baru Umur)
        list.sort((a, b) => {
            let kyuA = String(a.kyu || "").toLowerCase().trim();
            let kyuB = String(b.kyu || "").toLowerCase().trim();

            // Jika sabuk aneh/kosong, lempar ke kelompok paling akhir (Bobot 999)
            let weightA = kyuMap[kyuA] !== undefined ? kyuMap[kyuA] : 999;
            let weightB = kyuMap[kyuB] !== undefined ? kyuMap[kyuB] : 999;

            if (weightA !== weightB) {
                return weightA - weightB; // Sort Sabuk Terendah ke Tertinggi
            }

            // Tie-Breaker: Sort Umur Termuda ke Tertua
            let umurA = parseInt(a.umur) || 0;
            let umurB = parseInt(b.umur) || 0;
            return umurA - umurB;
        });

        // 3. CHUNKING PEMBAGI KELOMPOK (Logic asli yang dipertahankan)
        let total = list.length;
        let numGroups = Math.ceil(total / 4);
        if (numGroups === 0) return;

        let baseSize = Math.floor(total / numGroups);
        let remainder = total % numGroups;
        let currentIndex = 0;
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        for (let i = 0; i < numGroups; i++) {
            let groupSize = baseSize + (i < remainder ? 1 : 0);
            let poolName = alphabet[i] || `G${i + 1}`;
            for (let j = 0; j < groupSize; j++) {
                if (currentIndex < total) {
                    let p = STATE.participants.find(item => item.id === list[currentIndex].id);
                    if (p) {
                        p.pool = poolName;
                        p.urut = j + 1;
                    }
                    currentIndex++;
                }
            }
        }
        saveToLocalStorage(); checkExistingDrawing(); renderParticipantTable();
        return;
    }
    // -------------------------------------------------------------
    const isFinalMode = list.some(p => p.isFinalist);
    if (isFinalMode) {
        let finalL = list.filter(p => p.isFinalist);
        if (finalL.some(p => p.urutFinal > 0)) if (!confirm("⚠️ Finalis SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return;
        shuffleArray(finalL);
        finalL.forEach((p, index) => { const idx = STATE.participants.findIndex(x => x.id === p.id); STATE.participants[idx].urutFinal = index + 1; });
    } else {
        if (list.some(p => p.urut > 0)) {
            if (!confirm("⚠️ Kategori ini SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return;
            list.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }; p.finalScore = 0; p.techScore = 0; });
        }
        shuffleArray(list);

        // --- LOGIKA PEMOTONG POOL DINAMIS (EMBU) ---
        let maxPerPool = (STATE.settings && STATE.settings.maxPesertaPoolEmbu) ? parseInt(STATE.settings.maxPesertaPoolEmbu) : 12;

        if (list.length > maxPerPool) {
            let numGroups = Math.ceil(list.length / maxPerPool);
            let baseSize = Math.floor(list.length / numGroups);
            let remainder = list.length % numGroups;
            let currentIndex = 0;
            const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

            for (let i = 0; i < numGroups; i++) {
                let groupSize = baseSize + (i < remainder ? 1 : 0);
                let poolName = alphabet[i] || `P${i + 1}`; // Anti-Bug: Jika alfabet habis
                let currentPool = list.slice(currentIndex, currentIndex + groupSize);
                applyDrawingData(currentPool, poolName);
                currentIndex += groupSize;
            }
        } else {
            applyDrawingData(list, 'SINGLE');
        }
    }
    saveToLocalStorage(); checkExistingDrawing(); renderParticipantTable();
}

function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[arr[i], arr[j]] = [arr[j], arr[i]]; } }
function applyDrawingData(arr, poolName) { arr.forEach((p, index) => { const found = STATE.participants.find(item => item.id === p.id); if (found) { found.urut = index + 1; found.pool = poolName; } }); }

function filterPesertaScoring() {
    const catName = document.getElementById('select-kategori').value;
    const categoryObj = STATE.categories.find(c => c.name === catName);
    const panelEmbu = document.getElementById('panel-embu');
    const panelRandori = document.getElementById('panel-randori');
    const badgeEmbu = document.getElementById('scoring-badge-embu');
    const badgeRandori = document.getElementById('scoring-badge-randori');
    const panelWaktu = document.getElementById('panel-waktu-embu');
    const panelJuri = document.getElementById('panel-juri-embu');
    const selectEl = document.getElementById('select-peserta');

    // NEW: Deklarasi Tombol Simpan Randori di Header
    const topActionRandori = document.getElementById('top-action-randori');

    // =========================================================================
    // SUNTIKKAN KODE RESET UI DI SINI (BERLAKU UNTUK SELURUH WASIT 1 HINGGA 5)
    // =========================================================================
    for (let i = 1; i <= 5; i++) {
        let stempel = document.getElementById(`stempelJuri${i}`);
        let btnReset = document.getElementById(`btnReset${i}`);
        if (stempel) stempel.classList.add('hidden');
        if (btnReset) btnReset.classList.add('hidden');

        let scoreInput = document.getElementById(`score-${i}`);
        let techInput = document.getElementById(`tech-${i}`);
        if (scoreInput) scoreInput.removeAttribute('readonly');
        if (techInput) techInput.removeAttribute('readonly');
    }

    if (!categoryObj) return;

    const currentSelectedMatchOrAthlete = selectEl.value;

    if (categoryObj.discipline === 'randori') {
        panelEmbu.classList.add('hidden'); panelRandori.classList.remove('hidden');
        badgeEmbu.classList.add('hidden'); badgeRandori.classList.remove('hidden');
        if (panelWaktu) panelWaktu.classList.add('hidden');
        if (panelJuri) panelJuri.classList.add('hidden');
        // NEW: Tampilkan tombol Simpan Randori
        if (topActionRandori) topActionRandori.classList.remove('hidden');

        let gridEl = document.getElementById('scoring-athlete-grid');
        if (gridEl) gridEl.className = 'hidden';
        // ------------------------------------------------------------
        let catMatches = STATE.matches.filter(m =>
            m.kategori === catName &&
            m.status === 'pending' &&
            m.merahId != null && m.putihId != null &&
            m.merahId !== -1 && m.putihId !== -1
        );

        if (catMatches.length === 0) {
            selectEl.innerHTML = `<option value="">-- Tidak ada Partai Aktif --</option>`;
            document.getElementById('scoring-athlete-name').innerText = "-";
            document.getElementById('randori-nama-merah').innerText = "-";
            document.getElementById('randori-kont-merah').innerText = "-";
            document.getElementById('randori-nama-putih').innerText = "-";
            document.getElementById('randori-kont-putih').innerText = "-";
            currentRandoriMatchId = null;
            resetRandoriBoard();
            return;
        }

        selectEl.innerHTML = catMatches.sort((a, b) => a.matchNum - b.matchNum).map((m) => {
            const mrh = STATE.participants.find(p => p.id === m.merahId) || { nama: "Menunggu..." };
            const pth = STATE.participants.find(p => p.id === m.putihId) || { nama: "Menunggu..." };
            let displayNum = m.matchNum % 50 === 0 ? 50 : m.matchNum % 50;
            let pLabel = m.pool !== '-' ? `Pool ${m.pool}` : 'Utama';
            return `<option value="match-${m.id}">G-${displayNum} [${pLabel}] [${m.babak}] ${mrh.nama} vs ${pth.nama}</option>`;
        }).join('');

        let stillExists = Array.from(selectEl.options).some(opt => opt.value === currentSelectedMatchOrAthlete);

        if (stillExists) {
            selectEl.value = currentSelectedMatchOrAthlete;
        } else {
            if (selectEl.options.length > 0) {
                selectEl.value = selectEl.options[0].value;
                document.getElementById('scoring-athlete-name').innerText = selectEl.options[0].text;
                loadRandoriMatch();
            }
        }

    } else if (categoryObj.discipline === 'festival') {
        // --- BAGIAN FESTIVAL (SCORING) ---
        panelEmbu.classList.remove('hidden'); panelRandori.classList.add('hidden');
        badgeEmbu.classList.remove('hidden'); badgeRandori.classList.add('hidden');
        badgeEmbu.innerText = "FESTIVAL"; badgeEmbu.className = "bg-green-600 text-white text-[10px] px-2 py-0.5 rounded font-bold tracking-widest";
        if (panelWaktu) panelWaktu.classList.remove('hidden');
        if (panelJuri) panelJuri.classList.remove('hidden');
        if (topActionRandori) topActionRandori.classList.add('hidden');

        let listCat = STATE.participants.filter(p => p.kategori === catName && p.urut > 0);
        if (listCat.length === 0) {
            selectEl.innerHTML = `<option value="">-- Kosong / Belum Undian --</option>`;
            document.getElementById('scoring-athlete-name').innerText = "-";
            updateScoringButtonsUI(); return;
        }

        let optionsHTML = '';
        let unikPools = [...new Set(listCat.map(p => p.pool))].sort();

        unikPools.forEach(pKey => {
            let anggotaKelompok = listCat.filter(p => p.pool === pKey).sort((a, b) => a.urut - b.urut);
            if (anggotaKelompok.length > 0) {
                optionsHTML += `<optgroup label="--- KELOMPOK ${pKey} ---">`;
                optionsHTML += anggotaKelompok.map(p => `<option value="${p.id}|b1">[Kelompok ${pKey}] No.${p.urut} - ${p.nama} (${p.kontingen})</option>`).join('');
                optionsHTML += `</optgroup>`;
            }
        });
        selectEl.innerHTML = optionsHTML;

        let stillExists = Array.from(selectEl.options).some(opt => opt.value === currentSelectedMatchOrAthlete);
        if (stillExists) selectEl.value = currentSelectedMatchOrAthlete;
        else { if (selectEl.options.length > 0) { selectEl.value = selectEl.options[0].value; document.getElementById('scoring-athlete-name').innerText = selectEl.options[selectEl.selectedIndex].text; updateScoringButtonsUI(); } }

    } else {
        // --- BAGIAN EMBU (SCORING) ---
        panelEmbu.classList.remove('hidden'); panelRandori.classList.add('hidden');
        badgeEmbu.classList.remove('hidden'); badgeRandori.classList.add('hidden');
        badgeEmbu.innerText = "EMBU"; badgeEmbu.className = "bg-blue-600 text-white text-[10px] px-2 py-0.5 rounded font-bold tracking-widest";
        if (panelWaktu) panelWaktu.classList.remove('hidden');
        if (panelJuri) panelJuri.classList.remove('hidden');
        if (topActionRandori) topActionRandori.classList.add('hidden');
        // ... (Biarkan listCat dan hasFinal Embu tetap utuh di bawahnya) ...

        let listCat = STATE.participants.filter(p => p.kategori === catName && p.urut > 0);

        if (listCat.length === 0) {
            selectEl.innerHTML = `<option value="">-- Kosong / Belum Undian --</option>`;
            document.getElementById('scoring-athlete-name').innerText = "-";
            updateScoringButtonsUI();
            return;
        }

        const hasFinal = listCat.some(p => p.isFinalist);
        let optionsHTML = '';

        if (hasFinal) {
            let finalL = listCat.filter(p => p.isFinalist).sort((a, b) => a.urutFinal - b.urutFinal);
            optionsHTML = finalL.map(p => `<option value="${p.id}|b2">[FINAL] No.${p.urutFinal} - ${p.nama} (${p.kontingen})</option>`).join('');
        } else if (listCat.some(p => p.pool !== 'SINGLE' && p.pool !== '-')) {
            let sorted = listCat.sort((a, b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
            optionsHTML = sorted.map(p => `<option value="${p.id}|b1">[Pool ${p.pool}] No.${p.urut} - ${p.nama} (${p.kontingen})</option>`).join('');
        } else {
            let minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;
            let isEksibisi = (listCat.length > 0 && listCat.length < minPeserta && STATE.settings && STATE.settings.eksibisiLangsungFinal === true);

            let sortedB1 = [...listCat].sort((a, b) => a.urut - b.urut);

            optionsHTML += `<optgroup label="--- TAMPIL PERTAMA (BABAK 1) ---">`;
            optionsHTML += sortedB1.map(p => `<option value="${p.id}|b1">[Babak 1] No.${p.urut} - ${p.nama} (${p.kontingen})</option>`).join('');
            optionsHTML += `</optgroup>`;

            if (isEksibisi) {
                // BYPASS: Cegah Babak 2 muncul jika masuk mode Eksibisi 1 Babak
                optionsHTML += `<optgroup label="--- TAMPIL KEDUA (BYPASS EKSIBISI 1 BABAK) ---">`;
                optionsHTML += `<option disabled value="">Peserta < Min. Juara. Langsung Final dari B1.</option>`;
                optionsHTML += `</optgroup>`;
            } else {
                let modeB2 = (STATE.settings && STATE.settings.embuB2Mode) ? STATE.settings.embuB2Mode : 'reverse';
                if (modeB2 === 'redraw') {
                    let sortedB2 = [...listCat].filter(p => p.urutB2 > 0).sort((a, b) => a.urutB2 - b.urutB2);
                    if (sortedB2.length > 0) {
                        optionsHTML += `<optgroup label="--- TAMPIL KEDUA (BABAK 2 : DIACAK ULANG) ---">`;
                        optionsHTML += sortedB2.map(p => `<option value="${p.id}|b2">[Babak 2] No.${p.urutB2} - ${p.nama} (${p.kontingen})</option>`).join('');
                        optionsHTML += `</optgroup>`;
                    } else {
                        optionsHTML += `<optgroup label="--- TAMPIL KEDUA (BABAK 2 : BELUM DIACAK) ---"></optgroup>`;
                    }
                } else if (modeB2 === 'highscore') {
                    let sortedB2 = [...listCat].filter(p => p.scores.b1.final > 0).sort((a, b) => a.scores.b1.final - b.scores.b1.final || a.scores.b1.tech - b.scores.b1.tech);
                    if (sortedB2.length > 0) {
                        optionsHTML += `<optgroup label="--- TAMPIL KEDUA (BABAK 2 : NILAI B1 TERTINGGI TAMPIL TERAKHIR) ---">`;
                        optionsHTML += sortedB2.map((p, i) => `<option value="${p.id}|b2">[Babak 2] No.${i + 1} - ${p.nama} (B1: ${p.scores.b1.final})</option>`).join('');
                        optionsHTML += `</optgroup>`;
                    } else {
                        optionsHTML += `<optgroup label="--- TAMPIL KEDUA (BABAK 2 : SELESAIKAN BABAK 1 DULU) ---"></optgroup>`;
                    }
                } else {
                    let sortedB2 = [...listCat].sort((a, b) => b.urut - a.urut);
                    optionsHTML += `<optgroup label="--- TAMPIL KEDUA (BABAK 2 : URUTAN DIBALIK) ---">`;
                    optionsHTML += sortedB2.map((p, i) => `<option value="${p.id}|b2">[Babak 2] No.${i + 1} - ${p.nama} (${p.kontingen})</option>`).join('');
                    optionsHTML += `</optgroup>`;
                }
            }
        }

        selectEl.innerHTML = optionsHTML;

        let stillExists = Array.from(selectEl.options).some(opt => opt.value === currentSelectedMatchOrAthlete);
        if (stillExists) {
            selectEl.value = currentSelectedMatchOrAthlete;
        } else {
            if (selectEl.options.length > 0) {
                selectEl.value = selectEl.options[0].value;
                document.getElementById('scoring-athlete-name').innerText = selectEl.options[selectEl.selectedIndex].text;
                updateScoringButtonsUI();
            }
        }
    }
}
let currentRandoriMatchId = null;
function loadRandoriMatch() {
    const val = document.getElementById('select-peserta').value;
    if (!val || !val.startsWith('match-')) return;

    // --- FIX BUG HANTU BEREGU (LAPIS KEDUA): Sapu bersih saat muat partai ---
    let gridEl = document.getElementById('scoring-athlete-grid');
    if (gridEl) gridEl.className = 'hidden';
    // -----------------------------------------------------------------------

    const newMatchId = parseInt(val.replace('match-', ''));

    if (currentRandoriMatchId === newMatchId) return;

    currentRandoriMatchId = newMatchId;
    const match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if (!match) return;

    const merah = STATE.participants.find(p => p.id === match.merahId);
    const putih = STATE.participants.find(p => p.id === match.putihId);
    document.getElementById('randori-nama-merah').innerText = merah ? merah.nama : "-";
    document.getElementById('randori-kont-merah').innerText = merah ? merah.kontingen : "-";
    document.getElementById('randori-nama-putih').innerText = putih ? putih.nama : "-";
    document.getElementById('randori-kont-putih').innerText = putih ? putih.kontingen : "-";

    resetRandoriBoard();
}

function resetRandoriBoard() {
    RANDORI_STATE = { merah: { score: 0 }, putih: { score: 0 } };
    RANDORI_HISTORY = []; // Bersihkan riwayat saat ganti partai
    updateRandoriUI();
}

function addRandoriScore(corner, points, label = "POIN") {
    // 1. Simpan aksi ini ke dalam buku riwayat (Log)
    RANDORI_HISTORY.push({ corner: corner, points: points, label: label });

    // 2. Tambahkan nilainya
    RANDORI_STATE[corner].score += points;
    if (RANDORI_STATE[corner].score < 0) RANDORI_STATE[corner].score = 0;

    updateRandoriUI();
}

function undoLastRandoriScore() {
    if (RANDORI_HISTORY.length === 0) return alert("Belum ada aksi poin yang bisa dibatalkan.");

    // 1. Ambil (Pop) aksi paling terakhir dari riwayat
    let lastAction = RANDORI_HISTORY.pop();

    // 2. Kurangi skor sesuai poin yang dicatat di riwayat tersebut
    RANDORI_STATE[lastAction.corner].score -= lastAction.points;
    if (RANDORI_STATE[lastAction.corner].score < 0) RANDORI_STATE[lastAction.corner].score = 0;

    updateRandoriUI();
}

function updateRandoriUI() {
    document.getElementById('score-merah').innerText = RANDORI_STATE.merah.score;
    document.getElementById('score-putih').innerText = RANDORI_STATE.putih.score;

    // Update Tampilan Teks Log di Layar
    let logTextEl = document.getElementById('randori-log-text');
    if (logTextEl) {
        if (RANDORI_HISTORY.length === 0) {
            logTextEl.innerHTML = "Belum ada poin tercatat...";
            logTextEl.className = "text-sm font-medium text-slate-500 italic tracking-wide";
        } else {
            let last = RANDORI_HISTORY[RANDORI_HISTORY.length - 1];
            let cornerName = last.corner === 'merah' ? '<span class="text-red-500 font-black tracking-widest bg-red-900/30 px-2 py-0.5 rounded">MERAH</span>' : '<span class="text-white font-black tracking-widest bg-slate-700 px-2 py-0.5 rounded border border-slate-500">PUTIH</span>';
            logTextEl.innerHTML = `Poin Terakhir: ${cornerName} mendapat <span class="font-black text-blue-400 ml-1 tracking-wider">${last.label} (+${last.points})</span>`;
            logTextEl.className = "text-sm font-medium text-slate-300 flex items-center";
        }
    }
    pushRandoriToTV();
}
function saveRandoriMatchResult() {
    if (!currentRandoriMatchId) return alert("Pilih partai!");
    const match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if (!match) return;

    let sMerah = RANDORI_STATE.merah.score; let sPutih = RANDORI_STATE.putih.score;
    if (sMerah === sPutih) return alert("Skor seri! Tambahkan poin kemenangan.");

    let winnerId = sMerah > sPutih ? match.merahId : match.putihId;
    let loserId = sMerah > sPutih ? match.putihId : match.merahId;
    let winnerName = sMerah > sPutih ? "PITA MERAH" : "PITA PUTIH";

    if (confirm(`Konfirmasi Pemenang: ${winnerName}\nSkor: ${sMerah} - ${sPutih}\n\nLanjutkan?`)) {
        match.skorMerah = sMerah; match.skorPutih = sPutih;
        match.winnerId = winnerId; match.loserId = loserId;
        match.status = 'done';

        recalculateAllLosses(match.kategori);
        let winnerP = STATE.participants.find(p => p.id === winnerId);
        let isGrandFinal = match.nextW === 'WINNER' && match.babak !== "SUDDEN DEATH";
        let isChallenger = winnerP && winnerP.losses > 0;

        let mode = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';
        if (mode === 'double' && isGrandFinal && isChallenger) {
            alert("TIE BREAKER GRAND FINAL!\nSistem membuka Partai Sudden Death!");
            STATE.matches = STATE.matches.filter(m => !(m.kategori === match.kategori && m.pool === match.pool && m.babak === "SUDDEN DEATH"));

            // --- POSISI DITUKAR DI SINI (merahId diisi putihId lama, putihId diisi merahId lama) ---
            STATE.matches.push({ id: Date.now(), kategori: match.kategori, pool: match.pool, matchNum: match.matchNum + 1, babak: "SUDDEN DEATH", col: match.col + 1, nextW: 'WINNER', nextL: 'SECOND', merahId: match.putihId, putihId: match.merahId, winnerId: null, status: 'pending', skorMerah: 0, skorPutih: 0 });

        } else {
            forwardParticipant(match.nextW, winnerId, match.kategori, match.pool, match.nextWSlot);
            if (match.nextL) forwardParticipant(match.nextL, loserId, match.kategori, match.pool, match.nextLSlot);
        }

        processAutoWins(match.kategori);

        // --- STRATEGI B: BRANCH UPDATE ---
        // Menembak spesifik ke cabang data, menghemat ukuran payload
        let updates = {};
        updates['turnamen_data/matches'] = STATE.matches;
        updates['turnamen_data/participants'] = STATE.participants;

        database.ref().update(updates).then(() => {
            alert("Partai Selesai! Pemenang dicatat.");
            filterPesertaScoring(); checkExistingDrawing(); closeVerificationModal();
        }).catch(err => alert("Gagal Simpan: " + err));
    }
}

document.getElementById('select-peserta').addEventListener('change', (e) => {
    if (e.target.selectedIndex >= 0) {
        if (e.target.value.startsWith('match-')) {
            document.getElementById('scoring-athlete-name').innerText = e.target.options[e.target.selectedIndex].text;
            let gridEl = document.getElementById('scoring-athlete-grid');
            if (gridEl) gridEl.className = 'hidden';
            loadRandoriMatch();
        } else {
            document.getElementById('randori-nama-merah').innerText = "-";
            document.getElementById('randori-kont-merah').innerText = "-";
            document.getElementById('randori-nama-putih').innerText = "-";
            document.getElementById('randori-kont-putih').innerText = "-";
            currentRandoriMatchId = null;
            resetRandoriBoard();

            updateScoringButtonsUI();
        }
    }
});
document.getElementById('select-kategori').addEventListener('change', filterPesertaScoring);

function updateScoringButtonsUI() {
    const val = document.getElementById('select-peserta').value;
    const btnB1 = document.getElementById('btn-save-b1');
    const btnB2 = document.getElementById('btn-save-b2');
    const btnPen = document.getElementById('btn-save-penyisihan');
    const btnFin = document.getElementById('btn-save-final');

    if (!val || !val.includes('|')) return;
    const [pIdStr, babak] = val.split('|');
    const pId = parseInt(pIdStr);

    const p = STATE.participants.find(x => x.id === pId);
    if (p) {
        let catObj = STATE.categories.find(c => c.name === p.kategori);

        let babakText = "";
        if (catObj && catObj.discipline === 'festival') {
            babakText = `Kelompok ${p.pool}`;
        } else {
            babakText = babak === 'b1' ? (p.pool !== '-' && p.pool !== 'SINGLE' ? `Pool ${p.pool}` : `Babak 1`) : (p.isFinalist ? 'FINAL' : 'Babak 2');
        }

        let noUrut = p.urut;
        if (babak === 'b1') {
            noUrut = p.urut;
        } else if (p.isFinalist) {
            noUrut = p.urutFinal;
        } else {
            // CUKUP BACA VARIABEL FIREBASE
            noUrut = p.urutB2 > 0 ? p.urutB2 : "?";
        }
        if (!noUrut) noUrut = "?";

        let names = p.nama.split(/[,+&]/).map(n => n.trim()).filter(n => n);
        let displayNama = names.length > 1 ? `${names[0]} dkk` : p.nama;

        let titleText = (p.kontingen && p.kontingen !== "-")
            ? `[${babakText}] No.${noUrut} - ${displayNama} (${p.kontingen})`
            : `[${babakText}] No.${noUrut} - ${displayNama}`;

        let titleEl = document.getElementById('scoring-athlete-name');
        titleEl.innerText = titleText;

        titleEl.classList.remove('truncate');
        titleEl.classList.add('whitespace-normal', 'break-words');

        let gridEl = document.getElementById('scoring-athlete-grid');
        if (!gridEl) {
            gridEl = document.createElement('div');
            gridEl.id = 'scoring-athlete-grid';
            titleEl.after(gridEl);
        }

        if (names.length > 1) {
            gridEl.className = "grid grid-cols-1 md:grid-cols-3 gap-2 bg-slate-800/60 p-3 rounded-xl border border-slate-700 shadow-inner mt-3 animate-fade-in";
            gridEl.innerHTML = names.map((n, i) => `
                <div class="flex items-center gap-2 bg-slate-900 p-2 rounded-md border border-slate-700/50 shadow-sm overflow-hidden">
                    <span class="w-5 h-5 rounded-full bg-blue-900/50 text-blue-400 border border-blue-700/50 text-[10px] flex items-center justify-center font-black shadow-sm flex-shrink-0">${i + 1}</span>
                    <span class="text-[11px] font-bold text-slate-200 leading-tight uppercase tracking-wider truncate" title="${n}">${n}</span>
                </div>
            `).join('');
        } else {
            gridEl.className = "hidden";
            gridEl.innerHTML = '';
        }
    }

    if (btnB1) btnB1.classList.add('hidden');
    if (btnB2) btnB2.classList.add('hidden');
    if (btnPen) btnPen.classList.add('hidden'); // Abaikan tombol lama ini
    if (btnFin) btnFin.classList.add('hidden'); // Abaikan tombol lama ini

    let catObj = STATE.categories.find(c => c.name === p.kategori);

    // LOGIKA CERDAS PENAMAAN TOMBOL (HANYA PAKAI B1 & B2)
    if (catObj && catObj.discipline === 'festival') {
        if (btnB1) {
            btnB1.classList.remove('hidden');
            btnB1.innerHTML = '<i class="fas fa-save mr-2"></i>SIMPAN NILAI';
            btnB1.className = "flex-1 md:flex-none bg-green-600 hover:bg-green-500 text-white font-bold py-3 px-6 rounded-xl transition-transform hover:scale-105 shadow-[0_4px_14px_0_rgba(34,197,94,0.39)]";
        }
    } else {
        if (babak === 'b1') {
            if (btnB1) {
                btnB1.classList.remove('hidden');
                if (val.includes('[Pool')) {
                    // Berubah wujud jadi PENYISIHAN
                    btnB1.innerHTML = '<i class="fas fa-save mr-2"></i>SIMPAN PENYISIHAN';
                    btnB1.className = "flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-transform hover:scale-105 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)]";
                } else {
                    btnB1.innerHTML = '<i class="fas fa-save mr-2"></i>SIMPAN BABAK 1';
                    btnB1.className = "flex-1 md:flex-none bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-6 rounded-xl transition-transform hover:scale-105 shadow-[0_4px_14px_0_rgba(37,99,235,0.39)]";
                }
            }
        } else {
            if (btnB2) {
                btnB2.classList.remove('hidden');
                if (val.includes('[FINAL]')) {
                    // Berubah wujud jadi FINAL (Warna Kuning Emas)
                    btnB2.innerHTML = '<i class="fas fa-save mr-2"></i>SIMPAN FINAL';
                    btnB2.className = "flex-1 md:flex-none bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-3 px-6 rounded-xl transition-transform hover:scale-105 shadow-[0_4px_14px_0_rgba(202,138,4,0.39)]";
                } else {
                    btnB2.innerHTML = '<i class="fas fa-save mr-2"></i>SIMPAN BABAK 2';
                    btnB2.className = "flex-1 md:flex-none bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 px-6 rounded-xl transition-transform hover:scale-105 shadow-[0_4px_14px_0_rgba(147,51,234,0.39)]";
                }
            }
        }
    }

    // --- UPDATE PANEL WAKTU EMBU UI ---
    let rule = getEmbuTimeRule(p.kategori);
    let timeLabelEl = document.getElementById('embu-time-label');
    let timeValueEl = document.getElementById('embu-time-value');
    if (timeLabelEl) timeLabelEl.innerText = `Mode: ${rule.type}`;
    if (timeValueEl) {
        let fmtMin = `${Math.floor(rule.min / 60).toString().padStart(2, '0')}:${(rule.min % 60).toString().padStart(2, '0')}`;
        let fmtMax = `${Math.floor(rule.max / 60).toString().padStart(2, '0')}:${(rule.max % 60).toString().padStart(2, '0')}`;
        timeValueEl.innerText = `${fmtMin} - ${fmtMax}`;
    }

    loadExistingScores();

    // ===========================================
    // SISTEM MARATON (ALWAYS LIVE TV)
    // ===========================================
    if (typeof updateBroadcastUI === "function") updateBroadcastUI();

    if (typeof IS_TV_LIVE !== 'undefined' && IS_TV_LIVE && DEVICE_ROLE !== 'admin') {
        let displayNama = p.nama.split(/[,+&]/).map(n => n.trim()).join(" & ");

        database.ref(`live_broadcast/${DEVICE_ROLE}`).update({
            type: 'embu', // <-- FIX: Tanamkan ini agar TV tahu ini masuk mode Embu
            preview_data: {
                kategori: p.kategori,
                nama: displayNama,
                kontingen: p.kontingen
            }
        });
    }

    // ===========================================
    // SUNTIKAN BARU: JEMBATAN RTDB UNTUK WASIT
    // ===========================================
    const currentRole = sessionStorage.getItem('role');

    // FIX JALUR NYASAR: Pakai safeCourtId
    const safeCourtId = DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';

    if (currentRole === 'panitera' && catObj && catObj.discipline !== 'randori') {

        // 1. Munculkan tombol saklar (Jangan diubah warnanya di sini, biarkan fungsi toggle yang mengatur)
        const btnTembak = document.getElementById('btnTembakWasit');
        if (btnTembak) btnTembak.classList.remove('hidden');

        // 2. Tembak otomatis (Fungsi ini sudah cerdas, dia HANYA akan menembak jika saklar sedang ON)
        tembakDataKeFirebase();

        // 3. Kunci tombol simpan panitera jika mode digital sedang ON (agar nunggu wasit selesai)
        if (isWasitDigitalMode) {
            if (btnB1) { btnB1.disabled = true; btnB1.classList.add('opacity-50', 'cursor-not-allowed'); }
            if (btnB2) { btnB2.disabled = true; btnB2.classList.add('opacity-50', 'cursor-not-allowed'); }
        } else {
            if (btnB1) { btnB1.disabled = false; btnB1.classList.remove('opacity-50', 'cursor-not-allowed'); }
            if (btnB2) { btnB2.disabled = false; btnB2.classList.remove('opacity-50', 'cursor-not-allowed'); }
        }

        // 4. Pasang telinga pendengar
        listenStatusJuri(safeCourtId);
    }
}

function setJudges(n) {
    localStorage.setItem('local_judges', n);

    let btnJ3 = document.getElementById('btn-j3');
    let btnJ5 = document.getElementById('btn-j5');
    if (btnJ3) btnJ3.className = n === 3 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    if (btnJ5) btnJ5.className = n === 5 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';

    const container = document.getElementById('judge-inputs');
    if (!container) return;

    // Simpan nilai sementara agar tidak hilang saat klik tombol 3 Wasit / 5 Wasit
    let tempScores = [];
    let tempTechs = [];
    for (let i = 1; i <= 5; i++) {
        let sEl = document.getElementById(`score-${i}`);
        let tEl = document.getElementById(`tech-${i}`);
        tempScores.push(sEl ? sEl.value : '');
        tempTechs.push(tEl ? tEl.value : '');
    }

    container.innerHTML = '';

    // --- TAMPILAN HYBRID UNTUK SEMUA ROLE (Bisa Manual & Bisa Terima Data Digital) ---
    for (let i = 1; i <= n; i++) {
        container.innerHTML += `
        <div class="bg-slate-900 p-3 rounded-lg border border-slate-600 focus-within:border-blue-500 transition-colors relative overflow-hidden group">
            <div class="text-center mb-2 pb-2 border-b border-slate-700">
                <label class="block text-[10px] text-slate-400 uppercase font-bold">Wasit ${i}</label>
            </div>
            
            <div class="space-y-2 relative z-10">
                <div>
                    <label class="block text-[9px] text-slate-500 mb-1">TOTAL NILAI</label>
                    <input type="number" step="0.5" id="score-${i}" value="${tempScores[i - 1] || ''}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-2xl font-black outline-none text-center text-white placeholder-slate-700" placeholder="0.0">
                </div>
                <div>
                    <label class="block text-[9px] text-slate-500 mb-1 flex justify-between">
                        <span>TEKNIK</span> ${i === 1 ? '<span class="text-yellow-500 font-bold">TIE-BREAK</span>' : ''}
                    </label>
                    <input type="number" step="0.5" id="tech-${i}" value="${tempTechs[i - 1] || ''}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-sm font-bold outline-none text-center ${i === 1 ? 'text-yellow-400' : 'text-blue-300'} placeholder-slate-700" placeholder="Opsional">
                </div>
            </div>

                        <!-- Tombol Batal/Manual (Muncul untuk membuka gembok stempel) -->
            <button onclick="resetJuriTunggal(${i})" id="btnReset${i}" class="hidden absolute top-0 right-0 bg-red-600 text-white w-8 h-8 rounded-bl-xl shadow-lg z-30 flex items-center justify-center hover:bg-red-500 transition-colors" title="Batal & Ubah Manual">
                <i class="fas fa-unlock text-xs"></i>
            </button>
        </div>
        `;
    }

    // Jalankan kalkulasi setiap kali form dirender ulang
    calculateLive();
}

let juriListenerRef = null; // Gembok listener agar tidak menumpuk (Memory Leak)

// 1. Tambahkan memori status reset di bagian atas (luar fungsi)
let requestedResetJuri = { 1: false, 2: false, 3: false, 4: false, 5: false };

// 2. Timpa fungsi ini
function listenStatusJuri(courtId) {
    const rtdbRef = database.ref(`live_embu/${courtId}`);

    // Matikan listener yang lama sebelum membuat yang baru
    if (juriListenerRef) juriListenerRef.off();
    juriListenerRef = rtdbRef;

    rtdbRef.on('value', (snapshot) => {
        const liveData = snapshot.val() || {};
        const dataJuri = liveData.juri || {};
        const selectEl = document.getElementById('select-peserta');
        const currentSelectedPartai = selectEl ? selectEl.value : null;

        // 🛡️ FILTER ANTI-BOCOR
        if (liveData.partai_id && currentSelectedPartai && liveData.partai_id !== currentSelectedPartai) {
            return;
        }

        let actualJudges = parseInt(localStorage.getItem('local_judges')) || 5;
        let submittedJudges = 0;

        for (let i = 1; i <= actualJudges; i++) {
            const inputScore = document.getElementById(`score-${i}`);
            const inputTech = document.getElementById(`tech-${i}`);
            const stempel = document.getElementById(`stempelJuri${i}`);
            const btnReset = document.getElementById(`btnReset${i}`);

            if (!inputScore) continue;

            if (dataJuri[i]) {
                // KONDISI 1: WASIT MENGIRIM DATA (KUNCI GEMBOK)
                requestedResetJuri[i] = false; // Matikan bendera reset

                inputScore.value = dataJuri[i].total;
                if (inputTech) inputTech.value = dataJuri[i].teknik;
                TEMP_RINCIAN_WASIT[i] = dataJuri[i].rincian || "";

                inputScore.readOnly = true;
                if (inputTech) inputTech.readOnly = true;
                inputScore.classList.add('text-green-400', 'font-black');

                if (stempel) stempel.classList.remove('hidden');

                if (btnReset) {
                    btnReset.classList.remove('hidden');
                    // Tampilkan Gembok Merah
                    btnReset.className = "absolute top-0 right-0 bg-red-600 text-white w-8 h-8 rounded-bl-xl shadow-lg z-30 flex items-center justify-center hover:bg-red-500 transition-colors cursor-pointer";
                    btnReset.innerHTML = '<i class="fas fa-lock text-xs"></i>';
                    btnReset.title = "Buka Kunci Wasit";
                }
                submittedJudges++;
            } else {
                // KONDISI 2: KOSONG ATAU SEDANG DI-RESET (BUKA KUNCI & FAIL-SAFE)
                inputScore.readOnly = false; // ✅ FAIL-SAFE: PANITERA BISA INPUT MANUAL
                if (inputTech) inputTech.readOnly = false;
                inputScore.classList.remove('text-green-400', 'font-black');
                delete TEMP_RINCIAN_WASIT[i];

                if (stempel) stempel.classList.add('hidden');

                if (requestedResetJuri[i] && btnReset) {
                    // Tampilkan Tombol Restart (Biru & Berputar)
                    btnReset.classList.remove('hidden');
                    btnReset.className = "absolute top-0 right-0 bg-blue-500 text-white w-8 h-8 rounded-bl-xl shadow-lg z-30 flex items-center justify-center hover:bg-blue-400 transition-colors";
                    btnReset.innerHTML = '<i class="fas fa-sync-alt fa-spin text-xs"></i>';
                    btnReset.title = "Menunggu Wasit (Bisa Diisi Manual)";
                } else if (btnReset) {
                    // Kosong murni dari awal pertandingan
                    btnReset.classList.add('hidden');
                }
            }
        }

        calculateLive();
    });
}

function resetJuriTunggal(nomorJuri) {
    if (confirm(`Minta Wasit ${nomorJuri} mengisi ulang nilainya?\n\n(Layar HP wasit akan terbuka. Jika wasit bermasalah, Anda dapat mengisi nilainya secara manual).`)) {
        const safeCourtId = typeof DEVICE_ROLE !== 'undefined' && DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';

        // Nyalakan bendera reset agar icon berubah jadi Restart
        requestedResetJuri[nomorJuri] = true;

        database.ref(`live_embu/${safeCourtId}/juri/${nomorJuri}`).set(null)
            .then(() => {
                // Kosongkan form input
                document.getElementById(`score-${nomorJuri}`).value = '';
                if (document.getElementById(`tech-${nomorJuri}`)) document.getElementById(`tech-${nomorJuri}`).value = '';
                calculateLive();
            })
            .catch(err => alert("Gagal mereset: " + err));
    }
}

function loadExistingScores() {
    const val = document.getElementById('select-peserta').value;
    if (!val || !val.includes('|')) return;

    // 👇 SUNTIKAN RESET IKON RESTART (Matikan Semua Bendera Restart Saat Ganti Atlet) 👇
    requestedResetJuri = { 1: false, 2: false, 3: false, 4: false, 5: false };

    const [pIdStr, babak] = val.split('|');
    const pId = parseInt(pIdStr);

    const p = STATE.participants.find(i => i.id === pId);
    if (!p) return;

    // --- SUNTIKAN PERBAIKAN (REVISI): PAKSA GAMBAR KOTAK JIKA MASIH KOSONG ---
    const judgeContainerFix = document.getElementById('judge-inputs');
    if (judgeContainerFix && judgeContainerFix.innerHTML.trim() === '') {
        // Menggunakan nama variabel baru (safeJudgesCount) agar tidak error
        const safeJudgesCount = parseInt(localStorage.getItem('local_judges')) || 5;
        setJudges(safeJudgesCount);
    }
    // ----------------------------------------------------------------

    // Sapu Bersih 5 Kotak (Kode asli Anda berlanjut di bawah ini...)
    for (let i = 1; i <= 5; i++) {
        let sEl = document.getElementById(`score-${i}`);
        let tEl = document.getElementById(`tech-${i}`);
        if (sEl) sEl.value = '';
        if (tEl) tEl.value = '';
    }
    const scoreData = p.scores[babak];
    let currentLocalJudges = parseInt(localStorage.getItem('local_judges')) || 5;

    // Sapu Bersih 5 Kotak
    for (let i = 1; i <= 5; i++) {
        let sEl = document.getElementById(`score-${i}`);
        let tEl = document.getElementById(`tech-${i}`);
        if (sEl) sEl.value = '';
        if (tEl) tEl.value = '';
    }

    if (scoreData && scoreData.raw && scoreData.raw.length > 0) {
        const nJudges = scoreData.raw.length;
        if (currentLocalJudges !== nJudges) setJudges(nJudges); // Jika mau edit nilai lama, sesuaikan kotaknya
        for (let i = 1; i <= nJudges; i++) {
            let sEl = document.getElementById(`score-${i}`); let tEl = document.getElementById(`tech-${i}`);
            if (sEl) sEl.value = scoreData.raw[i - 1] || '';
            if (tEl) tEl.value = (scoreData.techRaw && scoreData.techRaw[i - 1]) ? scoreData.techRaw[i - 1] : '';
        }
        UI.timerSeconds = scoreData.time || 0; updateTimerUI();
    } else {
        UI.timerSeconds = 0; updateTimerUI();
        setJudges(currentLocalJudges); // Kembalikan ke setingan lokal laptop untuk atlet baru
    }
    calculateLive();
}

function calculateLive() {
    let raw = [];
    let techRaw = [];

    // Deteksi jumlah wasit berdasarkan KOTAK FISIK di layar
    let actualJudges = 0;
    for (let i = 1; i <= 5; i++) {
        if (document.getElementById(`score-${i}`)) actualJudges++;
    }

    // 1. Ambil nilai
    for (let i = 1; i <= actualJudges; i++) {
        let sEl = document.getElementById(`score-${i}`);
        let tEl = document.getElementById(`tech-${i}`);
        raw.push(sEl && sEl.value !== '' ? parseFloat(sEl.value) : 0);
        techRaw.push(tEl && tEl.value !== '' ? parseFloat(tEl.value) : 0);
    }

    let validScores = [...raw];
    let validTechs = [...techRaw];

    // 2. PEMOTONGAN CERDAS: HANYA potong jika kotak fisik ada 5
    if (actualJudges === 5 && validScores.length === 5) {
        let minVal = Math.min(...validScores);
        let maxVal = Math.max(...validScores);

        validScores.splice(validScores.indexOf(minVal), 1);
        validScores.splice(validScores.indexOf(maxVal), 1);

        if (validTechs.length === 5) {
            let minT = Math.min(...validTechs);
            let maxT = Math.max(...validTechs);
            validTechs.splice(validTechs.indexOf(minT), 1);
            validTechs.splice(validTechs.indexOf(maxT), 1);
        }
    }

    // 3. Jumlahkan Total
    let totalRaw = validScores.reduce((a, b) => a + b, 0);
    let totalTech = validTechs.reduce((a, b) => a + b, 0);

    // 4. Kalkulasi Penalti (Auto-Detect Berdasarkan Kategori)
    let penalty = 0;
    let val = document.getElementById('select-peserta').value;

    if (val && val.includes('|')) {
        let pId = parseInt(val.split('|')[0]);
        let p = STATE.participants.find(x => x.id === pId);

        if (p && UI.timerSeconds > 0) {
            let rule = getEmbuTimeRule(p.kategori); // Panggil kecerdasan buatan
            let minTime = rule.min;
            let maxTime = rule.max;

            if (minTime > 0 && maxTime > 0) {
                if (UI.timerSeconds < minTime) {
                    penalty = Math.ceil((minTime - UI.timerSeconds) / 5) * 5;
                } else if (UI.timerSeconds > maxTime) {
                    penalty = Math.ceil((UI.timerSeconds - maxTime) / 5) * 5;
                }
            }
        }
    }
    // ... (kode penalti waktu di calculateLive) ...
    let finalScore = totalRaw - penalty;

    // 5. Update UI
    let scoreEl = document.getElementById('live-final-score');
    let penEl = document.getElementById('live-penalty');
    if (scoreEl) scoreEl.innerText = finalScore.toFixed(1);
    if (penEl) penEl.innerText = `Penalti Waktu: ${penalty}`;

    // 👇 SENSOR KELENGKAPAN UNTUK MEMBUKA KUNCI TOMBOL 👇
    let filledCount = 0;
    for (let i = 1; i <= actualJudges; i++) {
        let sEl = document.getElementById(`score-${i}`);
        if (sEl && sEl.value.trim() !== "") filledCount++;
    }

    let isComplete = (filledCount === actualJudges && actualJudges > 0);
    const saveBtns = [document.getElementById("btn-save-b1"), document.getElementById("btn-save-b2")];

    saveBtns.forEach(btn => {
        if (btn && !btn.classList.contains('hidden')) {
            if (isComplete) {
                btn.disabled = false; // Buka Kunci Mati!
                btn.classList.remove('opacity-50', 'cursor-not-allowed');
                btn.classList.add('animate-pulse');
            } else {
                if (typeof isWasitDigitalMode !== 'undefined' && isWasitDigitalMode) {
                    btn.disabled = true; // Kunci kembali jika dikosongkan
                    btn.classList.add('opacity-50', 'cursor-not-allowed');
                }
                btn.classList.remove('animate-pulse');
            }
        }
    });

    return { raw: raw, techRaw: techRaw, penalty: penalty, final: finalScore, tieBreaker: totalTech };
}

function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    if (UI.timerInterval) {
        clearInterval(UI.timerInterval); UI.timerInterval = null;
        btn.innerText = 'LANJUT'; // <--- FIX: Huruf dipendekkan agar tidak mendorong tombol reset
        btn.classList.replace('bg-red-600', 'bg-yellow-600');
        btn.classList.replace('hover:bg-red-500', 'hover:bg-yellow-500');
    } else {
        UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000);
        btn.innerText = 'STOP';
        btn.className = 'flex-1 bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg font-bold transition-colors';
    }
}

function resetTimer() {
    clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI();
    document.getElementById('btn-timer').innerText = 'START';
    document.getElementById('btn-timer').className = 'flex-1 bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-bold transition-colors';
    calculateLive();
}

// =========================================================
// FIX FINAL: TIMER & SAVE SCORE (Gembok Anti-Spam Klik)
// =========================================================

let isSaving = false; // <-- GEMBOK KEAMANAN GLOBAL

function saveScore() {
    if (isSaving) return;

    const val = document.getElementById('select-peserta').value;
    if (!val || !val.includes('|')) return alert('Pilih atlet dari dropdown terlebih dahulu!');
    const [pIdStr, babak] = val.split('|');
    const pId = parseInt(pIdStr);

    let currentLocalJudges = parseInt(localStorage.getItem('local_judges')) || 5;
    for (let i = 1; i <= currentLocalJudges; i++) {
        let sEl = document.getElementById(`score-${i}`);
        if (sEl && sEl.value === "") return alert(`TOTAL NILAI Wasit ${i} kosong!`);
    }

    const calc = calculateLive();
    const pIndex = STATE.participants.findIndex(i => i.id === pId);
    const p = STATE.participants[pIndex];

    p.scores[babak] = { raw: calc.raw, techRaw: calc.techRaw, penalty: calc.penalty, final: calc.final, tech: calc.tieBreaker, time: UI.timerSeconds };

    // --- CEK SYARAT EKSIBISI ---
    let catObj = STATE.categories.find(c => c.name === p.kategori);
    let minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;
    let catParts = STATE.participants.filter(x => x.kategori === p.kategori);
    let isEksibisi = (catObj.discipline === 'embu' && catParts.length < minPeserta && STATE.settings.eksibisiLangsungFinal === true);

    if (p.isFinalist) { p.finalScore = p.scores.b2.final; p.techScore = p.scores.b2.tech; }
    else if (p.pool !== '-' && p.pool !== 'SINGLE') { p.finalScore = p.scores.b1.final; p.techScore = p.scores.b1.tech; }
    else {
        // Jika masuk syarat Eksibisi, finalScore LANGSUNG patuh pada B1
        if (isEksibisi) {
            p.finalScore = p.scores.b1.final;
            p.techScore = p.scores.b1.tech;
        } else if (p.scores.b1.final > 0 && p.scores.b2.final > 0) {
            p.finalScore = (p.scores.b1.final + p.scores.b2.final) / 2;
            p.techScore = (p.scores.b1.tech + p.scores.b2.tech) / 2;
        }
        else { p.finalScore = p.scores[babak].final; p.techScore = p.scores[babak].tech; }
    }

    let updates = {};
    updates[`turnamen_data/participants/${pIndex}`] = p;

    // --- UBAH STATUS KATEGORI JADI COMPLETED JIKA EKSIBISI SELESAI ---
    if (isEksibisi) {
        // Cek apakah semua atlet di kelas ini sudah mengumpulkan nilai B1
        let allDone = catParts.every(x => x.id === p.id ? calc.final > 0 : x.scores.b1.final > 0);
        if (allDone) {
            let catIdx = STATE.categories.findIndex(c => c.name === p.kategori);
            if (catIdx > -1) {
                STATE.categories[catIdx].status = 'completed';
                updates[`turnamen_data/categories/${catIdx}/status`] = 'completed';
            }
        }
    }

    isSaving = true;
    document.body.style.cursor = 'wait';

    database.ref().update(updates).then(() => {

        // ======================================================
        // 🚀 INJEKSI FIRESTORE BATCH WRITE & FLUSH RTDB
        // ======================================================
        const safeCourtId = typeof DEVICE_ROLE !== 'undefined' && DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';

        // Buat ID Dokumen yang Absolut (Mencegah duplikasi data jika di-Undo)
        const partaiDocId = `embu_${p.kategori.replace(/\s+/g, '_')}_${pId}_${babak}`;

        try {
            const firestorePayload = {
                waktu_simpan: firebase.firestore.FieldValue.serverTimestamp(),
                court: safeCourtId,
                kategori: p.kategori,
                atlet: p.nama,
                kontingen: p.kontingen,
                babak: babak,
                rincian_juri: TEMP_RINCIAN_WASIT || {}, // Berisi object {1: "8|8|...", 2: "..."}
                total_nilai: calc.final,
                total_teknik: calc.tieBreaker
            };

            // 1. Tembak ke Firestore (Hanya dihitung 1 Write untuk 5 wasit & 50 item!)
            firebase.firestore().collection('hasil_rincian_embu').doc(partaiDocId).set(firestorePayload, { merge: true })
                .then(() => {
                    console.log("✅ Rincian audit sukses diamankan di Brankas Firestore.");

                    // 2. FLUSH RTDB (Hanya bersihkan nilai juri, biarkan identitas atlet tetap tampil di HP Wasit)
                    database.ref(`live_embu/${safeCourtId}/juri`).set(null);

                    // 3. Bersihkan memori lokal laptop Panitera
                    TEMP_RINCIAN_WASIT = {};
                })
                .catch(e => console.error("Gagal simpan rincian ke Firestore:", e));
        } catch (e) {
            console.warn("Firestore belum siap atau tidak tersedia.", e);
        }
        // ======================================================

        isSaving = false;
        document.body.style.cursor = 'default';

        // --- INJEKSI BROADCAST EMBU FINAL ---
        if (typeof IS_TV_LIVE !== 'undefined' && IS_TV_LIVE && DEVICE_ROLE !== 'admin') {
            let displayNama = p.nama.split(/[,+&]/).map(n => n.trim()).join(" & ");
            let timerFmt = `${Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0')}:${(UI.timerSeconds % 60).toString().padStart(2, '0')}`;

            // FIX: Menambahkan type: 'embu' secara paksa agar TV keluar dari mode Randori!
            database.ref(`live_broadcast/${DEVICE_ROLE}`).update({
                type: 'embu',
                current_action: 'show_score',
                score_data: {
                    kategori: p.kategori,
                    nama: displayNama,
                    kontingen: p.kontingen,
                    rawScores: calc.raw,
                    waktu: timerFmt,
                    denda: calc.penalty,
                    nilaiAkhir: calc.final.toFixed(2)
                }
            });
        }
        // ------------------------------------

        alert(`SKOR TERSIMPAN!`);
        resetTimer();

        let selectEl = document.getElementById('select-peserta');
        if (selectEl && selectEl.selectedIndex < selectEl.options.length - 1) {
            selectEl.selectedIndex++;
            updateScoringButtonsUI();
        }
    }).catch(err => {
        isSaving = false;
        document.body.style.cursor = 'default';
        alert("Gagal Simpan: " + err);
    });
}
function updateTimerUI() { document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0')}:${(UI.timerSeconds % 60).toString().padStart(2, '0')}`; pushRandoriToTV(); }

function calculateRandoriFinalists(catName) {
    let catMatches = STATE.matches.filter(m => m.kategori === catName);
    let pools = [...new Set(catMatches.map(m => m.pool))];
    let results = [];

    pools.forEach(poolName => {
        let poolMatches = catMatches.filter(m => m.pool === poolName);
        let grandFinals = poolMatches.filter(m => m.nextW === 'WINNER').sort((a, b) => b.id - a.id);

        if (grandFinals.length === 0 || grandFinals[0].status !== 'done') return;

        let gf = grandFinals[0];
        let juara1 = STATE.participants.find(p => p.id === gf.winnerId);
        let juara2 = STATE.participants.find(p => p.id === gf.loserId);

        let perungguArr = [];
        let mode = (STATE.settings && STATE.settings.tournamentMode) ? STATE.settings.tournamentMode : 'double';
        let finalMode = (STATE.settings && STATE.settings.finalRandoriMode) ? STATE.settings.finalRandoriMode : 'single';

        let isFinalCategory = catName.toUpperCase().includes('FINAL');
        let activeMode = isFinalCategory ? finalMode : mode;

        if (activeMode === 'single') {
            // MODE UMUM (SINGLE): Ambil 2 orang yang kalah di Semi-Final (Juara 3 Bersama)
            let sfs = poolMatches.filter(m => m.nextW === gf.matchNum && (m.status === 'done' || m.status === 'auto-win'));
            sfs.forEach(sf => {
                if (sf.loserId && sf.loserId !== -1) {
                    let p3 = STATE.participants.find(p => p.id === sf.loserId);
                    if (p3) perungguArr.push({ nama: p3.nama, kontingen: p3.kontingen });
                }
            });
        } else {
            // --- FIX BUG DOUBLE ELIMINATION ---
            // Hanya ambil 1 orang yang gugur di partai "FINAL BAWAH" (Juara 3 Mutlak)
            // Yang gugur sebelumnya (LB Semi-Final) dibiarkan menjadi Peringkat 4.
            let finalBawah = poolMatches.find(m => m.babak.toUpperCase() === "FINAL BAWAH" || m.babak.toUpperCase() === "LB FINAL");
            let juara3Mutlak = (finalBawah && finalBawah.status === 'done') ? STATE.participants.find(p => p.id === finalBawah.loserId) : null;

            if (juara3Mutlak) perungguArr.push({ nama: juara3Mutlak.nama, kontingen: juara3Mutlak.kontingen });
        }

        results.push({
            pool: poolName,
            emas: juara1 ? juara1.nama : null,
            emasKontingen: juara1 ? juara1.kontingen : null,
            perak: juara2 ? juara2.nama : null,
            perakKontingen: juara2 ? juara2.kontingen : null,
            perunggu: perungguArr
        });
    });

    return results.length > 0 ? results : null;
}

function cancelFinalist() {
    const filter = document.getElementById('rank-filter-kategori').value;
    if (!filter) return;
    if (!confirm("⚠️ Batalkan status finalis untuk kategori ini?\nData akan dikembalikan ke Pool awal.")) return;
    let catParts = STATE.participants.filter(p => p.kategori === filter);
    let changed = false;
    catParts.forEach(p => {
        if (p.isFinalist) {
            p.isFinalist = false; p.urutFinal = 0;
            if (p.pool === 'FINAL') {
                let takenA = catParts.some(x => x.pool === 'A' && x.urut === p.urut && x.id !== p.id);
                let takenB = catParts.some(x => x.pool === 'B' && x.urut === p.urut && x.id !== p.id);
                if (takenA && !takenB) p.pool = 'B'; else if (takenB && !takenA) p.pool = 'A'; else p.pool = 'A';
            }
            changed = true;
        }
    });
    if (changed) { saveToLocalStorage(); alert("Status Finalis dibatalkan!"); renderRanking(); checkExistingDrawing(); filterPesertaScoring(); }
}

function promoteToFinal() {
    const filter = document.getElementById('rank-filter-kategori').value;
    if (!filter) return alert("Pilih kategori spesifik terlebih dahulu!");
    const catObj = STATE.categories.find(c => c.name === filter);
    if (catObj && catObj.discipline === 'randori') return alert("Tindakan ini hanya untuk nomor Embu.");

    let list = STATE.participants.filter(p => p.kategori === filter && p.pool !== '-' && p.pool !== 'SINGLE' && p.pool !== 'FINAL');
    if (list.length === 0) return alert("Kategori ini tidak memiliki sistem Pool penyisihan.");
    if (list.some(p => p.isFinalist)) return alert("Finalis sudah ditetapkan!");

    let numFinalists = parseInt(prompt("Masukkan JUMLAH finalis DARI MASING-MASING POOL (misal: 3):", "3"));
    if (!numFinalists || isNaN(numFinalists) || numFinalists <= 0) return;

    // Tarik atlet dari berapapun Pool yang tercipta (A, B, C, dst)
    let combined = [];
    let uniquePools = [...new Set(list.map(p => p.pool))].sort();

    uniquePools.forEach(poolName => {
        let poolParts = list.filter(p => p.pool === poolName && p.scores.b1.final > 0).sort((a, b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
        combined = combined.concat(poolParts.slice(0, numFinalists));
    });

    if (combined.length === 0) return alert("Tidak ada data nilai.");
    if (confirm(`Tetapkan ${combined.length} peserta ini sebagai Finalis?`)) {
        combined.forEach(w => { let p = STATE.participants.find(x => x.id === w.id); if (p) { p.isFinalist = true; p.urutFinal = 0; } });
        saveToLocalStorage(); alert("Finalis ditetapkan!"); renderRanking(); checkExistingDrawing(); filterPesertaScoring();
    }
}

// =========================================================
// MAGIC BUTTON: AUTO GENERATE FINAL RANDORI DARI POOL
// =========================================================
function autoGenerateRandoriFinal(catName) {
    const poolResults = calculateRandoriFinalists(catName);
    if (!poolResults) return alert("Belum ada hasil pertandingan yang selesai.");

    let poolA = poolResults.find(r => r.pool === 'A');
    let poolB = poolResults.find(r => r.pool === 'B');

    // Validasi Cerdas: Tolak jika belum ada juara yang sah
    if (!poolA || !poolA.emas || !poolA.perak || !poolB || !poolB.emas || !poolB.perak) {
        return alert("❌ PENOLAKAN SISTEM:\nTurnamen Pool A dan Pool B belum selesai sepenuhnya. Pastikan masing-masing Pool sudah mendapatkan Juara 1 dan 2.");
    }

    const finalCatName = "FINAL " + catName;

    if (confirm(`🌟 MAGIC BUTTON AKTIF!\n\nSistem akan otomatis:\n1. Membuat kategori baru bernama "${finalCatName}"\n2. Menyalin Juara 1 & 2 dari Pool A dan B.\n3. Menyiapkan susunan Crossover (Silang).\n\nLanjutkan?`)) {

        // 1. Buat Kategori "FINAL ..." jika belum ada
        if (!STATE.categories.some(c => c.name === finalCatName)) {
            const originalCat = STATE.categories.find(c => c.name === catName);
            STATE.categories.push({
                id: Date.now(),
                name: finalCatName,
                type: originalCat ? originalCat.type : 1,
                discipline: 'randori'
            });
        }

        // 2. Ambil data atlet asli dari database
        const p1A = STATE.participants.find(p => p.nama === poolA.emas && p.kategori === catName);
        const p2A = STATE.participants.find(p => p.nama === poolA.perak && p.kategori === catName);
        const p1B = STATE.participants.find(p => p.nama === poolB.emas && p.kategori === catName);
        const p2B = STATE.participants.find(p => p.nama === poolB.perak && p.kategori === catName);

        // 3. Bersihkan peserta lama di kategori Final (agar tidak dobel jika tombol diklik 2x)
        STATE.participants = STATE.participants.filter(p => p.kategori !== finalCatName);

        // 4. INJEKSI ATLET (Urutan SANGAT PENTING: 1A, 2A, 1B, 2B untuk menjamin bagan Crossover akurat)
        let timeOffset = 0;
        [p1A, p2A, p1B, p2B].forEach(pOriginal => {
            if (pOriginal) {
                // Buat kloningan data atlet
                STATE.participants.push({
                    id: Date.now() + timeOffset++,
                    nama: pOriginal.nama,
                    kontingen: pOriginal.kontingen,
                    kategori: finalCatName,
                    urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0,
                    scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } },
                    finalScore: 0, techScore: 0
                });
            }
        });

        // 5. Simpan dan Lemparkan Panitia ke Tab Drawing!
        let updates = {};
        updates['turnamen_data/categories'] = STATE.categories;
        updates['turnamen_data/participants'] = STATE.participants;

        database.ref().update(updates).then(() => {
            alert("✅ Kategori FINAL berhasil disiapkan!\n\nAnda akan otomatis diarahkan ke Tab Drawing. Silakan klik tombol merah 'GENERATE BAGAN BARU' untuk memunculkan bagan silang (Crossover).");

            updateAllDropdowns(); // Perbarui seluruh list dropdown

            // Auto-pilih kategori final dan pindah tab
            let drawSelect = document.getElementById('draw-select-kategori');
            if (drawSelect) drawSelect.value = finalCatName;
            switchTab('drawing');

        }).catch(err => alert("Gagal membuat Final: " + err));
    }
}

// INJEKSI DOM UNTUK TOMBOL UNDUH HASIL (MIKRO)
function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    const btnPromote = document.getElementById('btn-promote-final');
    const container = document.getElementById('ranking-list');

    let microRankBtn = document.getElementById('btn-micro-rank-export');
    if (!microRankBtn && btnPromote && btnPromote.parentElement) {
        microRankBtn = document.createElement('button');
        microRankBtn.id = 'btn-micro-rank-export';
        microRankBtn.className = 'whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm flex items-center justify-center gap-2';
        microRankBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH HASIL RAW';

        // FIX: Arahkan khusus ke fungsi RAW
        microRankBtn.onclick = () => exportRawHasilCSV(document.getElementById('rank-filter-kategori').value);
        btnPromote.parentElement.appendChild(microRankBtn);
    }

    if (!filter) {
        btnPromote.classList.add('hidden');
        if (microRankBtn) microRankBtn.classList.add('hidden');
        return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl"><i class="fas fa-filter text-3xl mb-3 text-slate-600 block"></i>Pilih kategori pertandingan di atas untuk melihat hasil klasemen.</div>`;
    }

    if (microRankBtn) microRankBtn.classList.remove('hidden');

    let catObj = STATE.categories.find(c => c.name === filter);
    let catList = STATE.participants.filter(p => p.kategori === filter);
    const hasPools = catList.some(p => p.pool !== '-' && p.pool !== 'SINGLE' && p.pool !== 'FINAL');
    const hasFinal = catList.some(p => p.isFinalist);

    if (catObj && catObj.discipline === 'embu' && hasPools) {
        btnPromote.classList.remove('hidden');
        if (!hasFinal) {
            btnPromote.innerHTML = '<i class="fas fa-arrow-up mr-2"></i>TETAPKAN FINALIS';
            btnPromote.className = "whitespace-nowrap bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm";
            btnPromote.onclick = promoteToFinal;
        } else {
            btnPromote.innerHTML = '<i class="fas fa-undo mr-2"></i>BATALKAN FINALIS';
            btnPromote.className = "whitespace-nowrap bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm";
            btnPromote.onclick = cancelFinalist;
        }
    } else if (catObj && catObj.discipline === 'randori') {
        const poolResults = calculateRandoriFinalists(filter);
        const hasPoolA = poolResults && poolResults.some(r => r.pool === 'A');
        const hasPoolB = poolResults && poolResults.some(r => r.pool === 'B');
        const isAlreadyFinal = filter.toUpperCase().includes('FINAL');

        // FIX MAGIC BUTTON: Munculkan tombol generate jika ada Pool A & B dan belum masuk kategori Final
        if (hasPoolA && hasPoolB && !isAlreadyFinal) {
            btnPromote.classList.remove('hidden');
            btnPromote.innerHTML = '<i class="fas fa-magic mr-2"></i>GENERATE PARTAI FINAL';
            btnPromote.className = "whitespace-nowrap bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm animate-pulse";
            btnPromote.onclick = () => autoGenerateRandoriFinal(filter);
        } else {
            btnPromote.classList.add('hidden');
        }
    } else {
        btnPromote.classList.add('hidden');
    }

    let hasData = catList.some(p => p.scores.b1.final > 0 || p.losses > 0 || (catObj.discipline === 'randori' && calculateRandoriFinalists(filter)));

    if (!hasData) {
        if (catObj.discipline === 'randori') { return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Turnamen Randori belum selesai / belum ada juara.</div>`; }
        else { return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data nilai di kategori ini.</div>`; }
    }

    let htmlOutput = `<h3 class="text-xl font-bold text-yellow-400 mt-4 mb-4 border-b-2 border-slate-700 pb-3 flex items-center gap-3"><span class="${catObj.discipline === 'randori' ? 'bg-red-700' : 'bg-blue-600'} text-[10px] px-2 py-1 rounded font-black">${catObj.discipline.toUpperCase()}</span>${catObj.name}</h3>`;

    if (catObj.discipline === 'festival') {
        btnPromote.classList.add('hidden');
        let unikPools = [...new Set(catList.filter(p => p.urut > 0).map(p => p.pool))].sort();
        if (unikPools.length === 0) return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data di kategori Festival ini.</div>`;

        unikPools.forEach(poolKey => {
            let poolParts = catList.filter(p => p.pool === poolKey && p.scores.b1.final > 0);
            if (poolParts.length === 0) return;

            poolParts.sort((a, b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
            htmlOutput += `<h4 class="text-md font-bold text-green-400 mt-6 mb-3 pl-2 border-l-4 border-green-500">KLASEMEN KELOMPOK ${poolKey}</h4>`;

            htmlOutput += poolParts.map((p, i) => {
                let medalIcon = "";
                // Peringkat 1(Emas), 2(Perak), 3&4(Perunggu)
                if (i === 0) medalIcon = '<i class="fas fa-medal text-yellow-400 text-2xl drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]"></i>';
                else if (i === 1) medalIcon = '<i class="fas fa-medal text-slate-300 text-2xl drop-shadow-[0_0_5px_rgba(203,213,225,0.5)]"></i>';
                else if (i === 2 || i === 3) medalIcon = '<i class="fas fa-medal text-amber-600 text-2xl drop-shadow-[0_0_5px_rgba(217,119,6,0.5)]"></i>';
                else medalIcon = `<span class="text-2xl font-black text-slate-600">${i + 1}</span>`;

                let displayFinal = p.scores.b1.final.toFixed(2);
                return `<div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4 mb-3 hover:bg-slate-800/50 transition-colors">
                    <div class="w-12 text-center flex-shrink-0">${medalIcon}</div>
                    <div class="flex-1 w-full">
                        <div class="font-bold text-lg text-white whitespace-normal break-words">${formatNama(p.nama, 'html')}</div>
                        <div class="text-xs text-slate-400 mt-1"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700 shadow-sm">${p.kontingen}</span></div>
                    </div>
                    <div class="flex gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700 items-center justify-end">
                        <div class="text-center md:text-right pl-3">
                            <div class="text-[10px] text-green-400 font-bold uppercase tracking-wider">Nilai Akhir</div>
                            <div class="text-2xl font-black text-white">${displayFinal}</div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        });
    } else if (catObj.discipline === 'embu') {
        let dynamicPools = [...new Set(catList.filter(p => p.pool !== '-' && p.pool !== 'SINGLE' && p.pool !== 'FINAL').map(p => p.pool))].sort();
        let poolKeys = ['FINAL', 'SINGLE'].concat(dynamicPools);

        poolKeys.forEach(poolKey => {
            // --- FIX BUG: DEKLARASI POOLLIST YANG SEMPAT HILANG ---
            let poolList = [];
            if (poolKey === 'FINAL') {
                poolList = catList.filter(p => p.isFinalist && p.scores.b2.final > 0);
            } else {
                poolList = catList.filter(p => p.pool === poolKey && p.scores.b1.final > 0);
            }

            // Jika tidak ada atlet yang sudah dinilai di pool ini, lewati (jangan digambar)
            if (poolList.length === 0) return;
            // -------------------------------------------------------

            // Cek kondisi eksibisi di rendering ranking
            let minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;
            let isEksibisi = (catObj.discipline === 'embu' && catList.length < minPeserta && STATE.settings && STATE.settings.eksibisiLangsungFinal === true);

            if (poolKey === 'FINAL') {
                poolList.sort((a, b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech);
            } else if (poolKey === 'SINGLE') {
                if (isEksibisi) {
                    // BYPASS: Jadikan B1 sebagai harga mati
                    poolList.forEach(p => {
                        p.calcFinal = p.scores.b1.final || 0;
                        p.calcTech = p.scores.b1.tech || 0;
                    });
                } else {
                    poolList.forEach(p => {
                        let s1 = p.scores.b1.final || 0; let s2 = p.scores.b2.final || 0;
                        p.calcFinal = (s1 > 0 && s2 > 0) ? ((s1 + s2) / 2) : (s1 > 0 ? s1 : s2);
                        let t1 = p.scores.b1.tech || 0; let t2 = p.scores.b2.tech || 0;
                        p.calcTech = (s1 > 0 && s2 > 0) ? ((t1 + t2) / 2) : (s1 > 0 ? t1 : t2);
                    });
                }
                poolList.sort((a, b) => b.calcFinal - a.calcFinal || b.calcTech - a.calcTech);
            } else {
                poolList.sort((a, b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
            }

            let poolTitle = poolKey === 'SINGLE' ? (isEksibisi ? 'KLASEMEN AKHIR (EKSIBISI 1 BABAK)' : 'KLASEMEN AKHIR') : poolKey === 'FINAL' ? '<i class="fas fa-star text-yellow-400"></i> KLASEMEN FINAL' : `KLASEMEN POOL ${poolKey}`;
            htmlOutput += `<h4 class="text-md font-bold text-blue-400 mt-6 mb-3 pl-2 border-l-4 border-blue-500">${poolTitle}</h4>`;

            htmlOutput += poolList.map((p, i) => {
                let scoreB1 = p.scores.b1.final || 0;
                let scoreB2 = p.scores.b2.final || 0;
                let finalScore = (poolKey === 'SINGLE') ? p.calcFinal : (poolKey === 'FINAL' ? scoreB2 : scoreB1);

                let isWaiting = finalScore === 0;
                let medal = isWaiting ? `<span class="text-xl font-bold text-slate-600">-</span>` : i === 0 ? '<i class="fas fa-medal text-yellow-400 text-2xl"></i>' : i === 1 ? '<i class="fas fa-medal text-slate-300 text-2xl"></i>' : i === 2 ? '<i class="fas fa-medal text-amber-600 text-2xl"></i>' : `<span class="text-2xl font-black text-slate-600">${i + 1}</span>`;

                let displayB1 = scoreB1 > 0 ? scoreB1.toFixed(1) : '-';
                let displayB2 = scoreB2 > 0 ? scoreB2.toFixed(1) : '-';
                let displayFinal = isWaiting ? "000.0" : finalScore.toFixed(2);
                let displayColor = isWaiting ? "text-slate-500" : "text-white";

                let extraScoresHTML = '';
                // Sembunyikan breakdown B1 & B2 jika Eksibisi
                if (poolKey === 'SINGLE' && scoreB1 > 0 && !isEksibisi) {
                    extraScoresHTML = `
                   <div class="text-center md:text-right px-3 border-r border-slate-700">
                        <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Babak 1</div>
                        <div class="text-lg font-bold text-slate-300">${displayB1}</div>
                   </div>
                   <div class="text-center md:text-right px-3 border-r border-slate-700">
                        <div class="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Babak 2</div>
                        <div class="text-lg font-bold text-slate-300">${displayB2}</div>
                   </div>`;
                }

                return `<div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4 mb-3 hover:bg-slate-800/50 transition-colors">
                    <div class="w-12 text-center flex-shrink-0">${medal}</div>
                    <div class="flex-1 w-full">
                        <div class="font-bold text-lg ${displayColor} whitespace-normal break-words">${formatNama(p.nama, 'html')} ${poolKey !== 'FINAL' && p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded ml-2 shadow-sm font-black tracking-wide">LULUS FINAL</span>' : ''}</div>                        <div class="text-xs text-slate-400 mt-1"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700 shadow-sm">${p.kontingen}</span></div>
                    </div>
                    <div class="flex gap-2 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700 items-center justify-end">
                        ${extraScoresHTML}
                        <div class="text-center md:text-right pl-3">
                            <div class="text-[10px] ${isWaiting ? 'text-slate-500' : 'text-green-400'} font-bold uppercase tracking-wider">${isWaiting ? 'Menunggu' : 'Nilai Akhir'}</div>
                            <div class="text-2xl font-black ${displayColor}">${displayFinal}</div>
                        </div>
                    </div>
                </div>`;
            }).join('');
        });
    } else {
        const poolResults = calculateRandoriFinalists(catObj.name);
        if (!poolResults) {
            htmlOutput += `<div class="p-6 text-center text-slate-600 bg-slate-900/50 rounded-xl border border-slate-800 text-sm italic">Turnamen di kategori ini masih berlangsung.</div>`;
        } else {
            poolResults.forEach(res => {
                let isFinalCat = catObj.name.toUpperCase().includes('FINAL');
                let isSinglePool = res.pool === '-';
                let title = isFinalCat || isSinglePool ? "PEMENANG MEDALI" : `JUARA POOL ${res.pool}`;
                let label1 = isFinalCat || isSinglePool ? "Juara 1 (Emas)" : `Juara 1 Pool ${res.pool}`;
                let label2 = isFinalCat || isSinglePool ? "Juara 2 (Perak)" : `Runner-Up Pool ${res.pool}`;

                // --- FIX TEKS LABEL DINAMIS ---
                // Jika array perunggu isi 2 orang = Bersama. Jika 1 orang = Mutlak.
                let teksJuara3 = res.perunggu.length > 1 ? "Juara 3 Bersama (Perunggu)" : "Juara 3 (Perunggu)";
                let label3 = isFinalCat || isSinglePool ? teksJuara3 : `${res.perunggu.length > 1 ? "Juara 3 Bersama" : "Juara 3"} Pool ${res.pool}`;

                htmlOutput += `<h4 class="text-md font-bold text-red-400 mt-6 mb-3 pl-2 border-l-4 border-red-500">${title}</h4>`;
                if (res.emas) htmlOutput += `<div class="flex items-center bg-dark-card p-4 rounded-xl border border-yellow-600 gap-4 mb-3 bg-yellow-600/10"><div class="w-12 text-center flex-shrink-0"><i class="fas fa-medal text-yellow-400 text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]"></i></div><div class="flex-1"><div class="font-bold text-lg text-white whitespace-normal break-words">${formatNama(res.emas, 'html')}</div><div class="text-xs text-slate-400 mt-1 uppercase font-bold text-yellow-500 tracking-wider">${res.emasKontingen} &bull; ${label1}</div></div></div>`;
                if (res.perak) htmlOutput += `<div class="flex items-center bg-dark-card p-4 rounded-xl border border-slate-600 gap-4 mb-3 bg-slate-500/10"><div class="w-12 text-center flex-shrink-0"><i class="fas fa-medal text-slate-300 text-3xl drop-shadow-[0_0_10px_rgba(203,213,225,0.5)]"></i></div><div class="flex-1"><div class="font-bold text-lg text-white whitespace-normal break-words">${formatNama(res.perak, 'html')}</div><div class="text-xs text-slate-400 mt-1 uppercase font-bold text-slate-300 tracking-wider">${res.perakKontingen} &bull; ${label2}</div></div></div>`;
                res.perunggu.forEach(p => { htmlOutput += `<div class="flex items-center bg-dark-card p-4 rounded-xl border border-amber-700 gap-4 mb-3 bg-amber-800/10"><div class="w-12 text-center flex-shrink-0"><i class="fas fa-medal text-amber-600 text-3xl drop-shadow-[0_0_10px_rgba(217,119,6,0.5)]"></i></div><div class="flex-1"><div class="font-bold text-lg text-white whitespace-normal break-words">${formatNama(p.nama, 'html')}</div><div class="text-xs text-slate-400 mt-1 uppercase font-bold text-amber-600 tracking-wider">${p.kontingen} &bull; ${label3}</div></div></div>`; });
            });
        }
    }
    container.innerHTML = htmlOutput;
}

function renderJuaraUmum() {
    let tally = {};
    const minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;

    STATE.categories.forEach(cat => {
        // PROTEKSI 1: FESTIVAL MUTLAK TIDAK MASUK JUARA UMUM
        if (cat.discipline === 'festival') return;

        let catParts = STATE.participants.filter(p => p.kategori === cat.name);
        const minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;

        // PROTEKSI 2: KELAS EKSIBISI TIDAK MASUK JUARA UMUM
        let isEksibisi = (cat.discipline === 'embu' && catParts.length < minPeserta && STATE.settings && STATE.settings.eksibisiLangsungFinal === true);
        if (isEksibisi) return;

        // ... (lanjutkan kode logika Juara Umum di bawahnya yang sudah ada)
        const isFinalCategory = cat.name.toUpperCase().includes('FINAL');

        let baseName = cat.name.replace(/FINAL/ig, '').trim().toLowerCase();
        let relatedParticipants = STATE.participants.filter(p => p.kategori.replace(/FINAL/ig, '').trim().toLowerCase() === baseName);
        let uniqueAthletes = new Set(relatedParticipants.map(p => p.nama.toLowerCase().trim()));
        let trueParticipantCount = uniqueAthletes.size;

        if (trueParticipantCount < minPeserta) return;

        if (cat.discipline === 'embu') {
            // FIX JUARA UMUM EMBU SINGLE POOL
            let hasFinalists = catParts.some(p => p.isFinalist);
            let targetParts = [];

            if (hasFinalists) {
                targetParts = catParts.filter(p => p.isFinalist && p.scores.b2.final > 0);
                targetParts.forEach(p => { p.calcFinal = p.scores.b2.final; p.calcTech = p.scores.b2.tech; });
            } else if (catParts.some(p => p.pool === 'SINGLE' || p.pool === '-')) {
                targetParts = catParts.filter(p => (p.pool === 'SINGLE' || p.pool === '-') && p.urut > 0);
                targetParts.forEach(p => {
                    let s1 = p.scores.b1.final || 0; let s2 = p.scores.b2.final || 0;
                    p.calcFinal = (s1 > 0 && s2 > 0) ? ((s1 + s2) / 2) : (s1 > 0 ? s1 : s2);
                    let t1 = p.scores.b1.tech || 0; let t2 = p.scores.b2.tech || 0;
                    p.calcTech = (s1 > 0 && s2 > 0) ? ((t1 + t2) / 2) : (s1 > 0 ? t1 : t2);
                });
            }

            let wins = targetParts.filter(p => p.calcFinal > 0).sort((a, b) => b.calcFinal - a.calcFinal || b.calcTech - a.calcTech);
            if (wins[0] && wins[0].kontingen) { tally[wins[0].kontingen] = tally[wins[0].kontingen] || { g: 0, s: 0, b: 0 }; tally[wins[0].kontingen].g++; }
            if (wins[1] && wins[1].kontingen) { tally[wins[1].kontingen] = tally[wins[1].kontingen] || { g: 0, s: 0, b: 0 }; tally[wins[1].kontingen].s++; }
            if (wins[2] && wins[2].kontingen) { tally[wins[2].kontingen] = tally[wins[2].kontingen] || { g: 0, s: 0, b: 0 }; tally[wins[2].kontingen].b++; }
        } else {
            const hasPools = catParts.some(p => p.pool === 'A' || p.pool === 'B');
            if (hasPools && !isFinalCategory) return;

            const poolResults = calculateRandoriFinalists(cat.name);
            if (!poolResults) return;

            poolResults.forEach(res => {
                if (res.emasKontingen) { tally[res.emasKontingen] = tally[res.emasKontingen] || { g: 0, s: 0, b: 0 }; tally[res.emasKontingen].g++; }
                if (res.perakKontingen) { tally[res.perakKontingen] = tally[res.perakKontingen] || { g: 0, s: 0, b: 0 }; tally[res.perakKontingen].s++; }
                res.perunggu.forEach(p => {
                    if (p.kontingen) { tally[p.kontingen] = tally[p.kontingen] || { g: 0, s: 0, b: 0 }; tally[p.kontingen].b++; }
                });
            });
        }
    });

    let leaderboard = Object.keys(tally).map(kontingen => ({ nama: kontingen, emas: tally[kontingen].g, perak: tally[kontingen].s, perunggu: tally[kontingen].b, total: tally[kontingen].g + tally[kontingen].s + tally[kontingen].b }));
    leaderboard.sort((a, b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu);

    const tbody = document.getElementById('table-juara-body');
    if (leaderboard.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 border-b border-slate-700">Belum ada data medali disumbangkan.</td></tr>`;
    tbody.innerHTML = leaderboard.map((k, i) => `<tr class="hover:bg-slate-800/50 transition-colors"><td class="p-4 text-center font-bold text-slate-500 border-b border-slate-800">${i + 1}</td><td class="p-4 font-bold text-white border-b border-slate-800 text-lg whitespace-normal break-words">${k.nama}</td><td class="p-4 text-center font-black text-yellow-500 border-b border-slate-800 bg-yellow-500/10">${k.emas}</td><td class="p-4 text-center font-black text-slate-300 border-b border-slate-800 bg-slate-400/10">${k.perak}</td><td class="p-4 text-center font-black text-amber-600 border-b border-slate-800 bg-amber-600/10">${k.perunggu}</td><td class="p-4 text-center font-black text-blue-400 border-b border-slate-800">${k.total}</td></tr>`).join('');
}

// ---------------------------------------------------------
// CSV EXPORT LOGIC (MULTIFUNCTION: MICRO & MACRO)
// ---------------------------------------------------------
function downloadCSV(filename, rows) {
    // 1. \uFEFF adalah BOM (Byte Order Mark) agar Excel membaca teks dengan rapi
    // 2. .join(";") mengganti pemisah dari koma (,) menjadi titik koma (;) khusus Excel Indonesia
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.map(cell => `"${cell}"`).join(";")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = filename;
    link.click();
}

async function exportDrawingExcel(filterCatName = null) {
    if (typeof ExcelJS === 'undefined') {
        return alert("Library ExcelJS belum termuat. Pastikan koneksi internet aktif untuk memuat library pembuat Excel.");
    }

    try {
        document.body.style.cursor = 'wait';

        // 1. Inisialisasi Kertas Kerja Excel
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Hasil Drawing", {
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        // 2. Set Ukuran Kolom
        sheet.getColumn(1).width = 10; // Urutan
        sheet.getColumn(2).width = 15; // POOL
        sheet.getColumn(3).width = 30; // Kontingen
        sheet.getColumn(4).width = 45; // Nama Atlet

        // 3. Deklarasi Styling Visual
        const borderAll = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
        const subtitleStyle = { font: { name: 'Arial', size: 10, italic: true }, alignment: { horizontal: 'center' } };

        const headerCatStyle = {
            font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }, // Biru Gelap
            alignment: { horizontal: 'left', vertical: 'middle' }
        };
        const tableHeaderStyle = {
            font: { name: 'Arial', size: 10, bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }, // Abu-abu
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: borderAll
        };

        // 4. Cetak Kop Judul Utama
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = "HASIL DRAWING DAN JADWAL TANDING - MASS KEMPO";
        sheet.getCell('A1').style = titleStyle;

        sheet.mergeCells('A2:D2');
        sheet.getCell('A2').value = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
        sheet.getCell('A2').style = subtitleStyle;

        let currentRow = 4;
        let dataPrinted = false; // Pelacak jika semua kosong

        // 5. Filter & Urutkan Kategori (FESTIVAL DI ATAS, disusul EMBU. Randori diabaikan)
        let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;
        let drawCats = categoriesToExport.filter(c => c.discipline === 'embu' || c.discipline === 'festival');

        drawCats.sort((a, b) => {
            if (a.discipline === 'festival' && b.discipline !== 'festival') return -1;
            if (a.discipline !== 'festival' && b.discipline === 'festival') return 1;
            return 0;
        });

        if (drawCats.length === 0) {
            document.body.style.cursor = 'default';
            return alert("Tidak ada data kategori Embu atau Festival untuk diekspor.");
        }

        // 6. MESIN PENCETAK BLOK TABEL
        const printTableBlock = (title, partsList, urutProp) => {
            if (partsList.length === 0) return; // SKIP OTOMATIS JIKA KOSONG (Belum Drawing)
            dataPrinted = true;

            // Cetak Judul Baris (Misal: EMBU BERPASANGAN (BABAK 1))
            sheet.mergeCells(`A${currentRow}:D${currentRow}`);
            let catCell = sheet.getCell(`A${currentRow}`);
            catCell.value = title.toUpperCase();
            catCell.style = headerCatStyle;
            currentRow++;

            // Cetak Header Tabel
            ['Urutan', 'POOL', 'Kontingen', 'Nama Atlet'].forEach((text, i) => {
                let cell = sheet.getCell(currentRow, i + 1);
                cell.value = text; cell.style = tableHeaderStyle;
            });
            currentRow++;

            // Cetak Baris Atlet
            partsList.forEach(p => {
                // Kolom 1: Urutan (Dinamis: urut, urutFinal, atau urutB2)
                sheet.getCell(currentRow, 1).value = p[urutProp];

                // Kolom 2: POOL (Paksa 'single' jika tidak ada pool)
                let poolVal = (p.pool === '-' || p.pool === 'SINGLE') ? 'SINGLE' : p.pool;
                sheet.getCell(currentRow, 2).value = poolVal;

                // Kolom 3: Kontingen
                sheet.getCell(currentRow, 3).value = p.kontingen;

                // Kolom 4: Nama Atlet (Wrap Text, dipisah \n tiap ada koma/&/+)
                let names = String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n).join('\n');
                sheet.getCell(currentRow, 4).value = names;

                // Terapkan Garis & Wrap Text
                [1, 2, 3, 4].forEach(colIdx => {
                    let c = sheet.getCell(currentRow, colIdx);
                    c.border = borderAll;
                    c.alignment = {
                        vertical: 'middle',
                        horizontal: (colIdx === 3 || colIdx === 4) ? 'left' : 'center',
                        wrapText: colIdx === 4 // Fitur enter otomatis untuk nama beregu
                    };
                });
                currentRow++;
            });
            currentRow += 2; // Spasi sebelum blok tabel berikutnya
        };

        // 7. PROSES PENYORTIRAN KELOMPOK/POOL
        drawCats.forEach(cat => {
            let catParts = STATE.participants.filter(p => p.kategori === cat.name && p.urut > 0);
            if (catParts.length === 0) return; // Skip kategori ini jika sama sekali belum diundi

            if (cat.discipline === 'festival') {
                // FESTIVAL: Bagi berdasarkan Kelompok
                let unikPools = [...new Set(catParts.map(p => p.pool))].sort();
                unikPools.forEach(poolName => {
                    let poolParts = catParts.filter(p => p.pool === poolName).sort((a, b) => a.urut - b.urut);
                    printTableBlock(`${cat.discipline} ${cat.name} (KELOMPOK ${poolName})`, poolParts, 'urut');
                });
            } else if (cat.discipline === 'embu') {
                // EMBU: Cek apakah ada sistem Pool / Final
                let hasFinalists = catParts.some(p => p.isFinalist && p.urutFinal > 0);
                let isMultiPool = catParts.some(p => p.pool !== '-' && p.pool !== 'SINGLE');

                if (isMultiPool) {
                    let unikPools = [...new Set(catParts.map(p => p.pool))].sort();
                    unikPools.forEach(poolName => {
                        let poolParts = catParts.filter(p => p.pool === poolName).sort((a, b) => a.urut - b.urut);
                        printTableBlock(`${cat.discipline} ${cat.name} (PENYISIHAN POOL ${poolName})`, poolParts, 'urut');
                    });

                    if (hasFinalists) {
                        let finalParts = catParts.filter(p => p.isFinalist && p.urutFinal > 0).sort((a, b) => a.urutFinal - b.urutFinal);
                        printTableBlock(`${cat.discipline} ${cat.name} (BABAK 2 / FINAL)`, finalParts, 'urutFinal');
                    }
                } else {
                    // Jalur Single Pool
                    let b1Parts = [...catParts].sort((a, b) => a.urut - b.urut);
                    printTableBlock(`${cat.discipline} ${cat.name} (BABAK 1)`, b1Parts, 'urut');

                    let b2Parts = catParts.filter(p => p.urutB2 > 0).sort((a, b) => a.urutB2 - b.urutB2);
                    if (b2Parts.length > 0) {
                        printTableBlock(`${cat.discipline} ${cat.name} (BABAK 2)`, b2Parts, 'urutB2');
                    }
                }
            }
        });

        // 8. Peringatan jika semua kategori kosong
        if (!dataPrinted) {
            document.body.style.cursor = 'default';
            return alert("Belum ada satupun kategori Embu / Festival yang sudah dilakukan undian (Drawing).");
        }

        // 9. Kompilasi dan Unduh File Excel
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        let prefix = filterCatName ? `Hasil_Drawing_${filterCatName.replace(/[^a-zA-Z0-9]/g, '_')}` : `Hasil_Drawing_MASS`;
        a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.href = url;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        document.body.style.cursor = 'default';

    } catch (err) {
        document.body.style.cursor = 'default';
        console.error(err);
        alert("Gagal mencetak Rekap Excel: " + err.message);
    }
}

// =========================================================
// MESIN EKSPOR 1: DATA RAW (Untuk Tab Ranking - Detail Nilai Juri)
// =========================================================
function exportRawHasilCSV(filterCatName = null) {
    let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;
    let rows = [];

    rows.push(["DATA MENTAH (RAW) HASIL PERTANDINGAN - MASS KEMPO"]);
    rows.push(["Dicetak pada:", new Date().toLocaleString('id-ID')]);
    rows.push([]);

    categoriesToExport.forEach(cat => {
        rows.push(["==============================================================="]);
        rows.push(["KATEGORI:", cat.name.toUpperCase()]);
        rows.push(["DISIPLIN:", cat.discipline.toUpperCase()]);
        rows.push(["==============================================================="]);

        if (cat.discipline === 'embu') {
            let catParts = STATE.participants.filter(p => p.kategori === cat.name);

            // TABEL B1
            rows.push([]);
            rows.push(["[ HASIL BABAK 1 / PENYISIHAN ]"]);
            rows.push(["Peringkat", "Pool", "Nama Atlet", "Kontingen", "Wasit 1", "Wasit 2", "Wasit 3", "Wasit 4", "Wasit 5", "Waktu", "Denda", "Nilai B1"]);

            let hasB1Data = false;
            ['SINGLE', 'A', 'B'].forEach(poolKey => {
                let poolParts = catParts.filter(p => p.pool === poolKey && p.urut > 0);
                if (poolParts.length === 0) return;
                poolParts.sort((a, b) => (b.scores.b1.final || 0) - (a.scores.b1.final || 0) || (b.scores.b1.tech || 0) - (a.scores.b1.tech || 0));

                poolParts.forEach((p, i) => {
                    hasB1Data = true;
                    let s = p.scores.b1;
                    let rank = (s.final > 0) ? String(i + 1) : "-";
                    let w = s.raw || [];
                    let waktuFmt = `${Math.floor((s.time || 0) / 60).toString().padStart(2, '0')}:${((s.time || 0) % 60).toString().padStart(2, '0')}`;
                    let finalScore = s.final > 0 ? s.final.toFixed(2).replace('.', ',') : "Menunggu";
                    let cetakPool = poolKey === 'SINGLE' ? '-' : poolKey;

                    // --- PECAH BARIS BERSIH ---
                    let names = String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n);
                    if (names.length === 0) names = ["-"];
                    names.forEach((n, idx) => {
                        if (idx === 0) rows.push([rank, cetakPool, n, p.kontingen, String(w[0] || '-').replace('.', ','), String(w[1] || '-').replace('.', ','), String(w[2] || '-').replace('.', ','), String(w[3] || '-').replace('.', ','), String(w[4] || '-').replace('.', ','), waktuFmt, s.penalty || 0, finalScore]);
                        else rows.push(["", "", n, "", "", "", "", "", "", "", "", ""]);
                    });
                });
            });
            if (!hasB1Data) rows.push(["-", "-", "Belum ada peserta diundi / dimainkan", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);

            // TABEL B2
            rows.push([]);
            rows.push(["[ HASIL BABAK 2 / FINAL ]"]);
            rows.push(["Peringkat", "Pool", "Nama Atlet", "Kontingen", "Wasit 1", "Wasit 2", "Wasit 3", "Wasit 4", "Wasit 5", "Waktu", "Denda", "Nilai B2", "Nilai GABUNGAN (Akhir)"]);

            let hasFinalists = catParts.some(p => p.isFinalist);
            let b2Parts = [];
            if (hasFinalists) b2Parts = catParts.filter(p => p.isFinalist);
            else if (catParts.some(p => p.pool === 'SINGLE')) b2Parts = catParts.filter(p => p.pool === 'SINGLE' && p.urut > 0);

            if (b2Parts.length > 0) {
                b2Parts.forEach(p => {
                    let s1 = p.scores.b1.final || 0; let s2 = p.scores.b2.final || 0;
                    p.calcFinal = hasFinalists ? s2 : ((s1 > 0 && s2 > 0) ? ((s1 + s2) / 2) : (s1 > 0 ? s1 : s2));
                    let t1 = p.scores.b1.tech || 0; let t2 = p.scores.b2.tech || 0;
                    p.calcTech = hasFinalists ? t2 : ((s1 > 0 && s2 > 0) ? ((t1 + t2) / 2) : (s1 > 0 ? t1 : t2));
                });
                b2Parts.sort((a, b) => b.calcFinal - a.calcFinal || b.calcTech - a.calcTech);

                b2Parts.forEach((p, i) => {
                    let s = p.scores.b2;
                    let hasPlayedB2 = (s.final > 0);
                    let rank = hasPlayedB2 ? String(i + 1) : "-";
                    let poolLabelB2 = hasFinalists ? "FINAL" : "-";
                    let w = s.raw || [];
                    let waktuFmt = `${Math.floor((s.time || 0) / 60).toString().padStart(2, '0')}:${((s.time || 0) % 60).toString().padStart(2, '0')}`;
                    let finalB2 = hasPlayedB2 ? s.final.toFixed(2).replace('.', ',') : "Menunggu";

                    let gabungan = "Menunggu";
                    if (hasFinalists) gabungan = hasPlayedB2 ? s.final.toFixed(2).replace('.', ',') : "Menunggu";
                    else gabungan = p.calcFinal > 0 ? p.calcFinal.toFixed(2).replace('.', ',') : "Menunggu";

                    // --- PECAH BARIS BERSIH ---
                    let names = String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n);
                    if (names.length === 0) names = ["-"];
                    names.forEach((n, idx) => {
                        if (idx === 0) rows.push([rank, poolLabelB2, n, p.kontingen, String(w[0] || '-').replace('.', ','), String(w[1] || '-').replace('.', ','), String(w[2] || '-').replace('.', ','), String(w[3] || '-').replace('.', ','), String(w[4] || '-').replace('.', ','), waktuFmt, s.penalty || 0, finalB2, gabungan]);
                        else rows.push(["", "", n, "", "", "", "", "", "", "", "", "", ""]);
                    });
                });
            } else {
                rows.push(["-", "-", "Peserta Babak 2 / Final belum ditetapkan", "-", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
            }
            rows.push([]); rows.push([]);

        } else if (cat.discipline === 'festival') {
            rows.push([]);
            rows.push(["[ HASIL FESTIVAL ]"]);

            let catParts = STATE.participants.filter(p => p.kategori === cat.name && p.urut > 0);
            let unikPools = [...new Set(catParts.map(p => p.pool))].sort();

            if (unikPools.length === 0) {
                rows.push(["Peringkat", "Nama Atlet", "Kontingen", "Wasit 1", "Wasit 2", "Wasit 3", "Wasit 4", "Wasit 5", "Waktu", "Denda", "Nilai Akhir"]);
                rows.push(["-", "Belum ada peserta diundi / dimainkan", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
            } else {
                let adaPemenang = false;
                unikPools.forEach(poolKey => {
                    let poolParts = catParts.filter(p => p.pool === poolKey && p.scores.b1.final > 0);
                    if (poolParts.length > 0) {
                        adaPemenang = true;

                        rows.push([`--- KELOMPOK ${poolKey} ---`, "", "", "", "", "", "", "", "", "", ""]);
                        rows.push(["Peringkat", "Nama Atlet", "Kontingen", "Wasit 1", "Wasit 2", "Wasit 3", "Wasit 4", "Wasit 5", "Waktu", "Denda", "Nilai Akhir"]);

                        poolParts.sort((a, b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
                        poolParts.forEach((p, i) => {
                            let s = p.scores.b1;
                            let rank = (i === 0) ? "1" : (i === 1) ? "2" : (i === 2 || i === 3) ? "3" : String(i + 1);
                            let w = s.raw || [];
                            let waktuFmt = `${Math.floor((s.time || 0) / 60).toString().padStart(2, '0')}:${((s.time || 0) % 60).toString().padStart(2, '0')}`;
                            let finalScore = s.final.toFixed(2).replace('.', ',');

                            // --- PECAH BARIS BERSIH ---
                            let names = String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n);
                            if (names.length === 0) names = ["-"];
                            names.forEach((n, idx) => {
                                if (idx === 0) rows.push([rank, n, p.kontingen, String(w[0] || '-').replace('.', ','), String(w[1] || '-').replace('.', ','), String(w[2] || '-').replace('.', ','), String(w[3] || '-').replace('.', ','), String(w[4] || '-').replace('.', ','), waktuFmt, s.penalty || 0, finalScore]);
                                else rows.push(["", n, "", "", "", "", "", "", "", "", ""]);
                            });
                        });
                    }
                });
                if (!adaPemenang) {
                    rows.push(["Peringkat", "Nama Atlet", "Kontingen", "Wasit 1", "Wasit 2", "Wasit 3", "Wasit 4", "Wasit 5", "Waktu", "Denda", "Nilai Akhir"]);
                    rows.push(["-", "Belum ada nilai tersimpan", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
                }
            }
            rows.push([]); rows.push([]);

        } else {
            rows.push([]);
            rows.push(["Peringkat", "Nama Atlet", "Kontingen", "Keterangan"]);

            let catMatches = STATE.matches.filter(m => m.kategori === cat.name);
            let hasPools = catMatches.some(m => m.pool === 'A' || m.pool === 'B');
            let isFinalCat = cat.name.toUpperCase().includes('FINAL');

            if (hasPools && !isFinalCat) {
                rows.push(["-", "Sistem Pool. Hasil akhir berada di kategori FINAL.", "-", "-"]);
            } else {
                rows.push([]);
                rows.push(["Peringkat", "Nama Atlet", "Kontingen", "Keterangan"]);

                let catMatches = STATE.matches.filter(m => m.kategori === cat.name);
                let hasPools = catMatches.some(m => m.pool === 'A' || m.pool === 'B');
                let isFinalCat = cat.name.toUpperCase().includes('FINAL');

                if (hasPools && !isFinalCat) {
                    rows.push(["-", "Sistem Pool. Hasil akhir berada di kategori FINAL.", "-", "-"]);
                } else {
                    let poolResults = calculateRandoriFinalists(cat.name);
                    let foundFinalResult = false;

                    if (poolResults) {
                        poolResults.forEach(res => {
                            let isSinglePool = res.pool === '-';
                            if (isFinalCat || isSinglePool) {
                                foundFinalResult = true;
                                let label1 = isFinalCat || isSinglePool ? "Juara 1" : `Juara 1 Pool ${res.pool}`;
                                let label2 = isFinalCat || isSinglePool ? "Juara 2" : `Runner-Up Pool ${res.pool}`;

                                // --- FIX TEKS LABEL DINAMIS CSV RAW ---
                                let baseLabel3 = res.perunggu.length > 1 ? "Juara 3 Bersama" : "Juara 3";
                                let label3 = isFinalCat || isSinglePool ? baseLabel3 : `${baseLabel3} Pool ${res.pool}`;

                                if (res.emas) {
                                    String(res.emas).split(/[,+&]/).map(n => n.trim()).filter(n => n).forEach((n, idx) => {
                                        if (idx === 0) rows.push(["1", n, res.emasKontingen, label1]); else rows.push(["", n, "", ""]);
                                    });
                                }
                                if (res.perak) {
                                    String(res.perak).split(/[,+&]/).map(n => n.trim()).filter(n => n).forEach((n, idx) => {
                                        if (idx === 0) rows.push(["2", n, res.perakKontingen, label2]); else rows.push(["", n, "", ""]);
                                    });
                                }
                                res.perunggu.forEach(p => {
                                    String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n).forEach((n, idx) => {
                                        if (idx === 0) rows.push(["3", n, p.kontingen, label3]); else rows.push(["", n, "", ""]);
                                    });
                                });
                            }
                        });
                    } else {
                        rows.push(["-", "Belum ada juara / Turnamen masih berjalan", "-", "-"]);
                    }
                }
                rows.push([]); rows.push([]);
            }
        }
    });

    let prefix = filterCatName ? `RAW_Nilai_${filterCatName.replace(/[^a-zA-Z0-9]/g, '_')}` : `Semua_RAW_Nilai`;
    downloadCSV(`${prefix}_${new Date().toISOString().slice(0, 10)}.csv`, rows);
}

// =========================================================
// MESIN EKSPOR 2: REKAPITULASI (SUPER EXCELJS PRINT-READY)
// =========================================================
async function exportRekapJuaraCSV(filterCatName = null) {
    if (typeof ExcelJS === 'undefined') {
        return alert("Library ExcelJS belum termuat. Pastikan koneksi internet aktif untuk memuat library pembuat Excel.");
    }

    try {
        document.body.style.cursor = 'wait';

        let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;
        if (categoriesToExport.length === 0) throw new Error("Tidak ada data kategori.");

        // Inisiasi Workbook baru
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet("Rekap Pemenang", {
            pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
        });

        // 🌟 KUNCI PROPORSIONAL: Atur Lebar Kolom Di Sini 🌟
        sheet.getColumn(1).width = 12; // Peringkat
        sheet.getColumn(2).width = 45; // Nama Atlet (Sangat Lebar)
        sheet.getColumn(3).width = 30; // Kontingen (Lebar)
        sheet.getColumn(4).width = 25; // Nilai Akhir / Keterangan Randori

        // Deklarasi Gaya (*Styles*) untuk mempercantik sel
        const borderAll = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        const titleStyle = { font: { name: 'Arial', size: 14, bold: true }, alignment: { horizontal: 'center' } };
        const subtitleStyle = { font: { name: 'Arial', size: 10, italic: true }, alignment: { horizontal: 'center' } };

        const headerCatStyle = {
            font: { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }, // Biru Gelap
            alignment: { horizontal: 'left', vertical: 'middle' }
        };
        const tableHeaderStyle = {
            font: { name: 'Arial', size: 10, bold: true },
            fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } }, // Abu-abu terang
            alignment: { horizontal: 'center', vertical: 'middle' },
            border: borderAll
        };

        // 1. TULIS KOP SURAT / HEADER DOKUMEN
        sheet.mergeCells('A1:D1');
        sheet.getCell('A1').value = "REKAPITULASI PEMENANG - MASS KEMPO";
        sheet.getCell('A1').style = titleStyle;

        sheet.mergeCells('A2:D2');
        sheet.getCell('A2').value = `Dicetak pada: ${new Date().toLocaleString('id-ID')}`;
        sheet.getCell('A2').style = subtitleStyle;

        let currentRow = 4;

        // 2. LOOPING SETIAP KATEGORI
        categoriesToExport.forEach(cat => {
            // Header Baris Kategori (Warna Biru Gelap Panjang)
            sheet.mergeCells(`A${currentRow}:D${currentRow}`);
            let catCell = sheet.getCell(`A${currentRow}`);
            catCell.value = `KATEGORI: ${cat.name.toUpperCase()} (${cat.discipline.toUpperCase()})`;
            catCell.style = headerCatStyle;
            currentRow++;

            // --- JIKA DISIPLIN EMBU ---
            if (cat.discipline === 'embu') {
                ['Peringkat', 'Nama Atlet', 'Kontingen', 'Nilai Akhir'].forEach((text, i) => {
                    let cell = sheet.getCell(currentRow, i + 1);
                    cell.value = text; cell.style = tableHeaderStyle;
                });
                currentRow++;

                let catParts = STATE.participants.filter(p => p.kategori === cat.name);
                let hasFinalists = catParts.some(p => p.isFinalist);
                let targetParts = [];

                if (hasFinalists) targetParts = catParts.filter(p => p.isFinalist);
                else if (catParts.some(p => p.pool === 'SINGLE' || p.pool === '-')) targetParts = catParts.filter(p => (p.pool === 'SINGLE' || p.pool === '-') && p.urut > 0);

                if (targetParts.length > 0) {
                    targetParts.forEach(p => {
                        let s1 = p.scores.b1.final || 0; let s2 = p.scores.b2.final || 0;
                        p.calcFinal = hasFinalists ? s2 : ((s1 > 0 && s2 > 0) ? ((s1 + s2) / 2) : (s1 > 0 ? s1 : s2));
                        let t1 = p.scores.b1.tech || 0; let t2 = p.scores.b2.tech || 0;
                        p.calcTech = hasFinalists ? t2 : ((s1 > 0 && s2 > 0) ? ((t1 + t2) / 2) : (s1 > 0 ? t1 : t2));
                    });
                    targetParts.sort((a, b) => b.calcFinal - a.calcFinal || b.calcTech - a.calcTech);

                    targetParts.forEach((p, i) => {
                        let isWaiting = p.calcFinal === 0;
                        if (hasFinalists && (p.scores.b2.final || 0) === 0) isWaiting = true;

                        let rank = !isWaiting ? i + 1 : "-";
                        let nilaiAkhir = !isWaiting ? parseFloat(p.calcFinal.toFixed(2)) : "Menunggu";

                        let names = String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n);
                        if (names.length === 0) names = ["-"];
                        names.forEach((n, idx) => {
                            sheet.getCell(currentRow, 1).value = (idx === 0) ? rank : "";
                            sheet.getCell(currentRow, 2).value = n;
                            sheet.getCell(currentRow, 3).value = (idx === 0) ? p.kontingen : "";
                            sheet.getCell(currentRow, 4).value = (idx === 0) ? nilaiAkhir : "";

                            // Suntikkan Garis Tabel (Border)
                            [1, 2, 3, 4].forEach(colIdx => {
                                let c = sheet.getCell(currentRow, colIdx);
                                c.border = borderAll;
                                c.alignment = { vertical: 'middle', horizontal: (colIdx === 2 || colIdx === 3) ? 'left' : 'center' };
                            });
                            currentRow++;
                        });
                    });
                } else {
                    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
                    let cell = sheet.getCell(`A${currentRow}`);
                    cell.value = "Peserta Final belum ditetapkan / belum diundi";
                    cell.border = borderAll; cell.alignment = { horizontal: 'center' };
                    currentRow++;
                }
            }
            // --- JIKA DISIPLIN FESTIVAL ---
            else if (cat.discipline === 'festival') {
                let catParts = STATE.participants.filter(p => p.kategori === cat.name && p.urut > 0);
                let unikPools = [...new Set(catParts.map(p => p.pool))].sort();

                if (unikPools.length === 0) {
                    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
                    let cell = sheet.getCell(`A${currentRow}`);
                    cell.value = "Belum ada peserta diundi / dimainkan";
                    cell.border = borderAll; cell.alignment = { horizontal: 'center' };
                    currentRow++;
                } else {
                    let adaPemenang = false;
                    unikPools.forEach(poolKey => {
                        let poolParts = catParts.filter(p => p.pool === poolKey && p.scores.b1.final > 0);
                        if (poolParts.length === 0) return;
                        adaPemenang = true;

                        // Sub-Header Kelompok (Tanpa Garis Tebal)
                        sheet.mergeCells(`A${currentRow}:D${currentRow}`);
                        let subCell = sheet.getCell(`A${currentRow}`);
                        subCell.value = `--- KELOMPOK ${poolKey} ---`;
                        subCell.font = { bold: true }; subCell.alignment = { horizontal: 'center' };
                        currentRow++;

                        ['Peringkat', 'Nama Atlet', 'Kontingen', 'Nilai Akhir'].forEach((text, i) => {
                            let cell = sheet.getCell(currentRow, i + 1);
                            cell.value = text; cell.style = tableHeaderStyle;
                        });
                        currentRow++;

                        poolParts.sort((a, b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
                        poolParts.forEach((p, i) => {
                            let rank = (i === 0) ? 1 : (i === 1) ? 2 : (i === 2 || i === 3) ? 3 : (i + 1);
                            let nilaiAkhir = parseFloat(p.scores.b1.final.toFixed(2));

                            // 🌟 PEMBERSIH KONTINGEN KHUSUS FESTIVAL 🌟
                            // Menghapus paksa akhiran rongsokan seperti (A), (H), (I), (1) di ujung nama kontingen
                            let cleanKontingen = p.kontingen.replace(/\s*\(([a-zA-Z]|[IVX]{1,3}|\d{1,2})\)$/i, '').trim();

                            let names = String(p.nama).split(/[,+&]/).map(n => n.trim()).filter(n => n);
                            if (names.length === 0) names = ["-"];
                            names.forEach((n, idx) => {
                                sheet.getCell(currentRow, 1).value = (idx === 0) ? rank : "";
                                sheet.getCell(currentRow, 2).value = n;
                                // 🌟 Gunakan Variabel Kontingen yang Sudah Dicuci Bersih 🌟
                                sheet.getCell(currentRow, 3).value = (idx === 0) ? cleanKontingen : "";
                                sheet.getCell(currentRow, 4).value = (idx === 0) ? nilaiAkhir : "";

                                [1, 2, 3, 4].forEach(colIdx => {
                                    let c = sheet.getCell(currentRow, colIdx);
                                    c.border = borderAll;
                                    c.alignment = { vertical: 'middle', horizontal: (colIdx === 2 || colIdx === 3) ? 'left' : 'center' };
                                });
                                currentRow++;
                            });
                        });
                    });
                    if (!adaPemenang) {
                        sheet.mergeCells(`A${currentRow}:D${currentRow}`);
                        let cell = sheet.getCell(`A${currentRow}`);
                        cell.value = "Belum ada nilai tersimpan";
                        cell.border = borderAll; cell.alignment = { horizontal: 'center' };
                        currentRow++;
                    }
                }
            }
            // --- JIKA DISIPLIN RANDORI (TANPA KOLOM NILAI) ---
            else {
                // Header Tabel khusus Randori
                ['Peringkat', 'Nama Atlet', 'Kontingen', 'Keterangan'].forEach((text, i) => {
                    let cell = sheet.getCell(currentRow, i + 1);
                    cell.value = text; cell.style = tableHeaderStyle;
                });
                currentRow++;

                let catMatches = STATE.matches.filter(m => m.kategori === cat.name);
                let hasPools = catMatches.some(m => m.pool === 'A' || m.pool === 'B');
                let isFinalCat = cat.name.toUpperCase().includes('FINAL');

                if (hasPools && !isFinalCat) {
                    sheet.mergeCells(`A${currentRow}:D${currentRow}`);
                    let cell = sheet.getCell(`A${currentRow}`);
                    cell.value = "Turnamen sistem Pool. Lihat kategori 'FINAL' untuk rekap juara akhir.";
                    cell.border = borderAll; cell.alignment = { horizontal: 'center' };
                    currentRow++;
                } else {
                    let poolResults = calculateRandoriFinalists(cat.name);
                    let foundFinalResult = false;

                    if (poolResults) {
                        poolResults.forEach(res => {
                            let isSinglePool = res.pool === '-';
                            if (isFinalCat || isSinglePool) {
                                foundFinalResult = true;
                                let label1 = isFinalCat || isSinglePool ? "Juara 1" : `Juara 1 Pool ${res.pool}`;
                                let label2 = isFinalCat || isSinglePool ? "Juara 2" : `Runner-Up Pool ${res.pool}`;
                                let baseLabel3 = res.perunggu.length > 1 ? "Juara 3 Bersama" : "Juara 3";
                                let label3 = isFinalCat || isSinglePool ? baseLabel3 : `${baseLabel3} Pool ${res.pool}`;

                                // Fungsi Cetak Baris Randori Internal
                                const printRandoriRow = (rank, rawName, kontingen, ket) => {
                                    if (!rawName) return;
                                    String(rawName).split(/[,+&]/).map(n => n.trim()).filter(n => n).forEach((n, idx) => {
                                        sheet.getCell(currentRow, 1).value = (idx === 0) ? rank : "";
                                        sheet.getCell(currentRow, 2).value = n;
                                        sheet.getCell(currentRow, 3).value = (idx === 0) ? kontingen : "";
                                        sheet.getCell(currentRow, 4).value = (idx === 0) ? ket : ""; // Memasukkan Status Medali

                                        [1, 2, 3, 4].forEach(colIdx => {
                                            let c = sheet.getCell(currentRow, colIdx);
                                            c.border = borderAll;
                                            c.alignment = { vertical: 'middle', horizontal: (colIdx === 2 || colIdx === 3 || colIdx === 4) ? 'left' : 'center' };
                                        });
                                        currentRow++;
                                    });
                                };

                                printRandoriRow(1, res.emas, res.emasKontingen, label1);
                                printRandoriRow(2, res.perak, res.perakKontingen, label2);
                                res.perunggu.forEach(p => printRandoriRow(3, p.nama, p.kontingen, label3));
                            }
                        });
                    }
                    if (!foundFinalResult) {
                        sheet.mergeCells(`A${currentRow}:D${currentRow}`);
                        let cell = sheet.getCell(`A${currentRow}`);
                        cell.value = "Belum ada pemenang / Menunggu pertandingan selesai";
                        cell.border = borderAll; cell.alignment = { horizontal: 'center' };
                        currentRow++;
                    }
                }
            }

            // Jarak Spasi antar tabel kategori 
            currentRow += 2;
        });

        // 3. COMPILE DAN PAKSA UNDUH SEBAGAI EXCEL
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");

        let prefix = filterCatName ? `Rekap_Juara_${filterCatName.replace(/[^a-zA-Z0-9]/g, '_')}` : `Rekapitulasi_Pemenang`;
        a.download = `${prefix}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.href = url;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        document.body.style.cursor = 'default';

    } catch (err) {
        document.body.style.cursor = 'default';
        console.error(err);
        alert("Gagal mencetak Rekap Excel: " + err.message);
    }
}

function exportMedaliCSV() {
    let tally = {};
    const minPeserta = (STATE.settings && STATE.settings.minPesertaJuara) ? parseInt(STATE.settings.minPesertaJuara) : 1;

    STATE.categories.forEach(cat => {
        let catParts = STATE.participants.filter(p => p.kategori === cat.name);
        const isFinalCategory = cat.name.toUpperCase().includes('FINAL');

        let baseName = cat.name.replace(/FINAL/ig, '').trim().toLowerCase();
        let relatedParticipants = STATE.participants.filter(p => p.kategori.replace(/FINAL/ig, '').trim().toLowerCase() === baseName);
        let uniqueAthletes = new Set(relatedParticipants.map(p => p.nama.toLowerCase().trim()));
        let trueParticipantCount = uniqueAthletes.size;

        if (trueParticipantCount < minPeserta) return;

        if (cat.discipline === 'embu') {
            let hasFinalists = catParts.some(p => p.isFinalist);
            let targetParts = [];

            if (hasFinalists) {
                targetParts = catParts.filter(p => p.isFinalist && p.scores.b2.final > 0);
                targetParts.forEach(p => { p.calcFinal = p.scores.b2.final; p.calcTech = p.scores.b2.tech; });
            } else if (catParts.some(p => p.pool === 'SINGLE' || p.pool === '-')) {
                targetParts = catParts.filter(p => (p.pool === 'SINGLE' || p.pool === '-') && p.urut > 0);
                targetParts.forEach(p => {
                    let s1 = p.scores.b1.final || 0; let s2 = p.scores.b2.final || 0;
                    p.calcFinal = (s1 > 0 && s2 > 0) ? ((s1 + s2) / 2) : (s1 > 0 ? s1 : s2);
                    let t1 = p.scores.b1.tech || 0; let t2 = p.scores.b2.tech || 0;
                    p.calcTech = (s1 > 0 && s2 > 0) ? ((t1 + t2) / 2) : (s1 > 0 ? t1 : t2);
                });
            }

            let wins = targetParts.filter(p => p.calcFinal > 0).sort((a, b) => b.calcFinal - a.calcFinal || b.calcTech - a.calcTech);
            if (wins[0] && wins[0].kontingen) { tally[wins[0].kontingen] = tally[wins[0].kontingen] || { g: 0, s: 0, b: 0 }; tally[wins[0].kontingen].g++; }
            if (wins[1] && wins[1].kontingen) { tally[wins[1].kontingen] = tally[wins[1].kontingen] || { g: 0, s: 0, b: 0 }; tally[wins[1].kontingen].s++; }
            if (wins[2] && wins[2].kontingen) { tally[wins[2].kontingen] = tally[wins[2].kontingen] || { g: 0, s: 0, b: 0 }; tally[wins[2].kontingen].b++; }
        } else {
            const hasPools = catParts.some(p => p.pool === 'A' || p.pool === 'B');
            if (hasPools && !isFinalCategory) return;

            const poolResults = calculateRandoriFinalists(cat.name);
            if (!poolResults) return;

            poolResults.forEach(res => {
                if (res.emasKontingen) { tally[res.emasKontingen] = tally[res.emasKontingen] || { g: 0, s: 0, b: 0 }; tally[res.emasKontingen].g++; }
                if (res.perakKontingen) { tally[res.perakKontingen] = tally[res.perakKontingen] || { g: 0, s: 0, b: 0 }; tally[res.perakKontingen].s++; }
                res.perunggu.forEach(p => {
                    if (p.kontingen) { tally[p.kontingen] = tally[p.kontingen] || { g: 0, s: 0, b: 0 }; tally[p.kontingen].b++; }
                });
            });
        }
    });

    let leaderboard = Object.keys(tally).map(kontingen => ({ nama: kontingen, emas: tally[kontingen].g, perak: tally[kontingen].s, perunggu: tally[kontingen].b, total: tally[kontingen].g + tally[kontingen].s + tally[kontingen].b }));
    leaderboard.sort((a, b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu);

    let rows = [["Peringkat", "Kontingen", "Emas", "Perak", "Perunggu", "Total Medali"]];
    leaderboard.forEach((k, i) => { rows.push([i + 1, k.nama, k.emas, k.perak, k.perunggu, k.total]); });
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.map(cell => `"${cell}"`).join(";")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Klasemen_Medali_Juara_Umum_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
}

function exportCustomCSV() { exportHasilCSV(null); } // Legacy fallback

// =========================================================
// FITUR ZONA BERBAHAYA (DIPISAH: NILAI & DRAWING)
// =========================================================

function resetSemuaNilai() {
    if (confirm('⚠️ HAPUS NILAI SAJA?\n\nIni akan mengosongkan SELURUH SKOR di semua kategori.\nBagan Randori dan Drawing Embu TIDAK AKAN DIHAPUS (Hanya dikembalikan ke ronde pertama).\n\nLanjutkan?')) {

        // 1. Bersihkan nilai di memori atlet, tapi biarkan urut & pool utuh
        STATE.participants.forEach(p => {
            p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } };
            p.finalScore = 0; p.techScore = 0; p.losses = 0;
        });

        // 2. Kembalikan bagan Randori ke status awal (Hapus pemenang & skor partai)
        STATE.matches = STATE.matches.filter(m => m.babak !== "SUDDEN DEATH"); // Sapu bersih partai dadakan
        STATE.matches.forEach(m => {
            if (m.col > 1) { m.merahId = null; m.putihId = null; } // Kosongkan atlet di babak lanjutan
            m.status = 'pending'; m.winnerId = null; m.loserId = null; m.skorMerah = 0; m.skorPutih = 0;
        });

        // Tembakkan ke Firebase
        let updates = {};
        updates['turnamen_data/participants'] = STATE.participants;
        updates['turnamen_data/matches'] = STATE.matches;

        database.ref().update(updates).then(() => {
            // Evaluasi ulang Auto-Win (BYE) karena bagan di-reset
            const randoriCats = [...new Set(STATE.matches.map(m => m.kategori))];
            randoriCats.forEach(catName => processAutoWins(catName));

            // Simpan state Auto-Win ke server lagi
            database.ref('turnamen_data/matches').set(STATE.matches);

            alert('✅ Berhasil: Semua Nilai telah dikosongkan. Bagan & Drawing tetap utuh!');
        }).catch(err => alert("Gagal Reset Nilai: " + err));
    }
}

function resetSemuaDrawing() {
    if (confirm('🚨 HAPUS DRAWING & BAGAN?\n\nIni akan mereset nomor undian seluruh atlet ke "Belum Diundi" dan MENGHAPUS SEMUA BAGAN RANDORI secara permanen.\n(Seluruh nilai juga otomatis terhapus).\n\nYakin ingin menghancurkan drawing?')) {

        // 1. Bersihkan nilai DAN reset seluruh atribut drawing
        STATE.participants.forEach(p => {
            p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } };
            p.finalScore = 0; p.techScore = 0; p.losses = 0;

            // RESET ATRIBUT DRAWING
            p.urut = 0;
            p.urutB2 = 0;
            p.pool = '-';
            p.isFinalist = false;
            p.urutFinal = 0;
        });

        // 2. Bakar seluruh data kerangka bagan
        STATE.matches = [];

        // Tembakkan perintah hapus spesifik ke Firebase
        let updates = {};
        updates['turnamen_data/participants'] = STATE.participants;
        updates['turnamen_data/matches'] = null; // 'null' di Firebase berarti HAPUS NODE SECARA PERMANEN

        database.ref().update(updates).then(() => {
            alert('✅ Berhasil: Semua Drawing, Bagan, dan Nilai telah dihancurkan ke status awal!');
        }).catch(err => alert("Gagal Reset Drawing: " + err));
    }
}

function resetDataAtlet() {
    if (confirm('⚠️ PERHATIAN: Ini MENGHAPUS SEMUA ATLET & BAGAN di seluruh jaringan. Yakin?')) {
        STATE.participants = [];
        STATE.matches = [];

        let updates = {};
        updates['turnamen_data/participants'] = null;
        updates['turnamen_data/matches'] = null;

        database.ref().update(updates).then(() => {
            alert('✅ Berhasil: Data Atlet dan Bagan telah dihapus dari server!');
        }).catch(err => alert("Gagal Hapus Atlet: " + err));
    }
}

function resetTotalSistem() {
    if (confirm('🚨 FACTORY RESET: Anda yakin ingin menghapus seluruh sistem (Kategori, Atlet, Nilai) secara permanen dari server?')) {

        // Tembak langsung ke inti Root Firebase (Wipe Out)
        // Kita hanya menyisakan kerangka kosong dan setting default
        database.ref('turnamen_data').set({
            settings: { numJudges: 5, minPesertaJuara: 1 }
        }).then(() => {
            alert('🔥 Kiamat selesai. Sistem kembali ke pengaturan pabrik.');
            location.reload();
        }).catch(err => alert("Gagal Factory Reset: " + err));
    }
}

// =========================================================
// FITUR BACKUP & RESTORE DATABASE (JSON)
// =========================================================

function backupDatabase() {
    // 1. Kumpulkan semua data STATE saat ini
    const dataToBackup = {
        categories: STATE.categories,
        participants: STATE.participants,
        matches: STATE.matches,
        settings: STATE.settings,
        backupDate: new Date().toISOString() // Catat waktu backup
    };

    // 2. Ubah jadi file JSON dan download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(dataToBackup, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `Backup_MASS_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function restoreDatabase(event) {
    const file = event.target.files[0];
    if (!file) return;

    // 1. Peringatan keras sebelum menimpa data server
    if (!confirm("⚠️ PERINGATAN KRITIS!\n\nMere-store data akan MENGHAPUS & MENIMPA seluruh data turnamen online saat ini dengan data dari file.\n\nApakah Anda sangat yakin ingin melanjutkan?")) {
        event.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            // 2. Baca isi file JSON
            const importedData = JSON.parse(e.target.result);

            // 3. Validasi keamanan sederhana
            if (!importedData.categories && !importedData.participants) {
                throw new Error("Format file JSON tidak valid atau bukan file backup MASS.");
            }

            // 4. Tembakkan langsung ke Firebase Database!
            // (Tidak perlu saveToLocalStorage karena listener Firebase akan otomatis 
            // menarik data ini dan merefresh layar di SEMUA laptop panitia secara instan)
            database.ref('turnamen_data').set({
                categories: importedData.categories || [],
                participants: importedData.participants || [],
                matches: importedData.matches || [],
                settings: importedData.settings || { numJudges: 5, minPesertaJuara: 1 }
            }).then(() => {
                alert("✅ RESTORE BERHASIL!\nData turnamen telah dipulihkan dan disinkronkan ke seluruh jaringan.");
            }).catch(err => {
                alert("❌ GAGAL RESTORE ke Server: " + err.message);
            });

        } catch (error) {
            alert("❌ GAGAL MEMBACA FILE:\n" + error.message);
        } finally {
            event.target.value = ''; // Reset input
        }
    };
    reader.readAsText(file);
}
// ==========================================
// FITUR KLIK-UNTUK-TUKAR URUTAN EMBU
// ==========================================
function handleEmbuSwap(participantId, poolType) {
    const catName = document.getElementById('draw-select-kategori').value;
    if (!catName) return;

    // 1. Jika belum ada yang diklik sebelumnya
    if (!EMBU_SWAP_SELECTION) {
        EMBU_SWAP_SELECTION = { id: participantId, type: poolType };
        checkExistingDrawing();
        return;
    }

    // 2. Batal jika mengklik orang yang persis sama
    if (EMBU_SWAP_SELECTION.id === participantId && EMBU_SWAP_SELECTION.type === poolType) {
        EMBU_SWAP_SELECTION = null;
        checkExistingDrawing();
        return;
    }

    // 3. Mencegah error jika klik menyilang (B1 disilang ke B2)
    if (EMBU_SWAP_SELECTION.type !== poolType) {
        EMBU_SWAP_SELECTION = { id: participantId, type: poolType };
        checkExistingDrawing();
        return;
    }

    // 4. TEMUKAN INDEX ATLET UNTUK UPDATE GRANULAR
    let p1Index = STATE.participants.findIndex(p => p.id === EMBU_SWAP_SELECTION.id);
    let p2Index = STATE.participants.findIndex(p => p.id === participantId);

    if (p1Index > -1 && p2Index > -1) {
        let p1 = STATE.participants[p1Index];
        let p2 = STATE.participants[p2Index];

        // Tukar Urutan
        if (poolType === 'b1') {
            let tempUrut = p1.urut; p1.urut = p2.urut; p2.urut = tempUrut;
            let tempPool = p1.pool; p1.pool = p2.pool; p2.pool = tempPool;
        } else if (poolType === 'b2') {
            let tempUrutB2 = p1.urutB2; p1.urutB2 = p2.urutB2; p2.urutB2 = tempUrutB2;
        } else if (poolType === 'final') {
            let tempUrutFinal = p1.urutFinal; p1.urutFinal = p2.urutFinal; p2.urutFinal = tempUrutFinal;
        }

        // 5. BERSIHKAN MEMORI SEKARANG JUGA (Agar seleksi langsung hilang)
        EMBU_SWAP_SELECTION = null;

        // 6. UPDATE LAYAR LOKAL SECARA INSTAN (Tanpa menunggu balasan server)
        checkExistingDrawing();
        if (typeof filterPesertaScoring === 'function') filterPesertaScoring();

        // 7. TEMBAKAN SNIPER KE FIREBASE (Hanya update 2 atlet ini secara diam-diam di background)
        let updates = {};
        updates[`turnamen_data/participants/${p1Index}`] = p1;
        updates[`turnamen_data/participants/${p2Index}`] = p2;

        database.ref().update(updates).catch(err => console.error("Gagal menukar di server: " + err));

    } else {
        EMBU_SWAP_SELECTION = null;
        checkExistingDrawing();
    }
}
// =========================================================
// SISTEM TOGGLE BROADCAST TV (MARATON TV LIVE)
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
    let roleSelect = document.getElementById('setting-device-role');
    if (roleSelect) roleSelect.value = DEVICE_ROLE;
    if (typeof updateBroadcastUI === "function") updateBroadcastUI();
});

function changeDeviceRole() {
    DEVICE_ROLE = document.getElementById('setting-device-role').value;
    localStorage.setItem('mass_device_role', DEVICE_ROLE);
    updateBroadcastUI();
    alert(`Perangkat diubah menjadi: ${DEVICE_ROLE.replace('_', ' ').toUpperCase()}`);
}

function toggleBroadcast() {
    if (DEVICE_ROLE === 'admin') return alert('Ubah peran ke Tatami/Court di Tab Admin terlebih dahulu!');

    const val = document.getElementById('select-peserta').value;
    if (!val) return alert('Pilih pertandingan/atlet terlebih dahulu!');

    IS_TV_LIVE = !IS_TV_LIVE;
    updateBroadcastUI();

    if (IS_TV_LIVE) {
        if (val.startsWith('match-')) {
            pushRandoriToTV();
        } else {
            const [pIdStr, babak] = val.split('|');
            const p = STATE.participants.find(x => x.id === parseInt(pIdStr));
            if (p) {
                let displayNama = p.nama.split(/[,+&]/).map(n => n.trim()).join(" & ");
                // FIX: Paksa hapus Randori dengan type: 'embu'
                database.ref(`live_broadcast/${DEVICE_ROLE}`).set({
                    type: 'embu',
                    current_action: 'preview',
                    preview_data: { kategori: p.kategori, nama: displayNama, kontingen: p.kontingen }
                });
            }
        }
    } else {
        database.ref(`live_broadcast/${DEVICE_ROLE}`).set({ current_action: 'idle' });
    }
}

function updateBroadcastUI() {
    const btnOpenTV = document.getElementById('btn-open-tv');
    const btn = document.getElementById('btn-broadcast-toggle');
    const icon = document.getElementById('icon-broadcast');
    const text = document.getElementById('text-broadcast');

    if (DEVICE_ROLE !== 'admin') {
        if (btnOpenTV) { btnOpenTV.classList.remove('hidden'); btnOpenTV.href = `display.html?court=${DEVICE_ROLE}`; }
        if (btn) { btn.classList.remove('hidden'); btn.style.display = 'flex'; }
    } else {
        if (btnOpenTV) btnOpenTV.classList.add('hidden');
        if (btn) { btn.classList.add('hidden'); btn.style.display = 'none'; }
        return;
    }

    if (!btn || !icon || !text) return;

    if (IS_TV_LIVE) {
        btn.className = "w-full mt-3 bg-red-900/40 hover:bg-red-800 border border-red-500 text-red-400 font-bold py-2.5 px-4 rounded-lg shadow-[0_0_15px_rgba(220,38,38,0.4)] text-xs transition-all flex items-center justify-center gap-2 tracking-widest";
        icon.className = "fas fa-tv animate-pulse text-sm";
        text.innerText = "LIVE DI TV";
    } else {
        btn.className = "w-full mt-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-400 font-bold py-2.5 px-4 rounded-lg shadow-md text-xs transition-all flex items-center justify-center gap-2 tracking-widest";
        icon.className = "fas fa-tv-slash text-sm";
        text.innerText = "TV OFFLINE";
    }
}

function pushRandoriToTV() {
    if (DEVICE_ROLE === 'admin' || !currentRandoriMatchId || !IS_TV_LIVE) return;

    const match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if (!match) return;

    const mrh = STATE.participants.find(p => p.id === match.merahId) || { nama: '-', kontingen: '-' };
    const pth = STATE.participants.find(p => p.id === match.putihId) || { nama: '-', kontingen: '-' };
    let timerFmt = `${Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0')}:${(UI.timerSeconds % 60).toString().padStart(2, '0')}`;

    database.ref(`live_broadcast/${DEVICE_ROLE}`).set({
        type: 'randori',
        kategori: match.kategori,
        waktu: timerFmt,
        merah: { nama: mrh.nama, kontingen: mrh.kontingen, skor: RANDORI_STATE.merah.score },
        putih: { nama: pth.nama, kontingen: pth.kontingen, skor: RANDORI_STATE.putih.score }
    });
}

// =========================================================
// ENGINE EXCELJS: GENERATOR BAGAN RANDORI OTOMATIS (REVISI)
// =========================================================

async function generateBaganExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Pastikan library ExcelJS sudah dimuat
    if (typeof ExcelJS === 'undefined') {
        alert("Library ExcelJS belum termuat. Periksa koneksi internet Anda.");
        return;
    }

    try {
        // Notifikasi proses berjalan
        document.body.style.cursor = 'wait';
        const notif = document.createElement('div');
        notif.id = 'excel-loading';
        notif.className = 'fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white font-bold px-6 py-3 rounded-lg shadow-2xl z-[100] animate-bounce';
        notif.innerHTML = '<i class="fas fa-cog fa-spin mr-2"></i>Sedang Merakit File Excel...';
        document.body.appendChild(notif);

        // 1. Muat Workbook Template
        const arrayBuffer = await file.arrayBuffer();
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(arrayBuffer);

        // Cari master template (Toleransi nama huruf besar/kecil)
        const templates = {
            t4: workbook.worksheets.find(s => s.name.toUpperCase().includes('BAGAN 4')),
            t8S: workbook.worksheets.find(s => s.name.toUpperCase().includes('BAGAN 8 (SINGLE)') || s.name.toUpperCase().includes('BAGAN 8(SINGLE)')),
            t8A: workbook.worksheets.find(s => s.name.toUpperCase().includes('BAGAN 8 (A)') || s.name.toUpperCase().includes('BAGAN 8(A)')),
            t8B: workbook.worksheets.find(s => s.name.toUpperCase().includes('BAGAN 8 (B)') || s.name.toUpperCase().includes('BAGAN 8(B)'))
        };

        if (!templates.t4 || !templates.t8S || !templates.t8A || !templates.t8B) {
            alert("⚠️ GAGAL!\nFile Excel Anda tidak memiliki nama sheet template yang lengkap.\nPastikan ada sheet:\n- BAGAN 4\n- BAGAN 8 (SINGLE)\n- BAGAN 8 (A)\n- BAGAN 8 (B)");
            throw new Error("Template tidak lengkap");
        }

        // 2. Filter hanya kategori Randori
        const randoriCats = STATE.categories.filter(c => c.discipline === 'randori');

        if (randoriCats.length === 0) {
            alert("Belum ada data kategori Randori.");
            throw new Error("Data Kosong");
        }

        // 3. Proses Looping per Kategori
        for (const cat of randoriCats) {
            // SAMA PERSIS DENGAN exportDrawingCSV: Sortir mutlak berdasarkan matchNum
            let catMatches = STATE.matches.filter(m => m.kategori === cat.name).sort((a, b) => a.matchNum - b.matchNum);
            if (catMatches.length === 0) continue; // Skip jika belum diundi

            let isFinalCat = cat.name.toUpperCase().includes('FINAL');
            let unikPools = [...new Set(catMatches.map(m => m.pool))];

            // Proses pembuatan Sheet per Pool
            for (const poolName of unikPools) {
                // Hitung total peserta nyata di pool ini untuk penentuan Template
                let pCount = STATE.participants.filter(p => p.kategori === cat.name && (p.pool === poolName || p.pool === '-' || p.pool === 'SINGLE')).length;

                let targetTemplate;

                // LOGIKA CERDAS PEMILIHAN TEMPLATE:
                if (isFinalCat || pCount <= 4) {
                    targetTemplate = templates.t4;
                } else if (pCount > 4 && pCount <= 8) {
                    if (poolName === 'A') targetTemplate = templates.t8A;
                    else if (poolName === 'B') targetTemplate = templates.t8B;
                    else targetTemplate = templates.t8S; // Single Pool
                } else {
                    // Jika > 8, paksa template 8 sesuai rancangan awal
                    if (poolName === 'A') targetTemplate = templates.t8A;
                    else if (poolName === 'B') targetTemplate = templates.t8B;
                    else targetTemplate = templates.t8S;
                }

                // Buat Nama Singkat Aman untuk Sheet (Max 31 Char, Tanpa Karakter Ilegal)
                let shortName = cat.name
                    .replace(/Randori/ig, 'R')
                    .replace(/Putra/ig, 'Pa')
                    .replace(/Putri/ig, 'Pi')
                    .replace(/Kelas/ig, 'Kl')
                    .replace(/Campuran/ig, 'Cmp');

                let poolSuffix = poolName !== '-' ? `_${poolName}` : '';
                let safeSheetName = (shortName + poolSuffix).substring(0, 31).replace(/[:\/\?\*\[\]]/g, '');

                // Hindari duplikasi nama sheet
                let suffixCounter = 1;
                let finalSheetName = safeSheetName;
                while (workbook.getWorksheet(finalSheetName)) {
                    finalSheetName = `${safeSheetName.substring(0, 28)}_${suffixCounter}`;
                    suffixCounter++;
                }

                // --- PROSES KLONING SHEET & FORMAT CETAK (PRINT AREA) ---
                let newSheet = workbook.addWorksheet(finalSheetName);

                // Kloning Lebar Kolom
                targetTemplate.columns.forEach((col, idx) => {
                    let newCol = newSheet.getColumn(idx + 1);
                    if (col.width) newCol.width = col.width;
                    if (col.style) newCol.style = col.style;
                });

                // Kloning Tinggi Baris & Nilai/Warna Sel
                targetTemplate.eachRow({ includeEmpty: true }, (row, rowNum) => {
                    let newRow = newSheet.getRow(rowNum);
                    if (row.height) newRow.height = row.height;
                    row.eachCell({ includeEmpty: true }, (cell, colNum) => {
                        let newCell = newRow.getCell(colNum);
                        newCell.value = cell.value;
                        newCell.style = cell.style;
                    });
                });

                // Kloning Merge Cell
                if (targetTemplate._merges) {
                    Object.values(targetTemplate._merges).forEach(merge => {
                        newSheet.mergeCells(merge.model.top, merge.model.left, merge.model.bottom, merge.model.right);
                    });
                }

                // Kloning Gambar / Kop Surat
                const sheetImages = targetTemplate.getImages();
                if (sheetImages && sheetImages.length > 0) {
                    sheetImages.forEach(img => {
                        newSheet.addImage(img.imageId, img.range);
                    });
                }

                // KLONING PAGE SETUP (Penting untuk Format Cetak / Print Area)
                newSheet.pageSetup = Object.assign({}, targetTemplate.pageSetup);
                if (targetTemplate.views) {
                    newSheet.views = JSON.parse(JSON.stringify(targetTemplate.views));
                }

                // --- INJEKSI DATA KE KOORDINAT SPESIFIK (REVISI ALIGNMENT) ---
                const COL_DISIPLIN = 18; // R
                const COL_KATEGORI = 19; // S
                const COL_POOL = 20; // T
                const COL_PARTAI = 21; // U
                const COL_N_MRH = 22; // V
                const COL_K_MRH = 23; // W
                const COL_S_MRH = 24; // X (Skor Merah - FIXED)
                const COL_N_PTH = 25; // Y (Sudut Putih - FIXED)
                const COL_K_PTH = 26; // Z (Kontingen Putih - FIXED)
                const COL_S_PTH = 27; // AA (Skor Putih - FIXED)
                const COL_STATUS = 28; // AB (Status - FIXED)

                let startRow = 3; // Mulai Baris ke-3 (FIXED)

                // Inject SEMUA partai sekategori agar absolute row sama persis dengan fungsi CSV
                catMatches.forEach((match, idx) => {
                    let mrh = STATE.participants.find(p => p.id === match.merahId);
                    let pth = STATE.participants.find(p => p.id === match.putihId);

                    let nMrh = match.merahId === -1 ? "BYE" : (mrh ? mrh.nama : "Menunggu");
                    let kMrh = match.merahId === -1 ? "-" : (mrh ? mrh.kontingen : "-");
                    let nPth = match.putihId === -1 ? "BYE" : (pth ? pth.nama : "Menunggu");
                    let kPth = match.putihId === -1 ? "-" : (pth ? pth.kontingen : "-");

                    let displayNum = match.matchNum % 50 === 0 ? 50 : match.matchNum % 50;

                    // --- PERBAIKAN COMPOSITE KEY ---
                    let poolCode = match.pool;
                    let isFinalCat = cat.name.toUpperCase().includes('FINAL'); // Deteksi Crossover Final

                    // Kode 'S' hanya untuk Final Crossover atau kelas yang murni Single Pool
                    if (isFinalCat || poolCode === '-' || poolCode === 'SINGLE') {
                        poolCode = 'S';
                    }
                    let compositeKey = `${poolCode}-G-${displayNum}`;
                    // ------------------------------

                    let currentRow = startRow + idx;

                    newSheet.getCell(currentRow, COL_DISIPLIN).value = "RANDORI";
                    newSheet.getCell(currentRow, COL_KATEGORI).value = cat.name;
                    // Kembalikan ke teks Pool / Babak asli yang bisa dibaca panitia
                    newSheet.getCell(currentRow, COL_POOL).value = `${match.pool !== '-' ? 'Pool ' + match.pool : 'Utama'} - ${match.babak}`;
                    // Tembak Composite Key di kolom No. Partai untuk dieksekusi rumus VLOOKUP
                    newSheet.getCell(currentRow, COL_PARTAI).value = compositeKey;
                    newSheet.getCell(currentRow, COL_N_MRH).value = nMrh;
                    newSheet.getCell(currentRow, COL_K_MRH).value = kMrh;
                    newSheet.getCell(currentRow, COL_S_MRH).value = match.skorMerah > 0 ? match.skorMerah : 0;
                    newSheet.getCell(currentRow, COL_N_PTH).value = nPth;
                    newSheet.getCell(currentRow, COL_K_PTH).value = kPth;
                    newSheet.getCell(currentRow, COL_S_PTH).value = match.skorPutih > 0 ? match.skorPutih : 0;
                    newSheet.getCell(currentRow, COL_STATUS).value = match.status === 'done' ? "Selesai" : "";
                });
            }
        }

        // 4. Penghancuran Template Asli agar file bersih
        workbook.removeWorksheet(templates.t4.id);
        workbook.removeWorksheet(templates.t8S.id);
        workbook.removeWorksheet(templates.t8A.id);
        workbook.removeWorksheet(templates.t8B.id);

        // 5. Konversi dan Paksa Unduh
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Bagan_Randori_Lengkap_${new Date().toISOString().slice(0, 10)}.xlsx`;

        document.body.appendChild(a);
        a.click();

        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        // Selesai
        document.body.style.cursor = 'default';
        document.body.removeChild(notif);
        event.target.value = ''; // Reset input agar bisa klik file yang sama lagi

        alert("✅ BERHASIL!\nBagan Excel otomatis berhasil di-generate dan diunduh.");

    } catch (error) {
        document.body.style.cursor = 'default';
        const notif = document.getElementById('excel-loading');
        if (notif) notif.remove();
        event.target.value = '';
        console.error(error);
        alert("Terjadi kesalahan saat memproses Excel: " + error.message);
    }
}

// =========================================================
// MESIN SINKRONISASI DATA PENDAFTARAN (FIRESTORE TO RTDB)
// =========================================================
async function tarikDataPendaftaran() {
    if (!confirm("🚀 TARIK DATA PENDAFTARAN?\n\nSistem akan menyedot data dari server Pendaftaran (Firestore) dan memasukkannya ke dalam MASS KEMPO.\nData yang sudah ada tidak akan diduplikasi.\n\nLanjutkan?")) return;

    try {
        document.body.style.cursor = 'wait';

        // 1. Sedot data dari koleksi 'pendaftaran_t2'
        const snapshot = await firestoreDB.collection('pendaftaran_t2').get();

        let newParticipants = [];
        let addedCategories = new Set();
        let successCount = 0;

        snapshot.forEach(doc => {
            const data = doc.data();
            if (!data.kelas || !data.atlet || !data.kontingen) return; // Skip jika data cacat

            let namaList = [];
            let kyuList = [];
            let umurList = [];

            // 2. Operasi Pemecahan String (NAMA | KYU | TGL)
            data.atlet.forEach(atletStr => {
                let parts = atletStr.split('|').map(s => s.trim());
                if (parts[0]) namaList.push(parts[0]);
                if (parts[1]) kyuList.push(parts[1]);
                if (parts[2]) {
                    let birthYear = new Date(parts[2]).getFullYear();
                    let currentYear = new Date().getFullYear();
                    umurList.push(currentYear - birthYear);
                }
            });

            // 3. Jahit nama menjadi satu baris (Arif & Budi & Candra)
            let combinedName = namaList.join(' & ');
            let combinedKyu = kyuList.length > 0 ? kyuList[0] : ""; // Ambil kyu orang pertama sebagai perwakilan
            let maxUmur = umurList.length > 0 ? Math.max(...umurList) : 0; // Ambil umur tertua

            // --- PIPA NORMALISASI (DATA SANITIZATION) ---
            let catNameRaw = data.kelas;
            let kontingenFinal = data.kontingen;

            // Saringan Regex: Deteksi kurung berisi 1 Huruf, Angka, atau Romawi di UJUNG kalimat
            // Berlaku untuk: " (A)", " (B)", " (I)", " (1)", dll. Kata "(Putra)" akan kebal.
            const suffixRegex = /\s*\(([a-zA-Z]|[IVX]{1,3}|\d{1,2})\)$/i;
            let matchSuffix = catNameRaw.match(suffixRegex);

            let catName = catNameRaw; // Default jika tidak ada ekor

            if (matchSuffix) {
                catName = catNameRaw.replace(suffixRegex, '').trim(); // Potong ekor dari Kategori
                kontingenFinal = `${data.kontingen} (${matchSuffix[1].toUpperCase()})`; // Pindah ekor ke Kontingen
            }
            // --- AKHIR PIPA NORMALISASI ---

            // 4. Auto-Create Kategori (Jika belum ada di MASS KEMPO)
            if (!STATE.categories.some(c => c.name === catName)) {
                let discRaw = catName.toLowerCase();
                let discipline = discRaw.includes('randori') ? 'randori' : (discRaw.includes('festival') ? 'festival' : 'embu');

                STATE.categories.push({
                    id: Date.now() + Math.random(),
                    name: catName,
                    type: namaList.length, // Otomatis deteksi Format (1, 2, atau 3+)
                    discipline: discipline
                });
                addedCategories.add(catName);
            }

            // 5. TEMBAK JITU: Cari berdasarkan idFirestore ATAU pencocokan literal (untuk update data lama)
            let existingIndex = STATE.participants.findIndex(p =>
                (p.idFirestore === doc.id) ||
                (!p.idFirestore && p.nama === combinedName && p.kategori === catName && p.kontingen === kontingenFinal)
            );

            if (existingIndex > -1) {
                // DATA DITEMUKAN: Lakukan Precision Update (Jangan sentuh nilai & bagan!)
                let p = STATE.participants[existingIndex];
                p.idFirestore = doc.id; // Pastikan ID terekam mengikat (hijrah dari literal)
                p.nama = combinedName;  // Timpa jika ada revisi nama/typo dari web pendaftaran
                p.kyu = combinedKyu;    // Timpa revisi kyu
                p.umur = maxUmur;       // Timpa revisi umur
                p.kontingen = kontingenFinal; // Timpa revisi penamaan kontingen (dengan ekor)
            } else {
                // DATA BARU: Masukkan sebagai pendaftar fresh
                newParticipants.push({
                    id: Date.now() + successCount++,
                    idFirestore: doc.id, // <--- REKAM ID FIRESTORE SEBAGAI KUNCI
                    nama: combinedName,
                    kontingen: kontingenFinal, // <--- GUNAKAN KONTINGEN BEREKOR
                    kategori: catName, // <--- GUNAKAN KATEGORI BERSIH
                    kyu: combinedKyu,
                    umur: maxUmur,
                    urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0,
                    scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } },
                    finalScore: 0, techScore: 0
                });
            }
        });

        // 6. Simpan Perubahan ke MASS KEMPO
        // Karena ada Precision Update (edit data tanpa push baru), kita update jika ada dokumen di snapshot
        if (newParticipants.length > 0 || addedCategories.size > 0 || !snapshot.empty) {
            STATE.participants = STATE.participants.concat(newParticipants);

            let updates = {};
            updates['turnamen_data/categories'] = STATE.categories;
            updates['turnamen_data/participants'] = STATE.participants;

            await database.ref().update(updates);
            refreshAllData();

            alert(`✅ SINKRONISASI TEMBAK JITU SUKSES!\n\n- Menarik ${newParticipants.length} Peserta Baru.\n- Memperbarui otomatis jika ada nama/typo yang direvisi.\n- Termasuk ${addedCategories.size} Nomor Kelas baru.`);
        } else {
            alert("Sistem Anda sudah Up-To-Date. Tidak ada data pendaftar sama sekali.");
        }

    } catch (error) {
        console.error("Gagal Tarik Data:", error);
        alert("Terjadi kesalahan saat menyedot data: " + error.message);
    } finally {
        document.body.style.cursor = 'default';
    }
}

// =========================================================
// MESIN KECERDASAN WAKTU EMBU (AUTO-DETECT RULES)
// =========================================================
function getEmbuTimeRule(catName) {
    // Standar baku jika admin belum pernah menyetting sama sekali
    let rules = (STATE.settings && STATE.settings.timeRules) ? STATE.settings.timeRules : {
        tandoku: { min: 60, max: 75 },
        pemula: { min: 60, max: 90 },
        default: { min: 90, max: 120 }
    };

    let nameUpper = String(catName).toUpperCase();

    // Hirarki Kasta Pendeteksian Teks
    if (nameUpper.includes("TANDOKU")) {
        return { type: "TANDOKU", min: parseInt(rules.tandoku.min), max: parseInt(rules.tandoku.max) };
    } else if (nameUpper.includes("PEMULA")) {
        return { type: "PEMULA", min: parseInt(rules.pemula.min), max: parseInt(rules.pemula.max) };
    } else {
        return { type: "REMAJA / DEWASA (DEFAULT)", min: parseInt(rules.default.min), max: parseInt(rules.default.max) };
    }
}

function openTimeModal() {
    let rules = (STATE.settings && STATE.settings.timeRules) ? STATE.settings.timeRules : {
        tandoku: { min: 60, max: 75 }, pemula: { min: 60, max: 90 }, default: { min: 90, max: 120 }
    };
    document.getElementById('t-tandoku-min').value = rules.tandoku.min;
    document.getElementById('t-tandoku-max').value = rules.tandoku.max;
    document.getElementById('t-pemula-min').value = rules.pemula.min;
    document.getElementById('t-pemula-max').value = rules.pemula.max;
    document.getElementById('t-default-min').value = rules.default.min;
    document.getElementById('t-default-max').value = rules.default.max;
    document.getElementById('time-modal').classList.remove('hidden');
}

function closeTimeModal() { document.getElementById('time-modal').classList.add('hidden'); }

document.getElementById('form-time-rules').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.timeRules = {
        tandoku: { min: document.getElementById('t-tandoku-min').value, max: document.getElementById('t-tandoku-max').value },
        pemula: { min: document.getElementById('t-pemula-min').value, max: document.getElementById('t-pemula-max').value },
        default: { min: document.getElementById('t-default-min').value, max: document.getElementById('t-default-max').value }
    };
    saveToLocalStorage(); // Kirim aturan baru ini ke server agar Tatami lain tahu
    closeTimeModal();
    alert("Standar Waktu Embu berhasil diperbarui untuk semua lapangan!");
});

// =========================================================
// SISTEM KENDALI PROYEKTOR TM (TECHNICAL MEETING)
// =========================================================
function bukaProyektorTM() {
    window.open('display-drawing.html', '_blank');
}

function updateProjectorPhase() {
    const phase = document.getElementById('select-projector-phase').value;
    database.ref('turnamen_data/settings/projectorPhase').set(phase);
}

// =========================================================
// SISTEM PAPERLESS VERIFICATION (BARCODE & SMART ASSIGN)
// =========================================================

function saveVerifikatorSetting() {
    if (!STATE.settings) STATE.settings = {};
    STATE.settings.enableVerifikator = document.getElementById('setting-verifikator').checked;
    saveToLocalStorage();
    alert("Sistem Verifikasi Barcode " + (STATE.settings.enableVerifikator ? "DIAKTIFKAN" : "DIMATIKAN"));
}

// 1. MANAJEMEN MASTER DATA (ADMIN)
function openMasterBarcodeModal() {
    document.getElementById('barcode-modal').classList.remove('hidden');
    renderMasterBarcodeList();
}
function closeMasterBarcodeModal() {
    document.getElementById('barcode-modal').classList.add('hidden');
}

function handleBarcodeCSVUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        const rows = e.target.result.split('\n');
        let count = 0;
        rows.forEach((row, i) => {
            // 🌟 PERBAIKAN 1: Hapus aturan i === 0 agar baris pertama tidak dibuang otomatis
            if (!row.trim()) return;

            let cols = row.split(',').map(item => item.replace(/^"|"$/g, '').trim());

            // 🌟 PERBAIKAN 2: Deteksi Cerdas! Jika baris pertama adalah Header (ada kata "nama"), baru dilewati
            if (cols[0].toLowerCase().includes('nama')) return;

            if (cols.length >= 2) {
                const nama = cols[0];
                const jabatan = cols[1]; // WASIT atau OFFICIAL
                const kontingen = cols[2] || "-";

                if (nama && !STATE.barcodes.some(b => b.nama.toLowerCase() === nama.toLowerCase())) {
                    STATE.barcodes.push({ id: Date.now() + i, nama, jabatan, kontingen, barcodeUrl: null });
                    count++;
                }
            }
        });
        saveToLocalStorage(); renderMasterBarcodeList(); event.target.value = ''; alert(`${count} Data diimport.`);
    };
    reader.readAsText(file);
}

function renderMasterBarcodeList() {
    const tbody = document.getElementById('barcode-list-body');
    if (STATE.barcodes.length === 0) return tbody.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Belum ada data. Silakan import CSV.</td></tr>`;

    tbody.innerHTML = STATE.barcodes.map(b => {
        let badgeColor = b.jabatan.toUpperCase() === 'WASIT' ? 'bg-blue-900/50 text-blue-400 border-blue-700' : 'bg-orange-900/50 text-orange-400 border-orange-700';
        let status = b.barcodeUrl ? `<span class="text-green-400"><i class="fas fa-check-circle mr-1"></i>Tersambung</span>` : `<span class="text-red-400"><i class="fas fa-times-circle mr-1"></i>Kosong</span>`;

        return `<tr class="border-b border-slate-800 hover:bg-slate-800/50">
            <td class="p-3 font-bold text-white">${b.nama}</td>
            <td class="p-3"><span class="px-2 py-1 rounded text-[10px] font-black border ${badgeColor}">${b.jabatan}</span></td>
            <td class="p-3 text-slate-400 text-xs uppercase">${b.kontingen}</td>
            <td class="p-3 text-xs font-bold">${status}</td>
            <td class="p-3 text-center whitespace-nowrap">
                <button onclick="openPairingScanner(${b.id})" class="bg-blue-900/50 border border-blue-700 hover:bg-blue-600 text-blue-300 hover:text-white p-2 w-9 h-9 rounded-lg transition-all" title="Pairing Barcode"><i class="fas fa-camera"></i></button>
                <button onclick="openAccountForm(${b.id})" class="bg-slate-700 border border-slate-600 hover:bg-yellow-600 text-slate-300 hover:text-white p-2 w-9 h-9 rounded-lg ml-1 transition-all" title="Edit Data"><i class="fas fa-edit"></i></button>
                <button onclick="deleteBarcode(${b.id})" class="bg-red-900/30 border border-red-800 hover:bg-red-600 text-red-400 hover:text-white p-2 w-9 h-9 rounded-lg ml-1 transition-all" title="Hapus Data"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

function deleteBarcode(id) {
    if (confirm("Hapus data ini?")) {
        STATE.barcodes = STATE.barcodes.filter(b => b.id !== id);
        saveToLocalStorage(); renderMasterBarcodeList();
    }
}

// --- KENDALI FORM AKUN (TAMBAH & EDIT) ---
function openAccountForm(id = null) {
    const modal = document.getElementById('account-form-modal');
    const title = document.getElementById('account-form-title');
    const idInput = document.getElementById('acc-id');
    const namaInput = document.getElementById('acc-nama');
    const jabatanInput = document.getElementById('acc-jabatan');
    const kontingenInput = document.getElementById('acc-kontingen');
    const shortIdInput = document.getElementById('acc-short-id'); // <-- Elemen baru untuk ID Manual

    // Proteksi jika modal HTML belum siap
    if (!modal) return alert("Error: Elemen HTML untuk Modal Edit Akun tidak ditemukan!");

    modal.classList.remove('hidden');

    if (id) {
        // MODE EDIT
        const b = STATE.barcodes.find(x => x.id === id);
        if (b) {
            title.innerHTML = `<i class="fas fa-user-edit text-blue-500 mr-2"></i>Edit Akun`;
            idInput.value = b.id;
            namaInput.value = b.nama;
            jabatanInput.value = b.jabatan.toUpperCase() === 'WASIT' ? 'WASIT' : 'OFFICIAL';
            kontingenInput.value = b.kontingen;
            // Tampilkan ID yang sudah ada, atau beri label jika belum punya
            if (shortIdInput) shortIdInput.value = b.shortId || "BELUM ADA";
        }
    } else {
        // MODE TAMBAH BARU
        title.innerHTML = `<i class="fas fa-user-plus text-blue-500 mr-2"></i>Tambah Akun Baru`;
        idInput.value = '';
        namaInput.value = '';
        jabatanInput.value = 'OFFICIAL';
        kontingenInput.value = '';
        if (shortIdInput) shortIdInput.value = "DIBUAT OTOMATIS";
    }
    handleJabatanFormChange();
}

function closeAccountForm() {
    document.getElementById('account-form-modal').classList.add('hidden');
}

function handleJabatanFormChange() {
    const jabatan = document.getElementById('acc-jabatan').value;
    const kontingenInput = document.getElementById('acc-kontingen');

    if (jabatan === 'WASIT') {
        kontingenInput.value = '-';
        kontingenInput.readOnly = true;
        kontingenInput.classList.add('opacity-50', 'bg-slate-800', 'cursor-not-allowed');
    } else {
        if (kontingenInput.value === '-') kontingenInput.value = '';
        kontingenInput.readOnly = false;
        kontingenInput.classList.remove('opacity-50', 'bg-slate-800', 'cursor-not-allowed');
    }
}

function saveAccountForm(event) {
    event.preventDefault();
    const id = document.getElementById('acc-id').value;
    const nama = document.getElementById('acc-nama').value.trim();
    const jabatan = document.getElementById('acc-jabatan').value;
    const kontingen = document.getElementById('acc-kontingen').value.trim() || '-';

    if (!nama) return;

    if (id) {
        // SIMPAN EDIT
        const idx = STATE.barcodes.findIndex(b => b.id == id);
        if (idx > -1) {
            if (STATE.barcodes.some(b => b.id != id && b.nama.toLowerCase() === nama.toLowerCase())) {
                return alert("Gagal: Nama ini sudah ada di database!");
            }
            STATE.barcodes[idx].nama = nama;
            STATE.barcodes[idx].jabatan = jabatan;
            STATE.barcodes[idx].kontingen = kontingen;

            // Generate ID otomatis jika ini adalah akun lama yang belum punya ID
            if (!STATE.barcodes[idx].shortId) {
                let prefix = jabatan === 'WASIT' ? 'W' : 'O';
                STATE.barcodes[idx].shortId = prefix + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            }
        }
    } else {
        // SIMPAN BARU
        if (STATE.barcodes.some(b => b.nama.toLowerCase() === nama.toLowerCase())) {
            return alert("Gagal: Nama ini sudah ada di database!");
        }

        // Generate ID Ringkas saat tombol simpan ditekan
        let prefix = jabatan === 'WASIT' ? 'W' : 'O';
        let newShortId = prefix + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();

        STATE.barcodes.push({
            id: Date.now(),
            nama: nama,
            jabatan: jabatan,
            kontingen: kontingen,
            barcodeUrl: null,
            shortId: newShortId // <-- Simpan ID ringkas ke dalam database state
        });
    }

    saveToLocalStorage();
    renderMasterBarcodeList();
    closeAccountForm();
}

let pairingScannerRef = null;
let SCANNER_TARGET_ID = null;

function openPairingScanner(id) {
    SCANNER_TARGET_ID = id;
    let b = STATE.barcodes.find(x => x.id === id);
    if (!b) return;

    // Set Identitas UI Radar
    document.getElementById('pairing-target-name').innerText = b.nama;
    document.getElementById('pairing-target-role').innerText = b.jabatan;

    // Tampilkan Modal
    document.getElementById('pairing-radar-modal').classList.remove('hidden');

    // AKTIFKAN LISTENER INBOX KHUSUS ADMIN
    pairingScannerRef = database.ref(`scanner_inbox/admin`);
    pairingScannerRef.on('child_added', (snapshot) => {
        const data = snapshot.val();
        if (data && data.url) {
            processPairingUrl(data.url, snapshot.key);
        }
    });
}

function processPairingUrl(url, snapKey) {
    let idx = STATE.barcodes.findIndex(b => b.id === SCANNER_TARGET_ID);
    if (idx > -1) {
        // Cek apakah URL sudah dipakai orang lain
        let exist = STATE.barcodes.find(b => b.barcodeUrl === url && b.id !== SCANNER_TARGET_ID);

        if (exist) {
            // GAGAL: Kirim sinyal TETOT ke HP Admin & Hapus Inbox
            database.ref(`scanner_feedback/admin`).set({ id: snapKey, status: 'FAILED', timestamp: Date.now() });
            database.ref(`scanner_inbox/admin/${snapKey}`).remove();
            alert(`❌ GAGAL! Barcode ini sudah dipakai oleh: ${exist.nama}`);
            return false;
        }

        // SUKSES: Simpan Data & Kirim sinyal BEEP ke HP Admin
        STATE.barcodes[idx].barcodeUrl = url;
        saveToLocalStorage();
        renderMasterBarcodeList();

        database.ref(`scanner_feedback/admin`).set({ id: snapKey, status: 'SUCCESS', timestamp: Date.now() });
        database.ref(`scanner_inbox/admin/${snapKey}`).remove();

        closePairingRadarModal();
        return true;
    }
}

function closePairingRadarModal() {
    document.getElementById('pairing-radar-modal').classList.add('hidden');
    if (pairingScannerRef) {
        pairingScannerRef.off(); // Matikan sensor agar tidak bocor
        pairingScannerRef = null;
    }
}

// 2. MESIN RADAR VERIFIKASI (MEJA PANITERA / COURT)
let mobileScannerRef = null;

function openVerificationModal() {
    if (!currentRandoriMatchId) return alert("Pilih partai Randori terlebih dahulu!");

    let match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if (!match) return;

    // Suntikkan Identitas Partai
    let pMrh = STATE.participants.find(p => p.id === match.merahId);
    let pPth = STATE.participants.find(p => p.id === match.putihId);
    let displayNum = match.matchNum % 50 === 0 ? 50 : match.matchNum % 50;

    document.getElementById('v-match-identity').innerHTML = `
        <div class="text-[10px] text-slate-400 font-bold uppercase tracking-widest border-b border-slate-700 pb-1 mb-1">Partai G-${displayNum} &bull; Pool ${match.pool} &bull; ${match.babak}</div>
        <div class="text-[11px] font-black text-blue-400 mb-2 leading-tight">${match.kategori}</div>
        <div class="flex justify-between items-center text-xs font-bold bg-slate-950 p-2 rounded-lg border border-slate-800">
            <span class="text-red-400 truncate w-[45%]">${pMrh ? pMrh.nama.split(',')[0] : '-'}</span>
            <span class="text-slate-600 text-[9px] italic">VS</span>
            <span class="text-white truncate w-[45%] text-right">${pPth ? pPth.nama.split(',')[0] : '-'}</span>
        </div>
    `;

    // Set Label Court di Layar Radar
    let badgeCourt = document.getElementById('ui-court-badge');
    if (badgeCourt) badgeCourt.innerText = String(DEVICE_ROLE).replace('_', ' ').toUpperCase();

    refreshVerifikatorUI(match);
    document.getElementById('verification-modal').classList.remove('hidden');

    // AKTIFKAN LISTENER INBOX KHUSUS COURT INI
    if (DEVICE_ROLE !== 'admin') {
        mobileScannerRef = database.ref(`scanner_inbox/${DEVICE_ROLE}`);
        mobileScannerRef.on('child_added', (snapshot) => {
            const data = snapshot.val();
            if (data && data.url) {
                let isSuccess = processVerificationUrl(data.url);

                // Umpan Balik Sinyal ke HP Court
                database.ref(`scanner_feedback/${DEVICE_ROLE}`).set({
                    id: snapshot.key,
                    status: isSuccess ? 'SUCCESS' : 'FAILED',
                    timestamp: Date.now()
                });
                snapshot.ref.remove(); // Bersihkan Inbox
            }
        });
    } else {
        alert("Peringatan: Perangkat ini di-set sebagai 'Admin Utama'. Mode Radar Mobile hanya bekerja jika Anda mengatur peran perangkat menjadi Court 1/2/3.");
    }
}

function closeVerificationModal() {
    document.getElementById('verification-modal').classList.add('hidden');
    if (mobileScannerRef) {
        mobileScannerRef.off();
        mobileScannerRef = null;
    }
}

function processVerificationUrl(url) {
    let user = STATE.barcodes.find(b => b.barcodeUrl === url);
    if (!user) return false;

    let match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if (!match) return false;
    if (!match.verifikator) match.verifikator = { wasit: null, officialMerah: null, officialPutih: null };

    let jabatan = user.jabatan.toUpperCase();

    // Smart Assign Induk Kontingen
    if (jabatan === 'WASIT') {
        match.verifikator.wasit = user.nama;
    } else {
        let pMrh = STATE.participants.find(p => p.id === match.merahId);
        let pPth = STATE.participants.find(p => p.id === match.putihId);
        let kUser = cleanKontingen(user.kontingen);
        let kMrh = pMrh ? cleanKontingen(pMrh.kontingen) : '';
        let kPth = pPth ? cleanKontingen(pPth.kontingen) : '';

        if (kUser === kMrh) match.verifikator.officialMerah = user.nama;
        else if (kUser === kPth) match.verifikator.officialPutih = user.nama;
        else return false;
    }

    // Update Firebase Pertandingan
    let mIdx = STATE.matches.findIndex(m => m.id === currentRandoriMatchId);
    database.ref(`turnamen_data/matches/${mIdx}/verifikator`).set(match.verifikator);

    // Update Warna Blok Layar Instan
    refreshVerifikatorUI(match);
    return true;
}

// 3. LOGIKA SMART ASSIGN & REGEX KONTINGEN (REVISI KOTA/KAB)
const cleanKontingen = (str) => {
    if (!str || str === '-') return '';

    let cleaned = String(str).toUpperCase().trim();

    // TAHAP 1: STANDARDISASI WILAYAH & INSTITUSI (Bukan Dihapus!)
    // Mengubah semua variasi singkatan menjadi satu kata baku
    cleaned = cleaned.replace(/\b(KABUPATEN|KAB\.|KAB)\b/g, 'KAB');
    cleaned = cleaned.replace(/\b(KOTA|KOT\.|KOT)\b/g, 'KOTA');
    cleaned = cleaned.replace(/\b(PROVINSI|PROV\.|PROV)\b/g, 'PROV');
    cleaned = cleaned.replace(/\b(UNIVERSITAS|UNIV\.|UNIV|INSTITUT)\b/g, 'UNIV');

    // TAHAP 2: POTONG EKOR REGU / PASANGAN
    // Menghapus rongsokan kurung di akhir kalimat seperti (A), (H), (1)
    cleaned = cleaned.replace(/\s*\(([a-zA-Z]|[IVX]{1,3}|\d{1,2})\)$/i, ' ');

    // Menghapus huruf abjad A-Z tunggal di akhir kalimat (Contoh: "KOTA SEMARANG A")
    cleaned = cleaned.replace(/\s+[A-Z]$/i, ' ');

    // TAHAP 3: KOMPRESI TOTAL
    // Menghancurkan sisa spasi, titik, dan tanda baca menjadi satu string solid pelacak
    cleaned = cleaned.replace(/[^A-Z0-9]/g, '');

    return cleaned;
};

function handleScanSuccess(url) {
    if (SCANNER_MODE === 'pairing') {
        let idx = STATE.barcodes.findIndex(b => b.id === SCANNER_TARGET_ID);
        if (idx > -1) {
            let exist = STATE.barcodes.find(b => b.barcodeUrl === url && b.id !== SCANNER_TARGET_ID);
            if (exist) return alert(`Gagal! Barcode ini sudah terdaftar milik ${exist.nama}`);
            STATE.barcodes[idx].barcodeUrl = url;
            saveToLocalStorage(); renderMasterBarcodeList(); closeScannerModal();
            alert(`✅ SUKSES! Barcode berhasil dikaitkan ke: ${STATE.barcodes[idx].nama}`);
        }
    } else if (SCANNER_MODE === 'verify') {
        let user = STATE.barcodes.find(b => b.barcodeUrl === url);
        if (!user) {
            alert("❌ BARCODE DITOLAK: Tidak terdaftar di sistem.");
            if (html5QrCodeVerify && html5QrCodeVerify.getState() === Html5QrcodeScannerState.PAUSED) html5QrCodeVerify.resume();
            return;
        }

        let match = STATE.matches.find(m => m.id === currentRandoriMatchId);
        if (!match) return;
        if (!match.verifikator) match.verifikator = { wasit: null, officialMerah: null, officialPutih: null };

        let jabatan = user.jabatan.toUpperCase();

        // Logika Smart Assign
        if (jabatan === 'WASIT') {
            match.verifikator.wasit = user.nama;
        } else {
            let pMrh = STATE.participants.find(p => p.id === match.merahId);
            let pPth = STATE.participants.find(p => p.id === match.putihId);
            let kUser = cleanKontingen(user.kontingen);
            let kMrh = pMrh ? cleanKontingen(pMrh.kontingen) : '';
            let kPth = pPth ? cleanKontingen(pPth.kontingen) : '';

            if (kUser === kMrh) match.verifikator.officialMerah = user.nama;
            else if (kUser === kPth) match.verifikator.officialPutih = user.nama;
            else {
                alert(`❌ DITOLAK: ${user.nama} adalah Official dari ${kUser}.`);
                if (html5QrCodeVerify && html5QrCodeVerify.getState() === Html5QrcodeScannerState.PAUSED) html5QrCodeVerify.resume();
                return;
            }
        }

        // Tembak Langsung ke Firebase
        let mIdx = STATE.matches.findIndex(m => m.id === currentRandoriMatchId);
        database.ref(`turnamen_data/matches/${mIdx}/verifikator`).set(match.verifikator);

        // Update Layar secara instan tanpa alert!
        refreshVerifikatorUI(match);

        // Lanjutkan scanning otomatis (Continuous Mode)
        setTimeout(() => {
            if (html5QrCodeVerify && html5QrCodeVerify.getState() === Html5QrcodeScannerState.PAUSED) {
                html5QrCodeVerify.resume();
            }
        }, 800); // Beri jeda sedikit agar orang sempat menarik kartunya
    }
}

function refreshVerifikatorUI(match) {
    if (!match) return;
    let vf = match.verifikator || { wasit: null, officialMerah: null, officialPutih: null };

    // 1. BLOK WASIT (BIRU)
    let wBlock = document.getElementById('v-block-wasit');
    let wName = document.getElementById('v-name-wasit');
    if (wBlock && wName) {
        if (vf.wasit) {
            wBlock.className = "bg-blue-600 border-2 border-blue-400 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[90px] shadow-[0_0_15px_rgba(37,99,235,0.4)]";
            wBlock.querySelector('span:first-child').className = "text-[10px] font-black uppercase tracking-widest text-blue-200 mb-1";
            wName.className = "font-black text-white text-base tracking-wide";
            wName.innerHTML = `<i class="fas fa-check-circle mr-1"></i> ${vf.wasit}`;
        } else {
            wBlock.className = "bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-500 min-h-[90px]";
            wBlock.querySelector('span:first-child').className = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1";
            wName.className = "font-bold text-slate-600 text-sm";
            wName.innerText = "Menunggu Scan...";
        }
    }

    // 2. BLOK MERAH (MERAH SOLID)
    let mBlock = document.getElementById('v-block-merah');
    let mName = document.getElementById('v-name-merah');
    if (mBlock && mName) {
        if (vf.officialMerah) {
            mBlock.className = "bg-red-600 border-2 border-red-400 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[90px] shadow-[0_0_15px_rgba(220,38,38,0.4)]";
            mBlock.querySelector('span:first-child').className = "text-[10px] font-black uppercase tracking-widest text-red-200 mb-1";
            mName.className = "font-black text-white text-base tracking-wide";
            mName.innerHTML = `<i class="fas fa-check-circle mr-1"></i> ${vf.officialMerah}`;
        } else {
            mBlock.className = "bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-500 min-h-[90px]";
            mBlock.querySelector('span:first-child').className = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1";
            mName.className = "font-bold text-slate-600 text-sm";
            mName.innerText = "Menunggu Scan...";
        }
    }

    // 3. BLOK PUTIH (PUTIH BERSIH)
    let pBlock = document.getElementById('v-block-putih');
    let pName = document.getElementById('v-name-putih');
    if (pBlock && pName) {
        if (vf.officialPutih) {
            pBlock.className = "bg-white border-2 border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-300 min-h-[90px] shadow-[0_0_15px_rgba(255,255,255,0.4)]";
            pBlock.querySelector('span:first-child').className = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1";
            // Kontras Hitam karena bg Putih
            pName.className = "font-black text-slate-900 text-base tracking-wide";
            pName.innerHTML = `<i class="fas fa-check-circle text-green-500 mr-1"></i> ${vf.officialPutih}`;
        } else {
            pBlock.className = "bg-slate-800 border border-slate-700 rounded-xl p-4 flex flex-col items-center justify-center text-center transition-all duration-500 min-h-[90px]";
            pBlock.querySelector('span:first-child').className = "text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1";
            pName.className = "font-bold text-slate-600 text-sm";
            pName.innerText = "Menunggu Scan...";
        }
    }
}

// SUNTIKAN KE FUNGSI loadRandoriMatch
const originalLoadRandoriMatch = loadRandoriMatch;
loadRandoriMatch = function () {
    originalLoadRandoriMatch(); // Panggil fungsi aslinya

    // Logika tambahan untuk memunculkan Panel Verifikator
    let vfPanel = document.getElementById('panel-verifikator');
    if (vfPanel) {
        if (STATE.settings && STATE.settings.enableVerifikator) {
            vfPanel.classList.remove('hidden');
            let match = STATE.matches.find(m => m.id === currentRandoriMatchId);
            if (match) refreshVerifikatorUI(match);
        } else {
            vfPanel.classList.add('hidden');
        }
    }
};

// --- SISTEM SMART URL & QR GENERATOR ---

function saveScannerUrl() {
    let url = document.getElementById('setting-scanner-url').value.trim();
    if (!url) return alert("URL tidak boleh kosong!");

    // Pastikan tidak ada spasi atau slash (/) berlebih di ujung
    if (url.endsWith('/')) url = url.slice(0, -1);

    if (!STATE.settings) STATE.settings = {};
    STATE.settings.scannerBaseUrl = url;
    saveToLocalStorage();
    alert("URL Mobile Scanner berhasil disimpan!\nQR Code siap digunakan.");
}

// Injeksi ke fungsi switchTab (Biar input form-nya terisi otomatis saat Tab Admin dibuka)
const originalSwitchTab = switchTab;
switchTab = function (targetTab) {
    originalSwitchTab(targetTab);
    if (targetTab === 'admin') {
        let urlEl = document.getElementById('setting-scanner-url');
        if (urlEl) urlEl.value = (STATE.settings && STATE.settings.scannerBaseUrl) ? STATE.settings.scannerBaseUrl : '';
    }
}

// Fungsi Buka Pop-up & Gambar QR
function openQrOperatorModal() {
    let baseUrl = (STATE.settings && STATE.settings.scannerBaseUrl) ? STATE.settings.scannerBaseUrl : '';

    if (!baseUrl) {
        alert("⚠️ Base URL Scanner belum diatur!\nSilakan isi URL aplikasi Scanner Anda di Tab Admin -> Sistem Paperless terlebih dahulu.");
        return;
    }

    if (DEVICE_ROLE === 'admin') {
        alert("Perangkat Anda berstatus 'Admin'. QR Code ini dirancang khusus untuk memanggil Scanner Court (Court 1/2/3).");
        return;
    }

    // 1. Bersihkan QR Lama
    document.getElementById("qr-code-canvas").innerHTML = "";

    // 2. RAKIT URL CERDAS
    let smartUrl = `${baseUrl}?lokasi=${DEVICE_ROLE}`;

    // 3. Gambar QR Code Baru
    new QRCode(document.getElementById("qr-code-canvas"), {
        text: smartUrl,
        width: 190, // Ukuran pas untuk kotak putih
        height: 190,
        colorDark: "#0f172a", // Hitam kebiruan elegan (Slate-950)
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H // Level akurasi tinggi
    });

    // 4. Update Teks UI
    document.getElementById('qr-target-court').innerText = DEVICE_ROLE.replace('_', ' ').toUpperCase();

    // 5. Tampilkan Modal
    document.getElementById('qr-operator-modal').classList.remove('hidden');
}

function closeQrOperatorModal() {
    document.getElementById('qr-operator-modal').classList.add('hidden');
}

// ==========================================
// SISTEM SAKLAR KENDALI HP WASIT (TOGGLE)
// ==========================================
let isWasitDigitalMode = false; // Memori saklar (Bawaan: OFF)

function toggleWasitMode() {
    isWasitDigitalMode = !isWasitDigitalMode;
    const btnTembak = document.getElementById('btnTembakWasit');
    const safeCourtId = DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';

    if (isWasitDigitalMode) {
        // MODE DIGITAL ON
        if (btnTembak) {
            btnTembak.innerHTML = '<i class="fas fa-satellite-dish animate-pulse mr-2"></i> KONEKSI WASIT AKTIF (KLIK MATIKAN)';
            btnTembak.classList.replace('bg-blue-600', 'bg-green-600');
        }
        tembakDataKeFirebase();
    } else {
        // MODE DIGITAL OFF -> OTOMATIS TENDANG WASIT KE CADANGAN
        if (btnTembak) {
            btnTembak.innerHTML = '<i class="fas fa-broadcast-tower mr-2"></i> AKTIFKAN KONEKSI HP WASIT';
            btnTembak.classList.replace('bg-green-600', 'bg-blue-600');
        }
        kunciLayarWasit();
        // Mengirim sinyal tendang
        database.ref(`live_embu/${safeCourtId}/command`).set({ action: 'logout_posisi', timestamp: Date.now() });
    }
}

// Tambahkan fungsi ini agar bisa dipanggil lewat tombol manual di UI Panitera
function tendangSemuaWasit() {
    if (confirm("Tendang semua wasit ke posisi Non-Aktif / Cadangan?\nMereka harus memilih posisi wasit kembali.")) {
        const safeCourtId = DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';
        database.ref(`live_embu/${safeCourtId}/command`).set({ action: 'logout_posisi', timestamp: Date.now() });
        alert("Sinyal tendang berhasil dikirim ke seluruh HP Wasit di court ini.");
    }
}

function tembakDataKeFirebase() {
    if (!isWasitDigitalMode) return; // Jangan tembak data kalau saklar belum dinyalakan!

    const val = document.getElementById('select-peserta').value;
    if (!val || !val.includes('|')) return;

    const [pIdStr, babak] = val.split('|');
    const pId = parseInt(pIdStr);
    const p = STATE.participants.find(x => x.id === pId);
    if (!p) return;

    const safeCourtId = DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';
    let displayNamaUmpan = p.nama.split(/[,+&]/).map(n => n.trim()).join(" & ");

    // --- FUNGSI PEMBANTU ---
    const kirimKeWasit = (wazaArray) => {
        const umpanData = {
            status: "aktif",
            partai_id: val,
            urut: p.urut || "?",
            no_urut: p.urut || "?",
            kategori: p.kategori || "-",
            kontingen: p.kontingen || "-",
            nama: displayNamaUmpan || "-",
            waza: wazaArray,
            juri: { 1: null, 2: null, 3: null, 4: null, 5: null }
        };

        // Menembak ke Project Utama (MASS KEMPO - RTDB) menggunakan variabel 'database'
        database.ref(`live_embu/${safeCourtId}`).set(umpanData)
            .then(() => console.log("Data sukses ditembak ke layar Wasit!"))
            .catch(err => console.error("Gagal sinkron ke RTDB:", err));
    };

    const docId = p.idFirestore;

    if (!docId) {
        console.warn("Atlet tidak memiliki idFirestore. Menggunakan Waza default.");
        kirimKeWasit(["Waza 1", "Waza 2", "Waza 3", "Waza 4", "Waza 5", "Waza 6"]);
        return;
    }

    // PERUBAHAN 1: Ganti "peserta" menjadi "pendaftaran_t2"
    firestoreDB.collection("pendaftaran_t2").doc(docId).get().then((doc) => {
        if (doc.exists) {
            const dataLengkap = doc.data();

            // PERUBAHAN 2: Ganti "komposisiWaza" menjadi "waza"
            let wazaList = (dataLengkap.waza && Array.isArray(dataLengkap.waza) && dataLengkap.waza.length > 0)
                ? dataLengkap.waza
                : ["Waza 1", "Waza 2", "Waza 3", "Waza 4", "Waza 5", "Waza 6"];

            kirimKeWasit(wazaList);
        } else {
            console.warn("Dokumen tidak ditemukan di Firestore! Menggunakan Waza default.");
            kirimKeWasit(["Waza 1", "Waza 2", "Waza 3", "Waza 4", "Waza 5", "Waza 6"]);
        }
    }).catch((error) => {
        console.error("Error menjemput data Waza dari firestoreDB:", error);
        kirimKeWasit(["Waza 1", "Waza 2", "Waza 3", "Waza 4", "Waza 5", "Waza 6"]);
    });
}

function kunciLayarWasit() {
    const safeCourtId = DEVICE_ROLE !== 'admin' ? DEVICE_ROLE : 'court_1';
    // Kirim sinyal 'locked' agar HP Wasit memunculkan gambar gembok
    database.ref(`live_embu/${safeCourtId}`).update({ status: 'locked' }).catch(err => console.error(err));
}