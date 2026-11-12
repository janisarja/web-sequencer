# Real-Time Collaborative Musical Playground

A web based sequencer where anyone can edit a loop of notes and drum samples, collaborating and building on the ideas of others. The inspiration for this projects was, what if there was an [r/place](https://en.wikipedia.org/wiki/R/place) style website, but where instead of pixels on a canvas, it was notes in a sequencer and everyone had free hands to do anything.

## Tools & Technology

- React frontend
- Node backend
- Websockets for broadcasting updates and http connection to get initial state and recover from local conflicts.
- SQLite for persisting the loop state when server sleeps.

## How It Works

- Frontend separates audio playback (Tone.js), loop state handling and user input handling
- The initial loop state is fetched with an http GET request on initial render
- A websocket connection sends local edits to the backend and the backend broadcasts accepted changes to all clients
- Edits are validated and added optimistically to the local loop state
- If an edit is rejected by the server (conflicting edits, overlapping notes, incorrect format), a rejection messages is sent back to the client and the local edit is reversed
- If a client receives edits with non-sequential revision order numbers (websocket messages arriving out of sync or missing), it re-fetches the current state
- The loop is stored in a database when the server is shut down

## Prerequisites

Node.js and npm

## How to Run

Clone the repo and install dependencies
```
git clone https://github.com/janisarja/web-sequencer.git
cd web-sequencer
npm install
```

Set environment variables in .env files for backend and frontend directories

Backend:
```
PORT=8080
DATABASE_PATH=./data/loop.db
CORS_ORIGIN=http://localhost:5173
```

Frontend:
```
VITE_API_URL=http://localhost:8080
VITE_WEBSOCKET_URL=ws://localhost:8080
```

Run the backend
```
cd backend
npm run dev
```

In another terminal, run the frontend
```
cd frontend
npm run dev
```
