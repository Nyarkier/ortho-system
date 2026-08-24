import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "./api.js";
import { useToast } from "./Toast.jsx";
import "./App.css";

const PAYMENT_METHODS = [
  "Cash",
  "GCash",
  "Bank Transfer",
  "Credit Card",
  "Debit Card",
  "Installment",
  "Other",
];
const UPCOMING_THRESHOLD_MINUTES = 60;

const emptyPatient = {
  name: "",
  address: "",
  phone: "",
  age: "",
  occupation: "",
  status: "",
  complaint: "",
  date: "",
  time: "",
};

const emptyVisit = {
  appointmentId: "",
  debit: "",
  paymentMethod: "",
  amountPaid: "",
  procedure: "",
  nextProcedure: "",
};

function App() {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [patient, setPatient] = useState(emptyPatient);
  const [visit, setVisit] = useState(emptyVisit);
  const [pendingAppointments, setPendingAppointments] = useState([]);
  const [isExporting, setIsExporting] = useState(false);
  const checkInRef = React.useRef(null);

  const updatePatient = (field, value) => {
    setPatient((prev) => ({ ...prev, [field]: value }));
  };

  const updateVisit = (field, value) => {
    setVisit((prev) => ({ ...prev, [field]: value }));
  };

  const loadPendingAppointments = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/appointments`);
      if (!res.ok) return;
      const appointments = await res.json();
      setPendingAppointments(appointments.filter((appt) => !appt.checked_in));
    } catch (error) {
      console.error("Failed to load pending appointments", error);
    }
  }, []);

  const applyAppointmentToPatient = (appt) => {
    setPatient({
      name: appt.name || "",
      address: appt.address || "",
      phone: appt.phone || "",
      age: appt.age ?? "",
      occupation: appt.occupation || "",
      status: appt.status || "",
      complaint: appt.complaint || "",
      date: appt.date || "",
      time: appt.time || "",
    });
    setVisit((prev) => ({
      ...prev,
      appointmentId: String(appt.id),
      procedure: appt.procedure || "",
      nextProcedure: "",
    }));
  };

  const handleSelectAppointment = (appointmentId) => {
    updateVisit("appointmentId", appointmentId);

    if (!appointmentId) {
      setPatient(emptyPatient);
      return;
    }

    const appt = pendingAppointments.find((item) => String(item.id) === appointmentId);
    if (appt) {
      applyAppointmentToPatient(appt);
    }
  };

  const scrollToCheckIn = () => {
    checkInRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const checkUpcomingAppointments = async () => {
    try {
      const res = await fetch(`${API_BASE}/appointments`);
      if (!res.ok) return;
      const appointments = await res.json();
      const now = new Date();
      const soon = appointments.find((appt) => {
        if (appt.checked_in) return false;
        const appointmentDate = new Date(`${appt.date}T${appt.time}`);
        const diffMin = (appointmentDate - now) / 1000 / 60;
        return diffMin >= 0 && diffMin <= UPCOMING_THRESHOLD_MINUTES;
      });

      if (soon) {
        const minutesLeft = Math.round(
          (new Date(`${soon.date}T${soon.time}`) - now) / 1000 / 60
        );
        showToast(
          `Reminder: appointment for ${soon.name} is in ${minutesLeft} minutes.`,
          "info",
          6000
        );
      }
    } catch (error) {
      console.error("Upcoming appointment check failed", error);
    }
  };

  useEffect(() => {
    loadPendingAppointments();
    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPendingAppointments]);

  const handleSubmit = async () => {
    const { name, address, phone, age, occupation, status, complaint, date, time } = patient;
    const { procedure } = visit;

    if (!name || !address || !phone || !age || !date || !time) {
      showToast("Please fill all booking fields", "warning");
      return;
    }

    if (Number(age) < 0) {
      showToast("Age must be a valid number", "warning");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          address,
          phone,
          age: Number(age),
          occupation: occupation || null,
          status: status || null,
          complaint: complaint || null,
          procedure: procedure || null,
          date,
          time,
        }),
      });
      const data = await res.json();
      if (data.status === "error") {
        showToast(data.message, "error");
      } else {
        showToast("Appointment booked. Scroll down to complete check-in.", "success");
        if (data.id) {
          setVisit((prev) => ({ ...prev, appointmentId: String(data.id) }));
        }
        await loadPendingAppointments();
        scrollToCheckIn();
      }
    } catch (error) {
      showToast(`Unable to reach backend. Start the server on ${API_BASE}.`, "error");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    const { name, address, phone, age, occupation, status, complaint, date, time } = patient;
    const { appointmentId, paymentMethod, amountPaid, procedure, nextProcedure } = visit;

    if (!appointmentId) {
      showToast("Select the patient's booked appointment first", "warning");
      return;
    }

    if (
      !name ||
      !address ||
      !phone ||
      !age ||
      !date ||
      !time ||
      !paymentMethod ||
      visit.debit === "" ||
      amountPaid === "" ||
      !procedure
    ) {
      showToast("Please fill all check-in fields", "warning");
      return;
    }

    const charge = Number(visit.debit);
    const paid = Number(amountPaid);
    if (Number(age) < 0 || charge < 0 || paid < 0) {
      showToast("Age, charge, and amount paid must be valid numbers", "warning");
      return;
    }

    if (paid > charge) {
      showToast("Amount paid cannot exceed total charge", "warning");
      return;
    }

    setIsCheckingIn(true);
    try {
      const res = await fetch(`${API_BASE}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appointment_id: appointmentId ? Number(appointmentId) : null,
          name,
          date,
          time,
          address,
          phone,
          age: Number(age),
          occupation: occupation || null,
          status: status || null,
          complaint: complaint || null,
          next_procedure: nextProcedure || null,
          debit: Number(visit.debit),
          payment_method: paymentMethod,
          amount_paid: Number(amountPaid),
          procedure,
        }),
      });
      const data = await res.json();
      if (data.status === "error") {
        showToast(data.message, "error");
      } else {
        showToast(
          `${data.message}${data.checked_in_at ? ` at ${data.checked_in_at}` : ""}`,
          "success"
        );
        setPatient(emptyPatient);
        setVisit(emptyVisit);
        await loadPendingAppointments();
      }
    } catch (error) {
      showToast(`Unable to reach backend. Start the server on ${API_BASE}.`, "error");
      console.error(error);
    } finally {
      setIsCheckingIn(false);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE}/export`, { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        showToast("Export complete: appointments.xlsx created.", "success");
      } else {
        showToast(data.message || "Export failed", "error");
      }
    } catch (error) {
      showToast(`Unable to reach backend. Start the server on ${API_BASE}.`, "error");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  const openQueueDisplay = () => {
    window.open("/queue-display", "_blank", "noopener,noreferrer");
  };

  return (
    <div className="app">
      <div className="brand-bar">
        <h2>Dr. Jun Villaflores, DMD</h2>
        <div className="brand-actions">
          <Link to="/admin" className="btn btn-admin">
            Admin
          </Link>
          <button type="button" className="btn btn-queue-display" onClick={openQueueDisplay}>
            Queue Display
          </button>
          <button
            type="button"
            className={`btn btn-extract ${isExporting ? "btn-loading" : ""}`}
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? "Extracting..." : "Extract"}
          </button>
        </div>
      </div>

      <div className="hero">
        <h1>Your Smile, Our Priority</h1>
        <p>Book and check-in easily</p>
      </div>

      <div className="container">
        <div className="card">
          <h3>Book Appointment</h3>
          <p className="card-subtitle">For new patients or future visits. After booking, complete check-in below.</p>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={patient.name}
                onChange={(e) => updatePatient("name", e.target.value)}
                required
              />
              <label>Name</label>
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={patient.address}
                onChange={(e) => updatePatient("address", e.target.value)}
                required
              />
              <label>Address</label>
            </div>

            <div className="input-group">
              <input
                type="tel"
                placeholder=" "
                value={patient.phone}
                onChange={(e) => updatePatient("phone", e.target.value)}
                required
              />
              <label>Telephone</label>
            </div>

            <div className="input-row">
              <div className="input-group">
                <input
                  type="text"
                  placeholder=" "
                  value={patient.occupation}
                  onChange={(e) => updatePatient("occupation", e.target.value)}
                />
                <label>Occupation</label>
              </div>

              <div className="input-group">
                <input
                  type="text"
                  placeholder=" "
                  value={patient.status}
                  onChange={(e) => updatePatient("status", e.target.value)}
                />
                <label>Status</label>
              </div>
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={patient.complaint}
                onChange={(e) => updatePatient("complaint", e.target.value)}
              />
              <label>Complaint</label>
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={visit.procedure}
                onChange={(e) => updateVisit("procedure", e.target.value)}
              />
              <label>Current Procedure</label>
            </div>

            <div className="input-row">
              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  max="150"
                  placeholder=" "
                  value={patient.age}
                  onChange={(e) => updatePatient("age", e.target.value)}
                  required
                />
                <label>Age</label>
              </div>

              <div className="input-group">
                <input
                  type="date"
                  placeholder=" "
                  value={patient.date}
                  onChange={(e) => updatePatient("date", e.target.value)}
                  required
                />
                <label>Appointment Date</label>
              </div>
            </div>

            <div className="input-group">
              <input
                type="time"
                placeholder=" "
                value={patient.time}
                onChange={(e) => updatePatient("time", e.target.value)}
                required
              />
              <label>Appointment Time</label>
            </div>

            <button
              type="button"
              className={`btn btn-confirm ${isLoading ? "btn-loading" : ""}`}
              onClick={handleSubmit}
              disabled={isLoading}
            >
              {isLoading ? "Processing..." : "Confirm"}
            </button>
          </form>
        </div>

        <div className="card checkin-card" ref={checkInRef} id="checkin-card">
          <h3>Patient Check-In</h3>
          <p className="card-subtitle">
            When the patient arrives: select their appointment, enter payment details, then check in.
          </p>
          <form onSubmit={(e) => e.preventDefault()}>
            <div className="checkin-steps">
              <span className="step-badge">Step 1</span>
              <span className="step-text">Select appointment</span>
            </div>
            <div className="input-group">
              <select
                className={visit.appointmentId ? "has-value" : ""}
                value={visit.appointmentId}
                onChange={(e) => handleSelectAppointment(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select booked appointment
                </option>
                {pendingAppointments.length === 0 ? (
                  <option value="" disabled>
                    No pending appointments — book one above first
                  </option>
                ) : (
                  pendingAppointments.map((appt) => (
                    <option key={appt.id} value={appt.id}>
                      {appt.name} — {appt.date} at {appt.time}
                    </option>
                  ))
                )}
              </select>
              <label>Booked Appointment</label>
            </div>

            <div className="checkin-steps">
              <span className="step-badge">Step 2</span>
              <span className="step-text">Confirm patient details</span>
            </div>
            {!visit.appointmentId ? (
              <div className="checkin-empty">
                Select an appointment to load the patient's details.
              </div>
            ) : (
              <div className="checkin-summary">
              <div className="summary-item">
                <span className="summary-label">Name</span>
                <span className="summary-value">{patient.name || "—"}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Address</span>
                <span className="summary-value">{patient.address || "—"}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Telephone</span>
                <span className="summary-value">{patient.phone || "—"}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Occupation</span>
                <span className="summary-value">{patient.occupation || "—"}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Status</span>
                <span className="summary-value">{patient.status || "—"}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Complaint</span>
                <span className="summary-value">{patient.complaint || "—"}</span>
              </div>
              <div className="summary-item">
                <span className="summary-label">Current Procedure</span>
                <span className="summary-value">{visit.procedure || "—"}</span>
              </div>
              <div className="summary-row">
                <div className="summary-item">
                  <span className="summary-label">Age</span>
                  <span className="summary-value">{patient.age !== "" ? patient.age : "—"}</span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Appointment Date</span>
                  <span className="summary-value">{patient.date || "—"}</span>
                </div>
              </div>
              <div className="summary-item">
                <span className="summary-label">Appointment Time</span>
                <span className="summary-value">{patient.time || "—"}</span>
              </div>
              </div>
            )}

            <div className="checkin-steps">
              <span className="step-badge">Step 3</span>
              <span className="step-text">Enter visit payment details</span>
            </div>
            <div className="input-row">
              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder=" "
                  value={visit.debit}
                  onChange={(e) => updateVisit("debit", e.target.value)}
                  required
                />
                <label>Total Charge</label>
              </div>

              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder=" "
                  value={visit.amountPaid}
                  onChange={(e) => updateVisit("amountPaid", e.target.value)}
                  required
                />
                <label>Amount Paid</label>
              </div>
            </div>

            <div className="input-row">
              <div className="input-group">
                <select
                  value={visit.paymentMethod}
                  onChange={(e) => updateVisit("paymentMethod", e.target.value)}
                  required
                >
                  <option value="" disabled hidden />
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
                <label>Payment Method</label>
              </div>
            </div>

            {visit.debit !== "" && visit.amountPaid !== "" && (
              <div className="installment-summary">
                <p>
                  Remaining balance: ₱{Math.max(0, Number(visit.debit) - Number(visit.amountPaid)).toFixed(2)}
                </p>
              </div>
            )}

            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={visit.procedure}
                onChange={(e) => updateVisit("procedure", e.target.value)}
                required
              />
              <label>Procedure</label>
            </div>

            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={visit.nextProcedure}
                onChange={(e) => updateVisit("nextProcedure", e.target.value)}
              />
              <label>Next Procedure</label>
            </div>

            <button
              type="button"
              className={`btn btn-checkin ${isCheckingIn ? "btn-loading" : ""}`}
              onClick={handleCheckIn}
              disabled={isCheckingIn || !visit.appointmentId}
            >
              {isCheckingIn ? "Checking in..." : "Check-In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default App;
