require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Mega = require('megajs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// 初始化Express應用
const app = express();

// CORS配置 - 允許所有來源（生產環境應限制）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== 環境變量配置 ==========
const MEGA_EMAIL = process.env.MEGA_EMAIL;
const MEGA_PASSWORD = process.env.MEGA_PASSWORD;
const MEGA_ROOT_FOLDER = process.env.MEGA_ROOT_FOLDER || 'guangda-city';

// ========== MEGA客戶端初始化 ==========
let megaClient = null;
let megaRootNode = null;

// 輔助函數：查找文件夾
async function findFolderByName(parent, folderName) {
  if (!parent || !parent.children) return null;
  
  const children = Array.from(parent.children);
  for (const child of children) {
    if (child.type === 'folder' && child.name === folderName) {
      return child;
    }
  }
  return null;
}

// 輔助函數：查找文件
async function findFileByName(parent, fileName) {
  if (!parent || !parent.children) return null;
  
  const children = Array.from(parent.children);
  for (const child of children) {
    if (child.type === 'file' && child.name === fileName) {
      return child;
    }
  }
  return null;
}

// 初始化MEGA客戶端
async function initMegaClient() {
  return new Promise((resolve, reject) => {
    try {
      if (!MEGA_EMAIL || !MEGA_PASSWORD) {
        console.warn('⚠️ MEGA環境變量未配置，上傳功能將不可用');
        resolve(); // 不reject，讓服務器繼續啟動
        return;
      }

      console.log('🔄 正在初始化MEGA客戶端...');

      megaClient = new Mega({
        email: MEGA_EMAIL,
        password: MEGA_PASSWORD,
        autologin: true
      });

      megaClient.on('ready', async () => {
        console.log('✅ MEGA客戶端登錄成功');
        megaRootNode = megaClient.root;
        
        // 確保根文件夾存在
        try {
          let rootFolder = await findFolderByName(megaRootNode, MEGA_ROOT_FOLDER);
          if (!rootFolder) {
            rootFolder = await megaClient.mkdir(MEGA_ROOT_FOLDER, megaRootNode);
            console.log(`✅ 已創建MEGA根文件夾: ${MEGA_ROOT_FOLDER}`);
          } else {
            console.log(`✅ MEGA根文件夾已存在: ${MEGA_ROOT_FOLDER}`);
          }
        } catch (folderErr) {
          console.warn(`⚠️ 創建根文件夾失敗: ${folderErr.message}`);
        }
        
        resolve();
      });

      megaClient.on('error', (err) => {
        console.error('❌ MEGA客戶端錯誤:', err.message);
        megaClient = null;
        megaRootNode = null;
        reject(err);
      });

      megaClient.on('close', () => {
        console.warn('⚠️ MEGA客戶端連接已關閉');
        megaClient = null;
        megaRootNode = null;
      });

    } catch (err) {
      console.error('❌ MEGA初始化失敗:', err.message);
      megaClient = null;
      megaRootNode = null;
      reject(err);
    }
  });
}

// ========== 圖片上傳中間件 ==========
// 創建臨時目錄
const tempDir = path.join(__dirname, 'temp_uploads');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 限制10MB以內的圖片
});

// ========== 健康檢查接口 ==========
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: '廣大城租戶管理後端服務',
    status: 'running',
    time: new Date().toISOString(),
    mega: megaClient ? 'connected' : 'disconnected',
    endpoints: {
      test: '/api/test',
      testMega: '/api/test-mega',
      upload: '/api/upload-to-mega',
      createFolder: '/api/create-mega-room-folder'
    }
  });
});

// ========== 核心接口 ==========
/**
 * 1. 測試接口：驗證前後端連通性
 */
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    msg: '前後端連通成功！所有功能已兼容運行',
    time: new Date().toString(),
    environment: {
      hasMegaConfig: !!(MEGA_EMAIL && MEGA_PASSWORD),
      megaClientReady: !!(megaClient && megaRootNode),
      rootFolder: MEGA_ROOT_FOLDER
    }
  });
});

/**
 * 2. MEGA連接測試接口
 */
app.get('/api/test-mega', async (req, res) => {
  try {
    // 檢查環境變量
    if (!MEGA_EMAIL || !MEGA_PASSWORD) {
      return res.status(200).json({
        success: false,
        msg: 'MEGA配置缺失',
        detail: {
          error: 'MEGA_EMAIL或MEGA_PASSWORD未配置',
          tip: '請在Zeabur的環境變量中添加MEGA_EMAIL和MEGA_PASSWORD',
          required: true
        }
      });
    }

    // 檢查客戶端是否初始化
    if (!megaClient || !megaRootNode) {
      // 嘗試重新初始化
      try {
        await initMegaClient();
      } catch (initErr) {
        return res.status(200).json({
          success: false,
          msg: 'MEGA客戶端初始化失敗',
          detail: {
            error: initErr.message,
            tip: '請檢查賬號密碼是否正確，或MEGA服務器是否可訪問'
          }
        });
      }
    }

    // 測試文件夾訪問
    const rootFolder = await findFolderByName(megaRootNode, MEGA_ROOT_FOLDER);
    
    res.json({
      success: true,
      msg: 'MEGA連接測試成功',
      detail: {
        email: MEGA_EMAIL,
        rootFolder: MEGA_ROOT_FOLDER,
        folderExists: !!rootFolder,
        clientReady: !!(megaClient && megaRootNode),
        tip: 'MEGA服務已準備就緒'
      }
    });

  } catch (err) {
    res.status(200).json({
      success: false,
      msg: 'MEGA連接測試失敗',
      detail: {
        error: err.message,
        tip: '常見原因：賬號密碼錯誤、MEGA服務器限制、網絡問題'
      }
    });
  }
});

/**
 * 3. MEGA圖片上傳接口
 */
app.post('/api/upload-to-mega', upload.single('image'), async (req, res) => {
  try {
    // 基礎參數校驗
    const { room, fileName } = req.body;
    if (!room || !req.file) {
      return res.status(400).json({
        success: false,
        msg: '房號和圖片為必填參數'
      });
    }

    // 檢查MEGA客戶端是否可用
    if (!megaClient || !megaRootNode) {
      return res.status(503).json({
        success: false,
        msg: 'MEGA服務暫時不可用',
        detail: '請先配置並測試MEGA連接（GET /api/test-mega）'
      });
    }

    // 處理文件名（過濾非法字符）
    const safeRoom = room.replace(/[\/:*?"<>|]/g, '_');
    const finalFileName = fileName || 
      `upload_${Date.now()}_${safeRoom}${path.extname(req.file.originalname)}`;

    // 讀取文件
    const fileBuffer = fs.readFileSync(req.file.path);

    // 查找或創建根文件夾
    let rootFolder = await findFolderByName(megaRootNode, MEGA_ROOT_FOLDER);
    if (!rootFolder) {
      rootFolder = await megaClient.mkdir(MEGA_ROOT_FOLDER, megaRootNode);
    }

    // 查找或創建房間文件夾
    let roomFolder = await findFolderByName(rootFolder, safeRoom);
    if (!roomFolder) {
      roomFolder = await megaClient.mkdir(safeRoom, rootFolder);
      console.log(`✅ 已創建房號文件夾: ${safeRoom}`);
    }

    // 上傳文件到MEGA
    const uploadedFile = await megaClient.upload({
      name: finalFileName,
      size: fileBuffer.length,
      data: fileBuffer
    }, roomFolder);

    // 生成下載鏈接
    const downloadLink = await uploadedFile.link();

    // 清理臨時文件
    fs.unlinkSync(req.file.path);

    // 返回結果
    res.json({
      success: true,
      msg: '圖片上傳成功',
      data: {
        fileId: uploadedFile.downloadId,
        fileName: uploadedFile.name,
        fileLink: downloadLink,
        room: safeRoom,
        size: uploadedFile.size,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ MEGA上傳失敗:', err);
    
    // 清理臨時文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      msg: '圖片上傳失敗',
      error: err.message,
      tip: '請檢查MEGA連接或文件大小（限制10MB）'
    });
  }
});

/**
 * 4. 創建以房號命名的MEGA文件夾接口
 */
app.post('/api/create-mega-room-folder', async (req, res) => {
  try {
    // 接收並校驗參數
    const { room } = req.body;
    if (!room) {
      return res.status(400).json({
        success: false,
        msg: '房號為必填參數，無法創建文件夾'
      });
    }

    // 檢查MEGA客戶端
    if (!megaClient || !megaRootNode) {
      return res.status(503).json({
        success: false,
        msg: 'MEGA服務暫時不可用',
        detail: '請先配置並測試MEGA連接'
      });
    }

    // 處理房號（過濾非法字符）
    const safeRoom = room.replace(/[\/:*?"<>|]/g, '_');

    // 查找根文件夾
    let rootFolder = await findFolderByName(megaRootNode, MEGA_ROOT_FOLDER);
    if (!rootFolder) {
      rootFolder = await megaClient.mkdir(MEGA_ROOT_FOLDER, megaRootNode);
    }

    // 檢查是否已存在
    let roomFolder = await findFolderByName(rootFolder, safeRoom);
    if (roomFolder) {
      return res.json({
        success: true,
        msg: '文件夾已存在，無需重複創建',
        data: {
          room: safeRoom,
          folderName: safeRoom,
          rootFolder: MEGA_ROOT_FOLDER,
          folderId: roomFolder.downloadId
        }
      });
    }

    // 創建新文件夾
    roomFolder = await megaClient.mkdir(safeRoom, rootFolder);
    console.log(`✅ 已在MEGA創建房號文件夾: ${safeRoom}`);

    res.json({
      success: true,
      msg: '房號文件夾創建成功',
      data: {
        room: safeRoom,
        folderName: safeRoom,
        rootFolder: MEGA_ROOT_FOLDER,
        folderId: roomFolder.downloadId,
        created: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ MEGA文件夾創建失敗:', err);
    res.status(500).json({
      success: false,
      msg: '房號文件夾創建失敗',
      error: err.message,
      tip: '常見原因：房號格式非法、MEGA服務器限制、網絡問題'
    });
  }
});

/**
 * 5. 獲取文件列表接口
 */
app.get('/api/files/:room?', async (req, res) => {
  try {
    const { room } = req.params;
    
    if (!megaClient || !megaRootNode) {
      return res.status(503).json({
        success: false,
        msg: 'MEGA服務暫時不可用'
      });
    }

    // 查找根文件夾
    const rootFolder = await findFolderByName(megaRootNode, MEGA_ROOT_FOLDER);
    if (!rootFolder) {
      return res.json({
        success: true,
        msg: '根文件夾不存在',
        data: []
      });
    }

    let files = [];
    
    if (room) {
      // 獲取特定房間的文件
      const roomFolder = await findFolderByName(rootFolder, room);
      if (roomFolder && roomFolder.children) {
        const children = Array.from(roomFolder.children);
        files = children
          .filter(child => child.type === 'file')
          .map(file => ({
            name: file.name,
            size: file.size,
            modified: file.timestamp,
            type: file.attributes?.type || 'unknown'
          }));
      }
    } else {
      // 獲取所有房間列表
      const children = Array.from(rootFolder.children);
      const roomFolders = children.filter(child => child.type === 'folder');
      
      files = roomFolders.map(folder => ({
        name: folder.name,
        type: 'folder',
        itemCount: folder.children ? Array.from(folder.children).length : 0
      }));
    }

    res.json({
      success: true,
      data: files,
      count: files.length
    });

  } catch (err) {
    console.error('❌ 獲取文件列表失敗:', err);
    res.status(500).json({
      success: false,
      msg: '獲取文件列表失敗',
      error: err.message
    });
  }
});

// ========== 錯誤處理中間件 ==========
app.use((err, req, res, next) => {
  console.error('❌ 服務器錯誤:', err);
  res.status(500).json({
    success: false,
    msg: '內部服務器錯誤',
    error: process.env.NODE_ENV === 'development' ? err.message : '請聯繫管理員'
  });
});

// ========== 404處理 ==========
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    msg: '端點不存在',
    path: req.originalUrl
  });
});

// ========== 啟動服務 ==========
const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 初始化MEGA（如果配置了憑證）
    if (MEGA_EMAIL && MEGA_PASSWORD) {
      await initMegaClient();
    } else {
      console.warn('⚠️ MEGA憑證未配置，上傳功能將不可用');
    }

    // 啟動HTTP服務器
    const server = app.listen(PORT, () => {
      console.log(`
🚀 服務器已啟動
📍 地址: http://localhost:${PORT}
📅 時間: ${new Date().toLocaleString()}
🔧 環境: ${process.env.NODE_ENV || 'development'}
📂 MEGA狀態: ${megaClient ? '已連接' : '未連接'}
      `);
      
      console.log('\n📋 可用接口：');
      console.log('  GET  /             - 服務狀態');
      console.log('  GET  /api/test     - 連通性測試');
      console.log('  GET  /api/test-mega - MEGA連接測試');
      console.log('  POST /api/upload-to-mega - 上傳圖片');
      console.log('  POST /api/create-mega-room-folder - 創建房號文件夾');
      console.log('  GET  /api/files/:room - 獲取文件列表');
    });

    // 優雅關閉
    process.on('SIGTERM', () => {
      console.log('收到關閉信號，正在清理資源...');
      
      // 清理臨時目錄
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('已清理臨時目錄');
      }
      
      server.close(() => {
        console.log('服務器已關閉');
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ 服務器啟動失敗:', err);
    process.exit(1);
  }
}

// 啟動服務器
startServer();

module.exports = app;