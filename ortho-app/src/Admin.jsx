import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "./api.js";
import { useToast } from "./Toast.jsx";
import AdminNav from "./AdminNav.jsx";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Admin() {
  const { showToast, confirm } = useToast();
  const [appointments, setAppointments] = useState([]);
  const [nearestAppointment, setNearestAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMore, setShowMore] = useState(false);
  const [queueInput, setQueueInput] = useState("");
  const [currentQueueNumber, setCurrentQueueNumber] = useState(null);
  const [isCallingQueue, setIsCallingQueue] = useState(false);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/appointments/all`);
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

  const fetchNearestAppointment = async () => {
    try {
      const res = await fetch(`${API_BASE}/appointments/next`);
      if (!res.ok) return;
      const data = await res.json();
      setNearestAppointment(data.appointment || null);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchQueueState = async () => {
    try {
      const res = await fetch(`${API_BASE}/queue/current`);
      if (!res.ok) return;
      const data = await res.json();
      setCurrentQueueNumber(data.current_number ?? null);
    } catch (error) {
      console.error("Error fetching queue state", error);
    }
  };

  const callQueueNumber = async () => {
    if (!/^(?:[1-9]|[1-5]\d|60)$/.test(queueInput)) {
      showToast("Enter a whole ticket number from 1 to 60", "warning");
      return;
    }

    setIsCallingQueue(true);
    try {
      const res = await fetch(`${API_BASE}/queue/call`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: Number(queueInput) }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.detail?.[0]?.msg || data.detail || "Unable to call queue number", "error");
        return;
      }
      setCurrentQueueNumber(data.current_number);
      showToast(`Now serving ${String(data.current_number).padStart(2, "0")}`, "success");
    } catch (error) {
      showToast("Unable to reach the queue service", "error");
      console.error(error);
    } finally {
      setIsCallingQueue(false);
    }
  };

  const openQueueDisplay = () => {
    window.open("/queue-display", "_blank", "noopener,noreferrer");
  };

  const pendingAppointments = useMemo(() => {
    if (!appointments || !appointments.length) return [];
    return appointments
      .map((a) => {
        const time = a.time || "00:00";
        const dt = (() => {
          try {
            return new Date(`${a.date}T${time}`);
          } catch (e) {
            return new Date(0);
          }
        })();
        return { ...a, _dt: dt };
      })
      .filter((a) => !a.checked_in)
      .sort((x, y) => x._dt - y._dt);
  }, [appointments]);

  const upcomingAppointments = useMemo(() => {
    return pendingAppointments.slice(0, showMore ? 10 : 5);
  }, [pendingAppointments, showMore]);

  const upcomingLabel = useMemo(() => {
    if (pendingAppointments.length === 0) return "No upcoming appointment";
    const displayed = showMore ? Math.min(10, pendingAppointments.length) : Math.min(5, pendingAppointments.length);
    return `Showing next ${displayed} pending appointments`;
  }, [pendingAppointments.length, showMore]);

  const showMoreButtonText = useMemo(() => {
    if (pendingAppointments.length <= 5) return "";
    return showMore ? "Show less pending appointments" : "Show more pending appointments";
  }, [pendingAppointments.length, showMore]);

  const placeholderCount = useMemo(() => {
    if (showMore) return 0;
    return Math.max(0, 5 - upcomingAppointments.length);
  }, [showMore, upcomingAppointments.length]);

  const navigate = useNavigate();

  useEffect(() => {
    fetchAppointments();
    fetchNearestAppointment();
    fetchQueueState();
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
      <AdminNav
        title="Appointments Dashboard"
        subtitle="Manage bookings, check-ins, and visit records"
      />

      <div className="admin-content">
        <div className="admin-toolbar">
          <button type="button" onClick={() => { fetchAppointments(); fetchNearestAppointment(); }} className="btn btn-refresh">
            Refresh
          </button>
          <span className="admin-count">Total Records: {appointments.length}</span>
        </div>

        <div className="admin-dashboard-grid">
          <div className="dashboard-card queue-control-card">
            <div className="dashboard-card-header">
              <h3>Queue Control</h3>
              <span className="status-badge checked">Tickets 1–60</span>
            </div>
            <div className="queue-control-body">
              <div className="queue-control-current">
                <span>Currently Displaying</span>
                <strong>{currentQueueNumber === null ? "--" : String(currentQueueNumber).padStart(2, "0")}</strong>
              </div>
              <div className="queue-control-form">
                <label htmlFor="queue-number">Number</label>
                <input
                  id="queue-number"
                  type="text"
                  inputMode="numeric"
                  pattern="[1-9]|[1-5][0-9]|60"
                  maxLength="2"
                  value={queueInput}
                  onChange={(event) => setQueueInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") callQueueNumber();
                  }}
                  aria-label="Physical queue ticket number"
                />
                <button type="button" className="btn btn-confirm" onClick={callQueueNumber} disabled={isCallingQueue}>
                  {isCallingQueue ? "Calling..." : "Call Number"}
                </button>
              </div>
              <button type="button" className="btn btn-secondary" onClick={openQueueDisplay}>
                Open Queue Display
              </button>
            </div>
          </div>
          <div className="dashboard-card">
            <div className="dashboard-card-header">
              <h3>Next Appointments</h3>
              <span className="status-badge pending">{upcomingLabel}</span>
            </div>
            {pendingAppointments.length > 0 ? (
              <div className="dashboard-card-body">
                <ul className="next-appointments-list">
                  {upcomingAppointments.map((appt) => (
                    <li key={appt.id} onClick={() => appt.patient_id && navigate(`/admin/patients/${appt.patient_id}`)} className="next-appointment-item">
                      <div className="next-appointment-main">
                        <strong>{appt.name}</strong>
                        <span className="next-appointment-time">{appt.date} {appt.time || ""}</span>
                      </div>
                      <div className="next-appointment-meta">
                        <span>{appt.phone || "—"}</span>
                        <span className="next-appointment-proc">{appt.next_procedure || appt.procedure || "—"}</span>
                      </div>
                    </li>
                  ))}
                  {placeholderCount > 0 && Array.from({ length: placeholderCount }).map((_, index) => (
                    <li key={`placeholder-${index}`} className="next-appointment-item next-appointment-placeholder">
                      <div className="next-appointment-main">
                        <strong>Available slot</strong>
                        <span className="next-appointment-time">Waiting for appointment</span>
                      </div>
                      <div className="next-appointment-meta">
                        <span>—</span>
                        <span className="next-appointment-proc">—</span>
                      </div>
                    </li>
                  ))}
                </ul>
                {pendingAppointments.length > 5 && (
                  <button
                    type="button"
                    className="btn btn-secondary show-more-btn"
                    onClick={() => setShowMore((prev) => !prev)}
                  >
                    {showMoreButtonText}
                  </button>
                )}
                <p className="dashboard-click-tip">Click a row to view patient details</p>
              </div>
            ) : (
              <div className="dashboard-card-body">
                <p>No pending appointments are scheduled for the future.</p>
              </div>
            )}
          </div>
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
                  <th>Complaint / Reason</th>
                  <th>Next Procedure</th>
                  <th>Procedure</th>
                  <th>Payment</th>
                  <th>Debit</th>
                  <th>Credit</th>
                  <th>Status</th>
                  <th>Checked In At</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr
                    key={appt.id}
                    onClick={() => appt.patient_id && navigate(`/admin/patients/${appt.patient_id}`)}
                    style={{ cursor: appt.patient_id ? "pointer" : "default" }}
                  >
                    <td>{appt.name}</td>
                    <td>{appt.phone || "—"}</td>
                    <td>{appt.address || "—"}</td>
                    <td>{appt.age ?? "—"}</td>
                    <td>{appt.date}</td>
                    <td>{appt.time}</td>
                    <td>{appt.complaint || "—"}</td>
                    <td>{appt.next_procedure || "—"}</td>
                    <td>{appt.procedure || "—"}</td>
                    <td>{appt.payment_method || "—"}</td>
                    <td>{formatCurrency(appt.debit)}</td>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(appt.id);
                        }}
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
