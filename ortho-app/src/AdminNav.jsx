import { Link, useLocation } from "react-router-dom";

const links = [
  { to: "/admin", label: "Appointments" },
  { to: "/admin/patients", label: "Patients" },
  { to: "/admin/import", label: "Import Records" },
];

export default function AdminNav({ title, subtitle }) {
  const location = useLocation();

  return (
    <>
      <nav className="admin-nav">
        <h1>Doc Jun - Admin</h1>
        <Link to="/" className="btn btn-back">
          Back to Booking
        </Link>
      </nav>

      <div className="admin-header">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>

      <div className="admin-tabs">
        {links.map((link) => {
          const isActive =
            link.to === "/admin"
              ? location.pathname === "/admin"
              : location.pathname === link.to || location.pathname.startsWith(`${link.to}/`);
          return (
          <Link
            key={link.to}
            to={link.to}
            className={`admin-tab ${isActive ? "active" : ""}`}
          >
            {link.label}
          </Link>
          );
        })}
      </div>
    </>
  );
}
