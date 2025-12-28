import { Routes, Route, Navigate } from "react-router-dom";

// Home page
import Home from "./pages/Home";

// Auth pages
import Login from "./auth/Login";
import Register from "./auth/Register";
import RoleRedirect from "./auth/RoleRedirect";

// Dashboards
import DashboardUser from "./pages/DashboardUser";
import ManagerDashboard from "./pages/ManagerDashboard";
import AdminDashboard from "./pages/AdminDashboard";

function App() {
  return (
    <Routes>
      {/* ===== HOME PAGE ===== */}
      <Route path="/" element={<Home />} />

      {/* ===== PUBLIC ROUTES ===== */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />

      {/* ===== ENTRY POINT (ROLE DECIDER) ===== */}
      <Route path="/dashboard" element={<RoleRedirect />} />

      {/* ===== DASHBOARDS (DIRECT RENDER) ===== */}
      <Route path="/dashboard/user" element={<DashboardUser />} />
      <Route path="/dashboard/manager" element={<ManagerDashboard />} />
      <Route path="/dashboard/admin" element={<AdminDashboard />} />

      {/* ===== FALLBACK ===== */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
