import { useRef, useState } from 'react';
import type { Sound, PianoRollAction } from '../types';

type PianoRollProps = {
  track: Sound[];
  position: number;
  onChange: (action: PianoRollAction) => void;
};

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const ROWS = Array.from({ length: 25 }, (_, index) => {
  const note = 24 - index;
  return `${NOTES[note % 12]}${3 + Math.floor(note / 12)}`;
});
const COLUMNS = 32;
const ROW_HEIGHT = 18;
const COLUMN_WIDTH = 24;
const LABEL_WIDTH = 36;
const HEIGHT = ROWS.length * ROW_HEIGHT;
const WIDTH = LABEL_WIDTH + COLUMNS * COLUMN_WIDTH;

const noteIndex = (note: string) => ROWS.indexOf(note);
const isBlackKey = (note: string) => note.includes('#');

const PianoRoll = ({
  track,
  position,
  onChange,
}: PianoRollProps) => {
  const [drag, setDrag] = useState<{ row: number; start: number; end: number }>();
  const [zoom, setZoom] = useState(1);
  const pan = useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const occupied = (row: number, column: number) =>
    track.some((sound) => {
      const soundRow = noteIndex(sound.note);
      return soundRow === row && column >= sound.start && column < sound.start + sound.duration;
    });
  const noteAt = (row: number, column: number) =>
    track.find((sound) => noteIndex(sound.note) === row
      && column >= sound.start
      && column < sound.start + sound.duration);

  const availableEnd = (row: number, start: number, end: number) => {
    if (start === end) return start;

    const direction = end > start ? 1 : -1;
    for (let column = start + direction; direction > 0 ? column <= end : column >= end; column += direction) {
      if (occupied(row, column)) return column - direction;
    }
    return end;
  };

  const cellAt = (event: React.PointerEvent<SVGSVGElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * WIDTH;
    const y = event.clientY - bounds.top;
    return {
      column: Math.max(0, Math.min(COLUMNS - 1, Math.floor((x - LABEL_WIDTH) / COLUMN_WIDTH))),
      row: Math.max(0, Math.min(ROWS.length - 1, Math.floor(y / ROW_HEIGHT))),
    };
  };

  const addNote = (row: number, start: number, end: number) => {
    const length = end - start + 1;
    onChange({ type: 'add', sound: { id: crypto.randomUUID(), note: ROWS[row], duration: length, start } });
  };

  return (
    <section className="piano-roll">
      <div
        className="piano-roll__viewport"
        onWheel={(event) => {
          if (event.shiftKey) {
            event.preventDefault();
            setZoom((value) => Math.min(3, Math.max(1, value - event.deltaY * 0.002)));
          }
        }}
        onPointerDown={(event) => {
          if (event.button !== 1) return;
          event.preventDefault();
          pan.current = {
            x: event.clientX,
            y: event.clientY,
            scrollLeft: event.currentTarget.scrollLeft,
            scrollTop: event.currentTarget.scrollTop,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!pan.current) return;
          event.currentTarget.scrollLeft = pan.current.scrollLeft - (event.clientX - pan.current.x);
          event.currentTarget.scrollTop = pan.current.scrollTop - (event.clientY - pan.current.y);
        }}
        onPointerUp={(event) => {
          if (!pan.current) return;
          pan.current = null;
          event.currentTarget.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          pan.current = null;
        }}
      >
        <svg
          aria-label="Piano roll"
          role="grid"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          width={`${zoom * 100}%`}
          height={HEIGHT}
          preserveAspectRatio="none"
          onPointerDown={(event) => {
            if (event.button === 1) return;
            const { row, column } = cellAt(event);
            const existing = noteAt(row, column);
            if (existing) {
              return onChange({ type: 'remove', soundId: existing.id });
            }
            setDrag({ row, start: column, end: column });
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (!drag) return;
            const column = cellAt(event).column;
            setDrag({
              ...drag,
              end: availableEnd(drag.row, drag.start, column),
            });
          }}
          onPointerUp={(event) => {
            if (!drag) return;
            addNote(drag.row, Math.min(drag.start, drag.end), Math.max(drag.start, drag.end));
            setDrag(undefined);
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => setDrag(undefined)}
        >
          {ROWS.map((note, row) => (
            <g key={note} role="row">
              <rect
                x={0}
                y={row * ROW_HEIGHT}
                width={WIDTH}
                height={ROW_HEIGHT}
                fill={isBlackKey(note) ? '#1f2937' : '#374151'}
                stroke="#4b5563"
              />
              <text x={LABEL_WIDTH - 5} y={row * ROW_HEIGHT + 14} fill="#d1d5db" fontSize="10" textAnchor="end">
                {note}
              </text>
              {Array.from({ length: COLUMNS }, (_, column) => (
                <rect
                  key={column}
                  x={LABEL_WIDTH + column * COLUMN_WIDTH}
                  y={row * ROW_HEIGHT}
                  width={COLUMN_WIDTH}
                  height={ROW_HEIGHT}
                  fill="transparent"
                  stroke={column % 8 === 0 ? '#9ca3af' : '#4b5563'}
                  strokeWidth={column % 8 === 0 ? 1.5 : 0.5}
                />
              ))}
            </g>
          ))}
          {track.map((sound) => {
            const row = noteIndex(sound.note);
            const start = sound.start;
            const length = Math.max(1, sound.duration);
            if (row < 0) return null;
            return (
              <rect
                key={sound.id}
                x={LABEL_WIDTH + start * COLUMN_WIDTH + 1}
                y={row * ROW_HEIGHT + 2}
                width={length * COLUMN_WIDTH - 2}
                height={ROW_HEIGHT - 4}
                rx={1}
                fill="#22c55e"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  onChange({ type: 'remove', soundId: sound.id });
                }}
              />
            );
          })}
          <line
            x1={LABEL_WIDTH + position * COLUMN_WIDTH}
            y1={0}
            x2={LABEL_WIDTH + position * COLUMN_WIDTH}
            y2={HEIGHT}
            stroke="#f87171"
            strokeWidth={1.5}
            pointerEvents="none"
          />
          {drag && (
            <rect
              x={LABEL_WIDTH + Math.min(drag.start, drag.end) * COLUMN_WIDTH + 1}
              y={drag.row * ROW_HEIGHT + 2}
              width={(Math.abs(drag.end - drag.start) + 1) * COLUMN_WIDTH - 2}
              height={ROW_HEIGHT - 4}
              rx={2}
              fill="#86efac"
              opacity={0.8}
            />
          )}
        </svg>
      </div>
    </section>
  );
};

export default PianoRoll;
