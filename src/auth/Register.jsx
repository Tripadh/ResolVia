import { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { ref, get, set, child } from "firebase/database";
import { auth, rtdb } from "../firebase/firebase";
import { useNavigate, Link } from "react-router-dom";
import "./Register.css";

function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let orgId = null;

      /* ===============================
         ORG MAPPING (USER / MANAGER)
      =============================== */
      if (role !== "admin") {
        const domain = email.split("@")[1]?.toLowerCase();

        if (!domain) {
          throw new Error("Invalid email address");
        }

        const orgSnap = await get(child(ref(rtdb), "organizations"));

        if (!orgSnap.exists()) {
          throw new Error("No organizations found");
        }

        const orgs = orgSnap.val();

        const match = Object.entries(orgs).find(
          ([_, org]) => org.emailDomain === domain
        );

        if (!match) {
          throw new Error("No organization found for this email domain");
        }

        orgId = match[0];
      }

      /* ===============================
         CREATE AUTH USER
      =============================== */
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      const user = userCred.user;

      // ✅ FIX: ensure auth is fully ready
      if (!user || !user.uid) {
        throw new Error("Authentication not ready. Try again.");
      }

      await updateProfile(user, {
        displayName: email.split("@")[0],
      });

      /* ===============================
         SAVE USER IN REALTIME DB
      =============================== */
      await set(ref(rtdb, `users/${user.uid}`), {
        email,
        role,
        orgId,
        createdAt: Date.now(),
      });

      alert("Registration successful ✅");

      /* ===============================
         REDIRECT BY ROLE
      =============================== */
      if (role === "admin") {
        navigate("/dashboard/admin");
      } else if (role === "manager") {
        navigate("/dashboard/manager");
      } else {
        navigate("/dashboard/user");
      }

    } catch (err) {
      console.error("Register error:", err);
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-page">
      <div className="register-glow" />

      <form className="register-card" onSubmit={handleRegister}>
        <h2>Create Account</h2>
        <p className="subtitle">Join the platform</p>

        <input
          type="email"
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
        >
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>

        <button type="submit" disabled={loading}>
          {loading ? "Registering..." : "Register"}
        </button>

        <p className="footer-text">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}

export default Register;
