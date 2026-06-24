import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "./api.js";
import { useToast } from "./Toast.jsx";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Admin() {
  const { showToast, confirm } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/appointments`);
      if (!res.ok) throw new Error("Failed to load appointments");
      const data = await res.json();
      setAppointments(data);
    } catch (error) {
      console.error(error);
      showToast("Error fetching appointments", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleDelete = async (id) => {
    const confirmed = await confirm({
      title: "Delete appointment?",
      message: "This will permanently remove the appointment record.",
      confirmLabel: "Delete",
    });
    if (!confirmed) return;

    try {
      const res = await fetch(`${API_BASE}/appointments/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail || data.message || "Delete failed", "error");
        return;
      }
      showToast("Appointment deleted", "success");
      fetchAppointments();
    } catch (error) {
      console.error(error);
      showToast("Error deleting appointment", "error");
    }
  };

  return (
    <div className="admin-page">
      <nav className="admin-nav">
        <h1>Doc Jun - Admin</h1>
        <Link to="/" className="btn btn-back">
          Back to Booking
        </Link>
      </nav>

      <div className="admin-header">
        <h2>Appointments Dashboard</h2>
        <p>Manage all patient appointments and visit records</p>
      </div>

      <div className="admin-content">
        <div className="admin-toolbar">
          <button type="button" onClick={fetchAppointments} className="btn btn-refresh">
            Refresh
          </button>
          <span className="admin-count">Total Appointments: {appointments.length}</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="admin-empty">No appointments yet</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Age</th>
                  <th>Date</th>
                  <th>Time</th>
                  <th>Procedure</th>
                  <th>Payment</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Checked In At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr key={appt.id}>
                    <td>{appt.name}</td>
                    <td>{appt.phone || "—"}</td>
                    <td>{appt.address || "—"}</td>
                    <td>{appt.age ?? "—"}</td>
                    <td>{appt.date}</td>
                    <td>{appt.time}</td>
                    <td>{appt.procedure || "—"}</td>
                    <td>{appt.payment_method || "—"}</td>
                    <td>{formatCurrency(appt.amount_paid)}</td>
                    <td>
                      <span className={`status-badge ${appt.checked_in ? "checked" : "pending"}`}>
                        {appt.checked_in ? "Checked-In" : "Pending"}
                      </span>
                    </td>
                    <td>{appt.checked_in_at || "—"}</td>
                    <td>
                      <button
                        type="button"
                        onClick={() => handleDelete(appt.id)}
                        className="btn btn-delete"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
