import React, { useEffect, useState } from 'react';
import { appointmentsAPI, patientsAPI, doctorsAPI } from '../utils/api';
import { useAuth } from '../utils/AuthContext';

const STATUS_BADGE = {
  scheduled:  'badge-blue',
  completed:  'badge-green',
  cancelled:  'badge-red',
  no_show:    'badge-amber',
};

const EMPTY = { patient_id:'', doctor_id:'', appt_date:'', appt_time:'', notes:'' };

export default function Appointments() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [appts,    setAppts]    = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors,  setDoctors]  = useState([]);
  const [filter,   setFilter]   = useState({ date: new Date().toISOString().slice(0,10), status: '' });
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);

  const load = () => {
    const params = {};
    if (filter.date)   params.date   = filter.date;
    if (filter.status) params.status = filter.status;
    appointmentsAPI.getAll(params).then(r => setAppts(r.data)).catch(() => {});
  };

  useEffect(() => { load(); }, [filter]);
  useEffect(() => {
    if (isAdmin) {
      patientsAPI.getAll().then(r => setPatients(r.data)).catch(() => {});
    }
    doctorsAPI.getAll().then(r => setDoctors(r.data)).catch(() => {});
  }, [isAdmin]);

  const submit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await appointmentsAPI.create(form);
      setModal(false); setForm(EMPTY); load();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  const updateStatus = async (id, status) => {
    await appointmentsAPI.updateStatus(id, status);
    load();
  };

  return (
    <div>
      <div className="page-header">
        <div><h1>Appointments</h1><p>{appts.length} appointments found</p></div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>+ Book Appointment</button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: 16, padding: '14px 20px' }}>
        <div className="flex gap-3 items-center">
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Date</label>
            <input type="date" className="form-control" value={filter.date}
                   onChange={e => setFilter({ ...filter, date: e.target.value })} />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label>Status</label>
            <select className="form-control" value={filter.status}
                    onChange={e => setFilter({ ...filter, status: e.target.value })}>
              <option value="">All</option>
              <option value="scheduled">Scheduled</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          <button className="btn btn-secondary" style={{ marginTop: 18 }}
                  onClick={() => setFilter({ date: '', status: '' })}>Clear</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Token</th><th>Patient</th><th>Doctor</th><th>Dept</th>
                <th>Date</th><th>Time</th><th>Fee</th><th>Status</th>
                {isAdmin && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {appts.length === 0 ? (
                <tr><td colSpan={isAdmin ? 9 : 8} className="empty">No appointments found</td></tr>
              ) : appts.map(a => (
                <tr key={a.appt_id}>
                  <td><span className="badge badge-gray">#{a.token_no}</span></td>
                  <td className="font-bold">{a.patient_name}</td>
                  <td>{a.doctor_name}</td>
                  <td><span className="badge badge-purple">{a.dept_name}</span></td>
                  <td>{new Date(a.appt_date).toLocaleDateString('en-IN')}</td>
                  <td className="text-mono">{a.appt_time?.slice(0,5)}</td>
                  <td className="text-mono">₹{a.consultation_fee}</td>
                  <td><span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>{a.status}</span></td>
                  {isAdmin && (
                    <td>
                      {a.status === 'scheduled' && (
                        <div className="flex gap-2">
                          <button className="btn btn-success btn-sm"
                                  onClick={() => updateStatus(a.appt_id, 'completed')}>✓ Done</button>
                          <button className="btn btn-danger btn-sm"
                                  onClick={() => updateStatus(a.appt_id, 'cancelled')}>✕</button>
                        </div>
                      )}
                    </td>
                  )}
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
              <h2>Book Appointment</h2>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-grid">
                  {isAdmin ? (
                    <div className="form-group">
                      <label>Patient *</label>
                      <select className="form-control" required value={form.patient_id}
                              onChange={e => setForm({...form, patient_id: e.target.value})}>
                        <option value="">Select patient…</option>
                        {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.name} — {p.phone}</option>)}
                      </select>
                    </div>
                  ) : (
                    <div className="form-group">
                      <label>Booking For</label>
                      <input className="form-control" value={user?.name || 'You'} disabled />
                    </div>
                  )}
                  <div className="form-group">
                    <label>Doctor *</label>
                    <select className="form-control" required value={form.doctor_id}
                            onChange={e => setForm({...form, doctor_id: e.target.value})}>
                      <option value="">Select doctor…</option>
                      {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.name} ({d.dept_name})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Date *</label>
                    <input type="date" className="form-control" required value={form.appt_date}
                           onChange={e => setForm({...form, appt_date: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Time *</label>
                    <input type="time" className="form-control" required value={form.appt_time}
                           onChange={e => setForm({...form, appt_time: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Notes</label>
                    <textarea className="form-control" rows={2} value={form.notes}
                              onChange={e => setForm({...form, notes: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Booking…' : 'Book Appointment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
