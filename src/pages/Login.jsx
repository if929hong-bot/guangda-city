import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const Login = () => {
  // 表单数据
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });
  // 路由导航
  const navigate = useNavigate();

  // 输入框变化
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // 登录提交
  const handleSubmit = (e) => {
    e.preventDefault();
    // 这里可以加真实接口请求，先模拟登录成功
    if (formData.phone && formData.password) {
      alert('登录成功！');
      navigate('/user'); // 跳转到用户主页
    } else {
      alert('请填写手机号和密码');
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">租客登录</h2>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label>手机号</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              placeholder="请输入手机号"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label>密码</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="请输入密码"
              required
              className="form-input"
            />
          </div>
          <button type="submit" className="login-btn">登录</button>
          <div className="register-link">
            还没有账号？<Link to="/register">立即注册</Link>
          </div>
        </form>
      </div>
    </div>
  );
};

// 内联样式（也可以放到index.css中）
Login.style = `
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80vh;
  padding: 20px;
}
.login-card {
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 400px;
}
.login-title {
  text-align: center;
  color: #1f4e8c;
  margin-bottom: 20px;
}
.form-group {
  margin-bottom: 15px;
}
.form-group label {
  display: block;
  margin-bottom: 5px;
  color: #333;
}
.form-input {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 16px;
}
.login-btn {
  width: 100%;
  padding: 12px;
  background: #1f4e8c;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 16px;
  cursor: pointer;
  margin-top: 10px;
}
.login-btn:hover {
  background: #183d6d;
}
.register-link {
  text-align: center;
  margin-top: 15px;
  color: #666;
}
.register-link a {
  color: #1f4e8c;
  text-decoration: none;
}
.register-link a:hover {
  text-decoration: underline;
}
`;

// 将样式注入全局
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = Login.style;
  document.head.appendChild(style);
}

export default Login;