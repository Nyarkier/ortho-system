import sys
import webbrowser
from datetime import datetime
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import pandas as pd
import sqlite3

BASE_DIR = Path(__file__).resolve().parent

if getattr(sys, "_MEIPASS", None):
    FRONTEND_DIST = Path(sys._MEIPASS) / "dist"
    exe_dir = Path(sys.executable).resolve().parent
    DATA_DIR = exe_dir.parent if exe_dir.name == "package" else BASE_DIR.parent / "dist"
else:
    FRONTEND_DIST = BASE_DIR.parent / "ortho-app" / "dist"
    DATA_DIR = BASE_DIR.parent / "dist"

DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DATA_DIR / "appointments.db"
EXPORT_PATH = DATA_DIR / "appointments.xlsx"

APPOINTMENT_COLUMNS = [
    ("address", "TEXT"),
    ("age", "INTEGER"),
    ("payment_method", "TEXT"),
    ("amount_paid", "REAL"),
    ("procedure", "TEXT"),
    ("checked_in_at", "TEXT"),
]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:8000", "http://localhost:8000", "http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()

cursor.execute("""
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    checked_in INTEGER DEFAULT 0,
    address TEXT,
    age INTEGER,
    payment_method TEXT,
    amount_paid REAL,
    procedure TEXT,
    checked_in_at TEXT
)
""")
conn.commit()

existing_columns = {row[1] for row in cursor.execute("PRAGMA table_info(appointments)")}
for column_name, column_type in APPOINTMENT_COLUMNS:
    if column_name not in existing_columns:
        cursor.execute(f"ALTER TABLE appointments ADD COLUMN {column_name} {column_type}")
conn.commit()


class AppointmentCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    address: str = Field(min_length=1)
    age: int = Field(ge=0, le=150)
    date: str = Field(min_length=1)
    time: str = Field(min_length=1)


class CheckInRequest(BaseModel):
    appointment_id: int | None = None
    name: str = Field(min_length=1)
    date: str = Field(min_length=1)
    time: str = Field(min_length=1)
    address: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    age: int = Field(ge=0, le=150)
    payment_method: str = Field(min_length=1)
    amount_paid: float = Field(ge=0)
    procedure: str = Field(min_length=1)


def normalize_time(value: str) -> str:
    parts = value.strip().split(":")
    if len(parts) >= 2:
        return f"{int(parts[0]):02d}:{int(parts[1]):02d}"
    return value.strip()


def normalize_name(value: str) -> str:
    return " ".join(value.strip().lower().split())


def find_appointment(name: str, date: str, time: str, phone: str | None = None):
    cursor.execute(
        "SELECT * FROM appointments WHERE date = ? AND checked_in = 0",
        (date,),
    )
    rows = cursor.fetchall()
    target_name = normalize_name(name)
    target_time = normalize_time(time)
    target_phone = phone.strip() if phone else None

    for row in rows:
        if normalize_name(row[1]) != target_name:
            continue
        if normalize_time(row[4]) != target_time:
            continue
        if target_phone and row[2].strip() != target_phone.strip():
            continue
        return row

    if target_phone:
        for row in rows:
            if row[2].strip() == target_phone.strip() and normalize_time(row[4]) == target_time:
                return row

    return None


def row_to_dict(row: tuple) -> dict:
    return {
        "id": row[0],
        "name": row[1],
        "phone": row[2],
        "date": row[3],
        "time": row[4],
        "checked_in": bool(row[5]),
        "address": row[6],
        "age": row[7],
        "payment_method": row[8],
        "amount_paid": row[9],
        "procedure": row[10],
        "checked_in_at": row[11],
    }


@app.post("/appointments")
def create_appointment(appt: AppointmentCreate):
    cursor.execute(
        "SELECT id FROM appointments WHERE date = ? AND time = ?",
        (appt.date, normalize_time(appt.time)),
    )
    if cursor.fetchone():
        return {"status": "error", "message": "Time slot already booked"}

    cursor.execute(
        """
        INSERT INTO appointments (name, phone, date, time, address, age)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            appt.name.strip(),
            appt.phone.strip(),
            appt.date,
            normalize_time(appt.time),
            appt.address.strip(),
            appt.age,
        ),
    )
    conn.commit()
    return {
        "status": "success",
        "message": "Appointment created",
        "id": cursor.lastrowid,
    }


@app.get("/appointments")
def get_appointments():
    cursor.execute("SELECT * FROM appointments ORDER BY date DESC, time DESC")
    return [row_to_dict(row) for row in cursor.fetchall()]


@app.post("/checkin")
def check_in(payload: CheckInRequest):
    appt = None

    if payload.appointment_id:
        cursor.execute(
            "SELECT * FROM appointments WHERE id = ?",
            (payload.appointment_id,),
        )
        appt = cursor.fetchone()

    if not appt:
        appt = find_appointment(
            payload.name,
            payload.date,
            payload.time,
            payload.phone,
        )

    if not appt:
        return {"status": "error", "message": "Appointment not found. Book the appointment first or select it from the list."}

    if appt[5]:
        return {"status": "error", "message": "Patient already checked in"}

    checked_in_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        UPDATE appointments
        SET checked_in = 1,
            name = ?,
            phone = ?,
            address = ?,
            age = ?,
            payment_method = ?,
            amount_paid = ?,
            procedure = ?,
            checked_in_at = ?
        WHERE id = ?
        """,
        (
            payload.name.strip(),
            payload.phone.strip(),
            payload.address.strip(),
            payload.age,
            payload.payment_method.strip(),
            payload.amount_paid,
            payload.procedure.strip(),
            checked_in_at,
            appt[0],
        ),
    )
    conn.commit()
    return {"status": "success", "message": "Checked in", "checked_in_at": checked_in_at}


@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int):
    cursor.execute("SELECT id FROM appointments WHERE id = ?", (appointment_id,))
    if not cursor.fetchone():
        raise HTTPException(status_code=404, detail="Appointment not found")

    cursor.execute("DELETE FROM appointments WHERE id = ?", (appointment_id,))
    conn.commit()
    return {"status": "success", "message": "Appointment deleted"}


@app.post("/export")
def export_appointments():
    try:
        export_to_excel()
        return {"status": "success", "message": "Exported to appointments.xlsx"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def export_to_excel():
    export_conn = sqlite3.connect(DB_PATH)
    df = pd.read_sql_query(
        """
        SELECT
            id,
            name,
            phone,
            address,
            age,
            date AS appointment_date,
            time AS appointment_time,
            "procedure",
            payment_method,
            amount_paid,
            checked_in,
            checked_in_at
        FROM appointments
        ORDER BY date DESC, time DESC
        """,
        export_conn,
    )
    df.to_excel(EXPORT_PATH, index=False)
    export_conn.close()


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_home():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        if full_path.startswith("appointments") or full_path.startswith("checkin") or full_path == "export":
            raise HTTPException(status_code=404, detail="Not found")

        requested = FRONTEND_DIST / full_path
        if requested.is_file():
            return FileResponse(requested)
        return FileResponse(FRONTEND_DIST / "index.html")
else:
    print(f"WARNING: Frontend dist folder not found at {FRONTEND_DIST}")

scheduler = BackgroundScheduler()
scheduler.add_job(export_to_excel, "interval", days=7)
scheduler.start()

if __name__ == "__main__":
    url = "http://127.0.0.1:8000"
    try:
        webbrowser.open(url)
    except Exception:
        pass
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
