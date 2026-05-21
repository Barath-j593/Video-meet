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
9. [Troubleshooting]

---

## Demo Accounts

Use these credentials to test the application:

| Role | Email | Password |
|------|-------|----------|
| **Admin** | `admin@videomeet.com` | ` ` |
| **Teacher (Host)** | `teacher@videomeet.com` | `Teacher@123` |
| **Student (Participant)** | `student@videomeet.com` | `Student@123` |

> **Note:** Run `node seed.js` in the server folder to create these accounts automatically.

---

... (content truncated for brevity)