import { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const [findJobOpen, setFindJobOpen] = useState(false);
  const [skillsText, setSkillsText] = useState("");
  const [prediction, setPrediction] = useState("");
  const [predictionError, setPredictionError] = useState("");
  const [jobLinksShown, setJobLinksShown] = useState(false);
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

  async function onFindJobSubmit(event) {
    event.preventDefault();

    if (!skillsText.trim()) {
      setPredictionError("Please describe your skills/interests.");
      return;
    }

    setPredictionError("");
    setPrediction("Searching...");

    try {
      const response = await axios.post("http://localhost:4000/api/job/predict-job", {
        skills: skillsText,
      });

      const found = response.data?.jobRole || "Not found";
      setPrediction(found);
      setJobLinksShown(true);
    } catch (error) {
      console.error(error);
      setPrediction("");
      setPredictionError(
        error.response?.data?.error || "Could not predict job role"
      );
      setJobLinksShown(false);
    }
  }

  function clearFindJob() {
    setFindJobOpen(false);
    setSkillsText("");
    setPrediction("");
    setPredictionError("");
    setJobLinksShown(false);
  }

  function linkedinTabList(role) {
    const keywords = [
      role,
      `${role} developer`,
      `${role} engineer`,
      `${role} analyst`,
    ];

    return keywords.map((k) => ({
      label: k,
      url: `https://www.linkedin.com/jobs/search?keywords=${encodeURIComponent(
        k
      )}`,
    }));
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

        <div style={styles.findJobCard}>
          <h2 style={styles.cardTitle}>🔍 Find a Job Role</h2>
          {!findJobOpen ? (
            <button
              style={styles.primaryBtn}
              onClick={() => setFindJobOpen(true)}
            >
              Open Job Finder
            </button>
          ) : (
            <form onSubmit={onFindJobSubmit} style={styles.findJobForm}>
              <textarea
                placeholder="Describe your skills and interests..."
                value={skillsText}
                onChange={(e) => setSkillsText(e.target.value)}
                rows={4}
                style={styles.textarea}
              />
              <div style={styles.findJobActions}>
                <button type="submit" style={styles.primaryBtn}>
                  Predict Role
                </button>
                <button
                  type="button"
                  onClick={clearFindJob}
                  style={styles.secondaryBtn}
                >
                  Cancel
                </button>
              </div>

              {prediction && (
                <div style={styles.predictionBox}>
                  Predicted Role: <strong>{prediction}</strong>
                </div>
              )}

              {predictionError && (
                <div style={styles.errorBox}>{predictionError}</div>
              )}

              {jobLinksShown && prediction && (
                <button
                  type="button"
                  style={styles.linkedinBtn}
                  onClick={() => setJobLinksShown(true)}
                >
                  Show LinkedIn job tabs
                </button>
              )}

              {jobLinksShown && prediction && (
                <div style={styles.linkedinTabs}>
                  {linkedinTabList(prediction).map((item) => (
                    <a
                      key={item.url}
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.linkedinLink}
                    >
                      {item.label}
                    </a>
                  ))}
                </div>
              )}
            </form>
          )}
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

        {/* ── Resume Filter — two direct buttons ────────────────────────── */}
        <div style={styles.resumeSection}>
          <div style={styles.resumeCard}>
            <div style={styles.resumeLeft}>
              <div style={styles.resumeIcon}>🎯</div>
              <div>
                <h3 style={styles.resumeTitle}>Resume Intelligence</h3>
                <p style={styles.resumeDesc}>
                  AI-powered resume screening and candidate ranking.
                </p>
              </div>
            </div>
            <div style={styles.resumeBtns}>
              <button
                style={styles.resumeBtnOutline}
                onClick={() => navigate("/resumefilter/jobseeker")}
              >
                Apply as Job Seeker
              </button>
              <button
                style={styles.resumeBtn}
                onClick={() => navigate("/resumefilter/interviewer")}
              >
                Interviewer Dashboard
              </button>
            </div>
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
  resumeBtns: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    justifyContent: "flex-end",
  },
  resumeBtnOutline: {
    padding: "11px 22px",
    background: "transparent",
    color: "#fff",
    border: "2px solid rgba(255,255,255,0.6)",
    borderRadius: "24px",
    fontSize: "14px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  findJobCard: {
    background: "rgba(255,255,255,0.18)",
    border: "1px solid rgba(255, 255, 255, 0.35)",
    borderRadius: "14px",
    padding: "20px",
    marginBottom: "30px",
    color: "#fff",
  },
  findJobForm: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "12px",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    padding: "10px",
    fontSize: "14px",
    resize: "vertical",
  },
  secondaryBtn: {
    padding: "11px 18px",
    background: "rgba(255,255,255,0.2)",
    color: "#fff",
    border: "1px solid rgba(255,255,255,0.4)",
    borderRadius: "8px",
    cursor: "pointer",
  },
  findJobActions: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
    alignItems: "center",
  },
  predictionBox: {
    background: "rgba(0, 0, 0, 0.3)",
    border: "1px solid #fff",
    borderRadius: "8px",
    color: "#fff",
    padding: "8px 12px",
    fontWeight: "bold",
  },
  errorBox: {
    background: "rgba(255, 87, 87, 0.2)",
    border: "1px solid #ff5d5d",
    borderRadius: "8px",
    padding: "8px 12px",
    color: "#ffdddd",
  },
  linkedinBtn: {
    marginTop: "8px",
    padding: "10px 16px",
    background: "#0073b1",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontWeight: 600,
  },
  linkedinTabs: {
    marginTop: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  linkedinLink: {
    padding: "10px 12px",
    background: "rgba(255,255,255,0.9)",
    border: "1px solid #ccc",
    borderRadius: "8px",
    color: "#064f80",
    fontWeight: 600,
    textDecoration: "none",
  },
};