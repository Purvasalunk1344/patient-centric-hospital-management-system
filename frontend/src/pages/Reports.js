import React, { useState, useEffect } from 'react';
import { reportsAPI } from '../utils/api';

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [activeReportId, setActiveReportId] = useState(null);
  const [activeReport, setActiveReport] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    reportsAPI.list()
      .then(res => {
        setReports(res.data);
        if (res.data.length > 0) setActiveReportId(res.data[0].id);
      })
      .catch(err => setError('Failed to load reports list.'));
  }, []);

  useEffect(() => {
    if (activeReportId) {
      setLoading(true);
      setError(null);
      reportsAPI.run(activeReportId)
        .then(res => {
          setActiveReport(reports.find(r => r.id === activeReportId));
          setData(res.data.data);
          setLoading(false);
        })
        .catch(err => {
          setError('Failed to execute report.');
          setLoading(false);
        });
    }
  }, [activeReportId, reports]);

  const categories = [...new Set(reports.map(r => r.category))];
  const filteredReports = reports.filter(r => 
    r.title.toLowerCase().includes(search.toLowerCase()) || 
    r.description.toLowerCase().includes(search.toLowerCase()) ||
    r.category.toLowerCase().includes(search.toLowerCase())
  );

  const exportCSV = () => {
    if (!data || data.length === 0) return;
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(row => Object.values(row).map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob([headers + '\n' + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeReport?.title || 'report'}.csv`;
    a.click();
  };

  const renderValue = (val) => {
    if (val === null || val === undefined) return <span className="text-muted">—</span>;
    if (typeof val === 'number') {
        if (val % 1 !== 0) return val.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        return val.toLocaleString();
    }
    return String(val);
  };

  return (
    <div className="reports-container">
      <div className="page-header">
        <div>
          <h1>Hospital Intelligence</h1>
          <p>Execute deep-dive SQL queries across all hospital modules</p>
        </div>
        <div className="flex gap-2">
            <div className="search-bar">
                <span className="search-icon">🔍</span>
                <input 
                    type="text" 
                    className="form-control" 
                    placeholder="Search reports..." 
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>
            {data && (
                <button className="btn btn-secondary" onClick={exportCSV}>
                    📥 Export CSV
                </button>
            )}
        </div>
      </div>

      <div className="reports-layout">
        {/* Sidebar */}
        <aside className="reports-sidebar">
          {categories.map(cat => {
            const catReports = filteredReports.filter(r => r.category === cat);
            if (catReports.length === 0) return null;
            return (
              <div key={cat} className="report-group">
                <div className="report-group-title">{cat}</div>
                {catReports.map(r => (
                  <button
                    key={r.id}
                    className={`report-item ${activeReportId === r.id ? 'active' : ''}`}
                    onClick={() => setActiveReportId(r.id)}
                  >
                    <div className="report-item-title">{r.title}</div>
                    <div className="report-item-desc">{r.description.substring(0, 45)}...</div>
                  </button>
                ))}
              </div>
            );
          })}
        </aside>

        {/* Main Content */}
        <main className="reports-main">
          {activeReport ? (
            <div className="card">
              <div className="card-header" style={{ borderBottom: '1px solid var(--border)', paddingBottom: 15, marginBottom: 20 }}>
                <div>
                  <div className="badge badge-blue" style={{ marginBottom: 8 }}>{activeReport.category}</div>
                  <h2 style={{ fontSize: 18, fontWeight: 600 }}>{activeReport.title}</h2>
                  <p className="card-sub" style={{ fontSize: 13, marginTop: 4 }}>{activeReport.description}</p>
                </div>
              </div>

              {loading ? (
                <div className="loading">⚡ Running clinical query...</div>
              ) : error ? (
                <div className="empty" style={{ color: 'var(--red)' }}>❌ {error}</div>
              ) : data && data.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        {Object.keys(data[0]).map(k => (
                          <th key={k}>{k.replace(/_/g, ' ')}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.map((row, i) => (
                        <tr key={i}>
                          {Object.values(row).map((val, j) => (
                            <td key={j}>{renderValue(val)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty">No data returned for this query.</div>
              )}
            </div>
          ) : (
            <div className="empty" style={{ padding: 100 }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>📊</div>
                <h3>Select a report to analyze</h3>
                <p>Choose from the sidebar to execute advanced analytical queries.</p>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .reports-container { display: flex; flex-direction: column; height: calc(100vh - 120px); }
        .reports-layout { display: flex; gap: 24px; flex: 1; min-height: 0; }
        
        .reports-sidebar { 
            width: 280px; 
            background: var(--surface); 
            border: 1px solid var(--border);
            border-radius: var(--radius-lg);
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            padding: 10px;
        }
        
        .report-group { margin-bottom: 16px; }
        .report-group-title { 
            padding: 8px 12px; 
            font-size: 10px; 
            font-weight: 700; 
            text-transform: uppercase; 
            color: var(--text-3);
            letter-spacing: 0.05em;
        }
        
        .report-item {
            width: 100%;
            text-align: left;
            padding: 10px 12px;
            border-radius: var(--radius);
            background: transparent;
            border: none;
            transition: all 0.2s;
            margin-bottom: 2px;
        }
        .report-item:hover { background: var(--surface2); }
        .report-item.active { background: var(--blue-lt); color: var(--blue); }
        
        .report-item-title { font-size: 13px; font-weight: 600; }
        .report-item-desc { font-size: 11px; color: var(--text-3); margin-top: 2px; }
        .report-item.active .report-item-desc { color: var(--blue); opacity: 0.7; }
        
        .reports-main { flex: 1; overflow-y: auto; display: flex; flex-direction: column; min-width: 0; }
        .reports-main .card { flex: 1; display: flex; flex-direction: column; }
        .reports-main .table-wrap { flex: 1; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius); }
        
        thead th { position: sticky; top: 0; z-index: 1; background: var(--surface2); }
      `}</style>
    </div>
  );
}
