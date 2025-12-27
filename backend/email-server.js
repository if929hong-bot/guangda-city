// email-server.js
// 加載環境變量（Zeabur會配置，本地測試可創建.env文件）
require('dotenv').config(); 

const express = require('express');
const cors = require('cors');
const redis = require('redis');
const sgMail = require('@sendgrid/mail');

// 核心：從環境變量讀取API Key（無明文！）
// Zeabur中配置的環境變量名為 SENDGRID_API_KEY
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const app = express();

// 跨域配置（正式環境替換為你的前端域名，比如https://guangda-city.zeabur.app）
app.use(cors({
  origin: '*', // 測試階段放寬，正式環境鎖定前端域名
  methods: ['POST'],
  allowedHeaders: ['Content-Type']
}));

// 解析JSON請求體
app.use(express.json());

// Redis配置（兼容內存存儲，無需本地安裝Redis）
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379' // Redis地址也從環境變量讀取
});
// Redis連接失敗時自動切換內存存儲，不影響功能
redisClient.connect().catch(err => {
  console.log('Redis連接失敗，自動切換為內存存儲驗證碼：', err.message);
});

// 生成6位隨機驗證碼
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// 接口1：發送驗證碼到信箱
app.post('/api/send-email-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    // 驗證信箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.json({ success: false, message: '信箱格式錯誤' });
    }

    // 生成驗證碼
    const code = generateCode();
    const expireTime = 300; // 5分鐘有效期

    // 發送郵件（發件人必須是SendGrid驗證過的信箱）
    await sgMail.send({
      from: '廣大城租客管理 <if929hong@gmail.com>', // 替換為你SendGrid驗證的發件人信箱
      to: email,
      subject: '密碼重置驗證碼',
      html: `
        <div style="font-family: Microsoft JhengHei; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1f4e8c;">密碼重置驗證碼</h2>
          <p>您好！您正在申請重置廣大城租客管理系統的密碼，驗證碼如下：</p>
          <div style="font-size: 24px; font-weight: bold; color: #1f4e8c; margin: 20px 0;">${code}</div>
          <p>驗證碼有效期為 <strong>5 分鐘</strong>，請勿將驗證碼告知他人。</p>
          <p>若未申請重置密碼，請忽略此郵件。</p>
          <p style="color: #999; margin-top: 30px;">廣大城租客管理系統 © 2025</p>
        </div>
      `
    });

    // 存儲驗證碼（Redis優先，失敗則用內存）
    try {
      await redisClient.set(`email_code_${email}`, code, { EX: expireTime });
    } catch (redisErr) {
      global.emailCodes = global.emailCodes || {};
      global.emailCodes[email] = { code, expire: Date.now() + expireTime * 1000 };
    }

    res.json({ 
      success: true, 
      message: '驗證碼已發送至您的信箱，請查收（含垃圾郵件夾）' 
    });
  } catch (error) {
    console.error('郵件發送失敗：', error);
    // 捕獲SendGrid詳細錯誤
    const errorMsg = error.response?.body?.errors?.[0]?.message || error.message || '伺服器錯誤';
    res.json({ success: false, message: '發送失敗：' + errorMsg });
  }
});

// 接口2：驗證驗證碼是否有效
app.post('/api/verify-email-code', async (req, res) => {
  try {
    const { email, code } = req.body;
    let storedCode = null;
    let isExpired = false;

    // 讀取驗證碼（Redis優先）
    try {
      storedCode = await redisClient.get(`email_code_${email}`);
    } catch (redisErr) {
      // Redis失敗時讀取內存
      const storedData = global.emailCodes?.[email];
      storedCode = storedData?.code;
      isExpired = storedData && Date.now() > storedData.expire;
    }

    if (!storedCode || isExpired) {
      return res.json({ success: false, message: '驗證碼已過期或不存在' });
    }

    if (storedCode !== code) {
      return res.json({ success: false, message: '驗證碼錯誤' });
    }

    // 驗證成功後刪除驗證碼（防止重複使用）
    try {
      await redisClient.del(`email_code_${email}`);
    } catch (redisErr) {
      delete global.emailCodes?.[email];
    }

    res.json({ success: true, message: '驗證成功' });
  } catch (error) {
    res.json({ success: false, message: '驗證失敗：' + error.message });
  }
});

// 啟動服務（兼容Zeabur隨機端口）
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`郵件服務已啟動，端口：${PORT}`);
  console.log('SendGrid API Key 來源：環境變量（安全）');
});