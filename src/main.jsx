import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
// 正确引入assets下的index.css
import './assets/index.css'

// 渲染根组件（确保括号完整）
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)