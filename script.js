/**
 * MASS - Martial Arts Scoring System
 * Version 20.0 (The Final Fix: V15.1 Core + Full Firebase Integration)
 */

// --- 1. INITIALIZATION ---
function initializeData() {
    try {
        let cats = JSON.parse(localStorage.getItem('mass_categories')) || [];
        let parts = JSON.parse(localStorage.getItem('mass_participants')) || [];
        let matches = JSON.parse(localStorage.getItem('mass_matches')) || []; 
        cats = cats.map(c => ({...c, discipline: c.discipline || 'embu'}));
        parts = parts.map(p => ({...p, losses: p.losses || 0}));
        return { categories: cats, participants: parts, matches: matches, settings: { numJudges: 5 } };
    } catch (e) {
        return { categories: [], participants: [], matches: [], settings: { numJudges: 5 } };
    }
}

let STATE = initializeData();
const UI = { tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'juara', 'admin'], timerInterval: null, timerSeconds: 0 };
let RANDORI_STATE = { merah: { score: 0, warn1: false, warn2: false }, putih: { score: 0, warn1: false, warn2: false } };
let SWAP_SELECTION = null; 

// --- 2. FIREBASE INTEGRATION (The Brain) ---
let dbRef_set = null, dbRef_child = null, database_instance = null, isCloudReady = false;

document.addEventListener('DOMContentLoaded', () => { 
    refreshAllData(); 
    setJudges(5); 
    initFirebase(); // Memanggil Cloud
});

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
                // Sinkronisasi data masuk tanpa merusak referensi objek
                STATE.categories = data.categories || [];
                STATE.participants = data.participants || [];
                STATE.matches = data.matches || [];
                if(data.settings) STATE.settings = data.settings;
                
                isCloudReady = true;
                updateConnectionStatus(true);
                refreshAllData();
                updateActiveViewsSilent();
                injectAdminExportButtons();
            }
        });
    } catch(e) { updateConnectionStatus(false); }
}

function saveToLocalStorage() {
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
    localStorage.setItem('mass_matches', JSON.stringify(STATE.matches));
    if (isCloudReady && database_instance) {
        dbRef_set(dbRef_child(database_instance, 'mass_data'), STATE);
    }
}

// --- 3. ALL V15.1 FEATURES (The Muscles) ---

// --- KATEGORI & ATLET ---
function renderCategoryList() {
    const container = document.getElementById('list-kategori'); if(!container) return;
    container.innerHTML = STATE.categories.map(c => `<div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm"><span class="${c.discipline === 'randori' ? 'bg-red-700' : 'bg-blue-600'} text-[9px] px-1.5 py-0.5 rounded font-bold uppercase">${c.discipline}</span><span class="font-bold text-white">${c.name}</span><button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button></div>`).join('') || '<span class="text-slate-500 italic">Belum ada kategori.</span>';
}

function updateAllDropdowns() {
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`;
    ['p-kategori', 'edit-kategori', 'draw-select-kategori', 'select-kategori', 'rank-filter-kategori'].forEach(id => {
        const el = document.getElementById(id);
        if(el) { const cur = el.value; el.innerHTML = emptyOpt + options; if(cur) el.value = cur; }
    });
    const filterAtlet = document.getElementById('filter-atlet-kategori');
    if(filterAtlet) { filterAtlet.innerHTML = '<option value="all">Semua Kategori</option>' + options; }
}

function renderParticipantTable() {
    const body = document.getElementById('table-peserta-body'); if(!body) return;
    const filter = document.getElementById('filter-atlet-kategori').value; 
    let list = filter && filter !== 'all' ? STATE.participants.filter(p => p.kategori === filter) : STATE.participants;
    body.innerHTML = list.map(p => `<tr class="border-b border-slate-800"><td class="p-3 font-bold text-blue-300">${p.nama} ${p.isFinalist ? '<br><span class="text-[9px] bg-yellow-600 text-black px-1 rounded font-black">FINALIS</span>' : ''}</td><td class="p-3 text-sm">${p.kontingen}</td><td class="p-3 text-xs text-slate-400">${p.kategori}<br>Pool ${p.pool} | No.${p.urut}</td><td class="p-3 text-right"><button onclick="openEditModal(${p.id})" class="text-blue-400 mr-2"><i class="fas fa-edit"></i></button><button onclick="deletePeserta(${p.id})" class="text-slate-600"><i class="fas fa-trash"></i></button></td></tr>`).join('') || '<tr><td colspan="4" class="p-6 text-center text-slate-500">Tidak ada data.</td></tr>';
}

// --- DRAWING ENGINE (4, 8, 16 Templated) ---
const TEMPLATE_4_STANDARD = [ { matchNum: 1, babak: "Semi-Final", col: 1, slot1: 1, slot2: 2, nextW: 3, nextL: 4 }, { matchNum: 2, babak: "Semi-Final", col: 1, slot1: 3, slot2: 4, nextW: 3, nextL: 4 }, { matchNum: 3, babak: "GRAND FINAL", col: 2, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }, { matchNum: 4, babak: "LB S-Final", col: 2, slot1: null, slot2: null, nextW: 5, nextL: null }, { matchNum: 5, babak: "FINAL BAWAH", col: 3, slot1: null, slot2: null, nextW: 3, nextL: null } ];
const TEMPLATE_8_PERKEMI = [ { matchNum: 1, babak: "Penyisihan 1", col: 1, slot1: 1, slot2: 2, nextW: 7, nextL: 5 }, { matchNum: 2, babak: "Penyisihan 2", col: 1, slot1: 3, slot2: 4, nextW: 7, nextL: 5 }, { matchNum: 3, babak: "Penyisihan 3", col: 1, slot1: 5, slot2: 6, nextW: 8, nextL: 6 }, { matchNum: 4, babak: "Penyisihan 4", col: 1, slot1: 7, slot2: 8, nextW: 8, nextL: 6 }, { matchNum: 7, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 10 }, { matchNum: 8, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 9 }, { matchNum: 11, babak: "FINAL ATAS", col: 3, slot1: null, slot2: null, nextW: 14, nextL: 13 }, { matchNum: 5, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 9, nextL: null }, { matchNum: 6, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 10, nextL: null }, { matchNum: 9, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, { matchNum: 10, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, { matchNum: 12, babak: "LB S-FINAL", col: 3, slot1: null, slot2: null, nextW: 13, nextL: null }, { matchNum: 13, babak: "FINAL BAWAH", col: 4, slot1: null, slot2: null, nextW: 14, nextL: null }, { matchNum: 14, babak: "GRAND FINAL", col: 5, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' } ];
const TEMPLATE_16 = [ { matchNum: 1, babak: "WB R1", col: 1, slot1: 1, slot2: 2, nextW: 9, nextL: 13 }, { matchNum: 2, babak: "WB R1", col: 1, slot1: 3, slot2: 4, nextW: 9, nextL: 13 }, { matchNum: 3, babak: "WB R1", col: 1, slot1: 5, slot2: 6, nextW: 10, nextL: 14 }, { matchNum: 4, babak: "WB R1", col: 1, slot1: 7, slot2: 8, nextW: 10, nextL: 14 }, { matchNum: 5, babak: "WB R1", col: 1, slot1: 9, slot2: 10, nextW: 11, nextL: 15 }, { matchNum: 6, babak: "WB R1", col: 1, slot1: 11, slot2: 12, nextW: 11, nextL: 15 }, { matchNum: 7, babak: "WB R1", col: 1, slot1: 13, slot2: 14, nextW: 12, nextL: 16 }, { matchNum: 8, babak: "WB R1", col: 1, slot1: 15, slot2: 16, nextW: 12, nextL: 16 }, { matchNum: 9, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextL: 20 }, { matchNum: 10, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 21, nextL: 19 }, { matchNum: 11, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextL: 18 }, { matchNum: 12, babak: "WB QF", col: 2, slot1: null, slot2: null, nextW: 22, nextL: 17 }, { matchNum: 13, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 17, nextL: null }, { matchNum: 14, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 18, nextL: null }, { matchNum: 15, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 19, nextL: null }, { matchNum: 16, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 20, nextL: null }, { matchNum: 17, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextL: null }, { matchNum: 18, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 23, nextL: null }, { matchNum: 19, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextL: null }, { matchNum: 20, babak: "LB R2", col: 3, slot1: null, slot2: null, nextW: 24, nextL: null }, { matchNum: 21, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextL: 26 }, { matchNum: 22, babak: "WB SF", col: 4, slot1: null, slot2: null, nextW: 27, nextL: 25 }, { matchNum: 23, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 25, nextL: null }, { matchNum: 24, babak: "LB R3", col: 4, slot1: null, slot2: null, nextW: 26, nextL: null }, { matchNum: 25, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextL: null }, { matchNum: 26, babak: "LB QF", col: 5, slot1: null, slot2: null, nextW: 28, nextL: null }, { matchNum: 28, babak: "LB SF", col: 6, slot1: null, slot2: null, nextW: 29, nextL: null }, { matchNum: 27, babak: "FINAL ATAS", col: 6, slot1: null, slot2: null, nextW: 30, nextL: 29 }, { matchNum: 29, babak: "FINAL BAWAH", col: 7, slot1: null, slot2: null, nextW: 30, nextL: null }, { matchNum: 30, babak: "GRAND FINAL", col: 8, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' } ];

function generateRandoriBracket() {
    const catName = document.getElementById('draw-select-kategori').value; if(!catName) return alert("Pilih kategori!");
    let athletes = STATE.participants.filter(p => p.kategori === catName); if(athletes.length === 0) return alert("Belum ada peserta!");
    if(!confirm("Buat bagan baru?")) return;
    STATE.matches = STATE.matches.filter(m => m.kategori !== catName);
    let shuffled = [...athletes].sort(() => Math.random() - 0.5);
    let template = (shuffled.length <= 4) ? TEMPLATE_4_STANDARD : (shuffled.length <= 8) ? TEMPLATE_8_PERKEMI : TEMPLATE_16;
    template.forEach(t => {
        STATE.matches.push({
            id: Date.now() + Math.random(), kategori: catName, matchNum: t.matchNum, babak: t.babak, col: t.col, nextW: t.nextW, nextL: t.nextL,
            merahId: t.slot1 ? (shuffled[t.slot1-1]?.id || -1) : null, putihId: t.slot2 ? (shuffled[t.slot2-1]?.id || -1) : null,
            winnerId: null, loserId: null, status: 'pending', skorMerah: 0, skorPutih: 0, pool: '-'
        });
    });
    processAutoWins(catName); saveToLocalStorage(); checkExistingDrawing();
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
}

function forwardParticipant(targetNum, pId, cat, pool) {
    if(!targetNum || targetNum === 'WINNER' || pId === null || pId === -1) return;
    let target = STATE.matches.find(m => m.kategori === cat && m.matchNum === targetNum && m.pool === pool);
    if(target) {
        if(target.merahId === null) target.merahId = pId;
        else if(target.putihId === null && target.merahId !== pId) target.putihId = pId;
    }
}

function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    let list = STATE.participants.filter(p => p.kategori === catName); if(list.length === 0) return alert("Kosong!");
    list.sort(() => Math.random() - 0.5).forEach((p, i) => { 
        p.urut = i + 1; 
        p.pool = list.length > 6 ? (i < list.length/2 ? 'A' : 'B') : 'SINGLE'; 
    });
    saveToLocalStorage(); checkExistingDrawing();
}

function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    const panelEmbu = document.getElementById('draw-panel-embu'), panelRandori = document.getElementById('draw-panel-randori'), panelEmpty = document.getElementById('draw-panel-empty');
    const resultDiv = document.getElementById('drawing-result'), bracketDiv = document.getElementById('randori-bracket-container');
    
    if(!catName) { [panelEmbu, panelRandori, bracketDiv].forEach(p => p?.classList.add('hidden')); panelEmpty?.classList.remove('hidden'); return; }
    panelEmpty?.classList.add('hidden'); injectMicroButtons('draw', catName);
    
    const catObj = STATE.categories.find(c => c.name === catName);
    if(catObj?.discipline === 'randori') { 
        panelRandori?.classList.remove('hidden'); panelEmbu?.classList.add('hidden'); bracketDiv?.classList.remove('hidden'); renderVisualBracket(catName); 
    } else { 
        panelEmbu?.classList.remove('hidden'); panelRandori?.classList.add('hidden'); bracketDiv?.classList.add('hidden'); renderEmbuLayout(catName, resultDiv); 
    }
}

// --- SCORING ENGINE (V15.1 FULL) ---
function setJudges(n) {
    STATE.settings.numJudges = n;
    const container = document.getElementById('judge-inputs'); if(!container) return;
    container.innerHTML = Array.from({length:n}, (_,i) => `
        <div class="bg-slate-900 p-3 rounded-xl border border-slate-700 shadow-lg">
            <label class="block text-[10px] text-slate-500 font-black text-center mb-2 uppercase tracking-widest border-b border-slate-800 pb-2">Wasit ${i+1}</label>
            <input type="number" step="0.5" id="score-${i+1}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-3xl font-black text-center text-white outline-none border border-slate-700 focus:border-blue-500 transition-all" placeholder="0">
            <div class="flex items-center mt-2 bg-slate-950 rounded p-1.5 border border-slate-800">
                <span class="text-[9px] text-slate-600 font-bold px-1 uppercase">${i===0?'Tie-Bk':'Teknik'}</span>
                <input type="number" step="0.5" id="tech-${i+1}" oninput="calculateLive()" class="w-full bg-transparent text-sm font-bold text-center ${i===0?'text-yellow-400':'text-blue-400'} outline-none" placeholder="0">
            </div>
        </div>`).join('');
    calculateLive();
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
    const fl_el = document.getElementById('live-final-score'); if(fl_el) fl_el.innerText = final.toFixed(1);
    const pn_el = document.getElementById('live-penalty'); if(pn_el) pn_el.innerText = penalty > 0 ? `Penalti Waktu: -${penalty}` : `Penalti Waktu: 0`;
    return { final, penalty, raw, techRaw, tie: techRaw[0] };
}

function saveScore(babak) {
    const pId = parseInt(document.getElementById('select-peserta').value); if(!pId) return alert("Pilih atlet!");
    const calc = calculateLive(), p = STATE.participants.find(x => x.id === pId);
    let key = (babak === 1) ? 'b1' : 'b2'; if(typeof babak === 'string') key = babak;
    p.scores[key] = { raw: calc.raw, techRaw: calc.techRaw, penalty: calc.penalty, final: calc.final, tech: calc.tie, time: UI.timerSeconds };
    saveToLocalStorage(); alert("SKOR TERSIMPAN!"); resetTimer();
}

// --- RANDORI ENGINE (With BATSU POIN LAWAN) ---
function addRandoriScore(corner, pts) {
    RANDORI_STATE[corner].score += pts; if(RANDORI_STATE[corner].score < 0) RANDORI_STATE[corner].score = 0;
    updateRandoriUI();
}

function saveRandoriMatchResult() {
    const val = document.getElementById('select-peserta').value; if(!val.startsWith('match-')) return;
    const matchId = parseFloat(val.replace('match-', ''));
    const match = STATE.matches.find(m => m.id === matchId);
    if(!match || RANDORI_STATE.merah.score === RANDORI_STATE.putih.score) return alert("Skor seri!");
    match.winnerId = RANDORI_STATE.merah.score > RANDORI_STATE.putih.score ? match.merahId : match.putihId;
    match.loserId = match.winnerId === match.merahId ? match.putihId : match.merahId;
    match.skorMerah = RANDORI_STATE.merah.score; match.skorPutih = RANDORI_STATE.putih.score; match.status = 'done';
    forwardParticipant(match.nextW, match.winnerId, match.kategori, match.pool);
    if(match.nextL) forwardParticipant(match.nextL, match.loserId, match.kategori, match.pool);
    saveToLocalStorage(); alert("Pemenang dicatat!"); filterPesertaScoring();
}

// --- RANKING & EXPORT (MICRO/MACRO) ---
function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    const container = document.getElementById('ranking-list'); if(!container) return;
    injectMicroButtons('rank', filter);
    if(!filter) return container.innerHTML = '<div class="p-10 text-center text-slate-500 border-2 border-dashed border-slate-800 rounded-2xl italic">Pilih kategori.</div>';
    
    let catObj = STATE.categories.find(c => c.name === filter), list = STATE.participants.filter(p => p.kategori === filter);
    let html = `<h3 class="text-xl font-black text-yellow-400 mb-6 border-b border-slate-700 pb-3 uppercase tracking-widest">${filter}</h3>`;

    if(catObj?.discipline === 'embu') {
        ['FINAL', 'SINGLE', 'A', 'B'].forEach(pk => {
            let poolList = (pk === 'FINAL') ? list.filter(p => p.isFinalist) : list.filter(p => p.pool === pk && p.scores.b1.final > 0);
            if(poolList.length === 0) return;
            poolList.sort((a,b) => (pk==='FINAL' ? (b.scores.b2.final-a.scores.b2.final || b.scores.b2.tech-a.scores.b2.tech) : (b.scores.b1.final-a.scores.b1.final || b.scores.b1.tech-a.scores.b1.tech)));
            html += `<h4 class="text-blue-500 font-black mt-8 mb-4 border-l-4 border-blue-600 pl-3">KLASEMEN ${pk}</h4>`;
            html += poolList.map((p,i) => `<div class="bg-dark-card p-4 rounded-xl border border-slate-700 mb-3 flex justify-between items-center shadow-lg"><div><div class="font-bold text-white text-lg">${i+1}. ${p.nama} ${pk!=='FINAL'&&p.isFinalist?'<span class="text-[9px] bg-yellow-600 text-black px-2 py-0.5 rounded ml-2 font-black">LULUS</span>':''}</div><div class="text-xs text-slate-500 font-bold uppercase">${p.kontingen}</div></div><div class="text-right"><div class="text-[10px] text-green-500 font-black">SCORE</div><div class="text-3xl font-black text-white font-mono">${(pk==='FINAL'?p.scores.b2.final : p.scores.b1.final).toFixed(2)}</div></div></div>`).join('');
        });
    } else {
        const wins = calculateRandoriFinalists(filter);
        if(wins) {
            html += `<div class="bg-yellow-600/10 p-4 rounded-xl border border-yellow-600 mb-2"><div class="text-xs font-black text-yellow-500">GOLD</div><div class="text-xl font-black text-white">${wins.emas}</div></div>`;
            html += `<div class="bg-slate-400/10 p-4 rounded-xl border border-slate-400 mb-2"><div class="text-xs font-black text-slate-300">SILVER</div><div class="text-xl font-black text-white">${wins.perak}</div></div>`;
        } else { html += '<div class="p-10 text-center text-slate-600 italic">Turnamen berjalan...</div>'; }
    }
    container.innerHTML = html;
}

// --- 4. UTILS & SUPPORT ---
function updateActiveViewsSilent() {
    const activeTab = UI.tabs.find(t => document.getElementById(`section-${t}`)?.classList.contains('block'));
    if (activeTab === 'ranking') renderRanking();
    if (activeTab === 'drawing') checkExistingDrawing();
    if (activeTab === 'juara') renderJuaraUmum();
}

function updateRandoriUI() { 
    if(document.getElementById('score-merah')) document.getElementById('score-merah').innerText = RANDORI_STATE.merah.score; 
    if(document.getElementById('score-putih')) document.getElementById('score-putih').innerText = RANDORI_STATE.putih.score; 
}

function toggleTimer() { 
    const btn = document.getElementById('btn-timer');
    if(UI.timerInterval) { clearInterval(UI.timerInterval); UI.timerInterval = null; btn.innerText = "LANJUT"; } 
    else { UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000); btn.innerText = "STOP"; }
}
function resetTimer() { clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI(); calculateLive(); }
function updateTimerUI() { if(document.getElementById('timer-display')) document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds/60).toString().padStart(2,'0')}:${(UI.timerSeconds%60).toString().padStart(2,'0')}`; }

function injectCloudStatus() {
    const h = document.querySelector('header h1')?.parentElement;
    if(h && !document.getElementById('cloud-status')) {
        const badge = document.createElement('div'); badge.id = 'cloud-status';
        badge.className = 'mt-1 text-[10px] font-black uppercase flex items-center gap-2 text-slate-500';
        badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></span> Connecting...';
        h.appendChild(badge);
    }
}
function updateConnectionStatus(on) {
    const b = document.getElementById('cloud-status'); if(!b) return;
    b.innerHTML = on ? '<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span> Cloud Active' : '<span class="w-2 h-2 rounded-full bg-red-500"></span> Offline';
    b.style.color = on ? '#22c55e' : '#ef4444';
}

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
            let list = STATE.participants.filter(p => p.kategori === c.name && (p.scores.b1.final > 0 || p.scores.b2.final > 0));
            list.forEach(p => rows.push(["EMBU", c.name, p.isFinalist?'Final':'Penyisihan', p.nama, p.kontingen, p.scores.b2.final || p.scores.b1.final]));
        } else {
            const w = calculateRandoriFinalists(c.name);
            if(w) { rows.push(["RANDORI", c.name, "1 - EMAS", w.emas, "", ""]); rows.push(["RANDORI", c.name, "2 - PERAK", w.perak, "", ""]); }
        }
    });
    downloadCSV(`Hasil_${filter || 'Global'}`, rows);
}

function injectMicroButtons(type, cat) {
    let id = type === 'draw' ? 'draw-select-kategori' : 'rank-filter-kategori';
    let el = document.getElementById(id); if(!el) return;
    let old = document.getElementById(`btn-micro-${type}`); if(old) old.remove();
    if(!cat) return;
    let btn = document.createElement('button'); btn.id = `btn-micro-${type}`;
    btn.className = 'ml-3 bg-green-600 hover:bg-green-500 text-white px-3 py-1.5 rounded-lg text-[10px] font-black shadow-md';
    btn.innerHTML = `<i class="fas fa-file-csv"></i> UNDUH ${type==='draw'?'JADWAL':'HASIL'}`;
    btn.onclick = () => type === 'draw' ? exportDrawingCSV(cat) : exportHasilCSV(cat);
    el.parentElement.appendChild(btn);
}

function injectAdminExportButtons() {
    const section = document.querySelector('#section-admin .bg-dark-card.text-center');
    if(section) {
        section.innerHTML = `<h2 class="text-xl font-black text-white mb-2">Export Data Global</h2><div class="grid grid-cols-3 gap-4 mt-6"><button onclick="exportDrawingCSV()" class="bg-blue-600 p-4 rounded-xl font-bold">Semua Jadwal</button><button onclick="exportHasilCSV()" class="bg-purple-600 p-4 rounded-xl font-bold">Semua Hasil</button><button onclick="exportMedaliCSV()" class="bg-yellow-600 p-4 rounded-xl font-bold text-black">Semua Medali</button></div>`;
    }
}

function calculateRandoriFinalists(cat) {
    let m = STATE.matches.filter(x => x.kategori === cat && x.status === 'done');
    let gf = m.find(x => x.matchNum === 13 || x.matchNum === 30 || x.babak.includes('GRAND FINAL'));
    if(!gf) return null;
    return { emas: STATE.participants.find(p=>p.id===gf.winnerId)?.nama, perak: STATE.participants.find(p=>p.id===gf.loserId)?.nama };
}

// Modal, Edit, Delete, Reset remain same as stable v15.1
function openEditModal(id) { const p = STATE.participants.find(x => x.id === id); if(!p) return; document.getElementById('edit-id').value = p.id; document.getElementById('edit-nama').value = p.nama; document.getElementById('edit-kontingen').value = p.kontingen; document.getElementById('edit-kategori').value = p.kategori; document.getElementById('edit-modal').classList.remove('hidden'); }
function deletePeserta(id) { if(confirm("Hapus?")) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }
function deleteCategory(id) { if(confirm("Hapus?")) { STATE.categories = STATE.categories.filter(c => c.id !== id); saveToLocalStorage(); refreshAllData(); } }
function resetTotalSistem() { if(confirm("RESET TOTAL?")) { localStorage.clear(); location.reload(); } }
