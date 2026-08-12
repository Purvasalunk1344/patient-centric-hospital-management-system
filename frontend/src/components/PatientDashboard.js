import React, { useEffect, useState } from 'react';
import { dashboardAPI } from '../utils/api';
import { useNavigate } from 'react-router-dom';

export default function PatientDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  useEffect(() => {
    dashboardAPI.getPatientStats()
      .then(r => setStats(r.data))
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="empty">Loading your health overview...</div>;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  return (
    <div className="patient-dashboard">
      <div className="page-header">
        <div>
          <h1>Welcome back 👋</h1>
          <p>Here's a summary of your hospital records</p>
        </div>
      </div>

      <div className="grid-3">
        {/* Next Appointment Card */}
        <div className="card shadow-sm">
          <div className="card-header">
            <div className="card-title">📅 Next Appointment</div>
          </div>
          <div className="card-body">
            {stats?.next_appointment ? (
              <div className="appt-pill" style={{padding: '10px 0'}}>
                <div style={{fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--blue)'}}>
                  {fmtDate(stats.next_appointment.appt_date)} 
                  <span style={{fontSize: '0.9rem', color: 'var(--text-2)', marginLeft: '10px'}}>
                    @{stats.next_appointment.appt_time?.slice(0,5)}
                  </span>
                </div>
                <div style={{marginTop: '8px', fontSize: '0.95rem'}}>
                  Dr. {stats.next_appointment.doctor_name}
                </div>
                <div style={{fontSize: '0.85rem', color: 'var(--text-2)'}}>
                   {stats.next_appointment.dept_name} Department
                </div>
              </div>
            ) : (
              <div className="text-muted">No upcoming appointments scheduled.</div>
            )}
            <button className="btn btn-primary btn-sm mt-3 w-100" onClick={() => nav('/appointments')}>
              Book New Appointment
            </button>
          </div>
        </div>

        {/* Current Admission Card */}
        <div className="card shadow-sm">
          <div className="card-header">
            <div className="card-title">🏥 Current Status</div>
          </div>
          <div className="card-body">
            {stats?.current_admission ? (
              <div>
                <div className="badge badge-teal mb-2">Admitted</div>
                <div style={{fontWeight: 'bold', fontSize: '1.1rem'}}>{stats.current_admission.ward_name}</div>
                <div className="text-muted">Bed: {stats.current_admission.bed_number}</div>
                <div className="text-sm mt-2">Since {fmtDate(stats.current_admission.admit_date)}</div>
              </div>
            ) : (
              <div className="text-muted">You are currently not admitted.</div>
            )}
            <button className="btn btn-secondary btn-sm mt-3 w-100" onClick={() => nav('/doctors')}>
              View Hospital Doctors
            </button>
          </div>
        </div>

        {/* Pending Bill Card */}
        <div className="card shadow-sm border-amber">
          <div className="card-header">
            <div className="card-title">💰 Billing Overview</div>
          </div>
          <div className="card-body">
            <div style={{fontSize: '2rem', fontWeight: 'bold', color: stats?.pending_balance > 0 ? 'var(--amber)' : 'var(--green)'}}>
              ₹{Number(stats?.pending_balance || 0).toLocaleString('en-IN')}
            </div>
            <div className="text-muted">Pending Balance</div>
            <button className="btn btn-outline-amber btn-sm mt-3 w-100" onClick={() => nav('/billing')}>
              Check Invoice Details
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-title">Quick Health Links</div>
        <div className="flex gap-4 mt-3" style={{flexWrap: 'wrap'}}>
            <div className="quick-nav-item" onClick={() => nav('/doctors')} style={{cursor: 'pointer', textAlign: 'center'}}>
                <div style={{fontSize: '1.5rem'}}>👨‍⚕️</div>
                <div style={{fontSize: '0.8rem', fontWeight: '500'}}>Our Doctors</div>
            </div>
            <div className="quick-nav-item" onClick={() => nav('/appointments')} style={{cursor: 'pointer', textAlign: 'center'}}>
                <div style={{fontSize: '1.5rem'}}>📅</div>
                <div style={{fontSize: '0.8rem', fontWeight: '500'}}>My Bookings</div>
            </div>
            <div className="quick-nav-item" onClick={() => nav('/prescriptions')} style={{cursor: 'pointer', textAlign: 'center'}}>
                <div style={{fontSize: '1.5rem'}}>🩺</div>
                <div style={{fontSize: '0.8rem', fontWeight: '500'}}>Prescriptions</div>
            </div>
            <div className="quick-nav-item" onClick={() => nav('/billing')} style={{cursor: 'pointer', textAlign: 'center'}}>
                <div style={{fontSize: '1.5rem'}}>🧾</div>
                <div style={{fontSize: '0.8rem', fontWeight: '500'}}>Payments</div>
            </div>
        </div>
      </div>
    </div>
  );
}
