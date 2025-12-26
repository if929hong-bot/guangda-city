import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 确保配置对象闭合，无语法错误
export default defineConfig({
  plugins: [react()]
})