// --- STATE MANAGEMENT ---
let peserta = JSON.parse(localStorage.getItem('mass_peserta')) || [];
let numJudges = 3;
let timerSeconds = 0;
let timerInterval = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    updatePesertaTable();
    updateCategoryDropdowns();
    setJudges(5); // Default setting
});

function switchTab(tab) {
    ['admin', 'scoring', 'ranking'].forEach(t => {
        document.getElementById(`section-${t}`).classList.add('hidden');
        document.getElementById(`tab-${t}`).classList.remove('active-tab', 'text-blue-500');
        document.getElementById(`tab-${t}`).classList.add('text-slate-400');
    });
    document.getElementById(`section-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('active-tab', 'text-blue-500');
    
    if(tab === 'ranking') updateRankingView();
    if(tab === 'scoring') updateCategoryDropdowns();
}

// --- ADMIN LOGIC ---
document.getElementById('form-peserta').addEventListener('submit', (e) => {
    e.preventDefault();
    const newPeserta = {
        id: Date.now(),
        nama: document.getElementById('p-nama').value,
        kontingen: document.getElementById('p-kontingen').value,
        kategori: document.getElementById('p-kategori').value,
        urut: document.getElementById('p-urut').value,
        scores: [],
        time: 0,
        penalty: 0,
        finalScore: 0,
        techniqueScore: 0 // Wasit 1 sebagai tie-breaker
    };
    peserta.push(newPeserta);
    saveData();
    updatePesertaTable();
    e.target.reset();
});

function saveData() {
    localStorage.setItem('mass_peserta', JSON.stringify(peserta));
}

function resetData() {
    if(confirm('Hapus semua data peserta?')) {
        peserta = [];
        saveData();
        location.reload();
    }
}

function updatePesertaTable() {
    const body = document.getElementById('table-peserta-body');
    body.innerHTML = peserta.map(p => `
        <tr class="border-b border-slate-800 hover:bg-slate-800/50">
            <td class="p-4">${p.urut}</td>
            <td class="p-4 font-bold text-blue-300">${p.nama}</td>
            <td class="p-4">${p.kontingen}</td>
            <td class="p-4 text-slate-400 text-sm">${p.kategori}</td>
            <td class="p-4 text-right">
                <button onclick="deletePeserta(${p.id})" class="text-red-500 hover:text-red-400"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
}

function deletePeserta(id) {
    peserta = peserta.filter(p => p.id !== id);
    saveData();
    updatePesertaTable();
}

// --- SCORING LOGIC ---
function setJudges(n) {
    numJudges = n;
    document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1 rounded bg-blue-600' : 'px-4 py-1 rounded';
    document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1 rounded bg-blue-600' : 'px-4 py-1 rounded';
    
    const container = document.getElementById('judge-inputs');
    container.innerHTML = '';
    for(let i=1; i<=n; i++) {
        container.innerHTML += `
            <div class="bg-slate-800 p-3 rounded-lg border border-slate-700">
                <label class="block text-[10px] text-slate-500 uppercase mb-1">Wasit ${i} ${i===1?'(T)':''}</label>
                <input type="number" step="0.1" id="score-${i}" oninput="calculateLive()" class="w-full bg-transparent text-xl font-bold outline-none" placeholder="0.0">
            </div>
        `;
    }
}

function updateCategoryDropdowns() {
    const cats = [...new Set(peserta.map(p => p.kategori))];
    const html = cats.map(c => `<option value="${c}">${c}</option>`).join('');
    document.getElementById('select-kategori').innerHTML = html;
    document.getElementById('rank-filter-kategori').innerHTML = '<option value="all">Semua Kategori</option>' + html;
    filterPesertaScoring();
}

function filterPesertaScoring() {
    const cat = document.getElementById('select-kategori').value;
    const filtered = peserta.filter(p => p.kategori === cat).sort((a,b) => a.urut - b.urut);
    document.getElementById('select-peserta').innerHTML = filtered.map(p => `
        <option value="${p.id}">${p.urut}. ${p.nama} (${p.kontingen})</option>
    `).join('');
}

function calculateLive() {
    let scores = [];
    for(let i=1; i<=numJudges; i++) {
        let val = parseFloat(document.getElementById(`score-${i}`).value) || 0;
        scores.push(val);
    }

    let totalWasit = 0;
    if(numJudges === 5) {
        let sorted = [...scores].sort((a,b) => a-b);
        sorted.pop(); // Buang tertinggi
        sorted.shift(); // Buang terendah
        totalWasit = sorted.reduce((a,b) => a+b, 0);
    } else {
        totalWasit = scores.reduce((a,b) => a+b, 0);
    }

    // Penalty Waktu
    const minT = parseInt(document.getElementById('min-time').value);
    const maxT = parseInt(document.getElementById('max-time').value);
    let penalty = 0;
    
    if(timerSeconds < minT && timerSeconds > 0) {
        penalty = Math.ceil((minT - timerSeconds) / 5) * 5;
    } else if (timerSeconds > maxT) {
        penalty = Math.ceil((timerSeconds - maxT) / 5) * 5;
    }

    const final = Math.max(0, totalWasit - penalty).toFixed(2);
    document.getElementById('live-final-score').innerText = final;
    return { final, penalty, scores };
}

function saveScore() {
    const pId = parseInt(document.getElementById('select-peserta').value);
    if(!pId) return alert('Pilih peserta dulu!');
    
    const calc = calculateLive();
    const idx = peserta.findIndex(p => p.id === pId);
    
    peserta[idx].scores = calc.scores;
    peserta[idx].time = timerSeconds;
    peserta[idx].penalty = calc.penalty;
    peserta[idx].finalScore = parseFloat(calc.final);
    peserta[idx].techniqueScore = calc.scores[0] || 0;

    saveData();
    alert(`Nilai ${peserta[idx].nama} Berhasil Disimpan!`);
    resetTimer();
    // Bersihkan input
    for(let i=1; i<=numJudges; i++) document.getElementById(`score-${i}`).value = '';
}

// --- TIMER LOGIC ---
function toggleTimer() {
    const btn = document.getElementById('btn-timer');
    if(timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
        btn.innerText = 'START';
        btn.className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-24';
    } else {
        timerInterval = setInterval(() => {
            timerSeconds++;
            updateTimerDisplay();
            calculateLive();
        }, 1000);
        btn.innerText = 'STOP';
        btn.className = 'bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg w-24';
    }
}

function resetTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    timerSeconds = 0;
    updateTimerDisplay();
    document.getElementById('btn-timer').innerText = 'START';
    document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-24';
}

function updateTimerDisplay() {
    const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
    const s = (timerSeconds % 60).toString().padStart(2, '0');
    document.getElementById('timer-display').innerText = `${m}:${s}`;
}

// --- RANKING LOGIC ---
function updateRankingView() {
    const filter = document.getElementById('rank-filter-kategori').value;
    let filtered = filter === 'all' ? [...peserta] : peserta.filter(p => p.kategori === filter);
    
    // Sort by Score (Primary) then Wasit 1 (Tie-breaker)
    filtered.sort((a,b) => {
        if(b.finalScore !== a.finalScore) return b.finalScore - a.finalScore;
        return b.techniqueScore - a.techniqueScore;
    });

    const container = document.getElementById('ranking-list');
    container.innerHTML = filtered.map((p, index) => `
        <div class="flex items-center bg-dark-card p-4 rounded-xl border-l-4 ${index < 3 ? 'border-yellow-500' : 'border-slate-700'} relative overflow-hidden">
            <div class="text-3xl font-black w-12 text-slate-600">${index + 1}</div>
            <div class="flex-1">
                <div class="font-bold text-lg">${p.nama}</div>
                <div class="text-xs text-slate-400 uppercase tracking-tighter">${p.kontingen} | Time: ${p.time}s | Pen: -${p.penalty}</div>
            </div>
            <div class="text-right">
                <div class="text-xs text-slate-500">Total Score</div>
                <div class="text-3xl font-black text-blue-400">${p.finalScore.toFixed(2)}</div>
            </div>
            <div class="ml-6 text-right border-l border-slate-700 pl-6 hidden md:block">
                <div class="text-xs text-slate-500">Tech (W1)</div>
                <div class="text-xl font-bold text-slate-300">${p.techniqueScore.toFixed(1)}</div>
            </div>
        </div>
    `).join('');
}

// --- UTILITIES ---
function exportToCSV() {
    let rows = [["Rank", "Nama", "Kontingen", "Kategori", "Nilai Akhir", "W1 (Teknik)", "Waktu", "Penalti"]];
    const cats = [...new Set(peserta.map(p => p.kategori))];
    
    cats.forEach(cat => {
        let sorted = peserta.filter(p => p.kategori === cat).sort((a,b) => b.finalScore - a.finalScore);
        sorted.forEach((p, i) => {
            rows.push([i+1, p.nama, p.kontingen, p.kategori, p.finalScore, p.techniqueScore, p.time, p.penalty]);
        });
    });

    let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", `Hasil_Pertandingan_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
}
