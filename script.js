/**
 * MASS - Martial Arts Scoring System
 * Version 16.1 (Realtime Cloud Fix: Asia-Southeast1 Support)
 */

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
let RANDORI_STATE = { merah: { score: 0 }, putih: { score: 0 } };
let SWAP_SELECTION = null; 

// --- FIREBASE CLOUD SYNC LOGIC ---
let dbRef_set = null;
let dbRef_child = null;
let database_instance = null;
let isCloudReady = false;

document.addEventListener('DOMContentLoaded', () => { 
    refreshAllData(); 
    setJudges(5); 
    injectAdminExportButtons();
    initFirebase(); 
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
            databaseURL: "https://mass-pro-turnamen-default-rtdb.asia-southeast1.firebasedatabase.app/", // FIXED: Database URL added
            storageBucket: "mass-pro-turnamen.firebasestorage.app",
            messagingSenderId: "268290671498",
            appId: "1:268290671498:web:d55e4960e392f7dfc8fe73"
        };

        const app = initializeApp(firebaseConfig);
        database_instance = getDatabase(app);
        dbRef_set = set;
        dbRef_child = ref;

        const dataRef = ref(database_instance, 'mass_data');
        
        onValue(dataRef, (snapshot) => {
            const data = snapshot.val();
            if (data) {
                STATE.categories = data.categories || [];
                STATE.participants = data.participants || [];
                STATE.matches = data.matches || [];
                if(data.settings) STATE.settings = data.settings;
            }
            isCloudReady = true;
            updateConnectionStatus(true);
            refreshAllData();
            updateActiveViews();
        }, (error) => {
            console.error("Cloud Error:", error);
            updateConnectionStatus(false);
        });
    } catch(e) {
        console.error("Cloud Init Failed:", e);
        updateConnectionStatus(false);
    }
}

function saveToLocalStorage() {
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
    localStorage.setItem('mass_matches', JSON.stringify(STATE.matches));

    if (isCloudReady && database_instance && dbRef_set && dbRef_child) {
        dbRef_set(dbRef_child(database_instance, 'mass_data'), STATE).catch(err => console.error("Cloud Upload Failed:", err));
    }
}

function injectCloudStatus() {
    const headerTitle = document.querySelector('header h1').parentElement;
    if(headerTitle && !document.getElementById('cloud-status')) {
        const statusBadge = document.createElement('div');
        statusBadge.id = 'cloud-status';
        statusBadge.className = 'mt-1 flex items-center gap-1.5 text-[9px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full w-fit border border-slate-700 shadow-sm';
        statusBadge.innerHTML = '<span class="w-2 h-2 rounded-full bg-slate-500 animate-pulse"></span> Connecting to Cloud...';
        headerTitle.appendChild(statusBadge);
    }
}

function updateConnectionStatus(isOnline) {
    const badge = document.getElementById('cloud-status');
    if(badge) {
        if(isOnline) {
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_#22c55e]"></span> Cloud Online';
            badge.className = 'mt-1 flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full w-fit shadow-sm border border-green-900 bg-green-900/20 text-green-400';
        } else {
            badge.innerHTML = '<span class="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_#ef4444]"></span> Offline Mode';
            badge.className = 'mt-1 flex items-center gap-1.5 text-[9px] font-bold px-2 py-0.5 rounded-full w-fit shadow-sm border border-red-900 bg-red-900/20 text-red-400';
        }
    }
}

function updateActiveViews() {
    if (document.getElementById('section-ranking')?.classList.contains('block')) renderRanking();
    if (document.getElementById('section-drawing')?.classList.contains('block')) checkExistingDrawing();
    if (document.getElementById('section-juara')?.classList.contains('block')) renderJuaraUmum();
    if (document.getElementById('section-scoring')?.classList.contains('block')) filterPesertaScoring();
}

function injectAdminExportButtons() {
    const adminExportSection = document.querySelector('#section-admin .bg-dark-card.text-center');
    if (adminExportSection) {
        adminExportSection.innerHTML = `
            <h2 class="text-xl font-black text-white mb-2"><i class="fas fa-download text-green-500 mr-2"></i>Pusat Export Data (Makro)</h2>
            <p class="text-sm text-slate-400 mb-6">Unduh seluruh rekapitulasi data global untuk Laporan Resmi Sekretariat.</p>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button onclick="exportDrawingCSV()" class="bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 px-4 rounded-xl transition-transform hover:scale-105 shadow-lg text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-sitemap text-2xl"></i><span>Semua Jadwal & Drawing</span>
                </button>
                <button onclick="exportHasilCSV()" class="bg-purple-600 hover:bg-purple-500 text-white font-bold py-4 px-4 rounded-xl transition-transform hover:scale-105 shadow-lg text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-trophy text-2xl"></i><span>Semua Hasil & Juara</span>
                </button>
                <button onclick="exportMedaliCSV()" class="bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-4 px-4 rounded-xl transition-transform hover:scale-105 shadow-lg text-sm flex flex-col items-center justify-center gap-2">
                    <i class="fas fa-medal text-2xl"></i><span>Klasemen Medali Akhir</span>
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
    updateActiveViews();
}

document.getElementById('form-kategori').addEventListener('submit', (e) => { e.preventDefault(); const name = document.getElementById('cat-name').value.trim(); const type = parseInt(document.getElementById('cat-type').value); const discipline = document.getElementById('cat-discipline').value; if(!name) return; if(STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert("Kategori sudah ada!"); STATE.categories.push({ id: Date.now(), name, type, discipline }); saveToLocalStorage(); refreshAllData(); e.target.reset(); });
function renderCategoryList() { const container = document.getElementById('list-kategori'); if(!container) return; if(STATE.categories.length === 0) return container.innerHTML = `<span class="text-sm text-slate-500 italic">Belum ada kategori.</span>`; container.innerHTML = STATE.categories.map(c => { let badgeColor = c.discipline === 'randori' ? 'bg-red-700' : 'bg-blue-600'; let disciplineText = c.discipline ? c.discipline.toUpperCase() : 'EMBU'; return `<div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm"><span class="${badgeColor} text-[9px] px-1.5 py-0.5 rounded font-bold">${disciplineText}</span><span class="font-bold text-white">${c.name}</span><span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span><button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button></div>` }).join(''); }
function deleteCategory(id) { if(confirm("Hapus kategori ini?")) { STATE.categories = STATE.categories.filter(c => c.id !== id); saveToLocalStorage(); refreshAllData(); } }

function setDropdownHTML(id, html) {
    const el = document.getElementById(id);
    if(!el) return;
    const val = el.value;
    el.innerHTML = html;
    if(val && Array.from(el.options).some(o => o.value === val)) el.value = val;
}

function updateAllDropdowns() { 
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join(''); 
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`; 
    const combined = emptyOpt + options;
    setDropdownHTML('p-kategori', combined); 
    setDropdownHTML('edit-kategori', combined); 
    setDropdownHTML('draw-select-kategori', combined); 
    setDropdownHTML('select-kategori', combined); 
    setDropdownHTML('rank-filter-kategori', combined); 
    const allOpt = '<option value="all">Semua Kategori</option>'; 
    setDropdownHTML('filter-atlet-kategori', allOpt + options); 
}

function handleCSVUpload(event) { 
    const file = event.target.files[0]; if (!file) return; 
    const reader = new FileReader(); 
    reader.onload = function(e) { 
        const rows = e.target.result.split('\n'); let count = 0; 
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
    const body = document.getElementById('table-peserta-body'); if(!body) return;
    const filter = document.getElementById('filter-atlet-kategori').value; 
    let list = filter && filter !== 'all' ? STATE.participants.filter(p => p.kategori === filter) : STATE.participants; 
    if(list.length === 0) return body.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Tidak ada data.</td></tr>`; 
    let sortedList = [...list].sort((a,b) => a.kategori === b.kategori ? a.urut - b.urut : a.kategori.localeCompare(b.kategori)); 
    body.innerHTML = sortedList.map(p => { 
        let statusHTML = p.urut > 0 ? `<span class="bg-slate-700 px-2 py-1 rounded text-xs font-mono inline-block mb-1">No.${p.urut} | Pool ${p.pool}</span>` : `<span class="text-xs text-red-400 italic inline-block mb-1">Belum Undian</span>`; 
        if(p.losses === 1) statusHTML += ` <span class="bg-orange-600 text-[10px] px-1 rounded ml-1 inline-block">LB</span>`; 
        else if(p.losses >= 2) statusHTML += ` <span class="bg-red-800 text-[10px] px-1 rounded ml-1 inline-block">Out</span>`; 
        return `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"><td class="p-3 align-top font-bold text-blue-300 w-[35%] whitespace-normal break-words leading-tight">${p.nama} ${p.isFinalist ? '<br><span class="text-[10px] bg-yellow-500 text-black px-1 rounded inline-block mt-1">FINALIS</span>' : ''}</td><td class="p-3 align-top w-[25%] whitespace-normal break-words text-sm text-slate-200">${p.kontingen}</td><td class="p-3 align-top text-xs text-slate-400 w-[25%] whitespace-normal break-words leading-relaxed"><span class="text-blue-400 font-semibold">${p.kategori}</span><br>${statusHTML}</td><td class="p-3 align-top text-right w-[15%] whitespace-nowrap"><button onclick="openEditModal(${p.id})" class="text-blue-400 mr-2 hover:bg-blue-900/50 p-2 rounded transition-colors"><i class="fas fa-edit"></i></button><button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 hover:bg-red-900/30 p-2 rounded transition-colors"><i class="fas fa-trash"></i></button></td></tr>`; 
    }).join(''); 
}

function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value; 
    const panelEmbu = document.getElementById('draw-panel-embu'); const panelRandori = document.getElementById('draw-panel-randori'); const panelEmpty = document.getElementById('draw-panel-empty'); const resultDiv = document.getElementById('drawing-result'); 
    if(!panelEmbu || !panelRandori) return;
    panelEmbu.classList.add('hidden'); panelRandori.classList.add('hidden'); panelEmpty.classList.add('hidden'); resultDiv.innerHTML = ''; document.getElementById('randori-bracket-container').classList.add('hidden');
    
    let drawHeader = document.querySelector('#section-drawing > div:first-child');
    let microDrawBtn = document.getElementById('btn-micro-draw-export');
    if (!microDrawBtn && drawHeader) {
        microDrawBtn = document.createElement('button'); microDrawBtn.id = 'btn-micro-draw-export';
        microDrawBtn.className = 'w-full md:w-auto bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors text-sm flex items-center justify-center gap-2 mt-4 md:mt-0';
        microDrawBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH JADWAL';
        microDrawBtn.onclick = () => exportDrawingCSV(document.getElementById('draw-select-kategori').value);
        drawHeader.appendChild(microDrawBtn);
    }
    
    if(!catName) { panelEmpty.classList.remove('hidden'); if(microDrawBtn) microDrawBtn.classList.add('hidden'); return; }
    if(microDrawBtn) microDrawBtn.classList.remove('hidden');
    
    const categoryObj = STATE.categories.find(c => c.name === catName); let list = STATE.participants.filter(p => p.kategori === catName); 
    if(categoryObj && categoryObj.discipline === 'randori') { panelRandori.classList.remove('hidden'); renderVisualBracket(catName); } 
    else { 
        panelEmbu.classList.remove('hidden'); const isFinalMode = list.some(p => p.isFinalist); 
        if (isFinalMode) { 
            let finalL = list.filter(p => p.isFinalist); 
            if (finalL.some(p => p.urutFinal > 0)) { finalL.sort((a,b) => a.urutFinal - b.urutFinal); renderEmbuLayout(catName, resultDiv, [{data: finalL, title: "POOL FINAL", isFinal: true}]); } 
            else { resultDiv.innerHTML = `<div class="col-span-full text-center text-yellow-500 py-10 border-2 border-dashed border-yellow-600 rounded-xl">Peserta Final dipilih. Klik Acak Urutan.</div>`; } 
        } else if (list.some(p => p.urut > 0)) { 
            list.sort((a,b) => a.urut - b.urut); 
            if(list.some(p => p.pool === 'A' || p.pool === 'B')) { renderEmbuLayout(catName, resultDiv, [ {data: list.filter(p => p.pool === 'A'), title: "POOL A", isFinal: false}, {data: list.filter(p => p.pool === 'B'), title: "POOL B", isFinal: false} ]); } 
            else { renderEmbuLayout(catName, resultDiv, [{data: list, title: "BABAK PENYISIHAN", isFinal: false}]); } 
        } else { resultDiv.innerHTML = `<div class="col-span-full text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Belum diundi.</div>`; } 
    }
}

function filterPesertaScoring() {
    const catName = document.getElementById('select-kategori').value;
    const categoryObj = STATE.categories.find(c => c.name === catName);
    const panelEmbu = document.getElementById('panel-embu'); const panelRandori = document.getElementById('panel-randori');
    const badgeEmbu = document.getElementById('scoring-badge-embu'); const badgeRandori = document.getElementById('scoring-badge-randori');
    const panelWaktu = document.getElementById('panel-waktu-embu'); const selectEl = document.getElementById('select-peserta');
    if(!categoryObj || !selectEl) return;
    let currentVal = selectEl.value;

    if(categoryObj.discipline === 'randori') {
        panelEmbu.classList.add('hidden'); panelRandori.classList.remove('hidden'); badgeEmbu.classList.add('hidden'); badgeRandori.classList.remove('hidden');
        if(panelWaktu) panelWaktu.classList.add('hidden'); 
        let catMatches = STATE.matches.filter(m => m.kategori === catName && m.status === 'pending' && m.merahId !== null && m.putihId !== null && m.merahId !== -1 && m.putihId !== -1);
        if(catMatches.length === 0) { selectEl.innerHTML = `<option value="">-- No Active Match --</option>`; document.getElementById('scoring-athlete-name').innerText = "-"; return; }
        selectEl.innerHTML = catMatches.sort((a,b)=>a.matchNum - b.matchNum).map((m) => {
            const mrh = STATE.participants.find(p => p.id === m.merahId); const pth = STATE.participants.find(p => p.id === m.putihId);
            return `<option value="match-${m.id}">G-${m.matchNum % 50 || 50} [${m.pool}] ${mrh.nama} vs ${pth.nama}</option>`;
        }).join('');
    } else {
        panelEmbu.classList.remove('hidden'); panelRandori.classList.add('hidden'); badgeEmbu.classList.remove('hidden'); badgeRandori.classList.add('hidden');
        if(panelWaktu) panelWaktu.classList.remove('hidden'); 
        let listCat = STATE.participants.filter(p => p.kategori === catName && p.urut > 0); const hasFinal = listCat.some(p => p.isFinalist);
        let filtered = hasFinal ? listCat.filter(p => p.isFinalist).sort((a,b) => a.urutFinal - b.urutFinal) : listCat.sort((a,b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
        if(filtered.length === 0) { selectEl.innerHTML = `<option value="">-- No Drawing Yet --</option>`; document.getElementById('scoring-athlete-name').innerText = "-"; return; }
        selectEl.innerHTML = filtered.map(p => { let label = hasFinal ? `[FINAL] No.${p.urutFinal}` : `[Pool ${p.pool}] No.${p.urut}`; return `<option value="${p.id}">${label} - ${p.nama}</option>`; }).join('');
    }
    if (currentVal && Array.from(selectEl.options).some(o => o.value === currentVal)) { selectEl.value = currentVal; } 
    else { selectEl.dispatchEvent(new Event('change')); }
}

function cancelFinalist() {
    const filter = document.getElementById('rank-filter-kategori').value; if(!filter) return;
    if(!confirm("⚠️ Batalkan status finalis? Data akan dikembalikan ke Pool awal.")) return;
    let catParts = STATE.participants.filter(p => p.kategori === filter);
    catParts.forEach(p => {
        if (p.isFinalist) {
            p.isFinalist = false; p.urutFinal = 0;
            if (p.pool === 'FINAL') {
                let takenA = catParts.some(x => x.pool === 'A' && x.urut === p.urut && x.id !== p.id);
                p.pool = takenA ? 'B' : 'A';
            }
        }
    });
    saveToLocalStorage(); alert("Done!"); renderRanking(); checkExistingDrawing();
}

function promoteToFinal() {
    const filter = document.getElementById('rank-filter-kategori').value; if(!filter) return alert("Select category!");
    let list = STATE.participants.filter(p => p.kategori === filter && (p.pool === 'A' || p.pool === 'B'));
    let numFinalists = parseInt(prompt("How many finalists from each pool?", "3"));
    if(!numFinalists || isNaN(numFinalists)) return;
    let poolA = list.filter(p => p.pool === 'A' && p.scores.b1.final > 0).sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
    let poolB = list.filter(p => p.pool === 'B' && p.scores.b1.final > 0).sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);
    let combined = [...poolA.slice(0, numFinalists), ...poolB.slice(0, numFinalists)];
    combined.forEach(w => { let p = STATE.participants.find(x => x.id === w.id); if(p) p.isFinalist = true; });
    saveToLocalStorage(); alert("Finalists set!"); renderRanking(); checkExistingDrawing();
}

function renderRanking() { 
    const filter = document.getElementById('rank-filter-kategori').value; 
    const btnPromote = document.getElementById('btn-promote-final'); 
    const container = document.getElementById('ranking-list'); if(!container) return;

    let microRankBtn = document.getElementById('btn-micro-rank-export');
    if (!microRankBtn && btnPromote) {
        microRankBtn = document.createElement('button'); microRankBtn.id = 'btn-micro-rank-export';
        microRankBtn.className = 'whitespace-nowrap bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded-lg shadow-md text-sm flex items-center gap-2';
        microRankBtn.innerHTML = '<i class="fas fa-file-csv"></i> UNDUH HASIL';
        microRankBtn.onclick = () => exportHasilCSV(document.getElementById('rank-filter-kategori').value);
        btnPromote.parentElement.appendChild(microRankBtn);
    }

    if (!filter) { btnPromote?.classList.add('hidden'); microRankBtn?.classList.add('hidden'); return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Select a category above.</div>`; }
    microRankBtn?.classList.remove('hidden');

    let catObj = STATE.categories.find(c => c.name === filter); let catList = STATE.participants.filter(p => p.kategori === filter); 
    const hasFinal = catList.some(p => p.isFinalist); 
    
    if(catObj && catObj.discipline === 'embu' && btnPromote) {
        btnPromote.classList.remove('hidden');
        if(!hasFinal) { btnPromote.innerHTML = 'TETAPKAN FINALIS'; btnPromote.className = "bg-yellow-600 hover:bg-yellow-500 text-white font-bold py-2 px-4 rounded-lg text-sm"; btnPromote.onclick = promoteToFinal; } 
        else { btnPromote.innerHTML = 'BATALKAN FINALIS'; btnPromote.className = "bg-red-600 hover:bg-red-500 text-white font-bold py-2 px-4 rounded-lg text-sm"; btnPromote.onclick = cancelFinalist; }
    } else { btnPromote?.classList.add('hidden'); }

    let htmlOutput = `<h3 class="text-xl font-bold text-yellow-400 mt-4 mb-4 border-b-2 border-slate-700 pb-3 uppercase">${catObj.name}</h3>`;
    if(catObj.discipline === 'embu') {
        ['FINAL', 'SINGLE', 'A', 'B'].forEach(poolKey => { 
            let poolList = poolKey === 'FINAL' ? catList.filter(p => p.isFinalist) : catList.filter(p => p.pool === poolKey && p.scores.b1.final > 0);
            if(poolList.length === 0) return; 
            if(poolKey === 'FINAL') poolList.sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); 
            else poolList.sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech); 
            htmlOutput += `<h4 class="text-md font-bold text-blue-400 mt-6 mb-3 pl-2 border-l-4 border-blue-500 uppercase">${poolKey}</h4>`; 
            htmlOutput += poolList.map((p, i) => { 
                let score = poolKey === 'FINAL' ? p.scores.b2.final : p.scores.b1.final;
                return `<div class="bg-dark-card p-4 rounded-xl border border-slate-700 mb-3 flex justify-between items-center"><div class="flex-1"><div class="font-bold text-lg text-white">${p.nama} ${poolKey !== 'FINAL' && p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-1 rounded ml-2">FINAL</span>' : ''}</div><div class="text-xs text-slate-400">${p.kontingen}</div></div><div class="text-right"><div class="text-[10px] text-green-400 font-bold uppercase">SCORE</div><div class="text-2xl font-black text-white">${score.toFixed(2)}</div></div></div>`;
            }).join(''); 
        }); 
    } else {
        const wins = calculateRandoriFinalists(catObj.name);
        if(!wins) { htmlOutput += `<div class="p-6 text-center text-slate-600 bg-slate-900/50 rounded-xl border border-slate-800 text-sm italic">Matches in progress...</div>`; } 
        else {
            htmlOutput += `<div class="space-y-3"><div class="bg-yellow-600/10 border border-yellow-600 p-4 rounded-xl text-white"><div class="text-xs font-bold uppercase text-yellow-500">GOLD</div><div class="text-lg font-black">${wins.emas}</div></div><div class="bg-slate-500/10 border border-slate-500 p-4 rounded-xl text-white"><div class="text-xs font-bold uppercase text-slate-300">SILVER</div><div class="text-lg font-black">${wins.perak}</div></div>${wins.perunggu.map(n => `<div class="bg-amber-800/10 border border-amber-700 p-4 rounded-xl text-white"><div class="text-xs font-bold uppercase text-amber-600">BRONZE</div><div class="text-lg font-black">${n}</div></div>`).join('')}</div>`;
        }
    }
    container.innerHTML = htmlOutput; 
}

function renderJuaraUmum() { 
    let tally = {}; 
    STATE.categories.forEach(cat => { 
        if(cat.discipline === 'embu') {
            let wins = STATE.participants.filter(p => p.kategori === cat.name && p.isFinalist && p.scores.b2.final > 0).sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); 
            if(wins[0]) { tally[wins[0].kontingen] = tally[wins[0].kontingen] || {g:0, s:0, b:0}; tally[wins[0].kontingen].g++; } 
            if(wins[1]) { tally[wins[1].kontingen] = tally[wins[1].kontingen] || {g:0, s:0, b:0}; tally[wins[1].kontingen].s++; } 
            if(wins[2]) { tally[wins[2].kontingen] = tally[wins[2].kontingen] || {g:0, s:0, b:0}; tally[wins[2].kontingen].b++; } 
        } else {
            const wins = calculateRandoriFinalists(cat.name); if(!wins || !cat.name.toUpperCase().includes('FINAL')) return; 
            if(wins.emas) { let p = STATE.participants.find(x => x.nama === wins.emas && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].g++; } }
            if(wins.perak) { let p = STATE.participants.find(x => x.nama === wins.perak && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].s++; } }
            wins.perunggu.forEach(n => { let p = STATE.participants.find(x => x.nama === n && x.kategori === cat.name); if(p) { tally[p.kontingen] = tally[p.kontingen] || {g:0, s:0, b:0}; tally[p.kontingen].b++; } });
        }
    }); 
    let leaderboard = Object.keys(tally).map(k => ({ nama: k, emas: tally[k].g, perak: tally[k].s, perunggu: tally[k].b, total: tally[k].g + tally[k].s + tally[k].b })); 
    leaderboard.sort((a,b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu); 
    const tbody = document.getElementById('table-juara-body'); if(!tbody) return;
    if(leaderboard.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No medals yet.</td></tr>`; 
    tbody.innerHTML = leaderboard.map((k, i) => `<tr class="border-b border-slate-800"><td class="p-4 text-center font-bold">${i+1}</td><td class="p-4 font-bold text-white">${k.nama}</td><td class="p-4 text-center text-yellow-500 font-black">${k.emas}</td><td class="p-4 text-center text-slate-300 font-black">${k.perak}</td><td class="p-4 text-center text-amber-600 font-black">${k.perunggu}</td><td class="p-4 text-center text-blue-400 font-black">${k.total}</td></tr>`).join(''); 
}

function downloadCSV(filename, rows) {
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.map(cell => `"${cell}"`).join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = filename; link.click();
}

function exportDrawingCSV(filterCatName = null) {
    let rows = [["Disiplin", "Kategori", "Pool / Babak", "No. Urut / Partai", "Sudut Merah (AKA) / Atlet", "Sudut Putih (SHIRO) / Kontingen", "Status"]];
    let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;
    categoriesToExport.forEach(cat => {
        if (cat.discipline === 'embu') {
            STATE.participants.filter(p => p.kategori === cat.name && p.urut > 0).forEach(p => { rows.push(["EMBU", cat.name, `Pool ${p.pool}`, p.urut, p.nama, p.kontingen, ""]); });
        } else {
            STATE.matches.filter(m => m.kategori === cat.name).forEach(m => {
                let mrh = STATE.participants.find(x => x.id === m.merahId); let pth = STATE.participants.find(x => x.id === m.putihId);
                rows.push(["RANDORI", cat.name, `${m.pool} - ${m.babak}`, `G-${m.matchNum % 50 || 50}`, mrh?.nama || "BYE", pth?.nama || "BYE", m.status]);
            });
        }
    });
    downloadCSV(`Drawing_${filterCatName || 'All'}.csv`, rows);
}

function exportHasilCSV(filterCatName = null) {
    let rows = [["Disiplin", "Kategori", "Peringkat", "Nama", "Kontingen", "Skor"]];
    let categoriesToExport = filterCatName ? STATE.categories.filter(c => c.name === filterCatName) : STATE.categories;
    categoriesToExport.forEach(cat => {
        if (cat.discipline === 'embu') {
            let list = STATE.participants.filter(p => p.kategori === cat.name && (p.scores.b1.final > 0 || p.scores.b2.final > 0));
            list.forEach(p => { rows.push(["EMBU", cat.name, "", p.nama, p.kontingen, p.scores.b2.final > 0 ? p.scores.b2.final : p.scores.b1.final]); });
        } else {
            const wins = calculateRandoriFinalists(cat.name);
            if(wins) { rows.push(["RANDORI", cat.name, "1", wins.emas, "", ""]); rows.push(["RANDORI", cat.name, "2", wins.perak, "", ""]); wins.perunggu.forEach(n => rows.push(["RANDORI", cat.name, "3", n, "", ""])); }
        }
    });
    downloadCSV(`Results_${filterCatName || 'All'}.csv`, rows);
}

function exportMedaliCSV() {
    let tally = {}; // Re-run tally logic
    STATE.categories.forEach(cat => { /* ... simplified tally ... */ });
    let rows = [["Rank", "Kontingen", "Gold", "Silver", "Bronze", "Total"]];
    // ... Logic to fill rows ...
    downloadCSV("Medals_Final.csv", rows);
}

function addRandoriScore(corner, points) { RANDORI_STATE[corner].score += points; if(RANDORI_STATE[corner].score < 0) RANDORI_STATE[corner].score = 0; updateRandoriUI(); }
function setJudges(n) { STATE.settings.numJudges = n; const container = document.getElementById('judge-inputs'); if(!container) return; container.innerHTML = ''; for(let i=1; i<=n; i++) { container.innerHTML += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-600"><label class="block text-[10px] text-slate-400 uppercase font-bold text-center border-b border-slate-700 mb-2 pb-2">Jury ${i}</label><input type="number" step="0.5" id="score-${i}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-2xl font-black text-center text-white outline-none" placeholder="0"></div>`; } calculateLive(); }
function calculateLive() { let raw = []; for(let i=1; i<=STATE.settings.numJudges; i++) { let sEl = document.getElementById(`score-${i}`); raw.push(parseFloat(sEl?.value) || 0); } let sum = 0; if(STATE.settings.numJudges === 5) { let sorted = [...raw].sort((a,b) => a-b); sorted.pop(); sorted.shift(); sum = sorted.reduce((a,b) => a+b, 0); } else { sum = raw.reduce((a,b) => a+b, 0); } let minT = parseInt(document.getElementById('min-time')?.value) || 0; let maxT = parseInt(document.getElementById('max-time')?.value) || 0; let penalty = 0; if(UI.timerSeconds > 0 && minT > 0 && UI.timerSeconds < minT) penalty = Math.ceil((minT - UI.timerSeconds)/5)*5; else if(maxT > 0 && UI.timerSeconds > maxT) penalty = Math.ceil((UI.timerSeconds - maxT)/5)*5; const final = Math.max(0, sum - penalty); document.getElementById('live-final-score').innerText = final.toFixed(1); document.getElementById('live-penalty').innerText = `Penalty: -${penalty}`; return { final, penalty, raw }; }
function toggleTimer() { const btn = document.getElementById('btn-timer'); if(UI.timerInterval) { clearInterval(UI.timerInterval); UI.timerInterval = null; btn.innerText = 'START'; } else { UI.timerSeconds = 0; UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000); btn.innerText = 'STOP'; } }
function resetTimer() { clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI(); calculateLive(); }
function updateTimerUI() { document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds/60).toString().padStart(2, '0')}:${(UI.timerSeconds%60).toString().padStart(2, '0')}`; }
function resetAllPenilaian() { if(confirm('Reset all scores?')) { STATE.participants.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }; p.isFinalist = false; }); STATE.matches = []; saveToLocalStorage(); refreshAllData(); } }
function resetDataAtlet() { if(confirm('Delete all athletes?')) { STATE.participants = []; STATE.matches = []; saveToLocalStorage(); refreshAllData(); } }
function resetTotalSistem() { if(confirm('Factory Reset?')) { localStorage.clear(); location.reload(); } }
