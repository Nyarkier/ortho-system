import { useState } from "react";

function Home() {

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  const [checkName, setCheckName] = useState("");
  const [checkDate, setCheckDate] = useState("");
  const [checkTime, setCheckTime] = useState("");

  const handleSubmit = async () => {
    if (!name || !phone || !date || !time) {
      alert("Please fill all fields");
      return;
    }

    const res = await fetch("/appointments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name, phone, date, time }),
    });

    const data = await res.json();

    if (data.status === "error") {
      alert("❌ " + data.message);
    } else {
      alert("✅ " + data.message);
      setName(""); setPhone(""); setDate(""); setTime("");
    }
  };

  const handleCheckIn = async () => {
    if (!checkName || !checkDate || !checkTime) {
      alert("Fill all check-in fields");
      return;
    }

    const res = await fetch(
      `/checkin?name=${checkName}&date=${checkDate}&time=${checkTime}`,
      { method: "POST" }
    );

    const data = await res.json();

    if (data.status === "error") {
      alert("❌ " + data.message);
    } else {
      alert("✅ " + data.message);
      setCheckName(""); setCheckDate(""); setCheckTime("");
    }
  };

  return (
    
    <div className="min-h-screen bg-blue-100">
        
      {/* NAVBAR */}
      <nav className="flex justify-between items-center px-8 py-4 bg-white shadow-md">
        <h1 className="text-2xl font-bold text-blue-600">Doc Jun Clinic</h1>
      </nav>

      {/* HERO */}
      <div className="text-center py-20">
        <h1 className="text-5xl font-bold text-blue-700 mb-4">
          Your Smile, Our Priority
        </h1>
        <p className="text-lg text-gray-600">
          Fast, easy, and stress-free dental appointments
        </p>
      </div>

      {/* MAIN GRID */}
      <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto px-4 pb-16">

        {/* BOOKING CARD */}
        <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">

          <h2 className="text-2xl font-bold text-blue-600 mb-6">
            Book Appointment
          </h2>

          <input className="w-full mb-3 p-3 border rounded-lg focus:outline-blue-400"
            placeholder="Full Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input className="w-full mb-3 p-3 border rounded-lg focus:outline-blue-400"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />

          <input type="date"
            className="w-full mb-3 p-3 border rounded-lg focus:outline-blue-400"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />

          <input type="time"
            className="w-full mb-5 p-3 border rounded-lg focus:outline-blue-400"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />

          <button
            onClick={handleSubmit}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold transition"
          >
            Confirm Appointment
          </button>
        </div>

        {/* CHECK-IN CARD */}
        <div className="bg-white rounded-2xl shadow-xl p-8 hover:shadow-2xl transition">

          <h2 className="text-2xl font-bold text-blue-600 mb-6">
            Patient Check-In
          </h2>

          <input className="w-full mb-3 p-3 border rounded-lg focus:outline-blue-400"
            placeholder="Full Name"
            value={checkName}
            onChange={(e) => setCheckName(e.target.value)}
          />

          <input type="date"
            className="w-full mb-3 p-3 border rounded-lg focus:outline-blue-400"
            value={checkDate}
            onChange={(e) => setCheckDate(e.target.value)}
          />

          <input type="time"
            className="w-full mb-5 p-3 border rounded-lg focus:outline-blue-400"
            value={checkTime}
            onChange={(e) => setCheckTime(e.target.value)}
          />

          <button
            onClick={handleCheckIn}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-3 rounded-lg font-semibold transition"
          >
            Check In
          </button>
        </div>

      </div>

    </div>
  );
}

export default Home;