// Telegram Web App obyekti
const tg = window.Telegram.WebApp;

// Dastur obyekti (Barcha funksiyalar shu obyekt ichida saqlanadi)
const app = {
  currentClassId: null,
  currentClassName: null,
  studentsData: [], // Hisobot uchun kesh
  
  // 1. TIZIMNI ISHGA TUSHIRISH
  init: () => {
    tg.ready();
    tg.expand(); // Web App ni to'liq ekranda ochish
    
    // Telegram dizayn ranglarini qo'llash
    document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#000000');

    app.setupEventListeners();
  },

  // 2. EKRANLARNI ALMASHTIRISH VA ORTGA QAYTISH
  showScreen: (screenId) => {
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.add('hidden');
      screen.classList.remove('active');
    });
    
    const targetScreen = document.getElementById(screenId);
    targetScreen.classList.remove('hidden');
    
    // Kichik kechikish bilan animatsiyani ishga tushirish
    setTimeout(() => {
      targetScreen.classList.add('active');
    }, 10);

    // "Ortga" tugmasini boshqarish
    const backBtn = document.getElementById('back-btn');
    if (screenId === 'screen-role') {
      backBtn.classList.add('hidden');
    } else {
      backBtn.classList.remove('hidden');
      backBtn.onclick = () => {
        if (screenId.includes('menu')) app.showScreen('screen-role');
        else if (screenId.includes('add-') || screenId === 'screen-admin-report') app.showScreen('screen-admin-menu');
        else if (screenId === 'screen-attendance') app.showScreen('screen-teacher-menu');
      };
    }

    // O'qituvchi menyusi ochilganda sinflarni yuklash
    if (screenId === 'screen-teacher-menu') {
      app.loadTeacherClasses();
    }
  },

  // YUKLANMOQDA EKRANI
  toggleLoader: (show) => {
    const loader = document.getElementById('loader');
    if (show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
  },

  // ==========================================
  // ADMIN FUNKSIYALARI
  // ==========================================

  // Sinf yaratish
  setupEventListeners: () => {
    // Sinf yaratish formasi
    document.getElementById('form-add-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const className = document.getElementById('class-name').value;
      const teacherId = tg.initDataUnsafe?.user?.id || 'admin';

      app.toggleLoader(true);
      const res = await API.createClass(className, teacherId);
      app.toggleLoader(false);

      if (res.success) {
        tg.showAlert("Sinf muvaffaqiyatli yaratildi!");
        document.getElementById('form-add-class').reset();
        app.showScreen('screen-admin-menu');
      } else {
        tg.showAlert("Xatolik: " + res.error);
      }
    });

    // O'quvchi qo'shish formasi
    document.getElementById('form-add-student').addEventListener('submit', app.submitNewStudent);

    // Rasm oldindan ko'rish (Preview)
    document.getElementById('student-photo').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => document.getElementById('preview-photo').src = e.target.result;
        reader.readAsDataURL(file);
      }
    });
  },

  // Sinf ro'yxatini yuklash va O'quvchi qo'shish ekranini ochish
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

  // Sertifikat formalarini dinamik qo'shish
  addCertificateField: () => {
    const container = document.getElementById('certificates-container');
    const div = document.createElement('div');
    div.className = 'certificate-group';
    div.innerHTML = `
      <input type="text" class="cert-name" placeholder="Fan / Nom (masalan, IELTS)">
      <input type="text" class="cert-level" placeholder="Daraja (masalan, B2)">
      <input type="number" class="cert-percent" placeholder="Foiz / Ball">
      <button type="button" class="remove-cert-btn" onclick="this.parentElement.remove()"><i class="fa-solid fa-trash"></i></button>
      <hr>
    `;
    container.appendChild(div);
  },

  // Yangi o'quvchini saqlash (Rasm ImgBB ga, ma'lumotlar Backend ga)
  submitNewStudent: async (e) => {
    e.preventDefault();
    
    const photoFile = document.getElementById('student-photo').files[0];
    if (!photoFile) return tg.showAlert("Iltimos, o'quvchi rasmini tanlang!");

    app.toggleLoader(true);

    // 1. Rasmni ImgBB ga yuklash
    const photoUrl = await API.uploadImage(photoFile);
    if (!photoUrl) {
      app.toggleLoader(false);
      return tg.showAlert("Rasmni yuklashda xatolik yuz berdi!");
    }

    // 2. Sertifikatlarni yig'ish
    const certificates = [];
    document.querySelectorAll('.certificate-group').forEach(group => {
      certificates.push({
        name: group.querySelector('.cert-name').value,
        level: group.querySelector('.cert-level').value,
        percent: group.querySelector('.cert-percent').value
      });
    });

    const classSelect = document.getElementById('student-class');
    
    // 3. Ma'lumotlarni yig'ish
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

    // 4. Serverga jo'natish
    const res = await API.createStudent(studentData);
    app.toggleLoader(false);

    if (res.success) {
      tg.showAlert("O'quvchi muvaffaqiyatli saqlandi!");
      document.getElementById('form-add-student').reset();
      document.getElementById('preview-photo').src = 'https://via.placeholder.com/100?text=Rasm';
      document.getElementById('certificates-container').innerHTML = '';
      app.showScreen('screen-admin-menu');
    } else {
      tg.showAlert("Xatolik yuz berdi: " + res.error);
    }
  },

  // Admin hisobotini yuklash
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
          <img src="${st.photo_url}" alt="${st.full_name}">
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
  // O'QITUVCHI FUNKSIYALARI
  // ==========================================

  loadTeacherClasses: async () => {
    app.toggleLoader(true);
    const res = await API.getClasses();
    app.toggleLoader(false);

    if (res.success) {
      const container = document.getElementById('teacher-classes-list');
      container.innerHTML = '';
      res.data.forEach(cls => {
        container.innerHTML += `
          <div class="menu-card" onclick="app.openAttendanceScreen('${cls.id}', '${cls.class_name}')">
            <i class="fa-solid fa-users-viewfinder"></i>
            <h3>${cls.class_name}</h3>
          </div>
        `;
      });
    }
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
        container.innerHTML = '<p>Bu sinfda o\'quvchilar yo\'q.</p>';
      }

      res.data.forEach(st => {
        container.innerHTML += `
          <div class="attendance-item">
            <div class="student-info-row">
              <img src="${st.photo_url}" alt="${st.full_name}">
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
      teacherId: tg.initDataUnsafe?.user?.id || 'unknown',
      records: records
    };

    app.toggleLoader(true);
    const res = await API.saveAttendance(attendanceData);
    app.toggleLoader(false);

    if (res.success) {
      tg.showAlert("Davomat muvaffaqiyatli saqlandi!");
      app.showScreen('screen-teacher-menu');
    } else {
      tg.showAlert("Xatolik: " + res.error);
    }
  }
};

// HTML yuklanganda dasturni boshlash
document.addEventListener('DOMContentLoaded', app.init);
