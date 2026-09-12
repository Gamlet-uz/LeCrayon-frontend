const tg = window.Telegram.WebApp;

const app = {
  currentUser: null,
  activeClassId: null,       
  activeClassName: null,     
  teacherClasses: [],        
  currentAdminClassView: [], 
  teacherStudentsData: [], 
  adminMonitoringData: [], 
  currentAdminSearchData: [], 
  chartInstance: null, 
  searchTimeout: null,
  
  // Cropper.js (Rasm kesish)
  cropper: null,
  cropTargetPreviewId: null,
  
  // NAVIGATSIYA
  historyStack: [],
  currentScreen: '',

  init: () => {
    tg.ready(); 
    tg.expand();
    document.documentElement.style.setProperty('--bg-color', tg.themeParams.bg_color || '#ffffff');
    document.documentElement.style.setProperty('--text-color', tg.themeParams.text_color || '#000000');

    // TELEGRAM NATIVE FACE ID INIT (Faqat TG WebApp muhitida ishlaydi)
    if (tg.isVersionAtLeast('7.2')) {
      tg.BiometricManager.init(() => {
        console.log("Telegram Biometrika yoqildi.");
      });
    }

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
    app.setupCropperListeners();
  },

  routeUser: () => {
    app.historyStack = []; 
    if (app.currentUser.role === 'admin') {
      app.showScreen('screen-admin-menu', false);
    } else {
      app.loadTeacherClasses(); 
    }
  },

  showScreen: (screenId, pushToHistory = true) => {
    if (pushToHistory && app.currentScreen && app.currentScreen !== screenId) {
      app.historyStack.push(app.currentScreen);
    }
    
    document.querySelectorAll('.screen').forEach(s => { 
      s.classList.add('hidden'); 
      s.classList.remove('active'); 
    });
    
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 10);
    app.currentScreen = screenId;

    const backBtn = document.getElementById('back-btn');
    const logoutBtn = document.getElementById('logout-btn');

    if (screenId === 'screen-login' || screenId.includes('setup')) {
      backBtn.classList.add('hidden'); 
      logoutBtn.classList.add('hidden');
    } else if (screenId === 'screen-admin-menu' || screenId === 'screen-t-select-class') {
      backBtn.classList.add('hidden'); 
      logoutBtn.classList.remove('hidden');
    } else {
      backBtn.classList.remove('hidden'); 
      logoutBtn.classList.add('hidden');
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

  toggleLoader: (show) => { 
    document.getElementById('loader').classList[show ? 'remove' : 'add']('hidden'); 
  },

  // =====================================
  // YORDAMCHI FUNKSIYALAR (TELEFON RAQAM)
  // =====================================
  formatPhones: (phoneStr) => {
    if (!phoneStr) return '-';
    const phones = String(phoneStr).split(',').map(p => p.trim()).filter(p => p);
    if (phones.length === 0) return '-';
    if (phones.length === 1) return `<strong>${phones[0]}</strong>`;
    
    // Raqamlar ko'p bo'lsa
    let html = `
      <div style="cursor:pointer; display:flex; justify-content:flex-end; align-items:center; gap:5px;" onclick="const el=this.nextElementSibling; el.style.display=el.style.display==='none'?'flex':'none';">
        <strong style="color:var(--primary-color);">${phones[0]}</strong> 
        <span class="badge blue" style="font-size:10px; margin:0; padding:3px 6px;">+${phones.length - 1} ta <i class="fa-solid fa-chevron-down"></i></span>
      </div>
      <div style="display:none; flex-direction:column; gap:5px; margin-top:8px; padding-top:8px; border-top:1px dashed var(--border); text-align:right;">
    `;
    for(let i = 1; i < phones.length; i++) {
       html += `<strong>${phones[i]}</strong>`;
    }
    html += `</div>`;
    return `<div style="width:100%;">${html}</div>`;
  },

  // =====================================
  // AVTORIZATSIYA VA FACE ID (TG NATIVE)
  // =====================================
  setupAuthListeners: () => {
    const telegramId = tg.initDataUnsafe?.user?.id || null;

    // ODDIY LOGIN
    document.getElementById('form-login').addEventListener('submit', async (e) => {
      e.preventDefault();
      const userVal = document.getElementById('login-username').value;
      const passVal = document.getElementById('login-password').value;
      
      try {
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
        } else {
          tg.showAlert(res.error);
        }
      } catch (err) {
        app.toggleLoader(false); 
        tg.showAlert("Tarmoq xatosi yoki server bilan aloqa yo'q.");
      }
    });

    // FACE ID ORQALI LOGIN QILISH
    const faceIdLoginBtn = document.getElementById('btn-faceid-login');
    if (faceIdLoginBtn) {
      faceIdLoginBtn.addEventListener('click', () => {
        if (!tg.isVersionAtLeast('7.2')) {
          return tg.showAlert("Telegram versiyangiz eskirgan (7.2 dan yuqori bo'lishi kerak). Iltimos yangilang.");
        }
        
        if (!tg.BiometricManager.isInited) tg.BiometricManager.init();

        setTimeout(() => {
          if (!tg.BiometricManager.isBiometricAvailable) {
            return tg.showAlert("Sizning qurilmangizda Face ID / Barmoq izi mavjud emas yoki Telegramga ruxsat berilmagan.");
          }

          tg.BiometricManager.authenticate({ reason: "Tizimga kirish uchun yuzingizni ko'rsating (Face ID)" }, async (success, token) => {
            if (success && token) {
              const parts = token.split(':::');
              if (parts.length !== 2) return tg.showAlert("Face ID ma'lumotlari xato saqlangan, iltimos qaytadan ulab ko'ring.");
              
              const username = parts[0];
              const password = parts[1];
              
              try {
                app.toggleLoader(true);
                const res = await API.login(username, password, telegramId);
                app.toggleLoader(false);
                
                if (res.success) {
                  app.currentUser = res.user;
                  localStorage.setItem('leCrayonUser', JSON.stringify(res.user));
                  app.routeUser();
                } else {
                  tg.showAlert("Biometrika orqali kirishda xatolik: " + res.error);
                }
              } catch (err) {
                app.toggleLoader(false);
                tg.showAlert("Tarmoq xatosi: " + err.message);
              }
            } else if (!success) {
              tg.showAlert("Yuzni tanish amaliyoti bekor qilindi yoki xato.");
            }
          });
        }, 300); 
      });
    }

    // FACE ID ULASH / RO'YXATDAN O'TKAZISH
    const registerFaceIdBtn = document.getElementById('btn-register-faceid');
    if(registerFaceIdBtn) {
      registerFaceIdBtn.addEventListener('click', () => {
        if (!tg.isVersionAtLeast('7.2')) return tg.showAlert("Telegram versiyangiz eskirgan. Yangilang!");
        
        if (!tg.BiometricManager.isInited) tg.BiometricManager.init();

        setTimeout(() => {
          if (!tg.BiometricManager.isBiometricAvailable) {
            return tg.showAlert("Qurilmangizda Face ID ishlamayapti yoki ruxsat yo'q!");
          }

          tg.BiometricManager.requestAccess({ reason: "Parolsiz kirish uchun yuzni tanishni faollashtiring" }, (granted) => {
            if (granted) {
              const tokenToSave = `${app.currentUser.username}:::${app.currentUser.password}`;
              tg.BiometricManager.updateBiometricToken(tokenToSave, (updated) => {
                if(updated) {
                  tg.showAlert("✅ Face ID muvaffaqiyatli ulandi! Endi login oynasidan parolsiz kirishingiz mumkin.");
                }
              });
            } else {
              tg.showAlert("Yuzni tanishga ruxsat berilmadi.");
            }
          });
        }, 300);
      });
    }

    // ADMIN SETUP
    document.getElementById('form-setup-admin').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        app.toggleLoader(true);
        const res = await API.setupAdmin({
          fullName: document.getElementById('admin-fullname').value,
          username: document.getElementById('admin-new-login').value,
          password: document.getElementById('admin-new-password').value,
          telegramId: telegramId
        });
        app.toggleLoader(false);
        if(res.success) { app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user)); app.routeUser(); } 
        else { tg.showAlert(res.error); }
      } catch (err) { app.toggleLoader(false); tg.showAlert(err.message); }
    });

    // O'QITUVCHI SETUP
    document.getElementById('form-setup-teacher').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        app.toggleLoader(true);
        const photoBlob = await app.getBlobFromPreview('teacher-preview-photo');
        const photoUrl = photoBlob ? await API.uploadImage(photoBlob) : '';
        const res = await API.setupTeacher({
          fullName: document.getElementById('teacher-fullname').value, 
          address: document.getElementById('teacher-address').value,
          phone: document.getElementById('teacher-phone').value, 
          username: document.getElementById('teacher-new-login').value,
          password: document.getElementById('teacher-new-password').value, 
          photoUrl: photoUrl, 
          telegramId: telegramId
        });
        app.toggleLoader(false);
        if(res.success) { app.currentUser = res.user; localStorage.setItem('leCrayonUser', JSON.stringify(res.user)); app.routeUser(); } 
        else { tg.showAlert(res.error); }
      } catch (err) { app.toggleLoader(false); tg.showAlert(err.message); }
    });
  },

  // =====================================
  // CROPPER VA KAMERA MANTIQI
  // =====================================
  setupCropperListeners: () => {
    const bindCrop = (inputId, previewId) => {
      const el = document.getElementById(inputId);
      if(!el) return;
      
      el.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (ev) => {
            document.getElementById('image-to-crop').src = ev.target.result;
            document.getElementById('crop-modal').classList.remove('hidden');
            
            if (app.cropper) {
              app.cropper.destroy();
            }
            
            app.cropper = new Cropper(document.getElementById('image-to-crop'), {
              aspectRatio: 1, 
              viewMode: 1, 
              dragMode: 'move',
            });
            app.cropTargetPreviewId = previewId;
          };
          reader.readAsDataURL(file);
          e.target.value = ''; 
        }
      });
    };

    bindCrop('teacher-photo', 'teacher-preview-photo');
    bindCrop('t-student-photo-input', 't-preview-photo');
    bindCrop('edit-st-photo-input', 'edit-st-preview-photo');
    bindCrop('edit-photo-input', 'edit-preview-photo');
  },

  closeCropModal: () => {
    document.getElementById('crop-modal').classList.add('hidden');
    if(app.cropper) { 
      app.cropper.destroy(); 
      app.cropper = null; 
    }
  },

  applyCrop: () => {
    if (!app.cropper) return;
    const canvas = app.cropper.getCroppedCanvas({ width: 400, height: 400 });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8); 
    document.getElementById(app.cropTargetPreviewId).src = dataUrl;
    app.closeCropModal();
  },

  // "Failed to fetch" xatosini hal qiluvchi funksiya
  getBlobFromPreview: async (imgId) => {
    try {
      const src = document.getElementById(imgId).src;
      if (src && src.startsWith('data:image')) {
        // Fetch o'rniga base64 dan to'g'ridan-to'g'ri Blob'ga (binar faylga) o'giramiz
        const arr = src.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new Blob([u8arr], {type: mime});
      }
      return null; 
    } catch(err) {
      return null; 
    }
  },

  // =====================================
  // O'QITUVCHI - SINFLAR VA BOSHQARUV
  // =====================================
  loadTeacherClasses: async () => {
    document.getElementById('select-teacher-photo').src = app.currentUser.photo_url || 'https://via.placeholder.com/100';
    document.getElementById('select-teacher-name').innerText = app.currentUser.full_name;

    try {
      app.toggleLoader(true);
      const res = await API.getTeacherClasses(app.currentUser.id);
      app.toggleLoader(false);
      
      if (res.success) {
        app.teacherClasses = res.data;
        const c = document.getElementById('t-class-selection-list');
        c.innerHTML = '';
        if (res.data.length === 0) {
          c.innerHTML = "<p style='text-align:center; color:var(--hint-color); font-size:14px;'>Sizda hozircha sinf yo'q.</p>";
        } else {
          res.data.forEach(cls => {
            c.innerHTML += `
              <div class="menu-card" onclick="app.selectClass('${cls.id}', '${cls.class_name}')" style="border: 2px solid var(--primary-color);">
                <i class="fa-solid fa-users-rectangle"></i>
                <h3>${cls.class_name}</h3>
              </div>
            `;
          });
        }
        app.showScreen('screen-t-select-class', false);
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert("Sinflarni yuklashda xatolik: " + err.message); 
    }
  },

  selectClass: (classId, className) => {
    app.activeClassId = classId;
    app.activeClassName = className;
    document.getElementById('my-class-title-text').innerText = `Sinf: ${className}`;
    app.showScreen('screen-teacher-my-class');
  },

  openEditClass: () => {
    document.getElementById('t-edit-class-name').value = app.activeClassName;
    app.showScreen('screen-t-edit-class');
  },

  setupTeacherListeners: () => {
    document.getElementById('form-t-add-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        app.toggleLoader(true);
        const res = await API.createClass(document.getElementById('t-class-name').value, app.currentUser.id);
        app.toggleLoader(false);
        if(res.success) { 
          tg.showAlert("Sinf yaratildi!"); 
          app.goBack(); 
          app.loadTeacherClasses(); 
        }
      } catch(err) { app.toggleLoader(false); tg.showAlert(err.message); }
    });

    document.getElementById('form-t-edit-class').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('t-edit-class-name').value;
      try {
        app.toggleLoader(true);
        const res = await API.editClass(app.activeClassId, name);
        app.toggleLoader(false);
        if(res.success) { 
          app.activeClassName = name; 
          tg.showAlert("Sinf nomi yangilandi!"); 
          app.goBack(); 
          document.getElementById('my-class-title-text').innerText = `Sinf: ${name}`; 
        }
      } catch(err) { app.toggleLoader(false); tg.showAlert(err.message); }
    });

    // O'QUVCHI QO'SHISH (MANUAL)
    document.getElementById('form-t-add-student-manual').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        app.toggleLoader(true);
        const photoBlob = await app.getBlobFromPreview('t-preview-photo');
        const photoUrl = photoBlob ? await API.uploadImage(photoBlob) : '';

        const data = {
          full_name: document.getElementById('t-st-name').value, 
          photoUrl: photoUrl,
          // SHU IKKITA QATOR O'ZGARTIRILDI: class_id -> classId va class_name -> className
          classId: app.activeClassId, 
          className: app.activeClassName,
          
          permanent_address: document.getElementById('t-st-perm').value, 
          dormitory_address: document.getElementById('t-st-dorm').value,
          parent_phone: document.getElementById('t-st-parent').value, 
          dormitory_phone: document.getElementById('t-st-dormphone').value,
          certificates: app.gatherCertificates('t-certs-container')
        };

        const res = await API.createStudent(data);
        app.toggleLoader(false);
        
        if(res.success) {
          tg.showAlert("O'quvchi muvaffaqiyatli qo'shildi!");
          document.getElementById('form-t-add-student-manual').reset();
          document.getElementById('t-preview-photo').src = 'https://via.placeholder.com/100?text=Rasm';
          document.getElementById('t-certs-container').innerHTML = '';
          app.goBack();
        } else {
          tg.showAlert("Xatolik yuz berdi: " + res.error);
        }
      } catch (err) {
        app.toggleLoader(false); 
        tg.showAlert("Saqlashda xatolik: " + err.message);
      }
    });

    // EXCEL YUKLASH
    document.getElementById('form-t-add-student-excel').addEventListener('submit', async (e) => {
      e.preventDefault();
      const file = document.getElementById('excel-file').files[0];
      if (!file) return tg.showAlert("Iltimos, Excel faylini tanlang!");
      
      app.toggleLoader(true);
      const reader = new FileReader();
      reader.onload = async (ev) => {
        try {
          const data = new Uint8Array(ev.target.result);
          const workbook = XLSX.read(data, {type: 'array'});
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1}); 
          
          let studentsList = [];
          for(let i = 1; i < rows.length; i++) {
            const r = rows[i];
            if(r.length === 0 || !r[0]) continue; 
            
            let certs = [];
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
          if(studentsList.length === 0) { 
            app.toggleLoader(false); 
            return tg.showAlert("Excel faylda o'qish uchun ma'lumot topilmadi!"); 
          }
          const res = await API.bulkCreateStudents(studentsList, app.activeClassId, app.activeClassName);
          app.toggleLoader(false);
          
          if (res.success) {
            tg.showAlert(`${res.count} nafar o'quvchi muvaffaqiyatli yuklandi!`);
            document.getElementById('form-t-add-student-excel').reset();
            app.goBack();
          } else { 
            tg.showAlert(res.error || "Xatolik yuz berdi"); 
          }
        } catch (error) { 
          app.toggleLoader(false); 
          tg.showAlert("Faylni o'qishda xatolik: " + error.message); 
        }
      };
      reader.readAsArrayBuffer(file);
    });

    document.getElementById('form-t-edit-student').addEventListener('submit', async (e) => {
      e.preventDefault();
      const stId = document.getElementById('edit-st-id').value;
      
      try {
        app.toggleLoader(true);
        const photoBlob = await app.getBlobFromPreview('edit-st-preview-photo');
        let photoUrl = document.getElementById('edit-st-preview-photo').src;
        if (photoBlob) {
          const newUrl = await API.uploadImage(photoBlob);
          if (newUrl) photoUrl = newUrl;
        }

        const data = {
          full_name: document.getElementById('edit-st-name').value, 
          photo_url: photoUrl,
          permanent_address: document.getElementById('edit-st-perm').value, 
          dormitory_address: document.getElementById('edit-st-dorm').value,
          parent_phone: document.getElementById('edit-st-parent').value, 
          dormitory_phone: document.getElementById('edit-st-dormphone').value,
          certificates: app.gatherCertificates('edit-st-certs-container')
        };

        const res = await API.updateStudent(stId, data);
        app.toggleLoader(false);
        if(res.success) { 
          tg.showAlert("O'quvchi ma'lumotlari yangilandi!"); 
          app.goBack(); 
          app.loadTeacherStudents(); 
        }
      } catch (err) { 
        app.toggleLoader(false); 
        tg.showAlert("Yangilashda xatolik: " + err.message); 
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
    try {
      app.toggleLoader(true);
      const res = await API.getStudentsByClass(app.activeClassId);
      app.toggleLoader(false);
      
      if(res.success) {
        app.teacherStudentsData = res.data;
        const c = document.getElementById('t-students-list'); 
        c.innerHTML = '';
        
        if(res.data.length === 0) { 
          return c.innerHTML = "<p style='text-align:center;'>Ushbu sinfda o'quvchilar mavjud emas.</p>"; 
        }

        res.data.forEach(st => {
          c.innerHTML += `
            <div class="student-card" onclick="app.showStudentDetails('${st.id}', 'teacher')">
              <img src="${st.photo_url}" alt="">
              <div class="info">
                <h4>${st.full_name}</h4>
                <p><i class="fa-solid fa-phone"></i> Tel: ${String(st.parent_phone).split(',')[0]}</p>
              </div>
              <div class="student-actions">
                <button type="button" class="icon-action-btn edit" onclick="event.stopPropagation(); app.openEditStudent('${st.id}')">
                  <i class="fa-solid fa-pen"></i>
                </button>
                <button type="button" class="icon-action-btn delete" onclick="event.stopPropagation(); app.deleteStudent('${st.id}')">
                  <i class="fa-solid fa-trash"></i>
                </button>
              </div>
            </div>`;
        });
        app.showScreen('screen-t-students');
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert("Yuklashda xatolik: " + err.message); 
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
    
    const certBox = document.getElementById('edit-st-certs-container'); 
    certBox.innerHTML = '';
    
    if(st.certificates && st.certificates.length > 0) {
      st.certificates.forEach(c => app.addCertificateField('edit-st-certs-container', c.name, c.level, c.percent));
    }
    app.showScreen('screen-t-edit-student');
  },

  deleteStudent: (id) => {
    tg.showConfirm("Ushbu o'quvchini o'chirib yubormoqchimisiz?", async (confirm) => {
      if(confirm) {
        try {
          app.toggleLoader(true); 
          const res = await API.deleteStudent(id); 
          app.toggleLoader(false);
          
          if(res.success) { 
            tg.showAlert("O'chirildi!"); 
            app.loadTeacherStudents(); 
          }
        } catch(err) { 
          app.toggleLoader(false); 
          tg.showAlert("Xatolik: " + err.message); 
        }
      }
    });
  },

  // =====================================
  // DAVOMAT QILISH
  // =====================================
  openAttendance: async () => {
    try {
      app.toggleLoader(true);
      const res = await API.getStudentsByClass(app.activeClassId);
      app.toggleLoader(false);
      
      if(res.success) {
        const c = document.getElementById('attendance-list'); 
        c.innerHTML = '';
        
        if(res.data.length === 0) { 
          c.innerHTML = "<p style='text-align:center;'>O'quvchilar yo'q. Avval o'quvchi qo'shing.</p>"; 
        } else {
          res.data.forEach(st => {
            c.innerHTML += `
              <div class="attendance-item" id="att-box-${st.id}">
                <div class="student-info-row">
                  <img src="${st.photo_url}" alt="">
                  <span>${st.full_name}</span>
                </div>
                <div class="radio-group">
                  <label class="radio-btn keldi">
                    <input type="radio" name="att_${st.id}" value="keldi" checked onchange="app.toggleComment('${st.id}')"> Keldi
                  </label>
                  <label class="radio-btn kech_keldi">
                    <input type="radio" name="att_${st.id}" value="kech_keldi" onchange="app.toggleComment('${st.id}')"> Kech
                  </label>
                  <label class="radio-btn sababli">
                    <input type="radio" name="att_${st.id}" value="sababli" onchange="app.toggleComment('${st.id}')"> Sababli
                  </label>
                  <label class="radio-btn sababsiz">
                    <input type="radio" name="att_${st.id}" value="sababsiz" onchange="app.toggleComment('${st.id}')"> Sababsiz
                  </label>
                </div>
                <input type="text" id="comment_${st.id}" class="comment-input custom-form" placeholder="Kechikish yoki sababni yozing..." style="width:100%; padding:10px; border-radius:8px; border:1px solid var(--border);">
              </div>`;
          });
        }
        document.getElementById('att-class-title').innerText = `${app.activeClassName} - Davomat`;
        app.showScreen('screen-attendance');
      }
    } catch (err) { 
      app.toggleLoader(false); 
      tg.showAlert("Xatolik: " + err.message); 
    }
  },

  toggleComment: (id) => {
    const box = document.getElementById(`att-box-${id}`);
    const r = document.querySelector(`input[name="att_${id}"]:checked`).value;
    if(r !== 'keldi') {
      box.classList.add('show-comment'); 
    } else {
      box.classList.remove('show-comment');
    }
  },

  submitAttendance: async () => {
    const items = document.querySelectorAll('.attendance-item');
    if(items.length === 0) return tg.showAlert("Davomat qilish uchun o'quvchilar yo'q!");

    const records = [];
    items.forEach(item => {
      const id = item.id.replace('att-box-', '');
      const status = document.querySelector(`input[name="att_${id}"]:checked`).value;
      const comment = document.getElementById(`comment_${id}`).value;
      if (status !== 'keldi') {
        records.push({ studentId: id, status, comment: comment || '' });
      }
    });

    try {
      app.toggleLoader(true);
      const res = await API.saveAttendance({ 
        classId: app.activeClassId, 
        className: app.activeClassName, 
        teacherId: app.currentUser.id, 
        date: new Date().toISOString().split('T')[0], 
        records 
      });
      app.toggleLoader(false);
      
      if(res.success) { 
        tg.showAlert("Davomat saqlandi!"); 
        app.goBack(); 
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert("Xatolik: " + err.message); 
    }
  },

  // =====================================
  // ADMIN BO'LIMI VA STATISTIKA
  // =====================================
  adminLoadClasses: async () => {
    try {
      app.toggleLoader(true); 
      const res = await API.getClassesStats(new Date().toISOString().split('T')[0]); 
      app.toggleLoader(false);
      
      if(res.success) {
        const c = document.getElementById('admin-classes-list'); 
        c.innerHTML = '';
        
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
            </div>`;
        });
        app.showScreen('screen-admin-classes');
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert(err.message); 
    }
  },

  adminOpenClass: async (classId, className) => {
    try {
      app.toggleLoader(true); 
      const res = await API.getStudentsByClass(classId); 
      app.toggleLoader(false);
      
      if(res.success) {
        app.currentAdminClassView = res.data; 
        document.getElementById('admin-class-title').innerText = `${className} O'quvchilari`;
        
        const mon = await API.getMonitoring(new Date().toISOString().split('T')[0]);
        const absentIds = mon.success ? mon.data.map(m => m.id) : [];

        const c = document.getElementById('admin-class-students'); 
        c.innerHTML = '';
        
        res.data.forEach(st => {
          const isAbsent = absentIds.includes(st.id);
          c.innerHTML += `
            <div class="student-card ${isAbsent ? 'absent-border' : ''}" style="cursor:pointer;" onclick="app.showStudentDetails('${st.id}', 'admin')">
              <img src="${st.photo_url}" alt="">
              <div class="info">
                <h4>${st.full_name}</h4>
                <p><i class="fa-solid fa-phone"></i> Tel: ${String(st.parent_phone).split(',')[0]}</p>
              </div>
            </div>`;
        });
        app.showScreen('screen-admin-class-details');
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert(err.message); 
    }
  },

  adminLoadTeachers: async () => {
    try {
      app.toggleLoader(true); 
      const res = await API.getTeachers(); 
      app.toggleLoader(false);
      
      if(res.success) {
        app.teacherStudentsData = res.data; 
        const c = document.getElementById('admin-teachers-list'); 
        c.innerHTML = '';
        
        res.data.forEach(t => {
          c.innerHTML += `
            <div class="student-card" style="cursor:pointer;" onclick="app.showTeacherDetails('${t.id}')">
              <img src="${t.photo_url || 'https://via.placeholder.com/100'}" alt="">
              <div class="info">
                <h4>${t.full_name}</h4>
                <p><i class="fa-solid fa-users"></i> Sinf: ${t.class_name || "Yo'q"}</p>
              </div>
            </div>`;
        });
        app.showScreen('screen-admin-teachers');
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert(err.message); 
    }
  },

  adminLoadMonitoring: async () => {
    let dateInput = document.getElementById('monitoring-date'); 
    if(!dateInput.value) {
      dateInput.value = new Date().toISOString().split('T')[0];
    }
    
    try {
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
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert(err.message); 
    }
  },

  renderChart: (stats) => {
    const ctx = document.getElementById('attendanceChart').getContext('2d');
    if (app.chartInstance) {
      app.chartInstance.destroy(); 
    }
    
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
            app.filterMonitoringList(['keldi', 'sababli', 'sababsiz', 'kech_keldi'][elements[0].index]); 
          }
        } 
      }
    });
  },

  filterMonitoringList: (status) => {
    const c = document.getElementById('admin-monitoring-list'); 
    c.innerHTML = ''; 
    
    const title = document.getElementById('monitoring-list-title'); 
    title.style.display = 'block';
    
    if (status === 'keldi') {
      return title.innerText = "Kelganlar ro'yxati bu yerda ko'rsatilmaydi.";
    }
    
    const filtered = app.adminMonitoringData.filter(st => st.status === status);
    if(filtered.length === 0) {
      return title.innerText = `Ushbu toifada o'quvchilar yo'q.`;
    }
    
    title.innerText = `${status.toUpperCase()} o'quvchilar ro'yxati:`;
    
    filtered.forEach(st => {
      let bClass = status === 'sababli' ? 'warning' : (status === 'kech_keldi' ? 'blue' : 'red');
      c.innerHTML += `
        <div class="student-card absent-border" style="${status==='kech_keldi'?'border-color:var(--info);background:rgba(0,122,255,0.05);':''}">
          <img src="${st.photo_url || 'https://via.placeholder.com/60'}" alt="">
          <div class="info">
            <h4>${st.full_name} (${st.class_name})</h4>
            <p><i class="fa-solid fa-phone"></i> Tel: ${String(st.parent_phone).split(',')[0]}</p>
            <p><span class="badge ${bClass}">${st.status.toUpperCase()}</span> ${st.comment ? '- ' + st.comment : ''}</p>
          </div>
        </div>`;
    });
  },

  searchStudents: (query) => {
    if (app.searchTimeout) clearTimeout(app.searchTimeout);
    app.searchTimeout = setTimeout(async () => {
      if(!query.trim()) {
        return document.getElementById('admin-search-results').innerHTML = '';
      }
      
      try {
        app.toggleLoader(true); 
        const res = await API.searchStudents(query); 
        app.toggleLoader(false);
        
        if(res.success) {
          app.currentAdminSearchData = res.data; 
          const c = document.getElementById('admin-search-results'); 
          c.innerHTML = '';
          
          if(res.data.length === 0) {
            c.innerHTML = '<p style="text-align:center;">Topilmadi.</p>';
          } else {
            res.data.forEach(st => { 
              c.innerHTML += `
                <div class="student-card" style="cursor:pointer;" onclick="app.showStudentDetails('${st.id}', 'search')">
                  <img src="${st.photo_url}" alt="">
                  <div class="info">
                    <h4>${st.full_name}</h4>
                    <p>Sinf: ${st.class_name}</p>
                  </div>
                </div>`; 
            });
          }
        }
      } catch(err) { 
        app.toggleLoader(false); 
      }
    }, 500); 
  },

  openAdminSettings: async () => {
    try {
      app.toggleLoader(true); 
      const resSettings = await API.getSettings(); 
      const resClasses = await API.getClassesStats(new Date().toISOString().split('T')[0]); 
      const resTeachers = await API.getTeachers(); 
      app.toggleLoader(false);
      
      if (resSettings.success && resSettings.time) {
        document.getElementById('reminder-time').value = resSettings.time;
      }
      
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
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert(err.message); 
    }
  },

  setupAdminListeners: () => {
    document.getElementById('form-broadcast').addEventListener('submit', async (e) => { 
      e.preventDefault(); 
      try { 
        app.toggleLoader(true); 
        const res = await API.sendBroadcast(document.getElementById('broadcast-message').value); 
        app.toggleLoader(false); 
        
        if (res.success) { 
          tg.showAlert(`E'lon yuborildi!`); 
          document.getElementById('form-broadcast').reset(); 
        } 
      } catch(err) { app.toggleLoader(false); } 
    });

    document.getElementById('form-settings').addEventListener('submit', async (e) => { 
      e.preventDefault(); 
      try { 
        app.toggleLoader(true); 
        await API.saveSettings(document.getElementById('reminder-time').value); 
        app.toggleLoader(false); 
        tg.showAlert("Sozlamalar saqlandi!"); 
      } catch(err) { app.toggleLoader(false); } 
    });

    document.getElementById('form-delete-class').addEventListener('submit', async (e) => { 
      e.preventDefault(); 
      const cId = document.getElementById('delete-class-select').value; 
      if(!cId) return; 
      
      tg.showConfirm("O'chirasizmi?", async (conf) => { 
        if(conf) { 
          try { 
            app.toggleLoader(true); 
            await API.deleteClass(cId); 
            app.toggleLoader(false); 
            
            tg.showAlert("Sinf o'chirildi"); 
            app.openAdminSettings(); 
          } catch(err) { app.toggleLoader(false); } 
        } 
      }); 
    });

    document.getElementById('form-delete-teacher').addEventListener('submit', async (e) => { 
      e.preventDefault(); 
      const tId = document.getElementById('delete-teacher-select').value; 
      if(!tId) return; 
      
      tg.showConfirm("O'chirasizmi?", async (conf) => { 
        if(conf) { 
          try { 
            app.toggleLoader(true); 
            await API.deleteTeacher(tId); 
            app.toggleLoader(false); 
            
            tg.showAlert("O'qituvchi o'chirildi"); 
            app.openAdminSettings(); 
          } catch(err) { app.toggleLoader(false); } 
        } 
      }); 
    });
  },

  // =====================================
  // PROFIL (TAHRIRLASH)
  // =====================================
  setupProfileListeners: () => {
    document.getElementById('form-edit-profile').addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        const data = { 
          full_name: document.getElementById('edit-fullname').value, 
          username: document.getElementById('edit-username').value, 
          password: document.getElementById('edit-password').value 
        };
        
        if(app.currentUser.role === 'teacher') {
          data.address = document.getElementById('edit-address').value; 
          data.phone = document.getElementById('edit-phone').value;
          
          const photoBlob = await app.getBlobFromPreview('edit-preview-photo');
          if(photoBlob) { 
            app.toggleLoader(true); 
            data.photo_url = await API.uploadImage(photoBlob); 
            app.toggleLoader(false); 
          }
        }
        
        app.toggleLoader(true); 
        const res = await API.updateProfile(app.currentUser.id, data); 
        app.toggleLoader(false);
        
        if(res.success) { 
          app.currentUser = res.user; 
          localStorage.setItem('leCrayonUser', JSON.stringify(res.user)); 
          tg.showAlert("Ma'lumotlar yangilandi!"); 
          app.goBack(); 
        }
      } catch(err) { 
        app.toggleLoader(false); 
        tg.showAlert(err.message); 
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
  // MODALLAR VA YORDAMCHI FUNKSIYALAR
  // =====================================
  addCertificateField: (containerId, name = '', level = '', percent = '') => {
    const c = document.getElementById(containerId);
    if (c.querySelectorAll('.certificate-group').length >= 5) {
      return tg.showAlert("Maksimal 5 ta sertifikat qo'shish mumkin!");
    }
    const div = document.createElement('div'); 
    div.className = 'certificate-group custom-form';
    div.innerHTML = `
      <input type="text" class="cert-name" placeholder="Sertifikat (M: IELTS)" value="${name}">
      <input type="text" class="cert-level" placeholder="Daraja (M: B2)" value="${level}">
      <input type="number" class="cert-percent" placeholder="Foiz (M: 85)" value="${percent}">
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

  openDiaryModal: async (stId, stName) => {
    try {
      app.toggleLoader(true); 
      const res = await API.getStudentAttendance(stId); 
      app.toggleLoader(false);
      
      if(res.success) {
        document.getElementById('diary-student-name').innerText = `${stName} - Daftarcha`; 
        const c = document.getElementById('diary-records-list'); 
        c.innerHTML = '';
        
        if(res.data.length === 0) { 
          c.innerHTML = '<p style="text-align:center;">Dars qoldirish/kechikishlar yo\'q.</p>'; 
        } else { 
          res.data.forEach(rec => { 
            c.innerHTML += `
              <div class="diary-item ${rec.status}">
                <div class="diary-date-status">
                  <span><i class="fa-regular fa-calendar"></i> ${rec.date}</span>
                  <span style="text-transform:uppercase;">${rec.status.replace('_', ' ')}</span>
                </div>
                <div class="diary-comment">Izoh: ${rec.comment}</div>
              </div>`; 
          }); 
        }
        document.getElementById('diary-modal').classList.remove('hidden');
      }
    } catch(err) { 
      app.toggleLoader(false); 
      tg.showAlert(err.message); 
    }
  },

  closeDiaryModal: () => { 
    document.getElementById('diary-modal').classList.add('hidden'); 
  },

  showStudentDetails: (id, context) => {
    let st;
    if(context === 'admin') st = app.currentAdminClassView.find(s => s.id === id);
    else if(context === 'teacher') st = app.teacherStudentsData.find(s => s.id === id);
    else if(context === 'search') st = app.currentAdminSearchData.find(s => s.id === id);
    
    if(!st) return;
    
    let certs = st.certificates && st.certificates.length > 0 
      ? st.certificates.map(c => `<span class="badge" style="margin-bottom:5px;">${c.name} ${c.level} (${c.percent}%)</span>`).join(' ')
      : 'Sertifikatlar kiritilmagan';
    
    document.getElementById('modal-body').innerHTML = `
      <img src="${st.photo_url}" class="modal-info-img" alt="">
      <h3 style="text-align:center; margin-bottom:20px;">${st.full_name}</h3>
      <div class="modal-data-row"><span>Sinf</span> <strong>${st.class_name || 'Sinfsiz'}</strong></div>
      <div class="modal-data-row"><span>Doimiy manzil</span> <strong>${st.permanent_address}</strong></div>
      <div class="modal-data-row"><span>Yotoqxona</span> <strong>${st.dormitory_address || '-'}</strong></div>
      
      <!-- Ochiladigan Telefon raqamlar dizayni -->
      <div class="modal-data-row" style="align-items:flex-start;">
        <span>Ota-ona telfoni</span> ${app.formatPhones(st.parent_phone)}
      </div>
      <div class="modal-data-row" style="align-items:flex-start;">
        <span>Yotoqxona telfoni</span> ${app.formatPhones(st.dormitory_phone)}
      </div>
      
      <div class="modal-data-row" style="flex-direction:column; gap:5px;">
        <span>Sertifikatlar</span> <div>${certs}</div>
      </div>
      <div class="modal-data-row"><span>Qoldirgan (Sababli)</span> <strong style="color:var(--warning);">${st.total_absences?.sababli || 0} marta</strong></div>
      <div class="modal-data-row"><span>Qoldirgan (Sababsiz)</span> <strong style="color:var(--danger);">${st.total_absences?.sababsiz || 0} marta</strong></div>
      <div class="modal-data-row"><span>Kech qolgan</span> <strong style="color:var(--info);">${st.total_absences?.kech_keldi || 0} marta</strong></div>
      
      <button class="secondary-btn" style="margin-top:20px; width:100%; border:1px solid var(--primary-color);" onclick="app.openDiaryModal('${st.id}', '${st.full_name}')">
        <i class="fa-solid fa-book"></i> Davomat Daftarchasini Ko'rish
      </button>
    `;
    document.getElementById('details-modal').classList.remove('hidden');
  },

  showTeacherDetails: (id) => {
    const t = app.teacherStudentsData.find(s => s.id === id);
    if (!t) return;
    
    document.getElementById('modal-body').innerHTML = `
      <img src="${t.photo_url || 'https://via.placeholder.com/100'}" class="modal-info-img" alt="">
      <h3 style="text-align:center; margin-bottom:20px;">${t.full_name}</h3>
      <div class="modal-data-row"><span>Sinflari</span> <strong>${t.class_name || "Biriktirilmagan"}</strong></div>
      <div class="modal-data-row" style="align-items:flex-start;"><span>Telefon raqami</span> ${app.formatPhones(t.phone)}</div>
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
