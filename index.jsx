import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // 需同时创建src/App.jsx组件文件

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);