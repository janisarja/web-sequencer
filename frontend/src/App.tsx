import { useReducer } from 'react';

import LoopReducer from './loopReducer';
import usePlayback from './usePlayback';
import PlayButton from './components/PlayButton';
import PianoRoll from './components/PianoRoll';

import type { Loop, Track, PianoRollAction } from './types';

const initialLoop: Loop = {
  drums: [],
  bass: [],
  synth_low: [],
  synth_high: [],
};

const App = () => {
  const [loop, dispatch] = useReducer(LoopReducer, initialLoop);
  const playback = usePlayback(loop);

  const editTrack = (track: Track) => (action: PianoRollAction): void => {
    console.log(`Editing track ${track} with action`, action);
    dispatch({ ...action, track });
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <PlayButton play={() => playback.isPlaying ? playback.stop() : playback.start()} />
      </header>
      <div className="track-list">
        <section className="track-card">
          <h2>Drums</h2>
          <PianoRoll track={loop.drums} position={playback.position} onChange={editTrack('drums')} />
        </section>
        <section className="track-card">
          <h2>Bass</h2>
          <PianoRoll track={loop.bass} position={playback.position} onChange={editTrack('bass')} />
        </section>
        <section className="track-card">
          <h2>Synth Low</h2>
          <PianoRoll track={loop.synth_low} position={playback.position} onChange={editTrack('synth_low')} />
        </section>
        <section className="track-card">
          <h2>Synth High</h2>
          <PianoRoll track={loop.synth_high} position={playback.position} onChange={editTrack('synth_high')} />
        </section>
      </div>
    </main>
  );
};

export default App;
