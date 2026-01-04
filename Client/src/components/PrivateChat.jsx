import { useState, useEffect, useRef } from "react";
import "../styles/PrivateChat.css";

export default function PrivateChat({
  remoteStreams,
  onSelectChat,
  onSendPrivateMessage,
  privateMessages,
  currentUserId,
  currentUserName,
  onClose,
}) {
  const [selectedPeerId, setSelectedPeerId] = useState(null);
  const [messageInput, setMessageInput] = useState("");
  const messagesEndRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [privateMessages, selectedPeerId]);

  const handleSendMessage = () => {
    if (!messageInput.trim() || !selectedPeerId) return;

    onSendPrivateMessage({
      recipientId: selectedPeerId,
      message: messageInput,
      timestamp: new Date().toLocaleTimeString(),
    });

    setMessageInput("");
  };

  const selectedPeerMessages = selectedPeerId
    ? privateMessages.filter(
        (msg) =>
          (msg.senderId === currentUserId &&
            msg.recipientId === selectedPeerId) ||
          (msg.senderId === selectedPeerId && msg.recipientId === currentUserId)
      )
    : [];

  return (
    <div className="private-chat-container">
      {/* Header */}
      <div className="private-chat-header">
        <h3 className="private-chat-title">💬 Private Messages</h3>
        <button
          onClick={onClose}
          className="close-btn"
          aria-label="Close private chat"
        >
          ✕
        </button>
      </div>

      {/* Main content */}
      <div className="private-chat-content">
        {/* Participant list */}
        <div className="participant-list">
          <div className="list-header">Participants</div>
          {remoteStreams.length === 0 ? (
            <div className="empty-list">No other participants</div>
          ) : (
            remoteStreams.map(({ id }) => (
              <button
                key={id}
                onClick={() => {
                  setSelectedPeerId(id);
                  onSelectChat(id);
                }}
                className={`participant-btn ${
                  selectedPeerId === id ? "active" : ""
                }`}
              >
                <span className="participant-icon">👤</span>
                <span className="participant-name">
                  Participant {id.substring(0, 6)}
                </span>
                {selectedPeerId === id && (
                  <span className="unread-badge">✓</span>
                )}
              </button>
            ))
          )}
        </div>

        {/* Message area */}
        {selectedPeerId ? (
          <div className="message-area">
            {/* Messages */}
            <div className="private-messages">
              {selectedPeerMessages.length === 0 ? (
                <div className="empty-messages">
                  Start a conversation with this participant
                </div>
              ) : (
                selectedPeerMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`private-message ${
                      msg.senderId === currentUserId ? "sent" : "received"
                    }`}
                  >
                    <div className="message-bubble">{msg.message}</div>
                    <div className="message-time">{msg.timestamp}</div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="private-input-area">
              <input
                type="text"
                placeholder="Type a message..."
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
                className="private-input-field"
              />
              <button onClick={handleSendMessage} className="private-send-btn">
                Send
              </button>
            </div>
          </div>
        ) : (
          <div className="no-selection">
            <div className="no-selection-icon">💬</div>
            <p>Select a participant to start messaging</p>
          </div>
        )}
      </div>
    </div>
  );
}
