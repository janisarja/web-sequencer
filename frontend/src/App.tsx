import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import LoopReducer from './loopReducer';
import usePlayback from './usePlayback';
import PlayButton from './components/PlayButton';
import PianoRoll from './components/PianoRoll';

import type {
  ClientMessage,
  Loop,
  LoopAction,
  LoopState,
  ServerMessage,
  Track,
} from '@app/shared';
import type { PianoRollAction } from './types';

const initialLoop: Loop = {
  drums: [],
  bass: [],
  synth_low: [],
  synth_high: [],
};

const App = () => {
  const [loop, dispatch] = useReducer(LoopReducer, initialLoop);
  const revisionRef = useRef(0);
  const playback = usePlayback(loop);
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isReady, setIsReady] = useState(false);

  const fetchState = useCallback(async () => {
    const response = await fetch('http://localhost:8080/state');
    if (!response.ok) {
      throw new Error(`State request failed with status ${response.status}`);
    }

    const snapshot: LoopState = await response.json();
    dispatch({ type: 'replace', state: snapshot.state });
    revisionRef.current = snapshot.revision;
  }, []);

  const updateLoop = useCallback((action: LoopAction, serverRevision: number) => {
    // Ensure the revision is sequential, otherwise fetch the full loop state from the server
    const expectedRevision = revisionRef.current + 1;
    if (serverRevision < expectedRevision) {
      console.warn(`Received an old revision: expected ${expectedRevision}, got ${serverRevision}`);
      return;
    }
    else if (serverRevision !== expectedRevision) {
      console.warn(`Revision mismatch: expected ${expectedRevision}, got ${serverRevision}`);
      setIsReady(false);
      void fetchState().catch((error: unknown) => {
        console.error('Failed to synchronize loop state:', error);
      }).finally(() => {
        setIsReady(true);
      });
      return;
    }
    dispatch(action);
    revisionRef.current = serverRevision;
  }, [fetchState]);

  const rejectAction = (action: LoopAction) => {
    if (action.type !== 'add') return;
    const rejectAction: LoopAction = {
      type: 'remove',
      track: action.track,
      soundId: action.sound.id,
    };
    dispatch(rejectAction);
  };

  useEffect(() => {
    let disposed = false;
    let socket: WebSocket | null = null;

    const connect = async () => {
      try {
        await fetchState();
        if (disposed) return;

        socket = new WebSocket('ws://localhost:8080');
        setSocket(socket);
      } catch (error: unknown) {
        console.error('Failed to load loop state:', error);
        return;
      }

      socket.onopen = () => {
        console.log('WebSocket connected');
        setIsReady(true);
      };

      socket.onmessage = (event) => {
        const message: ServerMessage = JSON.parse(event.data);
        switch (message.type) {
          case 'update':
            updateLoop(message.action, message.revision);
            console.log('Loop updated:', message.action, 'Revision:', message.revision);
            break;

          case 'reject':
            rejectAction(message.action);
            console.warn('Action rejected:', message);
            break;

          case 'connected':
            console.log('Connected to server:', message.payload.message);
            break;

          case 'error':
            console.error('Server error:', message.payload.message);
            break;

          default:
            console.warn('Unknown message type:', message);
        }
      };

      socket.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      socket.onclose = () => {
        console.log('WebSocket disconnected');
        setIsReady(false);
      };
    };

    void connect();

    return () => {
      disposed = true;
      socket?.close();
      setSocket(null);
      setIsReady(false);
    };
  }, [fetchState, updateLoop]);

  const editTrack = (track: Track) => (action: PianoRollAction): void => {
    console.log(`Editing track ${track} with action`, action);

    const loopAction: LoopAction = { ...action, track };
    dispatch(loopAction);
    const message: ClientMessage = { action: loopAction };
    if (!isReady || socket?.readyState !== WebSocket.OPEN) return;
    socket.send(JSON.stringify(message));
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <PlayButton play={() => playback.isPlaying ? playback.stop() : playback.start()} />
      </header>
      <div className="track-list">
        <section className="track-card">
          <h2>Drums</h2>
          <PianoRoll trackName="drums" track={loop.drums} position={playback.position} editingEnabled={isReady} onChange={editTrack('drums')} />
        </section>
        <section className="track-card">
          <h2>Bass</h2>
          <PianoRoll trackName="bass" track={loop.bass} position={playback.position} editingEnabled={isReady} onChange={editTrack('bass')} />
        </section>
        <section className="track-card">
          <h2>Synth Low</h2>
          <PianoRoll trackName="synth_low" track={loop.synth_low} position={playback.position} editingEnabled={isReady} onChange={editTrack('synth_low')} />
        </section>
        <section className="track-card">
          <h2>Synth High</h2>
          <PianoRoll trackName="synth_high" track={loop.synth_high} position={playback.position} editingEnabled={isReady} onChange={editTrack('synth_high')} />
        </section>
      </div>
    </main>
  );
};

export default App;
