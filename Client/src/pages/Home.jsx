import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const userName = user?.name || "Guest";

  function joinMeeting() {
    if (!roomId.trim()) return;
    sessionStorage.setItem("userName", userName);
    navigate(`/meet/${roomId}`);
  }

  function createMeeting() {
    const newRoomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    sessionStorage.setItem("userName", userName);
    navigate(`/meet/${newRoomId}`);
  }

  function handleLogout() {
    logout();
    navigate("/login");
  }



  return (
    <div style={styles.page}>
      {/* User info bar */}
      <div style={styles.userBar}>
        <div style={styles.userInfo}>
          <span style={styles.welcomeText}>Welcome, {userName}</span>
          <span style={styles.roleTag}>{user?.role}</span>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </div>

      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎥 Video Meet</h1>
          <p style={styles.subtitle}>Connect with anyone, anywhere</p>
        </div>

        <div style={styles.cardContainer}>
          <div style={styles.card}>
            <div style={styles.cardIcon}>🚀</div>
            <h2 style={styles.cardTitle}>Create a new meeting</h2>
            <div style={styles.userDisplay}>
              Joining as: <strong>{userName}</strong>
            </div>
            <button style={styles.primaryBtn} onClick={createMeeting}>
              Create Meeting
            </button>
          </div>

          <div style={styles.divider}>OR</div>

          <div style={styles.card}>
            <div style={styles.cardIcon}>📞</div>
            <h2 style={styles.cardTitle}>Join a meeting</h2>
            <div style={styles.userDisplay}>
              Joining as: <strong>{userName}</strong>
            </div>
            <input
              placeholder="Enter meeting code"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === "Enter" && joinMeeting()}
              style={styles.input}
              maxLength="9"
            />
            <button
              style={styles.primaryBtn}
              onClick={joinMeeting}
              disabled={!roomId.trim()}
            >
              Join Meeting
            </button>
          </div>
        </div>

        {/* ── Resume Filter card — visible to all users ──────────────────── */}
        <div style={styles.resumeSection}>
          <div style={styles.resumeCard}>
            <div style={styles.resumeLeft}>
              <div style={styles.resumeIcon}>🎯</div>
              <div>
                <h3 style={styles.resumeTitle}>Resume Intelligence</h3>
                <p style={styles.resumeDesc}>
                  AI-powered resume screening — apply for positions or review and rank candidates.
                </p>
              </div>
            </div>
            <button
              style={styles.resumeBtn}
              onClick={() => navigate("/resumefilter")}
            >
              Open →
            </button>
          </div>
        </div>
        {/* ────────────────────────────────────────────────────────────────── */}

        <div style={styles.features}>
          <div style={styles.feature}>✨ Crystal clear video</div>
          <div style={styles.feature}>🔒 Secure &amp; encrypted</div>
          <div style={styles.feature}>📺 Screen sharing</div>
          <div style={styles.feature}>👥 Multiple participants</div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  userBar: {
    position: "absolute",
    top: "20px",
    right: "20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    background: "rgba(255, 255, 255, 0.15)",
    padding: "10px 20px",
    borderRadius: "30px",
    backdropFilter: "blur(10px)",
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    color: "#fff",
  },
  welcomeText: { fontSize: "14px", fontWeight: "500" },
  roleTag: {
    fontSize: "12px",
    padding: "4px 10px",
    background: "rgba(255, 255, 255, 0.2)",
    borderRadius: "12px",
    textTransform: "capitalize",
  },
  logoutBtn: {
    padding: "8px 16px",
    background: "rgba(255, 255, 255, 0.2)",
    color: "#fff",
    border: "none",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },
  content: { width: "100%", maxWidth: "900px" },
  header: { textAlign: "center", color: "#fff", marginBottom: "60px" },
  title: { fontSize: "48px", margin: "0 0 10px 0", fontWeight: 700 },
  subtitle: { fontSize: "18px", margin: "0", opacity: 0.9 },
  cardContainer: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "40px",
    alignItems: "center",
    marginBottom: "40px",
  },
  card: {
    background: "#fff",
    padding: "40px 30px",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    textAlign: "center",
  },
  cardIcon: { fontSize: "48px", marginBottom: "16px" },
  cardTitle: { margin: "0 0 20px 0", fontSize: "18px", fontWeight: 600, color: "#333" },
  userDisplay: {
    padding: "12px",
    marginBottom: "16px",
    background: "#f5f5f5",
    borderRadius: "8px",
    fontSize: "14px",
    color: "#666",
  },
  divider: { color: "#fff", fontSize: "16px", fontWeight: 500, opacity: 0.7 },
  input: {
    width: "100%",
    padding: "12px 16px",
    marginBottom: "16px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    fontSize: "14px",
    boxSizing: "border-box",
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  primaryBtn: {
    width: "100%",
    padding: "12px 24px",
    background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    fontSize: "16px",
    fontWeight: 600,
    cursor: "pointer",
  },

  // ── Resume Filter styles ──────────────────────────────────────────────────
  resumeSection: {
    marginBottom: "40px",
  },
  resumeCard: {
    background: "rgba(255, 255, 255, 0.12)",
    backdropFilter: "blur(10px)",
    border: "1px solid rgba(255,255,255,0.25)",
    borderRadius: "12px",
    padding: "24px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "24px",
    flexWrap: "wrap",
  },
  resumeLeft: {
    display: "flex",
    alignItems: "center",
    gap: "18px",
  },
  resumeIcon: {
    fontSize: "36px",
    flexShrink: 0,
  },
  resumeTitle: {
    color: "#fff",
    fontSize: "18px",
    fontWeight: 700,
    margin: "0 0 4px 0",
  },
  resumeDesc: {
    color: "rgba(255,255,255,0.75)",
    fontSize: "14px",
    margin: 0,
    maxWidth: "480px",
    lineHeight: 1.5,
  },
  resumeBtn: {
    padding: "12px 28px",
    background: "#fff",
    color: "#764ba2",
    border: "none",
    borderRadius: "24px",
    fontSize: "15px",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },
  // ─────────────────────────────────────────────────────────────────────────

  features: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "20px",
    textAlign: "center",
    color: "#fff",
    fontSize: "14px",
  },
  feature: {
    padding: "16px",
    background: "rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    backdropFilter: "blur(10px)",
  },
};