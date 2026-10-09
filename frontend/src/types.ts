export type Sound = {
  id: string;
  note: string;
  duration: number;
  start: number;
};

export type Loop = {
  drums: Sound[];
  bass: Sound[];
  synth_low: Sound[];
  synth_high: Sound[];
};

export type Track = keyof Loop;

export type LoopAction = {
  type: 'add';
  track: Track;
  sound: Sound;
} | {
  type: 'remove';
  track: Track;
  soundId: string;
};

export type PianoRollAction = { 
  type: 'add'; 
  sound: Sound 
} | { 
  type: 'remove'; 
  soundId: string 
};
