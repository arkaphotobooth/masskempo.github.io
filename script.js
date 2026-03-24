/**
 * MASS - Martial Arts Scoring System
 * Version 3.0 (Clean Architecture & Isolated Tabs)
 */

// --- 1. STATE MANAGEMENT ---
let STATE = {
    categories: JSON.parse(localStorage.getItem('mass_categories')) || [],
    participants: JSON.parse(localStorage.getItem('mass_participants')) || [],
    settings: {
        numJudges: 5
    }
};

const UI = {
    tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking'],
    timerInterval: null,
    timerSeconds: 0
};

// --- 2. INITIALIZATION & TAB ROUTING ---
document.addEventListener('DOMContentLoaded', () => {
    refreshAllData();
    setJudges(5); // Default Juri
    
    // Set text nama atlet di scoring awal
    document.getElementById('select-peserta').addEventListener('change', (e) => {
        const selected = e.target.options[e.target.selectedIndex].text;
        document.getElementById('scoring-athlete-name').innerText = selected || 'Pilih atlet di panel kiri';
    });
});

function saveToLocalStorage() {
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
}

function refreshAllData() {
    renderCategoryList();
    renderParticipantTable();
    updateAllDropdowns();
}

function switchTab(targetTab) {
    // 1. Sembunyikan semua section dan reset style tab
    UI.tabs.forEach(tab => {
        const sectionEl = document.getElementById(`section-${tab}`);
        const tabEl = document.getElementById(`tab-${tab}`);
        
        if (sectionEl) {
            sectionEl.classList.add('hidden');
            sectionEl.classList.remove('block');
        }
        if (tabEl) {
            tabEl.classList.remove('active-tab', 'text-blue-500');
            tabEl.classList.add('text-slate-400');
        }
    });

    // 2. Tampilkan section yang dituju dan beri style aktif
    const activeSection = document.getElementById(`section-${targetTab}`);
    const activeTab = document.getElementById(`tab-${targetTab}`);
    
    if (activeSection) {
        activeSection.classList.remove('hidden');
        activeSection.classList.add('block');
    }
    if (activeTab) {
        activeTab.classList.remove('text-slate-400');
        activeTab.classList.add('active-tab', 'text-blue-500');
    }

    // 3. Trigger fungsi khusus saat tab tertentu dibuka
    if(targetTab === 'ranking') renderRanking();
    if(targetTab === 'scoring') filterPesertaScoring();
}

// --- 3. TAB 1: KATEGORI LOGIC ---
document.getElementById('form-kategori').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value.trim();
    const type = parseInt(document.getElementById('cat-type').value);
    
    if(!name) return;
    
    // Cek duplikat
    if(STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) {
        return alert("Kategori dengan nama ini sudah ada!");
    }

    STATE.categories.push({ id: Date.now(), name, type });
    saveToLocalStorage();
    refreshAllData();
    e.target.reset();
});

function renderCategoryList() {
    const container = document.getElementById('list-kategori');
    if(STATE.categories.length === 0) {
        container.innerHTML = `<span class="text-sm text-slate-500 italic">Belum ada kategori yang ditambahkan.</span>`;
        return;
    }

    container.innerHTML = STATE.categories.map(c => `
        <div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm">
            <span class="font-bold text-blue-300">${c.name}</span>
            <span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span>
            <button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2 transition-colors"><i class="fas fa-times"></i></button>
        </div>
    `).join('');
}

function deleteCategory(id) {
    if(confirm("Hapus kategori ini? Pastikan tidak ada atlet di kategori ini.")) {
        STATE.categories = STATE.categories.filter(c => c.id !== id);
        saveToLocalStorage();
        refreshAllData();
    }
}

// --- 4. TAB 2: ATLET LOGIC ---
function updateAllDropdowns() {
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    const emptyOpt = `<option value="">-- Pilih Kategori --</option>`;
    
    document.getElementById('p-kategori').innerHTML = emptyOpt + options;
    document.getElementById('draw-select-kategori').innerHTML = emptyOpt + options;
    document.getElementById('select-kategori').innerHTML = emptyOpt + options;
    document.getElementById('rank-filter-kategori').innerHTML = '<option value="all">Semua Kategori</option>' + options;
}

document.getElementById('form-peserta').addEventListener('submit', (e) => {
    e.preventDefault();
    const catName = document.getElementById('p-kategori').value;
    if(!catName) return alert("Pilih kategori terlebih dahulu!");

    const newPeserta = {
        id: Date.now(),
        nama: document.getElementById('p-nama').value,
        kontingen: document.getElementById('p-kontingen').value,
        kategori: catName,
        urut: 0,
        pool: '-',
        scores: {
            b1: { raw: [], penalty: 0, final: 0, tech: 0 },
            b2: { raw: [], penalty: 0, final: 0, tech: 0 }
        },
        finalScore: 0,
        techScore: 0
    };

    STATE.participants.push(newPeserta);
    saveToLocalStorage();
    renderParticipantTable();
    
    // Reset hanya field nama dan kontingen agar cepat menginput yang kategori sama
    document.getElementById('p-nama').value = '';
    document.getElementById('p-nama').focus();
});

function renderParticipantTable() {
    const body = document.getElementById('table-peserta-body');
    if(STATE.participants.length === 0) {
        body.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-500">Belum ada data atlet.</td></tr>`;
        return;
    }

    // Sort by kategori, lalu urut
    let sortedList = [...STATE.participants].sort((a,b) => {
        if(a.kategori === b.kategori) return a.urut - b.urut;
        return a.kategori.localeCompare(b.kategori);
    });

    body.innerHTML = sortedList.map(p => `
        <tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors">
            <td class="p-4 font-bold text-blue-300">${p.nama}</td>
            <td class="p-4">${p.kontingen}</td>
            <td class="p-4 text-xs text-slate-400">${p.kategori}</td>
            <td class="p-4 text-center">
                ${p.urut > 0 ? `<span class="bg-slate-700 px-2 py-1 rounded text-xs font-mono">No.${p.urut} | Pool ${p.pool}</span>` : `<span class="text-xs text-red-400 italic">Belum Undian</span>`}
            </td>
            <td class="p-4 text-right">
                <button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500 transition-colors"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function deletePeserta(id) {
    if(confirm('Hapus atlet ini dari database?')) {
        STATE.participants = STATE.participants.filter(p => p.id !== id);
        saveToLocalStorage();
        renderParticipantTable();
    }
}

function resetDataAtlet() {
    if(confirm('BAHAYA: Ini akan menghapus SEMUA data atlet dan nilainya. Lanjutkan?')) {
        STATE.participants = [];
        saveToLocalStorage();
        refreshAllData();
    }
}

// --- 5. TAB 3: DRAWING LOGIC ---
function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    if(!catName) return alert("Pilih kategori yang akan diundi!");
    
    let list = STATE.participants.filter(p => p.kategori === catName);
    if(list.length === 0) return alert("Belum ada peserta yang terdaftar di kategori ini!");

    // Fisher-Yates Shuffle
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    const resultDiv = document.getElementById('drawing-result');
    resultDiv.innerHTML = '';

    // Logika Pembagian Pool (Berdasarkan aturan: Jika > 6 bagi Pool A & B)
    if (list.length > 6) {
        const half = Math.ceil(list.length / 2);
        const poolA = list.slice(0, half);
        const poolB = list.slice(half);
        
        applyDrawingData(poolA, 'A');
        applyDrawingData(poolB, 'B');
        
        renderPoolUI(poolA, "POOL A", resultDiv);
        renderPoolUI(poolB, "POOL B", resultDiv);
    } else {
        applyDrawingData(list, 'SINGLE');
        renderPoolUI(list, "BABAK PENYISIHAN (SINGLE POOL)", resultDiv);
    }
    
    saveToLocalStorage();
    renderParticipantTable(); // Update tabel di tab Atlet
}

function applyDrawingData(arr, poolName) {
    arr.forEach((p, index) => {
        const found = STATE.participants.find(item => item.id === p.id);
        found.urut = index + 1;
        found.pool = poolName;
    });
}

function renderPoolUI(arr, title, container) {
    let html = `
        <div class="bg-slate-800 p-5 rounded-xl border border-slate-600 shadow-lg">
            <h3 class="font-black text-center text-purple-400 mb-4 border-b border-slate-700 pb-3">${title}</h3>
            <div class="space-y-2">
    `;
    
    arr.forEach((p, i) => {
        html += `
            <div class="flex items-center justify-between text-sm p-3 bg-slate-900/50 rounded-lg border border-slate-700/50">
                <div class="flex gap-3 items-center">
                    <span class="font-mono text-slate-500 w-5 text-right">${i+1}.</span>
                    <span class="font-bold text-white">${p.nama}</span>
                </div>
                <span class="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${p.kontingen}</span>
            </div>
        `;
    });
    
    html += `</div></div>`;
    container.innerHTML += html;
}

// --- 6. TAB 4: SCORING & TIMER LOGIC ---
function filterPesertaScoring() {
    const cat = document.getElementById('select-kategori').value;
    // Tampilkan hanya peserta di kategori tsb, urutkan berdasar pool lalu nomor urut
    let filtered = STATE.participants.filter(p => p.kategori === cat).sort((a,b) => {
        if(a.pool === b.pool) return a.urut - b.urut;
        return a.pool.localeCompare(b.pool);
    });

    const selectEl = document.getElementById('select-peserta');
    if(filtered.length === 0) {
        selectEl.innerHTML = `<option value="">-- Kosong / Belum Undian --</option>`;
        document.getElementById('scoring-athlete-name').innerText = "-";
        return;
    }

    selectEl.innerHTML = filtered.map(p => `
        <option value="${p.id}">[Pool ${p.pool}] No.${p.urut} - ${p.nama} (${p.kontingen})</option>
    `).join('');
    
    // Trigger update nama
    selectEl.dispatchEvent(new Event('change'));
}

function setJudges(n) {
    STATE.settings.numJudges = n;
    document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white';
    
    const container = document.getElementById('judge-inputs');
    container.innerHTML = '';
    for(let i=1; i<=n; i++) {
        container.innerHTML += `
            <div class="bg-slate-900 p-3 rounded-lg border border-slate-600 focus-within:border-blue-500 transition-colors">
                <label class="block text-[10px] text-slate-400 uppercase font-bold mb-2">Wasit ${i} ${i===1?'(Teknik)':''}</label>
                <input type="number" step="0.5" id="score-${i}" oninput="calculateLive()" class="w-full bg-transparent text-3xl font-black outline-none text-center text-white placeholder-slate-700" placeholder="0">
            </div>
        `;
    }
    calculateLive(); // Reset kalkulasi UI
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
        sorted.pop();   // Buang tertinggi
        sorted.shift(); // Buang terendah
        sum = sorted.reduce((a,b) => a+b, 0);
    } else {
        sum = raw.reduce((a,b) => a+b, 0);
    }

    // Hitung Penalty Waktu (Regulasi: per 5 detik kurang/lebih dikenakan 5 poin)
    const minT = parseInt(document.getElementById('min-time').value) || 0;
    const maxT = parseInt(document.getElementById('max-time').value) || 0;
    let penalty = 0;
    
    if(UI.timerSeconds > 0 && UI.timerSeconds < minT) {
        penalty = Math.ceil((minT - UI.timerSeconds) / 5) * 5;
    } else if (UI.timerSeconds > maxT) {
        penalty = Math.ceil((UI.timerSeconds - maxT) / 5) * 5;
    }

    const final = Math.max(0, sum - penalty);
    
    // Update UI Realtime
    document.getElementById('live-final-score').innerText = final.toFixed(1);
    document.getElementById('live-penalty').innerText = penalty > 0 ? `Penalti Waktu: -${penalty}` : `Penalti Waktu: 0`;
    
    return { final, penalty, raw, tech: raw[0] };
}

function saveScore(babakNumber) {
    const pId = parseInt(document.getElementById('select-peserta').value);
    if(!pId) return alert('Pilih atlet yang sedang bertanding di panel kiri!');
    
    // Validasi apakah ada nilai yang kosong
    for(let i=1; i<=STATE.settings.numJudges; i++) {
        if(document.getElementById(`score-${i}`).value === "") return alert(`Nilai Wasit ${i} masih kosong!`);
    }

    const calc = calculateLive();
    const p = STATE.participants.find(i => i.id === pId);
    const bKey = `b${babakNumber}`; // 'b1' atau 'b2'

    // Simpan nilai mentah ke state
    p.scores[bKey] = {
        raw: calc.raw,
        penalty: calc.penalty,
        final: calc.final,
        tech: calc.tech
    };

    // Logika Penentuan Nilai Akhir (Regulasi <= 6 Rata-rata, > 6 Penyisihan)
    const totalPesertaKategori = STATE.participants.filter(i => i.kategori === p.kategori).length;
    
    if(totalPesertaKategori <= 6) {
        // Jika kedua babak sudah diisi, hitung rata-rata
        if(p.scores.b1.final > 0 && p.scores.b2.final > 0) {
            p.finalScore = (p.scores.b1.final + p.scores.b2.final) / 2;
            p.techScore = (p.scores.b1.tech + p.scores.b2.tech) / 2;
        } else {
            // Jika baru 1 babak, gunakan nilai babak tersebut sementara
            p.finalScore = calc.final;
            p.techScore = calc.tech;
        }
    } else {
        // Mode Pool: Nilai akhir adalah nilai babak yang baru saja diinput
        p.finalScore = calc.final;
        p.techScore = calc.tech;
    }

    saveToLocalStorage();
    alert(`SKOR TERSIMPAN!\nBabak ${babakNumber} atlet ${p.nama} berhasil direkam.`);
    
    // Bersihkan UI untuk atlet selanjutnya
    resetTimer();
    for(let i=1; i<=STATE.settings.numJudges; i++) document.getElementById(`score-${i}`).value = '';
    calculateLive();
}

// --- TIMER CONTROL ---
function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    if(UI.timerInterval) {
        // Stop
        clearInterval(UI.timerInterval);
        UI.timerInterval = null;
        btn.innerText = 'LANJUTKAN';
        btn.classList.replace('bg-red-600', 'bg-yellow-600');
        btn.classList.replace('hover:bg-red-500', 'hover:bg-yellow-500');
    } else {
        // Start
        UI.timerInterval = setInterval(() => {
            UI.timerSeconds++;
            updateTimerUI();
            calculateLive(); // Live hitung penalti
        }, 1000);
        btn.innerText = 'STOP';
        
        // Reset class to red
        btn.className = 'bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg w-full font-bold';
    }
}

function resetTimer() {
    clearInterval(UI.timerInterval);
    UI.timerInterval = null;
    UI.timerSeconds = 0;
    updateTimerUI();
    const btn = document.getElementById('btn-timer');
    btn.innerText = 'START';
    btn.className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold';
    calculateLive(); // Reset penalti di UI
}

function updateTimerUI() {
    const m = Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0');
    const s = (UI.timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

// --- 7. TAB 5: RANKING LOGIC ---
function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    let list = STATE.participants;
    
    if (filter !== 'all') {
        list = list.filter(p => p.kategori === filter);
    }
    
    // Filter out atlet yang belum dinilai sama sekali
    list = list.filter(p => p.finalScore > 0);

    // Sorting: Nilai Akhir (Tinggi -> Rendah), lalu Nilai Wasit 1 (Tinggi -> Rendah)
    list.sort((a,b) => {
        if(b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return b.techScore - a.techScore; // Tie breaker
    });

    const container = document.getElementById('ranking-list');
    
    if(list.length === 0) {
        container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data nilai di kategori ini.</div>`;
        return;
    }

    container.innerHTML = list.map((p, i) => {
        let medal = '';
        if(i === 0) medal = '<i class="fas fa-medal text-yellow-400 text-2xl"></i>';
        else if(i === 1) medal = '<i class="fas fa-medal text-slate-300 text-2xl"></i>';
        else if(i === 2) medal = '<i class="fas fa-medal text-amber-600 text-2xl"></i>';
        else medal = `<span class="text-2xl font-black text-slate-600">${i+1}</span>`;

        return `
        <div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4">
            <div class="w-12 text-center flex-shrink-0">${medal}</div>
            
            <div class="flex-1 w-full">
                <div class="font-bold text-lg text-white">${p.nama}</div>
                <div class="text-xs text-slate-400 mt-1">
                    <span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${p.kontingen}</span>
                    <span class="ml-2 text-blue-400">${p.kategori}</span> | Pool: ${p.pool}
                </div>
            </div>
            
            <div class="flex gap-4 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700">
                <div class="text-center md:text-right border-r border-slate-700 pr-4 flex-1">
                    <div class="text-[10px] text-slate-500 uppercase">Babak 1 / 2</div>
                    <div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)} / ${p.scores.b2.final.toFixed(1)}</div>
                </div>
                <div class="text-center md:text-right flex-1">
                    <div class="text-[10px] text-green-400 font-bold uppercase">Nilai Akhir</div>
                    <div class="text-2xl font-black text-white">${p.finalScore.toFixed(2)}</div>
                </div>
            </div>
        </div>
    `}).join('');
}

function exportToCSV() {
    let rows = [["Rank", "Nama Atlet", "Kontingen", "Kategori", "Pool", "Skor B1", "Skor B2", "NILAI AKHIR", "Tie-Breaker (W1)"]];
    
    // Sort logic sama dengan tampilan ranking
    let list = [...STATE.participants].filter(p => p.finalScore > 0);
    list.sort((a,b) => {
        if(b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return b.techScore - a.techScore;
    });

    list.forEach((p, i) => {
        rows.push([i+1, `"${p.nama}"`, `"${p.kontingen}"`, `"${p.kategori}"`, p.pool, p.scores.b1.final, p.scores.b2.final, p.finalScore, p.techScore]);
    });

    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `MASS_Report_${new Date().toISOString().slice(0,10)}.csv`;
    link.click();
}
