import type { Sound } from '@app/shared';

export type PianoRollAction = { 
  type: 'add'; 
  sound: Sound 
} | { 
  type: 'remove'; 
  soundId: string 
};
