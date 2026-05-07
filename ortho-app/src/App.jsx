// App.jsx
import React, { useState } from 'react'; // Added useState
import './App.css'; 

function App() {
  // ADD THIS LINE for the spinner
  const [isLoading, setIsLoading] = useState(false);

  return (
    <div className="app">
      {/* Brand Bar */}
      <div className="brand-bar">
        <h2>Dr. Jun Villaflores, DMD</h2>
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
              <input type="text" placeholder=" " required />
              <label>Name</label>
            </div>
            
            <div className="input-group">
              <input type="tel" placeholder=" " required />
              <label>Phone</label>
            </div>

            <div className="input-group">
              <input type="date" placeholder=" " required />
              <label>Appointment Date</label>
            </div>

            <div className="input-group">
              <input type="time" placeholder=" " required />
              <label>Appointment Time</label>
            </div>

            {/* MODIFIED BUTTON FOR SPINNER */}
            <button 
              type="button" 
              className={`btn btn-confirm ${isLoading ? 'btn-loading' : ''}`}
              onClick={() => setIsLoading(true)}
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
              <input type="text" placeholder=" " required />
              <label>Name</label>
            </div>

            <div className="input-group">
              <input type="date" placeholder=" " required />
              <label>Date</label>
            </div>

            <div className="input-group">
              <input type="time" placeholder=" " required />
              <label>Time</label>
            </div>

            {/* ADDED SPINNER HERE TOO IF YOU WANT */}
            <button type="button" className="btn btn-checkin">Check-In</button>
          </form>
        </div>

      </div>
    </div>
  );
}

export default App;