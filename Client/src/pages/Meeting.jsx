import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import Controls from "../components/Controls";
import ChatPanel from "../components/ChatPanel";
import "./Meeting-Modern.css";

export default function Meeting() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  /* ---------- Refs ---------- */
  const localVideoRef = useRef(null);
  const socketRef = useRef(null);
  const deviceRef = useRef(null);
  const sendTransportRef = useRef(null);
  const recvTransportRef = useRef(null);
  const recvTransportReadyRef = useRef(false); // ✅ Track recv transport connection state
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null); // ✅ Screen share stream
  const screenProducerRef = useRef(null); // ✅ Screen producer
  const consumedProducersRef = useRef(new Set()); // ✅ prevent duplicates
  const remoteVideoRefs = useRef(new Map()); // ✅ track remote video elements
  const pendingTracksRef = useRef(new Map()); // ✅ collect audio/video tracks by producerId
  const isProducingScreenRef = useRef(false); // ✅ Flag to track if we're producing screen
  const screenConsumersRef = useRef(new Map()); // ✅ Store screen share consumers for cleanup

  /* ---------- State ---------- */
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false); // ✅ Screen share state
  const [userName] = useState(
    () => sessionStorage.getItem("userName") || "Guest"
  );
  const [chatMessages, setChatMessages] = useState([]);
  const [remoteScreenStreams, setRemoteScreenStreams] = useState([]); // ✅ Remote screen shares
  const [participantCount, setParticipantCount] = useState(1); // ✅ Track participants
  const [showChat, setShowChat] = useState(false); // ✅ Chat panel visibility
  const [messages, setMessages] = useState([]); // ✅ Chat messages
  const [chatInput, setChatInput] = useState(""); // ✅ Chat input
  const [fullscreenMode, setFullscreenMode] = useState("meeting"); // ✅ "meeting" or "screen"

  /* ============================
     AUTO-RESET FULLSCREEN WHEN SCREEN SHARE STOPS
     ============================ */
  useEffect(() => {
    // If screen share ends, reset to meeting view
    if (remoteScreenStreams.length === 0 && fullscreenMode === "screen") {
      setFullscreenMode("meeting");
      console.log("🔄 Screen share ended, returning to meeting view");
    }
  }, [remoteScreenStreams.length, fullscreenMode]);

  /* ============================
     HANDLE LOCAL VIDEO PLAYBACK (Retry on fullscreen changes)
     ============================ */
  useEffect(() => {
    if (!localVideoRef.current || !localStreamRef.current) return;

    console.log(
      "📹 Local Video: Fullscreen mode changed, retrying playback:",
      fullscreenMode
    );

    let retries = 0;
    const maxRetries = 3;

    const retryPlay = () => {
      if (!localVideoRef.current) return;

      retries++;
      const playPromise = localVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            console.log("✅ Local Video: Resumed after view change");
          })
          .catch((err) => {
            console.log(
              `⚠️ Local Video: Play failed (${err.name}), attempt ${retries}/${maxRetries}`
            );
            if (retries < maxRetries) {
              setTimeout(retryPlay, 100);
            }
          });
      }
    };

    retryPlay();
  }, [fullscreenMode]);

  /* ============================
     CLEANUP SCREEN CONSUMERS ON PEER DISCONNECT
     ============================ */
  useEffect(() => {
    return () => {
      // Cleanup screen consumers when component unmounts
      screenConsumersRef.current.forEach((consumer) => {
        try {
          consumer.close();
        } catch (error) {
          console.error("Error closing screen consumer:", error);
        }
      });
      screenConsumersRef.current.clear();
    };
  }, []);

  /* ============================
     MAIN EFFECT
     ============================ */
  useEffect(() => {
    let mounted = true;

    socketRef.current = io("http://localhost:4000");
    const socket = socketRef.current;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (!mounted) return;

      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        // Try to play immediately
        setTimeout(() => {
          if (localVideoRef.current) {
            localVideoRef.current.play().catch((err) => {
              console.log("Initial play attempt failed, will retry:", err);
            });
          }
        }, 100);
      }

      socket.emit("join-room", { roomId, userName });
    }

    start();

    /* 🔥 Debug: Log all socket events */
    socket.onAny((event, ...args) => {
      if (event !== "connect" && event !== "disconnect") {
        console.log(`📡 Socket event received: ${event}`, args);
      }
    });

    /* 🔥 IMPORTANT: listen FIRST */
    socket.on(
      "new-producer",
      async ({ producerId, peerId, kind, isScreenShare }) => {
        console.log(
          `🆕 new-producer event: ${producerId?.substring(
            0,
            8
          )} (${kind}) from peer ${peerId?.substring(
            0,
            8
          )} (screenShare: ${isScreenShare})`
        );
        if (consumedProducersRef.current.has(producerId)) {
          console.log(
            `⏭️ Already consuming ${producerId?.substring(0, 8)}, skipping`
          );
          return;
        }
        console.log(`✅ Will consume ${producerId?.substring(0, 8)}`);
        await consumeProducer(producerId, peerId, isScreenShare || false);
      }
    );

    /* ✅ Handle peer disconnect */
    socket.on("peer-left", ({ peerId }) => {
      console.log(`👋 Peer ${peerId?.substring(0, 8)} left the room`);

      // Remove remote stream from this peer
      setRemoteStreams((prev) => {
        const updated = prev.filter((stream) => stream.id !== peerId);
        console.log(
          `Removed remote stream for peer ${peerId?.substring(
            0,
            8
          )}, remaining streams: ${updated.length}`
        );
        return updated;
      });

      // Remove remote screen share
      setRemoteScreenStreams((prev) =>
        prev.filter((screen) => screen.peerId !== peerId)
      );

      // ✅ Close screen share consumer if exists
      const screenConsumer = screenConsumersRef.current.get(peerId);
      if (screenConsumer) {
        screenConsumer.close();
        screenConsumersRef.current.delete(peerId);
        console.log(
          `✅ Closed screen consumer for peer ${peerId?.substring(0, 8)}`
        );
      }

      // Stop all consumers for this peer
      pendingTracksRef.current.delete(peerId);

      // Update participant count
      setParticipantCount((prev) => Math.max(1, prev - 1));
    });

    /* ✅ Handle screen share stopped */
    socket.on("screen-share-stopped", ({ peerId }) => {
      console.log(`🛑 Screen share stopped by peer ${peerId?.substring(0, 8)}`);

      // ✅ Close the screen share consumer
      const consumer = screenConsumersRef.current.get(peerId);
      if (consumer) {
        try {
          // Stop all tracks in the consumer
          if (consumer.track) {
            consumer.track.stop();
          }
          consumer.close();
          screenConsumersRef.current.delete(peerId);
          console.log(
            `✅ Closed screen share consumer for peer ${peerId?.substring(
              0,
              8
            )}`
          );
        } catch (error) {
          console.error("Error closing screen consumer:", error);
        }
      }

      // ✅ Remove from screen streams
      setRemoteScreenStreams((prev) =>
        prev.filter((screen) => screen.peerId !== peerId)
      );
    });

    /* ✅ Handle participant count updates */
    socket.on("participant-joined", ({ participantCount }) => {
      setParticipantCount(participantCount);
      console.log(`👥 Participants now: ${participantCount}`);
    });

    socket.on("participant-left", ({ participantCount }) => {
      setParticipantCount(participantCount);
      console.log(`👥 Participants now: ${participantCount}`);
    });

    /* ✅ Handle chat messages */
    socket.on(
      "chat-message",
      ({ senderId, senderName, message, timestamp }) => {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            senderId,
            senderName: senderName || "Anonymous",
            message,
            timestamp,
            isOwn: false,
          },
        ]);
      }
    );

    /* ---------- Load mediasoup device ---------- */
    socket.on("router-rtp-capabilities", async (rtpCapabilities) => {
      const device = new mediasoupClient.Device();
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      deviceRef.current = device;

      await createSendTransport();
      await createRecvTransport();
      await produceMedia();

      // consume already existing producers
      socket.emit("get-producers", (producers) => {
        console.log(
          `📋 get-producers returned ${producers.length} producers:`,
          producers
        );
        producers.forEach(async ({ producerId, peerId }) => {
          if (!consumedProducersRef.current.has(producerId)) {
            console.log(
              `✅ Consuming existing producer ${producerId?.substring(0, 8)}`
            );
            await consumeProducer(producerId, peerId);
          }
        });
      });
    });

    /* ---------- Cleanup ---------- */
    return () => {
      mounted = false;

      if (socketRef.current) {
        socketRef.current.emit("leave-room");
        socketRef.current.disconnect();
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
      }

      consumedProducersRef.current.clear();
      pendingTracksRef.current.clear();
      setRemoteStreams([]);
    };
  }, [roomId]);

  /* ============================
     SEND TRANSPORT
     ============================ */
  async function createSendTransport() {
    const socket = socketRef.current;

    return new Promise((resolve) => {
      socket.emit("create-transport", { direction: "send" }, (params) => {
        console.log("📡 Creating send transport with params:", params);
        const transport = deviceRef.current.createSendTransport(params);

        transport.on("produce", ({ kind, rtpParameters }, callback) => {
          // Check if this is a screen share using the flag that's set before produce()
          const isScreenShare = isProducingScreenRef.current;
          console.log(
            `🎤 Send transport produce event for ${kind} (screenShare: ${isScreenShare})`
          );
          socket.emit(
            "produce",
            {
              transportId: transport.id,
              kind,
              rtpParameters,
              isScreenShare,
            },
            ({ id }) => {
              console.log(`✅ Producer created on server for ${kind}: ${id}`);
              callback({ id });
              // Reset flag after produce completes
              if (isScreenShare) {
                isProducingScreenRef.current = false;
              }
            }
          );
        });

        transport.on("connect", ({ dtlsParameters }, callback) => {
          console.log("🔗 Send transport connect event");
          socket.emit("connect-transport", {
            transportId: transport.id,
            dtlsParameters,
          });
          callback();
        });

        transport.on("connectionstatechange", (connectionState) => {
          console.log(
            "📡 Send transport connectionstatechange:",
            connectionState
          );
        });

        sendTransportRef.current = transport;
        console.log("✅ Send transport created:", transport.id);
        resolve();
      });
    });
  }

  /* ============================
     RECV TRANSPORT
     ============================ */
  async function createRecvTransport() {
    const socket = socketRef.current;

    return new Promise((resolve) => {
      socket.emit("create-transport", { direction: "recv" }, (params) => {
        console.log("📡 Creating recv transport with params:", params);
        const transport = deviceRef.current.createRecvTransport(params);

        transport.on("connect", ({ dtlsParameters }, callback) => {
          console.log(
            "🔗 Recv transport connect event, sending dtlsParameters"
          );
          socket.emit("connect-transport", {
            transportId: transport.id,
            dtlsParameters,
          });
          callback();
        });

        transport.on("connectionstatechange", (connectionState) => {
          console.log(
            "📡 Recv transport connectionstatechange:",
            connectionState
          );
          if (connectionState === "connected") {
            recvTransportReadyRef.current = true;
            console.log("✅ Recv transport connected and ready!");
          }
        });

        recvTransportRef.current = transport;

        // Mark as ready immediately (mediasoup will handle connect when needed)
        recvTransportReadyRef.current = true;
        console.log(
          "✅ Recv transport created and marked ready:",
          transport.id
        );
        resolve();
      });
    });
  }

  /* ============================
     PRODUCE MEDIA
     ============================ */
  async function produceMedia() {
    const stream = localStreamRef.current;

    for (const track of stream.getTracks()) {
      await sendTransportRef.current.produce({ track });
    }
  }

  /* ============================
     CONSUME PRODUCER
     ============================ */
  async function consumeProducer(producerId, peerId, isScreenShare = false) {
    consumedProducersRef.current.add(producerId);
    const socket = socketRef.current;

    socket.emit(
      "consume",
      {
        producerId,
        rtpCapabilities: deviceRef.current.rtpCapabilities,
      },
      async ({ id, kind, rtpParameters }) => {
        console.log(
          `Consuming producer: ${producerId.substring(
            0,
            8
          )} (${kind}) from peer ${peerId?.substring(
            0,
            8
          )} (screenShare: ${isScreenShare})`
        );

        let consumer;
        try {
          consumer = await recvTransportRef.current.consume({
            id,
            producerId,
            kind,
            rtpParameters,
          });

          console.log(
            `Consumer created: ${consumer.id.substring(0, 8)} (${
              consumer.kind
            })`
          );

          // Resume consumer immediately for video/audio data flow
          socket.emit("resume-consumer", { consumerId: consumer.id });
          console.log(`Resuming consumer ${consumer.id.substring(0, 8)}...`);
        } catch (error) {
          console.error("❌ Error consuming producer:", error);
          return;
        }

        // ✅ For screen shares, create stream immediately with just video
        if (isScreenShare && kind === "video") {
          const stream = new MediaStream([consumer.track]);
          console.log(
            "📺 Screen share stream created for peer:",
            peerId?.substring(0, 8)
          );

          // ✅ Store consumer for cleanup later
          screenConsumersRef.current.set(peerId, consumer);

          setRemoteScreenStreams((prev) => [...prev, { peerId, stream }]);
          return;
        }

        // ✅ Store tracks by PEER ID, not producer ID
        if (!pendingTracksRef.current.has(peerId)) {
          pendingTracksRef.current.set(peerId, {
            audio: null,
            video: null,
          });
        }

        const trackObj = pendingTracksRef.current.get(peerId);
        trackObj[kind] = consumer.track;

        console.log(`Pending tracks for peer ${peerId?.substring(0, 8)}:`, {
          audio: trackObj.audio ? `✅ (${trackObj.audio.id})` : "❌",
          video: trackObj.video ? `✅ (${trackObj.video.id})` : "❌",
        });

        // ✅ Only create stream when BOTH audio and video are available
        if (trackObj.audio && trackObj.video) {
          console.log("🎬 BEFORE creating MediaStream:");
          console.log("  Audio track:", {
            kind: trackObj.audio.kind,
            id: trackObj.audio.id,
            enabled: trackObj.audio.enabled,
            readyState: trackObj.audio.readyState,
            muted: trackObj.audio.muted,
          });
          console.log("  Video track:", {
            kind: trackObj.video.kind,
            id: trackObj.video.id,
            enabled: trackObj.video.enabled,
            readyState: trackObj.video.readyState,
            muted: trackObj.video.muted,
          });

          const stream = new MediaStream([trackObj.audio, trackObj.video]);

          console.log("🎬 AFTER creating MediaStream:");
          console.log("  Stream ID:", stream.id);
          console.log(
            "  Stream tracks:",
            stream.getTracks().map((t) => ({
              kind: t.kind,
              id: t.id,
              enabled: t.enabled,
              readyState: t.readyState,
            }))
          );

          setRemoteStreams((prev) => [...prev, { id: peerId, stream }]);

          // Clean up pending tracks
          pendingTracksRef.current.delete(peerId);
        }
      }
    );
  }

  /* ============================
     CONTROLS
     ============================ */
  function toggleMute() {
    const track = localStreamRef.current.getAudioTracks()[0];
    track.enabled = !track.enabled;
    setIsMuted(!track.enabled);
  }

  function toggleCamera() {
    const track = localStreamRef.current.getVideoTracks()[0];
    track.enabled = !track.enabled;
    setIsCameraOff(!track.enabled);
  }

  function sendMessage() {
    if (!chatInput.trim()) return;

    const message = {
      id: Date.now(),
      senderId: socketRef.current.id,
      senderName: userName,
      message: chatInput,
      timestamp: new Date().toLocaleTimeString(),
      isOwn: true,
    };

    setMessages((prev) => [...prev, message]);
    socketRef.current.emit("chat-message", {
      message: chatInput,
      senderName: userName,
      timestamp: new Date().toLocaleTimeString(),
    });
    setChatInput("");
  }

  function leaveMeeting() {
    // Stop screen share if active
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((t) => t.stop());
    }

    socketRef.current.emit("leave-room");
    socketRef.current.disconnect();
    navigate("/");
  }

  async function toggleScreenShare() {
    try {
      if (isScreenSharing) {
        // Stop screen sharing
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach((t) => t.stop());
          screenStreamRef.current = null;
        }

        if (screenProducerRef.current) {
          await screenProducerRef.current.close();
          screenProducerRef.current = null;
        }

        setIsScreenSharing(false);
        socketRef.current.emit("screen-share-stopped");
        console.log("🛑 Screen share stopped");
      } else {
        // Start screen sharing
        try {
          const screenStream = await navigator.mediaDevices.getDisplayMedia({
            video: { cursor: "always" },
            audio: false,
          });

          screenStreamRef.current = screenStream;

          // Notify others that we're starting screen share
          socketRef.current.emit("screen-share-started", {
            peerId: socketRef.current.id,
          });

          // Get the video track and produce it
          const screenTrack = screenStream.getVideoTracks()[0];

          // SET FLAG BEFORE PRODUCE so the flag is true when produce event fires
          isProducingScreenRef.current = true;

          const producer = await sendTransportRef.current.produce({
            track: screenTrack,
          });

          screenProducerRef.current = producer;
          setIsScreenSharing(true);

          console.log(
            "📺 Screen sharing started, producer:",
            producer.id.substring(0, 8)
          );

          // Listen for when screen share is stopped (user clicks stop in browser)
          screenTrack.onended = () => {
            setIsScreenSharing(false);
            screenProducerRef.current?.close();
            screenProducerRef.current = null;
            socketRef.current.emit("screen-share-stopped");
          };
        } catch (error) {
          if (error.name === "NotAllowedError") {
            console.log("Screen share cancelled by user");
          } else {
            console.error("❌ Error starting screen share:", error);
          }
        }
      }
    } catch (error) {
      console.error("❌ Error toggling screen share:", error);
    }
  }

  /* ============================
     UI
     ============================ */
  return (
    <div className="meeting-container">
      {/* Header */}
      <div className="meeting-header">
        <h2 className="meeting-title">
          📹 Meeting: {roomId} ({participantCount})
        </h2>
      </div>

      {/* ✅ FULLSCREEN SCREEN SHARE VIEW - ALWAYS MOUNTED */}
      <div
        className="fullscreen-screen-container"
        style={{
          display:
            remoteScreenStreams.length > 0 && fullscreenMode === "screen"
              ? "flex"
              : "none",
        }}
      >
        {/* Toggle Button */}
        <button
          onClick={() => setFullscreenMode("meeting")}
          className="toggle-view-btn show-meeting"
        >
          👥 Show Meeting
        </button>

        {/* Full Screen Share - ALL MOUNTED */}
        {remoteScreenStreams.map((screen) => (
          <div
            key={`fullscreen-${screen.peerId}`}
            className="fullscreen-screen-wrapper"
          >
            <ScreenShare stream={screen.stream} peerId={screen.peerId} />
            <div className="fullscreen-screen-label">
              📺 {screen.peerId?.substring(0, 6)} is sharing
            </div>
          </div>
        ))}
      </div>

      {/* ✅ NORMAL MEETING VIEW - ALWAYS MOUNTED */}
      <div
        className="meeting-layout"
        style={{
          display:
            remoteScreenStreams.length === 0 || fullscreenMode === "meeting"
              ? "flex"
              : "none",
        }}
      >
        {/* Video section */}
        <div className="video-section">
          {/* Screen share display (takes priority) - ALWAYS MOUNTED */}
          <div
            className="screen-share-container"
            style={{
              display: remoteScreenStreams.length > 0 ? "block" : "none",
            }}
          >
            {/* Toggle Button for fullscreen */}
            <button
              onClick={() => setFullscreenMode("screen")}
              className="toggle-view-btn fullscreen"
            >
              ⛶ Fullscreen
            </button>

            {/* All screen shares mounted */}
            {remoteScreenStreams.map((screen) => (
              <div key={`normal-${screen.peerId}`} className="screen-wrapper">
                <ScreenShare stream={screen.stream} peerId={screen.peerId} />
                <div className="screen-label">
                  📺 Participant {screen.peerId?.substring(0, 6)} sharing
                </div>
              </div>
            ))}
          </div>

          {/* Video grid */}
          <div
            className={`video-grid ${
              remoteScreenStreams.length > 0 ? "screen-active" : "normal"
            }`}
          >
            {/* Local video */}
            <div className="video-card">
              <video
                ref={localVideoRef}
                muted
                playsInline
                className="video-element"
                style={{ width: "100%", height: "100%" }}
              />
              <div className="video-label">You</div>
              {isMuted && <div className="badge muted">Muted</div>}
              {isCameraOff && <div className="badge camera-off">Off</div>}
              {isScreenSharing && <div className="badge sharing">Sharing</div>}
            </div>

            {/* Remote videos - ALL MOUNTED */}
            {remoteStreams.map(({ id, stream }) => (
              <div key={id} className="video-card">
                <RemoteVideo stream={stream} peerId={id} />
                <div className="video-label">Participant</div>
              </div>
            ))}
          </div>
        </div>

        {/* Chat panel */}
        <div
          className="chat-panel"
          style={{ display: showChat ? "flex" : "none" }}
        >
          <div className="chat-header">
            <h3 className="chat-title">💬 Chat</h3>
            <button onClick={() => setShowChat(false)} className="close-btn">
              ✕
            </button>
          </div>

          {/* Messages */}
          <div className="messages-container">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`message ${msg.isOwn ? "own" : "other"}`}
              >
                <div className="message-sender">{msg.senderName}</div>
                <div className="message-text">{msg.message}</div>
                <div className="message-time">{msg.timestamp}</div>
              </div>
            ))}
          </div>

          {/* Chat input */}
          <div className="chat-input">
            <input
              type="text"
              placeholder="Type a message..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              className="input-field"
            />
            <button onClick={sendMessage} className="send-btn">
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Controls */}
      <Controls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        isScreenSharing={isScreenSharing}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        toggleScreenShare={toggleScreenShare}
        toggleChat={() => {
          console.log("🎯 Chat button clicked! Current showChat:", showChat);
          setShowChat(!showChat);
        }}
        showChat={showChat}
        leaveMeeting={leaveMeeting}
      />
    </div>
  );
}

// ✅ Separate component for proper ref management
function RemoteVideo({ stream, peerId }) {
  const videoRef = useRef(null);
  const playAttemptRef = useRef(0);
  const currentStreamIdRef = useRef(null); // ✅ Track current stream to prevent duplicates

  useEffect(() => {
    if (!videoRef.current || !stream) {
      console.log("❌ RemoteVideo: Missing videoRef or stream");
      return;
    }

    // ✅ Prevent duplicate stream assignment
    if (currentStreamIdRef.current === stream.id) {
      console.log(
        `⏭️ RemoteVideo: Stream ${stream.id.substring(0, 8)} already assigned`
      );
      return;
    }

    console.log("🔧 RemoteVideo: Assigning stream:", {
      peerId,
      streamId: stream.id,
      tracks: stream.getTracks().map((t) => ({
        kind: t.kind,
        id: t.id,
        enabled: t.enabled,
        readyState: t.readyState,
      })),
    });

    currentStreamIdRef.current = stream.id;
    playAttemptRef.current = 0;
    const maxAttempts = 5;

    const assignAndPlay = () => {
      if (!videoRef.current) return;

      playAttemptRef.current++;
      console.log(
        `🎬 RemoteVideo: Attempt ${playAttemptRef.current}/${maxAttempts}`
      );

      // Assign stream (keep previous if available to maintain continuity)
      if (
        !videoRef.current.srcObject ||
        videoRef.current.srcObject !== stream
      ) {
        videoRef.current.srcObject = stream;
        console.log(`📹 RemoteVideo: Stream assigned to video element`);
      }

      // Attempt to play
      setTimeout(() => {
        if (!videoRef.current) return;

        const tracks = stream.getTracks();
        if (tracks.length === 0) {
          console.error("❌ RemoteVideo: No tracks in stream");
          return;
        }

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("✅ RemoteVideo: Playing successfully");
              playAttemptRef.current = maxAttempts; // Stop retry attempts
            })
            .catch((err) => {
              console.warn(
                `⚠️ RemoteVideo: Play failed (${err.name}): ${err.message}`
              );

              // Retry if we haven't exceeded max attempts
              if (playAttemptRef.current < maxAttempts) {
                const backoffDelay = Math.min(
                  100 * playAttemptRef.current,
                  500
                );
                console.log(`🔄 RemoteVideo: Retrying in ${backoffDelay}ms...`);
                setTimeout(assignAndPlay, backoffDelay);
              }
            });
        }
      }, 50);
    };

    // Start assignment and play
    assignAndPlay();
  }, [stream, peerId]);

  return (
    <video
      ref={videoRef}
      playsInline
      muted={false}
      className="remote-video"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

// ✅ Screen share component
function ScreenShare({ stream, peerId }) {
  const videoRef = useRef(null);
  const playAttemptRef = useRef(0);
  const currentStreamIdRef = useRef(null); // ✅ Track current stream to prevent duplicates

  useEffect(() => {
    if (!videoRef.current || !stream) {
      console.log("❌ ScreenShare: Missing videoRef or stream");
      return;
    }

    // ✅ Prevent duplicate stream assignment
    if (currentStreamIdRef.current === stream.id) {
      console.log(
        `⏭️ ScreenShare: Stream ${stream.id.substring(0, 8)} already assigned`
      );
      return;
    }

    console.log("📺 ScreenShare: Assigning stream:", {
      peerId,
      streamId: stream.id,
      tracks: stream.getTracks().length,
    });

    currentStreamIdRef.current = stream.id;
    playAttemptRef.current = 0;
    const maxAttempts = 5;

    const assignAndPlay = () => {
      if (!videoRef.current) return;

      playAttemptRef.current++;
      console.log(
        `🎬 ScreenShare: Attempt ${playAttemptRef.current}/${maxAttempts}`
      );

      // Assign stream (keep previous if available to maintain continuity)
      if (
        !videoRef.current.srcObject ||
        videoRef.current.srcObject !== stream
      ) {
        videoRef.current.srcObject = stream;
        console.log(`📹 ScreenShare: Stream assigned to video element`);
      }

      // Attempt to play
      setTimeout(() => {
        if (!videoRef.current) return;

        const tracks = stream.getTracks();
        if (tracks.length === 0) {
          console.error("❌ ScreenShare: No tracks in stream");
          return;
        }

        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise
            .then(() => {
              console.log("✅ ScreenShare: Playing successfully");
              playAttemptRef.current = maxAttempts;
            })
            .catch((err) => {
              console.warn(
                `⚠️ ScreenShare: Play failed (${err.name}): ${err.message}`
              );

              if (playAttemptRef.current < maxAttempts) {
                const backoffDelay = Math.min(
                  100 * playAttemptRef.current,
                  500
                );
                console.log(`🔄 ScreenShare: Retrying in ${backoffDelay}ms...`);
                setTimeout(assignAndPlay, backoffDelay);
              }
            });
        }
      }, 50);
    };

    assignAndPlay();
  }, [stream, peerId]);

  return (
    <video
      ref={videoRef}
      playsInline
      muted={true}
      style={{
        width: "100%",
        height: "100%",
        objectFit: "contain",
      }}
    />
  );
}
