import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import './Login.css';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      login(data.token, data.user);
      
      if (data.user.role === 'patient') {
        navigate('/dashboard');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🏥 HospitalMS Login</h2>
        <p>Please sign in to continue</p>
        
        {error && <div className="alert alert-danger">{error}</div>}
        
        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-base"
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              placeholder="e.g. admin@hospital.com"
            />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input 
              type="password" 
              className="input-base"
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
              placeholder="Enter your password"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginBottom: '16px'}}>
            Sign In
          </button>
        </form>

        <div style={{textAlign: 'center', marginBottom: '20px'}}>
          <span style={{fontSize: '14px', color: '#64748b'}}>Don't have an account? </span>
          <button className="btn-link" onClick={() => navigate('/register')} style={{border: 'none', background: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'}}>
            Register here
          </button>
        </div>
        
        <div style={{marginTop: '20px', fontSize: '12px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '15px'}}>
          <p style={{marginBottom: '5px'}}><strong>Demo Admin:</strong> admin@hospital.com / hashed_pw_1</p>
          <p><strong>Demo Patient:</strong> anil@hospital.com / hashed_pw_4</p>
        </div>
      </div>
    </div>
  );
}
