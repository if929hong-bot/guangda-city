require('dotenv').config();
const express = require('express');
const cors = require('cors');
const Mega = require('mega-js');
const sgMail = require('@sendgrid/mail');
const multer = require('multer');
const { Buffer } = require('buffer');

// 初始化
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// 配置SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// 配置MEGA
const mega = new Mega({
  email: process.env.MEGA_EMAIL,
  password: process.env.MEGA_PASSWORD
});

// 圖片上傳中間件（處理base64或表單上傳）
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// ========== 1. MEGA文件夾創建 + 圖片上傳接口 ==========
app.post('/api/upload-to-mega', upload.single('image'), async (req, res) => {
  try {
    const { room, fileName } = req.body;
    if (!room || !req.file) {
      return res.status(400).json({ success: false, msg: '房號和圖片為必填' });
    }

    // 1. 登錄MEGA（確保會話有效）
    await mega.login();

    // 2. 獲取根文件夾（guangda-city），不存在則創建
    let rootFolder = await mega.getFolder(process.env.MEGA_ROOT_FOLDER);
    if (!rootFolder) {
      rootFolder = await mega.createFolder(process.env.MEGA_ROOT_FOLDER);
    }

    // 3. 獲取對應房號文件夾，不存在則創建
    let roomFolder = await rootFolder.getFolder(room);
    if (!roomFolder) {
      roomFolder = await rootFolder.createFolder(room);
    }

    // 4. 上傳圖片到對應文件夾
    const fileData = req.file.buffer;
    const uploadResult = await roomFolder.upload({
      name: fileName || `upload_${Date.now()}.jpg`,
      size: fileData.length,
      data: fileData
    });

    // 5. 获取文件的公開链接（可选）
    const fileLink = await uploadResult.link();

    res.json({
      success: true,
      msg: '圖片上傳成功',
      data: {
        fileId: uploadResult.id,
        fileName: uploadResult.name,
        fileLink: fileLink
      }
    });
  } catch (err) {
    console.error('MEGA上傳失敗:', err);
    res.status(500).json({ success: false, msg: '圖片上傳失敗', error: err.message });
  }
});

// ========== 2. 忘記密碼 - 發送驗證郵件接口 ==========
app.post('/api/send-reset-email', async (req, res) => {
  try {
    const { email, resetToken, tenantName } = req.body;
    if (!email || !resetToken) {
      return res.status(400).json({ success: false, msg: '信箱和重置令牌為必填' });
    }

    // 構建重置鏈接（替換為你的前端重置密碼頁面）
    const resetLink = `https://你的網域/reset-password.html?token=${resetToken}&email=${email}`;

    // 郵件內容
    const msg = {
      to: email,
      from: process.env.SENDGRID_FROM_EMAIL,
      subject: '廣大城租客管理 - 密碼重置申請',
      html: `
        <h3>親愛的 ${tenantName || '租客'} 您好：</h3>
        <p>您申請了密碼重置，請點擊下方鏈接完成重置（鏈接有效期1小時）：</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>若非您本人操作，請忽略此郵件。</p>
      `
    };

    // 發送郵件
    await sgMail.send(msg);

    res.json({ success: true, msg: '重置郵件已發送，請檢查信箱' });
  } catch (err) {
    console.error('郵件發送失敗:', err);
    res.status(500).json({
      success: false,
      msg: '郵件發送失敗',
      error: err.message || 'SendGrid配置錯誤或信箱無效'
    });
  }
});

// 啟動服務
app.listen(process.env.PORT, () => {
  console.log(`後端服務運行在 http://localhost:${process.env.PORT}`);
});