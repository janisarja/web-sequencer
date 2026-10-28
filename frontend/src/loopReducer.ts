import type { Loop, LoopAction } from '@app/shared';

type ReplaceLoopAction = {
  type: 'replace';
  state: Loop;
};

const loopReducer = (state: Loop, action: LoopAction | ReplaceLoopAction): Loop => {
  switch (action.type) {
    case 'replace':
      return action.state;
    case 'add': {
      const { track, sound } = action;
      if (state[track].some((sound) => sound.id === action.sound.id)) {
        return state;
      }
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
