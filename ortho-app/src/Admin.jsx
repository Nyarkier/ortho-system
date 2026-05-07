import { useEffect, useState } from "react";

function Admin() {

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const res = await fetch("http://127.0.0.1:8000/appointments");
      const data = await res.json();
      setAppointments(data);
    } catch (error) {
      console.error(error);
      alert("❌ Error fetching appointments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, []);

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this appointment?")) {
      try {
        const res = await fetch(`http://127.0.0.1:8000/appointments/${id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (data.status === "success") {
          alert("✅ Appointment deleted");
          fetchAppointments();
        } else {
          alert("❌ " + data.message);
        }
      } catch (error) {
        console.error(error);
        alert("❌ Error deleting appointment");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100">

      {/* NAVBAR */}
      <nav className="flex justify-between items-center p-4 bg-white shadow">
        <h1 className="text-2xl font-bold text-blue-600">Doc Jun - Admin</h1>
        <a href="/" className="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">
          Back to Booking
        </a>
      </nav>

      {/* HEADER */}
      <div className="bg-blue-600 text-white p-6">
        <h2 className="text-3xl font-bold">Appointments Dashboard</h2>
        <p className="mt-2">Manage all patient appointments</p>
      </div>

      {/* CONTENT */}
      <div className="max-w-6xl mx-auto p-6">

        {/* REFRESH BUTTON */}
        <div className="mb-6 flex gap-4">
          <button
            onClick={fetchAppointments}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            🔄 Refresh
          </button>
          <div className="text-gray-700 font-semibold">
            Total Appointments: {appointments.length}
          </div>
        </div>

        {/* TABLE */}
        {loading ? (
          <div className="text-center py-10 text-gray-600">Loading...</div>
        ) : appointments.length === 0 ? (
          <div className="bg-white p-8 rounded-lg shadow text-center text-gray-600">
            No appointments yet
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-200 border-b">
                <tr>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Phone</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Date</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Time</th>
                  <th className="px-6 py-3 text-left font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-center font-semibold text-gray-700">Action</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt, index) => (
                  <tr key={appt.id || index} className="border-b hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-800">{appt.name}</td>
                    <td className="px-6 py-4 text-gray-800">{appt.phone}</td>
                    <td className="px-6 py-4 text-gray-800">{appt.date}</td>
                    <td className="px-6 py-4 text-gray-800">{appt.time}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-semibold ${
                        appt.checked_in 
                          ? "bg-green-200 text-green-800" 
                          : "bg-yellow-200 text-yellow-800"
                      }`}>
                        {appt.checked_in ? "✅ Checked-In" : "⏳ Pending"}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => handleDelete(appt.id)}
                        className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                      >
                        Delete
                      </button>
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

export default Admin;

export default Admin;