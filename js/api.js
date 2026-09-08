// Server va API xizmatlariga so'rov yuborish uchun funksiyalar

const API = {
  // 1. Rasmni ImgBB ga yuklash va URL manzilini olish
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
        return data.data.url; // Tayyor rasm havolasi (URL)
      } else {
        throw new Error("Rasm yuklashda xatolik yuz berdi");
      }
    } catch (error) {
      console.error(error);
      return null;
    }
  },

  // 2. Yangi sinf yaratish
  createClass: async (className, teacherId) => {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/classes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ className, teacherId })
    });
    return response.json();
  },

  // 3. Barcha sinflarni olish
  getClasses: async () => {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/classes`);
    return response.json();
  },

  // 4. Yangi o'quvchi qo'shish (Barcha ma'lumotlari bilan)
  createStudent: async (studentData) => {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(studentData)
    });
    return response.json();
  },

  // 5. Admin uchun barcha o'quvchilar hisobotini olish
  getAllStudents: async () => {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/admin/students`);
    return response.json();
  },

  // 6. O'qituvchi uchun muayyan sinf o'quvchilarini olish
  getStudentsByClass: async (classId) => {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/students/${classId}`);
    return response.json();
  },

  // 7. Davomatni serverga saqlash
  saveAttendance: async (attendanceData) => {
    const response = await fetch(`${CONFIG.BACKEND_URL}/api/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(attendanceData)
    });
    return response.json();
  }
};
