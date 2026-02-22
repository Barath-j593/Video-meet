import { useEffect, useRef, useState } from "react";
import "./Whiteboard.css";

const TOOLS = {
  PEN: "pen",
  ERASER: "eraser",
  LINE: "line",
  RECT: "rect",
  CIRCLE: "circle",
  TEXT: "text",
};

const COLORS = [
  "#ffffff",
  "#ff006e",
  "#00d9ff",
  "#00ff88",
  "#ffd600",
  "#ff6d00",
  "#aa00ff",
  "#ff1744",
  "#76ff03",
  "#00e5ff",
];

const BRUSH_SIZES = [2, 4, 6, 10, 16, 24];

export default function Whiteboard({
  socket,
  roomId,
  isCreator,
  currentUserId,
  userName,
  onClose,
  savedState,
  onStateChange,
  savedHistory,
  savedRedoStack,
  onHistoryChange,
}) {
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null); // for shape preview
  const containerRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const shapeStartRef = useRef(null);

  /* ---------- State ---------- */
  const [tool, setTool] = useState(TOOLS.PEN);
  const [color, setColor] = useState("#ffffff");
  const [brushSize, setBrushSize] = useState(4);
  const [canDraw, setCanDraw] = useState(false);
  const [accessList, setAccessList] = useState([]); // user IDs with draw access
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [textPos, setTextPos] = useState(null);
  const [historyVersion, setHistoryVersion] = useState(0); // forces re-render for undo/redo buttons

  /* ---------- History (undo/redo) ---------- */
  const historyRef = useRef(savedHistory ? [...savedHistory] : []); // restore or start fresh
  const redoStackRef = useRef(savedRedoStack ? [...savedRedoStack] : []);
  const maxHistory = 50;

  /* ---------- Derived ---------- */
  const hasAccess = isCreator || accessList.includes(currentUserId);

  /* ============================
     CANVAS SETUP + SOCKET LISTENERS
     ============================ */
  useEffect(() => {
    const canvas = canvasRef.current;
    const overlay = overlayCanvasRef.current;
    if (!canvas || !overlay) return;

    // Size canvas
    const resizeCanvas = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height - 60; // toolbar height

      // Save current content before resize
      const ctx = canvas.getContext("2d");
      let imageData = null;
      if (canvas.width > 0 && canvas.height > 0) {
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }

      canvas.width = w;
      canvas.height = h;
      overlay.width = w;
      overlay.height = h;

      // Restore content after resize
      if (imageData) {
        ctx.putImageData(imageData, 0, 0);
      }
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    // Restore saved state if available, otherwise save initial blank canvas
    if (savedState) {
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Only save snapshot if we don't have restored history
        if (historyRef.current.length === 0) {
          saveSnapshot();
        }
      };
      img.src = savedState;
    } else if (historyRef.current.length === 0) {
      // No saved state and no history — save initial blank
      saveSnapshot();
    }

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, []);

  /* ---------- Save state to server on unmount ---------- */
  useEffect(() => {
    return () => {
      // On unmount, send current canvas state to server so it stays cached
      const canvas = canvasRef.current;
      if (canvas && socket) {
        const dataUrl = canvas.toDataURL();
        socket.emit("wb:snapshot", { roomId, imageDataUrl: dataUrl });
      }
    };
  }, [socket, roomId]);

  /* ---------- Socket listeners ---------- */
  useEffect(() => {
    if (!socket) return;

    // Request whiteboard state on mount (for late joiners)
    socket.emit("wb:request-state", { roomId });

    // Receive full whiteboard state (for late joiners)
    const handleFullState = ({ imageDataUrl }) => {
      if (!imageDataUrl) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        saveSnapshot();
      };
      img.src = imageDataUrl;
    };

    // Receive remote snapshot (undo/redo)
    const handleRemoteSnapshot = ({ imageDataUrl }) => {
      if (!imageDataUrl) return;
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Persist to parent so reopening shows latest state
        if (onStateChange) onStateChange(imageDataUrl);
      };
      img.src = imageDataUrl;
    };

    // Access control updates
    const handleAccessUpdate = ({ accessList: newList }) => {
      setAccessList(newList || []);
    };

    // Participant list for access management
    const handleParticipantList = ({ participants: list }) => {
      setParticipants(list || []);
    };

    socket.on("wb:full-state", handleFullState);
    socket.on("wb:snapshot", handleRemoteSnapshot);
    socket.on("wb:access-update", handleAccessUpdate);
    socket.on("wb:participants", handleParticipantList);

    return () => {
      socket.off("wb:full-state", handleFullState);
      socket.off("wb:snapshot", handleRemoteSnapshot);
      socket.off("wb:access-update", handleAccessUpdate);
      socket.off("wb:participants", handleParticipantList);
    };
  }, [socket, roomId]);

  /* ============================
     DRAW HELPERS
     ============================ */
  function drawStroke(ctx, data) {
    const { points, color: c, size, eraser } = data;
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (eraser) {
      ctx.globalCompositeOperation = "destination-out";
      ctx.lineWidth = size * 3;
    } else {
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = c;
      ctx.lineWidth = size;
    }

    ctx.beginPath();
    if (points.length === 1) {
      ctx.arc(points[0].x, points[0].y, size / 2, 0, Math.PI * 2);
      ctx.fillStyle = eraser ? "rgba(0,0,0,1)" : c;
      ctx.fill();
    } else {
      ctx.moveTo(points[0].x, points[0].y);
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawShape(ctx, data) {
    const { type, startX, startY, endX, endY, color: c, size } = data;
    ctx.save();
    ctx.strokeStyle = c;
    ctx.lineWidth = size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();
    if (type === "line") {
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
    } else if (type === "rect") {
      ctx.rect(startX, startY, endX - startX, endY - startY);
    } else if (type === "circle") {
      const rx = Math.abs(endX - startX) / 2;
      const ry = Math.abs(endY - startY) / 2;
      const cx = startX + (endX - startX) / 2;
      const cy = startY + (endY - startY) / 2;
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawText(ctx, data) {
    const { text, x, y, color: c, size } = data;
    ctx.save();
    ctx.fillStyle = c;
    ctx.font = `${Math.max(size * 3, 16)}px 'Segoe UI', sans-serif`;
    ctx.fillText(text, x, y);
    ctx.restore();
  }

  /* ============================
     SNAPSHOT / UNDO / REDO
     ============================ */
  function saveSnapshot() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL();
    historyRef.current.push(dataUrl);
    if (historyRef.current.length > maxHistory) {
      historyRef.current.shift();
    }
    redoStackRef.current = [];
    setHistoryVersion((v) => v + 1); // trigger re-render for button states
    // Persist to parent so state survives close/reopen
    if (onStateChange) onStateChange(dataUrl);
    if (onHistoryChange) onHistoryChange([...historyRef.current], [...redoStackRef.current]);
  }

  function undo() {
    if (historyRef.current.length <= 1) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Move current to redo
    const current = historyRef.current.pop();
    redoStackRef.current.push(current);
    setHistoryVersion((v) => v + 1); // trigger re-render for button states

    // Restore previous
    const prev = historyRef.current[historyRef.current.length - 1];
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      // Broadcast snapshot
      socket.emit("wb:snapshot", { roomId, imageDataUrl: prev });
      // Persist to parent
      if (onStateChange) onStateChange(prev);
      if (onHistoryChange) onHistoryChange([...historyRef.current], [...redoStackRef.current]);
    };
    img.src = prev;
  }

  function redo() {
    if (redoStackRef.current.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const next = redoStackRef.current.pop();
    historyRef.current.push(next);
    setHistoryVersion((v) => v + 1); // trigger re-render for button states

    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      socket.emit("wb:snapshot", { roomId, imageDataUrl: next });
      // Persist to parent
      if (onStateChange) onStateChange(next);
      if (onHistoryChange) onHistoryChange([...historyRef.current], [...redoStackRef.current]);
    };
    img.src = next;
  }

  /* ============================
     POINTER EVENTS
     ============================ */
  function getCanvasPoint(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  }

  // Normalize coordinates to 0-1 range for transmission
  function normalizePoint(pt) {
    const canvas = canvasRef.current;
    return { x: pt.x / canvas.width, y: pt.y / canvas.height };
  }

  function denormalizePoint(pt) {
    const canvas = canvasRef.current;
    return { x: pt.x * canvas.width, y: pt.y * canvas.height };
  }

  const strokePointsRef = useRef([]);

  function handlePointerDown(e) {
    if (!hasAccess) return;
    e.preventDefault();

    const pt = getCanvasPoint(e);
    isDrawingRef.current = true;

    if (tool === TOOLS.TEXT) {
      setTextPos(pt);
      return;
    }

    if (tool === TOOLS.LINE || tool === TOOLS.RECT || tool === TOOLS.CIRCLE) {
      shapeStartRef.current = pt;
      return;
    }

    // Pen / Eraser
    lastPointRef.current = pt;
    strokePointsRef.current = [pt];

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    drawStroke(ctx, {
      points: [pt],
      color,
      size: brushSize,
      eraser: tool === TOOLS.ERASER,
    });
  }

  function handlePointerMove(e) {
    if (!isDrawingRef.current || !hasAccess) return;
    e.preventDefault();

    const pt = getCanvasPoint(e);

    // Shape preview on overlay
    if (tool === TOOLS.LINE || tool === TOOLS.RECT || tool === TOOLS.CIRCLE) {
      const overlay = overlayCanvasRef.current;
      const octx = overlay.getContext("2d");
      octx.clearRect(0, 0, overlay.width, overlay.height);
      drawShape(octx, {
        type: tool,
        startX: shapeStartRef.current.x,
        startY: shapeStartRef.current.y,
        endX: pt.x,
        endY: pt.y,
        color,
        size: brushSize,
      });
      return;
    }

    // Pen / Eraser
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const prev = lastPointRef.current;

    drawStroke(ctx, {
      points: [prev, pt],
      color,
      size: brushSize,
      eraser: tool === TOOLS.ERASER,
    });

    lastPointRef.current = pt;
    strokePointsRef.current.push(pt);
  }

  function handlePointerUp(e) {
    if (!isDrawingRef.current || !hasAccess) return;
    isDrawingRef.current = false;

    const canvas = canvasRef.current;

    if (tool === TOOLS.LINE || tool === TOOLS.RECT || tool === TOOLS.CIRCLE) {
      const pt = getCanvasPoint(e);
      const ctx = canvas.getContext("2d");
      const startNorm = normalizePoint(shapeStartRef.current);
      const endNorm = normalizePoint(pt);

      drawShape(ctx, {
        type: tool,
        startX: shapeStartRef.current.x,
        startY: shapeStartRef.current.y,
        endX: pt.x,
        endY: pt.y,
        color,
        size: brushSize,
      });

      // Clear overlay
      const overlay = overlayCanvasRef.current;
      overlay.getContext("2d").clearRect(0, 0, overlay.width, overlay.height);

      // Emit shape
      socket.emit("wb:draw", {
        roomId,
        action: "shape",
        data: {
          type: tool,
          startX: startNorm.x,
          startY: startNorm.y,
          endX: endNorm.x,
          endY: endNorm.y,
          color,
          size: brushSize,
        },
      });

      saveSnapshot();
      shapeStartRef.current = null;
      return;
    }

    // Emit stroke
    if (strokePointsRef.current.length > 0) {
      const normalizedPoints = strokePointsRef.current.map(normalizePoint);
      socket.emit("wb:draw", {
        roomId,
        action: "stroke",
        data: {
          points: normalizedPoints,
          color,
          size: brushSize,
          eraser: tool === TOOLS.ERASER,
        },
      });
      saveSnapshot();
    }

    strokePointsRef.current = [];
    lastPointRef.current = null;
  }

  /* ============================
     TEXT SUBMIT
     ============================ */
  function handleTextSubmit() {
    if (!textInput.trim() || !textPos) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    drawText(ctx, { text: textInput, x: textPos.x, y: textPos.y, color, size: brushSize });

    const normPos = normalizePoint(textPos);
    socket.emit("wb:draw", {
      roomId,
      action: "text",
      data: { text: textInput, x: normPos.x, y: normPos.y, color, size: brushSize },
    });

    saveSnapshot();
    setTextInput("");
    setTextPos(null);
  }

  /* ============================
     CLEAR CANVAS
     ============================ */
  function clearCanvas() {
    if (!hasAccess) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    saveSnapshot();
    socket.emit("wb:draw", { roomId, action: "clear", data: {} });
  }

  /* ============================
     ACCESS CONTROL
     ============================ */
  function toggleAccess(userId) {
    if (!isCreator) return;
    socket.emit("wb:toggle-access", { roomId, targetUserId: userId });
  }

  function requestParticipants() {
    socket.emit("wb:get-participants", { roomId });
    setShowParticipants(!showParticipants);
  }

  /* ============================
     RECEIVE REMOTE DRAWS (denormalize)
     ============================ */
  useEffect(() => {
    if (!socket) return;

    const handleRemoteDraw = ({ action, data }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");

      switch (action) {
        case "stroke": {
          const denormalized = {
            ...data,
            points: data.points.map(denormalizePoint),
          };
          drawStroke(ctx, denormalized);
          saveSnapshot();
          break;
        }
        case "shape": {
          const start = denormalizePoint({ x: data.startX, y: data.startY });
          const end = denormalizePoint({ x: data.endX, y: data.endY });
          drawShape(ctx, {
            ...data,
            startX: start.x,
            startY: start.y,
            endX: end.x,
            endY: end.y,
          });
          saveSnapshot();
          break;
        }
        case "text": {
          const pos = denormalizePoint({ x: data.x, y: data.y });
          drawText(ctx, { ...data, x: pos.x, y: pos.y });
          saveSnapshot();
          break;
        }
        case "clear":
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          saveSnapshot();
          break;
        default:
          break;
      }
    };

    // Remove old listener, add denormalized one
    socket.off("wb:draw");
    socket.on("wb:draw", handleRemoteDraw);

    return () => {
      socket.off("wb:draw", handleRemoteDraw);
    };
  }, [socket]);

  /* ============================
     KEYBOARD SHORTCUTS
     ============================ */
  useEffect(() => {
    function handleKeyDown(e) {
      if (!hasAccess) return;

      // Ctrl+Z = undo, Ctrl+Y or Ctrl+Shift+Z = redo
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.key === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasAccess]);

  /* ============================
     PROVIDE STATE TO LATE JOINERS
     ============================ */
  useEffect(() => {
    if (!socket) return;

    // ANY peer with an open whiteboard can respond to state requests (not just creator)
    const handleRequestState = ({ requesterId }) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const dataUrl = canvas.toDataURL();
      socket.emit("wb:send-state", {
        roomId,
        targetSocketId: requesterId,
        imageDataUrl: dataUrl,
      });
    };

    socket.on("wb:request-state", handleRequestState);
    return () => socket.off("wb:request-state", handleRequestState);
  }, [socket, roomId]);

  /* ============================
     UI
     ============================ */
  return (
    <div className="whiteboard-container" ref={containerRef}>
      {/* Toolbar */}
      <div className="wb-toolbar">
        <div className="wb-toolbar-left">
          {/* Tools */}
          <div className="wb-tool-group">
            <button
              className={`wb-tool-btn ${tool === TOOLS.PEN ? "active" : ""}`}
              onClick={() => setTool(TOOLS.PEN)}
              title="Pen (freehand)"
              disabled={!hasAccess}
            >
              ✏️
            </button>
            <button
              className={`wb-tool-btn ${tool === TOOLS.ERASER ? "active" : ""}`}
              onClick={() => setTool(TOOLS.ERASER)}
              title="Eraser"
              disabled={!hasAccess}
            >
              🧹
            </button>
            <button
              className={`wb-tool-btn ${tool === TOOLS.LINE ? "active" : ""}`}
              onClick={() => setTool(TOOLS.LINE)}
              title="Line"
              disabled={!hasAccess}
            >
              ╱
            </button>
            <button
              className={`wb-tool-btn ${tool === TOOLS.RECT ? "active" : ""}`}
              onClick={() => setTool(TOOLS.RECT)}
              title="Rectangle"
              disabled={!hasAccess}
            >
              ▭
            </button>
            <button
              className={`wb-tool-btn ${tool === TOOLS.CIRCLE ? "active" : ""}`}
              onClick={() => setTool(TOOLS.CIRCLE)}
              title="Circle/Ellipse"
              disabled={!hasAccess}
            >
              ⬭
            </button>
            <button
              className={`wb-tool-btn ${tool === TOOLS.TEXT ? "active" : ""}`}
              onClick={() => setTool(TOOLS.TEXT)}
              title="Text"
              disabled={!hasAccess}
            >
              T
            </button>
          </div>

          {/* Separator */}
          <div className="wb-separator" />

          {/* Colors */}
          <div className="wb-color-group">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`wb-color-btn ${color === c ? "active" : ""}`}
                style={{ backgroundColor: c }}
                onClick={() => setColor(c)}
                disabled={!hasAccess}
                title={c}
              />
            ))}
          </div>

          {/* Separator */}
          <div className="wb-separator" />

          {/* Brush size */}
          <div className="wb-size-group">
            {BRUSH_SIZES.map((s) => (
              <button
                key={s}
                className={`wb-size-btn ${brushSize === s ? "active" : ""}`}
                onClick={() => setBrushSize(s)}
                disabled={!hasAccess}
                title={`Size ${s}px`}
              >
                <span
                  className="wb-size-dot"
                  style={{
                    width: Math.min(s + 2, 18),
                    height: Math.min(s + 2, 18),
                    backgroundColor: hasAccess ? color : "#555",
                  }}
                />
              </button>
            ))}
          </div>
        </div>

        <div className="wb-toolbar-right">
          {/* Undo / Redo */}
          <button
            className="wb-action-btn"
            onClick={undo}
            disabled={!hasAccess || historyRef.current.length <= 1}
            title="Undo (Ctrl+Z)"
          >
            ↩️ Undo
          </button>
          <button
            className="wb-action-btn"
            onClick={redo}
            disabled={!hasAccess || redoStackRef.current.length === 0}
            title="Redo (Ctrl+Y)"
          >
            ↪️ Redo
          </button>

          <div className="wb-separator" />

          {/* Clear */}
          <button
            className="wb-action-btn danger"
            onClick={clearCanvas}
            disabled={!hasAccess}
            title="Clear whiteboard"
          >
            🗑️ Clear
          </button>

          {/* Access control (creator only) */}
          {isCreator && (
            <button
              className="wb-action-btn access"
              onClick={requestParticipants}
              title="Manage drawing access"
            >
              👥 Access
            </button>
          )}

          {/* Close */}
          <button className="wb-action-btn close" onClick={onClose} title="Close whiteboard">
            ✕
          </button>
        </div>
      </div>

      {/* Access indicator */}
      {!hasAccess && (
        <div className="wb-no-access-banner">
          🔒 View only — Ask the room creator to grant you drawing access
        </div>
      )}

      {/* Participants panel (creator only) */}
      {showParticipants && isCreator && (
        <div className="wb-participants-panel">
          <div className="wb-panel-header">
            <h4>Drawing Access</h4>
            <button className="wb-panel-close" onClick={() => setShowParticipants(false)}>
              ✕
            </button>
          </div>
          <div className="wb-panel-body">
            {participants.length === 0 && (
              <p className="wb-no-participants">No other participants</p>
            )}
            {participants.map((p) => (
              <div key={p.odId || p.odId} className="wb-participant-row">
                <div className="wb-participant-info">
                  <span className="wb-participant-avatar">
                    {p.userName?.charAt(0)?.toUpperCase() || "?"}
                  </span>
                  <span className="wb-participant-name">{p.userName || "Guest"}</span>
                  {p.isCreator && <span className="wb-creator-badge">Creator</span>}
                </div>
                {!p.isCreator && (
                  <button
                    className={`wb-access-toggle ${
                      accessList.includes(p.odId) ? "granted" : ""
                    }`}
                    onClick={() => toggleAccess(p.odId)}
                  >
                    {accessList.includes(p.odId) ? "✓ Can Draw" : "View Only"}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Text input overlay */}
      {textPos && tool === TOOLS.TEXT && (
        <div
          className="wb-text-input-overlay"
          style={{
            left: textPos.x,
            top: textPos.y + 60, // offset for toolbar
          }}
        >
          <input
            autoFocus
            className="wb-text-field"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTextSubmit();
              if (e.key === "Escape") {
                setTextPos(null);
                setTextInput("");
              }
            }}
            placeholder="Type text..."
          />
          <button className="wb-text-ok" onClick={handleTextSubmit}>
            ✓
          </button>
        </div>
      )}

      {/* Canvas area */}
      <div className="wb-canvas-area">
        <canvas
          ref={canvasRef}
          className="wb-canvas"
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          style={{
            cursor: !hasAccess
              ? "not-allowed"
              : tool === TOOLS.ERASER
              ? "cell"
              : tool === TOOLS.TEXT
              ? "text"
              : "crosshair",
          }}
        />
        <canvas ref={overlayCanvasRef} className="wb-overlay-canvas" />
      </div>
    </div>
  );
}
