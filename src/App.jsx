import Router from './routes/Router';
import './assets/index.css'; 

function App() {
  return (
    <div className="app-container">
      {/* 页面标题（全局显示） */}
      <h1 className="page-title text-center py-4 text-2xl text-[#1f4e8c] font-bold">
        廣大城租客管理
      </h1>
      {/* 路由内容区域 */}
      <Router />
    </div>
  );
}

export default App;