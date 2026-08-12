import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../utils/api';
import './Login.css';

export default function Register() {
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await authAPI.register(form);
      alert('Registration successful! Please login.');
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2>🏥 Join HospitalMS</h2>
        <p>Create your patient account</p>
        
        {error && <div className="alert alert-danger">{error}</div>}
        
        <form onSubmit={handleRegister}>
          <div className="form-group">
            <label>Full Name</label>
            <input 
              type="text" 
              className="input-base"
              value={form.name} 
              onChange={(e) => setForm({ ...form, name: e.target.value })} 
              required 
              placeholder="Enter your full name"
            />
          </div>
          <div className="form-group">
            <label>Email Address</label>
            <input 
              type="email" 
              className="input-base"
              value={form.email} 
              onChange={(e) => setForm({ ...form, email: e.target.value })} 
              required 
              placeholder="you@example.com"
            />
          </div>
          <div className="form-group">
            <label>Phone Number</label>
            <input 
              type="text" 
              className="input-base"
              value={form.phone} 
              onChange={(e) => setForm({ ...form, phone: e.target.value })} 
              required 
              placeholder="e.g. 9876543210"
            />
          </div>
          <div className="form-group">
            <label>Create Password</label>
            <input 
              type="password" 
              className="input-base"
              value={form.password} 
              onChange={(e) => setForm({ ...form, password: e.target.value })} 
              required 
              placeholder="Minimal 6 characters"
            />
          </div>
          <button type="submit" className="btn btn-primary" style={{width: '100%', marginBottom: '16px'}} disabled={loading}>
            {loading ? 'Registering...' : 'Sign Up'}
          </button>
        </form>

        <div style={{textAlign: 'center'}}>
          <span style={{fontSize: '14px', color: '#64748b'}}>Already have an account? </span>
          <button className="btn-link" onClick={() => navigate('/login')} style={{border: 'none', background: 'none', color: 'var(--blue)', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px'}}>
            Login here
          </button>
        </div>
      </div>
    </div>
  );
}
