import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import Doctors from './pages/Doctors';
import Appointments from './pages/Appointments';
import Admissions from './pages/Admissions';
import Labs from './pages/Labs';
import Pharmacy from './pages/Pharmacy';
import Billing from './pages/Billing';
import BillDetail from './pages/BillDetail';
import BillingAlerts from './pages/BillingAlerts';
import Login from './pages/Login';
import Register from './pages/Register';
import Reports from './pages/Reports';
import Prescriptions from './pages/Prescriptions';
import { useAuth } from './utils/AuthContext';
import './App.css';

// Redirects to login if not authenticated
function RequireAuth({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

// Redirects patients away from admin-only pages
function RequireAdmin({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/appointments" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
        <Route path="/login"    element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes wrapped in Layout */}
        <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
          <Route index element={<Navigate to="/dashboard" replace />} />

          {/* New: Shared dashboard route (Internal logic handles views) */}
          <Route path="dashboard"    element={<Dashboard />} />

          {/* Admin-only routes */}
          <Route path="patients"     element={<RequireAdmin><Patients /></RequireAdmin>} />
          <Route path="admissions"   element={<RequireAdmin><Admissions /></RequireAdmin>} />
          <Route path="labs"         element={<RequireAdmin><Labs /></RequireAdmin>} />
          <Route path="pharmacy"     element={<RequireAdmin><Pharmacy /></RequireAdmin>} />
          <Route path="reports"      element={<RequireAdmin><Reports /></RequireAdmin>} />
          <Route path="billing/alerts" element={<RequireAdmin><BillingAlerts /></RequireAdmin>} />

          {/* Shared routes (Admin + Patient) */}
          <Route path="doctors"      element={<Doctors />} />
          <Route path="appointments" element={<Appointments />} />
          <Route path="prescriptions" element={<Prescriptions />} />
          <Route path="billing"      element={<Billing />} />
          <Route path="billing/:id"  element={<BillDetail />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

