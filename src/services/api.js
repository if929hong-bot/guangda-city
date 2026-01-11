// src/services/api.js

const BASE_URL = import.meta.env.VITE_API_URL;

if (!BASE_URL) {
  console.warn('⚠️ VITE_API_URL 未設置');
}

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok || data.success === false) {
    throw new Error(data.message || 'API 請求失敗');
  }
  return data;
};

export const apiService = {
  async testConnection() {
    const res = await fetch(`${BASE_URL}/api/test`);
    return handleResponse(res);
  },

  async createRoom(room) {
    const res = await fetch(`${BASE_URL}/api/create-mega-room-folder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ room }),
    });
    return handleResponse(res);
  },

  async uploadImage(file, room) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('room', room);

    const res = await fetch(`${BASE_URL}/api/upload-to-mega`, {
      method: 'POST',
      body: formData,
    });

    return handleResponse(res);
  },

  async getFilesByRoom(room) {
    const res = await fetch(`${BASE_URL}/api/files/${room}`);
    return handleResponse(res);
  },

  // ⚠️ 如果後端未提供刪除 API，這裡先保留接口
  async deleteFile(fileId) {
    const res = await fetch(`${BASE_URL}/api/files/${fileId}`, {
      method: 'DELETE',
    });
    return handleResponse(res);
  },
};
