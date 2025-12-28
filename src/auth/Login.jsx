import { useState } from "react";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth, rtdb } from "../firebase/firebase";
import { Link, useNavigate } from "react-router-dom";
import { ref, get, set } from "firebase/database";
import "./Login.css";

function Login() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user"); // 🔥 NEW
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ===============================
     EMAIL / PASSWORD LOGIN
     (ROLE ALREADY EXISTS IN RTDB)
  =============================== */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/dashboard"); // RoleRedirect decides dashboard
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     GOOGLE SIGN-IN (ROLE REQUIRED)
  =============================== */
  const handleGoogleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      const userRef = ref(rtdb, `users/${user.uid}`);
      const snap = await get(userRef);

      // 🔥 First-time Google user → save role
      if (!snap.exists()) {
        const domain = user.email.split("@")[1]?.toLowerCase();

        await set(userRef, {
          email: user.email,
          role,           // ✅ ROLE FROM SELECT
          orgId: role === "admin" ? null : domain,
          createdAt: Date.now(),
        });
      }

      navigate("/dashboard");
    } catch (err) {
      console.error("Google sign-in error:", err);
      setError("Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-glow" />

      <form className="login-card" onSubmit={handleLogin}>
        <h2>Welcome Back</h2>
        <p className="subtitle">Login to continue</p>

        {/* 🔥 ROLE SELECT (FOR GOOGLE LOGIN) */}
        <select
          value={role}
          onChange={(e) => setRole(e.target.value)}
          className="role-select"
        >
          <option value="user">User</option>
          <option value="manager">Manager</option>
          <option value="admin">Admin</option>
        </select>

        {/* GOOGLE LOGIN */}
        <button
          type="button"
          className="google-btn"
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <img
            src="https://www.svgrepo.com/show/475656/google-color.svg"
            alt="Google"
          />
          Continue with Google
        </button>

        <div className="divider">
          <span>OR</span>
        </div>

        {/* EMAIL LOGIN */}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
          required
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError("");
          }}
          required
        />

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? "Logging in..." : "Login"}
        </button>

        <p className="footer-text">
          Don’t have an account? <Link to="/register">Register</Link>
        </p>
      </form>
    </div>
  );
}

export default Login;
