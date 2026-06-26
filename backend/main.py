import io
import sys
import webbrowser
from datetime import datetime
from pathlib import Path

import pandas as pd
import sqlite3
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

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
TEMPLATE_PATH = DATA_DIR / "import-template.xlsx"

IMPORT_COLUMNS = [
    "name",
    "phone",
    "address",
    "age",
    "occupation",
    "status",
    "complaint",
    "visit_date",
    "visit_time",
    "visit_no",
    "description",
    "debit",
    "credit_amount",
    "credit_date",
    "payment_method",
    "checked_in_at",
]

COLUMN_ALIASES = {
    "name": ["name", "patient_name", "full_name"],
    "phone": ["phone", "telephone", "contact", "mobile"],
    "address": ["address"],
    "age": ["age"],
    "occupation": ["occupation", "job"],
    "status": ["status", "marital_status"],
    "complaint": ["complaint", "complain", "chief_complaint"],
    "visit_date": ["visit_date", "appointment_date", "date"],
    "visit_time": ["visit_time", "appointment_time", "time"],
    "visit_no": ["visit_no", "no", "number", "visit_number"],
    "description": ["description", "procedure", "service"],
    "debit": ["debit", "charge", "fee"],
    "credit_amount": ["credit_amount", "amount_paid", "amount", "credit", "payment"],
    "credit_date": ["credit_date", "payment_date"],
    "payment_method": ["payment_method", "payment"],
    "checked_in_at": ["checked_in_at", "check_in_date", "checkin_date"],
}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8000",
        "http://localhost:8000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

conn = sqlite3.connect(DB_PATH, check_same_thread=False)
cursor = conn.cursor()


def normalize_time(value: str | None) -> str:
    if not value or str(value).strip() == "":
        return ""
    text = str(value).strip()
    if " " in text:
        text = text.split(" ")[-1]
    parts = text.split(":")
    if len(parts) >= 2:
        return f"{int(float(parts[0])):02d}:{int(float(parts[1])):02d}"
    return text


def normalize_name(value: str | None) -> str:
    if not value:
        return ""
    return " ".join(str(value).strip().lower().split())


def normalize_phone(value: str | None) -> str:
    if not value:
        return ""
    return "".join(ch for ch in str(value) if ch.isdigit())


def safe_float(value) -> float:
    if value is None or value == "":
        return 0.0
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def safe_int(value) -> int | None:
    if value is None or value == "":
        return None
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return None


def init_db():
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS patients (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT,
            age INTEGER,
            occupation TEXT,
            status TEXT,
            complaint TEXT,
            created_at TEXT NOT NULL
        )
        """
    )
    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS visits (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            patient_id INTEGER NOT NULL,
            visit_date TEXT NOT NULL,
            visit_time TEXT,
            visit_no INTEGER,
            description TEXT,
            debit REAL DEFAULT 0,
            credit_amount REAL DEFAULT 0,
            credit_date TEXT,
            payment_method TEXT,
            checked_in_at TEXT,
            is_pending INTEGER DEFAULT 0,
            FOREIGN KEY (patient_id) REFERENCES patients(id)
        )
        """
    )
    conn.commit()
    migrate_legacy_appointments()


def migrate_legacy_appointments():
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'")
    if not cursor.fetchone():
        return

    cursor.execute("SELECT COUNT(*) FROM visits")
    if cursor.fetchone()[0] > 0:
        return

    rows = cursor.execute("SELECT * FROM appointments").fetchall()
    for row in rows:
        patient_id = find_or_create_patient(
            name=row[1],
            phone=row[2],
            address=row[6],
            age=row[7],
        )
        is_pending = 0 if row[5] else 1
        cursor.execute(
            """
            INSERT INTO visits (
                patient_id, visit_date, visit_time, description, debit, credit_amount,
                payment_method, checked_in_at, is_pending
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id,
                row[3],
                normalize_time(row[4]),
                row[10],
                safe_float(row[9]),
                safe_float(row[9]),
                row[8],
                row[11],
                is_pending,
            ),
        )
    conn.commit()


def find_or_create_patient(
    name: str,
    phone: str,
    address: str | None = None,
    age: int | None = None,
    occupation: str | None = None,
    status: str | None = None,
    complaint: str | None = None,
) -> int:
    phone_key = normalize_phone(phone)
    name_key = normalize_name(name)

    cursor.execute("SELECT id, name, phone, address, age, occupation, status, complaint FROM patients")
    for row in cursor.fetchall():
        if normalize_phone(row[2]) == phone_key and normalize_name(row[1]) == name_key:
            cursor.execute(
                """
                UPDATE patients
                SET address = COALESCE(?, address),
                    age = COALESCE(?, age),
                    occupation = COALESCE(?, occupation),
                    status = COALESCE(?, status),
                    complaint = COALESCE(?, complaint)
                WHERE id = ?
                """,
                (
                    address,
                    age,
                    occupation,
                    status,
                    complaint,
                    row[0],
                ),
            )
            conn.commit()
            return row[0]

    created_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    cursor.execute(
        """
        INSERT INTO patients (name, phone, address, age, occupation, status, complaint, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            name.strip(),
            phone.strip(),
            address.strip() if address else None,
            age,
            occupation,
            status,
            complaint,
            created_at,
        ),
    )
    conn.commit()
    return cursor.lastrowid


def patient_to_dict(row: tuple) -> dict:
    balance = compute_patient_balance(row[0])
    return {
        "id": row[0],
        "name": row[1],
        "phone": row[2],
        "address": row[3],
        "age": row[4],
        "occupation": row[5],
        "status": row[6],
        "complaint": row[7],
        "created_at": row[8],
        "balance": balance,
    }


def visit_to_dict(row: tuple, patient: dict | None = None) -> dict:
    data = {
        "id": row[0],
        "patient_id": row[1],
        "visit_date": row[2],
        "visit_time": row[3],
        "visit_no": row[4],
        "description": row[5],
        "debit": row[6],
        "credit_amount": row[7],
        "credit_date": row[8],
        "payment_method": row[9],
        "checked_in_at": row[10],
        "is_pending": bool(row[11]),
        "checked_in": not bool(row[11]),
    }
    if patient:
        data.update(
            {
                "name": patient["name"],
                "phone": patient["phone"],
                "address": patient["address"],
                "age": patient["age"],
                "occupation": patient["occupation"],
                "status": patient["status"],
                "complaint": patient["complaint"],
                "date": row[2],
                "time": row[3],
                "procedure": row[5],
                "amount_paid": row[7],
            }
        )
    return data


def appointment_to_legacy_dict(visit: dict) -> dict:
    return {
        "id": visit["id"],
        "name": visit.get("name"),
        "phone": visit.get("phone"),
        "address": visit.get("address"),
        "age": visit.get("age"),
        "occupation": visit.get("occupation"),
        "status": visit.get("status"),
        "complaint": visit.get("complaint"),
        "date": visit.get("visit_date"),
        "time": visit.get("visit_time"),
        "procedure": visit.get("description"),
        "payment_method": visit.get("payment_method"),
        "debit": visit.get("debit"),
        "amount_paid": visit.get("credit_amount"),
        "checked_in": visit.get("checked_in"),
        "checked_in_at": visit.get("checked_in_at"),
        "patient_id": visit.get("patient_id"),
    }


def get_patient(patient_id: int) -> dict | None:
    row = cursor.execute("SELECT * FROM patients WHERE id = ?", (patient_id,)).fetchone()
    return patient_to_dict(row) if row else None


def get_visit_with_patient(visit_id: int) -> dict | None:
    row = cursor.execute("SELECT * FROM visits WHERE id = ?", (visit_id,)).fetchone()
    if not row:
        return None
    patient = get_patient(row[1])
    return visit_to_dict(row, patient)


def compute_patient_balance(patient_id: int) -> float:
    rows = cursor.execute(
        "SELECT debit, credit_amount FROM visits WHERE patient_id = ? AND is_pending = 0",
        (patient_id,),
    ).fetchall()
    return round(sum(safe_float(r[0]) - safe_float(r[1]) for r in rows), 2)


def get_visit_history(patient_id: int) -> list[dict]:
    rows = cursor.execute(
        """
        SELECT * FROM visits
        WHERE patient_id = ? AND is_pending = 0
        ORDER BY visit_date ASC, visit_time ASC, id ASC
        """,
        (patient_id,),
    ).fetchall()
    running = 0.0
    history = []
    for row in rows:
        running += safe_float(row[6]) - safe_float(row[7])
        item = visit_to_dict(row)
        item["balance"] = round(running, 2)
        history.append(item)
    return list(reversed(history))


def find_pending_visit(name: str, date: str, time: str, phone: str | None = None):
    rows = cursor.execute(
        """
        SELECT v.* FROM visits v
        JOIN patients p ON p.id = v.patient_id
        WHERE v.visit_date = ? AND v.is_pending = 1
        """,
        (date,),
    ).fetchall()
    target_name = normalize_name(name)
    target_time = normalize_time(time)
    target_phone = normalize_phone(phone) if phone else ""

    for row in rows:
        patient = get_patient(row[1])
        if normalize_name(patient["name"]) != target_name:
            continue
        if target_time and normalize_time(row[3]) != target_time:
            continue
        if target_phone and normalize_phone(patient["phone"]) != target_phone:
            continue
        return visit_to_dict(row, patient)

    if target_phone:
        for row in rows:
            patient = get_patient(row[1])
            if normalize_phone(patient["phone"]) == target_phone and normalize_time(row[3]) == target_time:
                return visit_to_dict(row, patient)
    return None


def normalize_dataframe_columns(df: pd.DataFrame) -> pd.DataFrame:
    renamed = {}
    lower_cols = {str(col).strip().lower(): col for col in df.columns}
    for target, aliases in COLUMN_ALIASES.items():
        for alias in aliases:
            if alias in lower_cols:
                renamed[lower_cols[alias]] = target
                break
    return df.rename(columns=renamed)


def parse_import_rows(df: pd.DataFrame) -> list[dict]:
    df = normalize_dataframe_columns(df)
    rows = []
    for index, raw in df.iterrows():
        row = {col: raw.get(col, "") for col in IMPORT_COLUMNS}
        row["row_number"] = int(index) + 2
        rows.append(row)
    return rows


def validate_import_row(row: dict, seen_keys: set[str]) -> dict:
    issues = []
    name = str(row.get("name", "")).strip()
    phone = str(row.get("phone", "")).strip()
    visit_date = str(row.get("visit_date", "")).strip()
    visit_time = normalize_time(row.get("visit_time"))

    if not name:
        issues.append({"level": "error", "message": "Missing patient name"})
    if not phone:
        issues.append({"level": "error", "message": "Missing phone number"})
    if not visit_date or visit_date.lower() == "nan":
        issues.append({"level": "error", "message": "Missing visit date"})

    age = safe_int(row.get("age"))
    if row.get("age") not in (None, "", "nan") and age is None:
        issues.append({"level": "error", "message": "Invalid age"})

    duplicate_key = f"{normalize_name(name)}|{normalize_phone(phone)}|{visit_date}|{visit_time}"
    if duplicate_key in seen_keys:
        issues.append({"level": "warning", "message": "Duplicate row in import file"})
    seen_keys.add(duplicate_key)

    if phone:
        cursor.execute("SELECT id, name, phone FROM patients")
        for _, existing_name, existing_phone in cursor.fetchall():
            if normalize_phone(phone) == normalize_phone(existing_phone) and normalize_name(name) != normalize_name(existing_name):
                issues.append(
                    {
                        "level": "warning",
                        "message": f"Phone matches existing patient '{existing_name}' with a different name",
                    }
                )
                break

    if visit_date and visit_time:
        cursor.execute(
            """
            SELECT p.name FROM visits v
            JOIN patients p ON p.id = v.patient_id
            WHERE v.visit_date = ? AND v.visit_time = ? AND lower(p.name) = lower(?)
            """,
            (visit_date, visit_time, name),
        )
        if cursor.fetchone():
            issues.append({"level": "warning", "message": "Matching visit already exists in database"})

    status = "error" if any(item["level"] == "error" for item in issues) else "ok"
    if status == "ok" and any(item["level"] == "warning" for item in issues):
        status = "warning"

    return {
        "row_number": row["row_number"],
        "data": row,
        "issues": issues,
        "status": status,
    }


def import_row(row: dict) -> None:
    patient_id = find_or_create_patient(
        name=str(row["name"]).strip(),
        phone=str(row["phone"]).strip(),
        address=str(row.get("address", "")).strip() or None,
        age=safe_int(row.get("age")),
        occupation=str(row.get("occupation", "")).strip() or None,
        status=str(row.get("status", "")).strip() or None,
        complaint=str(row.get("complaint", "")).strip() or None,
    )

    debit = safe_float(row.get("debit"))
    credit_amount = safe_float(row.get("credit_amount"))
    checked_in_at = str(row.get("checked_in_at", "")).strip() or None
    is_pending = 0 if checked_in_at or credit_amount > 0 or debit > 0 else 1

    cursor.execute(
        """
        INSERT INTO visits (
            patient_id, visit_date, visit_time, visit_no, description, debit, credit_amount,
            credit_date, payment_method, checked_in_at, is_pending
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            patient_id,
            str(row["visit_date"]).strip(),
            normalize_time(row.get("visit_time")) or None,
            safe_int(row.get("visit_no")),
            str(row.get("description", "")).strip() or None,
            debit,
            credit_amount,
            str(row.get("credit_date", "")).strip() or None,
            str(row.get("payment_method", "")).strip() or None,
            checked_in_at,
            is_pending,
        ),
    )


def build_template_workbook() -> bytes:
    df = pd.DataFrame(
        [
            {
                "name": "Juan Dela Cruz",
                "phone": "09171234567",
                "address": "123 Main St, Cebu City",
                "age": 35,
                "occupation": "Teacher",
                "status": "Married",
                "complaint": "Tooth pain",
                "visit_date": "2026-01-15",
                "visit_time": "09:30",
                "visit_no": 1,
                "description": "Cleaning",
                "debit": 1500,
                "credit_amount": 1500,
                "credit_date": "2026-01-15",
                "payment_method": "Cash",
                "checked_in_at": "2026-01-15 09:45:00",
            }
        ]
    )
    buffer = io.BytesIO()
    df.to_excel(buffer, index=False)
    buffer.seek(0)
    return buffer.getvalue()


init_db()


class AppointmentCreate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    address: str = Field(min_length=1)
    age: int = Field(ge=0, le=150)
    occupation: str | None = None
    status: str | None = None
    complaint: str | None = None
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
    occupation: str | None = None
    status: str | None = None
    complaint: str | None = None
    payment_method: str = Field(min_length=1)
    amount_paid: float = Field(ge=0)
    debit: float | None = None
    procedure: str = Field(min_length=1)


class PatientUpdate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    address: str | None = None
    age: int | None = Field(default=None, ge=0, le=150)
    occupation: str | None = None
    status: str | None = None
    complaint: str | None = None


class ImportConfirmRequest(BaseModel):
    rows: list[dict]


@app.post("/appointments")
def create_appointment(appt: AppointmentCreate):
    visit_time = normalize_time(appt.time)
    cursor.execute(
        """
        SELECT v.id FROM visits v
        WHERE v.visit_date = ? AND v.visit_time = ? AND v.is_pending = 1
        """,
        (appt.date, visit_time),
    )
    if cursor.fetchone():
        return {"status": "error", "message": "Time slot already booked"}

    patient_id = find_or_create_patient(
        name=appt.name,
        phone=appt.phone,
        address=appt.address,
        age=appt.age,
        occupation=appt.occupation,
        status=appt.status,
        complaint=appt.complaint,
    )
    cursor.execute(
        """
        INSERT INTO visits (patient_id, visit_date, visit_time, is_pending)
        VALUES (?, ?, ?, 1)
        """,
        (patient_id, appt.date, visit_time),
    )
    conn.commit()
    return {
        "status": "success",
        "message": "Appointment created",
        "id": cursor.lastrowid,
        "patient_id": patient_id,
    }


@app.get("/appointments")
def get_appointments():
    rows = cursor.execute(
        """
        SELECT v.* FROM visits v
        WHERE v.is_pending = 1
        ORDER BY v.visit_date DESC, v.visit_time DESC
        """
    ).fetchall()
    results = []
    for row in rows:
        patient = get_patient(row[1])
        results.append(appointment_to_legacy_dict(visit_to_dict(row, patient)))
    return results


@app.get("/appointments/all")
def get_all_appointment_records():
    rows = cursor.execute(
        """
        SELECT v.* FROM visits v
        ORDER BY v.visit_date DESC, v.visit_time DESC, v.id DESC
        """
    ).fetchall()
    results = []
    for row in rows:
        patient = get_patient(row[1])
        results.append(appointment_to_legacy_dict(visit_to_dict(row, patient)))
    return results


@app.post("/checkin")
def check_in(payload: CheckInRequest):
    visit = None
    if payload.appointment_id:
        visit = get_visit_with_patient(payload.appointment_id)

    if not visit:
        visit = find_pending_visit(payload.name, payload.date, payload.time, payload.phone)

    if not visit:
        return {
            "status": "error",
            "message": "Appointment not found. Book the appointment first or select it from the list.",
        }

    if not visit["is_pending"]:
        return {"status": "error", "message": "Patient already checked in"}

    patient_id = find_or_create_patient(
        name=payload.name,
        phone=payload.phone,
        address=payload.address,
        age=payload.age,
        occupation=payload.occupation,
        status=payload.status,
        complaint=payload.complaint,
    )
    checked_in_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    debit = payload.debit if payload.debit is not None else payload.amount_paid

    cursor.execute(
        """
        UPDATE visits
        SET patient_id = ?,
            visit_date = ?,
            visit_time = ?,
            description = ?,
            debit = ?,
            credit_amount = ?,
            credit_date = ?,
            payment_method = ?,
            checked_in_at = ?,
            is_pending = 0
        WHERE id = ?
        """,
        (
            patient_id,
            payload.date,
            normalize_time(payload.time),
            payload.procedure.strip(),
            debit,
            payload.amount_paid,
            payload.date,
            payload.payment_method.strip(),
            checked_in_at,
            visit["id"],
        ),
    )
    conn.commit()
    return {"status": "success", "message": "Checked in", "checked_in_at": checked_in_at}


@app.delete("/appointments/{appointment_id}")
def delete_appointment(appointment_id: int):
    row = cursor.execute("SELECT id FROM visits WHERE id = ?", (appointment_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Appointment not found")
    cursor.execute("DELETE FROM visits WHERE id = ?", (appointment_id,))
    conn.commit()
    return {"status": "success", "message": "Appointment deleted"}


@app.get("/patients")
def list_patients():
    rows = cursor.execute("SELECT * FROM patients ORDER BY name ASC").fetchall()
    return [patient_to_dict(row) for row in rows]


@app.get("/patients/{patient_id}")
def get_patient_detail(patient_id: int):
    patient = get_patient(patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    pending = cursor.execute(
        "SELECT * FROM visits WHERE patient_id = ? AND is_pending = 1 ORDER BY visit_date DESC",
        (patient_id,),
    ).fetchall()
    return {
        **patient,
        "visits": get_visit_history(patient_id),
        "pending_appointments": [visit_to_dict(row) for row in pending],
    }


@app.put("/patients/{patient_id}")
def update_patient(patient_id: int, payload: PatientUpdate):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    cursor.execute(
        """
        UPDATE patients
        SET name = ?, phone = ?, address = ?, age = ?, occupation = ?, status = ?, complaint = ?
        WHERE id = ?
        """,
        (
            payload.name.strip(),
            payload.phone.strip(),
            payload.address,
            payload.age,
            payload.occupation,
            payload.status,
            payload.complaint,
            patient_id,
        ),
    )
    conn.commit()
    return {"status": "success", "message": "Patient updated"}


@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    cursor.execute("DELETE FROM visits WHERE patient_id = ?", (patient_id,))
    cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
    conn.commit()
    return {"status": "success", "message": "Patient deleted"}


@app.get("/import/template")
def download_import_template():
    content = build_template_workbook()
    TEMPLATE_PATH.write_bytes(content)
    return StreamingResponse(
        io.BytesIO(content),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="import-template.xlsx"'},
    )


@app.post("/import/preview")
async def preview_import(file: UploadFile = File(...)):
    try:
        content = await file.read()
        if file.filename.lower().endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as exc:
        return {"status": "error", "message": f"Could not read file: {exc}"}

    if df.empty:
        return {"status": "error", "message": "The uploaded file has no rows"}

    parsed_rows = parse_import_rows(df)
    seen_keys: set[str] = set()
    preview = [validate_import_row(row, seen_keys) for row in parsed_rows]
    error_count = sum(1 for row in preview if row["status"] == "error")
    warning_count = sum(1 for row in preview if row["status"] == "warning")
    valid_count = sum(1 for row in preview if row["status"] == "ok")

    return {
        "status": "success",
        "summary": {
            "total": len(preview),
            "valid": valid_count,
            "warnings": warning_count,
            "errors": error_count,
        },
        "rows": preview,
    }


@app.post("/import/confirm")
def confirm_import(payload: ImportConfirmRequest):
    imported = 0
    skipped = 0
    for item in payload.rows:
        row = item.get("data", item)
        seen: set[str] = set()
        validation = validate_import_row(row, seen)
        if validation["status"] == "error":
            skipped += 1
            continue
        import_row(row)
        imported += 1
    conn.commit()
    return {
        "status": "success",
        "message": f"Imported {imported} records",
        "imported": imported,
        "skipped": skipped,
    }


@app.post("/export")
def export_appointments():
    try:
        export_to_excel()
        return {"status": "success", "message": "Exported to appointments.xlsx"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


def export_to_excel():
    export_conn = sqlite3.connect(DB_PATH)
    patients_df = pd.read_sql_query(
        """
        SELECT
            p.id AS patient_id,
            p.name,
            p.phone,
            p.address,
            p.age,
            p.occupation,
            p.status,
            p.complaint,
            p.created_at
        FROM patients p
        ORDER BY p.name ASC
        """,
        export_conn,
    )
    visits_df = pd.read_sql_query(
        """
        SELECT
            v.id AS visit_id,
            v.patient_id,
            p.name AS patient_name,
            v.visit_date,
            v.visit_time,
            v.visit_no,
            v.description,
            v.debit,
            v.credit_amount,
            v.credit_date,
            v.payment_method,
            v.checked_in_at,
            v.is_pending
        FROM visits v
        JOIN patients p ON p.id = v.patient_id
        ORDER BY p.name ASC, v.visit_date ASC, v.visit_time ASC
        """,
        export_conn,
    )
    export_conn.close()

    with pd.ExcelWriter(EXPORT_PATH, engine="openpyxl") as writer:
        patients_df.to_excel(writer, sheet_name="Patients", index=False)
        visits_df.to_excel(writer, sheet_name="Visits", index=False)


if FRONTEND_DIST.exists():
    assets_dir = FRONTEND_DIST / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    def serve_home():
        return FileResponse(FRONTEND_DIST / "index.html")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        api_prefixes = ("appointments", "checkin", "export", "patients", "import")
        if full_path.startswith(api_prefixes) or full_path == "export":
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
