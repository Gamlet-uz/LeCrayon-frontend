// Telegram Web App obyekti
const tg = window.Telegram.WebApp;

const app = {
  currentUser: null, // Foydalanuvchi ma'lumotlari saqlanadi
  currentClassId: null,
  currentClassName: null,
  studentsData: [], // Hisobot uchun kesh
  
  // ==========================================
  // 1. TIZIMNI ISHGA TUSHIRISH
  // ==========================================
  init: () => {
    tg.ready();
    tg.expand(); // Web App ni to'liq ekranda ochish
    
    // Telegram dizayn ranglarini qo'llash
    document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#000000');

    // Lokal xotiradan userni qidirish (Avtomatik kirish uchun)
    const savedUser = localStorage.getItem('leCrayonUser');
    if (savedUser) {
      app.currentUser = JSON.parse(savedUser);
      if (app.currentUser.role === 'admin') {
        app.showScreen('screen-admin-menu');
      } else {
        app.setupTeacherDashboard();
      }
    } else {
      app.showScreen('screen-login');
    }

    app.setupAuthListeners();
    app.setupEventListeners();
  },

  // ==========================================
  // 2. EKRANLARNI ALMASHTIRISH VA NAVIGATSIYA
  // ==========================================
  showScreen: (screenId) => {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
      screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    targetScreen.classList.remove('hidden');
    
    setTimeout(() => {
      targetScreen.classList.add('active');
    }, 10);

    // Header tugmalarini boshqarish
    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (screenId === 'screen-login' || screenId.includes('setup')) {
      backBtn.classList.add('hidden');
      logoutBtn.classList.add('hidden');
    } else if (screenId === 'screen-admin-menu' || screenId === 'screen-teacher-menu') {
      backBtn.classList.add('hidden');
      logoutBtn.classList.remove('hidden');
    } else {
      backBtn.classList.remove('hidden');
      logoutBtn.classList.remove('hidden');
    }
  },

  handleBackBtn: () => {
    if (app.currentUser?.role === 'admin') {
      app.showScreen('screen-admin-menu');
    } else if (app.currentUser?.role === 'teacher') {
      app.showScreen('screen-teacher-menu');
    } else {
      app.showScreen('screen-login');
    }
  },

  logout: () => {
    // Tizimdan chiqish tasdig'i
    tg.showConfirm("Haqiqatan ham tizimdan chiqmoqchimisiz?", (confirm) => {
      if(confirm) {
        localStorage.removeItem('leCrayonUser');
        app.currentUser = null;
        document.getElementById('form-login').reset();
        app.showScreen('screen-login');
      }
    });
  },

  toggleLoader: (show) => {
    const loader = document.getElementById('loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
  },

  // ==========================================
  // 3. AVTORIZATSIYA (LOGIN & SETUP)
  // ==========================================
  setupAuthListeners: () => {
    // Login formasi
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value;
      const passVal = document.getElementById('login-password').value;

      app.toggleLoader(true);
      const res = await API.login(userVal, passVal);
      app.toggleLoader(false);

      if (res.success) {
        if (res.isFirstLogin) {
          if (res.role === 'admin') app.showScreen('screen-setup-admin');
          if (res.role === 'teacher') {
            app.loadClassesForTeacherSetup();
            app.showScreen('screen-setup-teacher');
          }
        } else {
          app.currentUser = res.user;
          localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
          if (res.user.role === 'admin') app.showScreen('screen-admin-menu');
          else app.setupTeacherDashboard();
        }
      } else {
        tg.showAlert(res.error);
      }
    });

    // Admin saqlash formasi
    document.getElementById('form-setup-admin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        fullName: document.getElementById('admin-fullname').value,
        username: document.getElementById('admin-new-login').value,
        password: document.getElementById('admin-new-password').value
      };
      
      app.toggleLoader(true);
      const res = await API.setupAdmin(data);
      app.toggleLoader(false);

      if(res.success) {
        app.currentUser = res.user;
        localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
        app.showScreen('screen-admin-menu');
      } else tg.showAlert(res.error);
    });

    // O'qituvchi rasmini ko'rish (Preview)
    document.getElementById('teacher-photo').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('teacher-preview-photo').src = e.target.result;
        reader.readAsDataURL(file);
      }
    });

    // O'qituvchi profilini saqlash formasi
    document.getElementById('form-setup-teacher').addEventListener('submit', async (e) => {
      e.preventDefault();
      const photoFile = document.getElementById('teacher-photo').files[0];
      if (!photoFile) return tg.showAlert("Iltimos, rasm tanlang!");

      app.toggleLoader(true);
      const photoUrl = await API.uploadImage(photoFile);
      if(!photoUrl) {
        app.toggleLoader(false);
        return tg.showAlert("Rasmni yuklashda xatolik yuz berdi!");
      }

      const sel = document.getElementById('teacher-class-select');
      const data = {
        fullName: document.getElementById('teacher-fullname').value,
        address: document.getElementById('teacher-address').value,
        phone: document.getElementById('teacher-phone').value,
        username: document.getElementById('teacher-new-login').value,
        password: document.getElementById('teacher-new-password').value,
        classId: sel.value,
        className: sel.options[sel.selectedIndex].text,
        photoUrl: photoUrl
      };

      const res = await API.setupTeacher(data);
      app.toggleLoader(false);

      if(res.success) {
        app.currentUser = res.user;
        localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
        app.setupTeacherDashboard();
      } else {
        tg.showAlert(res.error);
      }
    });
  },

  // O'qituvchi profiliga sinflarni yuklash
  loadClassesForTeacherSetup: async () => {
    const res = await API.getClasses();
    if(res.success) {
      const sel = document.getElementById('teacher-class-select');
      sel.innerHTML = '<option value="">O\'z sinfingizni tanlang</option>';
      res.data.forEach(c => sel.innerHTML += `<option value="${c.id}">${c.class_name}</option>`);
    }
  },

  // ==========================================
  // 4. ADMIN FUNKSIYALARI
  // ==========================================
  setupEventListeners: () => {
    // Sinf yaratish
    document.getElementById('form-add-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const className = document.getElementById('class-name').value;

      app.toggleLoader(true);
      const res = await API.createClass(className, app.currentUser.id);
      app.toggleLoader(false);

      if (res.success) {
        tg.showAlert("Sinf muvaffaqiyatli yaratildi!");
        document.getElementById('form-add-class').reset();
        app.showScreen('screen-admin-menu');
      } else tg.showAlert("Xatolik: " + res.error);
    });

    // O'quvchi rasmini ko'rish (Preview)
    document.getElementById('student-photo').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('preview-photo').src = e.target.result;
        reader.readAsDataURL(file);
      }
    });

    // O'quvchi qo'shish
    document.getElementById('form-add-student').addEventListener('submit', app.submitNewStudent);
  },

  // O'qituvchilarni ko'rish
  loadTeachers: async () => {
    app.toggleLoader(true);
    const res = await API.getTeachers();
    app.toggleLoader(false);

    if(res.success) {
      const cont = document.getElementById('teachers-container');
      cont.innerHTML = '';
      if(res.data.length === 0) cont.innerHTML = "<p>O'qituvchilar hali yo'q.</p>";

      res.data.forEach(t => {
        cont.innerHTML += `
          <div class="student-card">
            <img src="${t.photo_url || 'https://via.placeholder.com/60'}" alt="">
            <div class="info">
              <h4>${t.full_name}</h4>
              <p><i class="fa-solid fa-users"></i> Sinf: ${t.class_name}</p>
              <p><i class="fa-solid fa-phone"></i> ${t.phone}</p>
              <p><i class="fa-solid fa-map-marker-alt"></i> ${t.address}</p>
              <span class="badge">Login: ${t.username}</span>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-teachers-list');
    }
  },

  // Sinf ro'yxatini yuklash (O'quvchi qo'shish uchun)
  loadClassesAndShowAddStudent: async () => {
    app.toggleLoader(true);
    const res = await API.getClasses();
    app.toggleLoader(false);

    if (res.success) {
      const select = document.getElementById('student-class');
      select.innerHTML = '<option value="">Sinfni tanlang</option>';
      res.data.forEach(cls => {
        select.innerHTML += `<option value="${cls.id}" data-name="${cls.class_name}">${cls.class_name}</option>`;
      });
      app.showScreen('screen-add-student');
    }
  },

  addCertificateField: () => {
    const container = document.getElementById('certificates-container');
    const div = document.createElement('div');
    div.className = 'certificate-group';
    div.innerHTML = `
      <input type="text" class="cert-name" placeholder="Sertifikat nomi (IELTS, CEFR)">
      <input type="text" class="cert-level" placeholder="Darajasi (B2, C1)">
      <input type="number" class="cert-percent" placeholder="Foizi">
      <button type="button" class="remove-cert-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
      <hr>
    `;
    container.appendChild(div);
  },

  submitNewStudent: async (e) => {
    e.preventDefault();
    const photoFile = document.getElementById('student-photo').files[0];
    if (!photoFile) return tg.showAlert("O'quvchi rasmini tanlang!");

    app.toggleLoader(true);
    const photoUrl = await API.uploadImage(photoFile);
    if (!photoUrl) {
      app.toggleLoader(false);
      return tg.showAlert("Rasmni yuklashda xato!");
    }

    const certificates = [];
    document.querySelectorAll('.certificate-group').forEach(group => {
      certificates.push({
        name: group.querySelector('.cert-name').value,
        level: group.querySelector('.cert-level').value,
        percent: group.querySelector('.cert-percent').value
      });
    });

    const classSelect = document.getElementById('student-class');
    const studentData = {
      fullName: document.getElementById('student-name').value,
      photoUrl: photoUrl,
      classId: classSelect.value,
      className: classSelect.options[classSelect.selectedIndex].getAttribute('data-name'),
      permAddress: document.getElementById('perm-address').value,
      dormAddress: document.getElementById('dorm-address').value,
      parentPhone: document.getElementById('parent-phone').value,
      dormPhone: document.getElementById('dorm-phone').value,
      certificates: certificates
    };

    const res = await API.createStudent(studentData);
    app.toggleLoader(false);

    if (res.success) {
      tg.showAlert("O'quvchi saqlandi!");
      document.getElementById('form-add-student').reset();
      document.getElementById('preview-photo').src = 'https://via.placeholder.com/100?text=Rasm';
      document.getElementById('certificates-container').innerHTML = '';
      app.showScreen('screen-admin-menu');
    } else tg.showAlert(res.error);
  },

  loadAdminReport: async () => {
    app.toggleLoader(true);
    const res = await API.getAllStudents();
    app.toggleLoader(false);

    if (res.success) {
      app.studentsData = res.data;
      app.renderStudentsReport(app.studentsData);
      app.showScreen('screen-admin-report');
    }
  },

  renderStudentsReport: (students) => {
    const container = document.getElementById('report-list');
    container.innerHTML = '';

    students.forEach(st => {
      let certsHtml = st.certificates.map(c => `<span class="badge">${c.name} ${c.level}</span>`).join('');
      container.innerHTML += `
        <div class="student-card">
          <img src="${st.photo_url}" alt="">
          <div class="info">
            <h4>${st.full_name} (${st.class_name})</h4>
            <p><i class="fa-solid fa-house-chimney"></i> ${st.permanent_address}</p>
            <p><i class="fa-solid fa-phone"></i> Ota-ona: ${st.parent_phone}</p>
            <div class="certs">${certsHtml}</div>
            <div class="attendance-stats">
              <span class="sababli">Sababli: ${st.total_absences?.sababli || 0}</span>
              <span class="sababsiz">Sababsiz: ${st.total_absences?.sababsiz || 0}</span>
            </div>
          </div>
        </div>
      `;
    });
  },

  filterStudents: () => {
    const text = document.getElementById('search-student').value.toLowerCase();
    const filtered = app.studentsData.filter(s => s.full_name.toLowerCase().includes(text));
    app.renderStudentsReport(filtered);
  },

  // ==========================================
  // 5. O'QITUVCHI FUNKSIYALARI (DAVOMAT)
  // ==========================================
  setupTeacherDashboard: () => {
    document.getElementById('logged-teacher-photo').src = app.currentUser.photo_url || 'https://via.placeholder.com/100?text=Ustoz';
    document.getElementById('logged-teacher-name').innerText = app.currentUser.full_name;
    document.getElementById('logged-teacher-class').innerText = "Rahbar: " + app.currentUser.class_name;
    
    document.getElementById('btn-start-attendance').onclick = () => {
      app.openAttendanceScreen(app.currentUser.class_id, app.currentUser.class_name);
    };

    app.showScreen('screen-teacher-menu');
  },

  openAttendanceScreen: async (classId, className) => {
    app.currentClassId = classId;
    app.currentClassName = className;
    document.getElementById('attendance-class-title').innerText = className + " - Davomat";

    app.toggleLoader(true);
    const res = await API.getStudentsByClass(classId);
    app.toggleLoader(false);

    if (res.success) {
      const container = document.getElementById('attendance-list');
      container.innerHTML = '';
      
      if(res.data.length === 0) {
        container.innerHTML = '<p>Sinfda o\'quvchilar yo\'q.</p>';
      }

      res.data.forEach(st => {
        container.innerHTML += `
          <div class="attendance-item">
            <div class="student-info-row">
              <img src="${st.photo_url}" alt="">
              <span>${st.full_name}</span>
            </div>
            <div class="radio-group">
              <label class="radio-btn keldi"><input type="radio" name="att_${st.id}" value="keldi" checked> Keldi</label>
              <label class="radio-btn sababli"><input type="radio" name="att_${st.id}" value="sababli"> Sababli</label>
              <label class="radio-btn sababsiz"><input type="radio" name="att_${st.id}" value="sababsiz"> Sababsiz</label>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-attendance');
    }
  },

  submitAttendance: async () => {
    const items = document.querySelectorAll('.attendance-item');
    const records = [];

    items.forEach(item => {
      const radios = item.querySelectorAll('input[type="radio"]');
      let status = 'keldi';
      let studentId = '';
      
      radios.forEach(radio => {
        studentId = radio.name.replace('att_', '');
        if (radio.checked) status = radio.value;
      });

      if (status !== 'keldi') {
        records.push({ studentId, status });
      }
    });

    const attendanceData = {
      classId: app.currentClassId,
      className: app.currentClassName,
      teacherId: app.currentUser.id,
      records: records
    };

    app.toggleLoader(true);
    const res = await API.saveAttendance(attendanceData);
    app.toggleLoader(false);

    if (res.success) {
      tg.showAlert("Davomat muvaffaqiyatli saqlandi!");
      app.showScreen('screen-teacher-menu');
    } else tg.showAlert("Xatolik: " + res.error);
  }
};

// HTML yuklanganda dasturni ishga tushirish
document.addEventListener('DOMContentLoaded', app.init);
