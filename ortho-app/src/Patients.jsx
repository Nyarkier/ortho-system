import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { API_BASE } from "./api.js";
import { useToast } from "./Toast.jsx";
import AdminNav from "./AdminNav.jsx";

function formatCurrency(value) {
  if (value === null || value === undefined || value === "") return "—";
  return `₱${Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function Patients() {
  const { showToast } = useToast();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const initialLoadRef = useRef(false);
  const lastRequestRef = useRef("");

  const fetchPatients = useCallback(
    async (query = "", options = {}) => {
      const { force = false } = options;
      const trimmedQuery = query.trim();
      const url = trimmedQuery
        ? `${API_BASE}/patients?search=${encodeURIComponent(trimmedQuery)}`
        : `${API_BASE}/patients`;

      if (!force && lastRequestRef.current === url) {
        return;
      }

      lastRequestRef.current = url;

      try {
        setLoading(true);
        const res = await fetch(url);
        if (!res.ok) throw new Error("Failed to load patients");
        setPatients(await res.json());
      } catch (error) {
        console.error(error);
        showToast("Error fetching patients", "error");
      } finally {
        setLoading(false);
      }
    },
    [showToast]
  );

  useEffect(() => {
    if (!initialLoadRef.current) {
      initialLoadRef.current = true;
      fetchPatients("", { force: true });
      return;
    }

    const timer = setTimeout(() => {
      fetchPatients(searchTerm);
    }, 300);

    return () => clearTimeout(timer);
  }, [fetchPatients, searchTerm]);

  return (
    <div className="admin-page">
      <AdminNav
        title="Patient Records"
        subtitle="View patient profiles, visit history, and running balances"
      />

      <div className="admin-content">
        <div className="admin-search">
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search patients by name or phone..."
            className="admin-search-input"
            aria-label="Search patients by name or phone"
          />
        </div>

        <div className="admin-toolbar">
          <button type="button" onClick={() => fetchPatients(searchTerm, { force: true })} className="btn btn-refresh">
            Refresh
          </button>
          <span className="admin-count">Total Patients: {patients.length}</span>
        </div>

        {loading ? (
          <div className="admin-empty">Loading...</div>
        ) : patients.length === 0 ? (
          <div className="admin-empty">
            {searchTerm.trim() ? "No patients found." : "No patients yet. Book appointments or import paper records to get started."}
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone</th>
                  <th>Address</th>
                  <th>Age</th>
                  <th>Occupation</th>
                  <th>Status</th>
                  <th>Balance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((patient) => (
                  <tr key={patient.id}>
                    <td>{patient.name}</td>
                    <td>{patient.phone}</td>
                    <td>{patient.address || "—"}</td>
                    <td>{patient.age ?? "—"}</td>
                    <td>{patient.occupation || "—"}</td>
                    <td>{patient.status || "—"}</td>
                    <td>{formatCurrency(patient.balance)}</td>
                    <td>
                      <Link to={`/admin/patients/${patient.id}`} className="btn btn-view">
                        View Ledger
                      </Link>
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

export default Patients;
