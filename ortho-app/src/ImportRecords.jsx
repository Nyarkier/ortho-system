import { useState } from "react";
import { API_BASE } from "./api.js";
import { useToast } from "./Toast.jsx";
import AdminNav from "./AdminNav.jsx";

function ImportRecords() {
  const { showToast } = useToast();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const handlePreview = async () => {
    if (!file) {
      showToast("Choose an Excel or CSV file first", "warning");
      return;
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${API_BASE}/import/preview`, {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (data.status === "error") {
        showToast(data.message, "error");
        return;
      }
      // Backend returns grouped preview; flatten into preview.rows for UI
      const rows = (data.groups || []).flatMap((g) => g.rows || []);
      setPreview({ ...data, rows });
      showToast("Preview ready. Review rows before importing.", "info");
    } catch (error) {
      console.error(error);
      showToast("Could not preview import file", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    let currentPreview = preview;
    if (!currentPreview?.rows?.length) {
      if (!file) {
        showToast("Choose an Excel or CSV file first", "warning");
        return;
      }

      // Auto-run preview if user hasn't previewed yet
      setLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/import/preview`, {
          method: "POST",
          body: formData,
        });
        const data = await res.json();
        if (data.status === "error") {
          showToast(data.message, "error");
          return;
        }
        const rows = (data.groups || []).flatMap((g) => g.rows || []);
        currentPreview = { ...data, rows };
        setPreview(currentPreview);
        showToast("Preview ready. Importing all rows...", "info");
      } catch (error) {
        console.error(error);
        showToast("Could not preview import file", "error");
        return;
      } finally {
        setLoading(false);
      }
    }

    const importable = (currentPreview?.rows || []);
    if (!importable.length) {
      showToast("No valid rows to import", "error");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch(`${API_BASE}/import/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: importable.map((row) => ({ data: row.data })),
        }),
      });
      const data = await res.json();
      if (data.status === "error") {
        showToast(data.message, "error");
        return;
      }
      showToast(data.message, "success");
      setPreview(null);
      setFile(null);
    } catch (error) {
      console.error(error);
      showToast("Import failed", "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="admin-page">
      <AdminNav
        title="Import Paper Records"
        subtitle="Upload Excel or CSV files to migrate patient cards and visit history"
      />

      <div className="admin-content">
        <div className="card import-card">
          <h3>1. Download template</h3>
          <p className="card-subtitle">
            Use one row per visit. Repeat patient details on each row from the paper card.
          </p>
          <a
            href={`${API_BASE}/import/template`}
            className="btn btn-refresh"
            download="import-template.xlsx"
          >
            Download Excel Template
          </a>
        </div>

        <div className="card import-card">
          <h3>2. Upload filled file</h3>
          <div className="import-upload">
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setPreview(null);
              }}
            />
            <button
              type="button"
              className={`btn btn-checkin ${loading ? "btn-loading" : ""}`}
              onClick={handlePreview}
              disabled={loading || !file}
            >
              {loading ? "Previewing..." : "Preview Import"}
            </button>
          </div>
        </div>

        {preview && (
          <div className="card import-card">
            <h3>3. Review and import</h3>
            <div className="import-summary">
                  <span>Total rows: {preview?.summary?.total ?? 0}</span>
                  <span className="summary-ok">Valid: {preview?.summary?.valid ?? 0}</span>
                  <span className="summary-warn">Warnings: {preview?.summary?.warnings ?? 0}</span>
                  <span className="summary-error">Errors: {preview?.summary?.errors ?? 0}</span>
                </div>

            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Status</th>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Visit Date</th>
                    <th>Description</th>
                    <th>Debit</th>
                    <th>Credit</th>
                    <th>Issues</th>
                  </tr>
                </thead>
                <tbody>
                  {(preview?.rows || []).map((row) => (
                    <tr key={row.row_number} className={`import-row-${row.status}`}>
                      <td>{row.row_number}</td>
                      <td>
                        <span className={`status-badge ${row.status === "ok" ? "checked" : row.status === "warning" ? "pending" : "error"}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>{row.data.name || "—"}</td>
                      <td>{row.data.phone || "—"}</td>
                      <td>{row.data.visit_date || "—"}</td>
                      <td>{row.data.description || "—"}</td>
                      <td>{row.data.debit || "—"}</td>
                      <td>{row.data.credit_amount || "—"}</td>
                      <td>
                        {row.issues?.length
                          ? row.issues.map((issue) => issue.message).join("; ")
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button
              type="button"
              className={`btn btn-confirm ${importing ? "btn-loading" : ""}`}
              onClick={handleImport}
              disabled={importing || (preview?.summary?.errors ?? 0) === (preview?.summary?.total ?? 0)}
            >
              {importing ? "Importing..." : "Import Valid Rows"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ImportRecords;
