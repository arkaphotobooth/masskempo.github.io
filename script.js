/**
 * MASS - Martial Arts Scoring System
 * Script Version 2.0 (Full Rewrite)
 */

// --- 1. STATE & DATA INITIALIZATION ---
let STATE = {
    categories: JSON.parse(localStorage.getItem('mass_categories')) || [],
    participants: JSON.parse(localStorage.getItem('mass_participants')) || [],
    settings: {
        numJudges: 5,
        currentCourt: 'Court A'
    }
};

const UI = {
    tabs: ['admin', 'scoring', 'drawing', 'ranking'],
    timerInterval: null,
    timerSeconds: 0
};

// Inisialisasi awal saat halaman dimuat
document.addEventListener('DOMContentLoaded', () => {
    refreshAllUI();
    setJudges(5); // Default
});

// --- 2. CORE UTILITIES ---
function saveToLocalStorage() {
    localStorage.setItem('mass_categories', JSON.stringify(STATE.categories));
    localStorage.setItem('mass_participants', JSON.stringify(STATE.participants));
}

function refreshAllUI() {
    renderCategoryList();
    updateDropdowns();
    renderParticipantTable();
}

function switchTab(tabName) {
    UI.tabs.forEach(t => {
        document.getElementById(`section-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('active-tab', 'text-blue-500');
        document.getElementById(`tab-${t}`).classList.add('text-slate-400');
    });
    document.getElementById(`section-${tabName}`).classList.remove('hidden');
    document.getElementById(`tab-${tabName}`).classList.add('active-tab', 'text-blue-500');
    
    if(tabName === 'ranking') renderRanking();
    if(tabName === 'drawing') updateDropdowns();
}

// --- 3. CATEGORY MANAGEMENT ---
document.getElementById('form-kategori').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('cat-name').value;
    const type = parseInt(document.getElementById('cat-type').value);
    
    if(!name) return;
    STATE.categories.push({ id: Date.now(), name, type });
    saveToLocalStorage();
    renderCategoryList();
    updateDropdowns();
    e.target.reset();
});

function renderCategoryList() {
    const container = document.getElementById('list-kategori');
    container.innerHTML = STATE.categories.map(c => `
        <span class="bg-slate-700 px-3 py-1 rounded-full text-xs flex items-center gap-2 border border-slate-600">
            ${c.name} (${c.type} Org)
            <button onclick="deleteCategory(${c.id})" class="text-red-400 hover:text-red-200 font-bold">&times;</button>
        </span>
    `).join('');
}

function deleteCategory(id) {
    STATE.categories = STATE.categories.filter(c => c.id !== id);
    saveToLocalStorage();
    refreshAllUI();
}

// --- 4. PARTICIPANT MANAGEMENT ---
document.getElementById('form-peserta').addEventListener('submit', (e) => {
    e.preventDefault();
    const catName = document.getElementById('p-kategori').value;
    if(!catName) return alert("Pilih/Buat kategori dulu!");

    const newPeserta = {
        id: Date.now(),
        nama: document.getElementById('p-nama').value,
        kontingen: document.getElementById('p-kontingen').value,
        kategori: catName,
        urut: 0,
        pool: 'SINGLE',
        scores: {
            b1: { raw: [], penalty: 0, final: 0, tech: 0 },
            b2: { raw: [], penalty: 0, final: 0, tech: 0 }
        },
        avgFinal: 0,
        avgTech: 0
    };

    STATE.participants.push(newPeserta);
    saveToLocalStorage();
    renderParticipantTable();
    e.target.reset();
});

function renderParticipantTable() {
    const body = document.getElementById('table-peserta-body');
    body.innerHTML = STATE.participants.map(p => `
        <tr class="border-b border-slate-800 hover:bg-slate-800/30">
            <td class="p-4 text-slate-500">${p.urut || '-'}</td>
            <td class="p-4 font-bold text-blue-300">${p.nama} <span class="text-[10px] bg-slate-700 px-1 rounded text-slate-400">${p.pool}</span></td>
            <td class="p-4">${p.kontingen}</td>
            <td class="p-4 text-xs">${p.kategori}</td>
            <td class="p-4 text-right">
                <button onclick="deletePeserta(${p.id})" class="text-red-500"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function deletePeserta(id) {
    if(confirm('Hapus peserta?')) {
        STATE.participants = STATE.participants.filter(p => p.id !== id);
        saveToLocalStorage();
        renderParticipantTable();
    }
}

// --- 5. DRAWING SYSTEM (UNDIAN) ---
function updateDropdowns() {
    const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    document.getElementById('p-kategori').innerHTML = `<option value="">Pilih Kategori</option>` + options;
    document.getElementById('select-kategori').innerHTML = options;
    document.getElementById('draw-select-kategori').innerHTML = options;
    document.getElementById('rank-filter-kategori').innerHTML = '<option value="all">Semua Kategori</option>' + options;
}

function startDrawing() {
    const catName = document.getElementById('draw-select-kategori').value;
    let list = STATE.participants.filter(p => p.kategori === catName);
    
    if(list.length === 0) return alert("Tidak ada peserta!");

    // Shuffle
    for (let i = list.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [list[i], list[j]] = [list[j], list[i]];
    }

    const resultDiv = document.getElementById('drawing-result');
    resultDiv.innerHTML = '';

    if (list.length > 6) {
        const half = Math.ceil(list.length / 2);
        const poolA = list.slice(0, half);
        const poolB = list.slice(half);
        
        assignDrawing(poolA, 'A');
        assignDrawing(poolB, 'B');
        
        renderPoolUI(poolA, "POOL A", resultDiv);
        renderPoolUI(poolB, "POOL B", resultDiv);
    } else {
        assignDrawing(list, 'SINGLE');
        renderPoolUI(list, "PENYISIHAN", resultDiv);
    }
    
    saveToLocalStorage();
    renderParticipantTable();
}

function assignDrawing(arr, poolTag) {
    arr.forEach((p, index) => {
        const found = STATE.participants.find(item => item.id === p.id);
        found.urut = index + 1;
        found.pool = poolTag;
    });
}

function renderPoolUI(arr, title, container) {
    container.innerHTML += `
        <div class="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 class="font-bold text-center text-purple-400 mb-4 border-b border-slate-700 pb-2">${title}</h3>
            ${arr.map((p, i) => `<div class="flex justify-between text-sm py-2 border-b border-slate-700/50"><span>${i+1}. ${p.nama}</span><span class="text-slate-500">${p.kontingen}</span></div>`).join('')}
        </div>
    `;
}

// --- 6. SCORING SYSTEM ---
function setJudges(n) {
    STATE.settings.numJudges = n;
    document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1 rounded bg-blue-600' : 'px-4 py-1 rounded';
    document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1 rounded bg-blue-600' : 'px-4 py-1 rounded';
    
    const container = document.getElementById('judge-inputs');
    container.innerHTML = '';
    for(let i=1; i<=n; i++) {
        container.innerHTML += `
            <div class="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <label class="block text-[10px] text-slate-500 uppercase mb-1">Wasit ${i} ${i===1?'(T)':''}</label>
                <input type="number" step="0.1" id="score-${i}" oninput="calculateLive()" class="w-full bg-transparent text-xl font-bold outline-none text-blue-400" placeholder="0.0">
            </div>
        `;
    }
}

function calculateLive() {
    let raw = [];
    for(let i=1; i<=STATE.settings.numJudges; i++) {
        raw.push(parseFloat(document.getElementById(`score-${i}`).value) || 0);
    }

    let sum = 0;
    if(STATE.settings.numJudges === 5) {
        let sorted = [...raw].sort((a,b) => a-b);
        sorted.pop(); sorted.shift(); // Buang High & Low
        sum = sorted.reduce((a,b) => a+b, 0);
    } else {
        sum = raw.reduce((a,b) => a+b, 0);
    }

    // Penalty Waktu
    const minT = parseInt(document.getElementById('min-time').value);
    const maxT = parseInt(document.getElementById('max-time').value);
    let penalty = 0;
    if(UI.timerSeconds < minT && UI.timerSeconds > 0) penalty = Math.ceil((minT - UI.timerSeconds) / 5) * 5;
    else if (UI.timerSeconds > maxT) penalty = Math.ceil((UI.timerSeconds - maxT) / 5) * 5;

    const final = Math.max(0, sum - penalty);
    document.getElementById('live-final-score').innerText = final.toFixed(2);
    return { final, penalty, raw, tech: raw[0] };
}

function saveScore() {
    const pId = parseInt(document.getElementById('select-peserta').value);
    if(!pId) return alert('Pilih peserta!');
    
    const babak = prompt("Simpan untuk Babak (1 atau 2)?", "1");
    if(!['1','2'].includes(babak)) return;

    const calc = calculateLive();
    const p = STATE.participants.find(i => i.id === pId);
    const bKey = `b${babak}`;

    p.scores[bKey] = {
        raw: calc.raw,
        penalty: calc.penalty,
        final: calc.final,
        tech: calc.tech
    };

    // Hitung Rata-rata jika peserta <= 6
    const catPeserta = STATE.participants.filter(i => i.kategori === p.kategori);
    if(catPeserta.length <= 6) {
        if(p.scores.b1.final > 0 && p.scores.b2.final > 0) {
            p.avgFinal = (p.scores.b1.final + p.scores.b2.final) / 2;
            p.avgTech = (p.scores.b1.tech + p.scores.b2.tech) / 2;
        } else {
            p.avgFinal = calc.final;
            p.avgTech = calc.tech;
        }
    } else {
        // Pool System: Final Score adalah skor babak terbaru yang diinput
        p.avgFinal = calc.final;
        p.avgTech = calc.tech;
    }

    saveToLocalStorage();
    alert(`Nilai Babak ${babak} untuk ${p.nama} berhasil disimpan!`);
    resetTimer();
    for(let i=1; i<=STATE.settings.numJudges; i++) document.getElementById(`score-${i}`).value = '';
}

// --- 7. TIMER ---
function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    if(UI.timerInterval) {
        clearInterval(UI.timerInterval);
        UI.timerInterval = null;
        btn.innerText = 'START';
        btn.classList.replace('bg-red-600', 'bg-green-600');
    } else {
        UI.timerInterval = setInterval(() => {
            UI.timerSeconds++;
            const m = Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0');
            const s = (UI.timerSeconds % 60).toString().padStart(2, '0');
            document.getElementById('timer-display').innerText = `${m}:${s}`;
            calculateLive();
        }, 1000);
        btn.innerText = 'STOP';
        btn.classList.replace('bg-green-600', 'bg-red-600');
    }
}

function resetTimer() {
    clearInterval(UI.timerInterval);
    UI.timerInterval = null;
    UI.timerSeconds = 0;
    document.getElementById('timer-display').innerText = '00:00';
    document.getElementById('btn-timer').innerText = 'START';
}

// --- 8. RANKING VIEW ---
function renderRanking() {
    const filter = document.getElementById('rank-filter-kategori').value;
    let list = filter === 'all' ? [...STATE.participants] : STATE.participants.filter(p => p.kategori === filter);
    
    // Sort by Avg Final (Desc), then Avg Tech (Desc)
    list.sort((a,b) => {
        if(b.avgFinal !== a.avgFinal) return b.avgFinal - a.avgFinal;
        return b.avgTech - a.avgTech;
    });

    const container = document.getElementById('ranking-list');
    container.innerHTML = list.map((p, i) => `
        <div class="flex items-center bg-slate-800 p-4 rounded-xl border-l-4 ${i < 3 ? 'border-yellow-500' : 'border-slate-600'}">
            <div class="text-2xl font-black w-10 text-slate-500">${i+1}</div>
            <div class="flex-1">
                <div class="font-bold text-lg">${p.nama}</div>
                <div class="text-[10px] text-slate-400 uppercase">${p.kontingen} | Pool: ${p.pool}</div>
            </div>
            <div class="text-right flex gap-6 items-center">
                <div class="hidden md:block text-right border-r border-slate-700 pr-6">
                    <div class="text-[10px] text-slate-500">B1 / B2</div>
                    <div class="text-sm font-mono">${p.scores.b1.final.toFixed(1)} / ${p.scores.b2.final.toFixed(1)}</div>
                </div>
                <div>
                    <div class="text-[10px] text-blue-400 font-bold uppercase">Final Score</div>
                    <div class="text-3xl font-black text-white">${p.avgFinal.toFixed(2)}</div>
                </div>
            </div>
        </div>
    `).join('');
}

// --- 9. EXPORT ---
function exportToCSV() {
    let rows = [["Rank", "Nama", "Kontingen", "Kategori", "Pool", "Skor Babak 1", "Skor Babak 2", "Nilai Akhir", "Wasit 1 (Tech)"]];
    
    STATE.participants.forEach(p => {
        rows.push([p.urut, p.nama, p.kontingen, p.kategori, p.pool, p.scores.b1.final, p.scores.b2.final, p.avgFinal, p.avgTech]);
    });

    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `MASS_Report_${Date.now()}.csv`;
    link.click();
}
