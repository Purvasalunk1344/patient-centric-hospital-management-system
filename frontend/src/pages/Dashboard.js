import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { dashboardAPI } from '../utils/api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../utils/AuthContext';
import PatientDashboard from '../components/PatientDashboard';

export default function Dashboard() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const nav = useNavigate();

  const [stats,   setStats]   = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [depts,   setDepts]   = useState([]);

  useEffect(() => {
    if (isAdmin) {
      dashboardAPI.getStats().then(r => setStats(r.data)).catch(() => {});
      dashboardAPI.getRevenueChart().then(r => setRevenue(r.data)).catch(() => {});
      dashboardAPI.getDeptStats().then(r => setDepts(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  if (!isAdmin) {
    return <PatientDashboard />;
  }

  const fmt = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Good morning 👋</h1>
          <p>Here's what's happening at the hospital today</p>
        </div>
      </div>

      {/* Admin Stat Cards */}
      <div className="stat-grid">
        {[
          { icon: '👤', label: 'Total Patients',       value: stats?.total_patients      ?? '—', color: 'var(--blue)' },
          { icon: '🛏️', label: 'Active Admissions',    value: stats?.active_admissions   ?? '—', color: 'var(--teal)' },
          { icon: '📅', label: "Today's Appointments", value: stats?.todays_appointments ?? '—', color: 'var(--purple)' },
          { icon: '💰', label: "Today's Collections",  value: fmt(stats?.revenue_today),          color: 'var(--green)' },
          { icon: '🧾', label: 'Pending Bills',        value: stats?.pending_bills       ?? '—', color: 'var(--amber)' },
          { icon: '🛏️', label: 'Beds Available',       value: stats?.beds?.available     ?? '—', color: 'var(--navy)' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Bed occupancy bar */}
      {stats?.beds && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Bed Occupancy</div>
              <div className="card-sub">{stats.beds.occupied} of {stats.beds.total} beds occupied</div>
            </div>
            <span className="badge badge-blue">
              {Math.round(stats.beds.occupied / stats.beds.total * 100)}% full
            </span>
          </div>
          <div className="progress-bar-wrap">
            <div
              className="progress-bar-fill"
              style={{
                width: `${stats.beds.occupied / stats.beds.total * 100}%`,
                background: 'var(--blue)',
              }}
            />
          </div>
        </div>
      )}

      <div className="grid-2">
        {/* Revenue Chart */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Revenue (Last 6 Months)</div>
              <div className="card-sub">Billed vs Collected</div>
            </div>
          </div>
          {revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenue} barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-2)' }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                <Tooltip formatter={(v) => `₹${Number(v).toLocaleString('en-IN')}`} />
                <Bar dataKey="billed"    name="Billed"    fill="var(--blue-lt)"  radius={[4,4,0,0]} />
                <Bar dataKey="collected" name="Collected" fill="var(--blue)"     radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty">No revenue data yet</div>
          )}
        </div>

        {/* Department Stats */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Appointments by Department</div>
            <div className="card-sub">Last 30 days</div>
          </div>
          {depts.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={depts} layout="vertical" barSize={14}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                <YAxis dataKey="dept_name" type="category" width={100} tick={{ fontSize: 11, fill: 'var(--text-2)' }} />
                <Tooltip />
                <Bar dataKey="appointments" name="Total"     fill="var(--teal-lt)" radius={[0,4,4,0]} />
                <Bar dataKey="completed"    name="Completed" fill="var(--teal)"    radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty">No department data yet</div>
          )}
        </div>
      </div>

      {/* Insight Explorer Section */}
      <InsightExplorer />

      {/* Quick Actions */}
      <div className="card mt-4">
        <div className="card-title" style={{ marginBottom: 14 }}>Admin Quick Actions</div>
        <div className="flex gap-2" style={{ flexWrap: 'wrap' }}>
          {[
            { label: '+ New Patient',     to: '/patients'     },
            { label: '+ Appointment',     to: '/appointments' },
            { label: '+ Admit Patient',   to: '/admissions'   },
            { label: '+ Lab Order',       to: '/labs'         },
            { label: '+ Generate Bill',   to: '/billing'      },
            { label: '📊 View All Reports', to: '/reports'      },
          ].map(a => (
            <button key={a.to} className="btn btn-secondary" onClick={() => nav(a.to)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function InsightExplorer() {
  const [reports, setReports] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // Only show a few "featured" ones on dashboard
    const featuredIds = ['b3', 'q7', 'q16', 'q24', 'q31']; 
    import('../utils/api').then(m => {
        m.reportsAPI.list().then(res => {
            const featured = res.data.filter(r => featuredIds.includes(r.id));
            setReports(featured);
            if (featured.length > 0) setSelectedId(featured[0].id);
        });
    });
  }, []);

  useEffect(() => {
    if (selectedId) {
      setLoading(true);
      import('../utils/api').then(m => {
        m.reportsAPI.run(selectedId).then(res => {
          setData(res.data.data);
          setLoading(false);
        }).catch(() => setLoading(false));
      });
    }
  }, [selectedId]);

  if (reports.length === 0) return null;

  return (
    <div className="card mt-4" style={{ minHeight: 300 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Hospital Insight Explorer</div>
          <div className="card-sub">Quickly switch between key performance indicators</div>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={() => nav('/reports')}>
          View All 38 Reports →
        </button>
      </div>

      <div className="flex gap-2" style={{ marginBottom: 16, overflowX: 'auto', paddingBottom: 8 }}>
        {reports.map(r => (
          <button 
            key={r.id} 
            className={`badge ${selectedId === r.id ? 'badge-blue' : 'badge-gray'}`}
            style={{ cursor: 'pointer', border: 'none', whiteSpace: 'nowrap' }}
            onClick={() => setSelectedId(r.id)}
          >
            {r.title}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="loading" style={{ padding: 40 }}>⚡ Fetching latest hospital data...</div>
      ) : data ? (
        <div className="table-wrap" style={{ maxHeight: 300 }}>
          <table style={{ fontSize: 12 }}>
            <thead>
              <tr>
                {Object.keys(data[0] || {}).map(k => <th key={k}>{k.replace(/_/g, ' ')}</th>)}
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 10).map((row, i) => (
                <tr key={i}>
                  {Object.values(row).map((v, j) => (
                    <td key={j}>{typeof v === 'number' ? v.toLocaleString() : String(v || '—')}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {data.length > 10 && (
            <div className="text-muted text-sm" style={{ marginTop: 8, textAlign: 'center' }}>
              Showing top 10 results. View full report for more.
            </div>
          )}
        </div>
      ) : (
        <div className="empty">Select a report to preview data</div>
      )}
    </div>
  );
}
