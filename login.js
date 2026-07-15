// login.js
import { db } from './assets/js/firebase-app.js'; // Mengambil 'db' (Firestore dari Project B)
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const loginForm = document.getElementById('loginForm');
const loginBtn = document.getElementById('loginBtn');
const errorMessage = document.getElementById('errorMessage');

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const usernameInput = document.getElementById('username').value.trim();
    const passwordInput = document.getElementById('password').value.trim();

    loginBtn.textContent = 'Memeriksa...';
    loginBtn.disabled = true;
    errorMessage.style.display = 'none';

    try {
        // Ini akan membaca koleksi "users" di Firestore (Project B)
        const userRef = doc(db, "users", usernameInput);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const userData = userSnap.data();

            if (userData.password === passwordInput) {
                // Simpan sesi
                sessionStorage.setItem('isLoggedIn', 'true');
                sessionStorage.setItem('role', userData.role);
                sessionStorage.setItem('username', usernameInput);

                if (userData.courtId) {
                    sessionStorage.setItem('courtId', userData.courtId);
                }

                // Redirect berdasarkan peran
                if (userData.role === 'panitera') {
                    window.location.href = './scoring/index.html';
                } else if (userData.role === 'seksi_acara') {
                    window.location.href = './jadwal/index.html';
                } else if (userData.role === 'seksi_pertandingan') {
                    window.location.href = './dashboard.html';
                }
            } else {
                showError("Kata sandi salah.");
            }
        } else {
            showError("Username tidak ditemukan.");
        }
    } catch (error) {
        console.error("Error saat login:", error);
        showError("Terjadi kesalahan sistem. Coba lagi.");
    } finally {
        loginBtn.textContent = 'Masuk';
        loginBtn.disabled = false;
    }
});

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
}

window.onload = () => {
    if (sessionStorage.getItem('isLoggedIn') === 'true') {
        const role = sessionStorage.getItem('role');
        if (role === 'panitera' || role === 'seksi_pertandingan') window.location.href = './scoring/index.html';
        if (role === 'seksi_acara') window.location.href = './jadwal/index.html';
    }
}