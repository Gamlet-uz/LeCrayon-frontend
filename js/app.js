const tg = window.Telegram.WebApp;

const app = {
  currentUser: null,
  currentAdminClassView: [], 
  teacherStudentsData: [], 
  adminMonitoringData: [], 
  currentAdminSearchData: [], // Qidiruv natijalarini saqlash uchun
  chartInstance: null, 
  searchTimeout: null,
  
  // NAVIGATSIYA TARIXI
  historyStack: [],
  currentScreen: '',

  init: () => {
    tg.ready(); tg.expand();
    document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#000000');

    const savedUser = localStorage.getItem('leCrayonUser');
    if (savedUser) {
      app.currentUser = JSON.parse(savedUser);
      app.routeUser();
    } else {
      app.showScreen('screen-login', false);
    }
    
    app.setupAuthListeners();
    app.setupTeacherListeners();
    app.setupProfileListeners();
    app.setupAdminListeners();
  },

  routeUser: () => {
    app.historyStack = []; 
    if (app.currentUser.role === 'admin') app.showScreen('screen-admin-menu', false);
    else app.setupTeacherDashboard();
  },

  showScreen: (screenId, pushToHistory = true) => {
    if (pushToHistory && app.currentScreen && app.currentScreen !== screenId) {
      app.historyStack.push(app.currentScreen);
    }
    
    document.querySelectorAll('.screen').forEach(s => { 
      s.classList.add('hidden'); s.classList.remove('active'); 
    });
    
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 10);
    app.currentScreen = screenId;

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

  goBack: () => {
    if (app.historyStack.length > 0) {
      const prevScreen = app.historyStack.pop();
      app.showScreen(prevScreen, false);
    } else {
      app.routeUser();
    }
  },

  logout: () => {
    tg.showConfirm("Haqiqatan ham tizimdan chiqmoqchimisiz?", (confirm) => {
      if(confirm) {
        localStorage.removeItem('leCrayonUser');
        app.currentUser = null;
        app.historyStack = [];
        document.getElementById('form-login').reset();
        app.showScreen('screen-login', false);
      }
    });
  },

  toggleLoader: (show) => { document.getElementById('loader').classList[show ? 'remove' : 'add']('hidden'); },

  // =====================================
  // AVTORIZATSIYA VA SETUP
  // =====================================
  setupAuthListeners: () => {
    const telegramId = tg.initDataUnsafe?.user?.id || null;

    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value;
      const passVal = document.getElementById('login-password').value;
      
      app.toggleLoader(true);
      const res = await API.login(userVal, passVal, telegramId);
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
      app.toggleLoader(true);
      const res = await API.setupAdmin({
        fullName: document.getElementById('admin-fullname').value,
        username: document.getElementById('admin-new-login').value,
        password: document.getElementById('admin-new-password').value,
        telegramId: telegramId
      });
      app.toggleLoader(false);
      if(res.success) { app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user)); app.routeUser(); } 
      else tg.showAlert(res.error);
    });

    document.getElementById('teacher-photo').addEventListener('change', (e) => app.previewImage(e, 'teacher-preview-photo'));

    document.getElementById('form-setup-teacher').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('teacher-photo').files[0];
      
      app.toggleLoader(true);
      let photoUrl = '';
      if (file) {
        photoUrl = await API.uploadImage(file);
        if(!photoUrl) return app.toggleLoader(false); // Rasm yuklash xatoligi bo'lsa
      }

      const res = await API.setupTeacher({
        fullName: document.getElementById('teacher-fullname').value, address: document.getElementById('teacher-address').value,
        phone: document.getElementById('teacher-phone').value, username: document.getElementById('teacher-new-login').value,
        password: document.getElementById('teacher-new-password').value, photoUrl: photoUrl, telegramId: telegramId
      });
      app.toggleLoader(false);
      if(res.success) { app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user)); app.routeUser(); } 
      else tg.showAlert(res.error);
    });
  },

  // =====================================
  // O'QITUVCHI - ASOSIY PANEL VA SINFLAR
  // =====================================
  setupTeacherDashboard: () => {
    document.getElementById('menu-teacher-photo').src = app.currentUser.photo_url || 'https://via.placeholder.com/100';
    document.getElementById('menu-teacher-name').innerText = app.currentUser.full_name;
    
    const hasClass = !!app.currentUser.class_id;
    document.getElementById('menu-teacher-class').innerText = hasClass ? `Sinf: ${app.currentUser.class_name}` : "Sinf yaratilmagan";
    
    document.getElementById('btn-t-add-class').style.display = hasClass ? 'none' : 'block';
    document.getElementById('btn-t-my-class').style.display = hasClass ? 'block' : 'none';

    app.showScreen('screen-teacher-menu', false);
  },

  openMyClassMenu: () => {
    document.getElementById('my-class-title-text').innerText = `Sinf: ${app.currentUser.class_name}`;
    app.showScreen('screen-teacher-my-class');
  },

  openEditClass: () => {
    document.getElementById('t-edit-class-name').value = app.currentUser.class_name;
    app.showScreen('screen-t-edit-class');
  },

  setupTeacherListeners: () => {
    document.getElementById('form-t-add-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      app.toggleLoader(true);
      const res = await API.createClass(document.getElementById('t-class-name').value, app.currentUser.id);
      app.toggleLoader(false);
      if(res.success) {
        app.currentUser.class_id = res.classId; app.currentUser.class_name = res.className;
        localStorage.setItem('leCrayonUser', JSON.stringify(app.currentUser));
        tg.showAlert("Sinf muvaffaqiyatli yaratildi!");
        app.setupTeacherDashboard();
      }
    });

    document.getElementById('form-t-edit-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('t-edit-class-name').value;
      app.toggleLoader(true);
      const res = await API.editClass(app.currentUser.class_id, name, app.currentUser.id);
      app.toggleLoader(false);
      if(res.success) {
        app.currentUser.class_name = name;
        localStorage.setItem('leCrayonUser', JSON.stringify(app.currentUser));
        tg.showAlert("Sinf nomi yangilandi!");
        app.goBack();
      }
    });

    document.getElementById('t-student-photo').addEventListener('change', (e) => app.previewImage(e, 't-preview-photo'));
    document.getElementById('edit-st-photo').addEventListener('change', (e) => app.previewImage(e, 'edit-st-preview-photo'));

    document.getElementById('form-t-add-student-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('t-student-photo').files[0];
      
      app.toggleLoader(true);
      let photoUrl = '';
      if (file) {
        photoUrl = await API.uploadImage(file);
        if(!photoUrl) return app.toggleLoader(false);
      }

      const data = {
        full_name: document.getElementById('t-st-name').value, photoUrl: photoUrl,
        class_id: app.currentUser.class_id, class_name: app.currentUser.class_name,
        permanent_address: document.getElementById('t-st-perm').value, dormitory_address: document.getElementById('t-st-dorm').value,
        parent_phone: document.getElementById('t-st-parent').value, dormitory_phone: document.getElementById('t-st-dormphone').value,
        certificates: app.gatherCertificates('t-certs-container')
      };

      const res = await API.createStudent(data);
      app.toggleLoader(false);
      if(res.success) {
        tg.showAlert("O'quvchi qo'shildi!");
        document.getElementById('form-t-add-student-manual').reset();
        document.getElementById('t-preview-photo').src = 'https://via.placeholder.com/100?text=Rasm';
        document.getElementById('t-certs-container').innerHTML = '';
        app.goBack();
      }
    });

    document.getElementById('form-t-add-student-excel').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('excel-file').files[0];
      if (!file) return tg.showAlert("Excel faylini tanlang!");
      
      app.toggleLoader(true);
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1}); 
          
          let studentsList = [];
          for(let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if(r.length === 0 || !r[0]) continue; 
            
            let certs = [];
            // Excelda 5 tagacha sertifikatni o'qish imkoniyati (Har biri 3 ustundan)
            if(r[5]) certs.push({ name: String(r[5] || ''), level: String(r[6] || ''), percent: String(r[7] || '') });
            if(r[8]) certs.push({ name: String(r[8] || ''), level: String(r[9] || ''), percent: String(r[10] || '') });
            if(r[11]) certs.push({ name: String(r[11] || ''), level: String(r[12] || ''), percent: String(r[13] || '') });
            if(r[14]) certs.push({ name: String(r[14] || ''), level: String(r[15] || ''), percent: String(r[16] || '') });
            if(r[17]) certs.push({ name: String(r[17] || ''), level: String(r[18] || ''), percent: String(r[19] || '') });

            studentsList.push({
              full_name: String(r[0] || ''),
              permanent_address: String(r[1] || ''),
              dormitory_address: String(r[2] || ''),
              parent_phone: String(r[3] || ''),
              dormitory_phone: String(r[4] || ''),
              certificates: certs
            });
          }

          if(studentsList.length === 0) { app.toggleLoader(false); return tg.showAlert("Excel faylda ma'lumot topilmadi!"); }

          const res = await API.bulkCreateStudents(studentsList, app.currentUser.class_id, app.currentUser.class_name);
          app.toggleLoader(false);
          if (res.success) {
            tg.showAlert(`${res.count} nafar o'quvchi muvaffaqiyatli yuklandi!`);
            document.getElementById('form-t-add-student-excel').reset();
            app.goBack();
          } else { tg.showAlert(res.error || "Xatolik yuz berdi"); }
        } catch (error) {
          app.toggleLoader(false); tg.showAlert("Faylni o'qishda xatolik: " + error.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });

    document.getElementById('form-t-edit-student').addEventListener('submit', async (e) => {
      e.preventDefault();
      const stId = document.getElementById('edit-st-id').value;
      const file = document.getElementById('edit-st-photo').files[0];
      
      app.toggleLoader(true);
      let photoUrl = document.getElementById('edit-st-preview-photo').src;
      if (file) {
        const newUrl = await API.uploadImage(file);
        if (newUrl) photoUrl = newUrl;
      }

      const data = {
        full_name: document.getElementById('edit-st-name').value, photo_url: photoUrl,
        permanent_address: document.getElementById('edit-st-perm').value, dormitory_address: document.getElementById('edit-st-dorm').value,
        parent_phone: document.getElementById('edit-st-parent').value, dormitory_phone: document.getElementById('edit-st-dormphone').value,
        certificates: app.gatherCertificates('edit-st-certs-container')
      };

      const res = await API.updateStudent(stId, data);
      app.toggleLoader(false);
      if(res.success) {
        tg.showAlert("O'quvchi ma'lumotlari yangilandi!");
        app.goBack(); 
        app.loadTeacherStudents(); 
      }
    });
  },

  switchStudentTab: (tab) => {
    document.getElementById('tab-manual').classList.remove('active');
    document.getElementById('tab-excel').classList.remove('active');
    document.getElementById('form-t-add-student-manual').classList.add('hidden');
    document.getElementById('form-t-add-student-excel').classList.add('hidden');
    
    document.getElementById(`tab-${tab}`).classList.add('active');
    document.getElementById(`form-t-add-student-${tab}`).classList.remove('hidden');
  },

  loadTeacherStudents: async () => {
    app.toggleLoader(true);
    const res = await API.getStudentsByClass(app.currentUser.class_id);
    app.toggleLoader(false);
    
    if(res.success) {
      app.teacherStudentsData = res.data;
      const c = document.getElementById('t-students-list'); c.innerHTML = '';
      if(res.data.length === 0) return c.innerHTML = "<p style='text-align:center;'>O'quvchilar yo'q.</p>";

      res.data.forEach(st => {
        c.innerHTML += `
          <div class="student-card" onclick="app.showStudentDetails('${st.id}', 'teacher')">
            <img src="${st.photo_url}" alt="">
            <div class="info">
              <h4>${st.full_name}</h4>
              <p><i class="fa-solid fa-phone"></i> Tel: ${st.parent_phone}</p>
            </div>
            <div class="student-actions">
              <button type="button" class="icon-action-btn edit" onclick="event.stopPropagation(); app.openEditStudent('${st.id}')">
                <i class="fa-solid fa-pen"></i>
              </button>
              <button type="button" class="icon-action-btn delete" onclick="event.stopPropagation(); app.deleteStudent('${st.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-t-students');
    }
  },

  openEditStudent: (id) => {
    const st = app.teacherStudentsData.find(s => s.id === id);
    if(!st) return;

    document.getElementById('edit-st-id').value = st.id;
    document.getElementById('edit-st-preview-photo').src = st.photo_url;
    document.getElementById('edit-st-name').value = st.full_name;
    document.getElementById('edit-st-perm').value = st.permanent_address;
    document.getElementById('edit-st-dorm').value = st.dormitory_address || '';
    document.getElementById('edit-st-parent').value = st.parent_phone;
    document.getElementById('edit-st-dormphone').value = st.dormitory_phone || '';
    
    const certBox = document.getElementById('edit-st-certs-container'); certBox.innerHTML = '';
    if(st.certificates && st.certificates.length > 0) {
      st.certificates.forEach(c => app.addCertificateField('edit-st-certs-container', c.name, c.level, c.percent));
    }
    app.showScreen('screen-t-edit-student');
  },

  deleteStudent: (id) => {
    tg.showConfirm("Haqiqatan ham o'chirib yubormoqchimisiz?", async (confirm) => {
      if(confirm) {
        app.toggleLoader(true);
        const res = await API.deleteStudent(id);
        app.toggleLoader(false);
        if(res.success) { tg.showAlert("O'quvchi o'chirildi!"); app.loadTeacherStudents(); }
      }
    });
  },

  // =====================================
  // DAVOMAT QILISH (KECH KELDI BILAN)
  // =====================================
  openAttendance: async () => {
    app.toggleLoader(true);
    const res = await API.getStudentsByClass(app.currentUser.class_id);
    app.toggleLoader(false);
    
    if(res.success) {
      const c = document.getElementById('attendance-list'); c.innerHTML = '';
      if(res.data.length === 0) {
        c.innerHTML = "<p style='text-align:center;'>O'quvchilar ro'yxati bo'sh.</p>";
      } else {
        res.data.forEach(st => {
          c.innerHTML += `
            <div class="attendance-item" id="att-box-${st.id}">
              <div class="student-info-row"><img src="${st.photo_url}" alt=""><span>${st.full_name}</span></div>
              <div class="radio-group">
                <label class="radio-btn keldi"><input type="radio" name="att_${st.id}" value="keldi" checked onchange="app.toggleComment('${st.id}')"> Keldi</label>
                <label class="radio-btn kech_keldi"><input type="radio" name="att_${st.id}" value="kech_keldi" onchange="app.toggleComment('${st.id}')"> Kech</label>
                <label class="radio-btn sababli"><input type="radio" name="att_${st.id}" value="sababli" onchange="app.toggleComment('${st.id}')"> Sababli</label>
                <label class="radio-btn sababsiz"><input type="radio" name="att_${st.id}" value="sababsiz" onchange="app.toggleComment('${st.id}')"> Sababsiz</label>
              </div>
              <input type="text" id="comment_${st.id}" class="comment-input custom-form" placeholder="Izoh yozing (majburiy emas)..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);">
            </div>
          `;
        });
      }
      document.getElementById('att-class-title').innerText = `${app.currentUser.class_name} - Davomat`;
      app.showScreen('screen-attendance');
    }
  },

  toggleComment: (id) => {
    const box = document.getElementById(`att-box-${id}`);
    const r = document.querySelector(`input[name="att_${id}"]:checked`).value;
    // Keldi'dan tashqari hamma holatda izoh ochiladi
    if(r !== 'keldi') box.classList.add('show-comment');
    else box.classList.remove('show-comment');
  },

  submitAttendance: async () => {
    const items = document.querySelectorAll('.attendance-item');
    if(items.length === 0) return tg.showAlert("Davomat qilish uchun o'quvchilar yo'q!");

    const records = [];
    items.forEach(item => {
      const id = item.id.replace('att-box-', '');
      const status = document.querySelector(`input[name="att_${id}"]:checked`).value;
      const comment = document.getElementById(`comment_${id}`).value;
      if (status !== 'keldi') records.push({ studentId: id, status, comment: comment || '' });
    });

    app.toggleLoader(true);
    const res = await API.saveAttendance({
      classId: app.currentUser.class_id, className: app.currentUser.class_name, teacherId: app.currentUser.id,
      date: new Date().toISOString().split('T')[0], records
    });
    app.toggleLoader(false);
    if(res.success) { tg.showAlert("Davomat saqlandi!"); app.goBack(); }
  },

  // =====================================
  // ADMIN BO'LIMI VA MONITORING
  // =====================================
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
                <span class="badge red">Kelmagan/Kech: ${cls.absent}</span>
              </div>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-admin-classes');
    }
  },

  adminOpenClass: async (classId, className) => {
    app.toggleLoader(true);
    const res = await API.getStudentsByClass(classId);
    app.toggleLoader(false);
    
    if(res.success) {
      app.currentAdminClassView = res.data;
      document.getElementById('admin-class-title').innerText = `${className} O'quvchilari`;
      
      const date = new Date().toISOString().split('T')[0];
      const mon = await API.getMonitoring(date);
      const absentIds = mon.success ? mon.data.map(m => m.id) : [];

      const c = document.getElementById('admin-class-students'); c.innerHTML = '';
      res.data.forEach(st => {
        const isAbsent = absentIds.includes(st.id);
        c.innerHTML += `
          <div class="student-card ${isAbsent ? 'absent-border' : ''}" style="cursor:pointer;" onclick="app.showStudentDetails('${st.id}', 'admin')">
            <img src="${st.photo_url}" alt="">
            <div class="info">
              <h4>${st.full_name}</h4>
              <p><i class="fa-solid fa-phone"></i> Tel: ${st.parent_phone}</p>
            </div>
          </div>
        `;
      });
      app.showScreen('screen-admin-class-details');
    }
  },

  adminLoadTeachers: async () => {
    app.toggleLoader(true);
    const res = await API.getTeachers();
    app.toggleLoader(false);
    if(res.success) {
      app.teacherStudentsData = res.data; 
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

  adminLoadMonitoring: async () => {
    let dateInput = document.getElementById('monitoring-date');
    if(!dateInput.value) dateInput.value = new Date().toISOString().split('T')[0];
    
    app.toggleLoader(true);
    const res = await API.getMonitoring(dateInput.value);
    app.toggleLoader(false);

    if(res.success) {
      app.adminMonitoringData = res.data; 
      app.renderChart(res.stats);
      
      document.getElementById('admin-monitoring-list').innerHTML = '';
      document.getElementById('monitoring-list-title').style.display = 'none';

      app.showScreen('screen-admin-monitoring');
    }
  },

  renderChart: (stats) => {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    if (app.chartInstance) app.chartInstance.destroy(); 

    app.chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Kelganlar', 'Sababli', 'Sababsiz', 'Kech keldi'],
        datasets: [{
          data: [stats.keldi, stats.sababli, stats.sababsiz, stats.kech_keldi || 0],
          backgroundColor: ['#34c759', '#ff9500', '#ff3b30', '#007aff'],
          borderWidth: 2,
          hoverOffset: 5
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          title: { display: true, text: `Jami o'quvchi: ${stats.total}` }
        },
        onClick: (event, elements) => {
          if (elements.length > 0) {
            const index = elements[0].index;
            let filterStatus = ['keldi', 'sababli', 'sababsiz', 'kech_keldi'][index];
            app.filterMonitoringList(filterStatus);
          }
        }
      }
    });
  },

  filterMonitoringList: (status) => {
    const c = document.getElementById('admin-monitoring-list'); c.innerHTML = '';
    const title = document.getElementById('monitoring-list-title');
    title.style.display = 'block';
    
    if (status === 'keldi') {
      title.innerText = "Kelganlar ro'yxati bu yerda ko'rsatilmaydi.";
      return;
    }

    const filtered = app.adminMonitoringData.filter(st => st.status === status);
    if(filtered.length === 0) {
      title.innerText = `Bu toifada (${status.replace('_', ' ')}) o'quvchilar yo'q.`;
      return;
    }

    title.innerText = `${status.replace('_', ' ').toUpperCase()} o'quvchilar ro'yxati:`;
    filtered.forEach(st => {
      let bClass = status === 'sababli' ? 'warning' : (status === 'kech_keldi' ? 'blue' : 'red');
      c.innerHTML += `
        <div class="student-card absent-border" style="${status==='kech_keldi'?'border-color:var(--info);background:rgba(0,122,255,0.05);':''}">
          <img src="${st.photo_url || 'https://via.placeholder.com/60'}" alt="">
          <div class="info">
            <h4>${st.full_name} (${st.class_name})</h4>
            <p><i class="fa-solid fa-phone"></i> Tel: ${st.parent_phone}</p>
            <p><span class="badge ${bClass}">${st.status.replace('_', ' ').toUpperCase()}</span> ${st.comment ? '- ' + st.comment : ''}</p>
          </div>
        </div>
      `;
    });
  },

  // =====================================
  // QIDIRUV (ADMIN)
  // =====================================
  searchStudents: (query) => {
    if (app.searchTimeout) clearTimeout(app.searchTimeout);
    
    app.searchTimeout = setTimeout(async () => {
      if(!query.trim()) {
        document.getElementById('admin-search-results').innerHTML = '';
        return;
      }
      
      app.toggleLoader(true);
      const res = await API.searchStudents(query);
      app.toggleLoader(false);
      
      if(res.success) {
        app.currentAdminSearchData = res.data;
        const c = document.getElementById('admin-search-results');
        c.innerHTML = '';
        if(res.data.length === 0) {
          c.innerHTML = '<p style="text-align:center;">Bunday o\'quvchi topilmadi.</p>';
        } else {
          res.data.forEach(st => {
            c.innerHTML += `
              <div class="student-card" style="cursor:pointer;" onclick="app.showStudentDetails('${st.id}', 'search')">
                <img src="${st.photo_url}" alt="">
                <div class="info">
                  <h4>${st.full_name}</h4>
                  <p><i class="fa-solid fa-users"></i> Sinf: ${st.class_name || "Yo'q"}</p>
                </div>
              </div>
            `;
          });
        }
      }
    }, 500); // 500ms dan keyin so'rov jo'natadi (Qotib qolmasligi uchun)
  },

  // =====================================
  // ADMIN SOZLAMALARI VA O'CHIRISHLAR
  // =====================================
  openAdminSettings: async () => {
    app.toggleLoader(true);
    const resSettings = await API.getSettings();
    const resClasses = await API.getClassesStats(new Date().toISOString().split('T')[0]);
    const resTeachers = await API.getTeachers();
    app.toggleLoader(false);
    
    if (resSettings.success && resSettings.time) {
      document.getElementById('reminder-time').value = resSettings.time;
    }
    
    // Selectlarga ma'lumot to'ldirish
    if (resClasses.success) {
      const s1 = document.getElementById('delete-class-select');
      s1.innerHTML = '<option value="">Sinfni tanlang...</option>';
      resClasses.data.forEach(c => s1.innerHTML += `<option value="${c.id}">${c.class_name}</option>`);
    }
    if (resTeachers.success) {
      const s2 = document.getElementById('delete-teacher-select');
      s2.innerHTML = '<option value="">O\'qituvchini tanlang...</option>';
      resTeachers.data.forEach(t => s2.innerHTML += `<option value="${t.id}">${t.full_name} (${t.username})</option>`);
    }

    app.showScreen('screen-admin-settings');
  },

  setupAdminListeners: () => {
    document.getElementById('form-broadcast').addEventListener('submit', async (e) => {
      e.preventDefault();
      const msg = document.getElementById('broadcast-message').value;
      app.toggleLoader(true);
      const res = await API.sendBroadcast(msg);
      app.toggleLoader(false);
      
      if (res.success) {
        tg.showAlert(`${res.count} nafar foydalanuvchiga e'lon yuborildi!`);
        document.getElementById('form-broadcast').reset();
      } else tg.showAlert("Xatolik yuz berdi");
    });

    document.getElementById('form-settings').addEventListener('submit', async (e) => {
      e.preventDefault();
      const time = document.getElementById('reminder-time').value;
      app.toggleLoader(true);
      const res = await API.saveSettings(time);
      app.toggleLoader(false);
      if (res.success) tg.showAlert(`Eslatma vaqti ${time} ga o'zgartirildi!`);
    });

    document.getElementById('form-delete-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const cId = document.getElementById('delete-class-select').value;
      if(!cId) return tg.showAlert("Sinfni tanlang!");
      tg.showConfirm("Ushbu sinfni butunlay o'chirib tashlaysizmi? O'quvchilar sinfsiz qoladi.", async (conf) => {
        if(conf) {
          app.toggleLoader(true);
          const res = await API.deleteClass(cId);
          app.toggleLoader(false);
          if(res.success) { tg.showAlert("Sinf o'chirildi."); app.openAdminSettings(); }
        }
      });
    });

    document.getElementById('form-delete-teacher').addEventListener('submit', async (e) => {
      e.preventDefault();
      const tId = document.getElementById('delete-teacher-select').value;
      if(!tId) return tg.showAlert("O'qituvchini tanlang!");
      tg.showConfirm("O'qituvchini tizimdan o'chirasizmi? U boshqa tizimga kira olmaydi.", async (conf) => {
        if(conf) {
          app.toggleLoader(true);
          const res = await API.deleteTeacher(tId);
          app.toggleLoader(false);
          if(res.success) { tg.showAlert("O'qituvchi o'chirildi."); app.openAdminSettings(); }
        }
      });
    });
  },

  // =====================================
  // PROFIL (TAHRIRLASH)
  // =====================================
  setupProfileListeners: () => {
    document.getElementById('edit-photo').addEventListener('change', (e) => app.previewImage(e, 'edit-preview-photo'));

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
        app.goBack();
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
  // YORDAMCHI FUNKSIYALAR VA MODALLAR
  // =====================================
  previewImage: (e, imgId) => {
    if(e.target.files[0]) {
      const r = new FileReader(); 
      r.onload = (ev) => document.getElementById(imgId).src = ev.target.result;
      r.readAsDataURL(e.target.files[0]);
    }
  },

  addCertificateField: (containerId, name = '', level = '', percent = '') => {
    const c = document.getElementById(containerId);
    if (c.querySelectorAll('.certificate-group').length >= 5) {
      return tg.showAlert("Maksimal 5 ta sertifikat qo'shish mumkin!");
    }

    const div = document.createElement('div'); div.className = 'certificate-group custom-form';
    div.innerHTML = `
      <input type="text" class="cert-name" placeholder="Sertifikat (masalan: IELTS)" value="${name}">
      <input type="text" class="cert-level" placeholder="Daraja (masalan: B2)" value="${level}">
      <input type="number" class="cert-percent" placeholder="Foiz" value="${percent}">
      <button type="button" style="padding:10px; background:var(--danger); color:white; border:none; border-radius:8px;" onclick="this.parentElement.remove()">O'chirish</button>
      <hr style="margin: 10px 0; border:0; height:1px; background:var(--border);">
    `;
    c.appendChild(div);
  },

  gatherCertificates: (containerId) => {
    const certs = [];
    document.getElementById(containerId).querySelectorAll('.certificate-group').forEach(g => {
      certs.push({
        name: g.querySelector('.cert-name').value, 
        level: g.querySelector('.cert-level').value, 
        percent: g.querySelector('.cert-percent').value
      });
    });
    return certs;
  },

  // =====================================
  // DAVOMAT DAFTARCHASI (Tarix)
  // =====================================
  openDiaryModal: async (stId, stName) => {
    app.toggleLoader(true);
    const res = await API.getStudentAttendance(stId);
    app.toggleLoader(false);
    
    if(res.success) {
      document.getElementById('diary-student-name').innerText = `${stName} - Daftarcha`;
      const c = document.getElementById('diary-records-list');
      c.innerHTML = '';
      
      if(res.data.length === 0) {
        c.innerHTML = '<p style="text-align:center;">Bu o\'quvchida dars qoldirish yoki kechikishlar yo\'q.</p>';
      } else {
        res.data.forEach(rec => {
          c.innerHTML += `
            <div class="diary-item ${rec.status}">
              <div class="diary-date-status">
                <span><i class="fa-regular fa-calendar"></i> ${rec.date}</span>
                <span style="text-transform:uppercase;">${rec.status.replace('_', ' ')}</span>
              </div>
              <div class="diary-comment">Izoh: ${rec.comment}</div>
            </div>
          `;
        });
      }
      document.getElementById('diary-modal').classList.remove('hidden');
    }
  },

  closeDiaryModal: () => {
    document.getElementById('diary-modal').classList.add('hidden');
  },

  // O'quvchi to'liq ma'lumoti
  showStudentDetails: (id, context) => {
    let st;
    if(context === 'admin') st = app.currentAdminClassView.find(s => s.id === id);
    else if(context === 'teacher') st = app.teacherStudentsData.find(s => s.id === id);
    else if(context === 'search') st = app.currentAdminSearchData.find(s => s.id === id);
    
    if(!st) return;
    let certs = st.certificates && st.certificates.length > 0 
      ? st.certificates.map(c => `<span class="badge">${c.name} ${c.level} (${c.percent}%)</span>`).join(' ')
      : 'Yo\'q';
    
    document.getElementById('modal-body').innerHTML = `
      <img src="${st.photo_url}" class="modal-info-img" alt="">
      <h3 style="text-align:center; margin-bottom:20px;">${st.full_name}</h3>
      <div class="modal-data-row"><span>Sinf</span> <strong>${st.class_name || 'Sinfsiz'}</strong></div>
      <div class="modal-data-row"><span>Doimiy manzil</span> <strong>${st.permanent_address}</strong></div>
      <div class="modal-data-row"><span>Yotoqxona</span> <strong>${st.dormitory_address || '-'}</strong></div>
      <div class="modal-data-row"><span>Ota-ona telfoni</span> <strong>${st.parent_phone}</strong></div>
      <div class="modal-data-row"><span>Yotoqxona telfoni</span> <strong>${st.dormitory_phone || '-'}</strong></div>
      <div class="modal-data-row" style="flex-direction:column; gap:5px;"><span>Sertifikatlar</span> <div>${certs}</div></div>
      <div class="modal-data-row"><span>Qoldirgan (Sababli)</span> <strong style="color:var(--warning);">${st.total_absences?.sababli || 0} marta</strong></div>
      <div class="modal-data-row"><span>Qoldirgan (Sababsiz)</span> <strong style="color:var(--danger);">${st.total_absences?.sababsiz || 0} marta</strong></div>
      <div class="modal-data-row"><span>Kech qolgan</span> <strong style="color:var(--info);">${st.total_absences?.kech_keldi || 0} marta</strong></div>
      
      <!-- YANGI: Davomat Daftarchasi Tugmasi -->
      <button class="secondary-btn" style="margin-top:20px; width:100%; border:1px solid var(--primary-color);" onclick="app.openDiaryModal('${st.id}', '${st.full_name}')">
        <i class="fa-solid fa-book"></i> Davomat Daftarchasini Ko'rish
      </button>
    `;
    document.getElementById('details-modal').classList.remove('hidden');
  },

  showTeacherDetails: (id) => {
    const t = app.teacherStudentsData.find(s => s.id === id);
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

  closeModal: () => {
    document.getElementById('details-modal').classList.add('hidden');
  }
};

document.addEventListener('DOMContentLoaded', app.init);
