/**
 * MASS - Martial Arts Scoring System
 * Version 4.0 (Edit Modal, Custom Export & Admin Dashboard)
 */

function initializeData() {
    try {
        let cats = JSON.parse(localStorage.getItem('mass_categories')) || [];
        let parts = JSON.parse(localStorage.getItem('mass_participants')) || [];
        if (parts.length > 0) {
            if (Array.isArray(parts[0].scores) || !parts[0].scores.b1) {
                localStorage.clear();
                return { categories: [], participants: [], settings: { numJudges: 5 } };
            }
        }
        return { categories: cats, participants: parts, settings: { numJudges: 5 } };
    } catch (e) {
        localStorage.clear();
        return { categories: [], participants: [], settings: { numJudges: 5 } };
    }
}

let STATE = initializeData();

const UI = {
    tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'admin'], // Admin ditambahkan
    timerInterval: null,
    timerSeconds: 0
};

document.addEventListener('DOMContentLoaded', () => {
    refreshAllData();
    setJudges(5); 
    
    const selectPesertaEl = document.getElementById('select-peserta');
    if (selectPesertaEl) {
        selectPesertaEl.addEventListener('change', (e) => {
            if(e.target.selectedIndex >= 0) {
                const selected = e.target.options[e.target.selectedIndex].text;
                document.getElementById('scoring-athlete-name').innerText = selected || 'Pilih atlet di panel kiri';
                updateScoringButtonsUI();
            }
        });
    }
});

function saveToLocalStorage() {
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
}

function refreshAllData() {
    renderCategoryList();
    updateAllDropdowns();
    renderParticipantTable();
}

function switchTab(targetTab) {
    UI.tabs.forEach(tab => {
        const sectionEl = document.getElementById(`section-${tab}`);
        const tabEl = document.getElementById(`tab-${tab}`);
        if (sectionEl) { sectionEl.classList.add('hidden'); sectionEl.classList.remove('block'); }
        if (tabEl) { 
            tabEl.classList.remove('active-tab', 'text-blue-500', 'text-red-400'); 
            // Styling khusus admin
            if(tab === 'admin') tabEl.classList.add('text-red-400');
            else tabEl.classList.add('text-slate-400'); 
        }
    });

    const activeSection = document.getElementById(`section-${targetTab}`);
    const activeTab = document.getElementById(`tab-${targetTab}`);
    if (activeSection) { activeSection.classList.remove('hidden'); activeSection.classList.add('block'); }
    if (activeTab) { 
        if(targetTab === 'admin') {
            activeTab.classList.remove('text-red-400'); 
            activeTab.classList.add('active-tab', 'text-red-500');
        } else {
            activeTab.classList.remove('text-slate-400'); 
            activeTab.classList.add('active-tab', 'text-blue-500'); 
        }
    }

    if(targetTab === 'ranking') renderRanking();
    if(targetTab === 'scoring') filterPesertaScoring();
    if(targetTab === 'drawing') { updateAllDropdowns(); checkExistingDrawing(); }
}

// --- TAB 1: KATEGORI ---
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
    container.innerHTML = STATE.categories.map(c => `
        <div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm">
            <span class="font-bold text-blue-300">${c.name}</span>
            <span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span>
            <button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function deleteCategory(id) {
    if(confirm("Hapus kategori ini?")) {
        STATE.categories = STATE.categories.filter(c => c.id !== id);
        saveToLocalStorage(); refreshAllData();
    }
}

// --- TAB 2: ATLET & EDIT MODAL LOGIC ---
function updateAllDropdowns() {
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`;
    
    document.getElementById('p-kategori').innerHTML = emptyOpt + options;
    document.getElementById('edit-kategori').innerHTML = emptyOpt + options; // Dropdown di modal edit
    document.getElementById('draw-select-kategori').innerHTML = emptyOpt + options;
    document.getElementById('select-kategori').innerHTML = emptyOpt + options;
    
    const allOpt = '<option value="all">Semua Kategori</option>';
    document.getElementById('rank-filter-kategori').innerHTML = allOpt + options;
    document.getElementById('filter-atlet-kategori').innerHTML = allOpt + options;
}

function handleCSVUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const rows = e.target.result.split('\n');
        let count = 0, errors = 0;

        rows.forEach((row, i) => {
            if(i === 0 || !row.trim()) return; 
            const cols = row.split(',').map(item => item.trim().replace(/^"|"$/g, ''));
            if(cols.length >= 3) {
                const nama = cols[0], kontingen = cols[1], kategori = cols[2];
                if(nama && STATE.categories.some(c => c.name.toLowerCase() === kategori.toLowerCase())) {
                    STATE.participants.push({
                        id: Date.now() + i, nama, kontingen, kategori, urut: 0, pool: '-',
                        scores: { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } },
                        finalScore: 0, techScore: 0
                    });
                    count++;
                } else errors++;
            }
        });
        saveToLocalStorage(); refreshAllData(); event.target.value = ''; 
        alert(`${count} Atlet diimport.\n(${errors} gagal/kategori tidak valid).`);
    };
    reader.readAsText(file);
}

document.getElementById('form-peserta').addEventListener('submit', (e) => {
    e.preventDefault();
    const catName = document.getElementById('p-kategori').value;
    if(!catName) return alert("Pilih kategori!");

    STATE.participants.push({
        id: Date.now(), nama: document.getElementById('p-nama').value, kontingen: document.getElementById('p-kontingen').value,
        kategori: catName, urut: 0, pool: '-',
        scores: { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } },
        finalScore: 0, techScore: 0
    });
    saveToLocalStorage(); renderParticipantTable();
    document.getElementById('p-nama').value = ''; document.getElementById('p-nama').focus();
});

function renderParticipantTable() {
    const body = document.getElementById('table-peserta-body');
    const filter = document.getElementById('filter-atlet-kategori').value;
    
    let list = STATE.participants;
    if(filter && filter !== 'all') list = list.filter(p => p.kategori === filter);

    if(list.length === 0) return body.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Tidak ada data atlet.</td></tr>`;

    let sortedList = [...list].sort((a,b) => {
        if(a.kategori === b.kategori) return a.urut - b.urut;
        return a.kategori.localeCompare(b.kategori);
    });

    body.innerHTML = sortedList.map(p => `
        <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
            <td class="p-4 font-bold text-blue-300">${p.nama}</td><td class="p-4">${p.kontingen}</td><td class="p-4 text-xs text-slate-400">${p.kategori}</td>
            <td class="p-4 text-center">${p.urut > 0 ? `<span class="bg-slate-700 px-2 py-1 rounded text-xs font-mono">No.${p.urut} | Pool ${p.pool}</span>` : `<span class="text-xs text-red-400 italic">Belum Undian</span>`}</td>
            <td class="p-4 text-right">
                <button onclick="openEditModal(${p.id})" class="text-blue-400 hover:text-blue-300 transition-colors mr-3" title="Edit Data"><i class="fas fa-edit"></i></button>
                <button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 transition-colors" title="Hapus Data"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function deletePeserta(id) { if(confirm('Hapus atlet ini?')) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }

// LOGIKA MODAL EDIT
function openEditModal(id) {
    const p = STATE.participants.find(x => x.id === id);
    if(!p) return;
    
    document.getElementById('edit-id').value = p.id;
    document.getElementById('edit-nama').value = p.nama;
    document.getElementById('edit-kontingen').value = p.kontingen;
    document.getElementById('edit-kategori').value = p.kategori;
    
    document.getElementById('edit-modal').classList.remove('hidden');
}

function closeEditModal() {
    document.getElementById('edit-modal').classList.add('hidden');
}

document.getElementById('form-edit-peserta').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = parseInt(document.getElementById('edit-id').value);
    const newKategori = document.getElementById('edit-kategori').value;
    
    const idx = STATE.participants.findIndex(p => p.id === id);
    if(idx > -1) {
        // Cek apakah kategori diubah
        if(STATE.participants[idx].kategori !== newKategori) {
            // Jika kategori berubah, kembalikan status urutan dan hapus nilai
            STATE.participants[idx].urut = 0;
            STATE.participants[idx].pool = '-';
            STATE.participants[idx].scores = { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } };
            STATE.participants[idx].finalScore = 0;
            STATE.participants[idx].techScore = 0;
        }
        
        STATE.participants[idx].nama = document.getElementById('edit-nama').value;
        STATE.participants[idx].kontingen = document.getElementById('edit-kontingen').value;
        STATE.participants[idx].kategori = newKategori;
        
        saveToLocalStorage();
        renderParticipantTable();
        closeEditModal();
        alert("Data atlet berhasil diperbarui.");
    }
});


// --- TAB 3: DRAWING ---
function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    const resultDiv = document.getElementById('drawing-result');
    resultDiv.innerHTML = '';
    if(!catName) return;

    let list = STATE.participants.filter(p => p.kategori === catName);
    const isDrawn = list.some(p => p.urut > 0);

    if (isDrawn) {
        list.sort((a,b) => a.urut - b.urut);
        if(list.some(p => p.pool === 'A' || p.pool === 'B')) {
            renderPoolUI(list.filter(p => p.pool === 'A'), "POOL A (Sudah Diundi)", resultDiv);
            renderPoolUI(list.filter(p => p.pool === 'B'), "POOL B (Sudah Diundi)", resultDiv);
        } else {
            renderPoolUI(list, "BABAK PENYISIHAN (Sudah Diundi)", resultDiv);
        }
    } else {
        resultDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Kategori ini belum diundi. Klik "Acak Urutan Sekarang".</div>`;
    }
}

function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    if(!catName) return alert("Pilih kategori!");
    let list = STATE.participants.filter(p => p.kategori === catName);
    if(list.length === 0) return alert("Belum ada peserta!");

    if (list.some(p => p.urut > 0)) {
        if (!confirm("⚠️ PERINGATAN: Kategori ini SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return;
        // Bersihkan nilai lama jika diacak ulang agar tidak error
        list.forEach(p => { 
            p.scores = { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } };
            p.finalScore = 0; p.techScore = 0;
        });
    }

    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    const resultDiv = document.getElementById('drawing-result');
    resultDiv.innerHTML = '';

    if (list.length > 6) {
        const half = Math.ceil(list.length / 2);
        const poolA = list.slice(0, half); const poolB = list.slice(half);
        applyDrawingData(poolA, 'A'); applyDrawingData(poolB, 'B');
        renderPoolUI(poolA, "POOL A", resultDiv); renderPoolUI(poolB, "POOL B", resultDiv);
    } else {
        applyDrawingData(list, 'SINGLE'); renderPoolUI(list, "BABAK PENYISIHAN (SINGLE POOL)", resultDiv);
    }
    saveToLocalStorage(); renderParticipantTable();
}

function applyDrawingData(arr, poolName) { arr.forEach((p, index) => { const found = STATE.participants.find(item => item.id === p.id); if(found) { found.urut = index + 1; found.pool = poolName; }}); }
function renderPoolUI(arr, title, container) {
    let html = `<div class="bg-slate-800 p-5 rounded-xl border border-slate-600 shadow-lg"><h3 class="font-black text-center text-purple-400 mb-4 border-b border-slate-700 pb-3">${title}</h3><div class="space-y-2">`;
    arr.forEach((p, i) => { html += `<div class="flex items-center justify-between text-sm p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"><div class="flex gap-3 items-center"><span class="font-mono text-slate-500 w-5 text-right">${i+1}.</span><span class="font-bold text-white">${p.nama}</span></div><span class="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${p.kontingen}</span></div>`; });
    html += `</div></div>`; container.innerHTML += html;
}

// --- TAB 4: SCORING & TIMER ---
function filterPesertaScoring() {
    const cat = document.getElementById('select-kategori').value;
    let filtered = STATE.participants.filter(p => p.kategori === cat).sort((a,b) => {
        if(a.pool === b.pool) return a.urut - b.urut;
        return a.pool.localeCompare(b.pool);
    });

    const selectEl = document.getElementById('select-peserta');
    if(filtered.length === 0) {
        selectEl.innerHTML = `<option value="">-- Kosong / Belum Undian --</option>`;
        document.getElementById('scoring-athlete-name').innerText = "-";
        updateScoringButtonsUI(); return;
    }
    selectEl.innerHTML = filtered.map(p => `<option value="${p.id}">[Pool ${p.pool}] No.${p.urut} - ${p.nama} (${p.kontingen})</option>`).join('');
    selectEl.dispatchEvent(new Event('change'));
}

function updateScoringButtonsUI() {
    const pId = parseInt(document.getElementById('select-peserta').value);
    const btnB1 = document.getElementById('btn-save-b1');
    const btnB2 = document.getElementById('btn-save-b2');
    const btnPen = document.getElementById('btn-save-penyisihan');

    if(!pId || !btnB1) return;
    const p = STATE.participants.find(i => i.id === pId);
    if(p.pool === 'A' || p.pool === 'B') {
        btnB1.classList.add('hidden'); btnB2.classList.add('hidden'); btnPen.classList.remove('hidden');
    } else {
        btnB1.classList.remove('hidden'); btnB2.classList.remove('hidden'); btnPen.classList.add('hidden');
    }
}

function setJudges(n) {
    STATE.settings.numJudges = n;
    document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    
    const container = document.getElementById('judge-inputs');
    container.innerHTML = '';
    for(let i=1; i<=n; i++) {
        container.innerHTML += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-600 focus-within:border-blue-500 transition-colors"><label class="block text-[10px] text-slate-400 uppercase font-bold mb-2">Wasit ${i} ${i===1?'(Teknik)':''}</label><input type="number" step="0.5" id="score-${i}" oninput="calculateLive()" class="w-full bg-transparent text-3xl font-black outline-none text-center text-white placeholder-slate-700" placeholder="0"></div>`;
    }
    calculateLive();
}

function calculateLive() {
    let raw = [];
    for(let i=1; i<=STATE.settings.numJudges; i++) {
        let val = parseFloat(document.getElementById(`score-${i}`).value);
        raw.push(isNaN(val) ? 0 : val);
    }
    let sum = 0;
    if(STATE.settings.numJudges === 5) {
        let sorted = [...raw].sort((a,b) => a-b);
        sorted.pop(); sorted.shift(); sum = sorted.reduce((a,b) => a+b, 0);
    } else {
        sum = raw.reduce((a,b) => a+b, 0);
    }

    const minT = parseInt(document.getElementById('min-time').value) || 0;
    const maxT = parseInt(document.getElementById('max-time').value) || 0;
    let penalty = 0;
    if(UI.timerSeconds > 0 && UI.timerSeconds < minT) penalty = Math.ceil((minT - UI.timerSeconds) / 5) * 5;
    else if (UI.timerSeconds > maxT) penalty = Math.ceil((UI.timerSeconds - maxT) / 5) * 5;

    const final = Math.max(0, sum - penalty);
    document.getElementById('live-final-score').innerText = final.toFixed(1);
    document.getElementById('live-penalty').innerText = penalty > 0 ? `Penalti Waktu: -${penalty}` : `Penalti Waktu: 0`;
    return { final, penalty, raw, tech: raw[0] };
}

function saveScore(babakNumber) {
    const pId = parseInt(document.getElementById('select-peserta').value);
    if(!pId) return alert('Pilih atlet!');
    for(let i=1; i<=STATE.settings.numJudges; i++) {
        if(document.getElementById(`score-${i}`).value === "") return alert(`Nilai Wasit ${i} kosong!`);
    }

    const calc = calculateLive();
    const p = STATE.participants.find(i => i.id === pId);

    if (babakNumber === 'penyisihan') {
        p.scores.b1 = { raw: calc.raw, penalty: calc.penalty, final: calc.final, tech: calc.tech };
        p.finalScore = calc.final; p.techScore = calc.tech;
    } else {
        const bKey = `b${babakNumber}`;
        p.scores[bKey] = { raw: calc.raw, penalty: calc.penalty, final: calc.final, tech: calc.tech };
        if(p.scores.b1.final > 0 && p.scores.b2.final > 0) {
            p.finalScore = (p.scores.b1.final + p.scores.b2.final) / 2;
            p.techScore = (p.scores.b1.tech + p.scores.b2.tech) / 2;
        } else {
            p.finalScore = calc.final; p.techScore = calc.tech;
        }
    }
    saveToLocalStorage();
    alert(`SKOR TERSIMPAN!\nNilai atlet ${p.nama} berhasil direkam.`);
    resetTimer();
    for(let i=1; i<=STATE.settings.numJudges; i++) document.getElementById(`score-${i}`).value = '';
    calculateLive();
}

function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    if(UI.timerInterval) {
        clearInterval(UI.timerInterval); UI.timerInterval = null;
        btn.innerText = 'LANJUTKAN'; btn.classList.replace('bg-red-600', 'bg-yellow-600'); btn.classList.replace('hover:bg-red-500', 'hover:bg-yellow-500');
    } else {
        UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000);
        btn.innerText = 'STOP'; btn.className = 'bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg w-full font-bold';
    }
}
function resetTimer() {
    clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI();
    document.getElementById('btn-timer').innerText = 'START';
    document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold'; calculateLive();
}
function updateTimerUI() {
    const m = Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0');
    const s = (UI.timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

// --- TAB 5: RANKING & CUSTOM EXPORT ---
function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    let list = STATE.participants;
    if (filter !== 'all') list = list.filter(p => p.kategori === filter);
    list = list.filter(p => p.finalScore > 0); 

    const container = document.getElementById('ranking-list');
    if(list.length === 0) return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data nilai.</div>`;

    const grouped = { 'SINGLE': [], 'A': [], 'B': [] };
    list.forEach(p => { if(grouped[p.pool]) grouped[p.pool].push(p); else grouped['SINGLE'].push(p); });

    let htmlOutput = '';
    ['SINGLE', 'A', 'B'].forEach(poolKey => {
        let poolList = grouped[poolKey];
        if(poolList.length === 0) return; 

        poolList.sort((a,b) => {
            if(b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
            return b.techScore - a.techScore;
        });

        let poolTitle = poolKey === 'SINGLE' ? 'KLASEMEN AKHIR' : `KLASEMEN POOL ${poolKey}`;
        htmlOutput += `<h3 class="text-lg font-bold text-blue-400 mt-6 mb-2 border-b border-slate-700 pb-2">${poolTitle}</h3>`;

        htmlOutput += poolList.map((p, i) => {
            let medal = i === 0 ? '<i class="fas fa-medal text-yellow-400 text-2xl"></i>' : 
                        i === 1 ? '<i class="fas fa-medal text-slate-300 text-2xl"></i>' : 
                        i === 2 ? '<i class="fas fa-medal text-amber-600 text-2xl"></i>' : `<span class="text-2xl font-black text-slate-600">${i+1}</span>`;

            let scoreDetailHTML = poolKey === 'SINGLE' 
                ? `<div class="text-[10px] text-slate-500 uppercase">B1 / B2</div><div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)} / ${p.scores.b2.final.toFixed(1)}</div>`
                : `<div class="text-[10px] text-slate-500 uppercase">Skor Penyisihan</div><div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)}</div>`;

            return `
            <div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4 mb-3">
                <div class="w-12 text-center flex-shrink-0">${medal}</div>
                <div class="flex-1 w-full">
                    <div class="font-bold text-lg text-white">${p.nama}</div>
                    <div class="text-xs text-slate-400 mt-1"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${p.kontingen}</span><span class="ml-2 text-blue-400">${p.kategori}</span></div>
                </div>
                <div class="flex gap-4 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700">
                    <div class="text-center md:text-right border-r border-slate-700 pr-4 flex-1">${scoreDetailHTML}</div>
                    <div class="text-center md:text-right flex-1"><div class="text-[10px] text-green-400 font-bold uppercase">Nilai Akhir</div><div class="text-2xl font-black text-white">${p.finalScore.toFixed(2)}</div></div>
                </div>
            </div>`;
        }).join('');
    });
    container.innerHTML = htmlOutput;
}

// LOGIKA EXPORT CUSTOM
function exportCustomCSV() {
    // 1. Cek Kriteria apa saja yang dicentang oleh user
    const opts = {
        kontingen: document.getElementById('exp-kontingen').checked,
        kategori: document.getElementById('exp-kategori').checked,
        pool: document.getElementById('exp-pool').checked,
        rincian: document.getElementById('exp-rincian').checked,
        tie: document.getElementById('exp-tie').checked
    };

    // 2. Buat Header Dinamis
    let headers = ["Rank", "Nama Atlet"];
    if(opts.kontingen) headers.push("Kontingen");
    if(opts.kategori) headers.push("Kategori");
    if(opts.pool) headers.push("Pool");
    if(opts.rincian) { headers.push("Skor B1/Penyisihan"); headers.push("Skor B2"); }
    headers.push("NILAI AKHIR");
    if(opts.tie) headers.push("Tie-Breaker (W1)");

    let rows = [headers];
    
    // 3. Ambil data, filter (yang ada nilai saja), dan urutkan berdasar Pool lalu Skor
    let list = [...STATE.participants].filter(p => p.finalScore > 0);
    list.sort((a,b) => {
        if(a.pool !== b.pool) return a.pool.localeCompare(b.pool);
        if(b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return b.techScore - a.techScore;
    });

    // 4. Masukkan data ke baris sesuai kriteria yang dipilih
    list.forEach((p, i) => {
        let rank = 1; 
        if(i > 0 && list[i-1].pool === p.pool) rank = rows[rows.length-1][0] + 1;

        let rowData = [rank, `"${p.nama}"`];
        if(opts.kontingen) rowData.push(`"${p.kontingen}"`);
        if(opts.kategori) rowData.push(`"${p.kategori}"`);
        if(opts.pool) rowData.push(p.pool);
        if(opts.rincian) { rowData.push(p.scores.b1.final); rowData.push(p.scores.b2.final); }
        rowData.push(p.finalScore);
        if(opts.tie) rowData.push(p.techScore);

        rows.push(rowData);
    });

    // 5. Download file
    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `Rekap_Nilai_Custom_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}

// --- TAB 6: ADMIN RESET LOGIC ---
function resetAllPenilaian() {
    if(confirm('⚠️ PERHATIAN:\nTindakan ini akan menghapus seluruh skor yang telah diinput juri untuk semua atlet.\n\nApakah Anda benar-benar yakin?')) {
        STATE.participants.forEach(p => {
            p.scores = { b1: { raw: [], penalty: 0, final: 0, tech: 0 }, b2: { raw: [], penalty: 0, final: 0, tech: 0 } };
            p.finalScore = 0;
            p.techScore = 0;
        });
        saveToLocalStorage(); refreshAllData(); alert('Semua nilai berhasil di-reset.');
    }
}

function resetDataAtlet() { 
    if(confirm('⚠️ PERHATIAN:\nTindakan ini akan MENGHAPUS SEMUA ATLET dan nilainya dari sistem.\n\nApakah Anda yakin?')) { 
        STATE.participants = []; saveToLocalStorage(); refreshAllData(); alert('Semua data atlet berhasil dihapus.');
    } 
}

function resetTotalSistem() {
    if(confirm('🚨 BAHAYA (FACTORY RESET):\nAnda akan menghapus SELURUH KATEGORI, ATLET, DRAWING, dan NILAI.\nSistem akan kembali kosong seperti baru pertama dibuka.\n\nLanjutkan?')) {
        localStorage.clear();
        STATE = { categories: [], participants: [], settings: { numJudges: 5 } };
        refreshAllData(); alert('Sistem telah dikembalikan ke pengaturan awal (Factory Reset).');
        location.reload(); // Reload halaman untuk mematikan semua state yang menggantung
    }
}
