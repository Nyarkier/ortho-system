from fastapi import FastAPI
from pydantic import BaseModel
import sqlite3
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# -------------------------
# DATABASE SETUP
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
# MODELS
# -------------------------
class Appointment(BaseModel):
    name: str
    phone: str
    date: str
    time: str
# -------------------------
# ROUTES
# -------------------------

# CREATE APPOINTMENT
@app.post("/appointments")
def create_appointment(appt: Appointment):
    cursor.execute(
        "INSERT INTO appointments (name, phone, date, time) VALUES (?, ?, ?, ?)",
        (appt.name, appt.phone, appt.date, appt.time)
    )
    conn.commit()
    return {"message": "Appointment created"}

# GET ALL APPOINTMENTS
@app.get("/appointments")
def get_appointments():
    cursor.execute("SELECT * FROM appointments")
    data = cursor.fetchall()
    return data

# CHECK-IN

@app.post("/checkin")
def check_in(name: str, date: str, time: str):
    cursor.execute(
        "UPDATE appointments SET checked_in = 1 WHERE name = ? AND date = ? AND time = ?",
        (name, date, time)
    )
    conn.commit()
    return {"message": "Checked in"}