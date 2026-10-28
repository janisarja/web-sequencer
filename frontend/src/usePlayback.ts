import { useCallback, useEffect, useRef, useState } from 'react';
import * as Tone from 'tone';

import type { Loop, Sound, Track } from '@app/shared';

type Playback = {
  isPlaying: boolean;
  position: number;
  start: () => Promise<void>;
  stop: () => void;
};

const BPM = 120;

const createInstruments = (): Record<Track, Tone.PolySynth<Tone.FMSynth>> => ({
  drums: new Tone.PolySynth(Tone.FMSynth).toDestination(),
  bass: new Tone.PolySynth(Tone.FMSynth).toDestination(),
  synth_low: new Tone.PolySynth(Tone.FMSynth).toDestination(),
  synth_high: new Tone.PolySynth(Tone.FMSynth).toDestination(),
});

const usePlayback = (loop: Loop): Playback => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const sounds = useRef<Tone.Loop[]>([]);
  const instruments = useRef<Record<Track, Tone.PolySynth<Tone.FMSynth>> | null>(null);

  const addToPlayback = useCallback((track: Track, sound: Sound) => {
    const trackInstrument = instruments.current?.[track];
    if (!trackInstrument) {
      return;
    }

    const duration = `0:${Math.floor(sound.duration / 2)}:${sound.duration % 2 ? 2 : 0}`;
    const start = `${Math.floor(sound.start / 8)}:${Math.floor((sound.start % 8) / 2)}:${sound.start % 2 ? 2 : 0}`;

    const soundLoop = new Tone.Loop((time) => {
      trackInstrument.triggerAttackRelease(sound.note, duration, time);
      console.log(`Playing ${sound.note} at ${time}`);
    }, '4m');

    sounds.current.push(soundLoop);
    soundLoop.start(start);
  }, []);

  const clearPlayback = useCallback(() => {
    for (const sound of sounds.current) {
      sound.stop();
      sound.dispose();
    }
    sounds.current = [];
  }, []);

  useEffect(() => {
    if (!isPlaying) return;

    let animationFrame: number;
    const updatePosition = () => {
      const loopDuration = Tone.Time('4m').toSeconds();
      const progress = (Tone.getTransport().seconds % loopDuration) / loopDuration;
      setPosition(progress * 32);
      animationFrame = requestAnimationFrame(updatePosition);
    };

    animationFrame = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(animationFrame);
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      clearPlayback();
      Tone.getTransport().stop();
      instruments.current?.drums.dispose();
      instruments.current?.bass.dispose();
      instruments.current?.synth_low.dispose();
      instruments.current?.synth_high.dispose();
      instruments.current = null;
    };
  }, [clearPlayback]);

  const updatePlayback = useCallback(() => {
    console.log('Updating playback with loop:', loop);
    clearPlayback();
    instruments.current ??= createInstruments();

    for (const track of Object.keys(loop) as Track[]) {
      for (const sound of loop[track]) {
        addToPlayback(track, sound);
      }
    }

    Tone.getTransport().bpm.value = BPM;
    Tone.getTransport().start();
  }, [clearPlayback, loop, addToPlayback]);

  useEffect(() => {
    if (isPlaying) {
      updatePlayback();
    }
  }, [isPlaying, updatePlayback]);

  const startPlayback = async () => {
    await Tone.start();
    setIsPlaying(true);
  };

  const stopPlayback = () => {
    clearPlayback();
    const transport = Tone.getTransport();
    transport.stop();
    transport.position = 0;
    setPosition(0);
    setIsPlaying(false);
  };

  return { isPlaying, position, start: startPlayback, stop: stopPlayback };
};

export default usePlayback;
