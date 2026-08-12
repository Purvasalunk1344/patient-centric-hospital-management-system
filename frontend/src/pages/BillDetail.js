import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { billingAPI, paymentsAPI } from '../utils/api';

const CHARGE_COLORS = {
  doctor: '#1a6fbb', lab: '#0d7e6e', bed: '#c27a0c',
  pharmacy: '#dc2626', machinery: '#5b21b6', misc: '#64748b',
};
const CHARGE_ICONS = {
  doctor: '🩺', lab: '🧪', bed: '🛏️', pharmacy: '💊', machinery: '⚙️', misc: '📋',
};
const PAYMENT_METHODS = ['cash', 'card', 'upi', 'insurance', 'netbanking'];
const CHARGE_TYPES    = ['doctor', 'lab', 'bed', 'pharmacy', 'machinery', 'misc'];

export default function BillDetail() {
  const { id } = useParams();
  const nav    = useNavigate();

  const [data,        setData]        = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [payModal,    setPayModal]    = useState(false);
  const [chargeModal, setChargeModal] = useState(false);
  const [discModal,   setDiscModal]   = useState(false);

  const [payForm,  setPayForm]  = useState({ amount_paid: '', payment_method: 'cash', transaction_ref: '' });
  const [newCharge,setNewCharge]= useState({ charge_type: 'misc', description: '', amount: '' });
  const [discForm, setDiscForm] = useState({ discount_amount: '', discount_reason: '' });

  const [paying,   setPaying]   = useState(false);
  const [adding,   setAdding]   = useState(false);
  const [discSaving,setDiscSaving]=useState(false);

  const load = async () => {
    setLoading(true);
    try { const r = await billingAPI.getOne(id); setData(r.data); }
    catch { alert('Bill not found'); nav('/billing'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [id]);

  // Payment
  const recordPayment = async (e) => {
    e.preventDefault(); setPaying(true);
    try {
      await paymentsAPI.record({ bill_id: parseInt(id), ...payForm, received_by: 1 });
      setPayModal(false);
      setPayForm({ amount_paid: '', payment_method: 'cash', transaction_ref: '' });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Payment error'); }
    finally { setPaying(false); }
  };

  // Add manual charge
  const addCharge = async (e) => {
    e.preventDefault(); setAdding(true);
    try {
      await billingAPI.addCharge(id, newCharge);
      setChargeModal(false);
      setNewCharge({ charge_type: 'misc', description: '', amount: '' });
      load();
    } catch (err) { alert(err.response?.data?.error || 'Error adding charge'); }
    finally { setAdding(false); }
  };

  // Remove charge
  const removeCharge = async (detail_id) => {
    if (!window.confirm('Remove this charge from the bill?')) return;
    try { await billingAPI.deleteCharge(id, detail_id); load(); }
    catch (err) { alert(err.response?.data?.error || 'Error removing charge'); }
  };

  // Apply/update discount
  const applyDiscount = async (e) => {
    e.preventDefault(); setDiscSaving(true);
    try {
      await billingAPI.applyDiscount(id, discForm);
      setDiscModal(false); load();
    } catch (err) { alert(err.response?.data?.error || 'Error'); }
    finally { setDiscSaving(false); }
  };

  if (loading) return <div className="loading">Loading bill…</div>;
  if (!data)   return null;

  const { bill, details, payments, summary, total_paid, balance_due } = data;
  const netAmount  = parseFloat(bill.net_amount || bill.total_amount);
  const discountAmt= parseFloat(bill.discount_amount || 0);
  const paidPct    = Math.min(100, (total_paid / (netAmount || 1)) * 100);
  const chargeGroups = Object.entries(summary || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div>
      {/* Header banner */}
      <div className="bill-header-card">
        <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
          <button className="btn btn-sm"
                  style={{ background: 'rgba(255,255,255,.15)', color: '#fff', border: 'none' }}
                  onClick={() => nav('/billing')}>← Back</button>
          <span className="badge"
                style={{ background: 'rgba(255,255,255,.2)', color: '#fff', fontSize: 13 }}>
            Bill #{bill.bill_id}
          </span>
          <span className="badge" style={{
            background: bill.status === 'paid' ? 'var(--green-lt)'
                      : bill.status === 'partially_paid' ? 'var(--amber-lt)'
                      : 'rgba(255,255,255,.15)',
            color: bill.status === 'paid' ? 'var(--green)'
                 : bill.status === 'partially_paid' ? 'var(--amber)' : '#fff',
            fontSize: 12,
          }}>
            {bill.status?.replace('_', ' ').toUpperCase()}
          </span>
        </div>
        <h1 style={{ marginBottom: 4 }}>{bill.patient_name}</h1>
        <p>{bill.phone}{bill.address ? ` · ${bill.address}` : ''}</p>
        <p style={{ marginTop: 6, opacity: .7, fontSize: 12 }}>
          Generated: {new Date(bill.bill_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
          {bill.generated_by_name ? ` · By ${bill.generated_by_name}` : ''}
        </p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* LEFT — Itemized charges */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Itemized Charges</div>
              <div className="card-sub">{details.length} line items</div>
            </div>
            <button className="btn btn-secondary btn-sm"
                    onClick={() => setChargeModal(true)}>
              + Add Charge
            </button>
          </div>

          {CHARGE_TYPES.map(type => {
            const items = details.filter(d => d.charge_type === type);
            if (!items.length) return null;
            const subtotal = items.reduce((s, i) => s + parseFloat(i.amount), 0);
            return (
              <div key={type} style={{ marginBottom: 14 }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '7px 12px', borderRadius: 8, marginBottom: 4,
                  background: CHARGE_COLORS[type] + '15',
                  borderLeft: `3px solid ${CHARGE_COLORS[type]}`,
                }}>
                  <span>{CHARGE_ICONS[type]}</span>
                  <span style={{ fontWeight: 600, fontSize: 13, textTransform: 'capitalize', color: CHARGE_COLORS[type] }}>
                    {type === 'misc' ? 'Miscellaneous' : type.charAt(0).toUpperCase() + type.slice(1)} Charges
                  </span>
                  <span style={{ marginLeft: 'auto', fontFamily: 'var(--mono)', fontWeight: 600, color: CHARGE_COLORS[type] }}>
                    ₹{subtotal.toLocaleString('en-IN')}
                  </span>
                </div>
                {items.map(item => (
                  <div key={item.detail_id} className="charge-row"
                       style={{ paddingLeft: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="charge-type-dot"
                         style={{ background: CHARGE_COLORS[type], width: 8, height: 8, borderRadius: '50%', flexShrink: 0 }} />
                    <div style={{ flex: 1, fontSize: 13.5 }}>
                      {item.description}
                      <span className="text-sm text-muted" style={{ marginLeft: 8 }}>
                        ({item.pct_of_total}%)
                      </span>
                    </div>
                    <div style={{ fontFamily: 'var(--mono)', fontWeight: 500, fontSize: 14 }}>
                      ₹{Number(item.amount).toLocaleString('en-IN')}
                    </div>
                    {bill.status !== 'paid' && (
                      <button title="Remove charge"
                              onClick={() => removeCharge(item.detail_id)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer',
                                       color: 'var(--text-3)', fontSize: 16, padding: '0 2px' }}>
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            );
          })}

          {/* Subtotal */}
          <div style={{ display: 'flex', justifyContent: 'space-between',
                        padding: '10px 0', borderTop: '1px solid var(--border)', fontSize: 13 }}>
            <span className="text-muted">Subtotal</span>
            <span className="text-mono font-bold">₹{Number(bill.total_amount).toLocaleString('en-IN')}</span>
          </div>

          {/* Discount row */}
          {discountAmt > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between',
                          padding: '8px 0', borderTop: '1px dashed var(--border)', fontSize: 13 }}>
              <span style={{ color: 'var(--amber)' }}>
                🏷️ Discount{bill.discount_reason ? ` (${bill.discount_reason})` : ''}
              </span>
              <span className="text-mono" style={{ color: 'var(--amber)', fontWeight: 600 }}>
                -₹{discountAmt.toLocaleString('en-IN')}
              </span>
            </div>
          )}

          {/* Net total */}
          <div className="bill-total-row">
            <span>Net Payable</span>
            <span>₹{netAmount.toLocaleString('en-IN')}</span>
          </div>

          {/* Discount action */}
          {bill.status !== 'paid' && (
            <button className="btn btn-secondary btn-sm"
                    style={{ marginTop: 10 }}
                    onClick={() => {
                      setDiscForm({ discount_amount: bill.discount_amount || '', discount_reason: bill.discount_reason || '' });
                      setDiscModal(true);
                    }}>
              🏷️ {discountAmt > 0 ? 'Edit Discount' : 'Apply Discount'}
            </button>
          )}
        </div>

        {/* RIGHT — Payment + breakdown */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Payment status */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Payment Status</div>
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between',
                            marginBottom: 6, fontSize: 13 }}>
                <span className="text-muted">Paid</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: 600, color: 'var(--green)' }}>
                  ₹{total_paid.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="progress-bar-wrap">
                <div className="progress-bar-fill" style={{
                  width: `${paidPct}%`,
                  background: paidPct >= 100 ? 'var(--green)' : paidPct > 0 ? 'var(--amber)' : 'var(--red)',
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>
                {paidPct.toFixed(0)}% paid
              </div>
            </div>

            {[
              { label: 'Total Billed',  val: `₹${Number(bill.total_amount).toLocaleString('en-IN')}` },
              { label: 'Discount',      val: discountAmt > 0 ? `-₹${discountAmt.toLocaleString('en-IN')}` : '—', color: discountAmt > 0 ? 'var(--amber)' : undefined },
              { label: 'Net Payable',   val: `₹${netAmount.toLocaleString('en-IN')}`, bold: true },
              { label: 'Amount Paid',   val: `₹${total_paid.toLocaleString('en-IN')}`, color: 'var(--green)' },
            ].map(row => (
              <div key={row.label} style={{ display: 'flex', justifyContent: 'space-between',
                                           padding: '9px 0', borderTop: '1px solid var(--border)',
                                           fontSize: 13 }}>
                <span className="text-muted">{row.label}</span>
                <span style={{ fontFamily: 'var(--mono)', fontWeight: row.bold ? 600 : 500,
                               color: row.color }}>
                  {row.val}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0',
                          borderTop: '2px solid var(--text-1)', fontSize: 15, fontWeight: 600 }}>
              <span>Balance Due</span>
              <span style={{ fontFamily: 'var(--mono)',
                             color: balance_due > 0 ? 'var(--red)' : 'var(--green)' }}>
                ₹{Number(balance_due).toLocaleString('en-IN')}
              </span>
            </div>

            {balance_due > 0 ? (
              <button className="btn btn-primary w-full"
                      style={{ marginTop: 12, justifyContent: 'center' }}
                      onClick={() => setPayModal(true)}>
                💳 Record Payment
              </button>
            ) : (
              <div className="badge badge-green"
                   style={{ display: 'block', textAlign: 'center', padding: '8px', marginTop: 12, fontSize: 13 }}>
                ✅ Bill Fully Paid
              </div>
            )}
          </div>

          {/* Charge breakdown bars */}
          <div className="card">
            <div className="card-title" style={{ marginBottom: 14 }}>Charge Breakdown</div>
            {chargeGroups.map(([type, amount]) => (
              <div key={type} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between',
                              marginBottom: 4, fontSize: 12 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{CHARGE_ICONS[type]}</span>
                    <span style={{ textTransform: 'capitalize' }}>{type}</span>
                  </span>
                  <span style={{ fontFamily: 'var(--mono)', fontWeight: 600 }}>
                    ₹{Number(amount).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="progress-bar-wrap" style={{ height: 5 }}>
                  <div className="progress-bar-fill"
                       style={{ width: `${(amount / bill.total_amount) * 100}%`,
                                background: CHARGE_COLORS[type] }} />
                </div>
              </div>
            ))}
          </div>

          {/* Payment history */}
          {payments.length > 0 && (
            <div className="card">
              <div className="card-title" style={{ marginBottom: 14 }}>Payment History</div>
              {payments.map((p, i) => (
                <div key={p.payment_id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 0', borderBottom: i < payments.length - 1 ? '1px solid var(--border)' : 'none',
                  fontSize: 13,
                }}>
                  <div>
                    <div className="font-bold">₹{Number(p.amount_paid).toLocaleString('en-IN')}</div>
                    <div className="text-muted text-sm">
                      {new Date(p.payment_date).toLocaleDateString('en-IN')} · {p.payment_method?.toUpperCase()}
                    </div>
                    {p.transaction_ref && (
                      <div className="text-mono text-sm text-muted">{p.transaction_ref}</div>
                    )}
                  </div>
                  <span className="badge badge-green">Received</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* PAYMENT MODAL */}
      {payModal && (
        <div className="modal-overlay"
             onClick={e => e.target === e.currentTarget && setPayModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Record Payment</h2>
              <button className="modal-close" onClick={() => setPayModal(false)}>×</button>
            </div>
            <form onSubmit={recordPayment}>
              <div className="modal-body">
                <div style={{ padding: 12, background: 'var(--blue-lt)', borderRadius: 8,
                              marginBottom: 16, fontSize: 13 }}>
                  Balance due: <strong>₹{Number(balance_due).toLocaleString('en-IN')}</strong>
                </div>
                <div className="form-grid">
                  <div className="form-group">
                    <label>Amount *</label>
                    <input type="number" step="0.01" className="form-control" required
                           max={balance_due}
                           placeholder={`Max ₹${Number(balance_due).toLocaleString('en-IN')}`}
                           value={payForm.amount_paid}
                           onChange={e => setPayForm({ ...payForm, amount_paid: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Payment Method *</label>
                    <select className="form-control" required value={payForm.payment_method}
                            onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}>
                      {PAYMENT_METHODS.map(m => (
                        <option key={m} value={m}>{m.toUpperCase()}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Transaction Reference</label>
                    <input className="form-control" placeholder="UPI ref / card last 4 / cheque no."
                           value={payForm.transaction_ref}
                           onChange={e => setPayForm({ ...payForm, transaction_ref: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                        onClick={() => setPayModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={paying}>
                  {paying ? 'Processing…' : '✅ Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD CHARGE MODAL */}
      {chargeModal && (
        <div className="modal-overlay"
             onClick={e => e.target === e.currentTarget && setChargeModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Add Charge</h2>
              <button className="modal-close" onClick={() => setChargeModal(false)}>×</button>
            </div>
            <form onSubmit={addCharge}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Charge Type *</label>
                    <select className="form-control" required value={newCharge.charge_type}
                            onChange={e => setNewCharge({ ...newCharge, charge_type: e.target.value })}>
                      {CHARGE_TYPES.map(t => (
                        <option key={t} value={t}>{CHARGE_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Amount (₹) *</label>
                    <input type="number" step="0.01" min="0" className="form-control" required
                           value={newCharge.amount}
                           onChange={e => setNewCharge({ ...newCharge, amount: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1/-1' }}>
                    <label>Description *</label>
                    <input className="form-control" required
                           placeholder="e.g. Dressing charge, ICU nursing charge"
                           value={newCharge.description}
                           onChange={e => setNewCharge({ ...newCharge, description: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                        onClick={() => setChargeModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={adding}>
                  {adding ? 'Adding…' : '+ Add to Bill'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DISCOUNT MODAL */}
      {discModal && (
        <div className="modal-overlay"
             onClick={e => e.target === e.currentTarget && setDiscModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h2>Apply Discount</h2>
              <button className="modal-close" onClick={() => setDiscModal(false)}>×</button>
            </div>
            <form onSubmit={applyDiscount}>
              <div className="modal-body">
                <div className="form-grid">
                  <div className="form-group">
                    <label>Discount Amount (₹) *</label>
                    <input type="number" step="0.01" min="0"
                           max={bill.total_amount} className="form-control" required
                           value={discForm.discount_amount}
                           onChange={e => setDiscForm({ ...discForm, discount_amount: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label>Reason</label>
                    <input className="form-control" placeholder="e.g. Senior citizen, BPL"
                           value={discForm.discount_reason}
                           onChange={e => setDiscForm({ ...discForm, discount_reason: e.target.value })} />
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary"
                        onClick={() => setDiscModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={discSaving}>
                  {discSaving ? 'Saving…' : '🏷️ Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
