import React, { useState, useEffect } from "react";
import { auth, provider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import CitizenApp from "./components/CitizenApp";
import WorkerApp from "./components/WorkerApp";
import Dashboard from "./components/Dashboard";
import "./App.css";

function App() {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => {
      if (u) setUser(u);
      else { setUser(null); setRole(null); }
    });
  }, []);

  const login = async () => {
    try { await signInWithPopup(auth, provider); }
    catch (e) { console.error(e); }
  };

  const logout = () => { signOut(auth); setRole(null); };

  if (!user) return (
    <div style={styles.landing}>
      <div style={styles.card}>
        <h1 style={styles.title}>🌊 Drainage Udhavi</h1>
        <p style={styles.subtitle}>Smart Urban Drainage Management</p>
        <button onClick={login} style={styles.googleBtn}>
          Sign in with Google
        </button>
      </div>
    </div>
  );

  if (!role) return (
    <div style={styles.landing}>
      <div style={styles.card}>
        <h1 style={styles.title}>🌊 Drainage Udhavi</h1>
        <p style={styles.subtitle}>Welcome, {user.displayName}!</p>
        <p style={styles.subtitle}>Select your role:</p>
        <button onClick={() => setRole("citizen")} style={styles.roleBtn}>🏠 Citizen</button>
        <button onClick={() => setRole("worker")} style={styles.roleBtn}>🔧 Sanitation Worker</button>
        <button onClick={() => setRole("municipal")} style={styles.roleBtn}>🏛️ Municipal Officer</button>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </div>
    </div>
  );

  return (
    <div>
      <nav style={styles.nav}>
        <span style={styles.navTitle}>🌊 Drainage Udhavi</span>
        <span style={styles.navUser}>{user.displayName} ({role})</span>
        <button onClick={logout} style={styles.logoutBtn}>Logout</button>
      </nav>
      {role === "citizen" && <CitizenApp user={user} />}
      {role === "worker" && <WorkerApp user={user} />}
      {role === "municipal" && <Dashboard user={user} />}
    </div>
  );
}

const styles = {
  landing: { minHeight: "100vh", background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)", display: "flex", alignItems: "center", justifyContent: "center" },
  card: { background: "white", borderRadius: 20, padding: 40, textAlign: "center", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxWidth: 400, width: "90%" },
  title: { color: "#333", fontSize: 28, marginBottom: 10 },
  subtitle: { color: "#666", marginBottom: 20 },
  googleBtn: { background: "#4285F4", color: "white", border: "none", padding: "12px 30px", borderRadius: 8, fontSize: 16, cursor: "pointer", width: "100%" },
  roleBtn: { display: "block", width: "100%", margin: "10px 0", padding: "12px", borderRadius: 8, border: "2px solid #667eea", background: "white", color: "#667eea", fontSize: 16, cursor: "pointer" },
  logoutBtn: { background: "#ff4444", color: "white", border: "none", padding: "8px 20px", borderRadius: 8, cursor: "pointer", marginTop: 10 },
  nav: { background: "#333", color: "white", padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  navTitle: { fontSize: 20, fontWeight: "bold" },
  navUser: { fontSize: 14, color: "#ccc" },
};

export default App;