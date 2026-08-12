import React, { useEffect, useState } from 'react';
import { labsAPI, patientsAPI, doctorsAPI } from '../utils/api';

const STATUS_BADGE = { pending:'badge-amber', processing:'badge-blue', completed:'badge-green', cancelled:'badge-red' };

export default function Labs() {
  const [orders,   setOrders]   = useState([]);
  const [tests,    setTests]    = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors,  setDoctors]  = useState([]);
  const [modal,    setModal]    = useState(false);
  const [resultModal, setResultModal] = useState(null);
  const [form,     setForm]     = useState({ patient_id:'', doctor_id:'', test_id:'' });
  const [result,   setResult]   = useState('');
  const [saving,   setSaving]   = useState(false);

  const load = () => labsAPI.getOrders().then(r => setOrders(r.data)).catch(() => {});
  useEffect(() => {
    load();
    labsAPI.getTests().then(r => setTests(r.data)).catch(() => {});
    patientsAPI.getAll().then(r => setPatients(r.data)).catch(() => {});
    doctorsAPI.getAll().then(r => setDoctors(r.data)).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try { await labsAPI.createOrder(form); setModal(false); load(); }
    catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const submitResult = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await labsAPI.updateResult(resultModal, { result, status: 'completed' });
      setResultModal(null); setResult(''); load();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Lab Tests</h1><p>{orders.length} orders</p></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ New Lab Order</button>
      </div>
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Patient</th><th>Test</th><th>Doctor</th>
                  <th>Ordered</th><th>Price</th><th>Status</th><th>Result</th><th>Action</th></tr>
            </thead>
            <tbody>
              {orders.length === 0
                ? <tr><td colSpan={9} className="empty">No lab orders</td></tr>
                : orders.map(o => (
                  <tr key={o.order_id}>
                    <td className="text-mono text-muted">#{o.order_id}</td>
                    <td className="font-bold">{o.patient_name}</td>
                    <td>{o.test_name}</td>
                    <td>{o.doctor_name}</td>
                    <td className="text-sm">{new Date(o.ordered_date).toLocaleDateString('en-IN')}</td>
                    <td className="text-mono">₹{o.test_price}</td>
                    <td><span className={`badge ${STATUS_BADGE[o.status]||'badge-gray'}`}>{o.status}</span></td>
                    <td className="text-sm" style={{ maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                      {o.result || <span className="text-muted">—</span>}
                    </td>
                    <td>
                      {o.status !== 'completed' && o.status !== 'cancelled' && (
                        <button className="btn btn-success btn-sm" onClick={() => setResultModal(o.order_id)}>
                          Enter Result
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>New Lab Order</h2>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Patient *</label>
                    <select className="form-control" required value={form.patient_id}
                            onChange={e => setForm({...form, patient_id: e.target.value})}>
                      <option value="">Select…</option>
                      {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Ordering Doctor *</label>
                    <select className="form-control" required value={form.doctor_id}
                            onChange={e => setForm({...form, doctor_id: e.target.value})}>
                      <option value="">Select…</option>
                      {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn:'1/-1' }}>
                    <label>Test *</label>
                    <select className="form-control" required value={form.test_id}
                            onChange={e => setForm({...form, test_id: e.target.value})}>
                      <option value="">Select test…</option>
                      {tests.map(t => <option key={t.test_id} value={t.test_id}>{t.test_name} — ₹{t.test_price}</option>)}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Create Order'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {resultModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setResultModal(null)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Enter Lab Result</h2>
              <button className="modal-close" onClick={() => setResultModal(null)}>×</button>
            </div>
            <form onSubmit={submitResult}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Result *</label>
                  <textarea className="form-control" rows={4} required value={result}
                            onChange={e => setResult(e.target.value)}
                            placeholder="Enter test result details…" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setResultModal(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving…' : 'Submit Result'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
