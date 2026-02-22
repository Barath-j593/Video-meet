# Video Meet - Authentication Module

## Overview

This document describes the authentication module implemented for the Video Meet application. The module provides secure JWT-based authentication for both HTTP APIs and WebSocket (Socket.IO) connections.

---

## Table of Contents

1. [Demo Accounts](#demo-accounts)
2. [Quick Start](#quick-start)
3. [How Authentication Works Internally](#how-authentication-works-internally)
4. [Server-Side Architecture](#server-side-architecture)
5. [Client-Side Architecture](#client-side-architecture)
6. [API Endpoints](#api-endpoints)
7. [Socket.IO Authentication](#socketio-authentication)
8. [Security Features](#security-features)
9. [Troubleshooting](#troubleshooting)

---

## Demo Accounts

Use these credentials to test the application:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@videomeet.com` | `Admin@123` |
| **Teacher (Host)** | `teacher@videomeet.com` | `Teacher@123` |
| **Student (Participant)** | `student@videomeet.com` | `Student@123` |

> **Note:** Run `node seed.js` in the server folder to create these accounts automatically.

---

## Quick Start

### Prerequisites

1. **MongoDB** must be running on `localhost:27017`
2. **Node.js** (v18+)

### Starting the Application

```bash
# Terminal 1 - Start MongoDB (if not running as service)
mongosh

# Terminal 2 - Start the Server
cd server
node index.js

# Terminal 3 - Start the Client
cd Client
npm run dev
```

### Access Points

- **Client**: http://localhost:5173 (or 5174 if 5173 is busy)
- **Server API**: http://localhost:4000/api
- **Health Check**: http://localhost:4000/api/health

---

## How Authentication Works Internally

### Complete Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        AUTHENTICATION FLOW DIAGRAM                          │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌──────────┐         ┌──────────┐         ┌──────────┐         ┌──────────┐
  │  Client  │         │  Server  │         │ MongoDB  │         │   JWT    │
  │ (React)  │         │(Express) │         │          │         │          │
  └────┬─────┘         └────┬─────┘         └────┬─────┘         └────┬─────┘
       │                    │                    │                    │
       │  1. POST /login    │                    │                    │
       │  {email, password} │                    │                    │
       │───────────────────>│                    │                    │
       │                    │                    │                    │
       │                    │ 2. Find user       │                    │
       │                    │    by email        │                    │
       │                    │───────────────────>│                    │
       │                    │                    │                    │
       │                    │ 3. Return user     │                    │
       │                    │    with password   │                    │
       │                    │<───────────────────│                    │
       │                    │                    │                    │
       │                    │ 4. Compare password│                    │
       │                    │    using bcrypt    │                    │
       │                    │                    │                    │
       │                    │ 5. Generate JWT    │                    │
       │                    │    with user data  │                    │
       │                    │───────────────────────────────────────>│
       │                    │                    │                    │
       │                    │ 6. Return signed   │                    │
       │                    │    JWT token       │                    │
       │                    │<───────────────────────────────────────│
       │                    │                    │                    │
       │ 7. Return token    │                    │                    │
       │    + user data     │                    │                    │
       │<───────────────────│                    │                    │
       │                    │                    │                    │
       │ 8. Store token in  │                    │                    │
       │    localStorage    │                    │                    │
       │                    │                    │                    │
```

### Step-by-Step Internal Process

#### 1. User Registration Process

```
User Input → Validation → Password Hashing → Database Storage → JWT Generation
```

**Detailed Flow:**

1. **Client sends registration data:**
   ```javascript
   // Client: authService.js
   const response = await api.post('/auth/register', {
     name: "John Doe",
     email: "john@example.com",
     password: "password123",
     role: "student"
   });
   ```

2. **Server validates input:**
   ```javascript
   // Server: authController.js
   if (!name || !email || !password) {
     return res.status(400).json({ message: 'Missing required fields' });
   }
   ```

3. **Check for existing user:**
   ```javascript
   // Server: authController.js
   const existingUser = await User.findOne({ email: email.toLowerCase() });
   if (existingUser) {
     return res.status(409).json({ message: 'User already exists' });
   }
   ```

4. **Password hashing (automatic via Mongoose middleware):**
   ```javascript
   // Server: models/User.js - Pre-save hook
   userSchema.pre('save', async function(next) {
     if (!this.isModified('password')) return next();
     
     // Generate salt with 12 rounds (higher = more secure but slower)
     const salt = await bcrypt.genSalt(12);
     
     // Hash password with salt
     this.password = await bcrypt.hash(this.password, salt);
     next();
   });
   ```

5. **Save user to database:**
   ```javascript
   const user = new User({ name, email, password, role });
   await user.save(); // Pre-save hook hashes password automatically
   ```

6. **Generate JWT token:**
   ```javascript
   // Server: authController.js
   const token = jwt.sign(
     {
       userId: user._id,
       name: user.name,
       email: user.email,
       role: user.role
     },
     process.env.JWT_SECRET,
     { expiresIn: '7d' }
   );
   ```

#### 2. User Login Process

```
Credentials → Find User → Compare Hash → Generate Token → Return to Client
```

**Detailed Flow:**

1. **Find user with password field:**
   ```javascript
   // Note: password field has `select: false` in schema
   // So we need to explicitly include it
   const user = await User.findOne({ email }).select('+password');
   ```

2. **Compare password using bcrypt:**
   ```javascript
   // Server: models/User.js - Instance method
   userSchema.methods.comparePassword = async function(candidatePassword) {
     // bcrypt.compare handles the salt extraction and comparison
     return await bcrypt.compare(candidatePassword, this.password);
   };
   
   // Server: authController.js
   const isValid = await user.comparePassword(password);
   ```

3. **How bcrypt.compare works internally:**
   ```
   Stored Hash: $2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G5tGhMp3sjDUW6
                 │  │  │                                              │
                 │  │  │  ┌────────────────────────────────────────────┘
                 │  │  │  │
                 │  │  └──┴─── 22-char Salt
                 │  └───────── Cost Factor (12 rounds)
                 └──────────── Algorithm Identifier (2a = bcrypt)
   
   Process:
   1. Extract salt from stored hash
   2. Hash input password with same salt
   3. Compare resulting hash with stored hash
   4. Return true/false
   ```

#### 3. Protected Route Access

```
Request + Token → Extract Token → Verify Signature → Decode Payload → Attach to Request
```

**Middleware Flow:**

```javascript
// Server: middleware/auth.js
const authenticateToken = (req, res, next) => {
  // 1. Extract token from header
  const authHeader = req.headers.authorization;
  // Header format: "Bearer eyJhbGciOiJIUzI1NiIs..."
  
  const token = authHeader.split(' ')[1];
  
  // 2. Verify token signature and expiration
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  // jwt.verify throws error if:
  // - Signature doesn't match (tampered)
  // - Token has expired
  // - Token format is invalid
  
  // 3. Attach user data to request
  req.user = {
    userId: decoded.userId,
    name: decoded.name,
    email: decoded.email,
    role: decoded.role
  };
  
  next(); // Continue to route handler
};
```

**JWT Signature Verification Explained:**

```
JWT Structure: HEADER.PAYLOAD.SIGNATURE

Header:    eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
           ↓ Base64 Decode
           {"alg":"HS256","typ":"JWT"}

Payload:   eyJ1c2VySWQiOiI2NGYuLi4iLCJuYW1lIjoiSm9obiJ9
           ↓ Base64 Decode
           {"userId":"64f...","name":"John","email":"john@example.com","role":"student"}

Signature: SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
           ↓ Generated by
           HMACSHA256(base64UrlEncode(header) + "." + base64UrlEncode(payload), secret)

Verification Process:
1. Server recalculates signature using secret
2. Compares with provided signature
3. If match → token is authentic
4. If no match → token was tampered with
```

#### 4. Socket.IO Authentication

```
Socket Connect → Send Token in Handshake → Verify Token → Allow/Reject Connection
```

**Client Connection:**

```javascript
// Client: Meeting.jsx
const socket = io("http://localhost:4000", {
  auth: {
    token: localStorage.getItem('token')
  }
});

// Handle auth errors
socket.on("connect_error", (err) => {
  if (err.message.includes("Authentication")) {
    // Redirect to login
    navigate("/login");
  }
});
```

**Server Middleware:**

```javascript
// Server: middleware/socketAuth.js
io.use((socket, next) => {
  // 1. Extract token from handshake
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    return next(new Error("Authentication required"));
  }
  
  try {
    // 2. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // 3. Attach user to socket instance
    socket.user = decoded;
    
    // 4. Allow connection
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});

// Now in any socket event handler:
socket.on("join-room", ({ roomId }) => {
  // socket.user is available!
  console.log(`${socket.user.name} joined ${roomId}`);
});
```

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (React)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                   │
│   │   Login     │     │AuthContext  │     │ localStorage│                   │
│   │   Page      │────>│  Provider   │────>│   token     │                   │
│   └─────────────┘     └──────┬──────┘     └──────┬──────┘                   │
│                              │                   │                           │
│                              │                   │                           │
│   ┌─────────────┐     ┌──────┴──────┐     ┌──────┴──────┐                   │
│   │ Protected   │<────│  useAuth()  │     │ authService │                   │
│   │   Route     │     │    Hook     │     │    API      │                   │
│   └─────────────┘     └─────────────┘     └──────┬──────┘                   │
│                                                  │                           │
└──────────────────────────────────────────────────┼───────────────────────────┘
                                                   │
                              HTTP Request         │  Socket.IO
                              + Bearer Token       │  + Auth Token
                                                   │
┌──────────────────────────────────────────────────┼───────────────────────────┐
│                              SERVER (Express)    │                           │
├──────────────────────────────────────────────────┼───────────────────────────┤
│                                                  │                           │
│   ┌─────────────┐     ┌─────────────┐     ┌──────┴──────┐                   │
│   │   Routes    │     │ Middleware  │     │  Socket.IO  │                   │
│   │  /api/auth  │────>│authenticateToken│  │  Middleware │                   │
│   └─────────────┘     └──────┬──────┘     └──────┬──────┘                   │
│                              │                   │                           │
│                              │ req.user          │ socket.user               │
│                              │                   │                           │
│   ┌─────────────┐     ┌──────┴──────┐     ┌──────┴──────┐                   │
│   │ Controllers │<────│   JWT       │     │  Room       │                   │
│   │  authCtrl   │     │  Verify     │     │  Handlers   │                   │
│   └──────┬──────┘     └─────────────┘     └─────────────┘                   │
│          │                                                                   │
└──────────┼───────────────────────────────────────────────────────────────────┘
           │
           │ Mongoose
           │
┌──────────┼───────────────────────────────────────────────────────────────────┐
│          │                   MONGODB                                         │
├──────────┼───────────────────────────────────────────────────────────────────┤
│   ┌──────┴──────┐                                                            │
│   │   Users     │                                                            │
│   │ Collection  │                                                            │
│   │             │                                                            │
│   │ {           │                                                            │
│   │   _id,      │                                                            │
│   │   name,     │                                                            │
│   │   email,    │                                                            │
│   │   password, │  ← Stored as bcrypt hash                                  │
│   │   role,     │                                                            │
│   │   isActive  │                                                            │
│   │ }           │                                                            │
│   └─────────────┘                                                            │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Token Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                      TOKEN LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────┘

  Login                Token Created              Token Expires
    │                       │                          │
    ▼                       ▼                          ▼
────●───────────────────────●──────────────────────────●──────────>
    │                       │                          │    Time
    │                       │                          │
    │   ┌───────────────────┴───────────────────┐     │
    │   │         TOKEN VALID PERIOD             │     │
    │   │            (7 days default)            │     │
    │   │                                        │     │
    │   │  ✓ Access protected routes            │     │
    │   │  ✓ Connect to Socket.IO               │     │
    │   │  ✓ Make API requests                  │     │
    │   └────────────────────────────────────────┘     │
    │                                                  │
    │                                            ┌─────┴─────┐
    │                                            │  TOKEN    │
    │                                            │  EXPIRED  │
    │                                            │           │
    │                                            │  ✗ 401    │
    │                                            │  errors   │
    │                                            │           │
    │                                            │  → Login  │
    │                                            │    again  │
    │                                            └───────────┘
```

---

## Server-Side Architecture

### Folder Structure

```
server/
├── .env                    # Environment variables
├── config/
│   ├── db.js              # MongoDB connection
│   └── jwt.js             # JWT configuration
├── controllers/
│   └── authController.js  # Auth logic (register, login, etc.)
├── middleware/
│   ├── auth.js            # HTTP JWT middleware
│   └── socketAuth.js      # Socket.IO JWT middleware
├── models/
│   └── User.js            # Mongoose User schema
├── routes/
│   ├── index.js           # Route aggregator
│   ├── auth.js            # Auth routes
│   └── meetings.js        # Protected meeting routes
└── index.js               # Main entry point
```

### Environment Variables (.env)

```env
# MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/video-meet

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Server Configuration
PORT=4000
NODE_ENV=development
```

---

## API Endpoints

### Authentication Routes

| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| `POST` | `/api/auth/register` | Register new user | Public |
| `POST` | `/api/auth/login` | Login & get token | Public |
| `GET` | `/api/auth/me` | Get user profile | Private |
| `GET` | `/api/auth/verify` | Verify token | Private |

### Example Requests

#### Register User

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "password": "password123",
    "role": "student"
  }'
```

#### Login

```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'
```

#### Response Format

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": "64f...",
      "name": "John Doe",
      "email": "john@example.com",
      "role": "student"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

---

## User Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `admin` | System administrator | Full access to all features |
| `teacher` | Meeting host | Can create and manage meetings |
| `student` | Participant | Can join meetings |

---

## Client-Side Architecture

### Folder Structure

```
Client/src/
├── context/
│   └── AuthContext.jsx       # React auth state management
├── services/
│   └── authService.js        # API calls for auth
├── components/
│   └── ProtectedRoute.jsx    # Route guard
└── pages/
    ├── Login.jsx             # Login page
    ├── Register.jsx          # Registration page
    ├── Home.jsx              # Dashboard (protected)
    └── Meeting.jsx           # Meeting room (protected)
```

### How AuthContext Works Internally

The AuthContext is a React Context that provides authentication state management across your entire application.

**Component Hierarchy:**
```
┌─────────────────────────────────────────────────────────────┐
│                        App.jsx                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AuthProvider                          ││
│  │        (Provides: user, login, logout, loading)         ││
│  │  ┌─────────────────────────────────────────────────────┐││
│  │  │                   BrowserRouter                      │││
│  │  │  ┌─────────────────────────────────────────────────┐│││
│  │  │  │                    Routes                        ││││
│  │  │  │  ┌────────────┐  ┌────────────┐  ┌────────────┐ ││││
│  │  │  │  │   Login    │  │ Protected  │  │  Meeting   │ ││││
│  │  │  │  │  (Public)  │  │   Route    │  │(Protected) │ ││││
│  │  │  │  └────────────┘  └─────┬──────┘  └────────────┘ ││││
│  │  │  │                        │                         ││││
│  │  │  │                  ┌─────┴──────┐                  ││││
│  │  │  │                  │    Home    │                  ││││
│  │  │  │                  │ (Protected)│                  ││││
│  │  │  │                  └────────────┘                  ││││
│  │  │  └─────────────────────────────────────────────────┘│││
│  │  └─────────────────────────────────────────────────────┘││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**AuthContext Internal State Machine:**
```
┌─────────────────────────────────────────────────────────────┐
│                    AUTH STATE MACHINE                        │
└─────────────────────────────────────────────────────────────┘

  Initial Load                Check localStorage
       │                            │
       ▼                            ▼
   ┌───────┐                   ┌─────────┐
   │Loading│──────────────────>│Has Token│
   │ true  │                   │   ?     │
   └───────┘                   └────┬────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
                ┌───────┐     ┌───────┐     ┌───────┐
                │  No   │     │  Yes  │     │Expired│
                │Token  │     │Valid  │     │ Token │
                └───┬───┘     └───┬───┘     └───┬───┘
                    │             │             │
                    ▼             ▼             ▼
                ┌───────┐     ┌───────┐     ┌───────┐
                │user:  │     │user:  │     │user:  │
                │ null  │     │{data} │     │ null  │
                │loading│     │loading│     │loading│
                │ false │     │ false │     │ false │
                └───────┘     └───────┘     └───────┘
```

**AuthContext Implementation Breakdown:**
```javascript
// context/AuthContext.jsx

export const AuthProvider = ({ children }) => {
  // State for user data and loading status
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);  // Start true!

  // On mount: Check for existing session
  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('token');
      
      if (token) {
        try {
          // Verify token is still valid with server
          const response = await authService.verifyToken();
          setUser(response.data.user);
        } catch (error) {
          // Token invalid/expired - clean up
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      
      setLoading(false);  // Always set loading false when done
    };
    
    initializeAuth();
  }, []);

  // Login function: Called by Login page
  const login = async (token, userData) => {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  };

  // Logout function: Clears all auth state
  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  // Provide state and functions to all children
  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
```

### Auth Flow

1. User visits the app → Redirected to `/login` if not authenticated
2. User logs in → JWT stored in `localStorage`
3. Protected routes check for valid token
4. Socket.IO connects with JWT in handshake
5. Logout clears token from storage

### Auth Flow Sequence Diagram

```
┌─────────┐          ┌─────────┐          ┌─────────┐          ┌─────────┐
│  User   │          │ Browser │          │  React  │          │ Server  │
└────┬────┘          └────┬────┘          └────┬────┘          └────┬────┘
     │                    │                    │                    │
     │ 1. Visit /meeting  │                    │                    │
     │───────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │ 2. Check localStorage                   │
     │                    │───────────────────>│                    │
     │                    │                    │                    │
     │                    │ 3. No token found  │                    │
     │                    │<───────────────────│                    │
     │                    │                    │                    │
     │ 4. Redirect to /login                   │                    │
     │<───────────────────│                    │                    │
     │                    │                    │                    │
     │ 5. Enter credentials                    │                    │
     │───────────────────>│                    │                    │
     │                    │                    │                    │
     │                    │ 6. POST /api/auth/login                 │
     │                    │───────────────────────────────────────>│
     │                    │                    │                    │
     │                    │ 7. Return JWT + user data               │
     │                    │<───────────────────────────────────────│
     │                    │                    │                    │
     │                    │ 8. Store in localStorage                │
     │                    │───────────────────>│                    │
     │                    │                    │                    │
     │                    │ 9. Update AuthContext                   │
     │                    │───────────────────>│                    │
     │                    │                    │                    │
     │ 10. Redirect to /meeting                │                    │
     │<───────────────────│                    │                    │
     │                    │                    │                    │
```

---

## Socket.IO Authentication

### Client Connection

```javascript
import { io } from "socket.io-client";
import { getToken } from "./services/authService";

const socket = io("http://localhost:4000", {
  auth: {
    token: getToken(), // JWT token
  },
});
```

### Server Middleware

```javascript
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  
  if (!token) {
    return next(new Error("Authentication required"));
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded; // Attach user to socket
    next();
  } catch (err) {
    next(new Error("Invalid token"));
  }
});
```

### Accessing User in Socket Events

```javascript
socket.on("join-room", ({ roomId }) => {
  // socket.user contains: { userId, name, email, role }
  console.log(`${socket.user.name} joined room ${roomId}`);
});
```

---

## User Model Schema

### Schema Definition

```javascript
const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    minlength: [2, 'Name must be at least 2 characters'],
    maxlength: [50, 'Name cannot exceed 50 characters'],
    trim: true  // Removes whitespace from both ends
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,      // Creates unique index
    lowercase: true,   // Converts to lowercase before saving
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false  // Never returned in queries by default
  },
  role: {
    type: String,
    enum: {
      values: ['admin', 'teacher', 'student'],
      message: '{VALUE} is not a valid role'
    },
    default: 'student'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date
  }
}, {
  timestamps: true  // Adds createdAt and updatedAt automatically
});
```

### Schema Middleware Explained

**Pre-save Hook (Password Hashing):**
```javascript
userSchema.pre('save', async function(next) {
  // 'this' refers to the document being saved
  
  // Only hash if password was modified (or new document)
  if (!this.isModified('password')) {
    return next();
  }
  
  // Generate salt with cost factor 12
  const salt = await bcrypt.genSalt(12);
  
  // Hash password with generated salt
  // Result: $2a$12$[22-char-salt][31-char-hash]
  this.password = await bcrypt.hash(this.password, salt);
  
  next();
});
```

**Why `isModified()` check?**
```
Without isModified() check:
────────────────────────────
1. User updates their name
2. user.save() triggers pre-save hook
3. Password gets rehashed (even though unchanged!)
4. Rehashing hashed password = invalid password
5. User can never login again!

With isModified() check:
────────────────────────────
1. User updates their name
2. isModified('password') returns false
3. Password stays unchanged
4. User can still login ✓
```

### Instance Methods

**comparePassword Method:**
```javascript
userSchema.methods.comparePassword = async function(candidatePassword) {
  // 'this' refers to the user document
  // 'this.password' is the hashed password from DB
  
  // bcrypt.compare:
  // 1. Extracts salt from stored hash
  // 2. Hashes candidatePassword with same salt
  // 3. Compares the two hashes
  // 4. Returns true/false
  
  return await bcrypt.compare(candidatePassword, this.password);
};

// Usage in controller:
const user = await User.findOne({ email }).select('+password');
const isValid = await user.comparePassword('userEnteredPassword');
```

### Schema Options & Indexes

```javascript
// Virtual for full name (not stored in DB)
userSchema.virtual('fullName').get(function() {
  return this.name;
});

// Indexes for query optimization
userSchema.index({ email: 1 });        // Fast email lookups
userSchema.index({ role: 1 });         // Query by role
userSchema.index({ createdAt: -1 });   // Latest users first

// Transform output when converting to JSON
userSchema.set('toJSON', {
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    delete ret.password;  // Never expose password
    return ret;
  }
});
```

### Document Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                    DOCUMENT SAVE LIFECYCLE                       │
└─────────────────────────────────────────────────────────────────┘

  new User(data)
       │
       ▼
  ┌─────────────────┐
  │ Validation      │ ← Schema validators run
  │ (required,      │   (minlength, enum, etc.)
  │  type checks)   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Pre-validate    │ ← Optional middleware
  │ Hooks           │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Pre-save        │ ← Password hashing happens here
  │ Hooks           │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ MongoDB         │ ← Document persisted
  │ Insert/Update   │
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ Post-save       │ ← Optional: logging, notifications
  │ Hooks           │
  └─────────────────┘
```

---

## JWT Token Structure

### Token Anatomy

A JWT consists of three Base64-encoded parts separated by dots:

```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NGYuLi4ifQ.SflKxwRJSMeKKF2QT4fwpMeJf
└──────────────────────────────────────┘└───────────────────────────┘└────────────────────────────┘
           HEADER                              PAYLOAD                       SIGNATURE
```

### Decoded Structure

**Header (Algorithm & Token Type):**
```json
{
  "alg": "HS256",  // HMAC-SHA256 algorithm
  "typ": "JWT"     // Token type
}
```

**Payload (Claims - User Data):**
```json
{
  "userId": "64f...",           // MongoDB ObjectId
  "name": "John Doe",           // Display name
  "email": "john@example.com",  // User email
  "role": "student",            // User role
  "iat": 1694000000,            // Issued At (Unix timestamp)
  "exp": 1694604800             // Expiration (Unix timestamp)
}
```

**Signature (Verification):**
```
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  your-secret-key
)
```

### How JWT Verification Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    JWT VERIFICATION PROCESS                      │
└─────────────────────────────────────────────────────────────────┘

  Incoming Token: HEADER.PAYLOAD.SIGNATURE
                     │       │        │
                     │       │        └──── Provided signature
                     │       │
                     │       └──────────── Contains user data
                     │
                     └──────────────────── Algorithm info

  Verification Steps:
  ──────────────────
  
  1. Split token into parts
     │
     ▼
  2. Decode header, extract algorithm
     │
     ▼
  3. Recalculate signature using:
     - header (from token)
     - payload (from token)  
     - secret (from server .env)
     │
     ▼
  4. Compare calculated vs provided signature
     │
     ├─── Match? ✓ Token is authentic
     │           Continue to check expiration
     │
     └─── No match? ✗ Token was tampered
                    Reject immediately

  5. Check expiration (exp claim)
     │
     ├─── exp > now? ✓ Token valid
     │
     └─── exp < now? ✗ Token expired
```

### Important Security Notes

```
┌─────────────────────────────────────────────────────────────────┐
│                    ⚠️  SECURITY WARNINGS                         │
└─────────────────────────────────────────────────────────────────┘

1. JWTs are NOT encrypted, only signed
   → Anyone can decode and read the payload
   → Never store sensitive data (SSN, credit cards)

2. Signature prevents tampering, not reading
   → If you modify the payload, signature becomes invalid
   → Server will reject modified tokens

3. Keep your JWT_SECRET truly secret
   → Don't commit to version control
   → Use strong random strings (32+ chars)
   → Rotate periodically in production

4. Token cannot be invalidated once issued
   → User changes password? Old tokens still work
   → Mitigation: short expiration + refresh tokens
```

---

## Security Features

- ✅ Password hashing with **bcrypt** (12 salt rounds)
- ✅ JWT-based **stateless authentication**
- ✅ Token expiration (configurable)
- ✅ Protected routes on client and server
- ✅ Socket.IO authentication via handshake
- ✅ Role-based authorization ready
- ✅ Email uniqueness validation
- ✅ Input validation and sanitization

### How Each Security Feature Works

#### 1. Password Hashing with Bcrypt

**Why bcrypt?**
- Designed specifically for password hashing (unlike MD5/SHA which are fast)
- Intentionally slow to prevent brute-force attacks
- Automatically handles salt generation and storage
- Adaptive: can increase work factor as hardware improves

**Salt Rounds Explained:**
```
Salt Rounds = 12 means 2^12 = 4,096 iterations

Time to hash (approximate):
- 10 rounds: ~100ms
- 12 rounds: ~250ms  ← Our choice (good balance)
- 14 rounds: ~1000ms
- 16 rounds: ~4000ms

Higher = More secure but slower logins
```

**How the hash is stored:**
```
$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.G5tGhMp3sjDUW6
 │  │  │                          │
 │  │  │                          └── Hash (31 chars)
 │  │  └── Salt (22 chars, Base64)
 │  └── Cost factor (12 rounds)
 └── Algorithm version (2a = bcrypt)
```

#### 2. JWT Stateless Authentication

**Why stateless?**
- No server-side session storage needed
- Scales horizontally (any server can verify)
- Reduces database queries
- Works across multiple domains/services

**Trade-offs:**
```
Stateless (JWT)                    Stateful (Sessions)
───────────────────────────────    ───────────────────────────────
✓ No session store needed          ✓ Easy to invalidate
✓ Works across services            ✓ Can track active sessions
✓ Scales horizontally              ✓ Smaller payload per request
✗ Can't invalidate easily          ✗ Requires session store
✗ Larger request payload           ✗ Tightly coupled
```

**Our JWT configuration:**
```javascript
{
  algorithm: 'HS256',        // HMAC with SHA-256
  expiresIn: '7d',          // Token lives for 7 days
  issuer: 'video-meet-api'  // Optional: identifies token source
}
```

#### 3. Token Expiration Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                    TOKEN SECURITY TIMELINE                  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Short-lived tokens (minutes-hours):                        │
│  ✓ More secure (less exposure window)                       │
│  ✗ Frequent re-authentication needed                        │
│                                                             │
│  Long-lived tokens (days-weeks):                            │
│  ✓ Better user experience                                   │
│  ✗ Higher risk if token stolen                              │
│                                                             │
│  We chose: 7 days                                           │
│  → Good balance for a video meeting app                     │
│  → Users don't need to login frequently                     │
│  → Consider refresh tokens for production                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 4. Protected Routes Architecture

**Client-Side Protection (React):**
```javascript
// ProtectedRoute.jsx - Route guard component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();
  
  if (loading) {
    return <LoadingSpinner />;  // Don't flash login page
  }
  
  if (!user) {
    return <Navigate to="/login" />;  // Redirect unauthenticated
  }
  
  return children;  // Render protected content
};
```

**Server-Side Protection (Express):**
```javascript
// Middleware chain for protected routes
app.get('/api/meetings/:id',
  authenticateToken,     // 1. Verify JWT exists and is valid
  authorizeRoles('admin', 'teacher'),  // 2. Check role permissions
  getMeeting             // 3. Execute if authorized
);
```

#### 5. Role-Based Access Control (RBAC)

```
┌─────────────────────────────────────────────────────────────┐
│                    PERMISSION MATRIX                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Action              │ Admin  │ Teacher │ Student          │
│  ────────────────────┼────────┼─────────┼─────────         │
│  View meetings       │   ✓    │    ✓    │    ✓             │
│  Join meetings       │   ✓    │    ✓    │    ✓             │
│  Create meetings     │   ✓    │    ✓    │    ✗             │
│  End any meeting     │   ✓    │    ✗    │    ✗             │
│  Manage users        │   ✓    │    ✗    │    ✗             │
│  System settings     │   ✓    │    ✗    │    ✗             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Implementation:**
```javascript
// middleware/auth.js
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }
    
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ 
        message: `Role '${req.user.role}' not authorized for this action`
      });
    }
    
    next();
  };
};
```

---

## Middleware Usage Examples

### Protect HTTP Routes

```javascript
const { authenticateToken, authorizeRoles } = require('./middleware/auth');

// Any authenticated user
router.get('/profile', authenticateToken, getProfile);

// Only teachers and admins
router.post('/create-meeting', 
  authenticateToken, 
  authorizeRoles('admin', 'teacher'), 
  createMeeting
);
```

### Access User in Route Handlers

```javascript
router.get('/profile', authenticateToken, (req, res) => {
  // req.user contains: { userId, name, email, role }
  res.json({ user: req.user });
});
```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "MongoDB connection error" | Ensure MongoDB is running: `mongod` |
| "Token expired" | Login again to get new token |
| "Invalid token" | Clear localStorage and login again |
| Socket connection fails | Check if server is running on port 4000 |

### Debugging Guide

#### 1. Debugging Login Issues

**Check if server is receiving requests:**
```javascript
// Add to authController.js login function
console.log('Login attempt:', { email, timestamp: new Date() });
```

**Test login via cURL:**
```bash
curl -X POST http://localhost:4000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@videomeet.com","password":"Admin@123"}' \
  -v  # -v for verbose output
```

**Common login failures:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    LOGIN TROUBLESHOOTING TREE                    │
└─────────────────────────────────────────────────────────────────┘

  Login Failed?
       │
       ├─── 400 Bad Request
       │    └── Missing email or password field
       │
       ├─── 401 Unauthorized
       │    ├── User not found (check email spelling)
       │    └── Password incorrect (check caps lock)
       │
       ├─── 500 Internal Server Error
       │    ├── MongoDB not connected
       │    ├── JWT_SECRET not set in .env
       │    └── Check server console for stack trace
       │
       └─── No Response
            ├── Server not running
            ├── Wrong port (should be 4000)
            └── CORS blocking request
```

#### 2. Debugging Token Issues

**Decode a JWT token (without verifying):**
```javascript
// In browser console
const token = localStorage.getItem('token');
const [header, payload, signature] = token.split('.');
console.log('Header:', JSON.parse(atob(header)));
console.log('Payload:', JSON.parse(atob(payload)));
// Check exp field: new Date(payload.exp * 1000)
```

**Check token expiration:**
```javascript
const token = localStorage.getItem('token');
const payload = JSON.parse(atob(token.split('.')[1]));
const expiresAt = new Date(payload.exp * 1000);
const isExpired = expiresAt < new Date();
console.log('Expires:', expiresAt, 'Expired:', isExpired);
```

#### 3. Debugging Socket.IO Connection

**Client-side debugging:**
```javascript
// Add to Meeting.jsx
socket.on("connect", () => {
  console.log("✅ Socket connected:", socket.id);
});

socket.on("connect_error", (err) => {
  console.error("❌ Socket error:", err.message);
});

socket.on("disconnect", (reason) => {
  console.log("🔌 Disconnected:", reason);
});
```

**Server-side debugging:**
```javascript
// Add to server/index.js
io.on("connection", (socket) => {
  console.log("📱 Client connected:", socket.id);
  console.log("👤 User:", socket.user?.name || "Anonymous");
});
```

#### 4. Database Debugging

**Check if users exist:**
```javascript
// In mongosh (MongoDB shell)
use video-meet
db.users.find().pretty()
db.users.countDocuments()
```

**Check if password was hashed:**
```javascript
// Password should start with $2a$ or $2b$ (bcrypt)
db.users.findOne({ email: "admin@videomeet.com" }, { password: 1 })
// Good: { password: "$2a$12$..." }
// Bad: { password: "Admin@123" } ← Not hashed!
```

### Clear Auth State

```javascript
// In browser console
localStorage.removeItem('token');
localStorage.removeItem('user');
location.reload();
```

### Network Debugging

**Using Browser DevTools:**
1. Open DevTools (F12)
2. Go to Network tab
3. Filter by "XHR" or "Fetch"
4. Look for `/api/auth/login` request
5. Check:
   - Status code
   - Request payload
   - Response body
   - Response headers

**Expected flow:**
```
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK TAB CHECKLIST                         │
└─────────────────────────────────────────────────────────────────┘

✓ Request URL: http://localhost:4000/api/auth/login
✓ Request Method: POST
✓ Content-Type: application/json
✓ Request Payload: {"email":"...","password":"..."}
✓ Status: 200 OK
✓ Response: {"success":true,"data":{"token":"...","user":{...}}}
```

### Environment Checklist

Before troubleshooting, verify:

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRE-FLIGHT CHECKLIST                          │
└─────────────────────────────────────────────────────────────────┘

□ MongoDB running?
  → Run: mongod --version
  
□ Server .env file exists?
  → Check: server/.env contains JWT_SECRET
  
□ Server running on port 4000?
  → Check: http://localhost:4000/api/health
  
□ Client running?
  → Check: http://localhost:5173
  
□ Demo users created?
  → Run: cd server && node seed.js
  
□ No port conflicts?
  → Windows: netstat -ano | findstr :4000
  → Linux/Mac: lsof -i :4000
```

---

## Future Enhancements

- [ ] Password reset via email
- [ ] OAuth (Google, GitHub)
- [ ] Refresh tokens
- [ ] Account email verification
- [ ] Rate limiting
- [ ] Session management
- [ ] Audit logging

---

## Advanced Concepts

### Error Handling Architecture

The authentication system uses a consistent error response format across all endpoints:

```javascript
// Success Response
{
  "success": true,
  "message": "Operation completed",
  "data": { /* relevant data */ }
}

// Error Response  
{
  "success": false,
  "message": "Human-readable error message",
  "error": {
    "code": "AUTH_INVALID_CREDENTIALS",
    "details": { /* additional info */ }
  }
}
```

**Error Codes Reference:**

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_MISSING_FIELDS` | 400 | Required fields not provided |
| `AUTH_INVALID_EMAIL` | 400 | Email format invalid |
| `AUTH_WEAK_PASSWORD` | 400 | Password doesn't meet requirements |
| `AUTH_USER_EXISTS` | 409 | Email already registered |
| `AUTH_INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `AUTH_TOKEN_MISSING` | 401 | No token provided |
| `AUTH_TOKEN_INVALID` | 401 | Token malformed or tampered |
| `AUTH_TOKEN_EXPIRED` | 401 | Token has expired |
| `AUTH_FORBIDDEN` | 403 | User lacks required role |

### Request/Response Flow with Error Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                    REQUEST PROCESSING PIPELINE                   │
└─────────────────────────────────────────────────────────────────┘

  Incoming Request
        │
        ▼
  ┌───────────────┐
  │   Express     │
  │   Router      │
  └───────┬───────┘
          │
          ▼
  ┌───────────────┐     ┌─────────────────┐
  │ Auth          │ NO  │ 401 Unauthorized│
  │ Middleware    │────>│ {success: false}│
  └───────┬───────┘     └─────────────────┘
          │ YES (Token valid)
          ▼
  ┌───────────────┐     ┌─────────────────┐
  │ Role          │ NO  │ 403 Forbidden   │
  │ Middleware    │────>│ {success: false}│
  └───────┬───────┘     └─────────────────┘
          │ YES (Role allowed)
          ▼
  ┌───────────────┐     ┌─────────────────┐
  │ Controller    │ERROR│ 500 Server Error│
  │ Logic         │────>│ {success: false}│
  └───────┬───────┘     └─────────────────┘
          │ SUCCESS
          ▼
  ┌───────────────┐
  │ 200 OK        │
  │{success: true}│
  └───────────────┘
```

### Token Storage Strategies

**Where tokens can be stored:**

| Storage | Pros | Cons | Security Level |
|---------|------|------|----------------|
| **localStorage** | Persistent, simple API | XSS vulnerable | Medium |
| **sessionStorage** | Cleared on tab close | XSS vulnerable, not persistent | Medium |
| **HttpOnly Cookie** | Not accessible via JS | CSRF vulnerable, requires same origin | High |
| **Memory (state)** | Not in storage at all | Lost on refresh | High |

**Our choice: localStorage**
- Good balance for a demo/development app
- Easy to implement and debug
- Works across tabs

**Production recommendation:**
```javascript
// For production, consider HttpOnly cookies:
// Server sets cookie:
res.cookie('token', token, {
  httpOnly: true,    // Not accessible via JavaScript
  secure: true,      // Only sent over HTTPS
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000  // 7 days
});
```

### MongoDB Indexing for Performance

The User model includes indexes for optimal query performance:

```javascript
// Automatic index on email (unique: true creates index)
userSchema.index({ email: 1 }, { unique: true });

// Compound index for common queries
userSchema.index({ role: 1, isActive: 1 });

// Index for last login queries (admin dashboards)
userSchema.index({ lastLogin: -1 });
```

**Why indexes matter for auth:**
```
Without index on email:
  Login query: O(n) - scans entire collection
  1 million users = 1 million comparisons

With index on email:  
  Login query: O(log n) - B-tree lookup
  1 million users = ~20 comparisons
```

### Password Validation Rules

```javascript
// Server-side validation in authController.js
const validatePassword = (password) => {
  const rules = {
    minLength: password.length >= 6,
    // Add more rules for production:
    // hasUppercase: /[A-Z]/.test(password),
    // hasLowercase: /[a-z]/.test(password),
    // hasNumber: /[0-9]/.test(password),
    // hasSpecial: /[!@#$%^&*]/.test(password)
  };
  
  return Object.values(rules).every(Boolean);
};
```

### Memory & Performance Considerations

```
┌─────────────────────────────────────────────────────────────────┐
│                    JWT SIZE CONSIDERATIONS                       │
└─────────────────────────────────────────────────────────────────┘

JWT Payload Size Impacts:
─────────────────────────

1. Every API request includes the token
   → Larger token = more bandwidth per request

2. localStorage has ~5MB limit
   → Not an issue for auth tokens

3. Cookie header limit is ~4KB
   → Keep payload minimal if using cookies

Our token payload (~200 bytes encoded):
{
  "userId": "507f1f77bcf86cd799439011",  // 24 chars
  "name": "John Doe",                     // ~10-50 chars
  "email": "john@example.com",            // ~20-50 chars  
  "role": "student",                      // ~7-10 chars
  "iat": 1694000000,                      // timestamp
  "exp": 1694604800                       // timestamp
}

What NOT to include in JWT:
─────────────────────────
✗ Full user profile
✗ Permissions array
✗ Sensitive data
✗ Binary data
```

---

## API Testing with cURL

### Create Demo Users

```bash
# Admin
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Admin User","email":"admin@videomeet.com","password":"Admin@123","role":"admin"}'

# Teacher
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Teacher User","email":"teacher@videomeet.com","password":"Teacher@123","role":"teacher"}'

# Student
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Student User","email":"student@videomeet.com","password":"Student@123","role":"student"}'
```

---

## Glossary

| Term | Definition |
|------|------------|
| **JWT** | JSON Web Token - A compact, URL-safe token format for securely transmitting claims between parties |
| **Bearer Token** | A type of access token sent in the Authorization header as "Bearer <token>" |
| **bcrypt** | A password hashing algorithm designed to be computationally expensive to resist brute-force attacks |
| **Salt** | Random data added to a password before hashing to ensure identical passwords produce different hashes |
| **Salt Rounds** | The cost factor for bcrypt; higher values mean more computation and better security |
| **Stateless Auth** | Authentication where the server doesn't store session data; each request contains all needed info |
| **Middleware** | Functions that run between receiving a request and sending a response |
| **RBAC** | Role-Based Access Control - Restricting access based on user roles |
| **CORS** | Cross-Origin Resource Sharing - Security feature controlling cross-domain requests |
| **XSS** | Cross-Site Scripting - Attack where malicious scripts are injected into web pages |
| **CSRF** | Cross-Site Request Forgery - Attack that tricks users into submitting unwanted requests |
| **Mongoose** | MongoDB ODM (Object Document Mapper) for Node.js |
| **Schema** | Definition of document structure, types, and validation in Mongoose |
| **Pre-save Hook** | Mongoose middleware that runs before a document is saved to the database |
| **Instance Method** | A method available on individual Mongoose document instances |
| **HttpOnly Cookie** | A cookie that cannot be accessed via JavaScript, enhancing security |

---

*Last updated: February 18, 2026*
