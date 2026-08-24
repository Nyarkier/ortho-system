import { useEffect, useRef, useState } from "react";
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
  const [editVisit, setEditVisit] = useState(null);
  const [isSavingVisit, setIsSavingVisit] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [adjustAmount, setAdjustAmount] = useState("");
  const [isAdjustingBalance, setIsAdjustingBalance] = useState(false);
  const [adjustmentError, setAdjustmentError] = useState("");
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoVersion, setPhotoVersion] = useState(0);
  const photoInputRef = useRef(null);
  const [mouthPhotosOpen, setMouthPhotosOpen] = useState(false);
  const [mouthPhotos, setMouthPhotos] = useState([]);
  const [isLoadingMouthPhotos, setIsLoadingMouthPhotos] = useState(false);
  const [uploadingMouthPhoto, setUploadingMouthPhoto] = useState("");
  const mouthPhotoInputRefs = useRef({});

  const visitDueAmount = (visit) =>
    Math.max(0, Number(visit.debit || 0) - Number(visit.credit_amount || 0));

  const calculateVisitBalance = (visit) => {
    if (!patient?.visits) return visit.balance;
    // Calculate the total due from all visits
    const totalDue = patient.visits.reduce((sum, v) => sum + visitDueAmount(v), 0);
    // Calculate how much has been paid via balance adjustment
    const totalAdjustment = totalDue - (patient.balance || 0);
    // Show this visit's balance minus its share of the adjustment
    return Math.max(0, (visit.balance || 0) - totalAdjustment);
  };

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

  const startEditVisit = (visit) => {
    setEditVisit({
      ...visit,
      complaint: visit.complaint || "",
      next_procedure: visit.next_procedure || "",
      description: visit.description || "",
      debit: visit.debit ?? 0,
      credit_amount: visit.credit_amount ?? 0,
      payment_method: visit.payment_method || "",
      visit_date: visit.visit_date || "",
      visit_time: visit.visit_time || "",
    });
    setSaveError("");
  };

  const updateEditVisit = (field, value) => {
    setEditVisit((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveVisit = async () => {
    if (!editVisit) return;
    setIsSavingVisit(true);
    setSaveError("");

    try {
      const res = await fetch(`${API_BASE}/visits/${editVisit.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visit_date: editVisit.visit_date,
          visit_time: editVisit.visit_time,
          description: editVisit.description,
          complaint: editVisit.complaint,
          next_procedure: editVisit.next_procedure,
          debit: Number(editVisit.debit),
          credit_amount: Number(editVisit.credit_amount),
          payment_method: editVisit.payment_method || null,
        }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setSaveError(data.message || "Unable to save visit.");
      } else {
        showToast("Visit updated", "success");
        setEditVisit(null);
        await fetchPatient();
      }
    } catch (error) {
      setSaveError("Unable to save visit. Please try again.");
      console.error(error);
    } finally {
      setIsSavingVisit(false);
    }
  };

  const handleAdjustBalance = async () => {
    if (!adjustAmount || Number(adjustAmount) <= 0) {
      setAdjustmentError("Enter an amount greater than zero.");
      return;
    }

    setIsAdjustingBalance(true);
    setAdjustmentError("");
    try {
      const res = await fetch(`${API_BASE}/patients/${id}/adjust-balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(adjustAmount) }),
      });
      const data = await res.json();
      if (data.status === "error") {
        setAdjustmentError(data.message || "Unable to update balance.");
      } else {
        showToast("Balance reduced", "success");
        setAdjustAmount("");
        await fetchPatient();
      }
    } catch (error) {
      setAdjustmentError("Unable to update balance.");
      console.error(error);
    } finally {
      setIsAdjustingBalance(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/patients/${id}/photo`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Unable to upload photo.");
      setPhotoVersion(Date.now());
      await fetchPatient();
      showToast("Patient photo uploaded", "success");
    } catch (error) {
      showToast(error.message || "Unable to upload photo.", "error");
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  const loadMouthPhotos = async () => {
    setIsLoadingMouthPhotos(true);
    try {
      const res = await fetch(`${API_BASE}/patients/${id}/mouth-photos`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Unable to load mouth photos.");
      setMouthPhotos(data.photos || []);
    } catch (error) {
      showToast(error.message || "Unable to load mouth photos.", "error");
    } finally {
      setIsLoadingMouthPhotos(false);
    }
  };

  const toggleMouthPhotos = () => {
    setMouthPhotosOpen((isOpen) => {
      if (!isOpen && mouthPhotos.length === 0) loadMouthPhotos();
      return !isOpen;
    });
  };

  const handleMouthPhotoUpload = async (photoType, event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploadingMouthPhoto(photoType);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const existing = mouthPhotos.find((photo) => photo.photo_type === photoType)?.photo_url;
      const method = existing ? "PUT" : "POST";
      const res = await fetch(`${API_BASE}/patients/${id}/mouth-photos/${photoType}`, {
        method,
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Unable to save mouth photo.");
      await loadMouthPhotos();
      setPhotoVersion(Date.now());
      showToast("Mouth photo saved", "success");
    } catch (error) {
      showToast(error.message || "Unable to save mouth photo.", "error");
    } finally {
      setUploadingMouthPhoto("");
    }
  };

  const handleMouthPhotoRemove = async (photoType) => {
    const confirmed = await confirm({
      title: "Remove mouth photo?",
      message: "This will permanently remove this clinical photo.",
      confirmLabel: "Remove",
    });
    if (!confirmed) return;

    setUploadingMouthPhoto(photoType);
    try {
      const res = await fetch(`${API_BASE}/patients/${id}/mouth-photos/${photoType}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Unable to remove mouth photo.");
      await loadMouthPhotos();
      showToast("Mouth photo removed", "success");
    } catch (error) {
      showToast(error.message || "Unable to remove mouth photo.", "error");
    } finally {
      setUploadingMouthPhoto("");
    }
  };

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

        <div className="card balance-adjust-card">
          <h3>Reduce outstanding balance</h3>
          <div className="input-row">
            <div className="input-group">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder=" "
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
              />
              <label>Amount paid / reduced</label>
            </div>
            <button
              type="button"
              className="btn btn-confirm"
              onClick={handleAdjustBalance}
              disabled={isAdjustingBalance}
            >
              {isAdjustingBalance ? "Saving..." : "Apply payment"}
            </button>
          </div>
          {adjustmentError && <p className="error-message">{adjustmentError}</p>}
        </div>

        <div className="patient-profile card">
          <div className="patient-profile-header">
            <div className="patient-avatar-wrap">
              {patient.photo_path ? (
                <img
                  className="patient-avatar"
                  src={`${API_BASE}/patients/${id}/photo?v=${photoVersion}`}
                  alt={`${patient.name} profile`}
                />
              ) : (
                <div className="patient-avatar patient-avatar-placeholder" aria-label="No profile photo">
                  {patient.name.slice(0, 1).toUpperCase()}
                </div>
              )}
              <div>
                <h2>{patient.name}</h2>
                <p>Patient ID #{patient.id}</p>
              </div>
            </div>
            <div>
              <input
                ref={photoInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
                onChange={handlePhotoUpload}
                hidden
              />
              <button
                type="button"
                className="btn btn-upload-photo"
                onClick={() => photoInputRef.current?.click()}
                disabled={isUploadingPhoto}
              >
                {isUploadingPhoto ? "Uploading..." : patient.photo_path ? "Replace Photo" : "Upload Photo"}
              </button>
            </div>
          </div>
          <div className="profile-grid">
            <div><span>Phone</span><strong>{patient.phone}</strong></div>
            <div><span>Address</span><strong>{patient.address || "—"}</strong></div>
            <div><span>Age</span><strong>{patient.age ?? "—"}</strong></div>
            <div><span>Occupation</span><strong>{patient.occupation || "—"}</strong></div>
            <div><span>Status</span><strong>{patient.status || "—"}</strong></div>
            <div><span>Complaint</span><strong>{patient.complaint || "—"}</strong></div>
          </div>
        </div>

        <div className="mouth-photos-section">
          <button type="button" className="btn btn-mouth-toggle" onClick={toggleMouthPhotos}>
            {mouthPhotosOpen ? "Hide Mouth Photos" : "Show Mouth Photos"}
          </button>
          {mouthPhotosOpen && (
            <div className="card mouth-photos-card">
              <div className="mouth-photos-header">
                <div>
                  <h3>Mouth / Teeth Photos</h3>
                  <p className="card-subtitle">Clinical photos are stored separately from the profile photo.</p>
                </div>
                {isLoadingMouthPhotos && <span className="mouth-photos-loading">Loading...</span>}
              </div>
              <div className="mouth-photo-grid">
                {mouthPhotos.map((photo) => {
                  const hasPhoto = Boolean(photo.photo_url);
                  const isBusy = uploadingMouthPhoto === photo.photo_type;
                  return (
                    <div className="mouth-photo-slot" key={photo.photo_type}>
                      <h4>{photo.label}</h4>
                      <div className="mouth-photo-preview">
                        {hasPhoto ? (
                          <img
                            src={`${API_BASE}${photo.photo_url}?v=${photoVersion}`}
                            alt={`${photo.label} clinical view`}
                          />
                        ) : (
                          <span>No photo</span>
                        )}
                      </div>
                      <input
                        ref={(element) => {
                          mouthPhotoInputRefs.current[photo.photo_type] = element;
                        }}
                        type="file"
                        accept=".jpg,.jpeg,.png,.heic,.heif,.webp,image/jpeg,image/png,image/heic,image/heif,image/webp"
                        onChange={(event) => handleMouthPhotoUpload(photo.photo_type, event)}
                        hidden
                      />
                      <div className="mouth-photo-actions">
                        <button
                          type="button"
                          className="btn btn-small btn-upload-photo"
                          onClick={() => mouthPhotoInputRefs.current[photo.photo_type]?.click()}
                          disabled={isBusy}
                        >
                          {isBusy ? "Saving..." : hasPhoto ? "Replace" : "Upload"}
                        </button>
                        {hasPhoto && (
                          <button
                            type="button"
                            className="btn btn-small btn-delete"
                            onClick={() => handleMouthPhotoRemove(photo.photo_type)}
                            disabled={isBusy}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button type="button" className="btn btn-secondary btn-mouth-toggle" onClick={toggleMouthPhotos}>
                Hide Mouth Photos
              </button>
            </div>
          )}
        </div>

        {patient.pending_appointments?.length > 0 && (
          <div className="card pending-card">
            <h3>Pending Appointments</h3>
            <ul className="pending-list">
              {patient.pending_appointments.map((appt) => (
                <li key={appt.id}>
                  {appt.visit_date} at {appt.visit_time || "—"} · Complaint: {appt.complaint || "—"} · Next: {appt.next_procedure || "—"}
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
                <th>Complaint / Reason</th>
                <th>Next Procedure</th>
                <th>Description</th>
                <th>Time</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Credit Date</th>
                <th>Payment</th>
                <th>Balance</th>
                <th>Due</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {patient.visits?.length ? (
                patient.visits.map((visit) => (
                  <tr key={visit.id}>
                    <td>{visit.visit_date}</td>
                    <td>{visit.visit_no ?? "—"}</td>
                    <td>{visit.complaint || "—"}</td>
                    <td>{visit.next_procedure || "—"}</td>
                    <td>{visit.description || "—"}</td>
                    <td>{visit.visit_time || "—"}</td>
                    <td>{formatCurrency(visit.debit)}</td>
                    <td>{formatCurrency(visit.credit_amount)}</td>
                    <td>{visit.credit_date || "—"}</td>
                    <td>{visit.payment_method || "—"}</td>
                    <td>{formatCurrency(calculateVisitBalance(visit))}</td>
                    <td>{visitDueAmount(visit) > 0 ? formatCurrency(visitDueAmount(visit)) : "—"}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-small btn-edit"
                        onClick={() => startEditVisit(visit)}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="13" className="admin-empty-cell">
                    No completed visits yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {patient?.balance > 0 && (
          <div className="card debt-breakdown">
            <h3>Outstanding balance breakdown</h3>
            <p>Total owed: {formatCurrency(patient.balance)}</p>
            <p>
              {patient.visits?.filter((visit) => visitDueAmount(visit) > 0).length || 0} visit(s) with remaining balance
            </p>
            <ul>
              {patient.visits
                ?.filter((visit) => visitDueAmount(visit) > 0)
                .map((visit) => (
                  <li key={visit.id}>
                    {visit.visit_date} {visit.description || "Visit"}: due {formatCurrency(visitDueAmount(visit))}
                  </li>
                ))}
            </ul>
          </div>
        )}

        {editVisit && (
          <div className="card edit-visit-card">
            <h3>Edit visit</h3>
            <div className="input-row">
              <div className="input-group">
                <input
                  type="date"
                  value={editVisit.visit_date}
                  onChange={(e) => updateEditVisit("visit_date", e.target.value)}
                />
                <label>Date</label>
              </div>
              <div className="input-group">
                <input
                  type="time"
                  value={editVisit.visit_time}
                  onChange={(e) => updateEditVisit("visit_time", e.target.value)}
                />
                <label>Time</label>
              </div>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={editVisit.complaint}
                onChange={(e) => updateEditVisit("complaint", e.target.value)}
              />
              <label>Complaint / Reason for Visit</label>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={editVisit.next_procedure}
                onChange={(e) => updateEditVisit("next_procedure", e.target.value)}
              />
              <label>Next Procedure</label>
            </div>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={editVisit.description}
                onChange={(e) => updateEditVisit("description", e.target.value)}
              />
              <label>Description</label>
            </div>
            <div className="input-row">
              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder=" "
                  value={editVisit.debit}
                  onChange={(e) => updateEditVisit("debit", e.target.value)}
                />
                <label>Total Charge</label>
              </div>
              <div className="input-group">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder=" "
                  value={editVisit.credit_amount}
                  onChange={(e) => updateEditVisit("credit_amount", e.target.value)}
                />
                <label>Amount Paid</label>
              </div>
            </div>
            <div className="input-group">
              <select
                value={editVisit.payment_method}
                onChange={(e) => updateEditVisit("payment_method", e.target.value)}
              >
                <option value="" hidden />
                <option value="Cash">Cash</option>
                <option value="GCash">GCash</option>
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Installment">Installment</option>
                <option value="Other">Other</option>
              </select>
              <label>Payment Method</label>
            </div>
            <div className="installment-summary">
              <p>
                Remaining due: {formatCurrency(Math.max(0, Number(editVisit.debit || 0) - Number(editVisit.credit_amount || 0)))}
              </p>
            </div>
            {saveError && <p className="error-message">{saveError}</p>}
            <div className="edit-visit-actions">
              <button
                type="button"
                className="btn btn-confirm"
                onClick={handleSaveVisit}
                disabled={isSavingVisit}
              >
                {isSavingVisit ? "Saving..." : "Save changes"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditVisit(null)}
                disabled={isSavingVisit}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default PatientDetail;
