import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { admissionsAPI, patientsAPI, doctorsAPI, appointmentsAPI, wardsAPI, billingAPI } from '../utils/api';

const STATUS_BADGE = {
  admitted:    'badge-blue',
  discharged:  'badge-green',
  transferred: 'badge-amber',
};

export default function Admissions() {
  const [admissions, setAdmissions] = useState([]);
  const [patients,   setPatients]   = useState([]);
  const [doctors,    setDoctors]    = useState([]);
  const [beds,       setBeds]       = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [modal,      setModal]      = useState(false);
  const [form,       setForm]       = useState({ patient_id:'', doctor_id:'', appt_id:'', bed_id:'', reason:'' });
  const [saving,     setSaving]     = useState(false);

  // Discharge + bill prompt state
  const [dischargeData,  setDischargeData]  = useState(null); // admission returned after discharge
  const [billPrompt,     setBillPrompt]     = useState(false);
  const [generatingBill, setGeneratingBill] = useState(false);

  const nav = useNavigate();

  const load = () =>
    admissionsAPI.getAll({ status: 'admitted' })
      .then(r => setAdmissions(r.data))
      .catch(() => {});

  useEffect(() => {
    load();
    patientsAPI.getAll().then(r => setPatients(r.data)).catch(() => {});
    doctorsAPI.getAll().then(r => setDoctors(r.data)).catch(() => {});
    wardsAPI.getAvailableBeds().then(r => setBeds(r.data)).catch(() => {});
    appointmentsAPI.getAll({ status: 'completed' }).then(r => setAppointments(r.data)).catch(() => {});
  }, []);

  const admit = async (e) => {
    e.preventDefault(); setSaving(true);
    try {
      await admissionsAPI.admit(form);
      setModal(false);
      setForm({ patient_id:'', doctor_id:'', appt_id:'', bed_id:'', reason:'' });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setSaving(false); }
  };

  // Discharge → show bill prompt with correct day count
  const discharge = async (id) => {
    if (!window.confirm('Discharge this patient?')) return;
    try {
      const r = await admissionsAPI.discharge(id);
      setDischargeData(r.data);  // has days_admitted + total_bed_charge
      setBillPrompt(true);
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Discharge failed');
    }
  };

  // Generate bill immediately after discharge
  const generateBillNow = async () => {
    if (!dischargeData) return;
    setGeneratingBill(true);
    try {
      const res = await billingAPI.generate({
        patient_id:   dischargeData.patient_id,
        admission_id: dischargeData.admission_id,
        appt_id:      null,
        generated_by: 1,
        selected_medicine_ids: [],
        direct_medicines:      [],
        discount_amount:       0,
        discount_reason:       null,
      });
      setBillPrompt(false);
      setDischargeData(null);
      nav(`/billing/${res.data.bill_id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Error generating bill');
    } finally { setGeneratingBill(false); }
  };

  const skipBill = () => {
    setBillPrompt(false);
    setDischargeData(null);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Admissions</h1>
          <p>{admissions.length} patients currently admitted</p>
        </div>
        <button className="btn btn-primary" onClick={() => setModal(true)}>
          + Admit Patient
        </button>
      </div>

      {/* Info banner explaining billing approach */}
      <div style={{
        padding: '10px 16px', marginBottom: 16,
        background: 'var(--blue-lt)', borderRadius: 10,
        border: '1px solid var(--blue)', fontSize: 13,
        color: 'var(--blue)',
      }}>
        💡 <strong>Billing tip:</strong> For admitted patients, generate the bill
        <strong> after discharge</strong> — bed charges are automatically calculated
        for the exact number of days stayed. You can still add lab, pharmacy, and
        machinery charges from the bill detail page anytime.
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th><th>Patient</th><th>Doctor</th><th>Ward</th><th>Bed</th>
                <th>Admitted</th><th>Days</th><th>Bed Charge (so far)</th>
                <th>Status</th><th>Action</th>
              </tr>
            </thead>
            <tbody>
              {admissions.length === 0 ? (
                <tr><td colSpan={10} className="empty">No active admissions</td></tr>
              ) : admissions.map(a => (
                <tr key={a.admission_id}>
                  <td className="text-mono text-muted">#{a.admission_id}</td>
                  <td className="font-bold">
                    {a.patient_name}
                    <br />
                    <span className="text-sm text-muted">{a.blood_group}</span>
                  </td>
                  <td>{a.doctor_name}</td>
                  <td><span className="badge badge-teal">{a.ward_name}</span></td>
                  <td className="text-mono">{a.bed_number}</td>
                  <td className="text-sm">
                    {new Date(a.admit_date).toLocaleDateString('en-IN')}
                  </td>
                  <td>
                    <span className="font-bold">{a.days_admitted}</span>
                    <span className="text-muted text-sm"> day{a.days_admitted !== 1 ? 's' : ''}</span>
                  </td>
                  <td className="text-mono">
                    ₹{(a.days_admitted * a.daily_rate).toLocaleString('en-IN')}
                    <br />
                    <span className="text-muted text-sm">
                      ₹{a.daily_rate}/day
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[a.status] || 'badge-gray'}`}>
                      {a.status}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => discharge(a.admission_id)}
                    >
                      Discharge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admit Patient Modal */}
      {modal && (
        <div className="modal-overlay"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Admit Patient</h2>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={admit}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Patient *</label>
                    <select className="form-control" required value={form.patient_id}
                            onChange={e => setForm({...form, patient_id: e.target.value})}>
                      <option value="">Select…</option>
                      {patients.map(p => (
                        <option key={p.patient_id} value={p.patient_id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Doctor *</label>
                    <select className="form-control" required value={form.doctor_id}
                            onChange={e => setForm({...form, doctor_id: e.target.value, appt_id: ''})}>
                      <option value="">Select…</option>
                      {doctors.map(d => (
                        <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Completed Appointment *</label>
                    <select className="form-control" required value={form.appt_id}
                            disabled={!form.patient_id || !form.doctor_id}
                            onChange={e => setForm({...form, appt_id: e.target.value})}>
                      <option value="">Select appointment…</option>
                      {appointments
                        .filter(a => String(a.patient_id) === String(form.patient_id) && String(a.doctor_id) === String(form.doctor_id))
                        .map(a => (
                          <option key={a.appt_id} value={a.appt_id}>
                            #{a.appt_id} on {new Date(a.appt_date).toLocaleDateString('en-IN')} at {a.appt_time}
                          </option>
                        ))}
                    </select>
                    {form.patient_id && form.doctor_id && !appointments.some(a => String(a.patient_id) === String(form.patient_id) && String(a.doctor_id) === String(form.doctor_id)) && (
                      <div className="text-sm text-muted" style={{ marginTop: 6 }}>
                        No completed appointment found for this patient and doctor.
                      </div>
                    )}
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Available Bed *</label>
                    <select className="form-control" required value={form.bed_id}
                            onChange={e => setForm({...form, bed_id: e.target.value})}>
                      <option value="">Select bed…</option>
                      {beds.map(b => (
                        <option key={b.bed_id} value={b.bed_id}>
                          {b.ward_name} — {b.bed_number} (₹{b.daily_rate}/day)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Reason for Admission *</label>
                    <textarea className="form-control" rows={2} required value={form.reason}
                              onChange={e => setForm({...form, reason: e.target.value})} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                        onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Admitting…' : 'Admit Patient'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── POST-DISCHARGE BILL PROMPT ─────────────────────────── */}
      {billPrompt && dischargeData && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ background: 'var(--navy)', borderRadius: '16px 16px 0 0' }}>
              <h2 style={{ color: '#fff' }}>✅ Patient Discharged</h2>
            </div>
            <div className="modal-body">
              {/* Patient summary */}
              <div style={{
                padding: '12px 16px', background: 'var(--surface2)',
                borderRadius: 10, marginBottom: 16,
              }}>
                <div className="font-bold" style={{ fontSize: 16, marginBottom: 4 }}>
                  {dischargeData.patient_name}
                </div>
                <div className="text-muted text-sm">
                  {dischargeData.ward_name} — Bed {dischargeData.bed_number}
                </div>
              </div>

              {/* Bed charge summary */}
              <div style={{
                padding: '14px 16px', background: 'var(--amber-lt)',
                borderRadius: 10, border: '1px solid var(--amber)', marginBottom: 16,
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--amber)', marginBottom: 8 }}>
                  🛏️ Bed Charge Summary
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span className="text-muted">Days admitted</span>
                  <span className="font-bold">
                    {dischargeData.days_admitted} day{dischargeData.days_admitted !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span className="text-muted">Daily rate</span>
                  <span className="text-mono">₹{dischargeData.daily_rate}/day</span>
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: 15, fontWeight: 700, marginTop: 8,
                  paddingTop: 8, borderTop: '1px solid var(--amber)',
                }}>
                  <span>Total Bed Charge</span>
                  <span className="text-mono" style={{ color: 'var(--amber)' }}>
                    ₹{Number(dischargeData.total_bed_charge).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
                Do you want to generate the complete bill now?
                It will automatically include the bed charges above,
                plus any lab tests, pharmacy, and machinery charges
                recorded during this admission.
              </p>
            </div>
            <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
              <button className="btn btn-secondary" onClick={skipBill}>
                Skip — I'll bill later
              </button>
              <button
                className="btn btn-primary"
                onClick={generateBillNow}
                disabled={generatingBill}
              >
                {generatingBill ? 'Generating…' : '🧾 Generate Bill Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
