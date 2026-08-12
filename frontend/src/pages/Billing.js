import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { billingAPI, patientsAPI, admissionsAPI, appointmentsAPI } from '../utils/api';
import { useAuth } from '../utils/AuthContext';

const STATUS_BADGE = {
  draft: 'badge-gray', generated: 'badge-blue',
  partially_paid: 'badge-amber', paid: 'badge-green', cancelled: 'badge-red',
};
const EMPTY = {
  patient_id: '', admission_id: '', appt_id: '',
  discount_amount: '0', discount_reason: '',
};

export default function Billing() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [bills,        setBills]        = useState([]);
  const [patients,     setPatients]     = useState([]);
  const [admissions,   setAdmissions]   = useState([]);
  const [alertCount,   setAlertCount]   = useState(0);
  const [modal,        setModal]        = useState(false);
  const [form,         setForm]         = useState(EMPTY);

  // Prescription-based medicines (from existing prescriptions)
  const [rxMedicines,    setRxMedicines]    = useState([]);
  const [selectedRxMeds, setSelectedRxMeds] = useState([]);

  // Direct dispensing (catalogue picker — no prescription needed)
  const [catalogue,      setCatalogue]      = useState([]);
  const [directMeds,     setDirectMeds]     = useState([]); // [{medicine_id, name, quantity, price}]
  const [showCatalogue,  setShowCatalogue]  = useState(false);
  const [catSearch,      setCatSearch]      = useState('');
  const [loadingMeds,    setLoadingMeds]    = useState(false);
  const [patientAppts,   setPatientAppts]   = useState([]);  // appointments for selected patient
  const [generating,     setGenerating]     = useState(false);
  const nav = useNavigate();

  const load = () => billingAPI.getAll().then(r => setBills(r.data)).catch(() => {});

  useEffect(() => {
    load();
    if (isAdmin) {
      patientsAPI.getAll().then(r => setPatients(r.data)).catch(() => {});
      admissionsAPI.getAll({ status: 'admitted' }).then(r => setAdmissions(r.data)).catch(() => {});
      billingAPI.getAlertCount().then(r => setAlertCount(r.data.count)).catch(() => {});
      billingAPI.getMedicineCatalogue().then(r => setCatalogue(r.data)).catch(() => {});
    }
  }, [isAdmin]);

  // Load appointments + prescription-based medicines when patient changes
  useEffect(() => {
    if (!form.patient_id) {
      setRxMedicines([]); setSelectedRxMeds([]);
      setPatientAppts([]); return;
    }
    // Load this patient's completed/scheduled appointments for outpatient billing
    appointmentsAPI.getAll({ patient_id: form.patient_id })
      .then(r => setPatientAppts(r.data))
      .catch(() => {});
    setLoadingMeds(true);
    const params = {};
    if (form.admission_id) params.admission_id = form.admission_id;
    if (form.appt_id)      params.appt_id      = form.appt_id;
    billingAPI.getUnbilledMedicines(form.patient_id, params)
      .then(r => {
        setRxMedicines(r.data);
        setSelectedRxMeds(r.data.map(m => m.item_id));
      })
      .catch(() => {})
      .finally(() => setLoadingMeds(false));
  }, [form.patient_id, form.admission_id, form.appt_id]);

  const toggleRxMed = (item_id) =>
    setSelectedRxMeds(prev =>
      prev.includes(item_id) ? prev.filter(id => id !== item_id) : [...prev, item_id]
    );

  // Add medicine from catalogue to direct list
  const addFromCatalogue = (med) => {
    setDirectMeds(prev => {
      const existing = prev.find(m => m.medicine_id === med.medicine_id);
      if (existing) return prev; // already added
      return [...prev, { medicine_id: med.medicine_id, name: med.medicine_name,
                         quantity: 1, price: parseFloat(med.price_per_unit) }];
    });
  };

  const updateDirectQty = (medicine_id, qty) => {
    if (qty < 1) return removeDirectMed(medicine_id);
    setDirectMeds(prev =>
      prev.map(m => m.medicine_id === medicine_id ? { ...m, quantity: parseInt(qty) } : m)
    );
  };

  const removeDirectMed = (medicine_id) =>
    setDirectMeds(prev => prev.filter(m => m.medicine_id !== medicine_id));

  const directTotal = directMeds.reduce((s, m) => s + m.price * m.quantity, 0);
  const rxTotal     = rxMedicines
    .filter(m => selectedRxMeds.includes(m.item_id))
    .reduce((s, m) => s + parseFloat(m.line_total), 0);

  const generate = async (e) => {
    e.preventDefault();
    if (!form.admission_id && !form.appt_id)
      return alert('Select either an Admission (inpatient) or enter an Appointment ID (outpatient)');
    setGenerating(true);
    try {
      const res = await billingAPI.generate({
        patient_id:            parseInt(form.patient_id),
        admission_id:          form.admission_id ? parseInt(form.admission_id) : null,
        appt_id:               form.appt_id      ? parseInt(form.appt_id)      : null,
        generated_by:          1,
        selected_medicine_ids: selectedRxMeds,
        direct_medicines:      directMeds.map(m => ({
          medicine_id: m.medicine_id,
          quantity:    m.quantity,
        })),
        discount_amount:       parseFloat(form.discount_amount) || 0,
        discount_reason:       form.discount_reason || null,
      });
      setModal(false); setForm(EMPTY); setDirectMeds([]);
      nav(`/billing/${res.data.bill_id}`);
    } catch (err) {
      alert(err.response?.data?.error || 'Error generating bill');
    } finally { setGenerating(false); }
  };

  const total     = bills.reduce((s, b) => s + parseFloat(b.total_amount || 0), 0);
  const collected = bills.reduce((s, b) => s + parseFloat(b.paid_amount  || 0), 0);
  const fmt = (n) => `₹${Number(n).toLocaleString('en-IN')}`;

  const filteredCat = catalogue.filter(m =>
    m.medicine_name.toLowerCase().includes(catSearch.toLowerCase()) ||
    (m.category || '').toLowerCase().includes(catSearch.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div><h1>Billing</h1><p>{bills.length} bills {isAdmin ? 'generated' : 'for your account'}</p></div>
        {isAdmin && (
          <div className="flex gap-2 items-center">
            {alertCount > 0 && (
              <button className="btn btn-secondary"
                      style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
                      onClick={() => nav('/billing/alerts')}>
                🔔 {alertCount} Alert{alertCount !== 1 ? 's' : ''}
              </button>
            )}
            <button className="btn btn-primary" onClick={() => setModal(true)}>+ Generate Bill</button>
          </div>
        )}
      </div>

      {/* Summary strip — admin only */}
      {isAdmin && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total Billed',  value: fmt(total),           color: 'var(--navy)'  },
          { label: 'Collected',     value: fmt(collected),       color: 'var(--green)' },
          { label: 'Outstanding',   value: fmt(total-collected), color: 'var(--red)'   },
          { label: 'Paid Bills',    value: bills.filter(b => b.status === 'paid').length, color: 'var(--teal)' },
        ].map(s => (
          <div className="stat-card" key={s.label}>
            <div className="stat-value" style={{ color: s.color, fontSize: 22 }}>{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
        </div>
      )}

      {/* Bills table */}
      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bill #</th><th>Patient</th><th>Date</th>
                <th>Total</th><th>Discount</th><th>Net</th>
                <th>Paid</th><th>Balance</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {bills.length === 0 ? (
                <tr><td colSpan={10} className="empty">No bills yet</td></tr>
              ) : bills.map(b => (
                <tr key={b.bill_id} style={{ cursor: 'pointer' }}
                    onClick={() => nav(`/billing/${b.bill_id}`)}>
                  <td className="text-mono font-bold">#{b.bill_id}</td>
                  <td className="font-bold">
                    {b.patient_name}<br />
                    <span className="text-sm text-muted">{b.phone}</span>
                  </td>
                  <td className="text-sm">{new Date(b.bill_date).toLocaleDateString('en-IN')}</td>
                  <td className="text-mono">₹{Number(b.total_amount).toLocaleString('en-IN')}</td>
                  <td className="text-mono" style={{ color: 'var(--amber)' }}>
                    {parseFloat(b.discount_amount || 0) > 0
                      ? `-₹${Number(b.discount_amount).toLocaleString('en-IN')}`
                      : '—'}
                  </td>
                  <td className="text-mono font-bold">
                    ₹{Number(b.net_amount || b.total_amount).toLocaleString('en-IN')}
                  </td>
                  <td className="text-mono" style={{ color: 'var(--green)' }}>
                    ₹{Number(b.paid_amount || 0).toLocaleString('en-IN')}
                  </td>
                  <td className="text-mono"
                      style={{ color: b.balance_due > 0 ? 'var(--red)' : 'var(--green)' }}>
                    ₹{Number(b.balance_due || 0).toLocaleString('en-IN')}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_BADGE[b.status] || 'badge-gray'}`}>
                      {b.status?.replace('_', ' ')}
                    </span>
                  </td>
                  <td>
                    <button className="btn btn-secondary btn-sm"
                            onClick={e => { e.stopPropagation(); nav(`/billing/${b.bill_id}`); }}>
                      View →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Generate Bill Modal — admin only */}
      {isAdmin && modal && (
        <div className="modal-overlay"
             onClick={e => e.target === e.currentTarget && setModal(false)}>
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <h2>Generate Bill</h2>
              <button className="modal-close" onClick={() => setModal(false)}>×</button>
            </div>
            <form onSubmit={generate}>
              <div className="modal-body">

                {/* Step 1 */}
                <div style={{ padding: '8px 12px', background: 'var(--blue-lt)',
                              borderRadius: 8, fontSize: 12, color: 'var(--blue)',
                              fontWeight: 600, marginBottom: 12 }}>
                  Step 1 — Choose patient and visit
                </div>
                <div className="form-grid">
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Patient *</label>
                    <select className="form-control" required value={form.patient_id}
                            onChange={e => setForm({ ...EMPTY, patient_id: e.target.value })}>
                      <option value="">Select patient…</option>
                      {patients.map(p => (
                        <option key={p.patient_id} value={p.patient_id}>
                          {p.name} — {p.phone}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Admission (Inpatient)</label>
                    <select className="form-control" value={form.admission_id}
                            onChange={e => setForm({ ...form, admission_id: e.target.value, appt_id: '' })}>
                      <option value="">— inpatient —</option>
                      {admissions
                        .filter(a => !form.patient_id || String(a.patient_id) === form.patient_id)
                        .map(a => (
                          <option key={a.admission_id} value={a.admission_id}>
                            Admission #{a.admission_id} — {a.reason?.slice(0, 28)}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Appointment (Outpatient)</label>
                    <select className="form-control" value={form.appt_id}
                            onChange={e => setForm({ ...form, appt_id: e.target.value, admission_id: '' })}>
                      <option value="">— select appointment —</option>
                      {patientAppts.map(a => (
                        <option key={a.appt_id} value={a.appt_id}>
                          Token #{a.token_no} · Dr. {a.doctor_name} · {new Date(a.appt_date).toLocaleDateString('en-IN')} · {a.status}
                        </option>
                      ))}
                    </select>
                    {form.patient_id && patientAppts.length === 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        No appointments found for this patient
                      </span>
                    )}
                  </div>
                </div>

                {/* Step 2 — Medicines */}
                {form.patient_id && (
                  <>
                    <div style={{ padding: '8px 12px', background: 'var(--teal-lt)',
                                  borderRadius: 8, fontSize: 12, color: 'var(--teal)',
                                  fontWeight: 600, margin: '14px 0 10px' }}>
                      Step 2 — Add medicines to bill
                    </div>

                    {/* 2A: Prescription-based medicines */}
                    {loadingMeds ? (
                      <p className="text-muted text-sm">Loading prescriptions…</p>
                    ) : rxMedicines.length > 0 ? (
                      <>
                        <p style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
                          From doctor's prescription — uncheck any NOT dispensed:
                        </p>
                        <div style={{ border: '1px solid var(--border)', borderRadius: 8,
                                      maxHeight: 160, overflowY: 'auto', marginBottom: 10 }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                            <thead>
                              <tr style={{ background: 'var(--surface2)', position: 'sticky', top: 0 }}>
                                <th style={{ padding: '5px 8px' }}>
                                  <input type="checkbox"
                                         checked={selectedRxMeds.length === rxMedicines.length}
                                         onChange={e => setSelectedRxMeds(
                                           e.target.checked ? rxMedicines.map(m => m.item_id) : []
                                         )} />
                                </th>
                                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Medicine</th>
                                <th style={{ padding: '5px 8px' }}>Qty</th>
                                <th style={{ padding: '5px 8px', textAlign: 'right' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rxMedicines.map((m, i) => (
                                <tr key={m.item_id}
                                    style={{ background: i % 2 ? 'var(--surface2)' : 'var(--surface)',
                                             cursor: 'pointer' }}
                                    onClick={() => toggleRxMed(m.item_id)}>
                                  <td style={{ padding: '4px 8px' }}>
                                    <input type="checkbox" readOnly checked={selectedRxMeds.includes(m.item_id)} />
                                  </td>
                                  <td style={{ padding: '4px 8px', fontWeight: 500 }}>{m.medicine_name}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'center' }}>{m.quantity} {m.unit}</td>
                                  <td style={{ padding: '4px 8px', textAlign: 'right',
                                               fontFamily: 'var(--mono)' }}>
                                    ₹{Number(m.line_total).toLocaleString('en-IN')}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <p style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 8 }}>
                        No prescribed medicines for this visit.
                      </p>
                    )}

                    {/* 2B: Direct dispensing from catalogue */}
                    <div style={{ border: '1px solid var(--border)', borderRadius: 8,
                                  padding: '10px 12px', marginBottom: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between',
                                    alignItems: 'center', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-1)' }}>
                          💊 Add medicines directly (no prescription)
                        </span>
                        <button type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setShowCatalogue(v => !v)}>
                          {showCatalogue ? '▲ Hide catalogue' : '+ Pick from catalogue'}
                        </button>
                      </div>

                      {/* Catalogue picker */}
                      {showCatalogue && (
                        <div style={{ marginBottom: 10 }}>
                          <input className="form-control" placeholder="Search medicine name or category…"
                                 style={{ marginBottom: 6, fontSize: 12 }}
                                 value={catSearch}
                                 onChange={e => setCatSearch(e.target.value)} />
                          <div style={{ maxHeight: 160, overflowY: 'auto',
                                        border: '1px solid var(--border)', borderRadius: 6 }}>
                            {filteredCat.length === 0 ? (
                              <div style={{ padding: 16, textAlign: 'center',
                                            color: 'var(--text-3)', fontSize: 12 }}>
                                No medicines found
                              </div>
                            ) : filteredCat.map((m, i) => (
                              <div key={m.medicine_id}
                                   style={{
                                     display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                     padding: '6px 10px', fontSize: 12.5,
                                     background: i % 2 ? 'var(--surface2)' : 'var(--surface)',
                                     borderBottom: '1px solid var(--border)',
                                   }}>
                                <div>
                                  <span style={{ fontWeight: 500 }}>{m.medicine_name}</span>
                                  {m.category && (
                                    <span style={{ color: 'var(--text-3)', marginLeft: 6, fontSize: 11 }}>
                                      {m.category}
                                    </span>
                                  )}
                                  <span style={{ color: 'var(--text-2)', marginLeft: 6 }}>
                                    — ₹{m.price_per_unit}/{m.unit}
                                  </span>
                                </div>
                                <button type="button"
                                        className="btn btn-primary btn-sm"
                                        style={{ padding: '2px 10px', fontSize: 11 }}
                                        onClick={() => addFromCatalogue(m)}
                                        disabled={directMeds.some(d => d.medicine_id === m.medicine_id)}>
                                  {directMeds.some(d => d.medicine_id === m.medicine_id) ? '✓ Added' : '+ Add'}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Direct medicines list */}
                      {directMeds.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: 'var(--text-2)', marginBottom: 6 }}>
                            Medicines to dispense — adjust quantities:
                          </div>
                          {directMeds.map(m => (
                            <div key={m.medicine_id}
                                 style={{ display: 'flex', alignItems: 'center', gap: 10,
                                          padding: '5px 0', borderBottom: '1px solid var(--border)',
                                          fontSize: 13 }}>
                              <span style={{ flex: 1, fontWeight: 500 }}>{m.name}</span>
                              <span style={{ color: 'var(--text-2)', fontSize: 12 }}>
                                ₹{m.price}/unit
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                <button type="button"
                                        style={{ width: 24, height: 24, borderRadius: 4,
                                                 border: '1px solid var(--border2)',
                                                 background: 'var(--surface)', cursor: 'pointer',
                                                 display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => updateDirectQty(m.medicine_id, m.quantity - 1)}>
                                  −
                                </button>
                                <input type="number" min="1"
                                       style={{ width: 50, textAlign: 'center', padding: '2px 4px',
                                                border: '1px solid var(--border2)', borderRadius: 4,
                                                fontSize: 13 }}
                                       value={m.quantity}
                                       onChange={e => updateDirectQty(m.medicine_id, e.target.value)} />
                                <button type="button"
                                        style={{ width: 24, height: 24, borderRadius: 4,
                                                 border: '1px solid var(--border2)',
                                                 background: 'var(--surface)', cursor: 'pointer',
                                                 display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                        onClick={() => updateDirectQty(m.medicine_id, m.quantity + 1)}>
                                  +
                                </button>
                              </div>
                              <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, minWidth: 70, textAlign: 'right' }}>
                                ₹{(m.price * m.quantity).toLocaleString('en-IN')}
                              </span>
                              <button type="button"
                                      onClick={() => removeDirectMed(m.medicine_id)}
                                      style={{ background: 'none', border: 'none',
                                               cursor: 'pointer', color: 'var(--text-3)',
                                               fontSize: 16, padding: '0 2px' }}>
                                ×
                              </button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', justifyContent: 'flex-end',
                                        marginTop: 8, fontSize: 13, fontWeight: 600 }}>
                            Direct medicines total: &nbsp;
                            <span style={{ fontFamily: 'var(--mono)' }}>
                              ₹{directTotal.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      )}

                      {directMeds.length === 0 && !showCatalogue && (
                        <p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>
                          No medicines added directly. Click "Pick from catalogue" to add.
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Step 3 — Discount */}
                <div style={{ padding: '8px 12px', background: 'var(--amber-lt)',
                              borderRadius: 8, fontSize: 12, color: 'var(--amber)',
                              fontWeight: 600, margin: '14px 0 10px' }}>
                  Step 3 — Apply discount (optional)
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Discount Amount (₹)</label>
                    <input type="number" min="0" step="0.01" className="form-control"
                           value={form.discount_amount}
                           onChange={e => setForm({ ...form, discount_amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Reason</label>
                    <input className="form-control" placeholder="e.g. Senior citizen, BPL card"
                           value={form.discount_reason}
                           onChange={e => setForm({ ...form, discount_reason: e.target.value })} />
                  </div>
                </div>

              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                        onClick={() => setModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={generating}>
                  {generating ? 'Generating…' : '🧾 Generate Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
