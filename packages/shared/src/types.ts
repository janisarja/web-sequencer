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

export type ClientMessage = {
  action: LoopAction;
};

export type ServerMessage = {
  type: 'update';
  revision: number;
  action: LoopAction;
} | {
  type: 'reject';
  action: LoopAction;
} | {
  type: 'connected';
  payload: { message: string };
} | {
  type: 'error';
  payload: { message: string };
};

export type LoopState = {
  state: Loop;
  revision: number;
};
