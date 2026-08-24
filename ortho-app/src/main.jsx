import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
import Patients from "./Patients.jsx";
import PatientDetail from "./PatientDetail.jsx";
import ImportRecords from "./ImportRecords.jsx";
import QueueDisplay from "./QueueDisplay.jsx";
import { ToastProvider } from "./Toast.jsx";
import "./App.css";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/admin/patients" element={<Patients />} />
          <Route path="/admin/patients/:id" element={<PatientDetail />} />
          <Route path="/admin/import" element={<ImportRecords />} />
          <Route path="/queue-display" element={<QueueDisplay />} />
        </Routes>
        </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
