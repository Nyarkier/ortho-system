import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import Admin from "./Admin.jsx";
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
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
