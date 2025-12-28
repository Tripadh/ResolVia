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

  /* ===============================
     STATE
  =============================== */
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("user");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  /* ===============================
     EMAIL / PASSWORD LOGIN
  =============================== */
  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      const userRef = ref(rtdb, `users/${user.uid}`);
      const snap = await get(userRef);

      // If user does not exist in DB, save role and email
      if (!snap.exists()) {
        const domain = user.email.split("@")[1]?.toLowerCase();
        await set(userRef, {
          email: user.email,
          role,
          orgId: role === "admin" ? null : domain,
          createdAt: Date.now(),
        });
      }

      navigate("/dashboard");
    } catch (err) {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     GOOGLE LOGIN
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

      // First-time Google user → save role
      if (!snap.exists()) {
        const domain = user.email.split("@")[1]?.toLowerCase();

        await set(userRef, {
          email: user.email,
          role,
          orgId: role === "admin" ? null : domain,
          createdAt: Date.now(),
        });
      }

      navigate("/dashboard");
    } catch (err) {
      console.error(err);
      setError("Google sign-in failed");
    } finally {
      setLoading(false);
    }
  };

  /* ===============================
     UI
  =============================== */
  return (
    <div className="login-page">
      <Link to="/" className="home-btn">Home</Link>
      <div className="login-glow" />
      <div className="login-layout">
        {/* LOGIN CARD */}
        <form className="login-card" onSubmit={handleLogin}>
          <h2>Welcome Back</h2>
          <p className="subtitle">Login to continue</p>
          {/* ROLE SELECT */}
          <select
            className="role-select"
            value={role}
            onChange={(e) => setRole(e.target.value)}
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
        {/* JUDGE NOTE - right side box */}
        <div className="judge-note">
          <b>Note for Judges:</b>
          <ul style={{marginTop: 8, marginBottom: 0}}>
            <li><b>First</b>, sign up as <b>Admin</b> and create an organization domain.</li>
            <li><b>Then</b>, register as <b>User</b> or <b>Manager</b> using a matching email.</li>
            <li>Managers can be assigned by Admin.</li>
            <li>Role selection affects dashboard and permissions.</li>
            <li>Contact us for demo accounts.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Login;