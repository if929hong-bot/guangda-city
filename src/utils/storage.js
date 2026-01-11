// src/utils/storage.js
import { apiService } from '../services/api';

const STORAGE_KEY = 'guangda_city_images';

// 🔁 切換是否使用 API
export const useAPI = true;

/* =======================
   localStorage 版本（保留）
======================= */
export const getImagesFromLocal = (room) => {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  return all[room] || [];
};

export const addImageToLocal = (room, image) => {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (!all[room]) all[room] = [];
  all[room].push(image);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

export const deleteImageFromLocal = (room, id) => {
  const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  if (!all[room]) return;
  all[room] = all[room].filter((img) => img.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
};

/* =======================
   API 版本
======================= */
export const getImagesViaAPI = async (room) => {
  const res = await apiService.getFilesByRoom(room);
  return res.data;
};

export const addImageViaAPI = async (file, room) => {
  const res = await apiService.uploadImage(file, room);
  return res.data;
};

export const deleteImageViaAPI = async (fileId) => {
  return apiService.deleteFile(fileId);
};
