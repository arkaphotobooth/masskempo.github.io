/**
 * MASS - Martial Arts Scoring System
 * Version 11.0 (PERKEMI Official Blueprint: Bracket 8 & Crossover 4)
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
        localStorage.clear(); return { categories: [], participants: [], matches: [], settings: { numJudges: 5 } };
    }
}

let STATE = initializeData();
const UI = { tabs: ['kategori', 'atlet', 'drawing', 'scoring', 'ranking', 'juara', 'admin'], timerInterval: null, timerSeconds: 0 };
let RANDORI_STATE = { merah: { score: 0, warn1: false, warn2: false }, putih: { score: 0, warn1: false, warn2: false } };

document.addEventListener('DOMContentLoaded', () => { refreshAllData(); setJudges(5); });
function saveToLocalStorage() { localStorage.setItem('mass_categories', JSON.stringify(STATE.categories)); localStorage.setItem('mass_participants', JSON.stringify(STATE.participants)); localStorage.setItem('mass_matches', JSON.stringify(STATE.matches)); }
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

    if(targetTab === 'ranking') renderRanking();
    if(targetTab === 'scoring') filterPesertaScoring();
    if(targetTab === 'drawing') { updateAllDropdowns(); checkExistingDrawing(); }
    if(targetTab === 'juara') renderJuaraUmum();
}

// --- KATEGORI & ATLET LOGIC (MINIFIED) ---
document.getElementById('form-kategori').addEventListener('submit', (e) => { e.preventDefault(); const name = document.getElementById('cat-name').value.trim(); const type = parseInt(document.getElementById('cat-type').value); const discipline = document.getElementById('cat-discipline').value; if(!name) return; if(STATE.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return alert("Kategori sudah ada!"); STATE.categories.push({ id: Date.now(), name, type, discipline }); saveToLocalStorage(); refreshAllData(); e.target.reset(); });
function renderCategoryList() { const container = document.getElementById('list-kategori'); if(STATE.categories.length === 0) return container.innerHTML = `<span class="text-sm text-slate-500 italic">Belum ada kategori.</span>`; container.innerHTML = STATE.categories.map(c => { let badgeColor = c.discipline === 'randori' ? 'bg-red-700' : 'bg-blue-600'; let disciplineText = c.discipline ? c.discipline.toUpperCase() : 'EMBU'; return `<div class="bg-slate-800 px-4 py-2 rounded-lg text-sm flex items-center gap-3 border border-slate-700 shadow-sm"><span class="${badgeColor} text-[9px] px-1.5 py-0.5 rounded font-bold">${disciplineText}</span><span class="font-bold text-white">${c.name}</span><span class="bg-slate-700 text-[10px] px-2 py-0.5 rounded text-slate-300">${c.type} Org</span><button onclick="deleteCategory(${c.id})" class="text-slate-500 hover:text-red-400 ml-2"><i class="fas fa-times"></i></button></div>` }).join(''); }
function deleteCategory(id) { if(confirm("Hapus kategori ini?")) { STATE.categories = STATE.categories.filter(c => c.id !== id); saveToLocalStorage(); refreshAllData(); } }
function updateAllDropdowns() { const options = STATE.categories.map(c => `<option value="${c.name}">${c.name}</option>`).join(''); const emptyOpt = `<option value="">-- Pilih Kategori --</option>`; document.getElementById('p-kategori').innerHTML = emptyOpt + options; document.getElementById('edit-kategori').innerHTML = emptyOpt + options; document.getElementById('draw-select-kategori').innerHTML = emptyOpt + options; document.getElementById('select-kategori').innerHTML = emptyOpt + options; const allOpt = '<option value="all">Semua Kategori</option>'; document.getElementById('rank-filter-kategori').innerHTML = allOpt + options; document.getElementById('filter-atlet-kategori').innerHTML = allOpt + options; }
function handleCSVUpload(event) { const file = event.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = function(e) { const rows = e.target.result.split('\n'); let count = 0; rows.forEach((row, i) => { if(i === 0 || !row.trim()) return; const cols = row.split(',').map(item => item.trim().replace(/^"|"$/g, '')); if(cols.length >= 3) { const nama = cols[0], kontingen = cols[1], kategori = cols[2]; if(nama && STATE.categories.some(c => c.name.toLowerCase() === kategori.toLowerCase())) { STATE.participants.push({ id: Date.now() + i, nama, kontingen, kategori, urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0, scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }, finalScore: 0, techScore: 0 }); count++; } } }); saveToLocalStorage(); refreshAllData(); event.target.value = ''; alert(`${count} Atlet diimport.`); }; reader.readAsText(file); }
document.getElementById('form-peserta').addEventListener('submit', (e) => { e.preventDefault(); const catName = document.getElementById('p-kategori').value; if(!catName) return alert("Pilih kategori!"); STATE.participants.push({ id: Date.now(), nama: document.getElementById('p-nama').value, kontingen: document.getElementById('p-kontingen').value, kategori: catName, urut: 0, pool: '-', isFinalist: false, urutFinal: 0, losses: 0, scores: { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }, finalScore: 0, techScore: 0 }); saveToLocalStorage(); renderParticipantTable(); document.getElementById('p-nama').value = ''; document.getElementById('p-nama').focus(); });
function renderParticipantTable() { const body = document.getElementById('table-peserta-body'); const filter = document.getElementById('filter-atlet-kategori').value; let list = filter && filter !== 'all' ? STATE.participants.filter(p => p.kategori === filter) : STATE.participants; if(list.length === 0) return body.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-500">Tidak ada data.</td></tr>`; let sortedList = [...list].sort((a,b) => a.kategori === b.kategori ? a.urut - b.urut : a.kategori.localeCompare(b.kategori)); body.innerHTML = sortedList.map(p => { let statusHTML = p.urut > 0 ? `<span class="bg-slate-700 px-2 py-1 rounded text-xs font-mono">No.${p.urut} | Pool ${p.pool}</span>` : `<span class="text-xs text-red-400 italic">Belum Undian</span>`; if(p.losses === 1) statusHTML += ` <span class="bg-orange-600 text-[10px] px-1 rounded ml-1">Loser Bracket</span>`; else if(p.losses >= 2) statusHTML += ` <span class="bg-red-800 text-[10px] px-1 rounded ml-1">Gugur</span>`; return `<tr class="border-b border-slate-800 hover:bg-slate-800/50 transition-colors"><td class="p-4 font-bold text-blue-300">${p.nama} ${p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-1 rounded ml-1">FINALIS</span>' : ''}</td><td class="p-4">${p.kontingen}</td><td class="p-4 text-xs text-slate-400">${p.kategori}<br>${statusHTML}</td><td class="p-4 text-right"><button onclick="openEditModal(${p.id})" class="text-blue-400 mr-3"><i class="fas fa-edit"></i></button><button onclick="deletePeserta(${p.id})" class="text-slate-500 hover:text-red-500"><i class="fas fa-trash"></i></button></td></tr>`; }).join(''); }
function deletePeserta(id) { if(confirm('Hapus atlet ini?')) { STATE.participants = STATE.participants.filter(p => p.id !== id); saveToLocalStorage(); renderParticipantTable(); } }
function openEditModal(id) { const p = STATE.participants.find(x => x.id === id); if(!p) return; document.getElementById('edit-id').value = p.id; document.getElementById('edit-nama').value = p.nama; document.getElementById('edit-kontingen').value = p.kontingen; document.getElementById('edit-kategori').value = p.kategori; document.getElementById('edit-modal').classList.remove('hidden'); }
function closeEditModal() { document.getElementById('edit-modal').classList.add('hidden'); }
document.getElementById('form-edit-peserta').addEventListener('submit', (e) => { e.preventDefault(); const id = parseInt(document.getElementById('edit-id').value); const newKategori = document.getElementById('edit-kategori').value; const idx = STATE.participants.findIndex(p => p.id === id); if(idx > -1) { if(STATE.participants[idx].kategori !== newKategori) { STATE.participants[idx].urut = 0; STATE.participants[idx].pool = '-'; STATE.participants[idx].isFinalist = false; STATE.participants[idx].losses = 0; STATE.participants[idx].scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 } }; STATE.participants[idx].finalScore = 0; STATE.participants[idx].techScore = 0; } STATE.participants[idx].nama = document.getElementById('edit-nama').value; STATE.participants[idx].kontingen = document.getElementById('edit-kontingen').value; STATE.participants[idx].kategori = newKategori; saveToLocalStorage(); renderParticipantTable(); closeEditModal(); alert("Data diperbarui."); } });


// ============================================================================
// --- 🏆 THE PERKEMI BLUEPRINTS (V11.0) ---
// ============================================================================

// TEMPLATE 4 (KHUSUS UNTUK CROSSOVER FINAL 4 BESAR)
const TEMPLATE_4_CROSS = [
    { matchNum: 1, babak: "S-Final Crossover", col: 1, slot1: 1, slot2: 4, nextW: 3, nextL: 4 }, // Juara A vs RU B
    { matchNum: 2, babak: "S-Final Crossover", col: 1, slot1: 3, slot2: 2, nextW: 3, nextL: 4 }, // Juara B vs RU A
    { matchNum: 3, babak: "Final Atas", col: 2, slot1: null, slot2: null, nextW: 6, nextL: 5 }, // Tiket Grand Final
    { matchNum: 4, babak: "LB R1", col: 2, slot1: null, slot2: null, nextW: 5, nextL: null }, // Jalur Neraka
    { matchNum: 5, babak: "Final Bawah", col: 3, slot1: null, slot2: null, nextW: 6, nextL: null }, // Perebutan Juara 3
    { matchNum: 6, babak: "GRAND FINAL", col: 4, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];

// TEMPLATE 8 (SANGAT PRESISI BERDASARKAN PDF BAPOMI/PERKEMI BAGAN 8)
const TEMPLATE_8_PERKEMI = [
    // WINNER BRACKET
    { matchNum: 1, babak: "Penyisihan 1", col: 1, slot1: 1, slot2: 2, nextW: 7, nextL: 5 },
    { matchNum: 2, babak: "Penyisihan 2", col: 1, slot1: 3, slot2: 4, nextW: 7, nextL: 5 },
    { matchNum: 3, babak: "Penyisihan 3", col: 1, slot1: 5, slot2: 6, nextW: 8, nextL: 6 },
    { matchNum: 4, babak: "Penyisihan 4", col: 1, slot1: 7, slot2: 8, nextW: 8, nextL: 6 },
    { matchNum: 7, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 10 }, // Kalah Silang ke G-10
    { matchNum: 8, babak: "Semi-Final W", col: 2, slot1: null, slot2: null, nextW: 11, nextL: 9 },  // Kalah Silang ke G-9
    { matchNum: 11, babak: "FINAL ATAS", col: 3, slot1: null, slot2: null, nextW: 14, nextL: 13 }, // Juara Pool / Tiket GF
    
    // LOSER BRACKET
    { matchNum: 5, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 9, nextL: null }, // L1 vs L2
    { matchNum: 6, babak: "LB R1", col: 1, slot1: null, slot2: null, nextW: 10, nextL: null }, // L3 vs L4
    { matchNum: 9, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, // L8 vs W5
    { matchNum: 10, babak: "LB R2", col: 2, slot1: null, slot2: null, nextW: 12, nextL: null }, // L7 vs W6
    { matchNum: 12, babak: "LB S-Final", col: 3, slot1: null, slot2: null, nextW: 13, nextL: null }, // W9 vs W10
    { matchNum: 13, babak: "FINAL BAWAH", col: 4, slot1: null, slot2: null, nextW: 14, nextL: null }, // L11 vs W12
    
    // PUNCAK
    { matchNum: 14, babak: "GRAND FINAL", col: 5, slot1: null, slot2: null, nextW: 'WINNER', nextL: 'SECOND' }
];

function generateRandoriBracket() {
    const catName = document.getElementById('draw-select-kategori').value;
    if(!catName) return alert("Pilih kategori Randori terlebih dahulu!");
    
    let athletes = STATE.participants.filter(p => p.kategori === catName);
    const count = athletes.length;
    if(count === 0) return alert("Belum ada peserta di kategori ini!");
    
    const existingMatches = STATE.matches.filter(m => m.kategori === catName);
    if(existingMatches.length > 0) {
        if(!confirm("Bagan sudah ada! Mengacak ulang akan menghapus semua data pertandingan. Yakin?")) return;
        STATE.matches = STATE.matches.filter(m => m.kategori !== catName);
    }

    let templateSize = 8;
    let template = TEMPLATE_8_PERKEMI;

    // DETEKSI OTOMATIS CROSSOVER FINAL (Jika 4 orang)
    if(count <= 4) {
        templateSize = 4;
        template = TEMPLATE_4_CROSS;
    } else if (count > 8) {
        return alert("Fitur auto-bagan saat ini mendukung max 8 peserta per kategori (Template 8).\n\nTips: Jika peserta 16 orang, buat 2 kategori ('Pool A' & 'Pool B'). Setelah selesai, masukkan 4 pemenangnya ke kategori 'FINAL' untuk di-Generate menjadi Bagan Crossover Otomatis.");
    }
    
    let slots = athletes.map(a => a.id);
    while(slots.length < templateSize) slots.push(-1); // Padding BYE

    // Fisher-Yates Shuffle
    for (let i = slots.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [slots[i], slots[j]] = [slots[j], slots[i]];
    }

    // Bangun Database Match (Sesuai Blueprint PDF)
    template.forEach(t => {
        let match = {
            id: Date.now() + t.matchNum,
            kategori: catName, matchNum: t.matchNum,
            babak: t.babak, col: t.col,
            nextW: t.nextW, nextL: t.nextL,
            merahId: t.slot1 !== null ? slots[t.slot1 - 1] : null,
            putihId: t.slot2 !== null ? slots[t.slot2 - 1] : null,
            winnerId: null, status: 'pending', skorMerah: 0, skorPutih: 0
        };
        STATE.matches.push(match);
    });

    processAutoWins(catName); // Bersihkan semua BYE
    saveToLocalStorage(); checkExistingDrawing(); 
    alert(`Bagan Double Elimination berhasil di-generate!`);
}

function forwardParticipant(targetMatchNum, participantId, catName) {
    if(!targetMatchNum || targetMatchNum === 'WINNER' || targetMatchNum === 'SECOND' || participantId === null) return;
    let targetMatch = STATE.matches.find(m => m.kategori === catName && m.matchNum === targetMatchNum);
    if(targetMatch) {
        if(participantId !== -1 && (targetMatch.merahId === participantId || targetMatch.putihId === participantId)) return; // Anti Duplikat
        if(targetMatch.merahId === null) targetMatch.merahId = participantId;
        else if(targetMatch.putihId === null) targetMatch.putihId = participantId;
    }
}

function processAutoWins(catName) {
    let changed = true; let loopGuard = 0;
    while(changed && loopGuard < 50) {
        changed = false; loopGuard++;
        STATE.matches.filter(m => m.kategori === catName && m.status === 'pending').forEach(match => {
            if(match.merahId !== null && match.putihId !== null) {
                if(match.merahId === -1 || match.putihId === -1) {
                    match.status = 'auto-win';
                    if(match.merahId === -1 && match.putihId === -1) { match.winnerId = -1; match.loserId = -1; } 
                    else { match.winnerId = match.merahId === -1 ? match.putihId : match.merahId; match.loserId = -1; }
                    forwardParticipant(match.nextW, match.winnerId, catName);
                    if(match.nextL) forwardParticipant(match.nextL, match.loserId, catName);
                    changed = true; 
                }
            }
        });
    }
}


function renderVisualBracket(catName) {
    const container = document.getElementById('randori-bracket-view');
    document.getElementById('randori-bracket-container').classList.remove('hidden');
    container.innerHTML = ''; 
    const catMatches = STATE.matches.filter(m => m.kategori === catName);
    if(catMatches.length === 0) return;

    const columns = [1, 2, 3, 4, 5, 6]; // Sampai col 6 untuk akomodasi G15
    columns.forEach(colNum => {
        let colMatches = catMatches.filter(m => m.col === colNum).sort((a,b) => a.matchNum - b.matchNum);
        if(colMatches.length === 0) return;

        let colHTML = `<div class="flex flex-col gap-6 justify-center min-w-[240px]">`;
        let colTitle = `Babak ${colNum}`;
        colHTML += `<h4 class="text-center text-xs font-bold uppercase text-slate-500 mb-2">${colTitle}</h4>`;
        
        colMatches.forEach(m => {
            let nMerah = m.merahId === -1 ? "BYE" : m.merahId ? STATE.participants.find(p => p.id === m.merahId)?.nama || "Unknown" : "Menunggu...";
            let nPutih = m.putihId === -1 ? "BYE" : m.putihId ? STATE.participants.find(p => p.id === m.putihId)?.nama || "Unknown" : "Menunggu...";
            let bgStyle = m.status === 'done' ? 'border-green-500 bg-slate-800' : m.status === 'auto-win' ? 'border-slate-600 bg-slate-900 opacity-50' : 'border-blue-500 bg-slate-800';
            let wMerah = m.winnerId === m.merahId ? 'text-green-400' : m.winnerId && m.winnerId !== m.merahId ? 'text-slate-500 line-through' : 'text-red-400';
            let wPutih = m.winnerId === m.putihId ? 'text-green-400' : m.winnerId && m.winnerId !== m.putihId ? 'text-slate-500 line-through' : 'text-white';

            colHTML += `
                <div class="bracket-match p-3 rounded-lg border-2 ${bgStyle} relative shadow-lg">
                    <span class="absolute -top-3 -left-3 bg-slate-700 text-[10px] w-6 h-6 flex items-center justify-center rounded-full font-black border border-slate-500">G${m.matchNum}</span>
                    <span class="text-[9px] uppercase text-slate-400 block mb-2 font-bold">${m.babak}</span>
                    <div class="flex justify-between items-center text-sm font-bold border-b border-slate-700 pb-1 mb-1">
                        <span class="${wMerah} truncate w-32">${nMerah}</span>
                        <span class="text-xs text-slate-500">${m.skorMerah > 0 ? m.skorMerah : ''}</span>
                    </div>
                    <div class="flex justify-between items-center text-sm font-bold">
                        <span class="${wPutih} truncate w-32">${nPutih}</span>
                        <span class="text-xs text-slate-500">${m.skorPutih > 0 ? m.skorPutih : ''}</span>
                    </div>
                </div>
            `;
        });
        colHTML += `</div>`;
        if(colNum < 5) colHTML += `<div class="flex flex-col justify-center"><div class="w-8 border-b-2 border-slate-600"></div></div>`;
        container.innerHTML += colHTML;
    });
}

function checkExistingDrawing() {
    const catName = document.getElementById('draw-select-kategori').value; 
    const panelEmbu = document.getElementById('draw-panel-embu');
    const panelRandori = document.getElementById('draw-panel-randori');
    const panelEmpty = document.getElementById('draw-panel-empty');
    const resultDiv = document.getElementById('drawing-result'); 
    
    panelEmbu.classList.add('hidden'); panelRandori.classList.add('hidden'); panelEmpty.classList.add('hidden'); resultDiv.innerHTML = ''; document.getElementById('randori-bracket-container').classList.add('hidden');
    if(!catName) { panelEmpty.classList.remove('hidden'); return; }

    const categoryObj = STATE.categories.find(c => c.name === catName);
    let list = STATE.participants.filter(p => p.kategori === catName); 
    
    if(categoryObj && categoryObj.discipline === 'randori') {
        panelRandori.classList.remove('hidden'); renderVisualBracket(catName); 
    } else {
        panelEmbu.classList.remove('hidden'); const isFinalMode = list.some(p => p.isFinalist); 
        if (isFinalMode) { let finalL = list.filter(p => p.isFinalist); if (finalL.some(p => p.urutFinal > 0)) { finalL.sort((a,b) => a.urutFinal - b.urutFinal); renderPoolUI(finalL, "POOL FINAL", resultDiv, true); } else { resultDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-yellow-500 py-10 border-2 border-dashed border-yellow-600 rounded-xl">Peserta Final dipilih. Klik Acak Urutan.</div>`; } } else if (list.some(p => p.urut > 0)) { list.sort((a,b) => a.urut - b.urut); if(list.some(p => p.pool === 'A' || p.pool === 'B')) { renderPoolUI(list.filter(p => p.pool === 'A'), "POOL A", resultDiv, false); renderPoolUI(list.filter(p => p.pool === 'B'), "POOL B", resultDiv, false); } else { renderPoolUI(list, "BABAK PENYISIHAN", resultDiv, false); } } else { resultDiv.innerHTML = `<div class="col-span-1 md:col-span-2 text-center text-slate-500 py-10 border-2 border-dashed border-slate-700 rounded-xl">Belum diundi.</div>`; }
    }
}

// LOGIKA EMBU DRAWING MANUAL
function startDrawing() { const catName = document.getElementById('draw-select-kategori').value; if(!catName) return alert("Pilih kategori!"); let list = STATE.participants.filter(p => p.kategori === catName); if(list.length === 0) return alert("Belum ada peserta!"); const resultDiv = document.getElementById('drawing-result'); resultDiv.innerHTML = ''; const isFinalMode = list.some(p => p.isFinalist); if (isFinalMode) { let finalL = list.filter(p => p.isFinalist); if (finalL.some(p => p.urutFinal > 0)) if (!confirm("⚠️ Finalis SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return; shuffleArray(finalL); finalL.forEach((p, index) => { const idx = STATE.participants.findIndex(x => x.id === p.id); STATE.participants[idx].urutFinal = index + 1; }); renderPoolUI(finalL, "POOL FINAL", resultDiv, true); } else { if (list.some(p => p.urut > 0)) { if (!confirm("⚠️ Kategori ini SUDAH DIUNDI.\nYakin ingin mengacak ulang?")) return; list.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time:0 } }; p.finalScore = 0; p.techScore = 0; }); } shuffleArray(list); if (list.length > 6) { const half = Math.ceil(list.length / 2); const poolA = list.slice(0, half); const poolB = list.slice(half); applyDrawingData(poolA, 'A'); applyDrawingData(poolB, 'B'); renderPoolUI(poolA, "POOL A", resultDiv, false); renderPoolUI(poolB, "POOL B", resultDiv, false); } else { applyDrawingData(list, 'SINGLE'); renderPoolUI(list, "BABAK PENYISIHAN", resultDiv, false); } } saveToLocalStorage(); renderParticipantTable(); }
function shuffleArray(arr) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } }
function applyDrawingData(arr, poolName) { arr.forEach((p, index) => { const found = STATE.participants.find(item => item.id === p.id); if(found) { found.urut = index + 1; found.pool = poolName; }}); }
function renderPoolUI(arr, title, container, isFinal) { let borderColor = isFinal ? 'border-yellow-600' : 'border-slate-600'; let titleColor = isFinal ? 'text-yellow-500' : 'text-purple-400'; let html = `<div class="bg-slate-800 p-5 rounded-xl border ${borderColor} shadow-lg"><h3 class="font-black text-center ${titleColor} mb-4 border-b border-slate-700 pb-3">${title}</h3><div class="space-y-2">`; arr.forEach((p, i) => { let noUrut = isFinal ? p.urutFinal : p.urut; html += `<div class="flex items-center justify-between text-sm p-3 bg-slate-900/50 rounded-lg border border-slate-700/50"><div class="flex gap-3 items-center"><span class="font-mono text-slate-500 w-5 text-right">${noUrut}.</span><span class="font-bold text-white">${p.nama}</span></div><span class="text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">${p.kontingen}</span></div>`; }); html += `</div></div>`; container.innerHTML += html; }


// --- TAB 4: SCORING (ADAPTIVE UI & RANDORI LOGIC) ---
function filterPesertaScoring() {
    const catName = document.getElementById('select-kategori').value;
    const categoryObj = STATE.categories.find(c => c.name === catName);
    const panelEmbu = document.getElementById('panel-embu'); const panelRandori = document.getElementById('panel-randori');
    const badgeEmbu = document.getElementById('scoring-badge-embu'); const badgeRandori = document.getElementById('scoring-badge-randori');
    const selectEl = document.getElementById('select-peserta');
    
    if(!categoryObj) return;

    if(categoryObj.discipline === 'randori') {
        panelEmbu.classList.add('hidden'); panelRandori.classList.remove('hidden'); badgeEmbu.classList.add('hidden'); badgeRandori.classList.remove('hidden');
        
        let catMatches = STATE.matches.filter(m => m.kategori === catName && m.status === 'pending' && m.merahId !== null && m.putihId !== null && m.merahId !== -1 && m.putihId !== -1);
        if(catMatches.length === 0) { selectEl.innerHTML = `<option value="">-- Tidak ada Partai Aktif --</option>`; document.getElementById('scoring-athlete-name').innerText = "-"; return; }

        selectEl.innerHTML = catMatches.sort((a,b)=>a.matchNum - b.matchNum).map((m) => {
            const mrh = STATE.participants.find(p => p.id === m.merahId); const pth = STATE.participants.find(p => p.id === m.putihId);
            return `<option value="match-${m.id}">G-${m.matchNum} [${m.babak}] ${mrh.nama} vs ${pth.nama}</option>`;
        }).join('');
        selectEl.dispatchEvent(new Event('change'));

    } else {
        panelEmbu.classList.remove('hidden'); panelRandori.classList.add('hidden'); badgeEmbu.classList.remove('hidden'); badgeRandori.classList.add('hidden');
        let listCat = STATE.participants.filter(p => p.kategori === catName && p.urut > 0); const hasFinal = listCat.some(p => p.isFinalist);
        let filtered = hasFinal ? listCat.filter(p => p.isFinalist).sort((a,b) => a.urutFinal - b.urutFinal) : listCat.sort((a,b) => a.pool.localeCompare(b.pool) || a.urut - b.urut);
        if(filtered.length === 0) { selectEl.innerHTML = `<option value="">-- Kosong / Belum Undian --</option>`; document.getElementById('scoring-athlete-name').innerText = "-"; updateScoringButtonsUI(); return; }
        selectEl.innerHTML = filtered.map(p => { let label = hasFinal ? `[FINAL] No.${p.urutFinal}` : `[Pool ${p.pool}] No.${p.urut}`; return `<option value="${p.id}">${label} - ${p.nama} (${p.kontingen})</option>`; }).join('');
        selectEl.dispatchEvent(new Event('change'));
    }
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

function resetRandoriBoard() { RANDORI_STATE = { merah: { score: 0, warn1: false, warn2: false }, putih: { score: 0, warn1: false, warn2: false } }; updateRandoriUI(); }
function addRandoriScore(corner, points) { RANDORI_STATE[corner].score += points; if(RANDORI_STATE[corner].score < 0) RANDORI_STATE[corner].score = 0; updateRandoriUI(); }
function toggleWarning(corner, level) { if(level === 1) RANDORI_STATE[corner].warn1 = !RANDORI_STATE[corner].warn1; if(level === 2) RANDORI_STATE[corner].warn2 = !RANDORI_STATE[corner].warn2; updateRandoriUI(); }
function updateRandoriUI() { document.getElementById('score-merah').innerText = RANDORI_STATE.merah.score; document.getElementById('score-putih').innerText = RANDORI_STATE.putih.score; document.getElementById('warn1-merah').className = RANDORI_STATE.merah.warn1 ? "w-6 h-6 rounded-full transition-colors bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]" : "w-6 h-6 rounded-full border-2 border-yellow-500 transition-colors bg-transparent"; document.getElementById('warn2-merah').className = RANDORI_STATE.merah.warn2 ? "w-6 h-6 rounded-full transition-colors bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : "w-6 h-6 rounded-full border-2 border-orange-500 transition-colors bg-transparent"; document.getElementById('warn1-putih').className = RANDORI_STATE.putih.warn1 ? "w-6 h-6 rounded-full transition-colors bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.8)]" : "w-6 h-6 rounded-full border-2 border-yellow-500 transition-colors bg-transparent"; document.getElementById('warn2-putih').className = RANDORI_STATE.putih.warn2 ? "w-6 h-6 rounded-full transition-colors bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]" : "w-6 h-6 rounded-full border-2 border-orange-500 transition-colors bg-transparent"; }

function saveRandoriMatchResult() {
    if(!currentRandoriMatchId) return alert("Pilih partai!");
    const match = STATE.matches.find(m => m.id === currentRandoriMatchId);
    if(!match) return;

    let sMerah = RANDORI_STATE.merah.score; let sPutih = RANDORI_STATE.putih.score;
    if(sMerah === sPutih) return alert("Skor seri! Randori tidak bisa berakhir seri.");

    let winnerId = sMerah > sPutih ? match.merahId : match.putihId;
    let loserId = sMerah > sPutih ? match.putihId : match.merahId;
    let winnerName = sMerah > sPutih ? "PITA MERAH (AKA)" : "PITA PUTIH (SHIRO)";

    if(confirm(`Konfirmasi Pemenang: ${winnerName}\nSkor: ${sMerah} - ${sPutih}\n\nLanjutkan?`)) {
        match.skorMerah = sMerah; match.skorPutih = sPutih; match.winnerId = winnerId; match.status = 'done';
        
        let loserP = STATE.participants.find(p => p.id === loserId);
        let winnerP = STATE.participants.find(p => p.id === winnerId);
        if(loserP) loserP.losses += 1;

        // TRUE GRAND FINAL LOGIC (G15 / F7)
        if(match.nextW === 'WINNER' && winnerP.losses === 1) {
            alert("TIE BREAKER GRAND FINAL!\nAtlet jalur bawah memenangkan pertandingan. Sistem akan otomatis membuka Partai G-15 (Sudden Death)!");
            let extraMatch = { id: Date.now(), kategori: match.kategori, matchNum: match.matchNum + 1, babak: "SUDDEN DEATH", col: match.col + 1, nextW: 'WINNER', nextL: 'SECOND', merahId: match.merahId, putihId: match.putihId, winnerId: null, status: 'pending', skorMerah: 0, skorPutih: 0 };
            STATE.matches.push(extraMatch);
        } else {
            forwardParticipant(match.nextW, winnerId, match.kategori); 
            if(match.nextL) forwardParticipant(match.nextL, loserId, match.kategori); 
        }

        processAutoWins(match.kategori); 
        saveToLocalStorage(); alert("Partai Selesai! Pemenang dicatat."); filterPesertaScoring(); 
    }
}
document.getElementById('select-peserta').addEventListener('change', (e) => { if(e.target.selectedIndex >= 0) { document.getElementById('scoring-athlete-name').innerText = e.target.options[e.target.selectedIndex].text; if(e.target.value.startsWith('match-')) loadRandoriMatch(); else updateScoringButtonsUI(); }});

// --- EMBU SCORING LOGIC (MINIFIED) ---
function updateScoringButtonsUI() { const pId = parseInt(document.getElementById('select-peserta').value); const selectBabak = document.getElementById('select-babak'); const btnB1 = document.getElementById('btn-save-b1'); const btnB2 = document.getElementById('btn-save-b2'); const btnPen = document.getElementById('btn-save-penyisihan'); const btnFin = document.getElementById('btn-save-final'); if(!pId || !selectBabak || !btnB1) return; const p = STATE.participants.find(i => i.id === pId); selectBabak.innerHTML = ''; const isFinalMode = STATE.participants.some(x => x.kategori === p.kategori && x.isFinalist); if(isFinalMode && p.isFinalist) selectBabak.innerHTML = `<option value="b2">Babak Final</option>`; else if(p.pool === 'A' || p.pool === 'B') selectBabak.innerHTML = `<option value="b1">Babak Penyisihan</option>`; else selectBabak.innerHTML = `<option value="b1">Babak 1</option><option value="b2">Babak 2</option>`; btnB1.classList.add('hidden'); btnB2.classList.add('hidden'); btnPen.classList.add('hidden'); btnFin.classList.add('hidden'); if(isFinalMode && p.isFinalist) btnFin.classList.remove('hidden'); else if(p.pool === 'A' || p.pool === 'B') btnPen.classList.remove('hidden'); else { btnB1.classList.remove('hidden'); btnB2.classList.remove('hidden'); } loadExistingScores(); }
function setJudges(n) { STATE.settings.numJudges = n; document.getElementById('btn-j3').className = n === 3 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white'; document.getElementById('btn-j5').className = n === 5 ? 'px-4 py-1.5 rounded font-bold text-sm bg-blue-600 text-white' : 'px-4 py-1.5 rounded font-semibold text-sm text-slate-400 hover:text-white'; const container = document.getElementById('judge-inputs'); container.innerHTML = ''; for(let i=1; i<=n; i++) { container.innerHTML += `<div class="bg-slate-900 p-3 rounded-lg border border-slate-600 focus-within:border-blue-500 transition-colors"><div class="text-center mb-2 pb-2 border-b border-slate-700"><label class="block text-[10px] text-slate-400 uppercase font-bold">Wasit ${i}</label></div><div class="space-y-2"><div><label class="block text-[9px] text-slate-500 mb-1">TOTAL NILAI</label><input type="number" step="0.5" id="score-${i}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-2xl font-black outline-none text-center text-white placeholder-slate-700" placeholder="0"></div><div><label class="block text-[9px] text-slate-500 mb-1 flex justify-between"><span>TEKNIK</span> ${i===1?'<span class="text-yellow-500 font-bold">TIE-BREAK</span>':''}</label><input type="number" step="0.5" id="tech-${i}" oninput="calculateLive()" class="w-full bg-slate-800 p-2 rounded text-sm font-bold outline-none text-center ${i===1?'text-yellow-400':'text-blue-300'} placeholder-slate-700" placeholder="Opsional"></div></div></div>`; } calculateLive(); }
function loadExistingScores() { const pId = parseInt(document.getElementById('select-peserta').value); const babak = document.getElementById('select-babak').value; if(!pId || !babak) return; const p = STATE.participants.find(i => i.id === pId); const scoreData = p.scores[babak]; if(scoreData && scoreData.raw && scoreData.raw.length > 0) { const nJudges = scoreData.raw.length; if(STATE.settings.numJudges !== nJudges) setJudges(nJudges); for(let i=1; i<=nJudges; i++) { document.getElementById(`score-${i}`).value = scoreData.raw[i-1] || ''; document.getElementById(`tech-${i}`).value = (scoreData.techRaw && scoreData.techRaw[i-1]) ? scoreData.techRaw[i-1] : ''; } UI.timerSeconds = scoreData.time || 0; updateTimerUI(); } else { for(let i=1; i<=STATE.settings.numJudges; i++) { document.getElementById(`score-${i}`).value = ''; document.getElementById(`tech-${i}`).value = ''; } UI.timerSeconds = 0; updateTimerUI(); } calculateLive(); }
function calculateLive() { let raw = []; let techRaw = []; for(let i=1; i<=STATE.settings.numJudges; i++) { raw.push(parseFloat(document.getElementById(`score-${i}`).value) || 0); techRaw.push(parseFloat(document.getElementById(`tech-${i}`).value) || 0); } let sum = 0; if(STATE.settings.numJudges === 5) { let sorted = [...raw].sort((a,b) => a-b); sorted.pop(); sorted.shift(); sum = sorted.reduce((a,b) => a+b, 0); } else { sum = raw.reduce((a,b) => a+b, 0); } const minT = parseInt(document.getElementById('min-time').value) || 0; const maxT = parseInt(document.getElementById('max-time').value) || 0; let penalty = 0; if(UI.timerSeconds > 0 && UI.timerSeconds < minT) penalty = Math.ceil((minT - UI.timerSeconds) / 5) * 5; else if (UI.timerSeconds > maxT) penalty = Math.ceil((UI.timerSeconds - maxT) / 5) * 5; const final = Math.max(0, sum - penalty); document.getElementById('live-final-score').innerText = final.toFixed(1); document.getElementById('live-penalty').innerText = penalty > 0 ? `Penalti Waktu: -${penalty}` : `Penalti Waktu: 0`; return { final, penalty, raw, techRaw, tieBreaker: techRaw[0] }; }
function saveScore(babakOverride) { const pId = parseInt(document.getElementById('select-peserta').value); if(!pId) return alert('Pilih atlet!'); let babak = document.getElementById('select-babak').value; if(babakOverride === 1 || babakOverride === 2) babak = `b${babakOverride}`; for(let i=1; i<=STATE.settings.numJudges; i++) if(document.getElementById(`score-${i}`).value === "") return alert(`TOTAL NILAI kosong!`); const calc = calculateLive(); const p = STATE.participants.find(i => i.id === pId); p.scores[babak] = { raw: calc.raw, techRaw: calc.techRaw, penalty: calc.penalty, final: calc.final, tech: calc.tieBreaker, time: UI.timerSeconds }; if (p.pool === 'FINAL') { p.finalScore = p.scores.b2.final; p.techScore = p.scores.b2.tech; } else if (p.pool === 'A' || p.pool === 'B') { p.finalScore = p.scores.b1.final; p.techScore = p.scores.b1.tech; } else { if(p.scores.b1.final > 0 && p.scores.b2.final > 0) { p.finalScore = (p.scores.b1.final + p.scores.b2.final) / 2; p.techScore = (p.scores.b1.tech + p.scores.b2.tech) / 2; } else { p.finalScore = p.scores[babak].final; p.techScore = p.scores[babak].tech; } } saveToLocalStorage(); alert(`SKOR TERSIMPAN!`); clearInterval(UI.timerInterval); UI.timerInterval = null; document.getElementById('btn-timer').innerText = 'START'; document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold'; }
function toggleTimer() { const btn = document.getElementById('btn-timer'); if(UI.timerInterval) { clearInterval(UI.timerInterval); UI.timerInterval = null; btn.innerText = 'LANJUTKAN'; btn.classList.replace('bg-red-600', 'bg-yellow-600'); btn.classList.replace('hover:bg-red-500', 'hover:bg-yellow-500'); } else { UI.timerInterval = setInterval(() => { UI.timerSeconds++; updateTimerUI(); calculateLive(); }, 1000); btn.innerText = 'STOP'; btn.className = 'bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg w-full font-bold'; } }
function resetTimer() { clearInterval(UI.timerInterval); UI.timerInterval = null; UI.timerSeconds = 0; updateTimerUI(); document.getElementById('btn-timer').innerText = 'START'; document.getElementById('btn-timer').className = 'bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg w-full font-bold'; calculateLive(); }
function updateTimerUI() { document.getElementById('timer-display').innerText = `${Math.floor(UI.timerSeconds / 60).toString().padStart(2, '0')}:${(UI.timerSeconds % 60).toString().padStart(2, '0')}`; }


// --- TAB 5, 6, 7: RANKING, JUARA, ADMIN (MINIFIED) ---
function renderRanking() { const filter = document.getElementById('rank-filter-kategori').value; let list = STATE.participants; const btnPromote = document.getElementById('btn-promote-final'); if (filter !== 'all') { let catParticipants = STATE.participants.filter(p => p.kategori === filter); const hasPools = catParticipants.some(p => p.pool === 'A' || p.pool === 'B'); const hasFinal = catParticipants.some(p => p.isFinalist); if(hasPools && !hasFinal) btnPromote.classList.remove('hidden'); else btnPromote.classList.add('hidden'); list = catParticipants; } else btnPromote.classList.add('hidden'); const container = document.getElementById('ranking-list'); let hasData = list.some(p => p.scores.b1.final > 0 || p.scores.b2.final > 0); if(!hasData) return container.innerHTML = `<div class="p-10 text-center text-slate-500 border border-dashed border-slate-700 rounded-xl">Belum ada data nilai / Khusus Kategori Embu.</div>`; let htmlOutput = ''; ['FINAL', 'SINGLE', 'A', 'B'].forEach(poolKey => { let poolList = []; if(poolKey === 'FINAL') poolList = list.filter(p => p.isFinalist && p.scores.b2.final > 0); else if(poolKey === 'SINGLE') poolList = list.filter(p => p.pool === 'SINGLE' && p.scores.b1.final > 0); else poolList = list.filter(p => p.pool === poolKey && p.scores.b1.final > 0); if(poolList.length === 0) return; if(poolKey === 'FINAL') poolList.sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); else if(poolKey === 'SINGLE') poolList.sort((a,b) => b.finalScore - a.finalScore || b.techScore - a.techScore); else poolList.sort((a,b) => b.scores.b1.final - a.scores.b1.final || b.scores.b1.tech - a.scores.b1.tech); let poolTitle = poolKey === 'SINGLE' ? 'KLASEMEN AKHIR' : poolKey === 'FINAL' ? '<i class="fas fa-star text-yellow-400"></i> KLASEMEN FINAL' : `KLASEMEN POOL ${poolKey}`; htmlOutput += `<h3 class="text-lg font-bold text-blue-400 mt-6 mb-2 border-b border-slate-700 pb-2">${poolTitle}</h3>`; htmlOutput += poolList.map((p, i) => { let medal = i === 0 ? '<i class="fas fa-medal text-yellow-400 text-2xl"></i>' : i === 1 ? '<i class="fas fa-medal text-slate-300 text-2xl"></i>' : i === 2 ? '<i class="fas fa-medal text-amber-600 text-2xl"></i>' : `<span class="text-2xl font-black text-slate-600">${i+1}</span>`; let displayScoreHTML = ''; let displayFinalHTML = ''; if (poolKey === 'FINAL') { displayScoreHTML = `<div class="text-[10px] text-slate-500 uppercase">Skor Final (B2)</div><div class="text-sm font-mono text-slate-300">${p.scores.b2.final.toFixed(1)}</div>`; displayFinalHTML = `<div class="text-2xl font-black text-white">${p.scores.b2.final.toFixed(2)}</div>`; } else if (poolKey === 'SINGLE') { displayScoreHTML = `<div class="text-[10px] text-slate-500 uppercase">B1 / B2</div><div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)} / ${p.scores.b2.final.toFixed(1)}</div>`; displayFinalHTML = `<div class="text-2xl font-black text-white">${p.finalScore.toFixed(2)}</div>`; } else { displayScoreHTML = `<div class="text-[10px] text-slate-500 uppercase">Skor Penyisihan</div><div class="text-sm font-mono text-slate-300">${p.scores.b1.final.toFixed(1)}</div>`; displayFinalHTML = `<div class="text-2xl font-black text-white">${p.scores.b1.final.toFixed(2)}</div>`; } return `<div class="flex flex-col md:flex-row items-start md:items-center bg-dark-card p-4 rounded-xl border border-slate-700 gap-4 mb-3"><div class="w-12 text-center flex-shrink-0">${medal}</div><div class="flex-1 w-full"><div class="font-bold text-lg text-white">${p.nama} ${poolKey !== 'FINAL' && p.isFinalist ? '<span class="text-[10px] bg-yellow-500 text-black px-1 rounded ml-1">LULUS FINAL</span>' : ''}</div><div class="text-xs text-slate-400 mt-1"><span class="bg-slate-800 px-2 py-1 rounded border border-slate-700">${p.kontingen}</span><span class="ml-2 text-blue-400">${p.kategori}</span></div></div><div class="flex gap-4 w-full md:w-auto mt-4 md:mt-0 pt-4 md:pt-0 border-t md:border-t-0 border-slate-700"><div class="text-center md:text-right border-r border-slate-700 pr-4 flex-1">${displayScoreHTML}</div><div class="text-center md:text-right flex-1"><div class="text-[10px] text-green-400 font-bold uppercase">Nilai Akhir</div>${displayFinalHTML}</div></div></div>`; }).join(''); }); container.innerHTML = htmlOutput; }
function renderJuaraUmum() { let tally = {}; STATE.categories.forEach(cat => { let list = STATE.participants.filter(p => p.kategori === cat.name); const hasFinal = list.some(p => p.isFinalist); let winners = []; if(hasFinal) { winners = list.filter(p => p.isFinalist && p.scores.b2.final > 0).sort((a,b) => b.scores.b2.final - a.scores.b2.final || b.scores.b2.tech - a.scores.b2.tech); } else { winners = list.filter(p => p.pool === 'SINGLE' && p.scores.b1.final > 0).sort((a,b) => b.finalScore - a.finalScore || b.techScore - a.techScore); } if(winners[0]) { tally[winners[0].kontingen] = tally[winners[0].kontingen] || {g:0, s:0, b:0}; tally[winners[0].kontingen].g++; } if(winners[1]) { tally[winners[1].kontingen] = tally[winners[1].kontingen] || {g:0, s:0, b:0}; tally[winners[1].kontingen].s++; } if(winners[2]) { tally[winners[2].kontingen] = tally[winners[2].kontingen] || {g:0, s:0, b:0}; tally[winners[2].kontingen].b++; } }); let leaderboard = Object.keys(tally).map(kontingen => ({ nama: kontingen, emas: tally[kontingen].g, perak: tally[kontingen].s, perunggu: tally[kontingen].b, total: tally[kontingen].g + tally[kontingen].s + tally[kontingen].b })); leaderboard.sort((a,b) => b.emas - a.emas || b.perak - a.perak || b.perunggu - a.perunggu); const tbody = document.getElementById('table-juara-body'); if(leaderboard.length === 0) return tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500 border-b border-slate-700">Belum ada data medali.</td></tr>`; tbody.innerHTML = leaderboard.map((k, i) => `<tr class="hover:bg-slate-800/50 transition-colors"><td class="p-4 text-center font-bold text-slate-500 border-b border-slate-800">${i+1}</td><td class="p-4 font-bold text-white border-b border-slate-800 text-lg">${k.nama}</td><td class="p-4 text-center font-black text-yellow-500 border-b border-slate-800 bg-yellow-500/10">${k.emas}</td><td class="p-4 text-center font-black text-slate-300 border-b border-slate-800 bg-slate-400/10">${k.perak}</td><td class="p-4 text-center font-black text-amber-600 border-b border-slate-800 bg-amber-600/10">${k.perunggu}</td><td class="p-4 text-center font-black text-blue-400 border-b border-slate-800">${k.total}</td></tr>`).join(''); }
function exportCustomCSV() { let list = [...STATE.participants].filter(p => p.scores.b1.final > 0); let rows = [["Nama Atlet", "Kontingen", "Kategori", "Pool", "Lulus Final?", "Skor B1/Penyisihan", "Skor B2/Final", "Tie-Breaker B1", "Tie-Breaker B2"]]; list.sort((a,b) => a.kategori.localeCompare(b.kategori) || a.pool.localeCompare(b.pool) || b.scores.b1.final - a.scores.b1.final); list.forEach(p => { rows.push([`"${p.nama}"`, `"${p.kontingen}"`, `"${p.kategori}"`, p.pool, p.isFinalist ? "Ya" : "Tidak", p.scores.b1.final, p.scores.b2.final, p.scores.b1.tech, p.scores.b2.tech]); }); let csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n"); const link = document.createElement("a"); link.href = encodeURI(csvContent); link.download = `Data_Mentah_Nilai_${new Date().toISOString().slice(0,10)}.csv`; link.click(); }
function resetAllPenilaian() { if(confirm('⚠️ PERHATIAN: Ini akan MENGHAPUS SEMUA SKOR & PARTAI RANDORI. Yakin?')) { STATE.participants.forEach(p => { p.scores = { b1: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 }, b2: { raw: [], techRaw: [], penalty: 0, final: 0, tech: 0, time: 0 } }; p.finalScore = 0; p.techScore = 0; p.isFinalist = false; p.urutFinal = 0; p.losses = 0; }); STATE.matches = []; saveToLocalStorage(); refreshAllData(); alert('Nilai di-reset.'); } }
function resetDataAtlet() { if(confirm('⚠️ PERHATIAN: Ini MENGHAPUS SEMUA ATLET. Yakin?')) { STATE.participants = []; STATE.matches = []; saveToLocalStorage(); refreshAllData(); alert('Data atlet dihapus.'); } }
function resetTotalSistem() { if(confirm('🚨 FACTORY RESET: Hapus seluruh sistem?')) { localStorage.clear(); STATE = { categories: [], participants: [], matches: [], settings: { numJudges: 5 } }; refreshAllData(); alert('Sistem kembali ke pengaturan awal.'); location.reload(); } }
