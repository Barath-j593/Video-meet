export default function Controls({
  isMuted,
  isCameraOff,
  isScreenSharing,
  toggleMute,
  toggleCamera,
  toggleScreenShare,
  toggleChat,
  leaveMeeting,
}) {
  return (
    <div className="controls">
      <button
        onClick={toggleMute}
        className={`control-btn ${isMuted ? "active-warning" : "default"}`}
        title={isMuted ? "Unmute microphone" : "Mute microphone"}
      >
        {isMuted ? "🔇" : "🎤"}
        <span>{isMuted ? "Unmute" : "Mute"}</span>
      </button>

      <button
        onClick={toggleCamera}
        className={`control-btn ${isCameraOff ? "active-warning" : "default"}`}
        title={isCameraOff ? "Turn on camera" : "Turn off camera"}
      >
        {isCameraOff ? "📹" : "📷"}
        <span>{isCameraOff ? "Camera ON" : "Camera OFF"}</span>
      </button>

      <button
        onClick={toggleScreenShare}
        className={`control-btn ${
          isScreenSharing ? "active-orange" : "default"
        }`}
        title={isScreenSharing ? "Stop screen share" : "Start screen share"}
      >
        {isScreenSharing ? "⏹️" : "📺"}
        <span>{isScreenSharing ? "Stop Share" : "Share Screen"}</span>
      </button>

      <button
        onClick={toggleChat}
        className="control-btn default"
        title="Toggle chat panel"
      >
        💬
        <span>Chat</span>
      </button>

      <button
        onClick={leaveMeeting}
        className="control-btn leave"
        title="Leave meeting"
      >
        ☎️
        <span>Leave</span>
      </button>
    </div>
  );
}
