import { useState } from "react";

function App() {

  // STATE
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [checkName, setCheckName] = useState("");
  const [time, setTime] = useState("");
  // ✅ BOOK APPOINTMENT
  const handleSubmit = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/appointments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          date,
          time,
        }),
      });

      const data = await res.json();
      alert(data.message);

      // clear inputs
      setName("");
      setPhone("");
      setDate("");

    } catch (error) {
      console.error(error);
      alert("Error connecting to backend");
    }
  };

  // ✅ CHECK-IN
  const handleCheckIn = async () => {
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/checkin?name=${checkName}`,
        {
          method: "POST",
        }
      );

      const data = await res.json();
      alert(data.message);

      setCheckName("");

    } catch (error) {
      console.error(error);
      alert("Error connecting to backend");
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">

      {/* NAVBAR */}
      <nav className="flex justify-between items-center p-4 bg-white shadow">
        <h1 className="text-xl font-bold text-blue-600">Doc Jun</h1>
      </nav>

      {/* HERO */}
      <div className="text-center py-16 bg-blue-500 text-white">
        <h1 className="text-4xl font-bold mb-4">
          Your Smile, Our Priority
        </h1>
        <p className="mb-6">Book and check-in easily</p>
      </div>

      {/* BOOKING */}
      <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Book Appointment</h2>

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Phone"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />

        <div className="relative mb-3">
        <label className="absolute -top-2 left-2 bg-white px-1 text-sm text-gray-500">
          Appointment Date
        </label>
          <input
            type="date"
            className="w-full p-2 border rounded text-gray-700"
            value={date}
            onChange={(e) => setDate(e.target.value)}
        />
        </div>
        <input
         type="time"
         className="w-full mb-3 p-2 border rounded"
         value={time}
         onChange={(e) => setTime(e.target.value)}
        />

        <button
          onClick={handleSubmit}
          className="w-full bg-green-500 text-white py-2 rounded"
        >
          Confirm
        </button>
        
      </div>

      {/* CHECK-IN */}
      <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded shadow text-center">
        <h2 className="text-xl font-bold mb-4">Check-In</h2>

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Enter Name"
          value={checkName}
          onChange={(e) => setCheckName(e.target.value)}
        />

        <button
          onClick={handleCheckIn}
          className="w-full bg-blue-500 text-white py-2 rounded"
        >
          Check-In
        </button>
      </div>

    </div>
  );
}

export default App;