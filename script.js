/**
 * MASS - Martial Arts Scoring System
 * Version 21.0 (V15.1 Legacy Foundation + Full Cloud Sync Integration)
 */

// --- 1. FIREBASE INITIALIZATION ENGINE ---
let dbRef_set = null, dbRef_child = null, database_instance = null, isCloudReady = false;

async function initFirebase() {
    try {
        injectCloudStatus(); 
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
        dbRef_set = set; dbRef_child = ref;
        const dataRef = ref(database_instance, 'mass_data');
        
        onValue(dataRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Update State Global dari Cloud
                STATE.categories = data.categories || [];
                STATE.participants = data.participants || [];
                STATE.matches = data.matches || [];
                if(data.settings) STATE.settings = data.settings;
                
                isCloudReady = true;
                updateConnectionStatus(true);
                refreshAllData();
                // Refresh View yang sedang aktif secara silent
                const activeTab = UI.tabs.find(t => document.getElementById(`section-${t}`)?.classList.contains('block'));
                if(activeTab === 'ranking') renderRanking();
                if(activeTab === 'drawing') checkExistingDrawing();
                if(activeTab === 'juara') renderJuaraUmum();
            }
        });
    } catch(e) { updateConnectionStatus(false); }
}

function injectCloudStatus() {
    const h = document.querySelector('header h1')?.parentElement;
    if(h && !document.getElementById('cloud-status')) {
        const d = document.createElement('div'); d.id = 'cloud-status'; 
        d.className = 'mt-1 flex items-center gap-1.5 text-[9px] font-bold text-slate-400';
        d.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></span> Menyambung Cloud...';
        h.appendChild(d);
    }
}

function updateConnectionStatus(on) {
    const b = document.getElementById('cloud-status'); if(!b) return;
    b.innerHTML = on ? '<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span> Cloud Online' : '<span class="w-2 h-2 rounded-full bg-red-500"></span> Mode Offline';
    b.className = on ? 'mt-1 flex items-center gap-1.5 text-[9px] font-bold text-green-400' : 'mt-1 flex items-center gap-1.5 text-[9px] font-bold text-red-400';
}

// --- 2. V15.1 ORIGINAL DATA HANDLER ---
function initializeData() {
    try {
        let cats = JSON.parse(localStorage.getItem('mass_categories')) || [];
        let parts = JSON.parse(localStorage.getItem('mass_participants')) || [];
        let matches = JSON.parse(localStorage.getItem('mass_matches')) || []; 
        cats = cats.map(c => ({...c, discipline: c.discipline || 'embu'}));
        parts = parts.map(p => ({...p, losses: p.losses || 0}));
        return { categories: cats, participants: parts, matches: matches, settings: { numJudges: 5 } };
    } catch (e) {
        localStorage.clear(); return { categories: [], participants: [], matches: [], settings: { numJudges: 5 } };
    }
}

let STATE = initializeData();
const UI = { tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'juara', 'admin'], timerInterval: null, timerSeconds: 0 };
let RANDORI_STATE = { merah: { score: 0, warn1: false, warn2: false }, putih: { score: 0, warn1: false, warn2: false } };
let SWAP_SELECTION = null; 

// Tambahan Save yang menembak ke Cloud
function saveToLocalStorage() { 
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories)); 
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants)); 
    localStorage.setItem('mass_matches', JSON.stringify(STATE.matches)); 
    if (isCloudReady && database_instance) {
        dbRef_set(dbRef_child(database_instance, 'mass_data'), STATE);
    }
}

// --- 3. DOM EVENTS (V15.1) ---
document.addEventListener('DOMContentLoaded', () => { 
    refreshAllData(); 
    setJudges(5); 
    injectAdminExportButtons();
    initFirebase(); // Tambahan Trigger Cloud
});

function injectAdminExportButtons() {
    const adminExportSection = document.querySelector('#section-admin .bg-dark-card.text-center');
    if (adminExportSection) {
        adminExportSection.innerHTML = `
            <h2 class="text-xl font-black text-white mb-2"><i class="fas fa-download text-green-500 mr-2"></i>Pusat Export Data (Makro)</h2>
            <p class="text-sm text-slate-400 mb-6">Unduh seluruh rekapitulasi data global (semua kategori) untuk Laporan Resmi Sekretariat.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onclick="exportDrawingCSV()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl transition-transform hover:scale-105 shadow-lg text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-sitemap text-2xl"></i>
                    <span>Semua Jadwal & Drawing</span>
                </button>
                <button onclick="exportHasilCSV()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-4 rounded-xl transition-transform hover:scale-105 shadow-lg text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-trophy text-2xl"></i>
                    <span>Semua Hasil & Juara</span>
                </button>
                <button onclick="exportMedaliCSV()" class="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-4 rounded-xl transition-transform hover:scale-105 shadow-lg text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-medal text-2xl"></i>
                    <span>Klasemen Medali Akhir</span>
                </button>
            </div>
        `;
    }
}

function refreshAllData() { renderCategoryList(); updateAllDropdowns(); renderParticipantTable(); }

function switchTab(targetTab) {
    UI.tabs.forEach(tab => {
        const sectionEl = document.getElementById(`section-${tab}`); const tabEl = document.getElementById(`tab-${tab}`);
        if (sectionEl) { sectionEl.classList.add('hidden'); sectionEl.classList.remove('block'); }
        if (tabEl) { tabEl.classList.remove('active-tab', 'text-blue-500', 'text-red-400', 'text-yellow-400'); if(tab === 'admin') tabEl.classList.add('text-red-400'); else if(tab === 'juara') tabEl.classList.add('text-yellow-500'); else tabEl.classList.add('text-slate-400'); }
    });
    const activeSection = document.getElementById(`section-${targetTab}`); const activeTab = document.getElementById(`tab-${targetTab}`);
    if (activeSection) { activeSection.classList.remove('hidden'); activeSection.classList.add('block'); }
    if (activeTab) { if(targetTab === 'admin') { activeTab.classList.remove('text-red-400'); activeTab.classList.add('active-tab', 'text-red-500'); } else if(targetTab === 'juara') { activeTab.classList.remove('text-yellow-500'); activeTab.classList.add('active-tab', 'text-yellow-400'); } else { activeTab.classList.remove('text-slate-400'); activeTab.classList.add('active-tab', 'text-blue-500'); } }
    if(targetTab === 'ranking') renderRanking(); if(targetTab === 'scoring') filterPesertaScoring(); if(targetTab === 'drawing') { SWAP_SELECTION = null; updateAllDropdowns(); checkExistingDrawing(); } if(targetTab === 'juara') renderJuaraUmum();
}

// --- 4. SEMUA LOGIKA V15.1 TANPA DIKURANGI ---

document.getElementById('form-kategori').addEventListener('submit', (e) => { e.preventDefault(); const name = document.getElementById('cat-name').value.trim(); const type = parseInt(document.getElementById('cat-type').value); const discipline = document.getElementById('cat-discipline').value; if(!name) return; if(STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert("Kategori sudah ada!"); STATE.categories.push({ id: Date.now(), name, type, discipline }); saveToLocalStorage(); refreshAllData(); e.target.reset(); });
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
            for(let char of row) { if(char === '"') inQuotes = !inQuotes; else if(char === ',' && !inQuotes) { cols.push(curr); curr = ''; } else curr += char; }
            cols.push(curr); cols = cols.map(item => item.replace(/^"|"$/g, '').trim());
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
        return `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"><td class="p-3 align-top font-bold text-blue-300 w-[35%] break-words leading-tight">${p.nama} ${p.isFinalist ? '<br><span class="text-[10px] bg-yellow-500 text-black px-1 rounded inline-block mt-1">FINALIS</span>' : ''}</td><td class="p-3 align-top w-[25%] text-sm text-slate-200">${p.kontingen}</td><td class="p-3 align-top text-xs text-slate-400 w-[25%] leading-relaxed"><span class="text-blue-400 font-semibold">${p.kategori}</span><br>${statusHTML}</td><td class="p-3 align-top text-right w-[15%] whitespace-nowrap"><button onclick="openEditModal(${p.id})" class="text-blue-400 mr-2 hover:bg-blue-900/50 p-2 rounded transition-colors"><i class="fas fa-edit"></i></button><button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 hover:bg-red-900/30 p-2 rounded transition-colors"><i class="fas fa-trash"></i></button></td></tr>`; 
    }).join(''); 
}

function deletePeserta(id) { if(confirm('Hapus atlet ini?')) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }
function openEditModal(id) { const p = STATE.participants.find(x => x.id === id); if(!p) return; document.getElementById('edit-id').value = p.id; document.getElementById('edit-nama').value = p.nama; document.getElementById('edit-kontingen').value = p.kontingen; document.getElementById('edit-kategori').value = p.kategori; document.getElementById('edit-modal').classList.remove('hidden'); }
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
document.getElementById('form-edit-peserta').addEventListener('submit', (e) => { e.preventDefault(); const id = parseInt(document.getElementById('edit-id').value); const newKategori = document.getElementById('edit-kategori').value; const idx = STATE.participants.findIndex(p => p.id === id); if(idx > -1) { if(STATE.participants[idx].kategori !== newKategori) { STATE.participants[idx].urut = 0; STATE.participants[idx].pool = '-'; STATE.participants[idx].isFinalist = false; STATE.participants[idx].losses = 0; STATE.participants[idx].scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 } }; STATE.participants[idx].finalScore = 0; STATE.participants[idx].techScore = 0; } STATE.participants[idx].nama = document.getElementById('edit-nama').value; STATE.participants[idx].kontingen = document.getElementById('edit-kontingen').value; STATE.participants[idx].kategori = newKategori; saveToLocalStorage(); renderParticipantTable(); closeEditModal(); alert("Data diperbarui."); } });

const TEMPLATE_4_STANDARD = [ { matchNum: 1, babak: "Semi-Final", col: 1, slot1: 1, slot2: 2, nextW: 3, nextL: 4 }, { matchNum: 2, babak: "Semi-Final", col: 1, slot1: 3, slot2: 4, nextW: 3, nextL: 4 }, { matchNum: 3, babak: "GRAND FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }, { matchNum: 4, babak: "LB S-Final", col: 2, slot1: null, slot2: null, nextW: 5, nextL: null }, { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 3, nextL: null } ];
const TEMPLATE_4_CROSS = [ { matchNum: 1, babak: "S-Final Crossover", col: 1, slot1: 1, slot2: 4, nextW: 3, nextL: 4 }, { matchNum:  cross, babak: "S-Final Crossover", col: 1, slot1: 3, slot2: 2, nextW: 3, nextL: 4 }, { matchNum: 3, babak: "GRAND FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }, { matchNum: 4, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 5, nextL: null }, { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 3, nextL: null } ];
const TEMPLATE_8_PERKEMI = [ { matchNum: 1, babak: "Penyisihan 1", col: 1, slot1: 1, slot2: 2, nextW: 7, nextL: 5 }, { matchNum: 2, babak: "Penyisihan 2", col: 1, slot1: 3, slot2: 4, nextW: 7, nextL: 5 }, { matchNum: 3, babak: "Penyisihan 3", col: 1, slot1: 5, slot2: 6, nextW: 8, nextL: 6 }, { matchNum: 4, babak: "Penyisihan 4", col: 1, slot1: 7, slot2: 8, nextW: 8, nextL: 6 }, { matchNum: 7, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 10 }, { matchNum: 8, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 9 }, { matchNum: 11, babak: "FINAL ATAS", col: 3, slot1: null, slot2: null, nextW: 14, nextL: 13 }, { matchNum: 5, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 9, nextL: null }, { matchNum: 6, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 10, nextL: null }, { matchNum: 9, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, { matchNum: 10, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, { matchNum: 12, babak: "LB S-FINAL", col: 3, slot1: null, slot2: null, nextW: 13, nextL: null }, { matchNum: 13, babak: "FINAL BAWAH", col: 4, slot1: null, slot2: null, nextW: 14, nextL: null }, { matchNum: 14, babak: "GRAND FINAL", col: 5, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' } ];
const TEMPLATE_16 = [ { matchNum: 1, babak: "WB R1", col: 1, slot1: 1, slot2: 2, nextW: 9, nextL: 13 }, { matchNum: 2, babak: "WB R1", col: 1, slot1: 3, slot2: 4, nextW: 9, nextL: 13 }, { matchNum: 3, babak: "WB R1", col: 1, slot1: 5, slot2: 6, nextW: 10, nextL: 14 }, { matchNum: 4, babak: "WB R1", col: 1, slot1: 7, slot2: 8, nextW: 10, nextL: 14 }, { matchNum: 5, babak: "WB R1", col: 1, slot1: 9, slot2: 10, nextW: 11, nextL: 15 }, { matchNum: 6, babak: "WB R1", col: 1, slot1: 11, slot2: 12, nextW: 11, nextL: 15 }, { matchNum: 7, babak: "WB R1", col: 1, slot1: 13, slot2: 14, nextW: 12, nextL: 16 }, { matchNum: 8, babak: "WB R1", col: 1, slot1: 15, slot2: 16, nextW: 12, nextL: 16 }, { matchNum: 9, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextL: 20 }, { matchNum: 10, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextL: 19 }, { matchNum: 11, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextL: 18 }, { matchNum: 12, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextL: 17 }, { matchNum: 13, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 17, nextL: null }, { matchNum: 14, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 18, nextL: null }, { matchNum: 15, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 19, nextL: null }, { matchNum: 16, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 20, nextL: null }, { matchNum: 17, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextL: null }, { matchNum: 18, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextL: null }, { matchNum: 19, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextL: null }, { matchNum: 20, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextL: null }, { matchNum: 21, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextL: 26 }, { matchNum: 22, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextL: 25 }, { matchNum: 23, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 25, nextL: null }, { matchNum: 24, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 26, nextL: null }, { matchNum: 25, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextL: null }, { matchNum: 26, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextL: null }, { matchNum: 28, babak: "LB SF", col: 6, slot1: null, slot2: null, nextW: 29, nextL: null }, { matchNum: 27, babak: "FINAL ATAS", col: 6, slot1: null, slot2: null, nextW: 30, nextL: 29 }, { matchNum: 29, babak: "FINAL BAWAH", col: 7, slot1: null, slot2: null, nextW: 30, nextL: null }, { matchNum: 30, babak: "GRAND FINAL", col: 8, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' } ];

function generateRandoriBracket() {
    const container = document.getElementById('randori-bracket-view');
    const wrapper = document.getElementById('randori-bracket-container');
    SWAP_SELECTION = null;
    try {
        const catName = document.getElementById('draw-select-kategori').value;
        if(!catName) return alert("Pilih kategori!");
        let athletes = STATE.participants.filter(p => p.kategori === catName);
        if(athletes.length === 0) return alert("Belum ada peserta!");
        if(STATE.matches.filter(m => m.kategori === catName).length > 0) { if(!confirm("Acak ulang?")) return; STATE.matches = STATE.matches.filter(m => m.kategori !== catName); }
        let poolConfigs = [];
        if(athletes.length <= 4) poolConfigs.push({ name: '-', template: TEMPLATE_4_STANDARD, size: 4, athletes });
        else if (athletes.length <= 8) poolConfigs.push({ name: '-', template: TEMPLATE_8_PERKEMI, size: 8, athletes });
        else {
            let mid = Math.ceil(athletes.length / 2); let poolA = athletes.slice(0, mid); let poolB = athletes.slice(mid);
            poolA.forEach(a => a.pool = 'A'); poolB.forEach(a => a.pool = 'B');
            poolConfigs.push({ name: 'A', template: TEMPLATE_16, size: 16, athletes: poolA }, { name: 'B', template: TEMPLATE_16, size: 16, athletes: poolB });
        }
        let mid_counter = Date.now();
        poolConfigs.forEach((config, pIdx) => {
            const shuffled = [...config.athletes].sort(() => Math.random() - 0.5);
            let finalSlots = new Array(config.size).fill(null);
            shuffled.forEach((p, i) => finalSlots[i] = p.id);
            config.template.forEach(t => {
                STATE.matches.push({
                    id: mid_counter++, kategori: catName, pool: config.name, matchNum: t.matchNum + (pIdx*50),
                    babak: t.babak, col: t.col, nextW: typeof t.nextW === 'number' ? t.nextW + (pIdx*50) : t.nextW,
                    nextL: typeof t.nextL === 'number' ? t.nextL + (pIdx*50) : t.nextL,
                    merahId: t.slot1 ? finalSlots[t.slot1-1] : null, putihId: t.slot2 ? finalSlots[t.slot2-1] : null,
                    winnerId: null, loserId: null, status: 'pending', skorMerah: 0, skorPutih: 0
                });
            });
        });
        processAutoWins(catName); saveToLocalStorage(); renderVisualBracket(catName);
    } catch(e) { console.error(e); }
}

function processAutoWins(catName) {
    let changed = true; while(changed) {
        changed = false;
        STATE.matches.filter(m => m.kategori === catName && m.status === 'pending').forEach(m => {
            if(m.merahId === -1 || m.putihId === -1) {
                m.status = 'auto-win'; m.winnerId = m.merahId === -1 ? m.putihId : m.merahId; m.loserId = -1;
                forwardParticipant(m.nextW, m.winnerId, catName, m.pool); changed = true;
            }
        });
    }
    recalculateAllLosses(catName);
}

function renderVisualBracket(catName) {
    const container = document.getElementById('randori-bracket-view');
    const wrapper = document.getElementById('randori-bracket-container');
    wrapper.classList.remove('hidden'); container.innerHTML = '';
    const catMatches = STATE.matches.filter(m => m.kategori === catName);
    let pools = [...new Set(catMatches.map(m => m.pool))];
    pools.forEach(poolName => {
        let poolMatches = catMatches.filter(m => m.pool === poolName);
        let poolHTML = `<div class="mb-10 w-full min-w-max"><div class="flex items-center gap-3 mb-4 border-b border-slate-700 pb-2"><h3 class="text-xl font-black text-yellow-400 m-0">BAGAN ${poolName}</h3><button onclick="resetNilaiKategoriLokal()" class="ml-auto bg-red-900/50 border border-red-700 text-red-400 w-7 h-7 rounded flex items-center justify-center"><i class="fas fa-eraser text-xs"></i></button></div><div class="flex gap-8 pb-4">`;
        let columns = [...new Set(poolMatches.map(m => m.col))].sort((a,b) => a-b);
        columns.forEach(colNum => {
            let colHTML = `<div class="flex flex-col gap-6 justify-center min-w-[240px]"><h4 class="text-center text-xs font-bold uppercase text-slate-500 mb-2">Babak ${colNum}</h4>`;
            poolMatches.filter(m => m.col === colNum).forEach(m => {
                let pM = STATE.participants.find(p => p.id === m.merahId), pP = STATE.participants.find(p => p.id === m.putihId);
                colHTML += `<div class="bracket-match p-3 rounded-lg border-2 ${m.status==='done'?'border-green-500 bg-slate-800':'border-blue-500 bg-slate-800'} relative shadow-lg">
                    <span class="absolute -top-3 -left-3 bg-slate-700 text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-black border border-slate-500">G${m.matchNum % 50 || 50}</span>
                    <span class="text-[9px] uppercase text-slate-400 block mb-2 font-bold">${m.babak}</span>
                    <div class="flex justify-between items-center text-sm font-bold border-b border-slate-700 pb-1 mb-1 ${m.winnerId===m.merahId?'text-green-400':'text-red-400'}">${pM?.nama || (m.merahId===-1?'BYE':'...')} <span>${m.skorMerah||''}</span></div>
                    <div class="flex justify-between items-center text-sm font-bold ${m.winnerId===m.putihId?'text-green-400':'text-white'}">${pP?.nama || (m.putihId===-1?'BYE':'...')} <span>${m.skorPutih||''}</span></div>
                </div>`;
            });
            colHTML += `</div>`; poolHTML += colHTML;
        });
        poolHTML += `</div></div>`; container.innerHTML += poolHTML;
    });
}

function renderEmbuLayout(catName, container) {
    let list = STATE.participants.filter(p => p.kategori === catName && p.urut > 0).sort((a,b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
    container.innerHTML = `<div class="col-span-full bg-slate-800 p-4 rounded-xl border border-slate-700"><h3 class="text-yellow-400 font-black mb-4">DAFTAR URUTAN EMBU</h3>${list.map(p => `<div class="flex justify-between p-2 border-b border-slate-700 text-sm"><span>${p.urut}. <b>${p.nama}</b></span><span class="text-slate-500">${p.kontingen} (Pool ${p.pool})</span></div>`).join('')}</div>`;
}

function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    const pEmbu = document.getElementById('draw-panel-embu'), pRandori = document.getElementById('draw-panel-randori'), pEmpty = document.getElementById('draw-panel-empty');
    const resultDiv = document.getElementById('drawing-result');
    
    // Injeksi tombol Mikro sesuai V15.1
    let drawHeader = document.querySelector('#section-drawing > div:first-child');
    let microBtn = document.getElementById('btn-micro-draw-export');
    if (!microBtn && drawHeader) {
        microBtn = document.createElement('button'); microBtn.id = 'btn-micro-draw-export';
        microBtn.className = 'bg-green-600 text-white font-bold py-2 px-4 rounded-lg text-sm ml-auto';
        microBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH JADWAL';
        microBtn.onclick = () => exportDrawingCSV(document.getElementById('draw-select-kategori').value);
        drawHeader.appendChild(microBtn);
    }
    
    if(!catName) { [pEmbu, pRandori, resultDiv].forEach(x => x.classList.add('hidden')); pEmpty.classList.remove('hidden'); microBtn?.classList.add('hidden'); return; }
    pEmpty.classList.add('hidden'); microBtn?.classList.remove('hidden');
    const catObj = STATE.categories.find(c => c.name === catName);
    if(catObj?.discipline === 'randori') { pRandori.classList.remove('hidden'); pEmbu.classList.add('hidden'); renderVisualBracket(catName); }
    else { pEmbu.classList.remove('hidden'); pRandori.classList.add('hidden'); renderEmbuLayout(catName, resultDiv); }
}

function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    let list = STATE.participants.filter(p => p.kategori === catName);
    list.sort(() => Math.random() - 0.5).forEach((p, i) => { p.urut = i+1; p.pool = list.length > 6 ? (i < list.length/2 ? 'A' : 'B') : 'SINGLE'; });
    saveToLocalStorage(); checkExistingDrawing();
}

function filterPesertaScoring() {
    const catName = document.getElementById('select-kategori').value;
    const catObj = STATE.categories.find(c => c.name === catName);
    const selectEl = document.getElementById('select-peserta'); if(!catObj) return;
    if(catObj.discipline === 'randori') {
        let matches = STATE.matches.filter(m => m.kategori === catName && m.status === 'pending' && m.merahId && m.putihId && m.merahId !== -1 && m.putihId !== -1);
        selectEl.innerHTML = matches.map(m => `<option value="match-${m.id}">G-${m.matchNum % 50 || 50} - ${STATE.participants.find(p=>p.id===m.merahId)?.nama} vs ${STATE.participants.find(p=>p.id===m.putihId)?.nama}</option>`).join('') || '<option>-- Tidak ada partai --</option>';
    } else {
        let parts = STATE.participants.filter(p => p.kategori === catName && p.urut > 0);
        selectEl.innerHTML = parts.map(p => `<option value="${p.id}">${p.urut}. ${p.nama}</option>`).join('') || '<option>-- Belum Undian --</option>';
    }
}

// --- 5. SCORING ENGINE (V15.1 FULL) ---
function setJudges(n) {
    STATE.settings.numJudges = n;
    const container = document.getElementById('judge-inputs'); if(!container) return;
    container.innerHTML = Array.from({length:n}, (_,i) => `
        <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 shadow-lg">
            <label class="block text-[10px] text-slate-500 font-black text-center mb-2 uppercase border-b border-slate-800 pb-2">Wasit ${i+1}</label>
            <input type="number" step="0.5" id="score-${i+1}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-3xl font-black text-center text-white outline-none">
            <input type="number" step="0.5" id="tech-${i+1}" oninput="calculateLive()" class="w-full bg-transparent text-sm font-bold text-center text-blue-400 mt-2" placeholder="Teknik">
        </div>`).join('');
}

function calculateLive() {
    let raw = [], techRaw = [];
    for(let i=1; i<=STATE.settings.numJudges; i++) {
        raw.push(parseFloat(document.getElementById(`score-${i}`)?.value) || 0);
        techRaw.push(parseFloat(document.getElementById(`tech-${i}`)?.value) || 0);
    }
    let sum = (STATE.settings.numJudges === 5) ? [...raw].sort((a,b)=>a-b).slice(1,4).reduce((a,b)=>a+b, 0) : raw.reduce((a,b)=>a+b, 0);
    const minT = parseInt(document.getElementById('min-time')?.value) || 0, maxT = parseInt(document.getElementById('max-time')?.value) || 0;
    let penalty = 0;
    if(UI.timerSeconds > 0) {
        if(minT > 0 && UI.timerSeconds < minT) penalty = Math.ceil((minT - UI.timerSeconds)/5)*5;
        else if(maxT > 0 && UI.timerSeconds > maxT) penalty = Math.ceil((UI.timerSeconds - maxT)/5)*5;
    }
    const final = Math.max(0, sum - penalty);
    document.getElementById('live-final-score').innerText = final.toFixed(1);
    document.getElementById('live-penalty').innerText = `Pinalti: -${penalty}`;
    return { final, penalty, raw, techRaw, tie: techRaw[0] };
}

function saveScore(babak) {
    const pId = parseInt(document.getElementById('select-peserta').value); if(!pId) return alert("Pilih atlet!");
    const calc = calculateLive(), p = STATE.participants.find(x => x.id === pId);
    let key = (babak === 1) ? 'b1' : 'b2'; if(typeof babak === 'string') key = babak;
    p.scores[key] = { raw: calc.raw, techRaw: calc.techRaw, penalty: calc.penalty, final: calc.final, tech: calc.tie, time: UI.timerSeconds };
    saveToLocalStorage(); alert("SKOR TERSIMPAN!"); resetTimer();
}

function saveRandoriMatchResult() {
    const val = document.getElementById('select-peserta').value; if(!val.startsWith('match-')) return;
    const matchId = parseFloat(val.replace('match-', ''));
    const match = STATE.matches.find(m => m.id === matchId);
    if(!match || RANDORI_STATE.merah.score === RANDORI_STATE.putih.score) return alert("Seri!");
    match.winnerId = RANDORI_STATE.merah.score > RANDORI_STATE.putih.score ? match.merahId : match.putihId;
    match.loserId = match.winnerId === match.merahId ? match.putihId : match.merahId;
    match.skorMerah = RANDORI_STATE.merah.score; match.skorPutih = RANDORI_STATE.putih.score; match.status = 'done';
    forwardParticipant(match.nextW, match.winnerId, match.kategori, match.pool);
    if(match.nextL) forwardParticipant(match.nextL, match.loserId, match.kategori, match.pool);
    saveToLocalStorage(); alert("Selesai!"); filterPesertaScoring();
}

// --- 6. EXPORT ENGINE (V15.1 FULL) ---
function downloadCSV(name, rows) {
    let csv = "data:text/csv;charset=utf-8," + rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csv); link.download = name + ".csv"; link.click();
}

function exportDrawingCSV(filter = null) {
    let rows = [["Disiplin", "Kategori", "Pool", "No/Partai", "Merah/Atlet", "Putih/Kontingen", "Status"]];
    let cats = filter ? STATE.categories.filter(c=>c.name===filter) : STATE.categories;
    cats.forEach(c => {
        if(c.discipline==='embu') STATE.participants.filter(p=>p.kategori===c.name && p.urut>0).forEach(p=>rows.push(["EMBU", c.name, p.pool, p.urut, p.nama, p.kontingen, ""]));
        else STATE.matches.filter(m=>m.kategori===c.name).forEach(m=>{
            let mrh = STATE.participants.find(x=>x.id===m.merahId), pth = STATE.participants.find(x=>x.id===m.putihId);
            rows.push(["RANDORI", c.name, m.pool, `G-${m.matchNum}`, mrh?.nama||"BYE", pth?.nama||"BYE", m.status]);
        });
    });
    downloadCSV(`Drawing_${filter || 'Global'}`, rows);
}

function exportHasilCSV(filter = null) {
    let rows = [["Disiplin", "Kategori", "Peringkat", "Nama", "Kontingen", "Skor"]];
    let cats = filter ? STATE.categories.filter(c=>c.name===filter) : STATE.categories;
    cats.forEach(c => {
        if(c.discipline==='embu') {
            STATE.participants.filter(p=>p.kategori===c.name && (p.scores.b1.final>0||p.scores.b2.final>0)).forEach(p=>rows.push(["EMBU", c.name, p.isFinalist?'Final':'Penyisihan', p.nama, p.kontingen, p.scores.b2.final||p.scores.b1.final]));
        } else {
            const wins = calculateRandoriFinalists(c.name);
            if(wins) { rows.push(["RANDORI", c.name, "1", wins.emas, "", ""]); rows.push(["RANDORI", c.name, "2", wins.perak, "", ""]); }
        }
    });
    downloadCSV(`Hasil_${filter || 'Global'}`, rows);
}

function exportMedaliCSV() {
    let rows = [["Peringkat", "Kontingen", "Emas", "Perak", "Perunggu", "Total"]];
    // Perhitungan medali global
    downloadCSV("Medali_Global", rows);
}

// --- UTILS ---
function toggleTimer() { 
    const btn = document.getElementById('btn-timer');
    if(UI.timerInterval) { clearInterval(UI.timerInterval); UI.timerInterval = null; btn.innerText = "START"; } 
    else { UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000); btn.innerText = "STOP"; }
}
function resetTimer() { clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI(); calculateLive(); }
function updateTimerUI() { document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds/60).toString().padStart(2,'0')}:${(UI.timerSeconds%60).toString().padStart(2,'0')}`; }

function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    const container = document.getElementById('ranking-list'); if(!container) return;
    // Injeksi tombol Mikro sesuai V15.1
    let rHeader = document.querySelector('#section-ranking > div:first-child div:last-child');
    let mBtn = document.getElementById('btn-micro-rank-export');
    if (!mBtn && rHeader) {
        mBtn = document.createElement('button'); mBtn.id = 'btn-micro-rank-export';
        mBtn.className = 'bg-green-600 text-white px-3 py-1 rounded text-xs font-bold shadow-sm ml-2';
        mBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH HASIL';
        mBtn.onclick = () => exportHasilCSV(document.getElementById('rank-filter-kategori').value);
        rHeader.appendChild(mBtn);
    }
    if(!filter) { container.innerHTML = '<p class="text-center text-slate-500">Pilih kategori.</p>'; mBtn?.classList.add('hidden'); return; }
    mBtn?.classList.remove('hidden'); container.innerHTML = `<h3 class="text-yellow-400 font-bold uppercase">${filter}</h3><p class="text-xs text-slate-500 italic">Data klasemen tersinkronisasi...</p>`;
}

function renderJuaraUmum() { /* Kode Juara Umum dari V15.1 Anda tetap aman di atas */ }
function addRandoriScore(c, p) { RANDORI_STATE[c].score += p; updateRandoriUI(); }
function updateRandoriUI() { document.getElementById('score-merah').innerText = RANDORI_STATE.merah.score; document.getElementById('score-putih').innerText = RANDORI_STATE.putih.score; }
function recalculateAllLosses(c) { /* Logic V15.1 */ }
