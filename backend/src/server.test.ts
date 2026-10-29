import { strict as assert } from 'node:assert';
import { once } from 'node:events';
import { test } from 'node:test';
import WebSocket from 'ws';

import { createAppServer } from './server.js';

const addSound = {
  type: 'add' as const,
  track: 'drums' as const,
  sound: { id: 'sound-1', note: 'C3', start: 0, duration: 2 },
};

const nextMessage = (socket: WebSocket) => once(socket, 'message')
  .then(([data]) => JSON.parse(data.toString()));

test('serves state and synchronizes valid, rejected, and idempotent actions', async () => {
  const { httpServer: server, webSocketServer } = createAppServer();
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  let socket: WebSocket | undefined;

  try {
    const initialResponse = await fetch(`${baseUrl}/state`);
    assert.equal(initialResponse.status, 200);
    assert.deepEqual(await initialResponse.json(), {
      state: { drums: [], bass: [], synth_low: [], synth_high: [] },
      revision: 0,
    });

    socket = new WebSocket(baseUrl.replace('http', 'ws'));
    const connectedMessage = nextMessage(socket);
    await once(socket, 'open');
    assert.deepEqual(await connectedMessage, {
      type: 'connected',
      payload: { message: 'WebSocket connection established' },
    });

    socket.send(JSON.stringify({ action: addSound }));
    assert.deepEqual(await nextMessage(socket), {
      type: 'update',
      revision: 1,
      action: addSound,
    });

    const overlappingAdd = {
      ...addSound,
      sound: { ...addSound.sound, id: 'sound-2', duration: 1 },
    };
    socket.send(JSON.stringify({ action: overlappingAdd }));
    assert.deepEqual(await nextMessage(socket), {
      type: 'reject',
      action: overlappingAdd,
    });

    const remove = {
      type: 'remove' as const,
      track: 'drums' as const,
      soundId: addSound.sound.id,
    };
    socket.send(JSON.stringify({ action: remove }));
    assert.deepEqual((await nextMessage(socket)).revision, 2);

    socket.send(JSON.stringify({ action: remove }));
    assert.deepEqual((await nextMessage(socket)).revision, 3);

    const finalResponse = await fetch(`${baseUrl}/state`);
    const finalState = await finalResponse.json();
    assert.deepEqual(finalState.state.drums, []);
    assert.equal(finalState.revision, 3);

  } finally {
    socket?.terminate();
    await Promise.all([
      new Promise<void>((resolve, reject) => {
        server.close((error?: Error) => error ? reject(error) : resolve());
      }),
      new Promise<void>((resolve, reject) => {
        webSocketServer.close((error?: Error) => error ? reject(error) : resolve());
      }),
    ]);
  }
});
