// env-config.js - 环境变量配置文件（修改此处即可切换环境，无需改动业务代码）
const ENV_CONFIG = {
  // R2 核心配置：替换为你的实际 R2 公开访问地址，确保前后端一致
  R2_PUBLIC_URL: "https://pub-8931ead8377a4cd595e51d38fb210975.r2.dev",
  // 可选配置：限制图片格式，提升上传稳定性
  R2_ALLOWED_FORMATS: ["jpg", "png", "jpeg"],
  // 可选配置：限制图片大小（5MB），避免大文件上传崩溃
  R2_MAX_FILE_SIZE: 5 * 1024 * 1024 // 字节数
};