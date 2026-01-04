import { useEffect, useRef } from "react";
import "./ChatPanel.css";

export default function ChatPanel({
  messages,
  onSendMessage,
  onClose,
  currentUserName,
}) {
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (inputRef.current?.value.trim()) {
      onSendMessage(inputRef.current.value);
      inputRef.current.value = "";
      inputRef.current.focus();
    }
  };

  return (
    <div className="chat-panel">
      <div className="chat-header">
        <h3 className="chat-title">💬 Group Chat</h3>
        <button onClick={onClose} className="close-btn">
          ✕
        </button>
      </div>

      <div className="messages-container">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`message ${msg.isOwn ? "own" : "other"}`}
          >
            <div className="message-sender">
              {msg.senderName === "You" ? "You" : msg.senderName}
            </div>
            <div className="message-text">{msg.message}</div>
            <div className="message-time">{msg.timestamp}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input">
        <input
          ref={inputRef}
          type="text"
          placeholder="Type a message..."
          onKeyPress={(e) => e.key === "Enter" && handleSend()}
          className="input-field"
          autoFocus
        />
        <button onClick={handleSend} className="send-btn">
          Send
        </button>
      </div>
    </div>
  );
}
