import io
import sys
import webbrowser
from datetime import date, datetime
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
        "http://localhost:5174",
        "http://127.0.0.1:5174",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
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


def normalize_import_value(value) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        text = value.strip()
        if text.lower() in {"", "nan", "none", "null"}:
            return ""
        return text
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m-%d")
    if isinstance(value, float) and pd.isna(value):
        return ""
    if isinstance(value, pd.Timestamp):
        if pd.isna(value):
            return ""
        return value.strftime("%Y-%m-%d")
    text = str(value).strip()
    if text.lower() in {"", "nan", "none", "null"}:
        return ""
    return text


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
            created_at TEXT NOT NULL,
            balance_adjustment REAL DEFAULT 0
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
    cursor.execute(
        "CREATE INDEX IF NOT EXISTS idx_visits_pending_date_time ON visits(is_pending, visit_date, visit_time)"
    )
    conn.commit()
    ensure_patient_balance_adjustment_column()
    migrate_legacy_appointments()


def ensure_patient_balance_adjustment_column():
    try:
        cursor.execute("ALTER TABLE patients ADD COLUMN balance_adjustment REAL DEFAULT 0")
        conn.commit()
    except sqlite3.OperationalError as exc:
        if "duplicate column name" not in str(exc).lower():
            raise


def migrate_legacy_appointments():
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='appointments'")
    if not cursor.fetchone():
        return

    cursor.execute("SELECT COUNT(*) FROM visits")
    if cursor.fetchone()[0] > 0:
        return

    rows = cursor.execute("SELECT * FROM appointments").fetchall()

    def safe_get(r: tuple, idx: int):
        return r[idx] if idx < len(r) else None

    for row in rows:
        # use safe access in case legacy table has fewer columns than expected
        patient_id = find_or_create_patient(
            name=(safe_get(row, 1) or ""),
            phone=(safe_get(row, 2) or ""),
            address=safe_get(row, 6),
            age=safe_int(safe_get(row, 7)),
        )
        is_pending = 0 if (safe_get(row, 5)) else 1
        cursor.execute(
            """
            INSERT INTO visits (
                patient_id, visit_date, visit_time, description, debit, credit_amount,
                payment_method, checked_in_at, is_pending
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                patient_id,
                safe_get(row, 3),
                normalize_time(safe_get(row, 4)),
                safe_get(row, 10),
                safe_float(safe_get(row, 9)),
                safe_float(safe_get(row, 9)),
                safe_get(row, 8),
                safe_get(row, 11),
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
        "balance_adjustment": row[9] if len(row) > 9 else 0,
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
    adjustment_row = cursor.execute(
        "SELECT balance_adjustment FROM patients WHERE id = ?",
        (patient_id,),
    ).fetchone()
    adjustment = safe_float(adjustment_row[0] if adjustment_row else 0)
    return round(sum(safe_float(r[0]) - safe_float(r[1]) for r in rows) + adjustment, 2)


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


def load_import_dataframe(content: bytes, filename: str) -> pd.DataFrame:
    filename = (filename or "").lower()
    buffer = io.BytesIO(content)

    if filename.endswith(".csv"):
        return pd.read_csv(buffer, dtype=str, keep_default_na=False, encoding="utf-8-sig")

    if filename.endswith(".xls"):
        try:
            return pd.read_excel(buffer, engine="xlrd", dtype=str)
        except ImportError as exc:
            raise RuntimeError("Excel .xls files need the xlrd package. Please save the file as .xlsx or install xlrd.") from exc

    try:
        return pd.read_excel(buffer, engine="openpyxl", dtype=str)
    except Exception:
        buffer.seek(0)
        return pd.read_excel(buffer, dtype=str)


def parse_import_rows(df: pd.DataFrame) -> list[dict]:
    df = normalize_dataframe_columns(df)
    rows = []
    for index, raw in df.iterrows():
        row = {col: normalize_import_value(raw.get(col, "")) for col in IMPORT_COLUMNS}
        row["row_number"] = int(index) + 2
        rows.append(row)
    return rows


def group_import_rows(rows: list[dict]) -> list[dict]:
    """Group rows into patient groups using phone-first then name fallback."""
    groups: dict[str, list[dict]] = {}
    order: list[str] = []
    for row in rows:
        phone = normalize_phone(row.get("phone"))
        name = normalize_name(row.get("name"))
        key = None
        if phone:
            key = f"phone:{phone}"
        elif name:
            key = f"name:{name}"
        else:
            # fallback to row number unique key
            key = f"row:{row.get('row_number')}"

        if key not in groups:
            groups[key] = []
            order.append(key)
        groups[key].append(row)

    result = []
    for key in order:
        grp_rows = groups[key]
        # use first row as representative patient info
        rep = grp_rows[0]
        result.append(
            {
                "key": key,
                "patient": {
                    "name": rep.get("name", ""),
                    "phone": rep.get("phone", ""),
                    "address": rep.get("address", ""),
                    "age": rep.get("age", ""),
                },
                "rows": grp_rows,
            }
        )
    return result


def validate_import_row(row: dict, seen_keys: set[str]) -> dict:
    issues = []
    name = normalize_import_value(row.get("name")).strip()
    phone = normalize_import_value(row.get("phone")).strip()
    visit_date = normalize_import_value(row.get("visit_date")).strip()
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
        "row_number": row.get("row_number"),
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
    debit: float = Field(ge=0)
    amount_paid: float = Field(ge=0)
    payment_method: str = Field(min_length=1)
    procedure: str = Field(min_length=1)


class PatientUpdate(BaseModel):
    name: str = Field(min_length=1)
    phone: str = Field(min_length=1)
    address: str | None = None
    age: int | None = Field(default=None, ge=0, le=150)
    occupation: str | None = None
    status: str | None = None
    complaint: str | None = None


class BalanceAdjustmentRequest(BaseModel):
    amount: float = Field(ge=0)


class ImportConfirmRequest(BaseModel):
    rows: list[dict]


class MergePatientsRequest(BaseModel):
    source_id: int
    target_id: int


class VisitUpdate(BaseModel):
    visit_date: str | None = None
    visit_time: str | None = None
    visit_no: int | None = None
    description: str | None = None
    debit: float | None = None
    credit_amount: float | None = None
    credit_date: str | None = None
    payment_method: str | None = None
    checked_in_at: str | None = None


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


def get_next_pending_appointment() -> dict | None:
    # Use a dedicated DB connection/cursor here to avoid recursive use of the global cursor
    local_conn = sqlite3.connect(DB_PATH)
    try:
        local_cursor = local_conn.cursor()
        local_cursor.execute(
            """
            SELECT v.* FROM visits v
            WHERE v.is_pending = 1
            ORDER BY v.visit_date ASC, v.visit_time ASC, v.id ASC
            LIMIT 1
            """
        )
        row = local_cursor.fetchone()

        while row:
            if not row[2]:
                row = local_cursor.fetchone()
                continue
            visit_time = normalize_time(row[3]) or "00:00"
            try:
                datetime.fromisoformat(f"{row[2]}T{visit_time}")
            except ValueError:
                row = local_cursor.fetchone()
                continue
            patient_row = local_cursor.execute("SELECT id, name, phone, address, age, occupation, status, complaint FROM patients WHERE id = ?", (row[1],)).fetchone()
            patient = None
            if patient_row:
                patient = {
                    "id": patient_row[0],
                    "name": patient_row[1],
                    "phone": patient_row[2],
                    "address": patient_row[3],
                    "age": patient_row[4],
                    "occupation": patient_row[5],
                    "status": patient_row[6],
                    "complaint": patient_row[7],
                }
            return appointment_to_legacy_dict(visit_to_dict(row, patient))
        return None
    finally:
        local_conn.close()


@app.get("/appointments/next")
def get_next_appointment():
    next_appointment = get_next_pending_appointment()
    return {"appointment": next_appointment}


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

    if payload.amount_paid > payload.debit:
        return {"status": "error", "message": "Amount paid cannot exceed total charge."}

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
            payload.debit,
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


@app.put("/visits/{visit_id}")
def update_visit(visit_id: int, payload: VisitUpdate):
    row = cursor.execute("SELECT * FROM visits WHERE id = ?", (visit_id,)).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Visit not found")

    existing = visit_to_dict(row)
    debit = safe_float(payload.debit if payload.debit is not None else existing["debit"])
    credit_amount = safe_float(payload.credit_amount if payload.credit_amount is not None else existing["credit_amount"])
    if credit_amount > debit:
        return {"status": "error", "message": "Amount paid cannot exceed total charge."}

    visit_date = payload.visit_date if payload.visit_date is not None else existing["visit_date"]
    visit_time = normalize_time(payload.visit_time) if payload.visit_time is not None else existing["visit_time"]
    visit_no = payload.visit_no if payload.visit_no is not None else existing["visit_no"]
    description = payload.description if payload.description is not None else existing["description"]
    payment_method = payload.payment_method.strip() if payload.payment_method is not None else existing["payment_method"]
    payment_method = payment_method or None
    credit_date = payload.credit_date if payload.credit_date is not None else existing["credit_date"]
    if credit_amount > 0 and not credit_date:
        credit_date = datetime.now().strftime("%Y-%m-%d")
    checked_in_at = payload.checked_in_at if payload.checked_in_at is not None else existing["checked_in_at"]

    cursor.execute(
        """
        UPDATE visits
        SET visit_date = ?,
            visit_time = ?,
            visit_no = ?,
            description = ?,
            debit = ?,
            credit_amount = ?,
            credit_date = ?,
            payment_method = ?,
            checked_in_at = ?
        WHERE id = ?
        """,
        (
            visit_date,
            visit_time,
            visit_no,
            description,
            debit,
            credit_amount,
            credit_date,
            payment_method,
            checked_in_at,
            visit_id,
        ),
    )
    conn.commit()
    return {"status": "success", "message": "Visit updated"}


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


@app.post("/patients/{patient_id}/adjust-balance")
def adjust_patient_balance(patient_id: int, payload: BalanceAdjustmentRequest):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    if payload.amount <= 0:
        return {"status": "error", "message": "Amount must be greater than zero."}

    adjustment_row = cursor.execute(
        "SELECT balance_adjustment FROM patients WHERE id = ?",
        (patient_id,),
    ).fetchone()
    current_adjustment = safe_float(adjustment_row[0] if adjustment_row else 0)
    new_adjustment = current_adjustment - payload.amount

    cursor.execute(
        "UPDATE patients SET balance_adjustment = ? WHERE id = ?",
        (new_adjustment, patient_id),
    )
    conn.commit()
    return {
        "status": "success",
        "message": "Balance reduced",
        "balance": compute_patient_balance(patient_id),
    }


@app.delete("/patients/{patient_id}")
def delete_patient(patient_id: int):
    if not get_patient(patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    cursor.execute("DELETE FROM visits WHERE patient_id = ?", (patient_id,))
    cursor.execute("DELETE FROM patients WHERE id = ?", (patient_id,))
    conn.commit()
    return {"status": "success", "message": "Patient deleted"}


@app.post("/patients/merge")
def merge_patients(payload: MergePatientsRequest):
    source_id = payload.source_id
    target_id = payload.target_id
    if source_id == target_id:
        return {"status": "error", "message": "Source and target must be different."}

    source = get_patient(source_id)
    target = get_patient(target_id)
    if not source or not target:
        return {"status": "error", "message": "Source or target patient not found."}

    # Move visits from source to target
    cursor.execute("UPDATE visits SET patient_id = ? WHERE patient_id = ?", (target_id, source_id))

    # Merge patient-level fields: prefer target values, but fill with source where missing
    cursor.execute(
        "SELECT address, age, occupation, status, complaint, balance_adjustment FROM patients WHERE id = ?",
        (target_id,),
    )
    trow = cursor.fetchone()
    cursor.execute(
        "SELECT address, age, occupation, status, complaint, balance_adjustment FROM patients WHERE id = ?",
        (source_id,),
    )
    srow = cursor.fetchone()

    def choose(a, b):
        return a if a not in (None, "") else b

    new_address = choose(trow[0], srow[0])
    new_age = choose(trow[1], srow[1])
    new_occupation = choose(trow[2], srow[2])
    new_status = choose(trow[3], srow[3])
    new_complaint = choose(trow[4], srow[4])
    new_adjustment = safe_float(trow[5]) + safe_float(srow[5])

    cursor.execute(
        "UPDATE patients SET address = ?, age = ?, occupation = ?, status = ?, complaint = ?, balance_adjustment = ? WHERE id = ?",
        (new_address, new_age, new_occupation, new_status, new_complaint, new_adjustment, target_id),
    )

    # Delete source patient
    cursor.execute("DELETE FROM patients WHERE id = ?", (source_id,))
    conn.commit()

    return {"status": "success", "message": f"Merged patient {source_id} into {target_id}"}


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
        df = load_import_dataframe(content, file.filename or "")
    except Exception as exc:
        return {"status": "error", "message": f"Could not read file: {exc}"}

    if df.empty:
        return {"status": "error", "message": "The uploaded file has no rows"}

    parsed_rows = parse_import_rows(df)
    # group rows for preview
    groups = group_import_rows(parsed_rows)

    preview_groups = []
    total = 0
    errors = 0
    warnings = 0
    valids = 0
    for grp in groups:
        seen_keys: set[str] = set()
        grp_preview = [validate_import_row(row, seen_keys) for row in grp["rows"]]
        grp_errors = sum(1 for r in grp_preview if r["status"] == "error")
        grp_warnings = sum(1 for r in grp_preview if r["status"] == "warning")
        grp_valid = sum(1 for r in grp_preview if r["status"] == "ok")
        preview_groups.append({"patient": grp["patient"], "rows": grp_preview, "summary": {"total": len(grp_preview), "valid": grp_valid, "warnings": grp_warnings, "errors": grp_errors}})
        total += len(grp_preview)
        errors += grp_errors
        warnings += grp_warnings
        valids += grp_valid

    return {
        "status": "success",
        "summary": {"total": total, "valid": valids, "warnings": warnings, "errors": errors},
        "groups": preview_groups,
    }


def extract_import_row(item: dict) -> dict:
    if not isinstance(item, dict):
        return item
    if "data" in item and isinstance(item["data"], dict):
        row = {**item["data"]}
        if "row_number" in item and "row_number" not in row:
            row["row_number"] = item["row_number"]
        return row
    return item


@app.post("/import/confirm")
def confirm_import(payload: ImportConfirmRequest):
    imported = 0
    skipped = 0
    seen: set[str] = set()
    for item in payload.rows:
        row = extract_import_row(item)
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


@app.post("/import/confirm-grouped")
def confirm_import_grouped(payload: dict):
    groups = payload.get("groups") or []
    imported = 0
    skipped = 0
    for grp in groups:
        rows = grp.get("rows", [])
        seen: set[str] = set()
        for item in rows:
            row = extract_import_row(item)
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
