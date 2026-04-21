function App() {
  return (
    <div className="min-h-screen bg-gray-100">

      {/* NAVBAR */}
      <nav className="flex justify-between items-center p-4 bg-white shadow">
        <h1 className="text-xl font-bold text-blue-600">Smile Ortho</h1>
        <button className="bg-green-500 text-white px-4 py-2 rounded">
          Book Now
        </button>
      </nav>

      {/* HERO */}
      <div className="text-center py-16 bg-blue-500 text-white">
        <h1 className="text-4xl font-bold mb-4">
          Your Smile, Our Priority
        </h1>
        <p className="mb-6">Book and check-in easily</p>

        <div className="flex justify-center gap-4">
          <button className="bg-green-500 px-6 py-3 rounded">
            Book Appointment
          </button>
          <button className="bg-white text-blue-500 px-6 py-3 rounded">
            Check-In
          </button>
        </div>
      </div>

      {/* BOOKING */}
      <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded shadow">
        <h2 className="text-xl font-bold mb-4">Book Appointment</h2>

        <input className="w-full mb-3 p-2 border rounded" placeholder="Name" />
        <input className="w-full mb-3 p-2 border rounded" placeholder="Phone" />
        <input type="date" className="w-full mb-3 p-2 border rounded" />

        <button className="w-full bg-green-500 text-white py-2 rounded">
          Confirm
        </button>
      </div>

      {/* CHECK-IN */}
      <div className="max-w-xl mx-auto mt-10 bg-white p-6 rounded shadow text-center">
        <h2 className="text-xl font-bold mb-4">Check-In</h2>

        <input
          className="w-full mb-3 p-2 border rounded"
          placeholder="Enter Name"
        />

        <button className="w-full bg-blue-500 text-white py-2 rounded">
          Check-In
        </button>
      </div>

    </div>
  );
}

export default App;