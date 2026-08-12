import React, { useEffect, useState } from 'react';
import { useAuth } from '../utils/AuthContext';
import { pharmacyAPI, patientsAPI, doctorsAPI, labsAPI, admissionsAPI, appointmentsAPI } from '../utils/api';

const EMPTY_ITEM = { medicine_id:'', quantity:'', dosage:'', duration_days:'' };

export default function Prescriptions() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [admissions, setAdmissions] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [medicines, setMedicines] = useState([]);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    patient_id: '',
    doctor_id: '',
    admission_id: '',
    appt_id: '',
    notes: '',
    lab_test_ids: [],
    items: [ { ...EMPTY_ITEM } ],
  });

  const loadPrescriptions = () => {
    const params = isAdmin ? {} : { patient_id: user.patient_id };
    return pharmacyAPI.getPrescriptions(params).then(r => setPrescriptions(r.data)).catch(() => {});
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([
      loadPrescriptions(),
      labsAPI.getTests().then(r => setTests(r.data)).catch(() => {}),
      pharmacyAPI.getMedicines().then(r => setMedicines(r.data)).catch(() => {}),
      isAdmin ? patientsAPI.getAll().then(r => setPatients(r.data)).catch(() => {}) : Promise.resolve(),
      isAdmin ? doctorsAPI.getAll().then(r => setDoctors(r.data)).catch(() => {}) : Promise.resolve(),
    ]).finally(() => setLoading(false));
  }, [isAdmin, user.patient_id]);

  useEffect(() => {
    if (!form.patient_id) {
      setAdmissions([]);
      setAppointments([]);
      setForm(prev => ({ ...prev, admission_id: '', appt_id: '' }));
      return;
    }

    admissionsAPI.getAll({ patient_id: form.patient_id, status: 'admitted' })
      .then(r => setAdmissions(r.data))
      .catch(() => setAdmissions([]));

    appointmentsAPI.getAll({ patient_id: form.patient_id })
      .then(r => setAppointments(r.data))
      .catch(() => setAppointments([]));
  }, [form.patient_id]);

  const resetForm = () => {
    setForm({ patient_id:'', doctor_id:'', admission_id:'', appt_id:'', notes:'', lab_test_ids: [], items:[{ ...EMPTY_ITEM }] });
  };

  const toggleLabTest = (testId) => {
    setForm(prev => {
      const next = prev.lab_test_ids.includes(testId)
        ? prev.lab_test_ids.filter(id => id !== testId)
        : [...prev.lab_test_ids, testId];
      return { ...prev, lab_test_ids: next };
    });
  };

  const updateItem = (index, field, value) => {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  };

  const addItem = () => setForm(prev => ({ ...prev, items: [...prev.items, { ...EMPTY_ITEM }] }));
  const removeItem = (index) => setForm(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== index) }));

  const submitPrescription = async (e) => {
    e.preventDefault();
    if (!isAdmin) return;

    const validItems = form.items.filter(item => item.medicine_id && item.quantity && item.dosage);
    if (!validItems.length && !form.lab_test_ids.length) {
      return alert('Please add at least one medicine or one lab test.');
    }

    setSaving(true);
    try {
      await pharmacyAPI.createPrescription({
        patient_id: form.patient_id,
        doctor_id: form.doctor_id,
        admission_id: form.admission_id || null,
        appt_id: form.appt_id || null,
        notes: form.notes,
        items: validItems.map(item => ({
          medicine_id: item.medicine_id,
          quantity: Number(item.quantity),
          dosage: item.dosage,
          duration_days: item.duration_days ? Number(item.duration_days) : null,
        })),
        lab_test_ids: form.lab_test_ids,
      });
      setModalOpen(false);
      resetForm();
      await loadPrescriptions();
    } catch (err) {
      alert(err.response?.data?.error || 'Error creating prescription');
    } finally {
      setSaving(false);
    }
  };

  const renderMedicineSummary = (items) => {
    if (!items?.length) return <span className="text-muted">No medicines</span>;
    return (
      <ul className="list-plain" style={{margin:0, padding:0}}>
        {items.map(item => (
          <li key={`${item.item_id}-${item.medicine_id}`}>
            <strong>{item.medicine_name}</strong> · {item.quantity} {item.unit} · {item.dosage}
          </li>
        ))}
      </ul>
    );
  };

  const renderLabSummary = (labTests) => {
    if (!labTests?.length) return <span className="text-muted">No lab tests</span>;
    return (
      <ul className="list-plain" style={{margin:0, padding:0}}>
        {labTests.map(order => (
          <li key={order.order_id}>{order.test_name}</li>
        ))}
      </ul>
    );
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Prescriptions</h1>
          <p>{isAdmin ? 'Create and review prescriptions for patients.' : 'View your current prescriptions, lab tests, and medication instructions.'}</p>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={() => { resetForm(); setModalOpen(true); }}>
            + New Prescription
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                {isAdmin && <th>Patient</th>}
                <th>Doctor</th>
                <th>Prescribed</th>
                <th>Medicines</th>
                <th>Lab Tests</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="empty">Loading prescriptions…</td></tr>
              ) : prescriptions.length === 0 ? (
                <tr><td colSpan={isAdmin ? 7 : 6} className="empty">No prescriptions found</td></tr>
              ) : prescriptions.map((pr, idx) => (
                <tr key={pr.prescription_id}>
                  <td className="text-mono">#{pr.prescription_id}</td>
                  {isAdmin && <td className="font-bold">{pr.patient_name}</td>}
                  <td>{pr.doctor_name}</td>
                  <td>{new Date(pr.prescribed_date).toLocaleDateString('en-IN')}</td>
                  <td>{renderMedicineSummary(pr.items)}</td>
                  <td>{renderLabSummary(pr.lab_tests)}</td>
                  <td className="text-sm" style={{ maxWidth: 240, whiteSpace: 'pre-wrap' }}>{pr.notes || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModalOpen(false)}>
          <div className="modal modal-large">
            <div className="modal-header">
              <h2>New Prescription</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}>×</button>
            </div>
            <form onSubmit={submitPrescription}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Patient *</label>
                    <select className="form-control" required value={form.patient_id}
                      onChange={e => setForm({ ...form, patient_id: e.target.value })}>
                      <option value="">Select patient…</option>
                      {patients.map(p => <option key={p.patient_id} value={p.patient_id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Doctor *</label>
                    <select className="form-control" required value={form.doctor_id}
                      onChange={e => setForm({ ...form, doctor_id: e.target.value })}>
                      <option value="">Select doctor…</option>
                      {doctors.map(d => <option key={d.doctor_id} value={d.doctor_id}>Dr. {d.name}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Admission (optional)</label>
                    <select className="form-control" value={form.admission_id}
                      onChange={e => setForm({ ...form, admission_id: e.target.value, appt_id: '' })}>
                      <option value="">Select admission…</option>
                      {admissions.map(a => (
                        <option key={a.admission_id} value={a.admission_id}>
                          Admission #{a.admission_id} — {a.reason?.slice(0, 32)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Appointment (optional)</label>
                    <select className="form-control" value={form.appt_id}
                      onChange={e => setForm({ ...form, appt_id: e.target.value, admission_id: '' })}>
                      <option value="">Select appointment…</option>
                      {appointments.map(a => (
                        <option key={a.appt_id} value={a.appt_id}>
                          {new Date(a.appt_date).toLocaleDateString('en-IN')} · Dr. {a.doctor_name} · {a.status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group form-group-full">
                    <label>Prescription Notes</label>
                    <textarea className="form-control" rows={3} value={form.notes}
                      onChange={e => setForm({ ...form, notes: e.target.value })}
                      placeholder="Instructions for the patient…" />
                  </div>
                </div>

                <div className="card mt-4" style={{ padding: '16px' }}>
                  <div className="card-title">Medicines</div>
                  {form.items.map((item, index) => (
                    <div key={index} className="form-grid" style={{ gap: '12px', alignItems: 'flex-end' }}>
                      <div className="form-group">
                        <label>Medicine *</label>
                        <select className="form-control" required value={item.medicine_id}
                          onChange={e => updateItem(index, 'medicine_id', e.target.value)}>
                          <option value="">Select medicine…</option>
                          {medicines.map(m => (
                            <option key={m.medicine_id} value={m.medicine_id}>
                              {m.medicine_name} — {m.unit}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="form-group">
                        <label>Quantity *</label>
                        <input type="number" min="1" className="form-control" required value={item.quantity}
                          onChange={e => updateItem(index, 'quantity', e.target.value)} />
                      </div>
                      <div className="form-group">
                        <label>Dosage *</label>
                        <input className="form-control" required value={item.dosage}
                          onChange={e => updateItem(index, 'dosage', e.target.value)} placeholder="e.g. 1 tablet twice daily" />
                      </div>
                      <div className="form-group">
                        <label>Duration (days)</label>
                        <input type="number" min="1" className="form-control" value={item.duration_days}
                          onChange={e => updateItem(index, 'duration_days', e.target.value)} />
                      </div>
                      <div className="form-group" style={{ width: 120 }}>
                        <button type="button" className="btn btn-secondary btn-sm mt-1" onClick={() => removeItem(index)} disabled={form.items.length === 1}>
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                  <button type="button" className="btn btn-outline-blue btn-sm mt-3" onClick={addItem}>
                    + Add medicine
                  </button>
                </div>

                <div className="card mt-4" style={{ padding: '16px' }}>
                  <div className="card-title">Lab Tests</div>
                  <div className="grid-3" style={{ gap: 12 }}>
                    {tests.map(test => (
                      <label key={test.test_id} className="checkbox-card">
                        <input type="checkbox" checked={form.lab_test_ids.includes(test.test_id)}
                          onChange={() => toggleLabTest(test.test_id)} />
                        <div>
                          <strong>{test.test_name}</strong>
                          <div className="text-muted">₹{test.test_price}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Create Prescription'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
