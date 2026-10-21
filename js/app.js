const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const getApiBase = () => {
  const fromWindow = window.location.origin;
  const isLocalhost = /localhost|127\.0\.0\.1/.test(fromWindow);

  if (!isLocalhost) {
    return `${fromWindow.replace(/\/$/, '')}/api`;
  }

  const fromEnv = (window.__APP_API_BASE__ || '').trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  return 'http://localhost:3000/api';
};

const API_BASE = getApiBase();

const defaultDB = {
  courses: [
    { id: 1, name: 'Implementasi dan Pengujian Perangkat Lunak', code: 'IPPL', lecturer: 'Dosen Pengampu', credits: 3 },
    { id: 2, name: 'Pemrograman Berbasis Objek', code: 'PBO', lecturer: 'Dosen Pengampu', credits: 3 },
    { id: 3, name: 'Machine Learning 1', code: 'ML1', lecturer: 'Dosen Pengampu', credits: 3 }
  ],
  materials: [
    { id: 1, title: 'Pengenalan SDLC dan MVP', course: 'Implementasi dan Pengujian Perangkat Lunak', type: 'PDF', date: '24 Sep 2026', desc: 'Pengenalan siklus pengembangan perangkat lunak dan konsep Minimum Viable Product.' },
    { id: 2, title: 'Analisis Kebutuhan Perangkat Lunak', course: 'Implementasi dan Pengujian Perangkat Lunak', type: 'PDF', date: '25 Sep 2026', desc: 'Kebutuhan fungsional, non-fungsional, dan pemodelan sistem.' },
    { id: 3, title: 'Konsep Class dan Object', course: 'Pemrograman Berbasis Objek', type: 'PDF', date: '22 Sep 2026', desc: 'Dasar OOP: class, object, attribute, method, dan encapsulation.' },
    { id: 4, title: 'Dasar Machine Learning', course: 'Machine Learning 1', type: 'PDF', date: '20 Sep 2026', desc: 'Konsep dasar supervised dan unsupervised learning.' }
  ],
  tasks: [
    { id: 1, title: 'Use Case Diagram Mini LMS', course: 'Implementasi dan Pengujian Perangkat Lunak', deadline: '30 Sep 2026', desc: 'Buat Use Case Diagram untuk sistem Mini LMS.', status: 'Belum dikumpulkan' },
    { id: 2, title: 'Activity Diagram', course: 'Implementasi dan Pengujian Perangkat Lunak', deadline: '07 Okt 2026', desc: 'Buat activity diagram untuk proses login dan pengumpulan tugas.', status: 'Belum dikumpulkan' },
    { id: 3, title: 'Prototype UI/UX', course: 'Implementasi dan Pengujian Perangkat Lunak', deadline: '14 Okt 2026', desc: 'Buat prototype interaktif halaman utama Mini LMS.', status: 'Belum dikumpulkan' }
  ],
  grades: [
    { id: 1, student: 'Nur Lutfia Amalia Khaisya', task: 'Use Case Diagram Mini LMS', course: 'Implementasi dan Pengujian Perangkat Lunak', score: 90, feedback: 'Struktur aktor dan use case sudah jelas.' },
    { id: 2, student: 'Nur Lutfia Amalia Khaisya', task: 'Activity Diagram', course: 'Implementasi dan Pengujian Perangkat Lunak', score: 88, feedback: 'Alur sudah baik, rapikan decision node.' }
  ],
  announcements: [
    { id: 1, title: 'Bimbingan Project Mingguan', date: '25 Sep 2026', content: 'Setiap kelompok membawa progress implementasi dan dokumen pengujian untuk dikonsultasikan.' },
    { id: 2, title: 'Pembagian Role Kelompok', date: '23 Sep 2026', content: 'Pastikan role System Analyst & UI/UX, Developer, dan QA/Tester sudah ditentukan.' },
    { id: 3, title: 'Fokus pada MVP', date: '20 Sep 2026', content: 'Aplikasi tidak perlu rumit. Prioritaskan fitur utama, minim bug, dan dokumentasi testing.' }
  ],
  submissions: []
};

let db = JSON.parse(localStorage.getItem('ruangKelasDB') || 'null') || defaultDB;
let accounts = JSON.parse(localStorage.getItem('ruangKelasUsers') || '[]');
if (!Array.isArray(accounts)) accounts = [];
let user = { name: '', role: 'mahasiswa' };
let ownerToken = localStorage.getItem('ruangKelasOwnerToken') || '';
let currentLoginRole = 'mahasiswa';
let forgotPasswordCountdown = 0;
let forgotPasswordTimer = null;

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    throw new Error(payload && typeof payload === 'object' && payload.message ? payload.message : 'Request gagal');
  }

  return payload;
}

function save() {
  localStorage.setItem('ruangKelasDB', JSON.stringify(db));
}

function saveAccounts() {
  localStorage.setItem('ruangKelasUsers', JSON.stringify(accounts));
}

function uid(arr) {
  return arr.length ? Math.max(...arr.map((x) => Number(x.id) || 0)) + 1 : 1;
}

function toast(msg) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  $('#toast').appendChild(el);
  setTimeout(() => el.remove(), 2500);
}

function togglePasswordVisibility(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input || !button) return;

  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';
  button.textContent = isPassword ? 'Sembunyikan' : 'Lihat';
  button.setAttribute('aria-label', isPassword ? 'Sembunyikan password' : 'Lihat password');
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[m]));
}

function today() {
  return new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

async function loadServerData() {
  try {
    const [matakuliah, materi, tugas, nilai, pengumuman] = await Promise.all([
      apiRequest('/matakuliah').catch(() => []),
      apiRequest('/materi').catch(() => []),
      apiRequest('/tugas').catch(() => []),
      apiRequest('/nilai').catch(() => []),
      apiRequest('/pengumuman').catch(() => []),
    ]);

    if (Array.isArray(matakuliah)) {
      db.courses = matakuliah.map((item) => ({
        id: item.id,
        name: item.nama,
        code: item.kode,
        lecturer: 'Dosen Pengampu',
        credits: Number(item.sks) || 3,
      }));
    }

    if (Array.isArray(materi)) {
      db.materials = materi.map((item) => ({
        id: item.id,
        title: item.judul,
        course: item.matakuliah_nama || item.matakuliah || '',
        type: item.tipe || 'PDF',
        date: item.tanggal || '-',
        desc: item.deskripsi || '',
      }));
    }

    if (Array.isArray(tugas)) {
      db.tasks = tugas.map((item) => ({
        id: item.id,
        title: item.judul,
        course: item.matakuliah_nama || item.matakuliah || '',
        deadline: item.deadline || '-',
        desc: item.deskripsi || '',
        status: item.status || 'Belum dikumpulkan',
      }));
    }

    if (Array.isArray(nilai)) {
      db.grades = nilai.map((item) => ({
        id: item.id,
        student: item.nama_mahasiswa || item.student || '-',
        task: item.judul_tugas || item.task || '-',
        course: item.matakuliah_nama || item.course || '',
        score: Number(item.nilai) || 0,
        feedback: item.feedback || '-',
      }));
    }

    if (Array.isArray(pengumuman)) {
      db.announcements = pengumuman.map((item) => ({
        id: item.id,
        title: item.judul,
        date: item.tanggal || '-',
        content: item.isi || '',
      }));
    }

    save();
  } catch (error) {
    console.warn('Gagal memuat data dari server, memakai data lokal:', error.message);
  }
}

const navStudent = [
  ['dashboard', '▦', 'Dashboard'],
  ['courses', '▤', 'Mata Kuliah'],
  ['materials', '▣', 'Materi'],
  ['tasks', '✓', 'Tugas'],
  ['grades', '★', 'Nilai'],
  ['announcements', '◈', 'Pengumuman']
];

const navLecturer = [
  ['dashboard', '▦', 'Dashboard'],
  ['courses', '▤', 'Mata Kuliah'],
  ['materials', '▣', 'Kelola Materi'],
  ['tasks', '✓', 'Kelola Tugas'],
  ['grades', '★', 'Kelola Nilai'],
  ['announcements', '◈', 'Pengumuman']
];

function buildNav() {
  const nav = user.role === 'dosen' ? navLecturer : navStudent;
  $('#sidebarNav').innerHTML = nav.map(([page, icon, title]) => `<button class="nav-btn" data-page="${page}">${icon} &nbsp; ${title}</button>`).join('');
  $$('#sidebarNav .nav-btn').forEach((btn) => {
    btn.onclick = () => {
      render(btn.dataset.page);
      $('#sidebarNav').parentElement.classList.remove('open');
    };
  });
}

// Admin approval UI (owner only). Accessible from login page via button.
function showAdminPanel() {
  const token = prompt('Masukkan OWNER TOKEN untuk akses admin:');
  if (!token) return toast('Token diperlukan');
  ownerToken = token;
  localStorage.setItem('ruangKelasOwnerToken', ownerToken);

  if (!window.isBackendReady) return toast('Server tidak tersedia');

  apiRequest(`/pending-registrations?token=${encodeURIComponent(ownerToken)}`).then((list) => {
    openModal(`<div class="modal-head"><h3>Daftar Pendaftar (Pending)</h3><button class="close" onclick="closeModal()">✕</button></div><div id="pendingList">${list.length ? list.map((p) => `<div style="padding:8px;border-bottom:1px solid #eee"><b>${esc(p.nama)}</b> — ${esc(p.nim)}<br>${esc(p.email)}<div style="margin-top:6px"><button class="btn small" onclick="approve(${p.id})">Setujui</button></div></div>`).join('') : '<p>Tidak ada pendaftar.'}</div>`);
  }).catch((err) => toast(err.message || 'Gagal memuat daftar pendaftar'));
}

function approve(id) {
  if (!ownerToken) return toast('Token owner hilang, buka ulang admin panel');
  apiRequest(`/approve/${id}?token=${encodeURIComponent(ownerToken)}`, { method: 'POST' }).then((r) => {
    toast('Mahasiswa disetujui');
    // refresh list
    apiRequest(`/pending-registrations?token=${encodeURIComponent(ownerToken)}`).then((list) => {
      const html = list.length ? list.map((p) => `<div style="padding:8px;border-bottom:1px solid #eee"><b>${esc(p.nama)}</b> — ${esc(p.nim)}<br>${esc(p.email)}<div style="margin-top:6px"><button class="btn small" onclick="approve(${p.id})">Setujui</button></div></div>`).join('') : '<p>Tidak ada pendaftar.';
      $('#modal').querySelector('#pendingList').innerHTML = html;
    }).catch(() => {});
  }).catch((err) => toast(err.message || 'Gagal menyetujui'));
}

function render(page = 'dashboard') {
  buildNav();
  $$('#sidebarNav .nav-btn').forEach((btn) => btn.classList.toggle('active', btn.dataset.page === page));
  const labels = {
    dashboard: 'Dashboard',
    courses: 'Mata Kuliah',
    materials: user.role === 'dosen' ? 'Kelola Materi' : 'Materi',
    tasks: user.role === 'dosen' ? 'Kelola Tugas' : 'Tugas',
    grades: user.role === 'dosen' ? 'Kelola Nilai' : 'Nilai',
    announcements: 'Pengumuman',
  };

  $('#pageTitle').textContent = labels[page] || 'Dashboard';
  const map = {
    dashboard: renderDashboard,
    courses: renderCourses,
    materials: renderMaterials,
    tasks: renderTasks,
    grades: renderGrades,
    announcements: renderAnnouncements,
  };
  (map[page] || renderDashboard)();
}

function stats() {
  return `
    <div class="stats">
      <div class="stat"><div class="stat-top"><span>Mata Kuliah</span><span class="stat-icon">📚</span></div><strong>${db.courses.length}</strong><small>tersedia</small></div>
      <div class="stat"><div class="stat-top"><span>Materi</span><span class="stat-icon">📄</span></div><strong>${db.materials.length}</strong><small>materi aktif</small></div>
      <div class="stat"><div class="stat-top"><span>Tugas</span><span class="stat-icon">✓</span></div><strong>${db.tasks.length}</strong><small>tugas aktif</small></div>
      <div class="stat"><div class="stat-top"><span>Pengumuman</span><span class="stat-icon">🔔</span></div><strong>${db.announcements.length}</strong><small>informasi</small></div>
    </div>
  `;
}

function renderDashboard() {
  const latest = db.announcements.slice(-3).reverse();
  $('#pageContent').innerHTML = `
  <div class="welcome"><div><h1>Halo, ${esc(user.name)}! 👋</h1><p>Selamat datang di RuangKelas. Semua aktivitas pembelajaran ada di satu tempat.</p></div><div class="welcome-icon">🎓</div></div>
  ${stats()}
  <div class="section-head"><div><h3>Pengumuman Terbaru</h3><p>Informasi penting dari dosen</p></div><button class="btn secondary" onclick="render('announcements')">Lihat semua</button></div>
  <div class="timeline">${latest.map((a) => `<div class="item"><div class="timeline-date">${esc(a.date)}</div><div><h4>${esc(a.title)}</h4><p>${esc(a.content)}</p></div></div>`).join('')}</div>
  <div class="section-head"><div><h3>${user.role === 'dosen' ? 'Ringkasan Pengelolaan' : 'Tugas Mendatang'}</h3></div></div>
  <div class="grid">${db.tasks.slice(0, 3).map((t) => `<div class="item"><span class="tag orange">${esc(t.deadline)}</span><h4>${esc(t.title)}</h4><p>${esc(t.course)}</p><div class="progress"><span style="width:${t.status === 'Sudah dikumpulkan' ? 100 : 35}%"></span></div><p style="font-size:11px;margin-top:7px">${esc(t.status)}</p></div>`).join('')}</div>`;
}

function renderCourses() {
  $('#pageContent').innerHTML = `
  <div class="section-head"><div><h3>Daftar Mata Kuliah</h3><p>${user.role === 'dosen' ? 'Kelola mata kuliah yang diajar.' : 'Mata kuliah yang tersedia di RuangKelas.'}</p></div>${user.role === 'dosen' ? '<div class="action-row"><button class="btn primary" onclick="courseModal()">+ Tambah Mata Kuliah</button><button class="btn secondary" onclick="bulkCourseModal()">+ Tambah Banyak</button></div>' : ''}</div>
  <div class="grid">${db.courses.map((c) => `<div class="item"><span class="tag">${esc(c.code)}</span><h4>${esc(c.name)}</h4><p><b>Dosen:</b> ${esc(c.lecturer)}</p><p><b>SKS:</b> ${c.credits}</p>${user.role === 'dosen' ? `<div class="action-row"><button class="btn small secondary" onclick="courseModal(${c.id})">Edit</button><button class="btn small danger" onclick="removeItem('courses',${c.id},'Mata kuliah')">Hapus</button></div>` : ''}</div>`).join('')}</div>`;
}

function renderMaterials() {
  $('#pageContent').innerHTML = `
  <div class="section-head"><div><h3>${user.role === 'dosen' ? 'Kelola Materi' : 'Materi Pembelajaran'}</h3><p>${db.materials.length} materi tersedia</p></div>${user.role === 'dosen' ? '<button class="btn primary" onclick="materialModal()">+ Tambah Materi</button>' : ''}</div>
  <div class="grid">${db.materials.map((m) => `<div class="item"><span class="tag">${esc(m.type)}</span><h4>${esc(m.title)}</h4><p><b>${esc(m.course)}</b></p><p>${esc(m.desc)}</p><p style="font-size:11px">Diunggah: ${esc(m.date)}</p><div class="action-row">${user.role === 'mahasiswa' ? '<button class="btn small secondary" onclick="toast(\'Materi siap dibuka pada versi backend.\')">Buka Materi</button>' : `<button class="btn small secondary" onclick="materialModal(${m.id})">Edit</button><button class="btn small danger" onclick="removeItem('materials',${m.id},'Materi')">Hapus</button>`}</div></div>`).join('')}</div>`;
}

function renderTasks() {
  const isD = user.role === 'dosen';
  $('#pageContent').innerHTML = `
  <div class="section-head"><div><h3>${isD ? 'Kelola Tugas' : 'Daftar Tugas'}</h3><p>${isD ? 'Buat dan kelola tugas mahasiswa.' : 'Tugas yang harus diselesaikan.'}</p></div>${isD ? '<button class="btn primary" onclick="taskModal()">+ Buat Tugas</button>' : ''}</div>
  <div class="table-wrap"><table><thead><tr><th>Tugas</th><th>Mata Kuliah</th><th>Deadline</th><th>Status</th><th>Aksi</th></tr></thead><tbody>
  ${db.tasks.map((t) => `<tr><td><b>${esc(t.title)}</b><br><small>${esc(t.desc)}</small></td><td>${esc(t.course)}</td><td>${esc(t.deadline)}</td><td><span class="tag ${t.status === 'Sudah dikumpulkan' ? 'green' : 'orange'}">${esc(t.status)}</span></td><td><div class="action-row">${isD ? `<button class="btn small secondary" onclick="taskModal(${t.id})">Edit</button><button class="btn small danger" onclick="removeItem('tasks',${t.id},'Tugas')">Hapus</button>` : `<button class="btn small primary" onclick="submitModal(${t.id})">Kumpulkan</button>`}</div></td></tr>`).join('')}
  </tbody></table></div>`;
}

function renderGrades() {
  if (user.role === 'dosen') {
    $('#pageContent').innerHTML = `
    <div class="section-head"><div><h3>Kelola Nilai</h3><p>Berikan nilai dan feedback kepada mahasiswa.</p></div><button class="btn primary" onclick="gradeModal()">+ Tambah Nilai</button></div>
    <div class="table-wrap"><table><thead><tr><th>Mahasiswa</th><th>Tugas</th><th>Mata Kuliah</th><th>Nilai</th><th>Feedback</th><th>Aksi</th></tr></thead><tbody>${db.grades.map((g) => `<tr><td>${esc(g.student)}</td><td>${esc(g.task)}</td><td>${esc(g.course)}</td><td class="score">${g.score}</td><td>${esc(g.feedback || '-')}</td><td><button class="btn small danger" onclick="removeItem('grades',${g.id},'Nilai')">Hapus</button></td></tr>`).join('')}</tbody></table></div>`;
  } else {
    const my = db.grades.filter((g) => g.student === user.name || g.student === 'Nur Lutfia Amalia Khaisya');
    const avg = my.length ? Math.round(my.reduce((a, b) => a + b.score, 0) / my.length) : 0;
    $('#pageContent').innerHTML = `
    <div class="stats"><div class="stat"><div class="stat-top"><span>Rata-rata</span><span class="stat-icon">★</span></div><strong>${avg}</strong><small>dari ${my.length} nilai</small></div><div class="stat"><div class="stat-top"><span>Tugas Dinilai</span><span class="stat-icon">✓</span></div><strong>${my.length}</strong><small>tugas</small></div></div>
    <div class="section-head"><div><h3>Hasil Penilaian</h3><p>Nilai dan feedback dari dosen.</p></div></div>
    <div class="table-wrap"><table><thead><tr><th>Tugas</th><th>Mata Kuliah</th><th>Nilai</th><th>Feedback</th></tr></thead><tbody>${my.map((g) => `<tr><td>${esc(g.task)}</td><td>${esc(g.course)}</td><td class="score">${g.score}</td><td>${esc(g.feedback || '-')}</td></tr>`).join('')}</tbody></table></div>`;
  }
}

function renderAnnouncements() {
  $('#pageContent').innerHTML = `
  <div class="section-head"><div><h3>Pengumuman</h3><p>Informasi terbaru dari ruang kelas.</p></div>${user.role === 'dosen' ? '<button class="btn primary" onclick="announcementModal()">+ Buat Pengumuman</button>' : ''}</div>
  <div class="grid two">${db.announcements.slice().reverse().map((a) => `<div class="item"><span class="tag">${esc(a.date)}</span><h4>${esc(a.title)}</h4><p>${esc(a.content)}</p>${user.role === 'dosen' ? `<div class="action-row"><button class="btn small secondary" onclick="announcementModal(${a.id})">Edit</button><button class="btn small danger" onclick="removeItem('announcements',${a.id},'Pengumuman')">Hapus</button></div>` : ''}</div>`).join('')}</div>`;
}

function openModal(html) {
  $('#modal').innerHTML = html;
  $('#modalBackdrop').classList.remove('hidden');
}

function closeModal() {
  $('#modalBackdrop').classList.add('hidden');
}

$('#modalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop') closeModal();
});

function modalShell(title, body, submit) {
  openModal(`<div class="modal-head"><h3>${title}</h3><button class="close" onclick="closeModal()">✕</button></div>${body}<div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Batal</button><button class="btn primary" onclick="${submit}">Simpan</button></div>`);
}

function courseModal(id = null) {
  const c = id ? db.courses.find((x) => x.id === id) : {};
  modalShell(id ? 'Edit Mata Kuliah' : 'Tambah Mata Kuliah', `<label>Nama Mata Kuliah</label><input id="fName" value="${esc(c.name || '')}"><label>Kode</label><input id="fCode" value="${esc(c.code || '')}"><label>Dosen</label><input id="fLecturer" value="${esc(c.lecturer || 'Dosen Pengampu')}"><label>SKS</label><input id="fCredits" type="number" value="${c.credits || 3}">`, `saveCourse(${id || 'null'})`);
}

function saveCourse(id) {
  const x = {
    name: $('#fName').value,
    code: $('#fCode').value,
    lecturer: $('#fLecturer').value,
    credits: Number($('#fCredits').value) || 3,
  };

  if (!x.name || !x.code) return toast('Nama dan kode wajib diisi');

  if (id) {
    Object.assign(db.courses.find((c) => c.id === id), x);
  } else {
    db.courses.push({ id: uid(db.courses), ...x });
  }

  save();
  closeModal();
  render('courses');
  toast('Mata kuliah berhasil disimpan');

  if (window.isBackendReady) {
    const payload = { nama: x.name, kode: x.code, sks: x.credits };
    if (id) {
      apiRequest(`/matakuliah/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch(() => {});
    } else {
      apiRequest('/matakuliah', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
    }
  }
}

function bulkCourseModal() {
  modalShell('Tambah Banyak Mata Kuliah', `
    <label>Format tiap baris</label>
    <div class="helper" style="margin:0 0 8px; color:#9cc7ff; font-size:12px;">Contoh: <strong>Nama Mata Kuliah | Kode | SKS</strong></div>
    <textarea id="fBulkCourses" rows="12" placeholder="Algoritma dan Struktur Data | ASD | 3\nBasis Data | BD | 3\nJaringan Komputer | JK | 2"></textarea>
  `, 'saveBulkCourses()');
}

function saveBulkCourses() {
  const raw = $('#fBulkCourses').value.trim();
  if (!raw) return toast('Masukkan minimal satu mata kuliah');

  const rows = raw.split(/\n+/).map((line) => line.trim()).filter(Boolean);
  const items = rows.map((row) => {
    const parts = row.split('|').map((part) => part.trim());
    const name = parts[0] || '';
    const code = (parts[1] || name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()) || '';
    const credits = Number(parts[2] || 3);
    return { name, code, lecturer: 'Dosen Pengampu', credits: Number.isFinite(credits) && credits > 0 ? credits : 3 };
  }).filter((item) => item.name && item.code);

  if (!items.length) return toast('Format salah. Gunakan Nama | Kode | SKS');

  const newCourses = items.map((item) => ({ id: uid(db.courses), ...item }));
  db.courses.push(...newCourses);
  save();
  closeModal();
  render('courses');
  toast(`${items.length} mata kuliah berhasil ditambahkan`);

  if (window.isBackendReady) {
    apiRequest('/matakuliah/bulk', {
      method: 'POST',
      body: JSON.stringify({
        items: newCourses.map((course) => ({ nama: course.name, kode: course.code, sks: course.credits })),
      }),
    }).catch((err) => toast(err.message || 'Gagal menambah banyak ke database'));
  }
}

function materialModal(id = null) {
  const m = id ? db.materials.find((x) => x.id === id) : {};
  modalShell(id ? 'Edit Materi' : 'Tambah Materi', `<label>Judul Materi</label><input id="fTitle" value="${esc(m.title || '')}"><label>Mata Kuliah</label><select id="fCourse">${db.courses.map((c) => `<option ${m.course === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><label>Tipe File</label><select id="fType"><option ${m.type === 'PDF' ? 'selected' : ''}>PDF</option><option ${m.type === 'PPT' ? 'selected' : ''}>PPT</option><option ${m.type === 'DOC' ? 'selected' : ''}>DOC</option></select><label>Deskripsi</label><textarea id="fDesc">${esc(m.desc || '')}</textarea>`, `saveMaterial(${id || 'null'})`);
}

function saveMaterial(id) {
  const x = {
    title: $('#fTitle').value,
    course: $('#fCourse').value,
    type: $('#fType').value,
    desc: $('#fDesc').value,
    date: today(),
  };

  if (!x.title) return toast('Judul materi wajib diisi');

  if (id) {
    Object.assign(db.materials.find((m) => m.id === id), x);
  } else {
    db.materials.push({ id: uid(db.materials), ...x });
  }

  save();
  closeModal();
  render('materials');
  toast('Materi berhasil disimpan');

  if (window.isBackendReady) {
    const selectedCourse = db.courses.find((c) => c.name === x.course);
    const payload = {
      matakuliah_id: selectedCourse ? selectedCourse.id : null,
      judul: x.title,
      tipe: x.type,
      deskripsi: x.desc,
      tanggal: x.date,
    };
    if (id) {
      apiRequest(`/materi/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch(() => {});
    } else {
      apiRequest('/materi', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
    }
  }
}

function taskModal(id = null) {
  const t = id ? db.tasks.find((x) => x.id === id) : {};
  modalShell(id ? 'Edit Tugas' : 'Buat Tugas', `<label>Judul Tugas</label><input id="fTitle" value="${esc(t.title || '')}"><label>Mata Kuliah</label><select id="fCourse">${db.courses.map((c) => `<option ${t.course === c.name ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select><label>Deadline</label><input id="fDeadline" type="date" value="${id ? isoDate(t.deadline) : ''}"><label>Deskripsi</label><textarea id="fDesc">${esc(t.desc || '')}</textarea>`, `saveTask(${id || 'null'})`);
}

function isoDate(s) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function saveTask(id) {
  const raw = $('#fDeadline').value;
  const date = raw ? new Date(`${raw}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';
  const old = id ? db.tasks.find((t) => t.id === id) : {};
  const x = {
    title: $('#fTitle').value,
    course: $('#fCourse').value,
    deadline: date,
    desc: $('#fDesc').value,
    status: old.status || 'Belum dikumpulkan',
  };

  if (!x.title) return toast('Judul tugas wajib diisi');

  if (id) {
    Object.assign(old, x);
  } else {
    db.tasks.push({ id: uid(db.tasks), ...x });
  }

  save();
  closeModal();
  render('tasks');
  toast('Tugas berhasil disimpan');

  if (window.isBackendReady) {
    const selectedCourse = db.courses.find((c) => c.name === x.course);
    const payload = {
      matakuliah_id: selectedCourse ? selectedCourse.id : null,
      judul: x.title,
      deadline: raw || null,
      deskripsi: x.desc,
      status: x.status,
    };
    if (id) {
      apiRequest(`/tugas/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch(() => {});
    } else {
      apiRequest('/tugas', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
    }
  }
}

function submitModal(taskId) {
  const t = db.tasks.find((x) => x.id === taskId);
  openModal(`<div class="modal-head"><h3>Kumpulkan Tugas</h3><button class="close" onclick="closeModal()">✕</button></div><p><b>${esc(t.title)}</b></p><label>File Tugas</label><input id="fFile" type="file"><label>Catatan</label><textarea id="fNote" placeholder="Catatan untuk dosen (opsional)"></textarea><div class="modal-actions"><button class="btn ghost" onclick="closeModal()">Batal</button><button class="btn primary" onclick="submitTask(${taskId})">Kirim Tugas</button></div>`);
}

function submitTask(taskId) {
  const f = $('#fFile').files[0];
  if (!f) return toast('Pilih file terlebih dahulu');

  const t = db.tasks.find((x) => x.id === taskId);
  t.status = 'Sudah dikumpulkan';
  db.submissions.push({ id: uid(db.submissions), taskId, student: user.name, file: f.name, note: $('#fNote').value, date: today() });

  save();
  closeModal();
  render('tasks');
  toast('Tugas berhasil dikumpulkan');

  if (window.isBackendReady) {
    apiRequest(`/tugas/${taskId}/kumpulkan`, {
      method: 'POST',
      body: JSON.stringify({
        mahasiswa_id: user.id || 1,
        mahasiswa_nama: user.name || 'Mahasiswa',
        file_name: f.name,
        catatan: $('#fNote').value,
        tanggal: today(),
      }),
    }).catch(() => {});
  }
}

function gradeModal() {
  modalShell('Tambah Nilai', `<label>Nama Mahasiswa</label><input id="fStudent" value=""><label>Tugas</label><select id="fTask">${db.tasks.map((t) => `<option>${esc(t.title)}</option>`).join('')}</select><label>Nilai (0-100)</label><input id="fScore" type="number" min="0" max="100"><label>Feedback</label><textarea id="fFeedback"></textarea>`, 'saveGrade()');
}

function saveGrade() {
  const task = db.tasks.find((t) => t.title === $('#fTask').value);
  const score = Number($('#fScore').value);

  if (!$('#fStudent').value || !task || score < 0 || score > 100) return toast('Lengkapi data nilai');

  db.grades.push({
    id: uid(db.grades),
    student: $('#fStudent').value,
    task: task.title,
    course: task.course,
    score,
    feedback: $('#fFeedback').value,
  });

  save();
  closeModal();
  render('grades');
  toast('Nilai berhasil ditambahkan');

  if (window.isBackendReady) {
    const selectedTask = db.tasks.find((t) => t.title === $('#fTask').value);
    const selectedCourse = db.courses.find((c) => c.name === task.course);
    apiRequest('/nilai', {
      method: 'POST',
      body: JSON.stringify({
        mahasiswa_nama: $('#fStudent').value,
        tugas_id: selectedTask ? selectedTask.id : null,
        matakuliah_id: selectedCourse ? selectedCourse.id : null,
        nilai: score,
        feedback: $('#fFeedback').value,
      }),
    }).catch(() => {});
  }
}

function announcementModal(id = null) {
  const a = id ? db.announcements.find((x) => x.id === id) : {};
  modalShell(id ? 'Edit Pengumuman' : 'Buat Pengumuman', `<label>Judul</label><input id="fTitle" value="${esc(a.title || '')}"><label>Isi Pengumuman</label><textarea id="fContent">${esc(a.content || '')}</textarea>`, `saveAnnouncement(${id || 'null'})`);
}

function saveAnnouncement(id) {
  const x = {
    title: $('#fTitle').value,
    content: $('#fContent').value,
    date: today(),
  };

  if (!x.title || !x.content) return toast('Judul dan isi wajib diisi');

  if (id) {
    Object.assign(db.announcements.find((a) => a.id === id), x);
  } else {
    db.announcements.push({ id: uid(db.announcements), ...x });
  }

  save();
  closeModal();
  render('announcements');
  toast('Pengumuman berhasil disimpan');

  if (window.isBackendReady) {
    const payload = { judul: x.title, isi: x.content, tanggal: x.date };
    if (id) {
      apiRequest(`/pengumuman/${id}`, { method: 'PUT', body: JSON.stringify(payload) }).catch(() => {});
    } else {
      apiRequest('/pengumuman', { method: 'POST', body: JSON.stringify(payload) }).catch(() => {});
    }
  }
}

function removeItem(type, id, label) {
  if (!confirm(`Hapus ${label} ini?`)) return;

  const endpoints = {
    courses: '/matakuliah',
    materials: '/materi',
    tasks: '/tugas',
    grades: '/nilai',
    announcements: '/pengumuman',
  };

  if (window.isBackendReady && endpoints[type]) {
    apiRequest(`${endpoints[type]}/${id}`, { method: 'DELETE' }).catch(() => {});
  }

  db[type] = db[type].filter((x) => x.id !== id);
  save();
  render(type === 'materials' ? 'materials' : type === 'tasks' ? 'tasks' : type === 'courses' ? 'courses' : type === 'grades' ? 'grades' : 'announcements');
  toast(label + ' berhasil dihapus');
}

function setAuthMode(mode) {
  const isLogin = mode === 'login';
  $('#registerForm').classList.toggle('hidden', isLogin);
  $('#loginForm').classList.toggle('hidden', !isLogin);
  $('#authTitle').textContent = isLogin ? 'Masuk ke RuangKelas' : 'Buat akun RuangKelas';
  $('#authDescription').textContent = isLogin ? 'Masukkan NIM atau NIP Anda beserta password untuk masuk otomatis ke role yang sesuai.' : 'Daftar sebagai mahasiswa. Akun akan diverifikasi oleh pemilik/dosen.';
  $('#authSwitch').innerHTML = isLogin ? '<span>Belum punya akun?</span> <button type="button" id="showRegisterBtn">Buat akun</button>' : '<span>Sudah punya akun?</span> <button type="button" id="showLoginBtn">Masuk</button>';
  const nextButton = $('#authSwitch button');
  nextButton.onclick = () => setAuthMode(isLogin ? 'register' : 'login');
}

function startForgotPasswordCountdown(seconds = 60) {
  forgotPasswordCountdown = seconds;

  if (forgotPasswordTimer) clearInterval(forgotPasswordTimer);

  const resendBtn = $('#forgotPasswordResendBtn');
  const render = () => {
    if (!resendBtn) return;
    if (forgotPasswordCountdown > 0) {
      resendBtn.disabled = true;
      resendBtn.textContent = `Kirim ulang (${forgotPasswordCountdown}s)`;
      forgotPasswordCountdown -= 1;
      return;
    }

    resendBtn.disabled = false;
    resendBtn.textContent = 'Kirim ulang kode';
    clearInterval(forgotPasswordTimer);
    forgotPasswordTimer = null;
  };

  render();
  forgotPasswordTimer = setInterval(render, 1000);
}

function toggleForgotPasswordStep(step) {
  const step1 = $('#forgotPasswordStep1');
  const step2 = $('#forgotPasswordStep2');
  const step3 = $('#forgotPasswordStep3');

  if (step1) step1.classList.toggle('hidden', step !== 1);
  if (step2) step2.classList.toggle('hidden', step !== 2);
  if (step3) step3.classList.toggle('hidden', step !== 3);
}

function openForgotPasswordModal() {
  openModal(`
    <div class="modal-head">
      <h3>Reset Password</h3>
      <button class="close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:grid;gap:12px;">
      <div id="forgotPasswordStep1" style="display:grid;gap:12px;">
        <div style="display:grid;gap:8px;">
          <label>Role Akun</label>
          <select id="fResetRole">
            <option value="mahasiswa" ${currentLoginRole === 'dosen' ? '' : 'selected'}>Mahasiswa</option>
            <option value="dosen" ${currentLoginRole === 'dosen' ? 'selected' : ''}>Dosen</option>
          </select>
        </div>
        <div style="display:grid;gap:8px;">
          <label id="fResetIdentifierLabel">NIM</label>
          <input id="fResetIdentifier" placeholder="Masukkan NIM">
        </div>
        <div style="display:grid;gap:8px;">
          <label>Email</label>
          <input id="fResetEmail" type="email" placeholder="Masukkan email akun">
        </div>
        <button type="button" class="btn primary" onclick="sendForgotPasswordCode()">Kirim Kode Verifikasi</button>
      </div>

      <div id="forgotPasswordStep2" class="hidden" style="display:grid;gap:12px;">
        <div style="display:grid;gap:8px;">
          <label>Kode Verifikasi</label>
          <input id="fResetCode" type="text" maxlength="6" placeholder="Masukkan 6 digit kode">
        </div>
        <div class="modal-actions">
          <button type="button" class="btn ghost" onclick="verifyForgotPasswordCode()">Verifikasi Kode</button>
          <button id="forgotPasswordResendBtn" type="button" class="btn ghost" onclick="sendForgotPasswordCode()">Kirim ulang kode</button>
        </div>
      </div>

      <div id="forgotPasswordStep3" class="hidden" style="display:grid;gap:12px;">
        <div style="display:grid;gap:8px;">
          <label>Password Baru</label>
          <input id="fResetPassword" type="password" placeholder="Minimal 8 karakter">
        </div>
        <div style="display:grid;gap:8px;">
          <label>Konfirmasi Password Baru</label>
          <input id="fResetPasswordConfirm" type="password" placeholder="Ulangi password baru">
        </div>
        <button type="button" class="btn primary" onclick="submitForgotPassword()">Ubah Password</button>
      </div>
    </div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">Batal</button>
    </div>
  `);

  const resetRole = $('#fResetRole');
  if (resetRole) {
    resetRole.onchange = () => {
      const isDosen = resetRole.value === 'dosen';
      const label = $('#fResetIdentifierLabel');
      const input = $('#fResetIdentifier');
      if (label) label.textContent = isDosen ? 'NIP' : 'NIM';
      if (input) input.placeholder = isDosen ? 'Masukkan NIP' : 'Masukkan NIM';
      currentLoginRole = isDosen ? 'dosen' : 'mahasiswa';
    };
  }

  toggleForgotPasswordStep(1);
  const resendBtn = $('#forgotPasswordResendBtn');
  if (resendBtn) {
    resendBtn.disabled = false;
    resendBtn.textContent = 'Kirim ulang kode';
  }
}

function getForgotPasswordRole() {
  const resetRole = $('#fResetRole');
  if (resetRole) {
    currentLoginRole = resetRole.value === 'dosen' ? 'dosen' : 'mahasiswa';
    return currentLoginRole;
  }

  return currentLoginRole === 'dosen' ? 'dosen' : 'mahasiswa';
}

async function sendForgotPasswordCode() {
  const isDosen = getForgotPasswordRole() === 'dosen';
  const identifier = $('#fResetIdentifier').value.trim();
  const email = $('#fResetEmail').value.trim().toLowerCase();

  if (!identifier || !email) return toast('NIM/NIP dan email wajib diisi');

  const request = isDosen ? { nip: identifier, email, role: 'dosen' } : { nim: identifier, email, role: 'mahasiswa' };

  try {
    const response = await apiRequest('/forgot-password/request', {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (response.debugCode) {
      toast(`Kode verifikasi: ${response.debugCode} (mode dev)`);
    }

    toggleForgotPasswordStep(2);
    $('#fResetCode').focus();
    startForgotPasswordCountdown(60);
    toast(response.message || 'Kode verifikasi dikirim');
  } catch (err) {
    toast(err.message || 'Gagal mengirim kode verifikasi');
  }
}

async function verifyForgotPasswordCode() {
  const isDosen = getForgotPasswordRole() === 'dosen';
  const identifier = $('#fResetIdentifier').value.trim();
  const email = $('#fResetEmail').value.trim().toLowerCase();
  const code = $('#fResetCode').value.trim();

  if (!identifier || !email || !code) return toast('Silakan isi NIM/NIP, email, dan kode verifikasi');

  try {
    const response = await apiRequest('/forgot-password/verify', {
      method: 'POST',
      body: JSON.stringify(isDosen ? { nip: identifier, email, code, role: 'dosen' } : { nim: identifier, email, code, role: 'mahasiswa' }),
    });

    toggleForgotPasswordStep(3);
    $('#fResetPassword').focus();
    toast(response.message || 'Kode verifikasi valid');
  } catch (err) {
    toast(err.message || 'Kode verifikasi gagal diproses');
  }
}

function submitForgotPassword() {
  const isDosen = getForgotPasswordRole() === 'dosen';
  const identifier = $('#fResetIdentifier').value.trim();
  const email = $('#fResetEmail').value.trim().toLowerCase();
  const code = $('#fResetCode').value.trim();
  const newPassword = $('#fResetPassword').value;
  const confirmPassword = $('#fResetPasswordConfirm').value;

  if (!identifier || !email || !code || !newPassword || !confirmPassword) return toast('Semua field wajib diisi');
  if (newPassword.length < 8) return toast('Password baru minimal 8 karakter');
  if (newPassword !== confirmPassword) return toast('Konfirmasi password tidak cocok');

  const request = isDosen ? { nip: identifier, email, newPassword, code, role: 'dosen' } : { nim: identifier, email, newPassword, code, role: 'mahasiswa' };

  if (window.isBackendReady) {
    apiRequest('/forgot-password', {
      method: 'POST',
      body: JSON.stringify(request),
    }).then(() => {
      closeModal();
      $('#loginForm').reset();
      $('#dosenLoginForm').reset();
      setAuthMode('login');
      toast('Password berhasil direset. Silakan login kembali.');
    }).catch((err) => toast(err.message || 'Gagal reset password'));
    return;
  }

  return toast('Mode lokal belum mendukung verifikasi reset password via email');
}

function openChangePasswordModal() {
  openModal(`
    <div class="modal-head">
      <h3>Ubah Password</h3>
      <button class="close" onclick="closeModal()">✕</button>
    </div>
    <div style="display:grid;gap:12px;">
      <label>Password Lama</label>
      <input id="fCurrentPassword" type="password" placeholder="Masukkan password lama">
      <label>Password Baru</label>
      <input id="fNewPassword" type="password" placeholder="Minimal 8 karakter">
      <label>Konfirmasi Password Baru</label>
      <input id="fNewPasswordConfirm" type="password" placeholder="Ulangi password baru">
    </div>
    <div class="modal-actions">
      <button class="btn ghost" onclick="closeModal()">Batal</button>
      <button class="btn primary" onclick="submitChangePassword()">Simpan</button>
    </div>
  `);
}

function submitChangePassword() {
  const currentPassword = $('#fCurrentPassword').value;
  const newPassword = $('#fNewPassword').value;
  const confirmPassword = $('#fNewPasswordConfirm').value;

  if (user.role === 'dosen') {
    const nip = user.nip || $('#dosenLoginNip').value.trim();
    if (!nip || !currentPassword || !newPassword || !confirmPassword) return toast('Semua field wajib diisi');
    if (newPassword.length < 8) return toast('Password baru minimal 8 karakter');
    if (newPassword !== confirmPassword) return toast('Konfirmasi password tidak cocok');

    if (window.isBackendReady) {
      apiRequest('/change-password', {
        method: 'POST',
        body: JSON.stringify({ nip, currentPassword, newPassword, role: 'dosen' }),
      }).then(() => {
        closeModal();
        toast('Password berhasil diubah');
      }).catch((err) => toast(err.message || 'Gagal mengganti password'));
      return;
    }

    return toast('Mode lokal belum mendukung ganti password dosen');
  }

  const nim = user.nim || $('#loginName').value.trim();

  if (!nim || !currentPassword || !newPassword || !confirmPassword) return toast('Semua field wajib diisi');
  if (newPassword.length < 8) return toast('Password baru minimal 8 karakter');
  if (newPassword !== confirmPassword) return toast('Konfirmasi password tidak cocok');

  if (window.isBackendReady) {
    apiRequest('/change-password', {
      method: 'POST',
      body: JSON.stringify({ nim, currentPassword, newPassword, role: 'mahasiswa' }),
    }).then(() => {
      closeModal();
      toast('Password berhasil diubah');
    }).catch((err) => toast(err.message || 'Gagal mengganti password'));
    return;
  }

  const account = accounts.find((a) => a.nim === nim);
  if (!account) return toast('User tidak ditemukan');
  if (account.password !== currentPassword) return toast('Password lama tidak sesuai');
  account.password = newPassword;
  saveAccounts();
  closeModal();
  toast('Password berhasil diubah');
}

$('#authSwitch button').onclick = () => setAuthMode('login');
if ($('#forgotPasswordBtn')) $('#forgotPasswordBtn').onclick = openForgotPasswordModal;
if ($('#changePasswordBtn')) $('#changePasswordBtn').onclick = openChangePasswordModal;

$('#registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('#registerName').value.trim();
  const nim = $('#registerNIM').value.trim();
  const email = $('#registerEmail').value.trim().toLowerCase();
  const password = $('#registerPassword').value;
  const passwordConfirm = $('#registerPasswordConfirm').value;
  const ownerCode = ($('#registerOwnerCode') && $('#registerOwnerCode').value.trim()) || '';

  if (password.length < 8) return toast('Password minimal 8 karakter');
  if (password !== passwordConfirm) return toast('Konfirmasi password tidak cocok');
  if (accounts.some((account) => account.nim === nim)) return toast('NIM sudah digunakan (lokal)');

  // local fallback account (will be pending if server registers)
  accounts.push({ name, nim, email, password, role: 'mahasiswa', pending: true });
  saveAccounts();

  if (window.isBackendReady) {
    try {
      await apiRequest('/register', { method: 'POST', body: JSON.stringify({ nama: name, nim, email, password, ownerToken: ownerCode }) });
      toast(ownerCode ? 'Pendaftaran terkirim. Kode pemilik diterima (jika valid), akun akan aktif.' : 'Pendaftaran terkirim. Menunggu verifikasi pemilik/dosen.');
    } catch (err) {
      toast(err.message || 'Gagal mendaftar ke server');
    }
  } else {
    toast('Akun lokal dibuat. Jika server aktif, pendaftaran akan dikirim.');
  }

  $('#registerForm').reset();
  setAuthMode('login');
});

$('#loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const identifier = $('#loginName').value.trim();
  const password = $('#loginPassword').value;

  if (window.isBackendReady) {
    try {
      const payload = await apiRequest('/login', { method: 'POST', body: JSON.stringify({ identifier, password }) });

      user.name = payload.nama;
      user.role = payload.role === 'dosen' ? 'dosen' : 'mahasiswa';
      user.id = payload.id;
      user.nim = payload.nim || '';
      user.nip = payload.nip || '';

      $('#profileName').textContent = user.name;
      $('#profileRole').textContent = user.role === 'dosen' ? 'Dosen' : 'Mahasiswa';
      $('#avatar').textContent = user.name.charAt(0).toUpperCase();
      $('#loginPage').classList.add('hidden');
      $('#app').classList.remove('hidden');
      $('#currentDate').textContent = today();
      await loadServerData();
      render('dashboard');
    } catch (err) {
      toast(err.message || 'Gagal login');
    }
    return;
  }

  const account = accounts.find((a) => a.nim === identifier && a.password === password);
  if (!account) {
    const dosenAccount = accounts.find((a) => a.nip === identifier && a.password === password);
    if (!dosenAccount) return toast('NIM/NIP atau password salah (lokal)');
    user.name = dosenAccount.name;
    user.role = 'dosen';
    user.nip = identifier;
    $('#profileName').textContent = user.name;
    $('#profileRole').textContent = 'Dosen';
  } else {
    if (account.pending) return toast('Akun lokal belum diverifikasi oleh pemilik');
    user.name = account.name;
    user.role = 'mahasiswa';
    user.nim = identifier;
    $('#profileName').textContent = user.name;
    $('#profileRole').textContent = 'Mahasiswa';
  }

  $('#avatar').textContent = user.name.charAt(0).toUpperCase();
  $('#loginPage').classList.add('hidden');
  $('#app').classList.remove('hidden');
  $('#currentDate').textContent = today();
  render('dashboard');
});

$('#logoutBtn').onclick = () => {
  user = { name: '', role: 'mahasiswa', nim: '', nip: '' };
  $('#app').classList.add('hidden');
  $('#loginPage').classList.remove('hidden');
  $('#loginForm').reset();
  setAuthMode('login');
};

setAuthMode('login');

$('#mobileMenu').onclick = () => $('.sidebar').classList.toggle('open');
$('#notifBtn').onclick = () => toast(`${db.announcements.length} pengumuman tersedia`);

window.isBackendReady = false;
fetch(`${API_BASE}/health`)
  .then(async (res) => {
    const payload = await res.json().catch(() => null);
    window.isBackendReady = !!payload && payload.status === 'ok';
    if (window.isBackendReady) {
      await loadServerData();
      if (typeof render === 'function') render('dashboard');
    }
  })
  .catch(() => {
    window.isBackendReady = false;
  });
