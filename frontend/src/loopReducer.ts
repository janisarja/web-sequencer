import type { Loop, LoopAction } from './types';

const loopReducer = (state: Loop, action: LoopAction): Loop => {
  switch (action.type) {
    case 'add': {
      const { track, sound } = action;
      console.log('LoopReducer state:', state, 'action:', action);
      return {
        ...state,
        [track]: [...state[track], sound],
      };
    }
    case 'remove': {
      const { track, soundId } = action;
      return {
        ...state,
        [track]: state[track].filter((sound) => sound.id !== soundId),
      };
    }
    default:
      return state;
  }
};

export default loopReducer;
