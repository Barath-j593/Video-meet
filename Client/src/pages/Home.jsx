import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const [roomId, setRoomId] = useState("");
  const navigate = useNavigate();

  function joinMeeting() {
    if (!roomId.trim()) return;
    navigate(`/meet/${roomId}`);
  }

  function createMeeting() {
    const newRoomId = Math.random().toString(36).substring(2, 8);
    navigate(`/meet/${newRoomId}`);
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <h1 style={styles.title}>Video Meet</h1>

        <input
          placeholder="Enter Meeting ID"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          style={styles.input}
        />

        <button style={styles.primaryBtn} onClick={joinMeeting}>
          Join Meeting
        </button>

        <p style={{ margin: "10px 0" }}>OR</p>

        <button style={styles.secondaryBtn} onClick={createMeeting}>
          Create New Meeting
        </button>
      </div>
    </div>
  );
}

const styles = {
  page: {
    height: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#f4f6f8"
  },
  card: {
    background: "#fff",
    padding: "30px",
    borderRadius: "8px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
    textAlign: "center",
    width: "300px"
  },
  title: {
    marginBottom: "20px"
  },
  input: {
    width: "100%",
    padding: "10px",
    marginBottom: "10px"
  },
  primaryBtn: {
    width: "100%",
    padding: "10px",
    background: "#1976d2",
    color: "#fff",
    border: "none",
    cursor: "pointer"
  },
  secondaryBtn: {
    width: "100%",
    padding: "10px",
    background: "#4caf50",
    color: "#fff",
    border: "none",
    cursor: "pointer"
  }
};
