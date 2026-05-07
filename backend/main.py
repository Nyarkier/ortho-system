from fastapi import FastAPI
from pydantic import BaseModel
import sqlite3
from fastapi.middleware.cors import CORSMiddleware
import pandas as pd
app = FastAPI()
from apscheduler.schedulers.background import BackgroundScheduler
# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------
# DATABASE
# -------------------------
conn = sqlite3.connect("appointments.db", check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    phone TEXT,
    date TEXT,
    time TEXT,
    checked_in INTEGER DEFAULT 0
)
""")
conn.commit()

# -------------------------
# MODEL
# -------------------------
class Appointment(BaseModel):
    name: str
    phone: str
    date: str
    time: str

# -------------------------
# CREATE APPOINTMENT
# -------------------------
@app.post("/appointments")
def create_appointment(appt: Appointment):

    # 🔒 PREVENT DOUBLE BOOKING
    cursor.execute(
        "SELECT * FROM appointments WHERE date = ? AND time = ?",
        (appt.date, appt.time)
    )
    existing = cursor.fetchone()

    if existing:
        return {"status": "error", "message": "Time slot already booked"}

    cursor.execute(
        "INSERT INTO appointments (name, phone, date, time) VALUES (?, ?, ?, ?)",
        (appt.name, appt.phone, appt.date, appt.time)
    )
    conn.commit()

    return {"status": "success", "message": "Appointment created"}

# -------------------------
# GET APPOINTMENTS
# -------------------------
@app.get("/appointments")
def get_appointments():
    cursor.execute("SELECT * FROM appointments")
    rows = cursor.fetchall()

    # ✅ Convert to readable JSON
    data = []
    for row in rows:
        data.append({
            "id": row[0],
            "name": row[1],
            "phone": row[2],
            "date": row[3],
            "time": row[4],
            "checked_in": bool(row[5])
        })

    return data

# -------------------------
# CHECK-IN
# -------------------------
@app.post("/checkin")
def check_in(name: str, date: str, time: str):

    cursor.execute(
        "SELECT * FROM appointments WHERE name = ? AND date = ? AND time = ?",
        (name, date, time)
    )
    appt = cursor.fetchone()

    if not appt:
        return {"status": "error", "message": "Appointment not found"}

    cursor.execute(
        "UPDATE appointments SET checked_in = 1 WHERE name = ? AND date = ? AND time = ?",
        (name, date, time)
    )
    conn.commit()

    return {"status": "success", "message": "Checked in"}

def export_to_excel():
    conn = sqlite3.connect("appointments.db")
    
    df = pd.read_sql_query("SELECT * FROM appointments", conn)
    
    df.to_excel("appointments.xlsx", index=False)
    
    conn.close()

scheduler = BackgroundScheduler()
scheduler.add_job(export_to_excel, 'interval', days=7)  # every 7 days
scheduler.start()


#Contact me if you have any questions: Kurtkiervalerio@gmail.com #