/**
 * MASS - Martial Arts Scoring System
 * Version 5.1 (Preserve Preliminary Scores & isFinalist Flag)
 */

function initializeData() {
    try {
        let cats = JSON.parse(localStorage.getItem('mass_categories')) || [];
        let parts = JSON.parse(localStorage.getItem('mass_participants')) || [];
        if (parts.length > 0 && (!parts[0].scores || !parts[0].scores.b1)) {
            localStorage.clear();
            return { categories: [], participants: [], settings: { numJudges: 5 } };
        }
        return { categories: cats, participants: parts, settings: { numJudges: 5 } };
    } catch (e) {
        localStorage.clear(); return { categories: [], participants: [], settings: { numJudges: 5 } };
    }
}

let STATE = initializeData();

const UI = {
    tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'juara', 'admin'],
    timerInterval: null, timerSeconds: 0
};

document.addEventListener('DOMContentLoaded', () => {
    refreshAllData(); setJudges(5); 
    const selectPesertaEl = document.getElementById('select-peserta');
    if (selectPesertaEl) {
        selectPesertaEl.addEventListener('change', (e) => {
            if(e.target.selectedIndex >= 0) {
                document.getElementById('scoring-athlete-name').innerText = e.target.options[e.target.selectedIndex].text;
                updateScoringButtonsUI();
            }
        });
    }
});

function saveToLocalStorage() {
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
}

function refreshAllData() { renderCategoryList(); updateAllDropdowns(); renderParticipantTable(); }

function switchTab(targetTab) {
    UI.tabs.forEach(tab => {
        const sectionEl = document.getElementById(`section-${tab}`);
        const tabEl = document.getElementById(`tab-${tab}`);
        if (sectionEl) { sectionEl.classList.add('hidden'); sectionEl.classList.remove('block'); }
        if (tabEl) { 
            tabEl.classList.remove('active-tab', 'text-blue-500', 'text-red-400', 'text-yellow-400'); 
            if(tab === 'admin') tabEl.classList.add('text-red-400');
            else if(tab === 'juara') tabEl.classList.add('text-yellow-500');
            else tabEl.classList.add('text-slate-400'); 
        }
    });

    const activeSection = document.getElementById(`section-${targetTab}`);
    const activeTab = document.getElementById(`tab-${targetTab}`);
    if (activeSection) { activeSection.classList.remove('hidden'); activeSection.classList.add('block'); }
    if (activeTab) { 
        if(targetTab === 'admin') { activeTab.classList.remove('text-red-400'); activeTab.classList.add('active-tab', 'text-red-500'); } 
        else if(targetTab === 'juara') { activeTab.classList.remove('text-yellow-500'); activeTab.classList.add('active-tab', 'text-yellow-400'); }
        else { activeTab.classList.remove('text-slate-400'); activeTab.classList.add('active-tab', 'text-blue-500'); }
    }

    if(targetTab === 'ranking') renderRanking();
    if(targetTab === 'scoring') filterPesertaScoring();
    if(targetTab === 'drawing') { updateAllDropdowns(); checkExistingDrawing(); }
    if(targetTab === 'juara') renderJuaraUmum();
}

// --- TAB 1 & 2: KATEGORI & ATLET ---
document.getElementById('form-kategori').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    const type = parseInt(document.getElementById('cat-type').value);
    if(!name) return;
    if(STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert("Kategori sudah ada!");
    STATE.categories.push({ id: Date.now(), name, type });
    saveToLocalStorage(); refreshAllData(); e.target.reset();
});

function renderCategoryList() {
    const container = document.getElementById('list-kategori');
    if(STATE.categories.length === 0) return container.innerHTML = `<span class="text-sm text-slate-500 italic">Belum ada kategori.</span>`;
    container.innerHTML = STATE.categories.map(c => `<div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm"><span class="font-bold text-blue-300">${c.name}</span><span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span><button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button></div>`).join('');
}

function deleteCategory(id) { if(confirm("Hapus kategori ini?")) { STATE.categories = STATE.categories.filter(c => c.id !== id); saveToLocalStorage(); refreshAllData(); } }

function updateAllDropdowns() {
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`;
    
    document.getElementById('p-kategori').innerHTML = emptyOpt + options;
    document.getElementById('edit-kategori').innerHTML = emptyOpt + options;
    document.getElementById('draw-select-kategori').innerHTML = emptyOpt + options;
    document.getElementById('select-kategori').innerHTML = emptyOpt + options;
    
    const allOpt = '<option value="all">Semua Kategori</option>';
    document.getElementById('rank-filter-kategori').innerHTML = allOpt + options;
    document.getElementById('filter-atlet-kategori').innerHTML = allOpt + options;
}

function handleCSVUpload(event) {
    const file = event.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const rows = e.target.result.split('\n'); let count = 0, errors = 0;
        rows.forEach((row, i) => {
            if(i === 0 || !row.trim()) return; 
            const cols = row.split(',').map(item => item.trim().replace(/^"|"$/g, ''));
            if(cols.length >= 3) {
                const nama = cols[0], kontingen = cols[1], kategori = cols[2];
                if(nama && STATE.categories.some(c => c.name.toLowerCase() === kategori.toLowerCase())) {
                    STATE.participants.push({ id: Date.now() + i, nama, kontingen, kategori, urut: 0, pool: '-', isFinalist: false, urutFinal: 0, scores: { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } }, finalScore: 0, techScore: 0 });
                    count++;
                } else errors++;
            }
        });
        saveToLocalStorage(); refreshAllData(); event.target.value = ''; alert(`${count} Atlet diimport.\n(${errors} gagal/kategori tidak valid).`);
    }; reader.readAsText(file);
}

document.getElementById('form-peserta').addEventListener('submit', (e) => {
    e.preventDefault(); const catName = document.getElementById('p-kategori').value; if(!catName) return alert("Pilih kategori!");
    STATE.participants.push({ id: Date.now(), nama: document.getElementById('p-nama').value, kontingen: document.getElementById('p-kontingen').value, kategori: catName, urut: 0, pool: '-', isFinalist: false, urutFinal: 0, scores: { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } }, finalScore: 0, techScore: 0 });
    saveToLocalStorage(); renderParticipantTable(); document.getElementById('p-nama').value = ''; document.getElementById('p-nama').focus();
});

function renderParticipantTable() {
    const body = document.getElementById('table-peserta-body'); const filter = document.getElementById('filter-atlet-kategori').value;
    let list = filter && filter !== 'all' ? STATE.participants.filter(p => p.kategori === filter) : STATE.participants;
    if(list.length === 0) return body.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Tidak ada data atlet.</td></tr>`;
    let sortedList = [...list].sort((a,b) => a.kategori === b.kategori ? a.urut - b.urut : a.kategori.localeCompare(b.kategori));
    body.innerHTML = sortedList.map(p => `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"><td class="p-4 font-bold text-blue-300">${p.nama} ${p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-1 rounded ml-1">FINALIS</span>' : ''}</td><td class="p-4">${p.kontingen}</td><td class="p-4 text-xs text-slate-400">${p.kategori}</td><td class="p-4 text-center">${p.urut > 0 ? `<span class="bg-slate-700 px-2 py-1 rounded text-xs font-mono">No.${p.urut} | Pool ${p.pool}</span>` : `<span class="text-xs text-red-400 italic">Belum Undian</span>`}</td><td class="p-4 text-right"><button onclick="openEditModal(${p.id})" class="text-blue-400 hover:text-blue-300 transition-colors mr-3"><i class="fas fa-edit"></i></button><button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 transition-colors"><i class="fas fa-trash"></i></button></td></tr>`).join('');
}

function deletePeserta(id) { if(confirm('Hapus atlet ini?')) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }

function openEditModal(id) {
    const p = STATE.participants.find(x => x.id === id); if(!p) return;
    document.getElementById('edit-id').value = p.id; document.getElementById('edit-nama').value = p.nama; document.getElementById('edit-kontingen').value = p.kontingen; document.getElementById('edit-kategori').value = p.kategori;
    document.getElementById('edit-modal').classList.remove('hidden');
}
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
document.getElementById('form-edit-peserta').addEventListener('submit', (e) => {
    e.preventDefault(); const id = parseInt(document.getElementById('edit-id').value); const newKategori = document.getElementById('edit-kategori').value;
    const idx = STATE.participants.findIndex(p => p.id === id);
    if(idx > -1) {
        if(STATE.participants[idx].kategori !== newKategori) { STATE.participants[idx].urut = 0; STATE.participants[idx].pool = '-'; STATE.participants[idx].isFinalist = false; STATE.participants[idx].urutFinal = 0; STATE.participants[idx].scores = { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } }; STATE.participants[idx].finalScore = 0; STATE.participants[idx].techScore = 0; }
        STATE.participants[idx].nama = document.getElementById('edit-nama').value; STATE.participants[idx].kontingen = document.getElementById('edit-kontingen').value; STATE.participants[idx].kategori = newKategori;
        saveToLocalStorage(); renderParticipantTable(); closeEditModal(); alert("Data diperbarui.");
    }
});

// --- TAB 3: DRAWING ---
function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value; const resultDiv = document.getElementById('drawing-result'); resultDiv.innerHTML = '';
    if(!catName) return;
    let list = STATE.participants.filter(p => p.kategori === catName); 
    const isFinalMode = list.some(p => p.isFinalist);

    if (isFinalMode) {
        let finalL = list.filter(p => p.isFinalist);
        if (finalL.some(p => p.urutFinal > 0)) {
            finalL.sort((a,b) => a.urutFinal - b.urutFinal);
            renderPoolUI(finalL, "POOL FINAL (Sudah Diundi)", resultDiv, true);
        } else {
            resultDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-yellow-500 py-10 border-2 border-dashed border-yellow-600 rounded-xl">Peserta Final telah dipilih. Klik "Acak Urutan Sekarang" untuk Drawing Final.</div>`;
        }
    } else if (list.some(p => p.urut > 0)) {
        list.sort((a,b) => a.urut - b.urut);
        if(list.some(p => p.pool === 'A' || p.pool === 'B')) {
            renderPoolUI(list.filter(p => p.pool === 'A'), "POOL A (Sudah Diundi)", resultDiv, false); 
            renderPoolUI(list.filter(p => p.pool === 'B'), "POOL B (Sudah Diundi)", resultDiv, false);
        } else { 
            renderPoolUI(list, "BABAK PENYISIHAN (Sudah Diundi)", resultDiv, false); 
        }
    } else resultDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Kategori ini belum diundi.</div>`;
}

function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value; if(!catName) return alert("Pilih kategori!");
    let list = STATE.participants.filter(p => p.kategori === catName); if(list.length === 0) return alert("Belum ada peserta!");
    const resultDiv = document.getElementById('drawing-result'); resultDiv.innerHTML = '';

    const isFinalMode = list.some(p => p.isFinalist);
    
    if (isFinalMode) {
        let finalL = list.filter(p => p.isFinalist);
        if (finalL.some(p => p.urutFinal > 0)) if (!confirm("⚠️ Finalis SUDAH DIUNDI.\nYakin ingin mengacak ulang urutan Final?")) return;
        
        shuffleArray(finalL);
        finalL.forEach((p, index) => {
            const idx = STATE.participants.findIndex(x => x.id === p.id);
            STATE.participants[idx].urutFinal = index + 1;
        });
        renderPoolUI(finalL, "POOL FINAL", resultDiv, true);
    } else {
        if (list.some(p => p.urut > 0)) {
            if (!confirm("⚠️ Kategori ini SUDAH DIUNDI.\nYakin ingin mengacak ulang urutan tampil?")) return;
            list.forEach(p => { p.scores = { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } }; p.finalScore = 0; p.techScore = 0; });
        }
        shuffleArray(list);
        if (list.length > 6) {
            const half = Math.ceil(list.length / 2); const poolA = list.slice(0, half); const poolB = list.slice(half);
            applyDrawingData(poolA, 'A'); applyDrawingData(poolB, 'B');
            renderPoolUI(poolA, "POOL A", resultDiv, false); renderPoolUI(poolB, "POOL B", resultDiv, false);
        } else {
            applyDrawingData(list, 'SINGLE'); renderPoolUI(list, "BABAK PENYISIHAN", resultDiv, false);
        }
    }
    saveToLocalStorage(); renderParticipantTable();
}

function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
function applyDrawingData(arr, poolName) { arr.forEach((p, index) => { const found = STATE.participants.find(item => item.id === p.id); if(found) { found.urut = index + 1; found.pool = poolName; }}); }
function renderPoolUI(arr, title, container, isFinal) {
    let borderColor = isFinal ? 'border-yellow-600' : 'border-slate-600';
    let titleColor = isFinal ? 'text-yellow-500' : 'text-purple-400';
    let html = `<div class="bg-slate-800 p-5 rounded-xl border ${borderColor} shadow-lg"><h3 class="font-black text-center ${titleColor} mb-4 border-b border-slate-700 pb-3">${title}</h3><div class="space-y-2">`;
    arr.forEach((p, i) => { 
        let noUrut = isFinal ? p.urutFinal : p.urut;
        html += `<div class="flex items-center justify-between text-sm p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"><div class="flex gap-3 items-center"><span class="font-mono text-slate-500 w-5 text-right">${noUrut}.</span><span class="font-bold text-white">${p.nama}</span></div><span class="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${p.kontingen}</span></div>`; 
    });
    html += `</div></div>`; container.innerHTML += html;
}

// --- TAB 4: SCORING ---
function filterPesertaScoring() {
    const cat = document.getElementById('select-kategori').value;
    let listCat = STATE.participants.filter(p => p.kategori === cat && p.urut > 0);
    const hasFinal = listCat.some(p => p.isFinalist);

    let filtered = [];
    if(hasFinal) {
        // Mode Final: Hanya tampilkan Finalis, urut berdasarkan undian final
        filtered = listCat.filter(p => p.isFinalist).sort((a,b) => a.urutFinal - b.urutFinal);
    } else {
        // Mode Penyisihan
        filtered = listCat.sort((a,b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
    }

    const selectEl = document.getElementById('select-peserta');
    if(filtered.length === 0) {
        selectEl.innerHTML = `<option value="">-- Kosong / Belum Undian --</option>`; document.getElementById('scoring-athlete-name').innerText = "-"; updateScoringButtonsUI(); return;
    }
    
    selectEl.innerHTML = filtered.map(p => {
        let label = hasFinal ? `[FINAL] No.${p.urutFinal}` : `[Pool ${p.pool}] No.${p.urut}`;
        return `<option value="${p.id}">${label} - ${p.nama} (${p.kontingen})</option>`;
    }).join('');
    
    selectEl.dispatchEvent(new Event('change'));
}

function updateScoringButtonsUI() {
    const pId = parseInt(document.getElementById('select-peserta').value);
    const btnB1 = document.getElementById('btn-save-b1'); const btnB2 = document.getElementById('btn-save-b2');
    const btnPen = document.getElementById('btn-save-penyisihan'); const btnFin = document.getElementById('btn-save-final');
    if(!pId || !btnB1) return;
    
    const p = STATE.participants.find(i => i.id === pId);
    btnB1.classList.add('hidden'); btnB2.classList.add('hidden'); btnPen.classList.add('hidden'); btnFin.classList.add('hidden');

    // Cek apakah di kategori tersebut sedang berlangsung mode final
    const isFinalMode = STATE.participants.some(x => x.kategori === p.kategori && x.isFinalist);

    if(isFinalMode && p.isFinalist) btnFin.classList.remove('hidden');
    else if(p.pool === 'A' || p.pool === 'B') btnPen.classList.remove('hidden');
    else { btnB1.classList.remove('hidden'); btnB2.classList.remove('hidden'); }
}

function setJudges(n) {
    STATE.settings.numJudges = n;
    document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    const container = document.getElementById('judge-inputs'); container.innerHTML = '';
    for(let i=1; i<=n; i++) container.innerHTML += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-600 focus-within:border-blue-500 transition-colors"><label class="block text-[10px] text-slate-400 uppercase font-bold mb-2">Wasit ${i} ${i===1?'(Teknik)':''}</label><input type="number" step="0.5" id="score-${i}" oninput="calculateLive()" class="w-full bg-transparent text-3xl font-black outline-none text-center text-white placeholder-slate-700" placeholder="0"></div>`;
    calculateLive();
}

function calculateLive() {
    let raw = []; for(let i=1; i<=STATE.settings.numJudges; i++) raw.push(parseFloat(document.getElementById(`score-${i}`).value) || 0);
    let sum = 0;
    if(STATE.settings.numJudges === 5) { let sorted = [...raw].sort((a,b) => a-b); sorted.pop(); sorted.shift(); sum = sorted.reduce((a,b) => a+b, 0); } 
    else sum = raw.reduce((a,b) => a+b, 0);

    const minT = parseInt(document.getElementById('min-time').value) || 0; const maxT = parseInt(document.getElementById('max-time').value) || 0;
    let penalty = 0;
    if(UI.timerSeconds > 0 && UI.timerSeconds < minT) penalty = Math.ceil((minT - UI.timerSeconds) / 5) * 5;
    else if (UI.timerSeconds > maxT) penalty = Math.ceil((UI.timerSeconds - maxT) / 5) * 5;

    const final = Math.max(0, sum - penalty);
    document.getElementById('live-final-score').innerText = final.toFixed(1); document.getElementById('live-penalty').innerText = penalty > 0 ? `Penalti Waktu: -${penalty}` : `Penalti Waktu: 0`;
    return { final, penalty, raw, tech: raw[0] };
}

function saveScore(babakNumber) {
    const pId = parseInt(document.getElementById('select-peserta').value); if(!pId) return alert('Pilih atlet!');
    for(let i=1; i<=STATE.settings.numJudges; i++) if(document.getElementById(`score-${i}`).value === "") return alert(`Nilai Wasit ${i} kosong!`);

    const calc = calculateLive(); const p = STATE.participants.find(i => i.id === pId);

    if (babakNumber === 'final') {
        p.scores.b2 = { raw: calc.raw, penalty: calc.penalty, final: calc.final, tech: calc.tech };
        // Final Score tidak di-overwrite agar fallback aman, B2 jadi prioritas sorting.
    } else if (babakNumber === 'penyisihan') {
        p.scores.b1 = { raw: calc.raw, penalty: calc.penalty, final: calc.final, tech: calc.tech }; 
        p.finalScore = calc.final; p.techScore = calc.tech;
    } else {
        const bKey = `b${babakNumber}`; p.scores[bKey] = { raw: calc.raw, penalty: calc.penalty, final: calc.final, tech: calc.tech };
        if(p.scores.b1.final > 0 && p.scores.b2.final > 0) { p.finalScore = (p.scores.b1.final + p.scores.b2.final) / 2; p.techScore = (p.scores.b1.tech + p.scores.b2.tech) / 2; } 
        else { p.finalScore = calc.final; p.techScore = calc.tech; }
    }
    saveToLocalStorage(); alert(`SKOR TERSIMPAN!\nNilai atlet ${p.nama} berhasil direkam.`);
    resetTimer(); for(let i=1; i<=STATE.settings.numJudges; i++) document.getElementById(`score-${i}`).value = ''; calculateLive();
}

function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    if(UI.timerInterval) { clearInterval(UI.timerInterval); UI.timerInterval = null; btn.innerText = 'LANJUTKAN'; btn.classList.replace('bg-red-600', 'bg-yellow-600'); btn.classList.replace('hover:bg-red-500', 'hover:bg-yellow-500'); } 
    else { UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000); btn.innerText = 'STOP'; btn.className = 'bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg w-full font-bold'; }
}
function resetTimer() { clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI(); document.getElementById('btn-timer').innerText = 'START'; document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold'; calculateLive(); }
function updateTimerUI() { document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0')}:${(UI.timerSeconds % 60).toString().padStart(2, '0')}`; }

// --- TAB 5: RANKING & PROMOTE FINAL ---
function promoteToFinal() {
    const filterCat = document.getElementById('rank-filter-kategori').value;
    if(filterCat === 'all' || !filterCat) return alert("Pilih satu kategori spesifik di dropdown untuk membuat Babak Final!");

    let list = STATE.participants.filter(p => p.kategori === filterCat && p.scores.b1.final > 0);
    let poolA = list.filter(p => p.pool === 'A').sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech).slice(0, 3);
    let poolB = list.filter(p => p.pool === 'B').sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech).slice(0, 3);

    if(poolA.length === 0 && poolB.length === 0) return alert("Belum ada data nilai penyisihan di kategori ini.");

    if(confirm(`Anda akan mempromosikan ${poolA.length} atlet dari Pool A dan ${poolB.length} atlet dari Pool B ke Babak Final.\nLanjutkan?`)) {
        let finalParticipants = [...poolA, ...poolB];
        finalParticipants.forEach(p => {
            const idx = STATE.participants.findIndex(x => x.id === p.id);
            if(idx > -1) {
                STATE.participants[idx].isFinalist = true;
                STATE.participants[idx].urutFinal = 0; // Butuh drawing ulang
            }
        });
        saveToLocalStorage();
        alert("Babak Final berhasil dibuat!\nSilakan buka tab DRAWING untuk mengacak urutan tampil Final.");
        switchTab('drawing');
    }
}

function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    let list = STATE.participants;
    
    const btnPromote = document.getElementById('btn-promote-final');
    if (filter !== 'all') {
        let catParticipants = STATE.participants.filter(p => p.kategori === filter);
        const hasPools = catParticipants.some(p => p.pool === 'A' || p.pool === 'B');
        const hasFinal = catParticipants.some(p => p.isFinalist);
        if(hasPools && !hasFinal) btnPromote.classList.remove('hidden');
        else btnPromote.classList.add('hidden');
        list = catParticipants;
    } else btnPromote.classList.add('hidden');

    const container = document.getElementById('ranking-list');
    let hasData = list.some(p => p.scores.b1.final > 0 || p.scores.b2.final > 0);
    if(!hasData) return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data nilai.</div>`;

    let htmlOutput = '';

    // Render per Kelompok agar Finalis tampil terpisah tapi tetap ada di history penyisihan
    ['FINAL', 'SINGLE', 'A', 'B'].forEach(poolKey => {
        let poolList = [];
        if(poolKey === 'FINAL') poolList = list.filter(p => p.isFinalist && p.scores.b2.final > 0);
        else if(poolKey === 'SINGLE') poolList = list.filter(p => p.pool === 'SINGLE' && p.scores.b1.final > 0);
        else poolList = list.filter(p => p.pool === poolKey && p.scores.b1.final > 0);
        
        if(poolList.length === 0) return; 

        // Sorting Logics
        if(poolKey === 'FINAL') poolList.sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech);
        else if(poolKey === 'SINGLE') poolList.sort((a,b) => b.finalScore - a.finalScore || b.techScore - a.techScore);
        else poolList.sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech);

        let poolTitle = poolKey === 'SINGLE' ? 'KLASEMEN AKHIR' : poolKey === 'FINAL' ? '<i class="fas fa-star text-yellow-400"></i> KLASEMEN FINAL' : `KLASEMEN POOL ${poolKey}`;
        htmlOutput += `<h3 class="text-lg font-bold text-blue-400 mt-6 mb-2 border-b border-slate-700 pb-2">${poolTitle}</h3>`;

        htmlOutput += poolList.map((p, i) => {
            let medal = i === 0 ? '<i class="fas fa-medal text-yellow-400 text-2xl"></i>' : i === 1 ? '<i class="fas fa-medal text-slate-300 text-2xl"></i>' : i === 2 ? '<i class="fas fa-medal text-amber-600 text-2xl"></i>' : `<span class="text-2xl font-black text-slate-600">${i+1}</span>`;
            
            let displayScoreHTML = '';
            let displayFinalHTML = '';
            
            if (poolKey === 'FINAL') {
                displayScoreHTML = `<div class="text-[10px] text-slate-500 uppercase">Skor Final (B2)</div><div class="text-sm font-mono text-slate-300">${p.scores.b2.final.toFixed(1)}</div>`;
                displayFinalHTML = `<div class="text-2xl font-black text-white">${p.scores.b2.final.toFixed(2)}</div>`;
            } else if (poolKey === 'SINGLE') {
                displayScoreHTML = `<div class="text-[10px] text-slate-500 uppercase">B1 / B2</div><div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)} / ${p.scores.b2.final.toFixed(1)}</div>`;
                displayFinalHTML = `<div class="text-2xl font-black text-white">${p.finalScore.toFixed(2)}</div>`;
            } else {
                displayScoreHTML = `<div class="text-[10px] text-slate-500 uppercase">Skor Penyisihan</div><div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)}</div>`;
                displayFinalHTML = `<div class="text-2xl font-black text-white">${p.scores.b1.final.toFixed(2)}</div>`;
            }

            return `<div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4 mb-3"><div class="w-12 text-center flex-shrink-0">${medal}</div><div class="flex-1 w-full"><div class="font-bold text-lg text-white">${p.nama} ${poolKey !== 'FINAL' && p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-1 rounded ml-1">LULUS FINAL</span>' : ''}</div><div class="text-xs text-slate-400 mt-1"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${p.kontingen}</span><span class="ml-2 text-blue-400">${p.kategori}</span></div></div><div class="flex gap-4 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700"><div class="text-center md:text-right border-r border-slate-700 pr-4 flex-1">${displayScoreHTML}</div><div class="text-center md:text-right flex-1"><div class="text-[10px] text-green-400 font-bold uppercase">Nilai Akhir</div>${displayFinalHTML}</div></div></div>`;
        }).join('');
    });
    container.innerHTML = htmlOutput;
}

function exportCustomCSV() {
    let list = [...STATE.participants].filter(p => p.scores.b1.final > 0);
    let rows = [["Nama Atlet", "Kontingen", "Kategori", "Pool", "Lulus Final?", "Skor B1/Penyisihan", "Skor B2/Final", "Tie-Breaker B1 (W1)", "Tie-Breaker B2 (W1)"]];
    
    // Urutkan by Kategori, lalu Pool
    list.sort((a,b) => a.kategori.localeCompare(b.kategori) || a.pool.localeCompare(b.pool) || b.scores.b1.final - a.scores.b1.final);

    list.forEach(p => {
        rows.push([`"${p.nama}"`, `"${p.kontingen}"`, `"${p.kategori}"`, p.pool, p.isFinalist ? "Ya" : "Tidak", p.scores.b1.final, p.scores.b2.final, p.scores.b1.tech, p.scores.b2.tech]);
    });

    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `Data_Mentah_Nilai_${new Date().toISOString().slice(0,10)}.csv`; link.click();
}

// --- TAB 6: JUARA UMUM ---
function renderJuaraUmum() {
    let tally = {};

    STATE.categories.forEach(cat => {
        let list = STATE.participants.filter(p => p.kategori === cat.name);
        const hasFinal = list.some(p => p.isFinalist);
        let winners = [];

        if(hasFinal) {
            winners = list.filter(p => p.isFinalist && p.scores.b2.final > 0).sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech);
        } else {
            winners = list.filter(p => p.pool === 'SINGLE' && p.scores.b1.final > 0).sort((a,b) => b.finalScore - a.finalScore || b.techScore - a.techScore);
        }

        if(winners[0]) { tally[winners[0].kontingen] = tally[winners[0].kontingen] || {g:0, s:0, b:0}; tally[winners[0].kontingen].g++; }
        if(winners[1]) { tally[winners[1].kontingen] = tally[winners[1].kontingen] || {g:0, s:0, b:0}; tally[winners[1].kontingen].s++; }
        if(winners[2]) { tally[winners[2].kontingen] = tally[winners[2].kontingen] || {g:0, s:0, b:0}; tally[winners[2].kontingen].b++; }
    });

    let leaderboard = Object.keys(tally).map(kontingen => ({ nama: kontingen, emas: tally[kontingen].g, perak: tally[kontingen].s, perunggu: tally[kontingen].b, total: tally[kontingen].g + tally[kontingen].s + tally[kontingen].b }));
    leaderboard.sort((a,b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu);

    const tbody = document.getElementById('table-juara-body');
    if(leaderboard.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 border-b border-slate-700">Belum ada data medali. Selesaikan minimal 1 nomor pertandingan (Final).</td></tr>`;

    tbody.innerHTML = leaderboard.map((k, i) => `<tr class="hover:bg-slate-800/50 transition-colors"><td class="p-4 text-center font-bold text-slate-500 border-b border-slate-800">${i+1}</td><td class="p-4 font-bold text-white border-b border-slate-800 text-lg">${k.nama}</td><td class="p-4 text-center font-black text-yellow-500 border-b border-slate-800 bg-yellow-500/10">${k.emas}</td><td class="p-4 text-center font-black text-slate-300 border-b border-slate-800 bg-slate-400/10">${k.perak}</td><td class="p-4 text-center font-black text-amber-600 border-b border-slate-800 bg-amber-600/10">${k.perunggu}</td><td class="p-4 text-center font-black text-blue-400 border-b border-slate-800">${k.total}</td></tr>`).join('');
}

// --- TAB 7: ADMIN ---
function resetAllPenilaian() { if(confirm('⚠️ PERHATIAN: Ini akan MENGHAPUS SEMUA SKOR. Yakin?')) { STATE.participants.forEach(p => { p.scores = { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } }; p.finalScore = 0; p.techScore = 0; p.isFinalist = false; p.urutFinal = 0; }); saveToLocalStorage(); refreshAllData(); alert('Nilai di-reset.'); } }
function resetDataAtlet() { if(confirm('⚠️ PERHATIAN: Ini MENGHAPUS SEMUA ATLET. Yakin?')) { STATE.participants = []; saveToLocalStorage(); refreshAllData(); alert('Data atlet dihapus.'); } }
function resetTotalSistem() { if(confirm('🚨 FACTORY RESET: Hapus seluruh sistem?')) { localStorage.clear(); STATE = { categories: [], participants: [], settings: { numJudges: 5 } }; refreshAllData(); alert('Sistem kembali ke pengaturan awal.'); location.reload(); } }
