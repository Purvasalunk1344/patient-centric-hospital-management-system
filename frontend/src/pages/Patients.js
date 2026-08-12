import React, { useEffect, useState } from 'react';
import { patientsAPI } from '../utils/api';

const EMPTY = { name:'', phone:'', dob:'', gender:'', blood_group:'', address:'', emergency_contact:'' };

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search,   setSearch]   = useState('');
  const [modal,    setModal]    = useState(false);
  const [form,     setForm]     = useState(EMPTY);
  const [saving,   setSaving]   = useState(false);

  const load = () => patientsAPI.getAll().then(r => setPatients(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = patients.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.phone.includes(search)
  );

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await patientsAPI.create(form);
      setModal(false); setForm(EMPTY); load();
    } catch (err) { alert(err.response?.data?.error || 'Error saving patient'); }
    finally { setSaving(false); }
  };

  const bloodBadge = (bg) => bg ? <span className="badge badge-red">{bg}</span> : '—';

  return (
    <div>
      <div className="page-header">
        <div><h1>Patients</h1><p>{patients.length} registered patients</p></div>
        <div className="flex gap-2 items-center">
          <div className="search-bar">
            <span className="search-icon">🔍</span>
            <input className="form-control" placeholder="Search name or phone…"
                   value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={() => setModal(true)}>+ Add Patient</button>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th><th>Name</th><th>Phone</th><th>DOB</th>
                <th>Gender</th><th>Blood Group</th><th>Registered</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="empty">No patients found</td></tr>
              ) : filtered.map(p => (
                <tr key={p.patient_id}>
                  <td className="text-mono text-muted">#{p.patient_id}</td>
                  <td className="font-bold">{p.name}</td>
                  <td>{p.phone}</td>
                  <td>{p.dob ? new Date(p.dob).toLocaleDateString('en-IN') : '—'}</td>
                  <td>{p.gender ? p.gender.charAt(0).toUpperCase() + p.gender.slice(1) : '—'}</td>
                  <td>{bloodBadge(p.blood_group)}</td>
                  <td className="text-muted text-sm">
                    {new Date(p.created_at).toLocaleDateString('en-IN')}
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
              <h2>Add New Patient</h2>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={submit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Full Name *</label>
                    <input className="form-control" required value={form.name}
                           onChange={e => setForm({...form, name: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Phone *</label>
                    <input className="form-control" required value={form.phone}
                           onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Date of Birth</label>
                    <input type="date" className="form-control" value={form.dob}
                           onChange={e => setForm({...form, dob: e.target.value})} />
                  </div>
                  <div className="form-group">
                    <label>Gender</label>
                    <select className="form-control" value={form.gender}
                            onChange={e => setForm({...form, gender: e.target.value})}>
                      <option value="">Select…</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Blood Group</label>
                    <select className="form-control" value={form.blood_group}
                            onChange={e => setForm({...form, blood_group: e.target.value})}>
                      <option value="">Select…</option>
                      {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(b =>
                        <option key={b} value={b}>{b}</option>
                      )}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Emergency Contact</label>
                    <input className="form-control" value={form.emergency_contact}
                           onChange={e => setForm({...form, emergency_contact: e.target.value})} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Address</label>
                    <textarea className="form-control" rows={2} value={form.address}
                              onChange={e => setForm({...form, address: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                <button type="submit"  className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
