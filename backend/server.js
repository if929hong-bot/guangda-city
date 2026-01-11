require('dotenv').config(); // Zeabur会自动忽略，本地开发生效
const express = require('express');
const cors = require('cors');
// 修复：改用默认导入获取Mega构造函数
const Mega = require('megajs'); 
const multer = require('multer');
const { Buffer } = require('buffer');

// 初始化Express应用
const app = express();
app.use(cors()); // 强制跨域，解决前后端跨域问题
app.use(express.json({ limit: '10mb' })); // 支持大文件JSON解析

// ========== 环境变量配置 ==========
// MEGA核心配置（全部从环境变量读取）
const MEGA_EMAIL = process.env.MEGA_EMAIL;
const MEGA_PASSWORD = process.env.MEGA_PASSWORD;
const MEGA_ROOT_FOLDER = process.env.MEGA_ROOT_FOLDER || 'guangda-city';

// ========== MEGA客户端初始化（带容错 + 就绪等待） ==========
let megaClient = null;
let megaRootNode = null; // 缓存根文件夹节点

// 初始化MEGA客户端（返回Promise，等待就绪事件）
async function initMegaClient() {
  return new Promise((resolve, reject) => {
    try {
      if (!MEGA_EMAIL || !MEGA_PASSWORD) {
        throw new Error('MEGA_EMAIL/MEGA_PASSWORD环境变量未配置');
      }

      // 创建MEGA客户端实例（已修复导入，可正常new）
      megaClient = new Mega({
        email: MEGA_EMAIL,
        password: MEGA_PASSWORD
      });

      // 监听客户端就绪事件
      megaClient.on('ready', () => {
        console.log('✅ MEGA客户端登录成功');
        // 修复：root是同步属性，无需await
        megaRootNode = megaClient.root; 
        // 检查/创建指定根文件夹（异步逻辑包裹在自执行函数中）
        (async () => {
          const targetFolder = await megaRootNode.children.findOne({ name: MEGA_ROOT_FOLDER });
          if (!targetFolder) {
            await megaRootNode.mkdir(MEGA_ROOT_FOLDER);
            console.log(`✅ 已创建MEGA根文件夹: ${MEGA_ROOT_FOLDER}`);
          }
        })();
        resolve(); // 就绪后通知服务启动
      });

      // 监听MEGA客户端错误
      megaClient.on('error', (err) => {
        console.error('❌ MEGA客户端异常:', err.message);
        megaClient = null;
        megaRootNode = null;
        reject(err);
      });

      // 补充：监听连接关闭事件，增强容错
      megaClient.on('close', () => {
        console.warn('⚠️ MEGA客户端连接已关闭');
        megaClient = null;
        megaRootNode = null;
      });

    } catch (err) {
      console.error('❌ MEGA初始化失败:', err.message);
      megaClient = null;
      megaRootNode = null;
      reject(err);
    }
  });
}

// ========== 图片上传中间件 ==========
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 限制10MB以内的图片
});

// ========== 核心接口 ==========
/**
 * 1. 测试接口：验证前后端连通性
 */
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    msg: '前后端連通成功！所有功能已兼容运行',
    time: new Date().toString(),
    env: {
      hasMegaConfig: !!MEGA_EMAIL && !!MEGA_PASSWORD
    }
  });
});

/**
 * 2. MEGA连接测试接口（核心！排查MEGA问题用）
 */
app.get('/api/test-mega', async (req, res) => {
  try {
    // 第一步：检查环境变量
    if (!MEGA_EMAIL || !MEGA_PASSWORD) {
      return res.status(200).json({
        success: false,
        msg: 'MEGA配置缺失',
        detail: {
          error: 'MEGA_EMAIL或MEGA_PASSWORD未配置',
          tip: '请在Zeabur的环境变量中添加MEGA_EMAIL和MEGA_PASSWORD'
        },
        time: new Date().toString()
      });
    }

    // 第二步：检查客户端是否初始化
    if (!megaClient) {
      // 尝试重新初始化
      await initMegaClient();
      if (!megaClient) {
        return res.status(200).json({
          success: false,
          msg: 'MEGA客户端初始化失败',
          detail: {
            error: '无法创建MEGA客户端连接',
            tip: '请检查账号密码是否正确，或MEGA服务器是否可访问'
          },
          time: new Date().toString()
        });
      }
    }

    // 第三步：验证客户端是否就绪
    if (!megaRootNode) {
      return res.status(200).json({
        success: false,
        msg: 'MEGA客户端未就绪',
        detail: {
          error: 'MEGA已登录但未获取到根文件夹',
          tip: '稍等几秒后重试，或检查MEGA账号是否正常'
        },
        time: new Date().toString()
      });
    }

    // 第四步：测试文件夹访问
    const targetFolder = await megaRootNode.children.findOne({ name: MEGA_ROOT_FOLDER });
    res.status(200).json({
      success: true,
      msg: 'MEGA连接测试成功',
      detail: {
        email: MEGA_EMAIL,
        rootFolder: MEGA_ROOT_FOLDER,
        folderExists: !!targetFolder,
        tip: targetFolder ? '根文件夹已存在' : '根文件夹将在首次上传时创建'
      },
      time: new Date().toString()
    });

  } catch (err) {
    // 捕获所有异常，避免服务崩溃
    res.status(200).json({
      success: false,
      msg: 'MEGA连接测试失败',
      detail: {
        error: err.message,
        tip: '常见原因：账号密码错误、MEGA服务器限制、网络问题'
      },
      time: new Date().toString()
    });
  }
});

/**
 * 3. MEGA图片上传接口
 */
app.post('/api/upload-to-mega', upload.single('image'), async (req, res) => {
  try {
    // 基础参数校验
    const { room, fileName } = req.body;
    if (!room || !req.file) {
      return res.status(400).json({
        success: false,
        msg: '房號和圖片為必填参数'
      });
    }

    // 检查MEGA客户端是否可用
    if (!megaClient || !megaRootNode) {
      return res.status(200).json({
        success: false,
        msg: 'MEGA服務暫時不可用',
        detail: '请先配置并测试MEGA连接（/api/test-mega）'
      });
    }

    // 查找/创建根文件夹
    let rootFolder = await megaRootNode.children.findOne({ name: MEGA_ROOT_FOLDER });
    if (!rootFolder) {
      rootFolder = await megaRootNode.mkdir(MEGA_ROOT_FOLDER);
    }

    // 查找/创建房间文件夹
    let roomFolder = await rootFolder.children.findOne({ name: room });
    if (!roomFolder) {
      roomFolder = await rootFolder.mkdir(room);
    }

    // 上传图片文件
    const finalFileName = fileName || `upload_${Date.now()}.${req.file.originalname.split('.').pop()}`;
    const uploadFile = await roomFolder.upload({
      name: finalFileName,
      size: req.file.size,
      attributes: { type: req.file.mimetype }
    }, req.file.buffer);

    // 生成公开访问链接
    await uploadFile.link();

    // 返回上传结果
    res.json({
      success: true,
      msg: '圖片上傳成功',
      data: {
        fileId: uploadFile.id,
        fileName: uploadFile.name,
        fileLink: uploadFile.publicUrl,
        room: room
      }
    });

  } catch (err) {
    console.error('❌ MEGA上传失败:', err);
    res.status(200).json({
      success: false,
      msg: '圖片上傳失敗',
      error: err.message,
      tip: '请检查MEGA连接或文件大小（限制10MB）'
    });
  }
});

/**
 * 4. 新增：创建以房号命名的MEGA文件夹接口（专属接口）
 */
app.post('/api/create-mega-room-folder', async (req, res) => {
  try {
    // 1. 接收并校验前端传递的房号参数
    const { room } = req.body;
    if (!room) {
      return res.status(400).json({
        success: false,
        msg: '房號為必填参数，無法創建文件夾'
      });
    }

    // 2. 检查MEGA客户端是否可用（复用现有容错逻辑）
    if (!megaClient || !megaRootNode) {
      // 尝试重新初始化MEGA客户端
      await initMegaClient();
      if (!megaClient || !megaRootNode) {
        return res.status(200).json({
          success: false,
          msg: 'MEGA服務暫時不可用',
          detail: '請先測試MEGA連接（/api/test-mega），或稍後重試'
        });
      }
    }

    // 3. 查找/创建根文件夹（guangda-city）
    let rootFolder = await megaRootNode.children.findOne({ name: MEGA_ROOT_FOLDER });
    if (!rootFolder) {
      rootFolder = await megaRootNode.mkdir(MEGA_ROOT_FOLDER);
      console.log(`✅ 已創建MEGA根文件夾: ${MEGA_ROOT_FOLDER}`);
    }

    // 4. 校验房号格式（过滤MEGA禁止的非法字符）
    const validRoomName = room.replace(/[\/:*?"<>|]/g, '');
    if (validRoomName !== room) {
      console.warn(`⚠️ 房號包含非法字符，已自動處理為: ${validRoomName}`);
    }

    // 5. 查找/创建房号对应的文件夹
    let roomFolder = await rootFolder.children.findOne({ name: validRoomName });
    if (roomFolder) {
      // 文件夹已存在，直接返回成功（避免重复创建）
      return res.json({
        success: true,
        msg: '文件夾已存在，無需重複創建',
        data: {
          room: validRoomName,
          folderName: validRoomName,
          rootFolder: MEGA_ROOT_FOLDER,
          folderId: roomFolder.id
        }
      });
    }

    // 6. 新建房号文件夹
    roomFolder = await rootFolder.mkdir(validRoomName);
    console.log(`✅ 已在MEGA創建房號文件夾: ${validRoomName}（隸屬於${MEGA_ROOT_FOLDER}）`);

    // 7. 返回创建结果
    res.json({
      success: true,
      msg: '房號文件夾創建成功',
      data: {
        room: validRoomName,
        folderName: validRoomName,
        rootFolder: MEGA_ROOT_FOLDER,
        folderId: roomFolder.id
      }
    });

  } catch (err) {
    console.error('❌ MEGA文件夾創建失敗:', err);
    res.status(200).json({
      success: false,
      msg: '房號文件夾創建失敗',
      error: err.message,
      tip: '常見原因：房號格式非法、MEGA服務器限制、網絡問題'
    });
  }
});

// ========== 启动服务（等待MEGA初始化完成后启动） ==========
const PORT = process.env.PORT || 3000;
initMegaClient().then(() => {
  app.listen(PORT, () => {
    console.log(`✅ 後端服務已啟動 → http://localhost:${PORT}`);
    console.log(`✅ 测试接口：/api/test（前后端连通）`);
    console.log(`✅ MEGA测试接口：/api/test-mega（排查MEGA问题）`);
    console.log(`✅ 上传接口：/api/upload-to-mega（图片上传到MEGA）`);
    console.log(`✅ 创夹接口：/api/create-mega-room-folder（创建房号MEGA文件夹）`);
  });
}).catch((err) => {
  console.error('❌ MEGA初始化失败，服务启动异常:', err.message);
  process.exit(1); // 初始化失败退出进程，便于Zeabur重启重试
});