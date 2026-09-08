const tg = window.Telegram.WebApp;

const app = {
  currentUser: null,
  currentAdminClassView: [], // Admin sinf ichidagi o'quvchilarni saqlash uchun
  
  init: () => {
    tg.ready(); tg.expand();
    document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#000000');

    const savedUser = localStorage.getItem('leCrayonUser');
    if (savedUser) {
      // Yangi login qilganda toza ma'lumotlarni tortib olamiz (Keshni chetlab o'tamiz)
      app.currentUser = JSON.parse(savedUser);
      app.routeUser();
    } else {
      app.showScreen('screen-login');
    }
    app.setupAuthListeners();
    app.setupTeacherListeners();
    app.setupProfileListeners();
  },

  routeUser: () => {
    if (app.currentUser.role === 'admin') app.showScreen('screen-admin-menu');
    else app.setupTeacherDashboard();
  },

  showScreen: (screenId) => {
    document.querySelectorAll('.screen').forEach(s => { s.classList.add('hidden'); s.classList.remove('active'); });
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 10);

    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (screenId === 'screen-login' || screenId.includes('setup')) {
      backBtn.classList.add('hidden'); logoutBtn.classList.add('hidden');
    } else if (screenId === 'screen-admin-menu' || screenId === 'screen-teacher-menu') {
      backBtn.classList.add('hidden'); logoutBtn.classList.remove('hidden');
    } else {
      backBtn.classList.remove('hidden'); logoutBtn.classList.add('hidden');
    }
  },

  handleBackBtn: () => app.routeUser(),

  logout: () => {
    tg.showConfirm("Haqiqatan ham chiqmoqchimisiz?", (confirm) => {
      if(confirm) {
        localStorage.removeItem('leCrayonUser');
        app.currentUser = null;
        document.getElementById('form-login').reset();
        app.showScreen('screen-login');
      }
    });
  },

  toggleLoader: (show) => { document.getElementById('loader').classList[show ? 'remove' : 'add']('hidden'); },

  // =====================================
  // AVTORIZATSIYA
  // =====================================
  setupAuthListeners: () => {
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
          if (res.role === 'teacher') app.showScreen('screen-setup-teacher');
        } else {
          app.currentUser = res.user;
          localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
          app.routeUser();
        }
      } else tg.showAlert(res.error);
    });

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
        app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
        app.routeUser();
      } else tg.showAlert(res.error);
    });

    document.getElementById('teacher-photo').addEventListener('change', (e) => {
      if(e.target.files[0]) {
        const r = new FileReader(); r.onload = (ev) => document.getElementById('teacher-preview-photo').src = ev.target.result;
        r.readAsDataURL(e.target.files[0]);
      }
    });

    document.getElementById('form-setup-teacher').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('teacher-photo').files[0];
      if (!file) return tg.showAlert("Rasm tanlang yoki kameradan oling!");
      app.toggleLoader(true);
      const photoUrl = await API.uploadImage(file);
      if(!photoUrl) return app.toggleLoader(false);

      const data = {
        fullName: document.getElementById('teacher-fullname').value,
        address: document.getElementById('teacher-address').value,
        phone: document.getElementById('teacher-phone').value,
        username: document.getElementById('teacher-new-login').value,
        password: document.getElementById('teacher-new-password').value,
        photoUrl: photoUrl
      };
      const res = await API.setupTeacher(data);
      app.toggleLoader(false);
      if(res.success) {
        app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
        app.routeUser();
      } else tg.showAlert(res.error);
    });
  },

  // =====================================
  // PROFIL (TAHRIRLASH)
  // =====================================
  setupProfileListeners: () => {
    document.getElementById('edit-photo').addEventListener('change', (e) => {
      if(e.target.files[0]) {
        const r = new FileReader(); r.onload = (ev) => document.getElementById('edit-preview-photo').src = ev.target.result;
        r.readAsDataURL(e.target.files[0]);
      }
    });

    document.getElementById('form-edit-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      const data = {
        full_name: document.getElementById('edit-fullname').value,
        username: document.getElementById('edit-username').value,
        password: document.getElementById('edit-password').value
      };
      
      if(app.currentUser.role === 'teacher') {
        data.address = document.getElementById('edit-address').value;
        data.phone = document.getElementById('edit-phone').value;
        const file = document.getElementById('edit-photo').files[0];
        if(file) {
          app.toggleLoader(true);
          data.photo_url = await API.uploadImage(file);
          app.toggleLoader(false);
        }
      }

      app.toggleLoader(true);
      const res = await API.updateProfile(app.currentUser.id, data);
      app.toggleLoader(false);

      if(res.success) {
        app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
        tg.showAlert("Profil yangilandi!");
        app.routeUser();
      }
    });
  },

  showProfileEdit: () => {
    document.getElementById('edit-fullname').value = app.currentUser.full_name;
    document.getElementById('edit-username').value = app.currentUser.username;
    document.getElementById('edit-password').value = app.currentUser.password;
    
    if(app.currentUser.role === 'teacher') {
      document.getElementById('edit-photo-box').classList.remove('hidden');
      document.getElementById('edit-preview-photo').src = app.currentUser.photo_url || 'https://via.placeholder.com/100';
      document.getElementById('edit-address').parentElement.classList.remove('hidden');
      document.getElementById('edit-phone').parentElement.classList.remove('hidden');
      document.getElementById('edit-address').value = app.currentUser.address;
      document.getElementById('edit-phone').value = app.currentUser.phone;
    } else {
      document.getElementById('edit-photo-box').classList.add('hidden');
      document.getElementById('edit-address').parentElement.classList.add('hidden');
      document.getElementById('edit-phone').parentElement.classList.add('hidden');
    }
    app.showScreen('screen-profile');
  },

  // =====================================
  // O'QITUVCHI BO'LIMI
  // =====================================
  setupTeacherDashboard: () => {
    document.getElementById('menu-teacher-photo').src = app.currentUser.photo_url || 'https://via.placeholder.com/100';
    document.getElementById('menu-teacher-name').innerText = app.currentUser.full_name;
    
    const hasClass = !!app.currentUser.class_id;
    document.getElementById('menu-teacher-class').innerText = hasClass ? `Sinf: ${app.currentUser.class_name}` : "Sinf yaratilmagan";
    
    document.getElementById('btn-t-add-class').style.display = hasClass ? 'none' : 'block';
    document.getElementById('btn-t-add-student').style.display = hasClass ? 'block' : 'none';
    document.getElementById('btn-t-attendance').style.display = hasClass ? 'block' : 'none';

    app.showScreen('screen-teacher-menu');
  },

  setupTeacherListeners: () => {
    // Sinf yaratish
    document.getElementById('form-t-add-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('t-class-name').value;
      app.toggleLoader(true);
      const res = await API.createClass(name, app.currentUser.id);
      app.toggleLoader(false);
      if(res.success) {
        app.currentUser.class_id = res.classId; app.currentUser.class_name = res.className;
        localStorage.setItem('leCrayonUser', JSON.stringify(app.currentUser));
        tg.showAlert("Sinf yaratildi!");
        app.setupTeacherDashboard();
      }
    });

    // O'quvchi qo'shish rasm
    document.getElementById('t-student-photo').addEventListener('change', (e) => {
      if(e.target.files[0]) {
        const r = new FileReader(); r.onload = (ev) => document.getElementById('t-preview-photo').src = ev.target.result;
        r.readAsDataURL(e.target.files[0]);
      }
    });

    // O'quvchi qo'shish
    document.getElementById('form-t-add-student').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('t-student-photo').files[0];
      if (!file) return tg.showAlert("O'quvchi rasmini yuklang!");
      
      app.toggleLoader(true);
      const url = await API.uploadImage(file);
      if(!url) return app.toggleLoader(false);

      const certs = [];
      document.querySelectorAll('.certificate-group').forEach(g => {
        certs.push({
          name: g.querySelector('.cert-name').value, level: g.querySelector('.cert-level').value, percent: g.querySelector('.cert-percent').value
        });
      });

      const data = {
        fullName: document.getElementById('t-st-name').value, photoUrl: url,
        classId: app.currentUser.class_id, className: app.currentUser.class_name,
        permAddress: document.getElementById('t-st-perm').value, dormAddress: document.getElementById('t-st-dorm').value,
        parentPhone: document.getElementById('t-st-parent').value, dormPhone: document.getElementById('t-st-dormphone').value,
        certificates: certs
      };

      const res = await API.createStudent(data);
      app.toggleLoader(false);
      if(res.success) {
        tg.showAlert("O'quvchi qo'shildi!");
        document.getElementById('form-t-add-student').reset();
        document.getElementById('t-preview-photo').src = 'https://via.placeholder.com/100';
        document.getElementById('t-certs-container').innerHTML = '';
        app.setupTeacherDashboard();
      }
    });
  },

  addCertificateField: () => {
    const c = document.getElementById('t-certs-container');
    const div = document.createElement('div'); div.className = 'certificate-group custom-form';
    div.innerHTML = `
      <input type="text" class="cert-name" placeholder="Sertifikat (IELTS)">
      <input type="text" class="cert-level" placeholder="Daraja (B2)">
      <input type="number" class="cert-percent" placeholder="Foiz">
      <button type="button" style="padding:10px; background:var(--danger); color:white; border:none; border-radius:8px;" onclick="this.parentElement.remove()">O'chirish</button>
      <hr style="margin: 10px 0; border:0; height:1px; background:var(--border);">
    `;
    c.appendChild(div);
  },

  // Davomatni ochish
  openAttendance: async () => {
    app.toggleLoader(true);
    const res = await API.getStudentsByClass(app.currentUser.class_id);
    app.toggleLoader(false);
    if(res.success) {
      const c = document.getElementById('attendance-list'); c.innerHTML = '';
      if(res.data.length === 0) return c.innerHTML = "<p>O'quvchilar yo'q.</p>";
      
      res.data.forEach(st => {
        c.innerHTML += `
          <div class="attendance-item" id="att-box-${st.id}">
            <div class="student-info-row"><img src="${st.photo_url}" alt=""><span>${st.full_name}</span></div>
            <div class="radio-group">
              <label class="radio-btn keldi"><input type="radio" name="att_${st.id}" value="keldi" checked onchange="app.toggleComment('${st.id}')"> Keldi</label>
              <label class="radio-btn sababli"><input type="radio" name="att_${st.id}" value="sababli" onchange="app.toggleComment('${st.id}')"> Sababli</label>
              <label class="radio-btn sababsiz"><input type="radio" name="att_${st.id}" value="sababsiz" onchange="app.toggleComment('${st.id}')"> Sababsiz</label>
            </div>
            <input type="text" id="comment_${st.id}" class="comment-input custom-form" placeholder="Sababini yozing..." style="margin-top:10px; width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);">
          </div>
        `;
      });
      document.getElementById('att-class-title').innerText = `${app.currentUser.class_name} - Davomat`;
      app.showScreen('screen-attendance');
    }
  },

  toggleComment: (id) => {
    const box = document.getElementById(`att-box-${id}`);
    const r = document.querySelector(`input[name="att_${id}"]:checked`).value;
    if(r === 'sababli') box.classList.add('show-comment');
    else box.classList.remove('show-comment');
  },

  submitAttendance: async () => {
    const items = document.querySelectorAll('.attendance-item');
    const records = [];
    items.forEach(item => {
      const id = item.id.replace('att-box-', '');
      const status = document.querySelector(`input[name="att_${id}"]:checked`).value;
      const comment = document.getElementById(`comment_${id}`).value;
      if (status !== 'keldi') records.push({ studentId: id, status, comment: status === 'sababli' ? comment : '' });
    });

    app.toggleLoader(true);
    const res = await API.saveAttendance({
      classId: app.currentUser.class_id, className: app.currentUser.class_name, teacherId: app.currentUser.id,
      date: new Date().toISOString().split('T')[0], records
    });
    app.toggleLoader(false);
    if(res.success) { tg.showAlert("Davomat saqlandi!"); app.setupTeacherDashboard(); }
  },

  // =====================================
  // ADMIN BO'LIMI
  // =====================================
  
  // 1. Sinflar Statistikasi
  adminLoadClasses: async () => {
    const date = new Date().toISOString().split('T')[0];
    app.toggleLoader(true);
    const res = await API.getClassesStats(date);
    app.toggleLoader(false);

    if(res.success) {
      const c = document.getElementById('admin-classes-list'); c.innerHTML = '';
      res.data.forEach(cls => {
        c.innerHTML += `
          <div class="student-card" style="cursor:pointer;" onclick="app.adminOpenClass('${cls.id}', '${cls.class_name}')">
            <div class="info" style="width:100%;">
              <h4>${cls.class_name}</h4>
              <p><i class="fa-solid fa-user-tie"></i> Ustoz: ${cls.teacher_name}</p>
              <div style="margin-top:10px;">
                <span class="badge">Jami: ${cls.total_students}</span>
                <span class="badge green">Keldi: ${cls.present}</span>
                <span class="badge red">Kelmagan: ${cls.absent}</span>
              </div>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-admin-classes');
    }
  },

  // Sinf ustiga bosganda
  adminOpenClass: async (classId, className) => {
    app.toggleLoader(true);
    const res = await API.getStudentsByClass(classId);
    app.toggleLoader(false);
    if(res.success) {
      app.currentAdminClassView = res.data;
      document.getElementById('admin-class-title').innerText = `${className} O'quvchilari`;
      
      // Hozirgi kungi davomatni ham tortib qizil ramkaga olamiz
      const date = new Date().toISOString().split('T')[0];
      const mon = await API.getMonitoring(date);
      const absentIds = mon.success ? mon.data.map(m => m.id) : [];

      const c = document.getElementById('admin-class-students'); c.innerHTML = '';
      res.data.forEach(st => {
        const isAbsent = absentIds.includes(st.id);
        c.innerHTML += `
          <div class="student-card ${isAbsent ? 'absent-border' : ''}" style="cursor:pointer;" onclick="app.showStudentDetails('${st.id}')">
            <img src="${st.photo_url}" alt="">
            <div class="info">
              <h4>${st.full_name}</h4>
              <p><i class="fa-solid fa-phone"></i> Ota-ona: ${st.parent_phone}</p>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-admin-class-details');
    }
  },

  // 2. O'qituvchilar Ro'yxati
  adminLoadTeachers: async () => {
    app.toggleLoader(true);
    const res = await API.getTeachers();
    app.toggleLoader(false);
    if(res.success) {
      app.studentsData = res.data; // kesh
      const c = document.getElementById('admin-teachers-list'); c.innerHTML = '';
      res.data.forEach(t => {
        c.innerHTML += `
          <div class="student-card" style="cursor:pointer;" onclick="app.showTeacherDetails('${t.id}')">
            <img src="${t.photo_url || 'https://via.placeholder.com/100'}" alt="">
            <div class="info">
              <h4>${t.full_name}</h4>
              <p><i class="fa-solid fa-users"></i> Sinf: ${t.class_name || "Yo'q"}</p>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-admin-teachers');
    }
  },

  // 3. Davomat Monitoring
  adminLoadMonitoring: async () => {
    let date = document.getElementById('monitoring-date').value;
    if(!date) {
      date = new Date().toISOString().split('T')[0];
      document.getElementById('monitoring-date').value = date;
    }
    
    app.toggleLoader(true);
    const res = await API.getMonitoring(date);
    app.toggleLoader(false);

    if(res.success) {
      const c = document.getElementById('admin-monitoring-list'); c.innerHTML = '';
      if(res.data.length === 0) c.innerHTML = `<p style="text-align:center; padding:20px;">Bu sanada hamma kelgan.</p>`;
      
      res.data.forEach(st => {
        c.innerHTML += `
          <div class="student-card absent-border">
            <img src="${st.photo_url || 'https://via.placeholder.com/60'}" alt="">
            <div class="info">
              <h4>${st.full_name} (${st.class_name})</h4>
              <p><i class="fa-solid fa-phone"></i> Ota-ona: ${st.parent_phone}</p>
              <p><span class="badge ${st.status === 'sababli' ? 'warning' : 'red'}">${st.status.toUpperCase()}</span> ${st.comment ? ' - ' + st.comment : ''}</p>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-admin-monitoring');
    }
  },

  // =====================================
  // MODALLAR
  // =====================================
  showStudentDetails: (id) => {
    const st = app.currentAdminClassView.find(s => s.id === id);
    if(!st) return;
    let certs = st.certificates.map(c => `<span class="badge">${c.name} ${c.level} (${c.percent}%)</span>`).join(' ');
    
    document.getElementById('modal-body').innerHTML = `
      <img src="${st.photo_url}" class="modal-info-img" alt="">
      <h3 style="text-align:center; margin-bottom:20px;">${st.full_name}</h3>
      <div class="modal-data-row"><span>Sinf</span> <strong>${st.class_name}</strong></div>
      <div class="modal-data-row"><span>Doimiy manzil</span> <strong>${st.permanent_address}</strong></div>
      <div class="modal-data-row"><span>Yotoqxona</span> <strong>${st.dormitory_address || '-'}</strong></div>
      <div class="modal-data-row"><span>Ota-ona telfoni</span> <strong>${st.parent_phone}</strong></div>
      <div class="modal-data-row"><span>Yotoqxona telfoni</span> <strong>${st.dormitory_phone || '-'}</strong></div>
      <div class="modal-data-row" style="flex-direction:column; gap:5px;"><span>Sertifikatlar</span> <div>${certs || 'Yo\'q'}</div></div>
      <div class="modal-data-row"><span>Qoldirgan (Sababli)</span> <strong style="color:var(--warning);">${st.total_absences?.sababli || 0} marta</strong></div>
      <div class="modal-data-row"><span>Qoldirgan (Sababsiz)</span> <strong style="color:var(--danger);">${st.total_absences?.sababsiz || 0} marta</strong></div>
    `;
    document.getElementById('details-modal').classList.remove('hidden');
  },

  showTeacherDetails: (id) => {
    const t = app.studentsData.find(s => s.id === id); // Keshdan olamiz
    document.getElementById('modal-body').innerHTML = `
      <img src="${t.photo_url || 'https://via.placeholder.com/100'}" class="modal-info-img" alt="">
      <h3 style="text-align:center; margin-bottom:20px;">${t.full_name}</h3>
      <div class="modal-data-row"><span>Sinf</span> <strong>${t.class_name || "Biriktirilmagan"}</strong></div>
      <div class="modal-data-row"><span>Telefon</span> <strong>${t.phone}</strong></div>
      <div class="modal-data-row"><span>Yashash manzili</span> <strong>${t.address}</strong></div>
      <div class="modal-data-row"><span>Login</span> <strong>${t.username}</strong></div>
    `;
    document.getElementById('details-modal').classList.remove('hidden');
  },

  closeModal: () => document.getElementById('details-modal').classList.add('hidden')
};

document.addEventListener('DOMContentLoaded', app.init);
