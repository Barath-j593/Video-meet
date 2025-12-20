export default function Controls({
  isMuted,
  isCameraOff,
  toggleMute,
  toggleCamera,
  leaveMeeting
}) {
  return (
    <div style={styles.controls}>
      <button onClick={toggleMute} style={styles.btn}>
        {isMuted ? "Unmute" : "Mute"}
      </button>

      <button onClick={toggleCamera} style={styles.btn}>
        {isCameraOff ? "Camera ON" : "Camera OFF"}
      </button>

      <button onClick={leaveMeeting} style={styles.leaveBtn}>
        Leave
      </button>
    </div>
  );
}

const styles = {
  controls: {
    display: "flex",
    justifyContent: "center",
    gap: "15px",
    marginTop: "20px"
  },
  btn: {
    padding: "10px 15px",
    cursor: "pointer"
  },
  leaveBtn: {
    padding: "10px 15px",
    background: "#e53935",
    color: "#fff",
    border: "none",
    cursor: "pointer"
  }
};
