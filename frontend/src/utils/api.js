import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const patientsAPI = {
  getAll:     ()         => api.get('/patients'),
  getOne:     (id)       => api.get(`/patients/${id}`),
  getHistory: (id)       => api.get(`/patients/${id}/history`),
  create:     (data)     => api.post('/patients', data),
  update:     (id, data) => api.put(`/patients/${id}`, data),
};

export const doctorsAPI = {
  getAll:        ()     => api.get('/doctors'),
  getOne:        (id)   => api.get(`/doctors/${id}`),
  getTodayAppts: (id)   => api.get(`/doctors/${id}/appointments/today`),
  create:        (data) => api.post('/doctors', data),
};

export const departmentsAPI = {
  getAll:  ()     => api.get('/departments'),
  create:  (data) => api.post('/departments', data),
};

export const appointmentsAPI = {
  getAll:      (params)      => api.get('/appointments', { params }),
  create:      (data)        => api.post('/appointments', data),
  updateStatus:(id, status)  => api.patch(`/appointments/${id}/status`, { status }),
};

export const wardsAPI = {
  getAll:           () => api.get('/wards'),
  getAvailableBeds: () => api.get('/wards/available-beds'),
};

export const admissionsAPI = {
  getAll:    (params) => api.get('/admissions', { params }),
  admit:     (data)   => api.post('/admissions', data),
  discharge: (id)     => api.patch(`/admissions/${id}/discharge`),
};

export const labsAPI = {
  getTests:     ()         => api.get('/labs/tests'),
  getOrders:    ()         => api.get('/labs/orders'),
  createOrder:  (data)     => api.post('/labs/orders', data),
  updateResult: (id, data) => api.patch(`/labs/orders/${id}/result`, data),
};

export const pharmacyAPI = {
  getMedicines:       ()       => api.get('/pharmacy/medicines'),
  getPrescriptions:   (params) => api.get('/pharmacy/prescriptions', { params }),
  createPrescription: (data)   => api.post('/pharmacy/prescriptions', data),
};

export const machineryAPI = {
  getAll:   ()     => api.get('/machinery'),
  logUsage: (data) => api.post('/machinery/usage', data),
};

export const billingAPI = {
  // Core
  getAll:       ()           => api.get('/billing'),
  getOne:       (id)         => api.get(`/billing/${id}`),
  generate:     (data)       => api.post('/billing/generate', data),
  updateStatus: (id, status) => api.patch(`/billing/${id}/status`, { status }),

  // Charge management
  addCharge:    (id, data)      => api.post(`/billing/${id}/charges`, data),
  deleteCharge: (id, detail_id) => api.delete(`/billing/${id}/charges/${detail_id}`),
  applyDiscount:(id, data)      => api.patch(`/billing/${id}/discount`, data),

  // Medicine helpers
  getMedicineCatalogue: () =>
    api.get('/billing/medicines/catalogue'),             // all available medicines
  getUnbilledMedicines: (patient_id, params) =>
    api.get(`/billing/patient/${patient_id}/unbilled-medicines`, { params }),

  // Smart alerts
  getAlerts:    ()       => api.get('/billing/alerts/all'),
  getAlertCount:()       => api.get('/billing/alerts/count'),
  resolveAlert: (id, by) => api.patch(`/billing/alerts/${id}/resolve`, { resolved_by: by }),
  scanAlerts:   ()       => api.post('/billing/alerts/scan'),
};

export const paymentsAPI = {
  record:     (data)    => api.post('/payments', data),
  getForBill: (bill_id) => api.get(`/payments/bill/${bill_id}`),
};

export const dashboardAPI = {
  getStats:        () => api.get('/dashboard/stats'),
  getRevenueChart: () => api.get('/dashboard/revenue-chart'),
  getDeptStats:    () => api.get('/dashboard/dept-stats'),
  getPatientStats: () => api.get('/dashboard/patient-stats'),
};

export const reportsAPI = {
  list: () => api.get('/reports/list'),
  run: (id) => api.get(`/reports/run/${id}`),
};

export const authAPI = {
  login:    (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
};

export default api;
