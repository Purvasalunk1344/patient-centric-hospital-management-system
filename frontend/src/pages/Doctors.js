import React, { useEffect, useState } from 'react';
import { doctorsAPI } from '../utils/api';

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  useEffect(() => { doctorsAPI.getAll().then(r => setDoctors(r.data)).catch(() => {}); }, []);

  const deptColors = ['badge-blue','badge-teal','badge-purple','badge-amber','badge-green'];
  const deptMap = {};
  doctors.forEach(d => { if (!deptMap[d.dept_name]) deptMap[d.dept_name] = Object.keys(deptMap).length; });

  return (
    <div>
      <div className="page-header">
        <div><h1>Doctors</h1><p>{doctors.length} doctors registered</p></div>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
        {doctors.map(d => (
          <div className="card" key={d.doctor_id} style={{ padding:20 }}>
            <div className="flex gap-3 items-center" style={{ marginBottom:12 }}>
              <div style={{
                width:46, height:46, borderRadius:'50%',
                background:'var(--blue-lt)', display:'flex', alignItems:'center',
                justifyContent:'center', fontSize:22, flexShrink:0
              }}>🩺</div>
              <div>
                <div className="font-bold" style={{ fontSize:15 }}>Dr. {d.name}</div>
                <div className="text-muted text-sm">{d.specialization}</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:13 }}>
              <div className="flex gap-2 items-center">
                <span className="text-muted">Department:</span>
                <span className={`badge ${deptColors[deptMap[d.dept_name] % deptColors.length]}`}>{d.dept_name}</span>
              </div>
              <div className="flex gap-2 items-center">
                <span className="text-muted">Consultation:</span>
                <span className="font-bold text-mono">₹{d.consultation_fee}</span>
              </div>
              {d.qualification && (
                <div className="flex gap-2 items-center">
                  <span className="text-muted">Qualification:</span>
                  <span>{d.qualification}</span>
                </div>
              )}
              {d.experience_years && (
                <div className="flex gap-2 items-center">
                  <span className="text-muted">Experience:</span>
                  <span>{d.experience_years} years</span>
                </div>
              )}
              {d.available_days && (
                <div className="flex gap-2 items-center">
                  <span className="text-muted">Available:</span>
                  <span>{d.available_days}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
