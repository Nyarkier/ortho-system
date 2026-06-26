import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { API_BASE } from "./api.js";
import { useToast } from "./Toast.jsx";
import AdminNav from "./AdminNav.jsx";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function PatientDetail() {
  const { id } = useParams();
  const { showToast, confirm } = useToast();
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchPatient = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/patients/${id}`);
      if (!res.ok) throw new Error("Patient not found");
      setPatient(await res.json());
    } catch (error) {
      console.error(error);
      showToast("Error loading patient record", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatient();
  }, [id]);

  const handleDelete = async () => {
    const confirmed = await confirm({
      title: "Delete patient?",
      message: "This will permanently remove the patient and all visit records.",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/patients/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || "Delete failed", "error");
        return;
      }
      showToast("Patient deleted", "success");
      window.location.href = "/admin/patients";
    } catch (error) {
      console.error(error);
      showToast("Error deleting patient", "error");
    }
  };

  if (loading) {
    return (
      <div className="admin-page">
        <AdminNav title="Patient Ledger" subtitle="Loading patient record..." />
        <div className="admin-content admin-empty">Loading...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="admin-page">
        <AdminNav title="Patient Ledger" subtitle="Record not found" />
        <div className="admin-content admin-empty">
          Patient not found. <Link to="/admin/patients">Back to patients</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <AdminNav
        title={patient.name}
        subtitle="Patient profile and visit ledger matching the paper card"
      />

      <div className="admin-content">
        <div className="admin-toolbar">
          <Link to="/admin/patients" className="btn btn-back">
            Back to Patients
          </Link>
          <button type="button" onClick={handleDelete} className="btn btn-delete">
            Delete Patient
          </button>
          <span className="admin-count">Current Balance: {formatCurrency(patient.balance)}</span>
        </div>

        <div className="patient-profile card">
          <div className="profile-grid">
            <div><span>Phone</span><strong>{patient.phone}</strong></div>
            <div><span>Address</span><strong>{patient.address || "—"}</strong></div>
            <div><span>Age</span><strong>{patient.age ?? "—"}</strong></div>
            <div><span>Occupation</span><strong>{patient.occupation || "—"}</strong></div>
            <div><span>Status</span><strong>{patient.status || "—"}</strong></div>
            <div><span>Complaint</span><strong>{patient.complaint || "—"}</strong></div>
          </div>
        </div>

        {patient.pending_appointments?.length > 0 && (
          <div className="card pending-card">
            <h3>Pending Appointments</h3>
            <ul className="pending-list">
              {patient.pending_appointments.map((appt) => (
                <li key={appt.id}>
                  {appt.visit_date} at {appt.visit_time || "—"}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="admin-table-wrap">
          <table className="admin-table ledger-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>No.</th>
                <th>Description</th>
                <th>Time</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Credit Date</th>
                <th>Payment</th>
                <th>Balance</th>
              </tr>
            </thead>
            <tbody>
              {patient.visits?.length ? (
                patient.visits.map((visit) => (
                  <tr key={visit.id}>
                    <td>{visit.visit_date}</td>
                    <td>{visit.visit_no ?? "—"}</td>
                    <td>{visit.description || "—"}</td>
                    <td>{visit.visit_time || "—"}</td>
                    <td>{formatCurrency(visit.debit)}</td>
                    <td>{formatCurrency(visit.credit_amount)}</td>
                    <td>{visit.credit_date || "—"}</td>
                    <td>{visit.payment_method || "—"}</td>
                    <td>{formatCurrency(visit.balance)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="admin-empty-cell">
                    No completed visits yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default PatientDetail;
