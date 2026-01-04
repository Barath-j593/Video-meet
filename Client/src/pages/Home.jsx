import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [userName, setUserName] = useState("");
  const navigate = useNavigate();

  function joinMeeting() {
    if (!roomId.trim() || !userName.trim()) return;
    sessionStorage.setItem("userName", userName);
    navigate(`/meet/${roomId}`);
  }

  function createMeeting() {
    if (!userName.trim()) return;
    const newRoomId = Math.random().toString(36).substring(2, 9).toUpperCase();
    sessionStorage.setItem("userName", userName);
    navigate(`/meet/${newRoomId}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.content}>
        <div style={styles.header}>
          <h1 style={styles.title}>🎥 Video Meet</h1>
          <p style={styles.subtitle}>Connect with anyone, anywhere</p>
        </div>

        <div style={styles.cardContainer}>
          <div style={styles.card}>
            <div style={styles.cardIcon}>🚀</div>
            <h2 style={styles.cardTitle}>Create a new meeting</h2>
            <input
              placeholder="Enter your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={styles.input}
            />
            <button
              style={styles.primaryBtn}
              onClick={createMeeting}
              disabled={!userName.trim()}
            >
              Create
            </button>
          </div>

          <div style={styles.divider}>OR</div>

          <div style={styles.card}>
            <div style={styles.cardIcon}>📞</div>
            <h2 style={styles.cardTitle}>Join a meeting</h2>
            <input
              placeholder="Your name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
              style={styles.input}
            />
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
              disabled={!roomId.trim() || !userName.trim()}
            >
              Join
            </button>
          </div>
        </div>

        <div style={styles.features}>
          <div style={styles.feature}>✨ Crystal clear video</div>
          <div style={styles.feature}>🔒 Secure & encrypted</div>
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
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
  },
  content: {
    width: "100%",
    maxWidth: "900px",
  },
  header: {
    textAlign: "center",
    color: "#fff",
    marginBottom: "60px",
  },
  title: {
    fontSize: "48px",
    margin: "0 0 10px 0",
    fontWeight: 700,
  },
  subtitle: {
    fontSize: "18px",
    margin: "0",
    opacity: 0.9,
  },
  cardContainer: {
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    gap: "40px",
    alignItems: "center",
    marginBottom: "60px",
  },
  card: {
    background: "#fff",
    padding: "40px 30px",
    borderRadius: "12px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
    textAlign: "center",
  },
  cardIcon: {
    fontSize: "48px",
    marginBottom: "16px",
  },
  cardTitle: {
    margin: "0 0 20px 0",
    fontSize: "18px",
    fontWeight: 600,
    color: "#333",
  },
  divider: {
    color: "#fff",
    fontSize: "16px",
    fontWeight: 500,
    opacity: 0.7,
  },
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
    transition: "border-color 0.2s ease",
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
    transition: "transform 0.2s ease",
  },
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
