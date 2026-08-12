import React, { useEffect, useState } from 'react';
import { billingAPI } from '../utils/api';

const SEVERITY_BADGE = { high: 'badge-red', medium: 'badge-amber', low: 'badge-blue' };
const TYPE_ICON = {
  high_charge:      '💰',
  missing_pharmacy: '💊',
  pending_lab:      '🧪',
  long_admission:   '🛏️',
  overpayment_risk: '⚠️',
  duplicate_charge: '🔁',
};
const TYPE_LABEL = {
  high_charge:      'High Charge',
  missing_pharmacy: 'Missing Pharmacy',
  pending_lab:      'Pending Lab',
  long_admission:   'Long Admission',
  overpayment_risk: 'Overpayment Risk',
  duplicate_charge: 'Duplicate Charge',
};

export default function BillingAlerts() {
  const [alerts,   setAlerts]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [scanning, setScanning] = useState(false);
  const [filter,   setFilter]   = useState('all'); // all | high | medium | low

  const load = () => {
    setLoading(true);
    billingAPI.getAlerts()
      .then(r => setAlerts(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const resolve = async (id) => {
    await billingAPI.resolveAlert(id, 1); // user 1 = admin
    load();
  };

  const scan = async () => {
    setScanning(true);
    try {
      const r = await billingAPI.scanAlerts();
      alert(`Scan complete. ${r.data.inserted} new alerts found.`);
      load();
    } catch (e) {
      alert('Scan failed');
    } finally { setScanning(false); }
  };

  const filtered = filter === 'all'
    ? alerts
    : alerts.filter(a => a.severity === filter);

  const counts = alerts.reduce((acc, a) => {
    acc[a.severity] = (acc[a.severity] || 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>🔔 Billing Alerts</h1>
          <p>Smart alerts to catch billing errors before they become problems</p>
        </div>
        <div className="flex gap-2">
          <button className="btn btn-secondary" onClick={scan} disabled={scanning}>
            {scanning ? 'Scanning…' : '🔍 Scan Now'}
          </button>
        </div>
      </div>

      {/* Severity summary */}
      <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'High Priority',   count: counts.high   || 0, color: 'var(--red)',   severity: 'high' },
          { label: 'Medium Priority', count: counts.medium || 0, color: 'var(--amber)', severity: 'medium' },
          { label: 'Low Priority',    count: counts.low    || 0, color: 'var(--blue)',  severity: 'low' },
          { label: 'Total Unresolved',count: alerts.length,      color: 'var(--navy)',  severity: 'all' },
        ].map(s => (
          <div key={s.label}
               className="stat-card"
               style={{ cursor: 'pointer', outline: filter === s.severity ? `2px solid ${s.color}` : 'none' }}
               onClick={() => setFilter(s.severity)}>
            <div className="stat-value" style={{ color: s.color, fontSize: 28 }}>{s.count}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Alert type legend */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 20px' }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-2)' }}>
          Alert Types
        </div>
        <div className="flex gap-3" style={{ flexWrap: 'wrap', fontSize: 12 }}>
          {Object.entries(TYPE_LABEL).map(([type, label]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{TYPE_ICON[type]}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* Alerts list */}
      <div className="card">
        {loading ? (
          <div className="loading">Loading alerts…</div>
        ) : filtered.length === 0 ? (
          <div className="empty" style={{ padding: 48 }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>✅</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>No unresolved alerts</div>
            <div className="text-muted text-sm">
              The billing system looks clean. Run a scan to check for new issues.
            </div>
          </div>
        ) : (
          <div>
            {filtered.map((alert, i) => (
              <div key={alert.alert_id}
                   style={{
                     padding: '14px 20px',
                     borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                     display: 'flex',
                     alignItems: 'flex-start',
                     gap: 14,
                   }}>
                {/* Icon */}
                <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>
                  {TYPE_ICON[alert.alert_type]}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div className="flex gap-2 items-center" style={{ marginBottom: 4, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, fontSize: 14 }}>
                      {alert.patient_name}
                    </span>
                    <span className="text-muted text-sm">{alert.phone}</span>
                    <span className={`badge ${SEVERITY_BADGE[alert.severity]}`}>
                      {alert.severity}
                    </span>
                    <span className="badge badge-gray">
                      {TYPE_LABEL[alert.alert_type]}
                    </span>
                    {alert.bill_id && (
                      <span className="badge badge-blue">Bill #{alert.bill_id}</span>
                    )}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-1)', margin: 0, lineHeight: 1.5 }}>
                    {alert.message}
                  </p>
                  <div className="text-muted text-sm" style={{ marginTop: 4 }}>
                    Raised: {new Date(alert.created_at).toLocaleString('en-IN')}
                  </div>
                </div>

                {/* Resolve button */}
                <div style={{ flexShrink: 0 }}>
                  <button
                    className="btn btn-success btn-sm"
                    onClick={() => resolve(alert.alert_id)}
                  >
                    ✓ Resolve
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
