// 本地存储工具函数，管理用户和相簿数据

const STORAGE_KEYS = {
  USERS: 'guangda_users',
  ALBUMS: 'guangda_albums',
  CURRENT_USER: 'guangda_current_user'
};

// 初始化管理员账号
const ADMIN_ACCOUNT = {
  id: 'admin_001',
  username: 'admin',
  password: 'admin123',
  name: '系統管理員',
  phone: '0000000000',
  room: 'Admin',
  role: 'admin',
  createdAt: new Date().toISOString()
};

// 初始化存储
export const initStorage = () => {
  const users = getUsers();
  if (!users.find(u => u.role === 'admin')) {
    users.push(ADMIN_ACCOUNT);
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }
  if (!localStorage.getItem(STORAGE_KEYS.ALBUMS)) {
    localStorage.setItem(STORAGE_KEYS.ALBUMS, JSON.stringify([]));
  }
};

// 用户管理
export const getUsers = () => {
  const users = localStorage.getItem(STORAGE_KEYS.USERS);
  return users ? JSON.parse(users) : [];
};

export const addUser = (userData) => {
  const users = getUsers();
  const newUser = {
    id: `user_${Date.now()}`,
    ...userData,
    role: 'user',
    createdAt: new Date().toISOString()
  };
  users.push(newUser);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  return newUser;
};

export const getUserById = (userId) => {
  return getUsers().find(u => u.id === userId);
};

export const updateUser = (userId, updates) => {
  const users = getUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index !== -1) {
    users[index] = { ...users[index], ...updates };
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    return users[index];
  }
  return null;
};

export const deleteUser = (userId) => {
  const users = getUsers().filter(u => u.id !== userId);
  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  const albums = getAlbums().filter(a => a.userId !== userId);
  localStorage.setItem(STORAGE_KEYS.ALBUMS, JSON.stringify(albums));
};

// 当前用户管理
export const setCurrentUser = (user) => {
  localStorage.setItem(STORAGE_KEYS.CURRENT_USER, JSON.stringify(user));
};

export const getCurrentUser = () => {
  const user = localStorage.getItem(STORAGE_KEYS.CURRENT_USER);
  return user ? JSON.parse(user) : null;
};

export const clearCurrentUser = () => {
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
};

// 相簿管理
export const getAlbums = () => {
  const albums = localStorage.getItem(STORAGE_KEYS.ALBUMS);
  return albums ? JSON.parse(albums) : [];
};

export const getUserAlbums = (userId) => {
  return getAlbums().filter(a => a.userId === userId);
};

export const addImage = (userId, imageData) => {
  const albums = getAlbums();
  const newImage = {
    id: `img_${Date.now()}`,
    userId,
    url: imageData,
    uploadDate: new Date().toISOString()
  };
  albums.push(newImage);
  localStorage.setItem(STORAGE_KEYS.ALBUMS, JSON.stringify(albums));
  return newImage;
};

export const deleteImage = (imageId) => {
  const albums = getAlbums().filter(a => a.id !== imageId);
  localStorage.setItem(STORAGE_KEYS.ALBUMS, JSON.stringify(albums));
};

export const getAllAlbumsWithUserInfo = () => {
  const albums = getAlbums();
  const users = getUsers();
  return albums.map(album => ({
    ...album,
    userName: users.find(u => u.id === album.userId)?.name || '未知用戶',
    userRoom: users.find(u => u.id === album.userId)?.room || '未知房間'
  }));
};

// 认证
export const authenticateUser = (username, password) => {
  const users = getUsers();
  return users.find(u => 
    (u.username === username || u.phone === username) && 
    u.password === password
  );
};

// 清空所有数据（仅用于测试）
export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEYS.USERS);
  localStorage.removeItem(STORAGE_KEYS.ALBUMS);
  localStorage.removeItem(STORAGE_KEYS.CURRENT_USER);
  initStorage();
};