// Server va API xizmatlariga so'rov yuborish uchun funksiyalar

const API = {
  // ==========================================
  // AVTORIZATSIYA (YANGI)
  // ==========================================
  
  // Login va parolni tekshirish
  login: async (username, password) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, error: "Server bilan bog'lanishda xatolik!" };
    }
  },

  // Birinchi marta kirganda Admin profilini saqlash
  setupAdmin: async (data) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/setup-admin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, error: "Saqlashda xatolik yuz berdi" };
    }
  },

  // Birinchi marta kirganda O'qituvchi profilini saqlash
  setupTeacher: async (data) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/setup-teacher`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, error: "Saqlashda xatolik yuz berdi" };
    }
  },

  // Admin uchun barcha o'qituvchilar profilini olish
  getTeachers: async () => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/admin/teachers`);
      return await response.json();
    } catch (error) {
      console.error(error);
      return { success: false, error: "O'qituvchilarni yuklashda xatolik" };
    }
  },

  // ==========================================
  // RASM VA ASOSIY API LARI
  // ==========================================

  // Rasmni ImgBB ga yuklash va URL manzilini olish
  uploadImage: async (imageFile) => {
    try {
      const formData = new FormData();
      formData.append('key', CONFIG.IMGBB.API_KEY);
      formData.append('image', imageFile);

      const response = await fetch(CONFIG.IMGBB.UPLOAD_URL, {
        method: 'POST',
        body: formData
      });
      
      const data = await response.json();
      if (data.success) {
        return data.data.url;
      } else {
        throw new Error("Rasm yuklashda xatolik yuz berdi");
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  // Yangi sinf yaratish
  createClass: async (className, teacherId) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ className, teacherId })
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: "Sinf yaratishda xatolik" };
    }
  },

  // Barcha sinflarni olish
  getClasses: async () => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/classes`);
      return await response.json();
    } catch (error) {
      return { success: false, error: "Sinflarni yuklashda xatolik" };
    }
  },

  // Yangi o'quvchi qo'shish (Barcha ma'lumotlari bilan)
  createStudent: async (studentData) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(studentData)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: "O'quvchini saqlashda xatolik" };
    }
  },

  // Admin uchun barcha o'quvchilar hisobotini olish
  getAllStudents: async () => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/admin/students`);
      return await response.json();
    } catch (error) {
      return { success: false, error: "Hisobotni yuklashda xatolik" };
    }
  },

  // O'qituvchi uchun muayyan sinf o'quvchilarini olish
  getStudentsByClass: async (classId) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/students/${classId}`);
      return await response.json();
    } catch (error) {
      return { success: false, error: "Sinf o'quvchilarini yuklashda xatolik" };
    }
  },

  // Davomatni serverga saqlash
  saveAttendance: async (attendanceData) => {
    try {
      const response = await fetch(`${CONFIG.BACKEND_URL}/api/attendance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(attendanceData)
      });
      return await response.json();
    } catch (error) {
      return { success: false, error: "Davomatni saqlashda xatolik" };
    }
  }
};
