# Video Meet Application - Features & Logic

## 📋 Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Technology Stack](#technology-stack)
4. [Core Architecture](#core-architecture)
5. [Feature Implementation Details](#feature-implementation-details)
6. [Data Flow](#data-flow)

---

## Overview

**Video Meet** is a real-time video conferencing application built with modern web technologies. It enables multiple users to join meetings, share screens, exchange messages, and collaborate seamlessly in high-quality video sessions.

**Key Achievements:**

- ✅ Real-time video/audio streaming
- ✅ Screen sharing with fullscreen toggle
- ✅ Group and private chat
- ✅ Modern neon dark theme UI
- ✅ Responsive and robust video playback
- ✅ Automatic fullscreen exit when screen share stops

---

## Features

### 1. **User Identification**

**Description:** Users enter their name before joining a meeting to be identified in the video conference.

**Logic:**

- User enters name on Home page
- Name is stored in `sessionStorage` for persistence across page navigation
- Name is sent to server when joining a room
- Name appears in chat messages and participant labels
- Falls back to "Guest" if no name is provided

**Technology:**

- React `useState` hook for form state
- Browser `sessionStorage` API for client-side persistence
- Socket.io for sending username to server

---

### 2. **Modern Neon Dark Theme**

**Description:** Innovative dark theme with cyan/magenta/green neon accents for an engaging UI.

**Logic:**

- CSS custom properties (variables) for consistent theming
- Gradient backgrounds with blur effects
- Neon glow effects using `text-shadow`, `box-shadow`, and CSS filters
- Dark background (#0a0e27) with neon accent colors
- Responsive design that adapts to all screen sizes

**Technology:**

- CSS3 Custom Properties (variables)
- CSS3 Gradients
- CSS3 Backdrop Filters (blur effects)
- Flexbox for layout
- CSS3 Box-shadows for neon glow effects

**Color Palette:**

- Primary: `#00d9ff` (Cyan)
- Secondary: `#ff006e` (Magenta)
- Accent: `#00ff88` (Green)
- Dark Background: `#0a0e27`

---

### 3. **Real-Time Video/Audio Conferencing**

**Description:** Multiple users can join a meeting room and see/hear each other through WebRTC peer-to-peer connections.

**Logic:**

- User gets their local media stream using `getUserMedia` API
- Local stream is produced to the SFU (Selective Forwarding Unit) server
- Remote peers' streams are consumed from the server
- Audio and video tracks are combined into a single MediaStream for display
- Video elements maintain proper stream assignment with retry logic

**Technology:**

- **WebRTC:** For peer-to-peer real-time media communication
- **mediasoup:** Selective Forwarding Unit for efficient media routing
- **mediasoup-client:** JavaScript library for WebRTC transport management
- **Browser APIs:**
  - `getUserMedia()` - Access camera and microphone
  - `MediaStream API` - Combine audio/video tracks
  - HTML5 `<video>` element with `srcObject` property

**Key Implementation Details:**

- Two transports: Send transport (for producing) and Recv transport (for consuming)
- DTLS parameters for secure connections
- RTP capabilities negotiation for codec compatibility
- Consumer pause/resume for bandwidth management

---

### 4. **Screen Sharing**

**Description:** Users can share their screen with other meeting participants.

**Logic:**

1. User clicks "Share Screen" button
2. Browser's `getDisplayMedia` API prompts user to select screen/window
3. Screen capture stream is obtained
4. Screen video track is produced to the server with `isScreenShare` flag
5. Server broadcasts new screen producer to other peers
6. Remote peers consume the screen share stream separately from camera
7. Screen share displays in a dedicated container above regular video grid
8. When screen share stops, stream is closed and UI updates automatically

**Technology:**

- `getDisplayMedia()` API - For screen capture
- Screen track state management
- Consumer tracking for cleanup (`screenConsumersRef`)
- Separate stream container for screen displays
- Server-side screen producer identification via flags

**Key Features:**

- Cursor always visible during screen share
- No audio from screen capture
- Automatic cleanup when user stops sharing
- Remote screen share cleanup on screen-share-stopped event

---

### 5. **Fullscreen Screen Share**

**Description:** Users can toggle between normal view and fullscreen view of the shared screen.

**Logic:**

1. In normal view, screen share appears in a smaller container above video grid
2. User clicks "Fullscreen" button to enter fullscreen mode
3. `fullscreenMode` state changes to "screen"
4. CSS uses `display: none/flex` to hide normal view and show fullscreen container
5. Video elements remain mounted (not unmounted) to prevent stream interruption
6. Fullscreen overlay uses `position: absolute` with `z-index: 100`
7. When screen share stops (remote peer stops), app auto-exits fullscreen
8. User can manually exit fullscreen by clicking "Show Meeting" button

**Technology:**

- React state management (`fullscreenMode` state)
- CSS `position: absolute` for fullscreen overlay
- CSS `display` property for visibility control
- CSS `z-index` for layering
- HTML5 fullscreen styling with proper aspect ratios

**Video Element Mounting Strategy:**

- All video elements stay mounted in DOM tree
- Visibility controlled via inline styles `display: block/none`
- Prevents component unmount/remount which would interrupt streams
- Ensures smooth video playback during view transitions

---

### 6. **Group Chat**

**Description:** All meeting participants can send and receive messages in a shared chat room.

**Logic:**

1. User types message in chat input field
2. On Enter key or button click, message is sent via socket
3. Message includes: text, sender name, sender ID, and timestamp
4. Server broadcasts message to all peers in the room
5. All peers receive the message and display it in chat panel
6. Messages show with sender name and timestamp
7. User's own messages are highlighted differently (CSS class)

**Technology:**

- Socket.io for real-time message broadcasting
- React state for message storage (`messages` state)
- Event handlers: `chat-message` socket event
- CSS for message styling and differentiation

**Server Implementation:**

```javascript
socket.on("chat-message", ({ message, senderName, timestamp }) => {
  io.to(roomId).emit("chat-message", {
    senderId: socket.id,
    senderName,
    message,
    timestamp,
  });
});
```

---

### 7. **Private Chat (Future Enhancement)**

**Description:** Architecture prepared for one-to-one private messaging between specific participants.

**Logic:**

- Similar to group chat but targets specific peer ID
- Server can route messages to specific socket instead of broadcast
- Private message storage separate from group messages
- UI can show both group and private conversations

**Technology:**

- Socket.io `socket.to(peerId).emit()` for targeted messaging
- Separate state management for private messages
- Modal or separate panel for private chat UI

---

### 8. **Participant Count Tracking**

**Description:** Display real-time count of active participants in the meeting.

**Logic:**

1. Server tracks participants in `room.peers` Map
2. When user joins, `participant-joined` event sent with new count
3. When user leaves, `participant-left` event sent with updated count
4. Client updates `participantCount` state
5. Count displays in meeting header

**Technology:**

- Server-side peer management in `mediasoup/rooms.js`
- Socket.io events for count updates
- React state for UI updates

---

### 9. **Mute/Unmute Audio**

**Description:** Users can mute and unmute their microphone.

**Logic:**

1. Get audio track from local stream
2. Toggle `track.enabled` property
3. Update UI badge to show muted state
4. Remote peers immediately see/hear the change
5. State tracked in `isMuted` boolean

**Technology:**

- MediaStream API `getTracks()` method
- Track `enabled` property for audio control
- React state for UI reflection

---

### 10. **Camera On/Off**

**Description:** Users can turn their camera on and off.

**Logic:**

1. Get video track from local stream
2. Toggle `track.enabled` property
3. Update UI badge to show camera-off state
4. Local video pauses when camera is off
5. State tracked in `isCameraOff` boolean

**Technology:**

- MediaStream API `getTracks()` method
- Track `enabled` property for video control
- React state for UI reflection

---

### 11. **Robust Video Playback & Recovery**

**Description:** Intelligent video playback retry logic that handles interruptions and ensures smooth playback during view transitions.

**Logic:**

1. When video element receives a stream, attempt to play
2. If play fails (AbortError, NotAllowedError), retry with exponential backoff
3. Retry delays: 100ms, 200ms, 300ms, 400ms, 500ms (up to 5 attempts)
4. Track current stream ID to prevent duplicate assignments
5. Don't reset stream on retry, only attempt play() call
6. Separate retry logic for fullscreen view changes

**Technology:**

- Promise-based play() API with `.catch()` error handling
- `setTimeout` for retry delays with exponential backoff
- `useRef` hooks to track play attempts and stream IDs
- Conditional logic to prevent duplicate stream assignments

**Why This Works:**

- AbortError occurs when play() is interrupted by another play() call
- By not resetting srcObject, we maintain stream continuity
- Exponential backoff prevents resource exhaustion
- Tracking prevents infinite duplicate assignments

---

### 12. **Always-Mounted Video Elements**

**Description:** Video elements remain in DOM tree during view transitions to prevent playback interruption.

**Logic:**

1. Instead of conditional rendering (if/else in JSX), use CSS `display: none/flex`
2. All views rendered simultaneously
3. Visibility controlled by inline `style={{ display: ... }}`
4. Video elements never unmount, only visibility changes
5. Stream assignments remain stable across view transitions

**Benefits:**

- ✅ Prevents component unmount/remount lifecycle
- ✅ Avoids interrupting active video playback
- ✅ Maintains audio continuity
- ✅ Smooth transitions between views
- ✅ No black video during fullscreen toggle

**Technology:**

- React inline styles with conditional logic
- CSS display property for visibility
- Refs for direct video element access
- Memoization to prevent unnecessary re-renders

---

### 13. **Peer Disconnect Handling**

**Description:** Gracefully handle when a participant leaves the meeting.

**Logic:**

1. Server sends `peer-left` event when socket disconnects
2. Client removes peer's streams from `remoteStreams` state
3. Remove peer's screen shares from `remoteScreenStreams`
4. Close any open consumers for that peer
5. Update participant count
6. If in fullscreen of peer's screen and they leave, auto-exit fullscreen
7. Clean up refs and pending track data

**Technology:**

- Socket.io `disconnect` event handling
- Server-side peer removal in `mediasoup/rooms.js`
- Consumer tracking and cleanup
- Refs for consumer management

---

### 14. **Screen Share Stopped Event Handling**

**Description:** Properly clean up resources when a peer stops screen sharing.

**Logic:**

1. User stops sharing via browser UI or button
2. Client emits `screen-share-stopped` socket event
3. Server broadcasts event to other peers with peerId
4. Remote peers receive event
5. Close the screen share consumer for that peer
6. Remove screen stream from `remoteScreenStreams`
7. If viewing fullscreen of that screen, auto-exit fullscreen
8. Regular video continues to play

**Technology:**

- Socket.io custom events
- Server broadcast with peer identification
- Consumer closing and cleanup
- State filtering to remove screen stream

---

## Technology Stack

### **Frontend**

| Technology             | Purpose                                          |
| ---------------------- | ------------------------------------------------ |
| **React 18**           | Component-based UI framework                     |
| **React Router**       | Client-side routing (Home → Meeting)             |
| **Socket.io (Client)** | Real-time bidirectional communication            |
| **mediasoup-client**   | WebRTC transport and consumer management         |
| **HTML5 Video API**    | Video element and playback                       |
| **CSS3**               | Styling, gradients, animations, backdrop filters |
| **Browser APIs**       | getUserMedia, getDisplayMedia, sessionStorage    |

### **Backend**

| Technology             | Purpose                                        |
| ---------------------- | ---------------------------------------------- |
| **Node.js**            | JavaScript runtime                             |
| **Express**            | HTTP server framework                          |
| **Socket.io (Server)** | Real-time communication and event broadcasting |
| **mediasoup**          | Selective Forwarding Unit for media routing    |
| **HTTP/HTTPS**         | Transport layer                                |

### **Protocol & Standards**

| Protocol   | Purpose                                    |
| ---------- | ------------------------------------------ |
| **WebRTC** | Real-time peer-to-peer media communication |
| **DTLS**   | Secure media transport                     |
| **SRTP**   | Encrypted media streaming                  |
| **RTP**    | Real-time transport protocol for media     |

---

## Core Architecture

### **Client Architecture**

```
┌─────────────────────────────────────────┐
│         React Application               │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Home Page                           │
│  │  └─ User name input & storage        │
│  │                                      │
│  └─ Meeting Page (Main Component)       │
│     ├─ Video Rendering                 │
│     │  ├─ Local Video Element           │
│     │  ├─ Remote Video Components       │
│     │  └─ Screen Share Component        │
│     ├─ UI Controls                      │
│     │  ├─ Mute/Unmute                   │
│     │  ├─ Camera On/Off                 │
│     │  ├─ Screen Share Toggle           │
│     │  ├─ Fullscreen Toggle             │
│     │  ├─ Chat Toggle                   │
│     │  └─ Leave Meeting                 │
│     ├─ Chat Panel                       │
│     ├─ WebRTC Layer                     │
│     │  ├─ Send Transport                │
│     │  ├─ Recv Transport                │
│     │  └─ Consumers/Producers           │
│     └─ Socket.io Events                 │
│        ├─ room events                   │
│        ├─ chat events                   │
│        └─ screen-share events           │
│                                         │
└─────────────────────────────────────────┘
         ↕ Socket.io Events
    ↕ WebRTC Media Streams

┌─────────────────────────────────────────┐
│        Backend SFU Server               │
├─────────────────────────────────────────┤
│                                         │
│  ┌─ Socket.io Server                   │
│  │  ├─ Connection management           │
│  │  ├─ Event routing                   │
│  │  └─ Broadcast coordination          │
│  │                                      │
│  ├─ Mediasoup Worker                    │
│  │  └─ Media routing engine            │
│  │                                      │
│  └─ Room Management                     │
│     ├─ Peer tracking                    │
│     ├─ Producer/Consumer lifecycle      │
│     └─ Transport management             │
│                                         │
└─────────────────────────────────────────┘
```

### **WebRTC Connection Flow**

```
1. Join Room
   └─ Socket: "join-room" → Server creates peer entry

2. Get Router RTP Capabilities
   └─ Socket: "router-rtp-capabilities" ← Server sends capabilities

3. Create Send Transport
   └─ Socket: "create-transport" → Server creates send transport

4. Produce Media (camera + mic)
   └─ Socket: "produce" → Server creates producers

5. Create Recv Transport
   └─ Socket: "create-transport" → Server creates recv transport

6. Get Existing Producers
   └─ Socket: "get-producers" → Server returns list of producers

7. Consume Producers
   └─ Loop: For each producer → "consume" → "resume-consumer"

8. New Producer Notification
   ← Socket: "new-producer" event → Consume new producer

9. Disconnect
   └─ Socket: "leave-room" → Server cleans up peer
```

---

## Feature Implementation Details

### **Video Playback Recovery System**

**Problem Solved:**
When switching between fullscreen and normal views, video elements would be remounted, interrupting the play() promise and causing AbortError. This resulted in black video until the user refreshed or waited for recovery.

**Solution Implemented:**

1. **Keep Elements Mounted**

   - Use CSS `display` property instead of conditional rendering
   - Video elements never unmount, only visibility changes
   - Stream assignments remain stable

2. **Smart Retry Logic**

   ```javascript
   // Try to play
   const playPromise = videoRef.current.play();
   playPromise
     .then(() => console.log("✅ Playing"))
     .catch((err) => {
       if (retries < maxRetries) {
         // Retry with exponential backoff
         setTimeout(retryPlay, backoffDelay);
       }
     });
   ```

3. **Stream Tracking**
   ```javascript
   const currentStreamIdRef = useRef(null);
   // Only assign stream if it's different from current
   if (currentStreamIdRef.current !== stream.id) {
     videoRef.current.srcObject = stream;
   }
   ```

### **Screen Share Lifecycle**

**Starting Screen Share:**

```
User clicks "Share Screen"
    ↓
getDisplayMedia() prompts user to select screen
    ↓
Get screen video track
    ↓
Set isProducingScreenRef = true
    ↓
Produce screen track to server
    ↓
Server marks producer with isScreenShare flag
    ↓
Server broadcasts to other peers via "new-producer"
    ↓
Remote peers consume screen stream
    ↓
Display in screen-share-container
```

**Stopping Screen Share:**

```
User clicks "Stop Share" OR closes display media prompt
    ↓
screenTrack.onended handler triggered
    ↓
Emit "screen-share-stopped" socket event
    ↓
Server broadcasts to other peers
    ↓
Remote peers close screen consumer
    ↓
Remove from remoteScreenStreams state
    ↓
If fullscreen → auto-exit to meeting view
    ↓
Regular video continues playing
```

---

## Data Flow

### **Chat Message Flow**

```
User A types message
    ↓
"Chat" button or Enter key
    ↓
Socket emit "chat-message" with:
  - message text
  - senderName (from sessionStorage)
  - timestamp
    ↓
Server receives and broadcasts to room:
  io.to(roomId).emit("chat-message", {
    senderId,
    senderName,
    message,
    timestamp,
  })
    ↓
All peers (including User A) receive
    ↓
React setState adds message to messages array
    ↓
Component re-renders with new message
    ↓
Message displays with sender name and timestamp
    ↓
If message.isOwn → highlight as own message (CSS)
```

### **Video Stream Flow**

```
Local Camera
    ↓
getUserMedia(audio: true, video: true)
    ↓
localStream.getTracks()
    ↓
Produce each track:
  - audio track → produce
  - video track → produce
    ↓
Server creates producers
    ↓
Broadcast to other peers: "new-producer" event
    ↓
Each remote peer consumes:
  - Get consumer from server
  - Create receiver
  - Resume consumer
    ↓
Combine audio & video tracks into MediaStream
    ↓
Assign to video element: videoRef.srcObject = stream
    ↓
Call videoRef.play()
    ↓
Display in video grid
```

---

## Performance Considerations

1. **Video Element Mounting Strategy**

   - Keeps DOM tree stable → fewer re-renders
   - Prevents stream interruption during layout changes
   - Better memory management (no constant create/destroy)

2. **Consumer Tracking**

   - `screenConsumersRef` prevents duplicate consumer creation
   - Proper cleanup when peer disconnects
   - Prevents resource leaks

3. **Stream Assignment Deduplication**

   - `currentStreamIdRef` tracks assigned streams
   - Prevents unnecessary srcObject reassignments
   - Reduces browser reflow/repaint cycles

4. **Exponential Backoff Retries**
   - Prevents hammering the browser with play() attempts
   - Reduces CPU and memory pressure
   - Better error recovery with increasing delays

---

## Future Enhancements

1. **Recording Feature** - Record meetings with audio/video
2. **Virtual Backgrounds** - Replace background during video calls
3. **Private Chat** - One-to-one messaging between participants
4. **Chat Encryption** - End-to-end encryption for privacy
5. **Meeting Scheduling** - Pre-scheduled meetings with reminders
6. **Participant Permissions** - Admin controls for chat, screen share, etc.
7. **Hand Raise Feature** - Request to speak in large meetings
8. **Breakout Rooms** - Split participants into smaller groups
9. **Meeting Transcription** - Real-time speech-to-text
10. **Analytics Dashboard** - Meeting stats and performance metrics

---

## Conclusion

**Video Meet** demonstrates modern web technologies working together to create a robust real-time communication platform. The implementation prioritizes:

✅ **User Experience** - Smooth video playback, responsive UI  
✅ **Reliability** - Automatic recovery from errors, graceful degradation  
✅ **Scalability** - SFU architecture supports many participants  
✅ **Code Quality** - Component-based architecture, proper separation of concerns  
✅ **Modern Standards** - WebRTC, HTML5, CSS3, ES6+

The codebase is well-structured for future enhancements and can easily accommodate new features like recording, encryption, and advanced controls.
