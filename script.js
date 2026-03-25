/**
 * MASS - Martial Arts Scoring System
 * Version 22.0 (Stabilizer Update: Fixing Click & Indicator)
 */

// --- 1. FIREBASE CONFIG & INDICATOR (Minimalist) ---
let database_instance = null;
let isCloudReady = false;

// --- 1. FUNGSI INDIKATOR & FIREBASE ---
async function initFirebase() {
    // Buat indikator secara paksa di pojok layar agar pasti muncul
    let badge = document.getElementById('cloud-status');
    if (!badge) {
        badge = document.createElement('div');
        badge.id = 'cloud-status';
        badge.style = "position: fixed; top: 1rem; left: 1rem; z-index: 9999; font-size: 10px; font-weight: 800; padding: 4px 10px; border-radius: 99px; background: #0f172a; border: 1px solid #334155; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); pointer-events: none;";
        badge.innerHTML = '<span style="color: #f59e0b">● CONNECTING...</span>';
        document.body.appendChild(badge);
    }

    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js");
        const { getDatabase, ref, onValue, set } = await import("https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js");

        const firebaseConfig = {
            apiKey: "AIzaSyA63UtPlhEdC9qKmmHVpDjGv_4RqWjK47k",
            authDomain: "mass-pro-turnamen.firebaseapp.com",
            projectId: "mass-pro-turnamen",
            databaseURL: "https://mass-pro-turnamen-default-rtdb.asia-southeast1.firebasedatabase.app/",
            storageBucket: "mass-pro-turnamen.firebasestorage.app",
            messagingSenderId: "268290671498",
            appId: "1:268290671498:web:d55e4960e392f7dfc8fe73"
        };

        const app = initializeApp(firebaseConfig);
        database_instance = getDatabase(app);
        const dataRef = ref(database_instance, 'mass_data');

        onValue(dataRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // SINKRONISASI PINTAR: Update hanya jika datanya ada
                STATE.categories = data.categories || [];
                STATE.participants = data.participants || [];
                STATE.matches = data.matches || [];
                STATE.settings = data.settings || { numJudges: 5 };
                
                isCloudReady = true;
                if(badge) badge.innerHTML = '<span style="color: #22c55e">● CLOUD ONLINE</span>';
                
                // Refresh tampilan setelah data cloud masuk
                refreshAllData();
                updateActiveViewsSilent(); 
            } else {
                // Jika Cloud kosong, jangan biarkan STATE jadi undefined
                isCloudReady = true;
                if(badge) badge.innerHTML = '<span style="color: #3b82f6">● CLOUD READY (EMPTY)</span>';
            }
        });

        window.cloudSave = (data) => set(ref(database_instance, 'mass_data'), data);
    } catch (e) {
        console.error("Cloud Error:", e);
        badge.innerHTML = '<span style="color: #ef4444">○ OFFLINE</span>';
    }
}

// --- 2. LOGIKA PENYIMPANAN (Menghubungkan Lokal & Cloud) ---
function saveToLocalStorage() {
    // Simpan Lokal
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
    localStorage.setItem('mass_matches', JSON.stringify(STATE.matches));

    // Simpan Cloud
    if (isCloudReady && window.cloudSave) {
        window.cloudSave(STATE);
    }
}

// --- 3. FONDASI V15.1 (Logika Asli Anda) ---

let STATE = {
    categories: [],
    participants: [],
    matches: [],
    settings: { numJudges: 5 }
};

// 2. Fungsi inisialisasi lokal tetap dijalankan untuk backup
function initializeData() {
    try {
        let cats = JSON.parse(localStorage.getItem('mass_categories')) || [];
        let parts = JSON.parse(localStorage.getItem('mass_participants')) || [];
        let matches = JSON.parse(localStorage.getItem('mass_matches')) || []; 
        // Update STATE global dengan data dari LocalStorage
        STATE.categories = cats;
        STATE.participants = parts;
        STATE.matches = matches;
    } catch (e) {
        console.log("Local storage kosong, menunggu Cloud...");
    }
}

// Panggil fungsinya
initializeData();

const UI = { tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'juara', 'admin'], timerInterval: null, timerSeconds: 0 };
let RANDORI_STATE = { merah: { score: 0 }, putih: { score: 0 } };
let SWAP_SELECTION = null; 

function injectAdminExportButtons() {
    const adminExportSection = document.querySelector('#section-admin .bg-dark-card.text-center');
    if (adminExportSection) {
        adminExportSection.innerHTML = `
            <h2 class="text-xl font-black text-white mb-2"><i class="fas fa-download text-green-500 mr-2"></i>Pusat Export Data</h2>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <button onclick="exportDrawingCSV()" class="bg-blue-600 p-4 rounded-xl font-bold">Jadwal Global</button>
                <button onclick="exportHasilCSV()" class="bg-purple-600 p-4 rounded-xl font-bold">Hasil Global</button>
                <button onclick="exportMedaliCSV()" class="bg-yellow-600 p-4 rounded-xl font-bold text-black">Medali Umum</button>
            </div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => { 
    // 1. Jalankan fungsi dasar dulu (Offline Mode)
    refreshAllData(); 
    if (typeof setJudges === "function") setJudges(5); 
    
    // 2. Suntik tombol admin secara aman
    injectAdminExportButtons();

    // 3. Jalankan Cloud tanpa menunggu/memblokir UI
    setTimeout(() => {
        initFirebase(); 
    }, 500);
});

// Masukkan kembali semua fungsi V15.1 Anda secara utuh di bawah ini
function refreshAllData() { renderCategoryList(); updateAllDropdowns(); renderParticipantTable(); }

function switchTab(targetTab) {
    UI.tabs.forEach(tab => {
        const sectionEl = document.getElementById(`section-${tab}`);
        const tabEl = document.getElementById(`tab-${tab}`);
        if (sectionEl) sectionEl.classList.replace('block', 'hidden');
        if (tabEl) tabEl.classList.remove('active-tab', 'text-blue-500');
    });
    document.getElementById(`section-${targetTab}`)?.classList.replace('hidden', 'block');
    document.getElementById(`tab-${targetTab}`)?.classList.add('active-tab', 'text-blue-500');
    if(targetTab === 'ranking') renderRanking();
}
function renderCategoryList() { const container = document.getElementById('list-kategori'); if(STATE.categories.length === 0) return container.innerHTML = `<span class="text-sm text-slate-500 italic">Belum ada kategori.</span>`; container.innerHTML = STATE.categories.map(c => { let badgeColor = c.discipline === 'randori' ? 'bg-red-700' : 'bg-blue-600'; let disciplineText = c.discipline ? c.discipline.toUpperCase() : 'EMBU'; return `<div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm"><span class="${badgeColor} text-[9px] px-1.5 py-0.5 rounded font-bold">${disciplineText}</span><span class="font-bold text-white">${c.name}</span><span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span><button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button></div>` }).join(''); }
function deleteCategory(id) { if(confirm("Hapus kategori ini?")) { STATE.categories = STATE.categories.filter(c => c.id !== id); saveToLocalStorage(); refreshAllData(); } }

function updateAllDropdowns() { 
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join(''); 
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`; 
    document.getElementById('p-kategori').innerHTML = emptyOpt + options; 
    document.getElementById('edit-kategori').innerHTML = emptyOpt + options; 
    document.getElementById('draw-select-kategori').innerHTML = emptyOpt + options; 
    document.getElementById('select-kategori').innerHTML = emptyOpt + options; 
    document.getElementById('rank-filter-kategori').innerHTML = emptyOpt + options; 
    const allOpt = '<option value="all">Semua Kategori</option>'; 
    document.getElementById('filter-atlet-kategori').innerHTML = allOpt + options; 
}

function handleCSVUpload(event) { 
    const file = event.target.files[0]; if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        const rows = e.target.result.split('\n'); 
        let count = 0; 
        rows.forEach((row, i) => { 
            if(i === 0 || !row.trim()) return; 
            let cols = []; let curr = ''; let inQuotes = false;
            for(let char of row) {
                if(char === '"') inQuotes = !inQuotes;
                else if(char === ',' && !inQuotes) { cols.push(curr); curr = ''; }
                else curr += char;
            }
            cols.push(curr);
            cols = cols.map(item => item.replace(/^"|"$/g, '').trim());

            if(cols.length >= 3) { 
                const nama = cols[0], kontingen = cols[1], kategori = cols[2]; 
                if(nama && STATE.categories.some(c => c.name.toLowerCase() === kategori.toLowerCase())) { 
                    STATE.participants.push({ id: Date.now() + i, nama, kontingen, kategori, urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0, scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }, finalScore: 0, techScore: 0 }); count++; 
                } 
            } 
        }); 
        saveToLocalStorage(); refreshAllData(); event.target.value = ''; alert(`${count} Tim/Atlet diimport sukses.`); 
    }; 
    reader.readAsText(file); 
}

document.getElementById('form-peserta').addEventListener('submit', (e) => { e.preventDefault(); const catName = document.getElementById('p-kategori').value; if(!catName) return alert("Pilih kategori!"); STATE.participants.push({ id: Date.now(), nama: document.getElementById('p-nama').value, kontingen: document.getElementById('p-kontingen').value, kategori: catName, urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0, scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }, finalScore: 0, techScore: 0 }); saveToLocalStorage(); renderParticipantTable(); document.getElementById('p-nama').value = ''; document.getElementById('p-nama').focus(); });

function renderParticipantTable() { 
    const body = document.getElementById('table-peserta-body'); 
    const filter = document.getElementById('filter-atlet-kategori').value; 
    let list = filter && filter !== 'all' ? STATE.participants.filter(p => p.kategori === filter) : STATE.participants; 
    if(list.length === 0) return body.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Tidak ada data.</td></tr>`; 
    let sortedList = [...list].sort((a,b) => a.kategori === b.kategori ? a.urut - b.urut : a.kategori.localeCompare(b.kategori)); 
    body.innerHTML = sortedList.map(p => { 
        let statusHTML = p.urut > 0 ? `<span class="bg-slate-700 px-2 py-1 rounded text-xs font-mono inline-block mb-1">No.${p.urut} | Pool ${p.pool}</span>` : `<span class="text-xs text-red-400 italic inline-block mb-1">Belum Undian</span>`; 
        if(p.losses === 1) statusHTML += ` <span class="bg-orange-600 text-[10px] px-1 rounded ml-1 inline-block">Loser Bracket</span>`; 
        else if(p.losses >= 2) statusHTML += ` <span class="bg-red-800 text-[10px] px-1 rounded ml-1 inline-block">Gugur</span>`; 
        
        return `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
            <td class="p-3 align-top font-bold text-blue-300 w-[35%] whitespace-normal break-words leading-tight">
                ${p.nama} ${p.isFinalist ? '<br><span class="text-[10px] bg-yellow-500 text-black px-1 rounded inline-block mt-1">FINALIS</span>' : ''}
            </td>
            <td class="p-3 align-top w-[25%] whitespace-normal break-words text-sm text-slate-200">
                ${p.kontingen}
            </td>
            <td class="p-3 align-top text-xs text-slate-400 w-[25%] whitespace-normal break-words leading-relaxed">
                <span class="text-blue-400 font-semibold">${p.kategori}</span><br>${statusHTML}
            </td>
            <td class="p-3 align-top text-right w-[15%] whitespace-nowrap">
                <button onclick="openEditModal(${p.id})" class="text-blue-400 mr-2 hover:bg-blue-900/50 p-2 rounded transition-colors"><i class="fas fa-edit"></i></button>
                <button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 hover:bg-red-900/30 p-2 rounded transition-colors"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`; 
    }).join(''); 
}

function deletePeserta(id) { if(confirm('Hapus atlet ini?')) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }
function openEditModal(id) { const p = STATE.participants.find(x => x.id === id); if(!p) return; document.getElementById('edit-id').value = p.id; document.getElementById('edit-nama').value = p.nama; document.getElementById('edit-kontingen').value = p.kontingen; document.getElementById('edit-kategori').value = p.kategori; document.getElementById('edit-modal').classList.remove('hidden'); }
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
document.getElementById('form-edit-peserta').addEventListener('submit', (e) => { e.preventDefault(); const id = parseInt(document.getElementById('edit-id').value); const newKategori = document.getElementById('edit-kategori').value; const idx = STATE.participants.findIndex(p => p.id === id); if(idx > -1) { if(STATE.participants[idx].kategori !== newKategori) { STATE.participants[idx].urut = 0; STATE.participants[idx].pool = '-'; STATE.participants[idx].isFinalist = false; STATE.participants[idx].losses = 0; STATE.participants[idx].scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 } }; STATE.participants[idx].finalScore = 0; STATE.participants[idx].techScore = 0; } STATE.participants[idx].nama = document.getElementById('edit-nama').value; STATE.participants[idx].kontingen = document.getElementById('edit-kontingen').value; STATE.participants[idx].kategori = newKategori; saveToLocalStorage(); renderParticipantTable(); closeEditModal(); alert("Data diperbarui."); } });

const TEMPLATE_4_STANDARD = [ { matchNum: 1, babak: "Semi-Final", col: 1, slot1: 1, slot2: 2, nextW: 3, nextL: 4 }, { matchNum: 2, babak: "Semi-Final", col: 1, slot1: 3, slot2: 4, nextW: 3, nextL: 4 }, { matchNum: 3, babak: "GRAND FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }, { matchNum: 4, babak: "LB S-Final", col: 2, slot1: null, slot2: null, nextW: 5, nextL: null }, { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 3, nextL: null } ];
const TEMPLATE_4_CROSS = [ { matchNum: 1, babak: "S-Final Crossover", col: 1, slot1: 1, slot2: 4, nextW: 3, nextL: 4 }, { matchNum: 2, babak: "S-Final Crossover", col: 1, slot1: 3, slot2: 2, nextW: 3, nextL: 4 }, { matchNum: 3, babak: "GRAND FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }, { matchNum: 4, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 5, nextL: null }, { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 3, nextL: null } ];
const TEMPLATE_8_PERKEMI = [ { matchNum: 1, babak: "Penyisihan 1", col: 1, slot1: 1, slot2: 2, nextW: 7, nextL: 5 }, { matchNum: 2, babak: "Penyisihan 2", col: 1, slot1: 3, slot2: 4, nextW: 7, nextL: 5 }, { matchNum: 3, babak: "Penyisihan 3", col: 1, slot1: 5, slot2: 6, nextW: 8, nextL: 6 }, { matchNum: 4, babak: "Penyisihan 4", col: 1, slot1: 7, slot2: 8, nextW: 8, nextL: 6 }, { matchNum: 7, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 10 }, { matchNum: 8, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 9 }, { matchNum: 11, babak: "FINAL ATAS", col: 3, slot1: null, slot2: null, nextW: 14, nextL: 13 }, { matchNum: 5, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 9, nextL: null }, { matchNum: 6, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 10, nextL: null }, { matchNum: 9, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, { matchNum: 10, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, { matchNum: 12, babak: "LB S-FINAL", col: 3, slot1: null, slot2: null, nextW: 13, nextL: null }, { matchNum: 13, babak: "FINAL BAWAH", col: 4, slot1: null, slot2: null, nextW: 14, nextL: null }, { matchNum: 14, babak: "GRAND FINAL", col: 5, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' } ];
const TEMPLATE_16 = [ { matchNum: 1, babak: "WB R1", col: 1, slot1: 1, slot2: 2, nextW: 9, nextL: 13 }, { matchNum: 2, babak: "WB R1", col: 1, slot1: 3, slot2: 4, nextW: 9, nextL: 13 }, { matchNum: 3, babak: "WB R1", col: 1, slot1: 5, slot2: 6, nextW: 10, nextL: 14 }, { matchNum: 4, babak: "WB R1", col: 1, slot1: 7, slot2: 8, nextW: 10, nextL: 14 }, { matchNum: 5, babak: "WB R1", col: 1, slot1: 9, slot2: 10, nextW: 11, nextL: 15 }, { matchNum: 6, babak: "WB R1", col: 1, slot1: 11, slot2: 12, nextW: 11, nextL: 15 }, { matchNum: 7, babak: "WB R1", col: 1, slot1: 13, slot2: 14, nextW: 12, nextL: 16 }, { matchNum: 8, babak: "WB R1", col: 1, slot1: 15, slot2: 16, nextW: 12, nextL: 16 }, { matchNum: 9, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextL: 20 }, { matchNum: 10, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextL: 19 }, { matchNum: 11, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextL: 18 }, { matchNum: 12, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextL: 17 }, { matchNum: 13, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 17, nextL: null }, { matchNum: 14, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 18, nextL: null }, { matchNum: 15, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 19, nextL: null }, { matchNum: 16, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 20, nextL: null }, { matchNum: 17, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextL: null }, { matchNum: 18, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextL: null }, { matchNum: 19, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextL: null }, { matchNum: 20, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextL: null }, { matchNum: 21, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextL: 26 }, { matchNum: 22, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextL: 25 }, { matchNum: 23, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 25, nextL: null }, { matchNum: 24, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 26, nextL: null }, { matchNum: 25, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextL: null }, { matchNum: 26, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextL: null }, { matchNum: 28, babak: "LB SF", col: 6, slot1: null, slot2: null, nextW: 29, nextL: null }, { matchNum: 27, babak: "FINAL ATAS", col: 6, slot1: null, slot2: null, nextW: 30, nextL: 29 }, { matchNum: 29, babak: "FINAL BAWAH", col: 7, slot1: null, slot2: null, nextW: 30, nextL: null }, { matchNum: 30, babak: "GRAND FINAL", col: 8, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' } ];

function generateRandoriBracket() {
    const container = document.getElementById('randori-bracket-view');
    const wrapper = document.getElementById('randori-bracket-container');
    SWAP_SELECTION = null;

    try {
        const catName = document.getElementById('draw-select-kategori').value;
        if(!catName) return alert("Pilih kategori Randori terlebih dahulu!");
        
        const isFinalCategory = catName.toUpperCase().includes('FINAL');
        let athletes = STATE.participants.filter(p => p.kategori === catName);
        if(isFinalCategory) athletes = athletes.sort((a,b) => a.id - b.id);
        
        const count = athletes.length;
        if(count === 0) return alert("Belum ada peserta di kategori ini!");
        
        // CEK EKSISTENSI & RESET
        const existingMatches = STATE.matches.filter(m => m.kategori === catName);
        if(existingMatches.length > 0) {
            if(!confirm("Bagan sudah ada! Mengacak ulang akan menghapus semua data pertandingan kategori ini. Yakin?")) return;
            STATE.matches = STATE.matches.filter(m => m.kategori !== catName);
            STATE.participants.filter(p => p.kategori === catName).forEach(p => p.losses = 0);
        }

        let poolConfigs = [];
        if(count <= 4) {
            if(isFinalCategory) poolConfigs.push({ name: '-', template: TEMPLATE_4_CROSS, size: 4, athletes: athletes, isCrossover: true });
            else poolConfigs.push({ name: '-', template: TEMPLATE_4_STANDARD, size: 4, athletes: athletes, isCrossover: false });
        } else if (count <= 8) {
            poolConfigs.push({ name: '-', template: TEMPLATE_8_PERKEMI, size: 8, athletes: athletes, isCrossover: false });
        } else if (count <= 32) {
            if(!confirm(`Terdapat ${count} peserta. Sistem akan memecah otomatis menjadi 2 Pool (A dan B). Lanjutkan?`)) return;
            let shuffledAthletes = [...athletes].sort(() => Math.random() - 0.5);
            let mid = Math.ceil(count / 2);
            let poolA = shuffledAthletes.slice(0, mid);
            let poolB = shuffledAthletes.slice(mid);
            poolA.forEach(a => { const p = STATE.participants.find(x=>x.id===a.id); if(p) p.pool = 'A'; });
            poolB.forEach(a => { const p = STATE.participants.find(x=>x.id===a.id); if(p) p.pool = 'B'; });
            poolConfigs.push({ name: 'A', template: TEMPLATE_16, size: 16, athletes: poolA, isCrossover: false });
            poolConfigs.push({ name: 'B', template: TEMPLATE_16, size: 16, athletes: poolB, isCrossover: false });
        }

        let globalMatchIdCounter = Date.now(); 
        poolConfigs.forEach((config, poolIndex) => {
            const slotsCount = config.size;
            const shuffledAthletes = [...config.athletes].sort(() => Math.random() - 0.5);
            let finalSlots = new Array(slotsCount).fill(null);
            shuffledAthletes.forEach((p, idx) => finalSlots[idx] = p.id);

            let numOffset = poolIndex * 50; 
            config.template.forEach(t => {
                STATE.matches.push({
                    id: globalMatchIdCounter++,
                    kategori: catName, pool: config.name,
                    matchNum: t.matchNum + numOffset,
                    babak: t.babak, col: t.col,
                    nextW: typeof t.nextW === 'number' ? t.nextW + numOffset : t.nextW,
                    nextL: typeof t.nextL === 'number' ? t.nextL + numOffset : t.nextL,
                    merahId: t.slot1 !== null ? finalSlots[t.slot1 - 1] : null,
                    putihId: t.slot2 !== null ? finalSlots[t.slot2 - 1] : null,
                    winnerId: null, loserId: null, status: 'pending', skorMerah: 0, skorPutih: 0
                });
            });
        });

        // TAHAP FINAL: SINKRONISASI
        processAutoWins(catName); 
        saveToLocalStorage(); // Ini yang akan mengirim bagan ke semua laptop
        renderVisualBracket(catName);
        alert(`Bagan berhasil di-generate secara Real-time!`);
    } catch(err) { 
        console.error(err);
        alert("Gagal generate bagan. Cek Console browser.");
    }
}
function resetNilaiKategoriLokal() {
    const catName = document.getElementById('draw-select-kategori').value;
    if(!catName) return alert("Pilih kategori terlebih dahulu.");
    const categoryObj = STATE.categories.find(c => c.name === catName);
    if(!categoryObj) return;

    if(!confirm(`⚠️ PERHATIAN!\nAnda akan MENGHAPUS SEMUA HASIL NILAI di kategori "${catName}".\n\nBagan atau Urutan Tampil TIDAK AKAN BERUBAH.\n\nApakah Anda yakin ingin mengosongkan nilai?`)) return;

    if(categoryObj.discipline === 'randori') {
        STATE.matches = STATE.matches.filter(m => !(m.kategori === catName && m.babak === "SUDDEN DEATH"));
        let catMatches = STATE.matches.filter(m => m.kategori === catName);
        catMatches.forEach(m => {
            if(m.col > 1) { m.merahId = null; m.putihId = null; }
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
    if(event) event.stopPropagation();
    let match = STATE.matches.find(m => m.id === matchId);
    if(!match) return;
    let hasStarted = STATE.matches.some(x => x.kategori === match.kategori && x.status === 'done');
    if(hasStarted) return alert("❌ PERINGATAN DIRECTOR:\nTidak bisa menukar posisi! Turnamen di kategori ini sudah berjalan.\n\nKosongkan seluruh nilai jika Anda harus menukar posisi.");
    if(!SWAP_SELECTION) {
        SWAP_SELECTION = { matchId, corner, participantId };
        renderVisualBracket(match.kategori); 
    } else {
        if(SWAP_SELECTION.matchId === matchId && SWAP_SELECTION.corner === corner) {
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
        if(m.col > 1) { m.merahId = null; m.putihId = null; }
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
        if(actualLoserId && actualLoserId !== -1) {
            let loserP = STATE.participants.find(p => p.id === actualLoserId);
            if (loserP) loserP.losses += 1;
        }
    });
    saveToLocalStorage();
}

function undoMatchResult(matchId) {
    let match = STATE.matches.find(m => m.id === matchId);
    if(!match || match.status !== 'done') return;

    if(!confirm(`⚠️ Batalkan hasil pertandingan G-${match.matchNum % 50 === 0 ? 50 : match.matchNum % 50}?`)) return;

    let nextWMatch = STATE.matches.find(m => m.kategori === match.kategori && m.matchNum === match.nextW && m.pool === match.pool);
    let nextLMatch = STATE.matches.find(m => m.kategori === match.kategori && m.matchNum === match.nextL && m.pool === match.pool);

    if(nextWMatch && nextWMatch.status !== 'pending' && nextWMatch.status !== 'auto-win') { return alert("❌ UNDO DITOLAK:\nPartai lanjutan dari pemenang sudah terlanjur dimainkan."); }
    if(nextLMatch && nextLMatch.status !== 'pending' && nextLMatch.status !== 'auto-win') { return alert("❌ UNDO DITOLAK:\nPartai lanjutan dari yang kalah sudah terlanjur dimainkan."); }

    if(nextWMatch) {
        if(nextWMatch.merahId === match.winnerId) nextWMatch.merahId = null;
        if(nextWMatch.putihId === match.winnerId) nextWMatch.putihId = null;
    }
    
    let loserId = match.loserId;
    if (!loserId) { loserId = (match.winnerId === match.merahId) ? match.putihId : match.merahId; }
    
    if(nextLMatch && loserId) {
        if(nextLMatch.merahId === loserId) nextLMatch.merahId = null;
        if(nextLMatch.putihId === loserId) nextLMatch.putihId = null;
    }

    if(match.nextW === 'WINNER') {
        STATE.matches = STATE.matches.filter(m => !(m.kategori === match.kategori && m.pool === match.pool && m.babak === "SUDDEN DEATH"));
    }

    match.status = 'pending'; match.winnerId = null; match.loserId = null; match.skorMerah = 0; match.skorPutih = 0;
    
    recalculateAllLosses(match.kategori);
    processAutoWins(match.kategori);
    
    saveToLocalStorage(); renderVisualBracket(match.kategori); filterPesertaScoring();
}

function forwardParticipant(targetMatchNum, participantId, catName, poolName) {
    if(!targetMatchNum || targetMatchNum === 'WINNER' || targetMatchNum === 'SECOND' || participantId === null) return;
    let targetMatch = STATE.matches.find(m => m.kategori === catName && m.matchNum === targetMatchNum && m.pool === poolName);
    if(targetMatch) {
        if(participantId !== -1 && (targetMatch.merahId === participantId || targetMatch.putihId === participantId)) return; 
        if(targetMatch.merahId === null) targetMatch.merahId = participantId;
        else if(targetMatch.putihId === null) targetMatch.putihId = participantId;
    }
}

function processAutoWins(catName) {
    let changed = true; let loopGuard = 0;
    while(changed && loopGuard < 100) {
        changed = false; loopGuard++;
        STATE.matches.filter(m => m.kategori === catName && m.status === 'pending').forEach(match => {
            if(match.merahId !== null && match.putihId !== null) {
                if(match.merahId === -1 || match.putihId === -1) {
                    match.status = 'auto-win';
                    if(match.merahId === -1 && match.putihId === -1) { match.winnerId = -1; match.loserId = -1; } 
                    else { match.winnerId = match.merahId === -1 ? match.putihId : match.merahId; match.loserId = -1; }
                    
                    forwardParticipant(match.nextW, match.winnerId, catName, match.pool);
                    if(match.nextL) forwardParticipant(match.nextL, match.loserId, catName, match.pool);
                    changed = true; 
                }
            }
        });
    }
    recalculateAllLosses(catName);
}

function renderVisualBracket(catName) {
    const container = document.getElementById('randori-bracket-view');
    const wrapper = document.getElementById('randori-bracket-container');
    
    try {
        wrapper.classList.remove('hidden'); container.innerHTML = ''; 
        const catMatches = STATE.matches.filter(m => m.kategori === catName);
        if(catMatches.length === 0) return;

        let pools = []; catMatches.forEach(m => { if(pools.indexOf(m.pool) === -1) pools.push(m.pool); });
        
        pools.forEach(poolName => {
            let poolMatches = catMatches.filter(m => m.pool === poolName);
            
            let poolHTML = `<div class="mb-10 w-full min-w-max">
                <div class="flex items-center gap-3 mb-4 border-b border-slate-700 pb-2">
                    <h3 class="text-xl font-black text-yellow-400 m-0">BAGAN ${poolName !== '-' ? 'POOL ' + poolName : 'UTAMA'}</h3>
                    <span class="text-[10px] text-slate-500 font-mono ml-2 border-l border-slate-700 pl-3">Swap: Klik Nama | Undo: Klik <i class="fas fa-undo text-red-400 mx-1"></i></span>
                    <button onclick="resetNilaiKategoriLokal()" class="ml-auto bg-red-900/50 border border-red-700 text-red-400 hover:bg-red-500 hover:text-white w-7 h-7 rounded flex items-center justify-center transition-colors" title="Kosongkan Nilai Saja (Bagan Tetap)">
                        <i class="fas fa-eraser text-xs"></i>
                    </button>
                </div>
                <div class="flex gap-8 pb-4">`;
            
            let columns = [];
            poolMatches.forEach(m => { if(columns.indexOf(m.col) === -1) columns.push(m.col); });
            columns.sort((a,b) => a-b);
            let maxCol = columns[columns.length - 1];

            columns.forEach(colNum => {
                let colMatches = poolMatches.filter(m => m.col === colNum).sort((a,b) => a.matchNum - b.matchNum);
                if(colMatches.length === 0) return;

                let colHTML = `<div class="flex flex-col gap-6 justify-center min-w-[240px]">`;
                colHTML += `<h4 class="text-center text-xs font-bold uppercase text-slate-500 mb-2">Babak ${colNum}</h4>`;
                
                colMatches.forEach(m => {
                    let displayNum = m.matchNum % 50 === 0 ? 50 : m.matchNum % 50; 
                    let pMerah = STATE.participants.find(p => p.id === m.merahId);
                    let nMerahRaw = m.merahId === -1 ? "BYE" : (pMerah ? pMerah.nama : (m.merahId ? "Hantu" : "Menunggu..."));
                    let pPutih = STATE.participants.find(p => p.id === m.putihId);
                    let nPutihRaw = m.putihId === -1 ? "BYE" : (pPutih ? pPutih.nama : (m.putihId ? "Hantu" : "Menunggu..."));
                    
                    let bgStyle = m.status === 'done' ? 'border-green-500 bg-slate-800' : m.status === 'auto-win' ? 'border-slate-600 bg-slate-900 opacity-50' : 'border-blue-500 bg-slate-800';
                    let wMerah = m.winnerId === m.merahId ? 'text-green-400' : m.winnerId && m.winnerId !== m.merahId ? 'text-slate-500 line-through' : 'text-red-400';
                    let wPutih = m.winnerId === m.putihId ? 'text-green-400' : m.winnerId && m.winnerId !== m.putihId ? 'text-slate-500 line-through' : 'text-white';

                    let isInteractive = (m.col === 1 && m.status === 'pending');
                    let activeM = (SWAP_SELECTION && SWAP_SELECTION.matchId === m.id && SWAP_SELECTION.corner === 'merah') ? 'bg-yellow-600/80 px-1 rounded text-white shadow-[0_0_10px_rgba(234,179,8,0.5)]' : '';
                    let activeP = (SWAP_SELECTION && SWAP_SELECTION.matchId === m.id && SWAP_SELECTION.corner === 'putih') ? 'bg-yellow-600/80 px-1 rounded text-white shadow-[0_0_10px_rgba(234,179,8,0.5)]' : '';
                    let cursorM = isInteractive ? `cursor-pointer hover:text-yellow-400 border-b border-dashed border-slate-500 ${activeM}` : '';
                    let cursorP = isInteractive ? `cursor-pointer hover:text-yellow-400 border-b border-dashed border-slate-500 ${activeP}` : '';
                    
                    let nMerahHTML = `<span class="${wMerah} truncate w-32 ${cursorM}" ${isInteractive ? `onclick="handleSwap(${m.id}, 'merah', ${m.merahId}, event)" title="Klik untuk Tukar"` : ''}>${nMerahRaw}</span>`;
                    let nPutihHTML = `<span class="${wPutih} truncate w-32 ${cursorP}" ${isInteractive ? `onclick="handleSwap(${m.id}, 'putih', ${m.putihId}, event)" title="Klik untuk Tukar"` : ''}>${nPutihRaw}</span>`;

                    let undoBtn = m.status === 'done' ? `<button onclick="undoMatchResult(${m.id})" class="absolute -bottom-2 -right-2 bg-red-600 hover:bg-red-500 text-white text-[10px] w-7 h-7 rounded-full shadow-lg border border-slate-800 z-10 flex items-center justify-center transition-transform hover:scale-110" title="Batalkan Hasil Partai Ini"><i class="fas fa-undo"></i></button>` : '';

                    colHTML += `
                        <div class="bracket-match p-3 rounded-lg border-2 ${bgStyle} relative shadow-lg transition-all">
                            <span class="absolute -top-3 -left-3 bg-slate-700 text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-black border border-slate-500">G${displayNum}</span>
                            ${undoBtn}
                            <span class="text-[9px] uppercase text-slate-400 block mb-2 font-bold">${m.babak}</span>
                            <div class="flex justify-between items-center text-sm font-bold border-b border-slate-700 pb-1 mb-1">
                                ${nMerahHTML}
                                <span class="text-xs text-slate-500">${m.skorMerah > 0 ? m.skorMerah : ''}</span>
                            </div>
                            <div class="flex justify-between items-center text-sm font-bold">
                                ${nPutihHTML}
                                <span class="text-xs text-slate-500">${m.skorPutih > 0 ? m.skorPutih : ''}</span>
                            </div>
                        </div>
                    `;
                });
                colHTML += `</div>`;
                if(colNum < maxCol) colHTML += `<div class="flex flex-col justify-center"><div class="w-8 border-b-2 border-slate-600"></div></div>`;
                poolHTML += colHTML;
            });
            poolHTML += `</div></div>`;
            container.innerHTML += poolHTML;
        });
    } catch (err) { console.error(err); }
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
            <button onclick="resetNilaiKategoriLokal()" class="bg-red-900/50 border border-red-700 text-red-400 hover:bg-red-500 hover:text-white w-8 h-8 rounded flex items-center justify-center transition-colors shadow-sm" title="Kosongkan Nilai (Urutan Tetap)"><i class="fas fa-eraser text-sm"></i></button>
        </div>
        <div class="grid grid-cols-1 ${gridCols} gap-6 bg-slate-900 p-5">`;

    poolsConfig.forEach(pool => {
        let borderColor = pool.isFinal ? 'border-yellow-600' : 'border-slate-600'; 
        let titleColor = pool.isFinal ? 'text-yellow-500' : 'text-purple-400'; 
        html += `<div class="bg-slate-800 p-4 md:p-5 rounded-xl border ${borderColor} shadow-sm w-full h-full flex flex-col">
            <h3 class="font-black text-center ${titleColor} mb-4 border-b border-slate-700 pb-3">${pool.title}</h3>
            <div class="space-y-3 flex-1">`; 
        pool.data.forEach((p) => { 
            let noUrut = pool.isFinal ? p.urutFinal : p.urut; 
            html += `<div class="flex flex-col xl:flex-row items-start xl:items-center justify-between text-sm p-3 bg-slate-900/50 rounded-lg border border-slate-700/50 gap-3 hover:bg-slate-700/30 transition-colors">
                <div class="flex gap-3 items-start w-full">
                    <span class="font-mono text-slate-500 w-5 text-right flex-shrink-0 pt-0.5">${noUrut}.</span>
                    <span class="font-bold text-white whitespace-normal break-words leading-snug">${p.nama}</span>
                </div>
                <div class="flex justify-start xl:justify-end w-full xl:w-auto pl-8 xl:pl-0">
                    <span class="text-[10px] text-slate-400 bg-slate-800 px-2 py-1 rounded border border-slate-700 whitespace-nowrap shadow-sm">${p.kontingen}</span>
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
    const panelEmbu = document.getElementById('draw-panel-embu'); const panelRandori = document.getElementById('draw-panel-randori'); const panelEmpty = document.getElementById('draw-panel-empty'); const resultDiv = document.getElementById('drawing-result'); 
    panelEmbu.classList.add('hidden'); panelRandori.classList.add('hidden'); panelEmpty.classList.add('hidden'); resultDiv.innerHTML = ''; document.getElementById('randori-bracket-container').classList.add('hidden');
    
    // Injeksi Tombol Unduh Jadwal
    let drawHeader = document.querySelector('#section-drawing > div:first-child');
    let microDrawBtn = document.getElementById('btn-micro-draw-export');
    if (!microDrawBtn && drawHeader) {
        microDrawBtn = document.createElement('button');
        microDrawBtn.id = 'btn-micro-draw-export';
        microDrawBtn.className = 'w-full md:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm flex items-center justify-center gap-2 mt-4 md:mt-0';
        microDrawBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH JADWAL';
        microDrawBtn.onclick = () => exportDrawingCSV(document.getElementById('draw-select-kategori').value);
        drawHeader.appendChild(microDrawBtn);
    }
    
    if(!catName) { 
        panelEmpty.classList.remove('hidden'); 
        if(microDrawBtn) microDrawBtn.classList.add('hidden');
        return; 
    }
    
    if(microDrawBtn) microDrawBtn.classList.remove('hidden');
    
    const categoryObj = STATE.categories.find(c => c.name === catName); let list = STATE.participants.filter(p => p.kategori === catName); 
    
    if(categoryObj && categoryObj.discipline === 'randori') { 
        panelRandori.classList.remove('hidden'); 
        renderVisualBracket(catName); 
    } else { 
        panelEmbu.classList.remove('hidden'); 
        const isFinalMode = list.some(p => p.isFinalist); 
        if (isFinalMode) { 
            let finalL = list.filter(p => p.isFinalist); 
            if (finalL.some(p => p.urutFinal > 0)) { 
                finalL.sort((a,b) => a.urutFinal - b.urutFinal); 
                renderEmbuLayout(catName, resultDiv, [{data: finalL, title: "POOL FINAL", isFinal: true}]);
            } else { 
                resultDiv.innerHTML = `<div class="col-span-full text-center text-yellow-500 py-10 border-2 border-dashed border-yellow-600 rounded-xl">Peserta Final dipilih. Klik Acak Urutan.</div>`; 
            } 
        } else if (list.some(p => p.urut > 0)) { 
            list.sort((a,b) => a.urut - b.urut); 
            if(list.some(p => p.pool === 'A' || p.pool === 'B')) { 
                renderEmbuLayout(catName, resultDiv, [ {data: list.filter(p => p.pool === 'A'), title: "POOL A", isFinal: false}, {data: list.filter(p => p.pool === 'B'), title: "POOL B", isFinal: false} ]);
            } else { 
                renderEmbuLayout(catName, resultDiv, [{data: list, title: "BABAK PENYISIHAN", isFinal: false}]);
            } 
        } else { 
            resultDiv.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Belum diundi.</div>`; 
        } 
    }
}

function startDrawing() { 
    const catName = document.getElementById('draw-select-kategori').value; 
    if(!catName) return alert("Pilih kategori!"); 
    let list = STATE.participants.filter(p => p.kategori === catName); 
    if(list.length === 0) return alert("Belum ada peserta!"); 
    
    const isFinalMode = list.some(p => p.isFinalist); 
    if (isFinalMode) { 
        let finalL = list.filter(p => p.isFinalist); 
        if (finalL.some(p => p.urutFinal > 0)) if (!confirm("⚠️ Finalis SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return; 
        shuffleArray(finalL); 
        finalL.forEach((p, index) => { const idx = STATE.participants.findIndex(x => x.id === p.id); STATE.participants[idx].urutFinal = index + 1; }); 
    } else { 
        if (list.some(p => p.urut > 0)) { 
            if (!confirm("⚠️ Kategori ini SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return; 
            list.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 } }; p.finalScore = 0; p.techScore = 0; }); 
        } 
        shuffleArray(list); 
        if (list.length > 6) { 
            const half = Math.ceil(list.length / 2); 
            const poolA = list.slice(0, half); 
            const poolB = list.slice(half); 
            applyDrawingData(poolA, 'A'); applyDrawingData(poolB, 'B'); 
        } else { 
            applyDrawingData(list, 'SINGLE'); 
        } 
    } 
    saveToLocalStorage(); checkExistingDrawing(); renderParticipantTable(); 
}

function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
function applyDrawingData(arr, poolName) { arr.forEach((p, index) => { const found = STATE.participants.find(item => item.id === p.id); if(found) { found.urut = index + 1; found.pool = poolName; }}); }

function filterPesertaScoring() {
    const catName = document.getElementById('select-kategori').value;
    const categoryObj = STATE.categories.find(c => c.name === catName);
    const selectEl = document.getElementById('select-peserta');
    
    if(!categoryObj || !selectEl) return;

    // Reset pilihan agar tidak terjadi tabrakan data lama
    selectEl.innerHTML = '';

    if(categoryObj.discipline === 'randori') {
        // Ambil partai yang statusnya masih 'pending' dan bukan BYE (-1)
        let catMatches = STATE.matches.filter(m => 
            m.kategori === catName && 
            m.status === 'pending' && 
            m.merahId !== null && m.putihId !== null && 
            m.merahId !== -1 && m.putihId !== -1
        );

        if(catMatches.length === 0) {
            selectEl.innerHTML = `<option value="">-- Tidak ada partai aktif --</option>`;
            return;
        }

        // Mapping partai ke Dropdown dengan pengecekan data atlet yang aman
        selectEl.innerHTML = catMatches.sort((a,b) => a.matchNum - b.matchNum).map((m) => {
            const mrh = STATE.participants.find(p => p.id === m.merahId);
            const pth = STATE.participants.find(p => p.id === m.putihId);
            
            // PROTEKSI: Jika salah satu atlet tidak ditemukan, jangan tampilkan agar tidak crash
            if (!mrh || !pth) return ''; 

            let displayNum = m.matchNum % 50 === 0 ? 50 : m.matchNum % 50;
            let pLabel = m.pool !== '-' ? `Pool ${m.pool}` : 'Utama';
            return `<option value="match-${m.id}">G-${displayNum} [${pLabel}] ${mrh.nama} vs ${pth.nama}</option>`;
        }).join('');

    } else {
        // Bagian Embu (Sama seperti V15.1 Anda, tapi ditambahkan pengecekan aman)
        let listCat = STATE.participants.filter(p => p.kategori === catName && p.urut > 0);
        if(listCat.length === 0) {
            selectEl.innerHTML = `<option value="">-- Belum ada urutan tampil --</option>`;
            return;
        }
        
        selectEl.innerHTML = listCat.sort((a,b) => a.urut - b.urut).map(p => {
            return `<option value="${p.id}">${p.urut}. ${p.nama} (${p.kontingen})</option>`;
        }).join('');
    }

    // Trigger perubahan untuk me-load board scoring
    selectEl.dispatchEvent(new Event('change'));
}

let currentRandoriMatchId = null;
function loadRandoriMatch() {
    const val = document.getElementById('select-peserta').value; if(!val || !val.startsWith('match-')) return;
    currentRandoriMatchId = parseInt(val.replace('match-', '')); const match = STATE.matches.find(m => m.id === currentRandoriMatchId); if(!match) return;

    const merah = STATE.participants.find(p => p.id === match.merahId); const putih = STATE.participants.find(p => p.id === match.putihId);
    document.getElementById('randori-nama-merah').innerText = merah ? merah.nama : "-"; document.getElementById('randori-kont-merah').innerText = merah ? merah.kontingen : "-";
    document.getElementById('randori-nama-putih').innerText = putih ? putih.nama : "-"; document.getElementById('randori-kont-putih').innerText = putih ? putih.kontingen : "-";
    resetRandoriBoard(); 
}

function resetRandoriBoard() { RANDORI_STATE = { merah: { score: 0 }, putih: { score: 0 } }; updateRandoriUI(); }
function addRandoriScore(corner, points) { RANDORI_STATE[corner].score += points; if(RANDORI_STATE[corner].score < 0) RANDORI_STATE[corner].score = 0; updateRandoriUI(); }
function updateRandoriUI() { document.getElementById('score-merah').innerText = RANDORI_STATE.merah.score; document.getElementById('score-putih').innerText = RANDORI_STATE.putih.score; }

function saveRandoriMatchResult() {
    if(!currentRandoriMatchId) return alert("Pilih partai!");
    const match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if(!match) return;

    let sMerah = RANDORI_STATE.merah.score; let sPutih = RANDORI_STATE.putih.score;
    if(sMerah === sPutih) return alert("Skor seri! Randori tidak bisa berakhir seri. Tambahkan poin hukuman/kemenangan (Ippon/Waza-ari/Batsu).");

    let winnerId = sMerah > sPutih ? match.merahId : match.putihId;
    let loserId = sMerah > sPutih ? match.putihId : match.merahId;
    let winnerName = sMerah > sPutih ? "PITA MERAH (AKA)" : "PITA PUTIH (SHIRO)";

    if(confirm(`Konfirmasi Pemenang: ${winnerName}\nSkor: ${sMerah} - ${sPutih}\n\nLanjutkan?`)) {
        match.skorMerah = sMerah; match.skorPutih = sPutih; 
        match.winnerId = winnerId; match.loserId = loserId; 
        match.status = 'done';
        
        recalculateAllLosses(match.kategori);
        
        let winnerP = STATE.participants.find(p => p.id === winnerId);
        let isGrandFinal = match.nextW === 'WINNER' && match.babak !== "SUDDEN DEATH";
        let isChallenger = winnerP && winnerP.losses > 0;
        
        if(isGrandFinal && isChallenger) {
            alert("TIE BREAKER GRAND FINAL!\nAtlet dari jalur bawah memenangkan pertandingan. Sistem otomatis membuka Partai Sudden Death!");
            STATE.matches = STATE.matches.filter(m => !(m.kategori === match.kategori && m.pool === match.pool && m.babak === "SUDDEN DEATH"));
            let extraMatch = { id: Date.now(), kategori: match.kategori, pool: match.pool, matchNum: match.matchNum + 1, babak: "SUDDEN DEATH", col: match.col + 1, nextW: 'WINNER', nextL: 'SECOND', merahId: match.merahId, putihId: match.putihId, winnerId: null, status: 'pending', skorMerah: 0, skorPutih: 0 };
            STATE.matches.push(extraMatch);
        } else {
            forwardParticipant(match.nextW, winnerId, match.kategori, match.pool); 
            if(match.nextL) forwardParticipant(match.nextL, loserId, match.kategori, match.pool); 
        }

        processAutoWins(match.kategori); saveToLocalStorage(); alert("Partai Selesai! Pemenang dicatat."); filterPesertaScoring(); checkExistingDrawing();
    }
}

document.getElementById('select-peserta').addEventListener('change', (e) => { if(e.target.selectedIndex >= 0) { document.getElementById('scoring-athlete-name').innerText = e.target.options[e.target.selectedIndex].text; if(e.target.value.startsWith('match-')) loadRandoriMatch(); else updateScoringButtonsUI(); }});

function updateScoringButtonsUI() { const pId = parseInt(document.getElementById('select-peserta').value); const selectBabak = document.getElementById('select-babak'); const btnB1 = document.getElementById('btn-save-b1'); const btnB2 = document.getElementById('btn-save-b2'); const btnPen = document.getElementById('btn-save-penyisihan'); const btnFin = document.getElementById('btn-save-final'); if(!pId || !selectBabak || !btnB1) return; const p = STATE.participants.find(i => i.id === pId); selectBabak.innerHTML = ''; const isFinalMode = STATE.participants.some(x => x.kategori === p.kategori && x.isFinalist); if(isFinalMode && p.isFinalist) selectBabak.innerHTML = `<option value="b2">Babak Final</option>`; else if(p.pool === 'A' || p.pool === 'B') selectBabak.innerHTML = `<option value="b1">Babak Penyisihan</option>`; else selectBabak.innerHTML = `<option value="b1">Babak 1</option><option value="b2">Babak 2</option>`; btnB1.classList.add('hidden'); btnB2.classList.add('hidden'); btnPen.classList.add('hidden'); btnFin.classList.add('hidden'); if(isFinalMode && p.isFinalist) btnFin.classList.remove('hidden'); else if(p.pool === 'A' || p.pool === 'B') btnPen.classList.remove('hidden'); else { btnB1.classList.remove('hidden'); btnB2.classList.remove('hidden'); } loadExistingScores(); }
function setJudges(n) { STATE.settings.numJudges = n; document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white'; document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white'; const container = document.getElementById('judge-inputs'); container.innerHTML = ''; for(let i=1; i<=n; i++) { container.innerHTML += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-600 focus-within:border-blue-500 transition-colors"><div class="text-center mb-2 pb-2 border-b border-slate-700"><label class="block text-[10px] text-slate-400 uppercase font-bold">Wasit ${i}</label></div><div class="space-y-2"><div><label class="block text-[9px] text-slate-500 mb-1">TOTAL NILAI</label><input type="number" step="0.5" id="score-${i}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-2xl font-black outline-none text-center text-white placeholder-slate-700" placeholder="0"></div><div><label class="block text-[9px] text-slate-500 mb-1 flex justify-between"><span>TEKNIK</span> ${i===1?'<span class="text-yellow-500 font-bold">TIE-BREAK</span>':''}</label><input type="number" step="0.5" id="tech-${i}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-sm font-bold outline-none text-center ${i===1?'text-yellow-400':'text-blue-300'} placeholder-slate-700" placeholder="Opsional"></div></div></div>`; } calculateLive(); }
function loadExistingScores() { const pId = parseInt(document.getElementById('select-peserta').value); const babak = document.getElementById('select-babak').value; if(!pId || !babak) return; const p = STATE.participants.find(i => i.id === pId); const scoreData = p.scores[babak]; if(scoreData && scoreData.raw && scoreData.raw.length > 0) { const nJudges = scoreData.raw.length; if(STATE.settings.numJudges !== nJudges) setJudges(nJudges); for(let i=1; i<=nJudges; i++) { let sEl = document.getElementById(`score-${i}`); let tEl = document.getElementById(`tech-${i}`); if(sEl) sEl.value = scoreData.raw[i-1] || ''; if(tEl) tEl.value = (scoreData.techRaw && scoreData.techRaw[i-1]) ? scoreData.techRaw[i-1] : ''; } UI.timerSeconds = scoreData.time || 0; updateTimerUI(); } else { for(let i=1; i<=STATE.settings.numJudges; i++) { let sEl = document.getElementById(`score-${i}`); let tEl = document.getElementById(`tech-${i}`); if(sEl) sEl.value = ''; if(tEl) tEl.value = ''; } UI.timerSeconds = 0; updateTimerUI(); } calculateLive(); }

function calculateLive() { 
    let raw = []; let techRaw = []; 
    for(let i=1; i<=STATE.settings.numJudges; i++) { 
        let sEl = document.getElementById(`score-${i}`); let tEl = document.getElementById(`tech-${i}`);
        raw.push(sEl ? (parseFloat(sEl.value) || 0) : 0); techRaw.push(tEl ? (parseFloat(tEl.value) || 0) : 0); 
    } 
    let sum = 0; 
    if(STATE.settings.numJudges === 5) { let sorted = [...raw].sort((a,b) => a-b); sorted.pop(); sorted.shift(); sum = sorted.reduce((a,b) => a+b, 0); } 
    else { sum = raw.reduce((a,b) => a+b, 0); } 
    
    let minEl = document.getElementById('min-time'); let maxEl = document.getElementById('max-time');
    const minT = minEl ? (parseInt(minEl.value) || 0) : 0; const maxT = maxEl ? (parseInt(maxEl.value) || 0) : 0; 
    
    let penalty = 0; 
    if(UI.timerSeconds > 0 && minT > 0 && UI.timerSeconds < minT) { penalty = Math.ceil((minT - UI.timerSeconds) / 5) * 5; } 
    else if (maxT > 0 && UI.timerSeconds > maxT) { penalty = Math.ceil((UI.timerSeconds - maxT) / 5) * 5; }
    
    const final = Math.max(0, sum - penalty); 
    let finalEl = document.getElementById('live-final-score'); if(finalEl) finalEl.innerText = final.toFixed(1); 
    let penEl = document.getElementById('live-penalty'); if(penEl) penEl.innerText = penalty > 0 ? `Penalti Waktu: -${penalty}` : `Penalti Waktu: 0`; 
    return { final, penalty, raw, techRaw, tieBreaker: techRaw[0] }; 
}

function saveScore(babakOverride) { 
    const pId = parseInt(document.getElementById('select-peserta').value); if(!pId) return alert('Pilih atlet!'); 
    let babak = document.getElementById('select-babak').value; if(babakOverride === 1 || babakOverride === 2) babak = `b${babakOverride}`; 
    for(let i=1; i<=STATE.settings.numJudges; i++) { let sEl = document.getElementById(`score-${i}`); if(sEl && sEl.value === "") return alert(`TOTAL NILAI Wasit ${i} kosong!`); }
        
    const calc = calculateLive(); const p = STATE.participants.find(i => i.id === pId); 
    p.scores[babak] = { raw: calc.raw, techRaw: calc.techRaw, penalty: calc.penalty, final: calc.final, tech: calc.tieBreaker, time: UI.timerSeconds }; 
    
    if (p.isFinalist) { p.finalScore = p.scores.b2.final; p.techScore = p.scores.b2.tech; } 
    else if (p.pool === 'A' || p.pool === 'B') { p.finalScore = p.scores.b1.final; p.techScore = p.scores.b1.tech; } 
    else { 
        if(p.scores.b1.final > 0 && p.scores.b2.final > 0) { p.finalScore = (p.scores.b1.final + p.scores.b2.final) / 2; p.techScore = (p.scores.b1.tech + p.scores.b2.tech) / 2; } 
        else { p.finalScore = p.scores[babak].final; p.techScore = p.scores[babak].tech; } 
    } 
    saveToLocalStorage(); alert(`SKOR TERSIMPAN!`); clearInterval(UI.timerInterval); UI.timerInterval = null; 
    document.getElementById('btn-timer').innerText = 'START'; document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold'; 
}

function toggleTimer() { const btn = document.getElementById('btn-timer'); if(UI.timerInterval) { clearInterval(UI.timerInterval); UI.timerInterval = null; btn.innerText = 'LANJUTKAN'; btn.classList.replace('bg-red-600', 'bg-yellow-600'); btn.classList.replace('hover:bg-red-500', 'hover:bg-yellow-500'); } else { UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000); btn.innerText = 'STOP'; btn.className = 'bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg w-full font-bold'; } }
function resetTimer() { clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI(); document.getElementById('btn-timer').innerText = 'START'; document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold'; calculateLive(); }
function updateTimerUI() { document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0')}:${(UI.timerSeconds % 60).toString().padStart(2, '0')}`; }

function calculateRandoriFinalists(catName) {
    let list = STATE.participants.filter(p => p.kategori === catName);
    let catMatches = STATE.matches.filter(m => m.kategori === catName);
    
    let grandFinals = catMatches.filter(m => m.nextW === 'WINNER').sort((a,b) => b.id - a.id);
    if(grandFinals.length === 0 || grandFinals[0].status !== 'done') return null;
    
    let gf = grandFinals[0];
    let juara1 = STATE.participants.find(p => p.id === gf.winnerId);
    let juara2 = STATE.participants.find(p => p.id === gf.loserId);
    let finalBawah = catMatches.find(m => m.babak.toUpperCase() === "FINAL BAWAH" || m.babak.toUpperCase() === "LB FINAL");
    let juara3a = (finalBawah && finalBawah.status === 'done') ? STATE.participants.find(p => p.id === finalBawah.loserId) : null;
    let lbSFinal = catMatches.find(m => m.babak.toUpperCase() === "LB SEMI-FINAL" || m.babak.toUpperCase() === "LB S-FINAL" || m.babak.toUpperCase() === "LB SF" || m.babak.toUpperCase() === "LB R1");
    let juara3b = (lbSFinal && lbSFinal.status === 'done') ? STATE.participants.find(p => p.id === lbSFinal.loserId) : null;

    return { emas: juara1 ? juara1.nama : null, perak: juara2 ? juara2.nama : null, perunggu: [juara3a ? juara3a.nama : null, juara3b ? juara3b.nama : null].filter(n => n !== null) };
}

function cancelFinalist() {
    const filter = document.getElementById('rank-filter-kategori').value;
    if(!filter) return;
    if(!confirm("⚠️ Batalkan status finalis untuk kategori ini?\nData akan dikembalikan ke Pool awal.")) return;
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
    if(changed) { saveToLocalStorage(); alert("Status Finalis dibatalkan!"); renderRanking(); checkExistingDrawing(); filterPesertaScoring(); }
}

function promoteToFinal() {
    const filter = document.getElementById('rank-filter-kategori').value;
    if(!filter) return alert("Pilih kategori spesifik terlebih dahulu!");
    const catObj = STATE.categories.find(c => c.name === filter);
    if(catObj && catObj.discipline === 'randori') return alert("Tindakan ini hanya untuk nomor Embu.");
    let list = STATE.participants.filter(p => p.kategori === filter && (p.pool === 'A' || p.pool === 'B'));
    if(list.length === 0) return alert("Kategori ini tidak memiliki sistem Pool penyisihan.");
    if(list.some(p => p.isFinalist)) return alert("Finalis sudah ditetapkan!");
    
    let numFinalists = parseInt(prompt("Masukkan JUMLAH finalis DARI MASING-MASING POOL (misal: 3):", "3"));
    if(!numFinalists || isNaN(numFinalists) || numFinalists <= 0) return;
    
    let poolA = list.filter(p => p.pool === 'A' && p.scores.b1.final > 0).sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
    let poolB = list.filter(p => p.pool === 'B' && p.scores.b1.final > 0).sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
    let combined = [...poolA.slice(0, numFinalists), ...poolB.slice(0, numFinalists)];
    
    if(combined.length === 0) return alert("Tidak ada data nilai.");
    if(confirm("Tetapkan " + combined.length + " peserta ini sebagai Finalis?")) {
        combined.forEach(w => { let p = STATE.participants.find(x => x.id === w.id); if(p) { p.isFinalist = true; p.urutFinal = 0; } });
        saveToLocalStorage(); alert("Finalis ditetapkan!"); renderRanking(); checkExistingDrawing(); filterPesertaScoring();
    }
}

// INJEKSI DOM UNTUK TOMBOL UNDUH HASIL (MIKRO)
function renderRanking() { 
    const filter = document.getElementById('rank-filter-kategori').value; 
    const btnPromote = document.getElementById('btn-promote-final'); 
    const container = document.getElementById('ranking-list'); 

    // Injeksi Tombol Unduh Hasil
    let microRankBtn = document.getElementById('btn-micro-rank-export');
    if (!microRankBtn && btnPromote && btnPromote.parentElement) {
        microRankBtn = document.createElement('button');
        microRankBtn.id = 'btn-micro-rank-export';
        microRankBtn.className = 'whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm flex items-center justify-center gap-2';
        microRankBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH HASIL';
        microRankBtn.onclick = () => exportHasilCSV(document.getElementById('rank-filter-kategori').value);
        btnPromote.parentElement.appendChild(microRankBtn);
    }

    if (!filter) {
        btnPromote.classList.add('hidden');
        if(microRankBtn) microRankBtn.classList.add('hidden');
        return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl"><i class="fas fa-filter text-3xl mb-3 text-slate-600 block"></i>Pilih kategori pertandingan di atas untuk melihat hasil klasemen.</div>`;
    }
    
    if(microRankBtn) microRankBtn.classList.remove('hidden');

    let catObj = STATE.categories.find(c => c.name === filter);
    let catList = STATE.participants.filter(p => p.kategori === filter); 
    const hasPools = catList.some(p => p.pool === 'A' || p.pool === 'B' || (p.pool === 'FINAL' && p.urut > 0)); 
    const hasFinal = catList.some(p => p.isFinalist); 
    
    if(catObj && catObj.discipline === 'embu' && hasPools) {
        btnPromote.classList.remove('hidden');
        if(!hasFinal) {
            btnPromote.innerHTML = '<i class="fas fa-arrow-up mr-2"></i>TETAPKAN FINALIS';
            btnPromote.className = "whitespace-nowrap bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm";
            btnPromote.onclick = promoteToFinal;
        } else {
            btnPromote.innerHTML = '<i class="fas fa-undo mr-2"></i>BATALKAN FINALIS';
            btnPromote.className = "whitespace-nowrap bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm";
            btnPromote.onclick = cancelFinalist;
        }
    } else {
        btnPromote.classList.add('hidden'); 
    }

    let hasData = catList.some(p => p.scores.b1.final > 0 || p.losses > 0 || (catObj.discipline === 'randori' && calculateRandoriFinalists(filter)));

    if(!hasData) {
        if(catObj.discipline === 'randori') { return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Turnamen Randori belum selesai / belum ada medali.</div>`; } 
        else { return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data nilai di kategori ini.</div>`; }
    }

    let htmlOutput = `<h3 class="text-xl font-bold text-yellow-400 mt-4 mb-4 border-b-2 border-slate-700 pb-3 flex items-center gap-3"><span class="${catObj.discipline==='randori'?'bg-red-700':'bg-blue-600'} text-[10px] px-2 py-1 rounded font-black">${catObj.discipline.toUpperCase()}</span>${catObj.name}</h3>`;

    if(catObj.discipline === 'embu') {
        ['FINAL', 'SINGLE', 'A', 'B'].forEach(poolKey => { 
            let poolList = []; 
            if(poolKey === 'FINAL') { poolList = catList.filter(p => p.isFinalist); } 
            else if(poolKey === 'SINGLE') { poolList = catList.filter(p => p.pool === 'SINGLE' && p.scores.b1.final > 0); } 
            else { poolList = catList.filter(p => p.pool === poolKey && p.scores.b1.final > 0); }

            if(poolList.length === 0) return; 
            
            if(poolKey === 'FINAL') poolList.sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); 
            else poolList.sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech); 
            
            let poolTitle = poolKey === 'SINGLE' ? 'KLASEMEN AKHIR' : poolKey === 'FINAL' ? '<i class="fas fa-star text-yellow-400"></i> KLASEMEN FINAL' : `KLASEMEN POOL ${poolKey}`; 
            htmlOutput += `<h4 class="text-md font-bold text-blue-400 mt-6 mb-3 pl-2 border-l-4 border-blue-500">${poolTitle}</h4>`; 
            
            htmlOutput += poolList.map((p, i) => { 
                let scoreVal = poolKey === 'FINAL' ? p.scores.b2.final : p.scores.b1.final;
                let isWaiting = poolKey === 'FINAL' && scoreVal === 0;
                let medal = isWaiting ? `<span class="text-xl font-bold text-slate-600">-</span>` : i === 0 ? '<i class="fas fa-medal text-yellow-400 text-2xl"></i>' : i === 1 ? '<i class="fas fa-medal text-slate-300 text-2xl"></i>' : i === 2 ? '<i class="fas fa-medal text-amber-600 text-2xl"></i>' : `<span class="text-2xl font-black text-slate-600">${i+1}</span>`;
                let displayScore = isWaiting ? "000.0" : scoreVal.toFixed(2);
                let displayLabel = isWaiting ? "Menunggu Nilai" : "Nilai Akhir";
                let displayColor = isWaiting ? "text-slate-500" : "text-white";

                return `<div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4 mb-3 hover:bg-slate-800/50 transition-colors"><div class="w-12 text-center flex-shrink-0">${medal}</div><div class="flex-1 w-full"><div class="font-bold text-lg ${displayColor} whitespace-normal break-words">${p.nama} ${poolKey !== 'FINAL' && p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-2 py-0.5 rounded ml-2 shadow-sm font-black tracking-wide">LULUS FINAL</span>' : ''}</div><div class="text-xs text-slate-400 mt-1"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700 shadow-sm">${p.kontingen}</span></div></div><div class="flex gap-4 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700"><div class="text-center md:text-right flex-1"><div class="text-[10px] ${isWaiting ? 'text-slate-500' : 'text-green-400'} font-bold uppercase tracking-wider">${displayLabel}</div><div class="text-2xl font-black ${displayColor}">${displayScore}</div></div></div></div>`; 
            }).join(''); 
        }); 
    } else {
        const wins = calculateRandoriFinalists(catObj.name);
        if(!wins) { htmlOutput += `<div class="p-6 text-center text-slate-600 bg-slate-900/50 rounded-xl border border-slate-800 text-sm italic">Turnamen di kategori ini masih berlangsung.</div>`; } 
        else {
            htmlOutput += `<h4 class="text-md font-bold text-red-400 mt-6 mb-3 pl-2 border-l-4 border-red-500">PEMENANG MEDALI</h4>`;
            htmlOutput += `<div class="flex items-center bg-dark-card p-4 rounded-xl border border-yellow-600 gap-4 mb-3 bg-yellow-600/10"><div class="w-12 text-center flex-shrink-0"><i class="fas fa-medal text-yellow-400 text-3xl drop-shadow-[0_0_10px_rgba(234,179,8,0.5)]"></i></div><div class="flex-1"><div class="font-bold text-lg text-white whitespace-normal break-words">${wins.emas}</div><div class="text-xs text-slate-400 mt-1 uppercase font-bold text-yellow-500 tracking-wider">Juara 1 (Emas)</div></div></div>`;
            htmlOutput += `<div class="flex items-center bg-dark-card p-4 rounded-xl border border-slate-600 gap-4 mb-3 bg-slate-500/10"><div class="w-12 text-center flex-shrink-0"><i class="fas fa-medal text-slate-300 text-3xl drop-shadow-[0_0_10px_rgba(203,213,225,0.5)]"></i></div><div class="flex-1"><div class="font-bold text-lg text-white whitespace-normal break-words">${wins.perak}</div><div class="text-xs text-slate-400 mt-1 uppercase font-bold text-slate-300 tracking-wider">Juara 2 (Perak)</div></div></div>`;
            wins.perunggu.forEach(pName => { htmlOutput += `<div class="flex items-center bg-dark-card p-4 rounded-xl border border-amber-700 gap-4 mb-3 bg-amber-800/10"><div class="w-12 text-center flex-shrink-0"><i class="fas fa-medal text-amber-600 text-3xl drop-shadow-[0_0_10px_rgba(217,119,6,0.5)]"></i></div><div class="flex-1"><div class="font-bold text-lg text-white whitespace-normal break-words">${pName}</div><div class="text-xs text-slate-400 mt-1 uppercase font-bold text-amber-600 tracking-wider">Juara 3 Bersama (Perunggu)</div></div></div>`; });
        }
    }
    container.innerHTML = htmlOutput; 
}

function renderJuaraUmum() { 
    let tally = {}; 
    STATE.categories.forEach(cat => { 
        if(cat.discipline === 'embu') {
            let listCat = STATE.participants.filter(p => p.kategori === cat.name && p.isFinalist); 
            let wins = listCat.filter(p => p.scores.b2.final > 0).sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); 
            if(wins[0]) { tally[wins[0].kontingen] = tally[wins[0].kontingen] || {g:0, s:0, b:0}; tally[wins[0].kontingen].g++; } 
            if(wins[1]) { tally[wins[1].kontingen] = tally[wins[1].kontingen] || {g:0, s:0, b:0}; tally[wins[1].kontingen].s++; } 
            if(wins[2]) { tally[wins[2].kontingen] = tally[wins[2].kontingen] || {g:0, s:0, b:0}; tally[wins[2].kontingen].b++; } 
        } else {
            const isFinalCategory = cat.name.toUpperCase().includes('FINAL');
            if(!isFinalCategory) return; 
            const results = calculateRandoriFinalists(cat.name);
            if(!results) return; 
            if(results.emas) { let p = STATE.participants.find(x => x.nama === results.emas && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].g++; } }
            if(results.perak) { let p = STATE.participants.find(x => x.nama === results.perak && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].s++; } }
            results.perunggu.forEach(pName => { let p = STATE.participants.find(x => x.nama === pName && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].b++; } });
        }
    }); 

    let leaderboard = Object.keys(tally).map(kontingen => ({ nama: kontingen, emas: tally[kontingen].g, perak: tally[kontingen].s, perunggu: tally[kontingen].b, total: tally[kontingen].g + tally[kontingen].s + tally[kontingen].b })); 
    leaderboard.sort((a,b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu); 
    
    const tbody = document.getElementById('table-juara-body'); 
    if(leaderboard.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 border-b border-slate-700">Belum ada data medali disumbangkan.</td></tr>`; 
    tbody.innerHTML = leaderboard.map((k, i) => `<tr class="hover:bg-slate-800/50 transition-colors"><td class="p-4 text-center font-bold text-slate-500 border-b border-slate-800">${i+1}</td><td class="p-4 font-bold text-white border-b border-slate-800 text-lg whitespace-normal break-words">${k.nama}</td><td class="p-4 text-center font-black text-yellow-500 border-b border-slate-800 bg-yellow-500/10">${k.emas}</td><td class="p-4 text-center font-black text-slate-300 border-b border-slate-800 bg-slate-400/10">${k.perak}</td><td class="p-4 text-center font-black text-amber-600 border-b border-slate-800 bg-amber-600/10">${k.perunggu}</td><td class="p-4 text-center font-black text-blue-400 border-b border-slate-800">${k.total}</td></tr>`).join(''); 
}

// ---------------------------------------------------------
// CSV EXPORT LOGIC (MULTIFUNCTION: MICRO & MACRO)
// ---------------------------------------------------------
function downloadCSV(filename, rows) {
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = filename;
    link.click();
}

function exportDrawingCSV(filterCatName = null) {
    let rows = [["Disiplin", "Kategori", "Pool / Babak", "No. Urut / Partai", "Sudut Merah (AKA) / Atlet", "Sudut Putih (SHIRO) / Kontingen", "Status"]];
    let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;
    
    categoriesToExport.forEach(cat => {
        if (cat.discipline === 'embu') {
            let catParts = STATE.participants.filter(p => p.kategori === cat.name && p.urut > 0).sort((a,b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
            catParts.forEach(p => {
                let poolLabel = p.isFinalist && p.urutFinal > 0 ? "FINAL" : `Pool ${p.pool}`;
                let noUrut = p.isFinalist && p.urutFinal > 0 ? p.urutFinal : p.urut;
                rows.push(["EMBU", cat.name, poolLabel, noUrut, p.nama, p.kontingen, ""]);
            });
        } else {
            let catMatches = STATE.matches.filter(m => m.kategori === cat.name).sort((a,b) => a.matchNum - b.matchNum);
            catMatches.forEach(m => {
                let mrh = STATE.participants.find(x => x.id === m.merahId);
                let pth = STATE.participants.find(x => x.id === m.putihId);
                let nMrh = m.merahId === -1 ? "BYE" : (mrh ? mrh.nama : "Menunggu");
                let nPth = m.putihId === -1 ? "BYE" : (pth ? pth.nama : "Menunggu");
                let displayNum = m.matchNum % 50 === 0 ? 50 : m.matchNum % 50;
                let poolLabel = m.pool !== '-' ? `Pool ${m.pool}` : 'Utama';
                rows.push(["RANDORI", cat.name, `${poolLabel} - ${m.babak}`, `G-${displayNum}`, nMrh, nPth, m.status === 'done' ? "Selesai" : ""]);
            });
        }
    });
    let prefix = filterCatName ? `Jadwal_${filterCatName.replace(/[^a-zA-Z0-9]/g, '_')}` : `Semua_Jadwal_Pertandingan`;
    downloadCSV(`${prefix}_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportHasilCSV(filterCatName = null) {
    let rows = [["Disiplin", "Kategori", "Peringkat / Medali", "Nama Atlet", "Kontingen", "Nilai Akhir / Keterangan"]];
    let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;

    categoriesToExport.forEach(cat => {
        if (cat.discipline === 'embu') {
            let finalis = STATE.participants.filter(p => p.kategori === cat.name && p.isFinalist && p.scores.b2.final > 0);
            if(finalis.length > 0) {
                finalis.sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech);
                finalis.forEach((p, i) => {
                    let medali = i === 0 ? "Emas" : i === 1 ? "Perak" : i === 2 ? "Perunggu" : `Peringkat ${i+1}`;
                    rows.push(["EMBU", cat.name, medali, p.nama, p.kontingen, p.scores.b2.final.toFixed(2)]);
                });
            } else {
                ['SINGLE', 'A', 'B'].forEach(poolKey => {
                    let poolList = STATE.participants.filter(p => p.kategori === cat.name && p.pool === poolKey && p.scores.b1.final > 0);
                    poolList.sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
                    poolList.forEach((p, i) => { rows.push(["EMBU", cat.name, `Pool ${poolKey} Rank ${i+1}`, p.nama, p.kontingen, p.scores.b1.final.toFixed(2)]); });
                });
            }
        } else {
            let wins = calculateRandoriFinalists(cat.name);
            if (wins && wins.emas) {
                let pEmas = STATE.participants.find(x => x.nama === wins.emas && x.kategori === cat.name);
                let pPerak = STATE.participants.find(x => x.nama === wins.perak && x.kategori === cat.name);
                rows.push(["RANDORI", cat.name, "Emas", wins.emas, pEmas ? pEmas.kontingen : "", "Juara 1"]);
                rows.push(["RANDORI", cat.name, "Perak", wins.perak, pPerak ? pPerak.kontingen : "", "Juara 2"]);
                wins.perunggu.forEach(pName => {
                    let pBrz = STATE.participants.find(x => x.nama === pName && x.kategori === cat.name);
                    rows.push(["RANDORI", cat.name, "Perunggu", pName, pBrz ? pBrz.kontingen : "", "Juara 3 Bersama"]);
                });
            }
        }
    });
    let prefix = filterCatName ? `Hasil_${filterCatName.replace(/[^a-zA-Z0-9]/g, '_')}` : `Semua_Hasil_Pertandingan`;
    downloadCSV(`${prefix}_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportMedaliCSV() {
    let tally = {}; 
    STATE.categories.forEach(cat => { 
        if(cat.discipline === 'embu') {
            let listCat = STATE.participants.filter(p => p.kategori === cat.name && p.isFinalist); 
            let wins = listCat.filter(p => p.scores.b2.final > 0).sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); 
            if(wins[0]) { tally[wins[0].kontingen] = tally[wins[0].kontingen] || {g:0, s:0, b:0}; tally[wins[0].kontingen].g++; } 
            if(wins[1]) { tally[wins[1].kontingen] = tally[wins[1].kontingen] || {g:0, s:0, b:0}; tally[wins[1].kontingen].s++; } 
            if(wins[2]) { tally[wins[2].kontingen] = tally[wins[2].kontingen] || {g:0, s:0, b:0}; tally[wins[2].kontingen].b++; } 
        } else {
            const isFinalCategory = cat.name.toUpperCase().includes('FINAL');
            if(!isFinalCategory) return; 
            const results = calculateRandoriFinalists(cat.name);
            if(!results) return; 
            if(results.emas) { let p = STATE.participants.find(x => x.nama === results.emas && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].g++; } }
            if(results.perak) { let p = STATE.participants.find(x => x.nama === results.perak && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].s++; } }
            results.perunggu.forEach(pName => { let p = STATE.participants.find(x => x.nama === pName && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].b++; } });
        }
    }); 

    let leaderboard = Object.keys(tally).map(kontingen => ({ nama: kontingen, emas: tally[kontingen].g, perak: tally[kontingen].s, perunggu: tally[kontingen].b, total: tally[kontingen].g + tally[kontingen].s + tally[kontingen].b })); 
    leaderboard.sort((a,b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu); 
    
    let rows = [["Peringkat", "Kontingen", "Emas", "Perak", "Perunggu", "Total Medali"]];
    leaderboard.forEach((k, i) => { rows.push([i + 1, k.nama, k.emas, k.perak, k.perunggu, k.total]); });
    downloadCSV(`Klasemen_Medali_Juara_Umum_${new Date().toISOString().slice(0,10)}.csv`, rows);
}

function exportCustomCSV() { exportHasilCSV(null); } // Legacy fallback
function resetAllPenilaian() { if(confirm('⚠️ PERHATIAN: Ini akan MENGHAPUS SEMUA SKOR & PARTAI RANDORI. Yakin?')) { STATE.participants.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }; p.finalScore = 0; p.techScore = 0; p.isFinalist = false; p.urutFinal = 0; p.losses = 0; }); STATE.matches = []; saveToLocalStorage(); refreshAllData(); alert('Nilai di-reset.'); } }
function resetDataAtlet() { if(confirm('⚠️ PERHATIAN: Ini MENGHAPUS SEMUA ATLET. Yakin?')) { STATE.participants = []; STATE.matches = []; saveToLocalStorage(); refreshAllData(); alert('Data atlet dihapus.'); } }
function resetTotalSistem() { if(confirm('🚨 FACTORY RESET: Hapus seluruh sistem?')) { localStorage.clear(); STATE = { categories: [], participants: [], matches: [], settings: { numJudges: 5 } }; refreshAllData(); alert('Sistem kembali ke pengaturan awal.'); location.reload(); } }
// FUNGSI PENYEMBUH: Memperbarui tampilan secara otomatis saat data Cloud masuk
function updateActiveViewsSilent() {
    // Cari tahu tab mana yang sedang dibuka oleh user
    const activeTab = UI.tabs.find(t => {
        const el = document.getElementById(`section-${t}`);
        return el && el.classList.contains('block');
    });

    // Perbarui hanya tampilan yang relevan agar tidak berat
    if (activeTab === 'ranking') {
        if (typeof renderRanking === "function") renderRanking();
    } else if (activeTab === 'drawing') {
        if (typeof checkExistingDrawing === "function") checkExistingDrawing();
    } else if (activeTab === 'juara') {
        if (typeof renderJuaraUmum === "function") renderJuaraUmum();
    } else if (activeTab === 'atlet') {
        if (typeof renderParticipantTable === "function") renderParticipantTable();
    }
}
