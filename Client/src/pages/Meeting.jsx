import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import Controls from "../components/Controls";

export default function Meeting() {
  const { roomId } = useParams();
  const navigate = useNavigate();

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const socketRef = useRef(null); // ✅ PER-PAGE SOCKET

  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [remoteStream, setRemoteStream] = useState(null);

  /* Attach remote stream to video */
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  /* Main WebRTC + Socket Logic */
  useEffect(() => {
    let mounted = true;

    socketRef.current = io("http://localhost:3000");
    const socket = socketRef.current;

    async function start() {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true
      });

      if (!mounted) return;

      localStreamRef.current = stream;
      localVideoRef.current.srcObject = stream;

      peerRef.current = new RTCPeerConnection({
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
      });

      stream.getTracks().forEach(track =>
        peerRef.current.addTrack(track, stream)
      );

      peerRef.current.ontrack = e => {
        setRemoteStream(e.streams[0]);
      };

      peerRef.current.onicecandidate = e => {
        if (e.candidate) {
          socket.emit("ice-candidate", {
            roomId,
            candidate: e.candidate
          });
        }
      };

      socket.emit("join-room", roomId);
    }

    start();

    socket.on("user-joined", async () => {
      const offer = await peerRef.current.createOffer();
      await peerRef.current.setLocalDescription(offer);
      socket.emit("offer", { roomId, offer });
    });

    socket.on("offer", async offer => {
      await peerRef.current.setRemoteDescription(offer);
      const answer = await peerRef.current.createAnswer();
      await peerRef.current.setLocalDescription(answer);
      socket.emit("answer", { roomId, answer });
    });

    socket.on("answer", async answer => {
      await peerRef.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async candidate => {
      await peerRef.current.addIceCandidate(candidate);
    });

    socket.on("user-left", () => {
      setRemoteStream(null);
      if (peerRef.current) {
        peerRef.current.close();
        peerRef.current = null;
      }
    });

    return () => {
      mounted = false;

      socket.emit("leave-room");
      socket.disconnect();

      if (peerRef.current) peerRef.current.close();

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, [roomId]);

  /* Controls */
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

  return (
    <div style={{ padding: 20, textAlign: "center" }}>
      <h2>Meeting ID: {roomId}</h2>

      <div style={{ display: "flex", gap: 20, justifyContent: "center" }}>
        <video ref={localVideoRef} autoPlay muted />
        {remoteStream && <video ref={remoteVideoRef} autoPlay />}
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


const styles = {
  page: {
    padding: "20px",
    textAlign: "center",
  },
  videos: {
    display: "flex",
    justifyContent: "center",
    gap: "20px",
    marginTop: "20px",
  },
};
