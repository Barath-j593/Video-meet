# Video Meet

Professional WebRTC-based video conferencing application with group chat, private messaging, screen sharing, and a modern neon dark theme.

## Table of Contents

- [Features](#features)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Development](#development)
- [Testing](#testing)
- [Project structure](#project-structure)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

- Multi-party video conferencing (WebRTC via mediasoup)
- Group chat and 1-on-1 private messaging
- Screen sharing with immediate visibility across tabs
- Neon dark theme with responsive layout
- JWT-based authentication for API and Socket.IO

- ML-powered features and experiments:
	- Job predictor / resume-to-job matching model (training artifacts in `mlruns/`)
	- Resume scoring & suggestions, and simple job-recommendation utilities
	- Example notebooks and scripts for training/evaluation included
	- Models and metadata stored under `mlruns/` and example notebooks at the repo root

## Prerequisites

- Node.js (v16+ recommended)
- npm or yarn
- MongoDB (if using the included auth/seed scripts)

## Quick Start

Start the server and client in separate terminals.

```powershell
# Server
cd server
npm install
npm start

# Client
cd Client
npm install
npm run dev
```

Open the app at: http://localhost:5173

## Development

- The client React app lives in `Client/`.
- The server API and Socket.IO logic live in `server/`.
- Environment variables for the server are read from `.env` in `server/` (create one with `PORT`, `MONGODB_URI`, `JWT_SECRET`).

## Testing

Basic manual test steps are available in the docs: see `docs/TEST_GUIDE.sh` for a quick checklist.

## Project structure

Top-level layout (important folders):

- `Client/` — React frontend
- `server/` — Node.js + Express + Socket.IO backend
- `docs/` — Project documentation and guides

## Documentation

See detailed docs in the `docs/` folder:

- [README_IMPLEMENTATION.md](docs/README_IMPLEMENTATION.md)
- [COMPLETE_SUMMARY.md](docs/COMPLETE_SUMMARY.md)
- [AUTHENTICATION.md](docs/AUTHENTICATION.md)
- [IMPLEMENTATION_CHECKLIST.md](docs/IMPLEMENTATION_CHECKLIST.md)
- [UPDATES.md](docs/UPDATES.md)
- [VISUAL_GUIDE.md](docs/VISUAL_GUIDE.md)
- [COLOR_REFERENCE.css](docs/COLOR_REFERENCE.css)
- [TEST_GUIDE.sh](docs/TEST_GUIDE.sh)

