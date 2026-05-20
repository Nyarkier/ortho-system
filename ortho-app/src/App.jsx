// App.jsx
import React, { useEffect, useState } from 'react';
import './App.css'; 

function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [checkName, setCheckName] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [checkTime, setCheckTime] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const API_BASE = "http://127.0.0.1:8000";
  const UPCOMING_THRESHOLD_MINUTES = 60;

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
        alert(`Reminder: appointment for ${soon.name} is in ${Math.round((new Date(`${soon.date}T${soon.time}`) - now) / 1000 / 60)} minutes.`);
      }
    } catch (error) {
      console.error("Upcoming appointment check failed", error);
    }
  };

  useEffect(() => {
    checkUpcomingAppointments();
    const interval = setInterval(checkUpcomingAppointments, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!name || !phone || !date || !time) {
      alert("Please fill all fields");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/appointments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, date, time }),
      });
      const data = await res.json();
      if (data.status === "error") {
        alert("❌ " + data.message);
      } else {
        alert("✅ " + data.message);
        setName(""); setPhone(""); setDate(""); setTime("");
      }
    } catch (error) {
      alert("❌ Unable to reach backend. Start the server on http://127.0.0.1:8000.");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!checkName || !checkDate || !checkTime) {
      alert("Fill all check-in fields");
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/checkin?name=${encodeURIComponent(checkName)}&date=${encodeURIComponent(checkDate)}&time=${encodeURIComponent(checkTime)}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.status === "error") {
        alert("❌ " + data.message);
      } else {
        alert("✅ " + data.message);
        setCheckName(""); setCheckDate(""); setCheckTime("");
      }
    } catch (error) {
      alert("❌ Unable to reach backend. Start the server on http://127.0.0.1:8000.");
      console.error(error);
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(`${API_BASE}/export`, { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        alert("✅ Export complete: appointments.xlsx created.");
      } else {
        alert("❌ " + (data.message || "Export failed"));
      }
    } catch (error) {
      alert("❌ Unable to reach backend. Start the server on http://127.0.0.1:8000.");
      console.error(error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="app">
      {/* Brand Bar */}
      <div className="brand-bar">
        <h2>Dr. Jun Villaflores, DMD</h2>
        <button
          type="button"
          className={`btn btn-extract ${isExporting ? 'btn-loading' : ''}`}
          onClick={handleExport}
          disabled={isExporting}
        >
          {isExporting ? 'Extracting...' : 'Extract'}
        </button>
      </div>

      {/* Hero Section */}
      <div className="hero">
        <h1>Your Smile, Our Priority</h1>
        <p>Book and check-in easily</p>
      </div>

      {/* Forms Container */}
      <div className="container">
        
        {/* CARD 1: Book Appointment */}
        <div className="card">
          <h3>Book Appointment</h3>
          <form>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <label>Name</label>
            </div>
            
            <div className="input-group">
              <input
                type="tel"
                placeholder=" "
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
              />
              <label>Phone</label>
            </div>

            <div className="input-group">
              <input
                type="date"
                placeholder=" "
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
              <label>Appointment Date</label>
            </div>

            <div className="input-group">
              <input
                type="time"
                placeholder=" "
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
              />
              <label>Appointment Time</label>
            </div>

            {/* MODIFIED BUTTON FOR SPINNER */}
            <button 
              type="button" 
              className={`btn btn-confirm ${isLoading ? 'btn-loading' : ''}`}
              onClick={handleSubmit}
            >
              {isLoading ? 'Processing...' : 'Confirm'}
            </button>
          </form>
        </div>

        {/* CARD 2: Check-In */}
        <div className="card">
          <h3 style={{textAlign: 'center'}}>Check-In</h3>
          <form>
            <div className="input-group">
              <input
                type="text"
                placeholder=" "
                value={checkName}
                onChange={(e) => setCheckName(e.target.value)}
                required
              />
              <label>Name</label>
            </div>

            <div className="input-group">
              <input
                type="date"
                placeholder=" "
                value={checkDate}
                onChange={(e) => setCheckDate(e.target.value)}
                required
              />
              <label>Date</label>
            </div>

            <div className="input-group">
              <input
                type="time"
                placeholder=" "
                value={checkTime}
                onChange={(e) => setCheckTime(e.target.value)}
                required
              />
              <label>Time</label>
            </div>

            {/* ADDED SPINNER HERE TOO IF YOU WANT */}
            <button type="button" className="btn btn-checkin" onClick={handleCheckIn}>Check-In</button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default App;