import { useEffect, useState } from "react";
import { auth, rtdb } from "../firebase/firebase";
import { ref, get } from "firebase/database";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";

function RoleRedirect() {
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      const snap = await get(ref(rtdb, `users/${user.uid}`));

      if (!snap.exists()) {
        setLoading(false);
        return;
      }

      const userRole = snap.val().role;

      console.log("ROLE FROM RTDB:", userRole); // 🔍 DEBUG

      setRole(userRole);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  if (loading) return <p>Loading dashboard...</p>;
  if (!role) return <Navigate to="/login" />;

  if (role === "admin") return <Navigate to="/dashboard/admin" />;
  if (role === "manager") return <Navigate to="/dashboard/manager" />;

  // 🔒 DEFAULT USER (SAFE)
  return <Navigate to="/dashboard/user" />;
}

export default RoleRedirect;
