import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, LoopState, ServerMessage } from '@app/shared';
const LOOP_LENGTH = 32;

const loop: LoopState = {
  state: {
    drums: [],
    bass: [],
    synth_low: [],
    synth_high: [],
  },
  revision: 0,
};

const port = Number(process.env.PORT ?? 8080);
const httpServer = createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/state') {
    const payload: LoopState = {
      state: loop.state,
      revision: loop.revision,
    };
    response.writeHead(200, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    });
    response.end(JSON.stringify(payload));
    return;
  }

  response.writeHead(404);
  response.end();
});
const webSocketServer = new WebSocketServer({ server: httpServer });

const send = (socket: WebSocket, message: ServerMessage): void => {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(message));
  };
};

const broadcast = (message: ServerMessage): void => {
  console.log('Broadcasting message to all clients:', message);
  for (const client of webSocketServer.clients) {
    send(client, message);
  };
};

const isLoopAction = (action: unknown): action is ClientMessage => {
  return (
    typeof action === 'object' &&
    action !== null &&
    'type' in action &&
    (action.type === 'add' || action.type === 'remove') &&
    'track' in action &&
    typeof action.track === 'string' &&
    (action.track === 'drums' || action.track === 'bass' || action.track === 'synth_low' || action.track === 'synth_high') &&
    ((action.type === 'add' &&
      'sound' in action &&
      typeof action.sound === 'object' &&
      action.sound !== null &&
      'id' in action.sound &&
      typeof action.sound.id === 'string' &&
      'note' in action.sound &&
      typeof action.sound.note === 'string' &&
      'start' in action.sound &&
      typeof action.sound.start === 'number' &&
      Number.isInteger(action.sound.start) &&
      'duration' in action.sound &&
      typeof action.sound.duration === 'number' &&
      Number.isInteger(action.sound.duration)) ||
      (action.type === 'remove' && 'soundId' in action && typeof action.soundId === 'string'))
  );
};

const isClientMessage = (value: unknown): value is ClientMessage => {
  return (
    typeof value === 'object' &&
    value !== null &&
    'action' in value &&
    isLoopAction(value.action)
  );
};

const isValidLoopAction = (action: ClientMessage['action']): boolean => {
  if (action.type === 'add') {
    const { track, sound } = action;
    const trackSounds = loop.state[track];

    if (
      sound.duration < 1 ||
      sound.start < 0 ||
      !Number.isInteger(sound.start) ||
      !Number.isInteger(sound.duration) ||
      sound.id.length < 1 ||
      sound.start + sound.duration > LOOP_LENGTH ||
      trackSounds.some((s) => s.id === sound.id) ||
      trackSounds.some((s) =>
        sound.note === s.note &&
        sound.start < s.start + s.duration &&
        s.start < sound.start + sound.duration,
      )
    ) {
      return false;
    }
  }
  return true;
};

webSocketServer.on('connection', (socket) => {
  console.log('Client connected');

  send(socket, {
    type: 'connected',
    payload: { message: 'WebSocket connection established' },
  });

  socket.on('message', (data) => {
    let message: unknown;

    try {
      message = JSON.parse(data.toString());
    } catch {
      send(socket, {
        type: 'error',
        payload: { message: 'Messages must contain valid JSON' },
      });
      return;
    }

    if (!isClientMessage(message)) {
      send(socket, {
        type: 'error',
        payload: { message: 'Messages must include a valid loop action' },
      });
      return;
    }

    console.log('Received message:', message);

    // Validate action, reject if invalid, otherwise update loop state and broadcast the change
    const { action } = message;
    if (!isValidLoopAction(action)) {
      send(socket, {
        type: 'reject',
        action: action,
      });
      return;
    }

    if (action.type === 'add') {
      const { track, sound } = action;

      loop.state[track].push(sound);
    } 
    else if (action.type === 'remove') {
      const { track, soundId } = action;

      loop.state[track] = loop.state[track].filter((s) => s.id !== soundId);
    }

    loop.revision += 1;

    broadcast({
      type: 'update',
      revision: loop.revision,
      action,
    });
  });

  socket.on('close', () => {
    console.log('Client disconnected');
  });

  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

httpServer.listen(port, () => {
  console.log(`HTTP and WebSocket server listening on http://localhost:${port}`);
});

httpServer.on('error', (error) => {
  console.error('WebSocket server error:', error);
});
