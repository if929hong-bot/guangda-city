require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { S3Client, PutObjectCommand, CreateBucketCommand, ListObjectsV2Command, HeadBucketCommand } = require('@aws-sdk/client-s3');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid'); // 用于生成唯一文件名，避免冲突

// 初始化Express應用
const app = express();

// CORS配置 - 允許所有來源（生產環境應限制為前端域名）
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ========== 環境變量配置（Cloudflare R2） ==========
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'guangda-city';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL; // 前端一致的R2公開訪問地址（如：https://pub-xxx.r2.dev）

// ========== Cloudflare R2 客戶端初始化（兼容AWS S3協議） ==========
let r2Client = null;

// 初始化R2客戶端
function initR2Client() {
  try {
    // 校驗必要配置
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      console.warn('⚠️ Cloudflare R2 環境變量未配置完整，上傳功能將不可用');
      console.warn('需要配置：R2_ACCOUNT_ID、R2_ACCESS_KEY_ID、R2_SECRET_ACCESS_KEY、R2_BUCKET_NAME');
      return null;
    }

    console.log('🔄 正在初始化Cloudflare R2客戶端...');

    // R2 兼容 S3 協議，使用 AWS S3 Client 初始化
    r2Client = new S3Client({
      region: 'auto', // R2 固定為 auto
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY
      }
    });

    console.log('✅ Cloudflare R2 客戶端初始化成功');
    return r2Client;
  } catch (err) {
    console.error('❌ Cloudflare R2 客戶端初始化失敗:', err.message);
    return null;
  }
}

// 驗證/創建 R2 Bucket（對應原MEGA根文件夾）
async function ensureR2BucketExists() {
  if (!r2Client) return false;

  try {
    // 先檢查Bucket是否存在
    await r2Client.send(new HeadBucketCommand({ Bucket: R2_BUCKET_NAME }));
    console.log(`✅ R2 Bucket 已存在: ${R2_BUCKET_NAME}`);
    return true;
  } catch (err) {
    // Bucket不存在，嘗試創建
    if (err.name === 'NotFound') {
      try {
        await r2Client.send(new CreateBucketCommand({ Bucket: R2_BUCKET_NAME }));
        console.log(`✅ 已創建 R2 Bucket: ${R2_BUCKET_NAME}`);
        return true;
      } catch (createErr) {
        console.error(`⚠️ 創建 R2 Bucket 失敗: ${createErr.message}`);
        return false;
      }
    } else {
      console.error(`⚠️ 檢查 R2 Bucket 失敗: ${err.message}`);
      return false;
    }
  }
}

// ========== 圖片上傳中間件（與原邏輯一致，臨時存儲本地） ==========
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
    message: '廣大城租戶管理後端服務（Cloudflare R2 版）',
    status: 'running',
    time: new Date().toISOString(),
    r2: r2Client ? 'connected' : 'disconnected',
    endpoints: {
      test: '/api/test',
      testR2: '/api/test-r2',
      upload: '/api/upload-to-r2',
      createFolder: '/api/create-r2-room-folder',
      files: '/api/files/:room'
    }
  });
});

// ========== 核心接口（替換原MEGA接口，适配R2） ==========
/**
 * 1. 測試接口：驗證前後端連通性
 */
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    msg: '前後端連通成功！所有功能已兼容 Cloudflare R2 運行',
    time: new Date().toString(),
    environment: {
      hasR2Config: !!(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME),
      r2ClientReady: !!r2Client,
      bucket: R2_BUCKET_NAME,
      publicUrl: R2_PUBLIC_URL || '未配置公開訪問地址'
    }
  });
});

/**
 * 2. R2 連接測試接口
 */
app.get('/api/test-r2', async (req, res) => {
  try {
    // 檢查環境變量完整性
    if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
      return res.status(200).json({
        success: false,
        msg: 'Cloudflare R2 配置缺失',
        detail: {
          error: '必要環境變量未配置完整',
          required: ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'R2_BUCKET_NAME'],
          tip: '請在環境變量中添加完整的 R2 配置信息'
        }
      });
    }

    // 檢查客戶端是否初始化，未初始化則嘗試重新初始化
    if (!r2Client) {
      r2Client = initR2Client();
      if (!r2Client) {
        return res.status(200).json({
          success: false,
          msg: 'R2 客戶端初始化失敗',
          detail: {
            error: '客戶端創建失敗，請檢查配置格式',
            tip: '請核對 R2 賬戶ID、Access Key 等信息是否正確'
          }
        });
      }
    }

    // 測試 Bucket 可訪問性
    const bucketExists = await ensureR2BucketExists();

    res.json({
      success: true,
      msg: 'Cloudflare R2 連接測試成功',
      detail: {
        bucket: R2_BUCKET_NAME,
        bucketExists: bucketExists,
        clientReady: !!r2Client,
        publicUrl: R2_PUBLIC_URL,
        tip: 'R2 服務已準備就緒，可進行文件上傳操作'
      }
    });

  } catch (err) {
    res.status(200).json({
      success: false,
      msg: 'Cloudflare R2 連接測試失敗',
      detail: {
        error: err.message,
        tip: '常見原因：配置錯誤、R2 桶權限不足、網絡問題'
      }
    });
  }
});

/**
 * 3. R2 圖片上傳接口（對應原 MEGA 上傳接口，返回前端可訪問的公開 URL）
 */
app.post('/api/upload-to-r2', upload.single('image'), async (req, res) => {
  try {
    // 基礎參數校驗
    const { room, fileName } = req.body;
    if (!room || !req.file) {
      return res.status(400).json({
        success: false,
        msg: '房號和圖片為必填參數'
      });
    }

    // 檢查 R2 客戶端是否可用
    if (!r2Client) {
      return res.status(503).json({
        success: false,
        msg: 'Cloudflare R2 服務暫時不可用',
        detail: '請先配置並測試 R2 連接（GET /api/test-r2）'
      });
    }

    // 確保 Bucket 存在
    const bucketExists = await ensureR2BucketExists();
    if (!bucketExists) {
      return res.status(500).json({
        success: false,
        msg: 'R2 Bucket 不存在且創建失敗，無法上傳文件'
      });
    }

    // 處理路徑與文件名（R2 中「文件夾」是虛擬路徑，用 / 分隔）
    const safeRoom = room.replace(/[\/:*?"<>|]/g, '_'); // 過濾非法字符
    const fileExt = path.extname(req.file.originalname);
    const baseFileName = fileName ? fileName.replace(/[\/:*?"<>|]/g, '_') : `upload_${uuidv4()}`;
    const finalFileName = `${baseFileName}${fileExt}`;
    const r2ObjectKey = `${safeRoom}/${finalFileName}`; // 虛擬文件路徑：房號/文件名（對應原MEGA文件夾）

    // 讀取本地臨時文件
    const fileBuffer = fs.readFileSync(req.file.path);

    // 上傳文件到 R2 Bucket
    const uploadCommand = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: r2ObjectKey, // 虛擬文件路徑，實現「文件夾」效果
      Body: fileBuffer,
      ContentType: req.file.mimetype, // 設置文件MIME類型，方便前端識別
      ACL: 'public-read' // 設置公開讀取權限（需確保 R2 桶已開啟公開訪問）
    });

    await r2Client.send(uploadCommand);

    // 構建前端可訪問的公開 URL（與前端 R2_PUBLIC_URL 對齊）
    const publicFileUrl = `${R2_PUBLIC_URL}/${r2ObjectKey}`;

    // 清理臨時文件
    fs.unlinkSync(req.file.path);

    // 返回結果（與原 MEGA 接口返回格式兼容，降低前端改造成本）
    res.json({
      success: true,
      msg: '圖片上傳到 R2 成功',
      data: {
        fileId: r2ObjectKey,
        fileName: finalFileName,
        fileLink: publicFileUrl, // 前端可直接訪問的公開 URL
        room: safeRoom,
        size: req.file.size,
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ R2 上傳失敗:', err);
    
    // 清理臨時文件
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.status(500).json({
      success: false,
      msg: '圖片上傳失敗',
      error: err.message,
      tip: '請檢查 R2 連接、文件大小（限制10MB）或 Bucket 權限'
    });
  }
});

/**
 * 4. 創建以房號命名的 R2 「文件夾」接口（虛擬路徑，無需真實創建文件夾）
 */
app.post('/api/create-r2-room-folder', async (req, res) => {
  try {
    // 接收並校驗參數
    const { room } = req.body;
    if (!room) {
      return res.status(400).json({
        success: false,
        msg: '房號為必填參數，無法創建文件夾'
      });
    }

    // 檢查 R2 客戶端
    if (!r2Client) {
      return res.status(503).json({
        success: false,
        msg: 'Cloudflare R2 服務暫時不可用',
        detail: '請先配置並測試 R2 連接'
      });
    }

    // 確保 Bucket 存在
    const bucketExists = await ensureR2BucketExists();
    if (!bucketExists) {
      return res.status(500).json({
        success: false,
        msg: 'R2 Bucket 不存在且創建失敗，無法創建文件夾'
      });
    }

    // 處理房號（過濾非法字符）
    const safeRoom = room.replace(/[\/:*?"<>|]/g, '_');
    const virtualFolderKey = `${safeRoom}/`; // R2 虛擬文件夾標識（以 / 結尾）

    // R2 中虛擬文件夾無需「創建」，只需驗證是否已有對應路徑的文件
    // 查詢該房號路徑下是否有文件
    const listCommand = new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: virtualFolderKey,
      MaxKeys: 1
    });

    const listResult = await r2Client.send(listCommand);
    const folderHasFiles = !!listResult.Contents && listResult.Contents.length > 0;

    // 返回結果（兼容原 MEGA 接口格式）
    res.json({
      success: true,
      msg: folderHasFiles ? '文件夾已存在（包含文件），無需重複創建' : '虛擬文件夾創建成功（R2 無需真實創建文件夾）',
      data: {
        room: safeRoom,
        folderName: safeRoom,
        bucket: R2_BUCKET_NAME,
        virtualFolderKey: virtualFolderKey,
        publicFolderUrl: `${R2_PUBLIC_URL}/${virtualFolderKey}`,
        created: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('❌ R2 文件夾創建失敗:', err);
    res.status(500).json({
      success: false,
      msg: '房號文件夾創建失敗',
      error: err.message,
      tip: '常見原因：房號格式非法、R2 服務器限制、網絡問題'
    });
  }
});

/**
 * 5. 獲取文件列表接口（查詢 R2 對應房號路徑下的文件）
 */
app.get('/api/files/:room?', async (req, res) => {
  try {
    const { room } = req.params;
    
    if (!r2Client) {
      return res.status(503).json({
        success: false,
        msg: 'Cloudflare R2 服務暫時不可用'
      });
    }

    // 確保 Bucket 存在
    const bucketExists = await ensureR2BucketExists();
    if (!bucketExists) {
      return res.json({
        success: true,
        msg: 'R2 Bucket 不存在',
        data: []
      });
    }

    let files = [];
    
    if (room) {
      // 獲取特定房間的文件（查詢對應虛擬路徑下的所有文件）
      const safeRoom = room.replace(/[\/:*?"<>|]/g, '_');
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Prefix: `${safeRoom}/`,
        Delimiter: '/' // 忽略子文件夾（如果有）
      });

      const listResult = await r2Client.send(listCommand);
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        files = listResult.Contents.map(file => ({
          name: path.basename(file.Key),
          size: file.Size,
          modified: file.LastModified,
          type: file.ContentType || 'unknown',
          fileLink: `${R2_PUBLIC_URL}/${file.Key}`
        }));
      }
    } else {
      // 獲取所有房間列表（查詢所有頂級虛擬文件夾）
      const listCommand = new ListObjectsV2Command({
        Bucket: R2_BUCKET_NAME,
        Delimiter: '/' // 分組獲取頂級文件夾（房號）
      });

      const listResult = await r2Client.send(listCommand);
      
      if (listResult.CommonPrefixes && listResult.CommonPrefixes.length > 0) {
        files = listResult.CommonPrefixes.map(prefix => ({
          name: path.basename(prefix.Prefix.replace(/\/$/, '')),
          type: 'folder',
          itemCount: 0 // R2 無法直接獲取文件夾內文件數量，如需精確需單獨查詢
        }));
      }
    }

    res.json({
      success: true,
      data: files,
      count: files.length
    });

  } catch (err) {
    console.error('❌ 獲取 R2 文件列表失敗:', err);
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
    // 初始化 R2 客戶端（如果配置了完整憑證）
    if (R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && R2_BUCKET_NAME) {
      r2Client = initR2Client();
      // 驗證 Bucket 存在性
      if (r2Client) {
        await ensureR2BucketExists();
      }
    } else {
      console.warn('⚠️ Cloudflare R2 憑證未配置完整，上傳功能將不可用');
    }

    // 啟動HTTP服務器
    const server = app.listen(PORT, () => {
      console.log(`
🚀 服務器已啟動（Cloudflare R2 版）
📍 地址: http://localhost:${PORT}
📅 時間: ${new Date().toLocaleString()}
🔧 環境: ${process.env.NODE_ENV || 'development'}
📂 R2 狀態: ${r2Client ? '已連接' : '未連接'}
📦 R2 Bucket: ${R2_BUCKET_NAME || '未配置'}
🌐 R2 公開地址: ${R2_PUBLIC_URL || '未配置'}
      `);
      
      console.log('\n📋 可用接口：');
      console.log('  GET  /             - 服務狀態');
      console.log('  GET  /api/test     - 連通性測試');
      console.log('  GET  /api/test-r2  - R2 連接測試');
      console.log('  POST /api/upload-to-r2 - 上傳圖片到 R2');
      console.log('  POST /api/create-r2-room-folder - 創建房號虛擬文件夾');
      console.log('  GET  /api/files/:room - 獲取 R2 文件列表');
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

// 安裝依賴提示（啟動前檢查必要依賴）
try {
  require('@aws-sdk/client-s3');
  require('uuid');
} catch (err) {
  console.error('❌ 缺少必要依賴，請先執行安裝命令：');
  console.error('npm install @aws-sdk/client-s3 uuid');
  process.exit(1);
}

// 啟動服務器
startServer();

module.exports = app;