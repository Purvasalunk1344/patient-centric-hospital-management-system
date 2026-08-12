import React, { useEffect, useState } from 'react';
import { pharmacyAPI } from '../utils/api';

const STOCK_BADGE = { out_of_stock:'badge-red', critical:'badge-red', low:'badge-amber', adequate:'badge-green' };

export default function Pharmacy() {
  const [medicines, setMedicines] = useState([]);
  const [tab,       setTab]       = useState('medicines');
  const [search,    setSearch]    = useState('');

  useEffect(() => {
    pharmacyAPI.getMedicines().then(r => setMedicines(r.data)).catch(() => {});
  }, []);

  const filtered = medicines.filter(m =>
    m.medicine_name.toLowerCase().includes(search.toLowerCase()) ||
    (m.category || '').toLowerCase().includes(search.toLowerCase())
  );

  const lowStock = medicines.filter(m => m.stock_status !== 'adequate');

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pharmacy</h1>
          <p>{medicines.length} medicines in catalogue</p>
        </div>
        {lowStock.length > 0 && (
          <span className="badge badge-red" style={{ fontSize:13, padding:'6px 14px' }}>
            ⚠️ {lowStock.length} low stock alerts
          </span>
        )}
      </div>

      {/* Low stock alert strip */}
      {lowStock.length > 0 && (
        <div className="card" style={{ marginBottom:16, background:'var(--amber-lt)', border:'1px solid var(--amber)' }}>
          <div style={{ fontSize:13, fontWeight:600, marginBottom:8, color:'var(--amber)' }}>⚠️ Stock Alerts</div>
          <div className="flex gap-2" style={{ flexWrap:'wrap' }}>
            {lowStock.map(m => (
              <span key={m.medicine_id} className={`badge ${STOCK_BADGE[m.stock_status]}`}>
                {m.medicine_name} ({m.stock_quantity} left)
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <div className="flex gap-2">
            {['medicines'].map(t => (
              <button key={t} className={`btn ${tab===t ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                      onClick={() => setTab(t)} style={{ textTransform:'capitalize' }}>{t}</button>
            ))}
          </div>
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input className="form-control" placeholder="Search medicine…"
                   value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Medicine</th><th>Category</th><th>Unit</th>
                  <th>Price/Unit</th><th>Stock</th><th>Reorder At</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr><td colSpan={8} className="empty">No medicines found</td></tr>
                : filtered.map(m => (
                  <tr key={m.medicine_id}>
                    <td className="text-mono text-muted">#{m.medicine_id}</td>
                    <td className="font-bold">{m.medicine_name}</td>
                    <td>{m.category || '—'}</td>
                    <td className="badge badge-gray">{m.unit}</td>
                    <td className="text-mono">₹{m.price_per_unit}</td>
                    <td className="text-mono font-bold">{m.stock_quantity}</td>
                    <td className="text-mono text-muted">{m.reorder_level}</td>
                    <td><span className={`badge ${STOCK_BADGE[m.stock_status]||'badge-gray'}`}>
                      {m.stock_status?.replace('_',' ')}
                    </span></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
