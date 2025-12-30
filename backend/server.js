require('dotenv').config(); // Zeabur会自动忽略，本地开发生效
const express = require('express');
const cors = require('cors');
const { Mega } = require('megajs'); // 适配megajs模块
const sgMail = require('@sendgrid/mail');
const multer = require('multer');
const { Buffer } = require('buffer');

// 初始化Express应用
const app = express();
app.use(cors()); // 强制跨域，解决前后端跨域问题
app.use(express.json({ limit: '10mb' })); // 支持大文件JSON解析

// ========== 环境变量配置 ==========
// SendGrid配置
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('⚠️ SENDGRID_API_KEY未配置，邮件功能进入测试模式');
}

// MEGA核心配置（全部从环境变量读取）
const MEGA_EMAIL = process.env.MEGA_EMAIL;
const MEGA_PASSWORD = process.env.MEGA_PASSWORD;
const MEGA_ROOT_FOLDER = process.env.MEGA_ROOT_FOLDER || 'guangda-city';

// ========== MEGA客户端初始化（带容错） ==========
let megaClient = null;
let megaRootNode = null; // 缓存根文件夹节点

// 初始化MEGA客户端
async function initMegaClient() {
  try {
    if (!MEGA_EMAIL || !MEGA_PASSWORD) {
      throw new Error('MEGA_EMAIL/MEGA_PASSWORD环境变量未配置');
    }

    // 创建MEGA客户端实例
    megaClient = new Mega({
      email: MEGA_EMAIL,
      password: MEGA_PASSWORD
    });

    // 监听客户端就绪事件
    megaClient.on('ready', async () => {
      console.log('✅ MEGA客户端登录成功');
      megaRootNode = await megaClient.root; // 获取根文件夹
      // 检查/创建指定根文件夹
      const targetFolder = await megaRootNode.children.findOne({ name: MEGA_ROOT_FOLDER });
      if (!targetFolder) {
        await megaRootNode.mkdir(MEGA_ROOT_FOLDER);
        console.log(`✅ 已创建MEGA根文件夹: ${MEGA_ROOT_FOLDER}`);
      }
    });

    // 监听MEGA客户端错误
    megaClient.on('error', (err) => {
      console.error('❌ MEGA客户端异常:', err.message);
      megaClient = null;
      megaRootNode = null;
    });

  } catch (err) {
    console.error('❌ MEGA初始化失败:', err.message);
    megaClient = null;
    megaRootNode = null;
  }
}

// 启动时初始化MEGA
initMegaClient();

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
      hasSendGrid: !!SENDGRID_API_KEY,
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
        msg: 'MEGA服务暂时不可用',
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
 * 4. 密码重置邮件发送接口
 */
app.post('/api/send-reset-email', async (req, res) => {
  try {
    const { email, resetToken, tenantName } = req.body;
    if (!email || !resetToken) {
      return res.status(400).json({
        success: false,
        msg: '信箱和重置令牌為必填参数'
      });
    }

    // 构建重置链接（替换为你的前端域名）
    const resetLink = `https://你的前端域名/reset-password.html?token=${resetToken}&email=${email}`;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL || 'if929hong@gmail.com';

    // 邮件内容
    const msg = {
      to: email,
      from: fromEmail,
      subject: '廣大城租客管理 - 密碼重置申請',
      html: `
        <h3>親愛的 ${tenantName || '租客'} 您好：</h3>
        <p>您申請了密碼重置，請點擊下方鏈接完成重置（鏈接有效期1小時）：</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>若非您本人操作，請忽略此郵件。</p>
      `
    };

    // 发送邮件（测试模式容错）
    if (SENDGRID_API_KEY) {
      await sgMail.send(msg);
      res.json({
        success: true,
        msg: '重置郵件已發送，請檢查信箱'
      });
    } else {
      res.json({
        success: true,
        msg: '测试模式：邮件已模拟发送（未配置SENDGRID_API_KEY）',
        detail: `目标邮箱：${email}，重置链接：${resetLink}`
      });
    }

  } catch (err) {
    console.error('❌ 邮件发送失败:', err);
    res.status(500).json({
      success: false,
      msg: '郵件發送失敗',
      error: err.message || 'SendGrid配置錯誤或信箱無效'
    });
  }
});

// ========== 启动服务 ==========
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 後端服務已啟動 → http://localhost:${PORT}`);
  console.log(`✅ 测试接口：/api/test（前后端连通）`);
  console.log(`✅ MEGA测试接口：/api/test-mega（排查MEGA问题）`);
  console.log(`✅ 上传接口：/api/upload-to-mega（图片上传到MEGA）`);
  console.log(`✅ 邮件接口：/api/send-reset-email（密码重置邮件）`);
});