import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import * as mediasoupClient from "mediasoup-client";
import Controls from "../components/Controls";

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
  const consumedProducersRef = useRef(new Set()); // ✅ prevent duplicates
  const remoteVideoRefs = useRef(new Map()); // ✅ track remote video elements
  const pendingTracksRef = useRef(new Map()); // ✅ collect audio/video tracks by producerId

  /* ---------- State ---------- */
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);

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
      localVideoRef.current.srcObject = stream;

      socket.emit("join-room", roomId);
    }

    start();

    /* 🔥 Debug: Log all socket events */
    socket.onAny((event, ...args) => {
      if (event !== "connect" && event !== "disconnect") {
        console.log(`📡 Socket event received: ${event}`, args);
      }
    });

    /* 🔥 IMPORTANT: listen FIRST */
    socket.on("new-producer", async ({ producerId, peerId, kind }) => {
      console.log(
        `🆕 new-producer event: ${producerId?.substring(
          0,
          8
        )} (${kind}) from peer ${peerId?.substring(0, 8)}`
      );
      if (consumedProducersRef.current.has(producerId)) {
        console.log(
          `⏭️ Already consuming ${producerId?.substring(0, 8)}, skipping`
        );
        return;
      }
      console.log(`✅ Will consume ${producerId?.substring(0, 8)}`);
      await consumeProducer(producerId, peerId);
    });

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

      // Stop all consumers for this peer
      pendingTracksRef.current.delete(peerId);
    });

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
          console.log(`🎤 Send transport produce event for ${kind}`);
          socket.emit(
            "produce",
            {
              transportId: transport.id,
              kind,
              rtpParameters,
            },
            ({ id }) => {
              console.log(`✅ Producer created on server for ${kind}: ${id}`);
              callback({ id });
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
  async function consumeProducer(producerId, peerId) {
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
          )} (${kind}) from peer ${peerId?.substring(0, 8)}`
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

  function leaveMeeting() {
    socketRef.current.emit("leave-room");
    socketRef.current.disconnect();
    navigate("/");
  }

  /* ============================
     UI
     ============================ */
  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>Meeting ID: {roomId}</h2>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 20,
          justifyContent: "center",
        }}
      >
        <video ref={localVideoRef} autoPlay muted width="280" />

        {remoteStreams.map(({ id, stream }) => (
          <RemoteVideo key={id} stream={stream} />
        ))}
      </div>

      <Controls
        isMuted={isMuted}
        isCameraOff={isCameraOff}
        toggleMute={toggleMute}
        toggleCamera={toggleCamera}
        leaveMeeting={leaveMeeting}
      />
    </div>
  );
}

// ✅ Separate component for proper ref management
function RemoteVideo({ stream }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (!videoRef.current || !stream) return;

    console.log("🔧 Assigning stream to video element:", {
      streamId: stream.id,
      tracks: stream.getTracks().map((t) => ({
        kind: t.kind,
        id: t.id,
        enabled: t.enabled,
        readyState: t.readyState,
        muted: t.muted,
      })),
    });

    // Check if video track exists and is enabled
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) {
      console.error("❌ No video tracks in stream!");
      return;
    }

    const videoTrack = videoTracks[0];
    if (videoTrack.readyState === "ended") {
      console.error("❌ Video track is ended!");
      return;
    }

    if (!videoTrack.enabled) {
      console.warn("⚠️ Video track is disabled, enabling it");
      videoTrack.enabled = true;
    }

    videoRef.current.srcObject = stream;
    console.log("✅ srcObject assigned, calling play()");

    // Delay the play call slightly to avoid race condition
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play().catch((err) => {
          console.error("❌ Error playing video:", err);
        });
      }
    }, 100);

    // Monitor track state changes
    const checkTrackState = setInterval(() => {
      const vt = stream.getVideoTracks()[0];
      if (vt) {
        console.log("📊 Video track state:", {
          enabled: vt.enabled,
          readyState: vt.readyState,
          muted: vt.muted,
        });
      }
    }, 2000);

    return () => clearInterval(checkTrackState);
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={false}
      width="280"
      style={{
        border: "2px solid blue",
        marginTop: "10px",
        backgroundColor: "#000",
        objectFit: "cover",
      }}
      onLoadedMetadata={() => console.log("✅ Video metadata loaded")}
      onPlay={() => console.log("✅ Video started playing")}
      onPause={() => console.log("⏸️ Video paused")}
      onError={(e) => console.error("❌ Video error event:", e.target.error)}
    />
  );
}
