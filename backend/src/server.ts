import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { WebSocketServer, type WebSocket } from 'ws';
import type { ClientMessage, LoopState, ServerMessage } from '@app/shared';

const LOOP_LENGTH = 32;

const createInitialLoop = (): LoopState => ({
  state: {
    drums: [],
    bass: [],
    synth_low: [],
    synth_high: [],
  },
  revision: 0,
});

const isLoopAction = (action: unknown): action is ClientMessage['action'] => (
  typeof action === 'object' &&
  action !== null &&
  'type' in action &&
  (action.type === 'add' || action.type === 'remove') &&
  'track' in action &&
  (action.track === 'drums' ||
    action.track === 'bass' ||
    action.track === 'synth_low' ||
    action.track === 'synth_high') &&
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
    (action.type === 'remove' &&
      'soundId' in action &&
      typeof action.soundId === 'string'))
);

const isClientMessage = (value: unknown): value is ClientMessage => (
  typeof value === 'object' &&
  value !== null &&
  'action' in value &&
  isLoopAction(value.action)
);

type AppServer = {
  httpServer: ReturnType<typeof createServer>;
  webSocketServer: WebSocketServer;
  close: () => Promise<void>;
};

type AppServerOptions = {
  databasePath: string;
  corsOrigin: string;
};

export const createAppServer = ({ databasePath, corsOrigin }: AppServerOptions): AppServer => {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new Database(databasePath);
  database.pragma('journal_mode = WAL');
  database.exec(`
    CREATE TABLE IF NOT EXISTS loop_state (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      revision INTEGER NOT NULL,
      state TEXT NOT NULL
    )
  `);

  const storedState = database
    .prepare('SELECT revision, state FROM loop_state WHERE id = 1')
    .get() as { revision: number; state: string } | undefined;
  const loop: LoopState = storedState
    ? { revision: storedState.revision, state: JSON.parse(storedState.state) as LoopState['state'] }
    : createInitialLoop();
  const saveLoop = database.prepare(`
    INSERT INTO loop_state (id, revision, state)
    VALUES (1, @revision, @state)
    ON CONFLICT(id) DO UPDATE SET revision = @revision, state = @state
  `);
  if (!storedState) {
    saveLoop.run({ revision: loop.revision, state: JSON.stringify(loop.state) });
  }

  const httpServer = createServer((request, response) => {
    if (request.method === 'GET' && request.url === '/state') {
      response.writeHead(200, {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': corsOrigin,
      });
      response.end(JSON.stringify(loop));
      return;
    }

    response.writeHead(404);
    response.end();
  });
  const webSocketServer = new WebSocketServer({ server: httpServer });

  const send = (socket: WebSocket, message: ServerMessage): void => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  };

  const broadcast = (message: ServerMessage): void => {
    for (const client of webSocketServer.clients) {
      send(client, message);
    }
  };

  const isValidLoopAction = (action: ClientMessage['action']): boolean => {
    if (action.type === 'add') {
      const { track, sound } = action;
      const trackSounds = loop.state[track];

      return sound.duration >= 1 &&
        sound.start >= 0 &&
        Number.isInteger(sound.start) &&
        Number.isInteger(sound.duration) &&
        sound.id.length >= 1 &&
        sound.start + sound.duration <= LOOP_LENGTH &&
        !trackSounds.some((existing) => existing.id === sound.id) &&
        !trackSounds.some((existing) =>
          sound.note === existing.note &&
          sound.start < existing.start + existing.duration &&
          existing.start < sound.start + sound.duration,
        );
    }

    return true;
  };

  webSocketServer.on('connection', (socket) => {
    send(socket, {
      type: 'connected',
      payload: { message: 'WebSocket connection established' },
    });

    socket.on('message', (data) => {
      let message: unknown;

      console.log('Received message:', data.toString());

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

      const { action } = message;
      if (!isValidLoopAction(action)) {
        console.log('Rejected invalid action:', action);
        send(socket, { type: 'reject', action });
        return;
      }

      if (action.type === 'add') {
        loop.state[action.track].push(action.sound);
      } else {
        loop.state[action.track] = loop.state[action.track]
          .filter((sound) => sound.id !== action.soundId);
      }

      loop.revision += 1;
      saveLoop.run({ revision: loop.revision, state: JSON.stringify(loop.state) });
      console.log('Accepted action:', action, 'New revision:', loop.revision);
      broadcast({
        type: 'update',
        revision: loop.revision,
        action,
      });
    });
  });

  let closePromise: Promise<void> | undefined;
  const close = (): Promise<void> => {
    closePromise ??= (async () => {
      try {
        for (const client of webSocketServer.clients) {
          client.close(1001, 'Server shutting down');
        }

        await new Promise<void>((resolve, reject) => {
          webSocketServer.close((error) => error ? reject(error) : resolve());
        });
        await new Promise<void>((resolve, reject) => {
          httpServer.close((error) => error ? reject(error) : resolve());
        });
      } finally {
        database.close();
      }
    })();
    return closePromise;
  };

  return { httpServer, webSocketServer, close };
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const requiredEnvironment = (name: string): string => {
    const value = process.env[name];
    if (!value) {
      throw new Error(`Missing required backend environment variable: ${name}`);
    }
    return value;
  };
  const portValue = requiredEnvironment('PORT');
  const port = Number(portValue);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be an integer between 1 and 65535, got: ${portValue}`);
  }
  const { httpServer, close } = createAppServer({
    databasePath: requiredEnvironment('DATABASE_PATH'),
    corsOrigin: requiredEnvironment('CORS_ORIGIN'),
  });
  httpServer.listen(port, () => {
    console.log(`HTTP and WebSocket server listening on http://localhost:${port}`);
  });

  httpServer.on('error', (error) => {
    console.error('HTTP and WebSocket server error:', error);
  });

  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}, shutting down gracefully`);
    void close()
      .then(() => process.exit(0))
      .catch((error: unknown) => {
        console.error('Graceful shutdown failed:', error);
        process.exit(1);
      });
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));
}
