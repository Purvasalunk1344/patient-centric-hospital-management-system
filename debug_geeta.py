import mysql.connector
import os

def get_conn():
    return mysql.connector.connect(
        host=os.getenv('DB_HOST','localhost'),
        port=int(os.getenv('DB_PORT','3306')),
        database=os.getenv('DB_NAME','hospital_db'),
        user=os.getenv('DB_USER','root'),
        password=os.getenv('DB_PASSWORD','')
    )

cnx = get_conn()
cur = cnx.cursor(dictionary=True)

# Find patient
cur.execute("SELECT patient_id, name FROM patients WHERE name LIKE '%Geeta Mehta%' LIMIT 1")
patient = cur.fetchone()
print('patient:', patient)

if patient:
    pid = patient['patient_id']
    queries = [
        ("SELECT * FROM bills WHERE patient_id = %s", 'bills'),
        ("SELECT * FROM bill_details WHERE bill_id IN (SELECT bill_id FROM bills WHERE patient_id=%s)", 'bill_details'),
        ("SELECT * FROM prescriptions WHERE patient_id=%s", 'prescriptions'),
        ("SELECT pi.*, m.medicine_name FROM prescription_items pi JOIN medicines m ON m.medicine_id=pi.medicine_id WHERE pi.prescription_id IN (SELECT prescription_id FROM prescriptions WHERE patient_id=%s)", 'prescription_items'),
        ("SELECT lo.*, lt.test_name, lt.test_price FROM lab_orders lo JOIN lab_tests lt ON lt.test_id=lo.test_id WHERE lo.patient_id=%s", 'lab_orders'),
        ("SELECT * FROM admissions WHERE patient_id=%s", 'admissions'),
        ("SELECT a.*, ud.name AS doctor_name FROM appointments a LEFT JOIN doctors d ON d.doctor_id=a.doctor_id LEFT JOIN users ud ON ud.user_id=d.user_id WHERE a.patient_id=%s", 'appointments'),
    ]
    
    for q, label in queries:
        cur.execute(q, (pid,))
        rows = cur.fetchall()
        print('\n=== ' + label + ' (' + str(len(rows)) + ' rows) ===')
        for r in rows:
            print(r)

cur.close()
cnx.close()
