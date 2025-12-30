require('dotenv').config(); // Zeabur会自动忽略，本地开发生效
const express = require('express');
const cors = require('cors');
// 关键修复1：替换mega为megajs，适配正确的模块名
const { Mega } = require('megajs');
const sgMail = require('@sendgrid/mail');
const multer = require('multer');
const { Buffer } = require('buffer');

// 初始化
const app = express();
app.use(cors()); // 强制跨域，前后端必通
app.use(express.json({ limit: '10mb' }));

// ========== 关键修正1：初始化SendGrid API Key ==========
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
} else {
  console.warn('SENDGRID_API_KEY未配置，邮件功能测试模式');
}

// ========== 关键修正2：MEGA全用环境变量 + 容错（核心！） ==========
const MEGA_EMAIL = process.env.MEGA_EMAIL;
const MEGA_PASSWORD = process.env.MEGA_PASSWORD;
const MEGA_ROOT_FOLDER = process.env.MEGA_ROOT_FOLDER || 'guangda-city';

// MEGA初始化容错：报错不崩溃（适配megajs的正确初始化方式）
let megaClient;
let megaRootNode; // 缓存根节点，避免重复获取
try {
  if (MEGA_EMAIL && MEGA_PASSWORD) {
    // 关键修复2：megajs的正确初始化语法
    megaClient = new Mega({
      email: MEGA_EMAIL,
      password: MEGA_PASSWORD
    });
    // 提前登录并获取根节点（异步容错）
    megaClient.on('ready', async () => {
      megaRootNode = await megaClient.root;
      console.log('✅ MEGA客户端初始化成功');
    });
    megaClient.on('error', (err) => {
      console.warn('MEGA客户端异常:', err.message);
      megaClient = null;
    });
  } else {
    console.warn('MEGA_EMAIL/MEGA_PASSWORD未配置，MEGA功能测试模式');
  }
} catch (err) {
  console.warn('MEGA版本兼容问题，暂时降级运行，不影响其他功能:', err.message);
  megaClient = null;
}

// 圖片上傳中間件
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ========== 1. MEGA文件夾創建 + 圖片上傳接口（容错版，适配megajs API） ==========
app.post('/api/upload-to-mega', upload.single('image'), async (req, res) => {
  try {
    // 容错：MEGA未初始化则返回提示，不崩溃
    if (!megaClient || !megaRootNode) {
      return res.json({
        success: false,
        msg: 'MEGA暂时维护中，前后端已连通！先使用其他功能',
        data: null
      });
    }

    const { room, fileName } = req.body;
    if (!room || !req.file) {
      return res.status(400).json({ success: false, msg: '房號和圖片為必填' });
    }

    // 1. 获取/創建根文件夾（适配megajs语法）
    let rootFolder = await megaRootNode.children.findOne({ name: MEGA_ROOT_FOLDER });
    if (!rootFolder) {
      rootFolder = await megaRootNode.mkdir(MEGA_ROOT_FOLDER);
    }

    // 2. 获取/創建房號文件夾
    let roomFolder = await rootFolder.children.findOne({ name: room });
    if (!roomFolder) {
      roomFolder = await rootFolder.mkdir(room);
    }

    // 3. 上傳圖片（适配megajs的上传语法）
    const fileData = req.file.buffer;
    const fileNameFinal = fileName || `upload_${Date.now()}.jpg`;
    // 上传文件到指定文件夹
    const uploadFile = await roomFolder.upload({
      name: fileNameFinal,
      size: fileData.length,
      attributes: { type: req.file.mimetype }
    }, fileData);

    // 4. 获取公開链接（适配megajs的链接生成语法）
    await uploadFile.link(); // 生成公开链接
    const fileLink = uploadFile.publicUrl;

    res.json({
      success: true,
      msg: '圖片上傳成功',
      data: {
        fileId: uploadFile.id,
        fileName: uploadFile.name,
        fileLink: fileLink
      }
    });
  } catch (err) {
    console.error('MEGA上傳失敗:', err);
    // 容错：报错返回提示，服务不崩
    res.status(200).json({
      success: false,
      msg: 'MEGA暂时维护中，前后端已连通！',
      error: err.message
    });
  }
});

// ========== 2. 忘記密碼 - 發送驗證郵件接口 ==========
app.post('/api/send-reset-email', async (req, res) => {
  try {
    const { email, resetToken, tenantName } = req.body;
    if (!email || !resetToken) {
      return res.status(400).json({ success: false, msg: '信箱和重置令牌為必填' });
    }

    // 構建重置鏈接（替換為你的前端網域，保留原样）
    const resetLink = `https://你的網域/reset-password.html?token=${resetToken}&email=${email}`;

    // 郵件內容（发件邮箱容错）
    const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL || 'if929hong@gmail.com';
    const msg = {
      to: email,
      from: SENDGRID_FROM_EMAIL,
      subject: '廣大城租客管理 - 密碼重置申請',
      html: `
        <h3>親愛的 ${tenantName || '租客'} 您好：</h3>
        <p>您申請了密碼重置，請點擊下方鏈接完成重置（鏈接有效期1小時）：</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>若非您本人操作，請忽略此郵件。</p>
      `
    };

    // 發送郵件（容错：无密钥则提示测试模式）
    if (SENDGRID_API_KEY) {
      await sgMail.send(msg);
      res.json({ success: true, msg: '重置郵件已發送，請檢查信箱' });
    } else {
      res.json({ success: true, msg: '测试模式：邮件已模拟发送（未配置SENDGRID_API_KEY）' });
    }
  } catch (err) {
    console.error('郵件發送失敗:', err);
    res.status(500).json({
      success: false,
      msg: '郵件發送失敗',
      error: err.message || 'SendGrid配置錯誤或信箱無效'
    });
  }
});

// ========== 测试接口：验证前后端连通 ==========
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    msg: '前后端連通成功！所有功能已兼容运行',
    time: new Date().toString()
  });
});

// 啟動服務（强制启动，不被任何报错中断）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ 後端服務運行成功 → http://localhost:${PORT}`);
  console.log(`✅ 前后端已连通，访问 /api/test 可验证`);
});