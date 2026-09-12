const API = {
  // =====================================
  // AVTORIZATSIYA VA PROFIL
  // =====================================
  login: async (username, password, telegramId = null) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, telegramId })
    });
    return res.json();
  },
  setupAdmin: async (data) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/setup-admin`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return res.json();
  },
  setupTeacher: async (data) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/setup-teacher`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return res.json();
  },
  updateProfile: async (id, data) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/users/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return res.json();
  },
  deleteTeacher: async (id) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/users/${id}`, { method: 'DELETE' });
    return res.json();
  },
  uploadImage: async (imageFile) => {
    const formData = new FormData();
    formData.append('key', CONFIG.IMGBB.API_KEY);
    formData.append('image', imageFile);
    try {
      const res = await fetch(CONFIG.IMGBB.UPLOAD_URL, { method: 'POST', body: formData });
      const data = await res.json();
      return data.success ? data.data.url : null;
    } catch { return null; }
  },

  // =====================================
  // YANGI: FACE ID VA WEBAUTHN API'LARI
  // =====================================
  registerFaceIdGenerate: async (username) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/webauthn/register/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username })
    });
    return res.json();
  },
  registerFaceIdVerify: async (username, attResp) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/webauthn/register/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, attResp })
    });
    return res.json();
  },
  loginFaceIdGenerate: async () => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/webauthn/login/generate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }
    });
    return res.json();
  },
  loginFaceIdVerify: async (authResp, sessionId, telegramId = null) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/webauthn/login/verify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ authResp, sessionId, telegramId })
    });
    return res.json();
  },

  // =====================================
  // SINFLAR VA KO'P SINFLI O'QITUVCHI
  // =====================================
  createClass: async (className, teacherId) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/classes`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ className, teacherId })
    });
    return res.json();
  },
  editClass: async (classId, className) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/classes/${classId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ className })
    });
    return res.json();
  },
  deleteClass: async (classId) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/classes/${classId}`, { method: 'DELETE' });
    return res.json();
  },
  getClassesStats: async (date) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/admin/classes-stats?date=${date}`);
    return res.json();
  },
  // YANGI: O'qituvchining BARCHA sinflarini olib kelish
  getTeacherClasses: async (teacherId) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/teacher/classes/${teacherId}`);
    return res.json();
  },

  // =====================================
  // O'QUVCHILAR
  // =====================================
  createStudent: async (studentData) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/students`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(studentData)
    });
    return res.json();
  },
  bulkCreateStudents: async (students, classId, className) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/students/bulk`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ students, classId, className })
    });
    return res.json();
  },
  getStudentsByClass: async (classId) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/students/${classId}`);
    return res.json();
  },
  searchStudents: async (query) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/admin/search-students?q=${encodeURIComponent(query)}`);
    return res.json();
  },
  updateStudent: async (id, studentData) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/students/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(studentData)
    });
    return res.json();
  },
  deleteStudent: async (id) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/students/${id}`, { method: 'DELETE' });
    return res.json();
  },

  // =====================================
  // DAVOMAT VA O'QITUVCHILAR (ADMIN)
  // =====================================
  saveAttendance: async (data) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/attendance`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data)
    });
    return res.json();
  },
  getMonitoring: async (date) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/admin/attendance?date=${date}`);
    return res.json();
  },
  getStudentAttendance: async (id) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/students/${id}/attendance`);
    return res.json();
  },
  getTeachers: async () => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/admin/teachers`);
    return res.json();
  },

  // =====================================
  // XABARNOMALAR VA SOZLAMALAR
  // =====================================
  sendBroadcast: async (message) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/broadcast`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message })
    });
    return res.json();
  },
  getSettings: async () => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/settings`);
    return res.json();
  },
  saveSettings: async (time) => {
    const res = await fetch(`${CONFIG.BACKEND_URL}/api/settings`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ time })
    });
    return res.json();
  }
};
