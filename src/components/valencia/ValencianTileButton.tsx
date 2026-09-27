import "@fontsource/cinzel-decorative/700.css";
import { motion, useReducedMotion, type Transition } from "framer-motion";
import {
  memo,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type FocusEvent,
  type MouseEvent,
} from "react";

const COLS = 9;
const ROWS = 4;
const TILE = 40;
const GAP = 0.5;
const PITCH = TILE + GAP;
const WIDTH = COLS * TILE + (COLS - 1) * GAP;
const HEIGHT = ROWS * TILE + (ROWS - 1) * GAP;

const COBALT = "#0B2545";
const GROUT = "#D6CEC2";
const ENAMEL = "#FCFBF7";
const IVORY = "#F5EFE6";

const LIFT_Y = -4;
const LIFT_X = 2;
const SHADOW_REST = "0px 1px 2px 0px rgba(11, 37, 69, 0.12)";
const SHADOW_RAISED = "0px 12px 20px -4px rgba(11, 37, 69, 0.25)";
const STAGGER = 0.02;
const SPRING = { type: "spring", stiffness: 350, damping: 25 } as const;

type Cell = { col: number; row: number };

const TILES: Cell[] = Array.from({ length: COLS * ROWS }, (_, i) => ({
  col: i % COLS,
  row: Math.floor(i / COLS),
}));

const CENTER: Cell = { col: (COLS - 1) / 2, row: (ROWS - 1) / 2 };

const distance = (a: Cell, b: Cell) => Math.hypot(a.col - b.col, a.row - b.row);

const sameCell = (a: Cell | null, b: Cell | null) =>
  a?.col === b?.col && a?.row === b?.row;

function cornerRadius({ col, row }: Cell) {
  const top = row === 0;
  const bottom = row === ROWS - 1;
  const left = col === 0;
  const right = col === COLS - 1;
  return {
    borderTopLeftRadius: top && left ? 4 : 0,
    borderTopRightRadius: top && right ? 4 : 0,
    borderBottomLeftRadius: bottom && left ? 4 : 0,
    borderBottomRightRadius: bottom && right ? 4 : 0,
  };
}

const strokeProps = {
  fill: "none",
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** Drawn for the top-left corner; mirrored via transforms for the others. */
function CornerFlourish({ transform }: { transform?: string }) {
  return (
    <g transform={transform}>
      <path
        d="M8 52 C4 34 8 18 20 12 C32 6 50 6 66 10 C52 14 36 16 28 24 C20 32 16 42 8 52 Z"
        fill="currentColor"
        opacity={0.22}
      />
      <path
        d="M9 54 C5 36 8 20 20 13 C31 7 49 6 66 9"
        strokeWidth={4.5}
        {...strokeProps}
      />
      <path
        d="M66 9 C74 10 76 18 70 21 C66 23 62 19 65 16"
        strokeWidth={3}
        {...strokeProps}
      />
      <path
        d="M9 54 C10 62 18 64 21 58 C23 54 19 50 16 53"
        strokeWidth={3}
        {...strokeProps}
      />
      <path
        d="M30 34 C22 34 18 26 23 21 C28 16 36 20 34 26 C33 29 29 29 28 27"
        strokeWidth={3}
        {...strokeProps}
      />
      <path
        d="M34 26 Q46 26 50 37 Q38 38 34 26 Z"
        fill="currentColor"
        opacity={0.85}
      />
      <circle cx={46} cy={17} r={2.6} fill="currentColor" />
      <circle cx={17} cy={46} r={2.6} fill="currentColor" />
      <circle cx={6} cy={6} r={3} fill="currentColor" />
    </g>
  );
}

function EdgeScroll({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path
        d="M2 9 C12 1 22 1 30 7 C38 13 48 13 58 7 C48 17 38 17 30 11 C22 5 12 5 2 9 Z"
        fill="currentColor"
        opacity={0.22}
      />
      <path
        d="M2 8 C12 0 22 0 30 7 S48 14 58 6"
        strokeWidth={3.5}
        {...strokeProps}
      />
      <path d="M2 8 C-2 12 2 16 6 13" strokeWidth={2.5} {...strokeProps} />
      <path d="M58 6 C62 2 58 -2 54 1" strokeWidth={2.5} {...strokeProps} />
    </g>
  );
}

function SideScroll({ transform }: { transform: string }) {
  return (
    <g transform={transform}>
      <path
        d="M0 -12 C6 -8 6 -2 0 0 C-6 2 -6 8 0 12"
        strokeWidth={3.5}
        {...strokeProps}
      />
      <circle cx={0} cy={-14.5} r={2.4} fill="currentColor" />
      <circle cx={0} cy={14.5} r={2.4} fill="currentColor" />
    </g>
  );
}

const EDGE_SCROLL_X = [96, 158, 220];

const AzulejoBorder = memo(function AzulejoBorder() {
  return (
    <svg
      width={WIDTH}
      height={HEIGHT}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="absolute inset-0"
      style={{ color: COBALT }}
      aria-hidden
    >
      <CornerFlourish />
      <CornerFlourish transform={`translate(${WIDTH} 0) scale(-1 1)`} />
      <CornerFlourish transform={`translate(0 ${HEIGHT}) scale(1 -1)`} />
      <CornerFlourish
        transform={`translate(${WIDTH} ${HEIGHT}) scale(-1 -1)`}
      />
      {EDGE_SCROLL_X.map((x) => (
        <g key={x}>
          <EdgeScroll transform={`translate(${x} 6)`} />
          <EdgeScroll transform={`translate(${x} ${HEIGHT - 6}) scale(1 -1)`} />
        </g>
      ))}
      <SideScroll transform={`translate(9 ${HEIGHT / 2})`} />
      <SideScroll
        transform={`translate(${WIDTH - 9} ${HEIGHT / 2}) scale(-1 1)`}
      />
    </svg>
  );
});

/** Area inside the border ornaments that the lettering may occupy. */
const TEXT_BOX_W = 290;
const TEXT_BOX_H = 110;
const MAX_FONT_SIZE = 38;
const MIN_FONT_SIZE = 12;

const inkClassName =
  "block w-full text-center font-bold uppercase leading-[1.1] tracking-[0.15em] select-none";

const inkStyle = (fontSize: number) =>
  ({
    color: COBALT,
    fontFamily: "'Cinzel Decorative', 'Playfair Display', serif",
    fontSize,
    paddingLeft: "0.15em",
    overflowWrap: "normal",
    textWrap: "balance",
    opacity: 0.95,
    textShadow: "0 0 0.6px rgba(11, 37, 69, 0.6)",
  }) as const;

/** Largest font size at which the wrapped text fits inside the text box. */
function useFittedFontSize(text: string) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const [fontSize, setFontSize] = useState(MAX_FONT_SIZE);

  useLayoutEffect(() => {
    const el = measureRef.current;
    if (!el) return;
    let cancelled = false;

    const fit = () => {
      if (cancelled) return;
      let size = MAX_FONT_SIZE;
      for (; size > MIN_FONT_SIZE; size--) {
        el.style.fontSize = `${size}px`;
        if (el.scrollHeight <= TEXT_BOX_H && el.scrollWidth <= TEXT_BOX_W) {
          break;
        }
      }
      setFontSize(size);
    };

    fit();
    // Metrics change once the web font finishes loading.
    document.fonts?.ready.then(fit);
    return () => {
      cancelled = true;
    };
  }, [text]);

  return { measureRef, fontSize };
}

/** The full painted face; every tile renders it and shows only its own slice. */
const TileArtwork = memo(function TileArtwork({
  col,
  row,
  text,
  fontSize,
}: Cell & { text: string; fontSize: number }) {
  return (
    <div
      className="pointer-events-none absolute"
      style={{
        width: WIDTH,
        height: HEIGHT,
        left: -col * PITCH,
        top: -row * PITCH,
      }}
    >
      <AzulejoBorder />
      <div
        className="absolute flex items-center justify-center"
        style={{
          width: TEXT_BOX_W,
          height: TEXT_BOX_H,
          left: (WIDTH - TEXT_BOX_W) / 2,
          top: (HEIGHT - TEXT_BOX_H) / 2,
        }}
      >
        <span className={inkClassName} style={inkStyle(fontSize)}>
          {text}
        </span>
      </div>
    </div>
  );
});

type ValencianTileButtonProps = {
  /** Painted across the tiles in uppercase; wraps at spaces and shrinks to fit. */
  text?: string;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  className?: string;
};

export default function ValencianTileButton({
  text = "Valencia",
  onClick,
  className = "",
}: ValencianTileButtonProps) {
  const reduceMotion = useReducedMotion();
  const { measureRef, fontSize } = useFittedFontSize(text);
  const [raised, setRaised] = useState(false);
  const [highlight, setHighlight] = useState<Cell | null>(null);
  const [origin, setOrigin] = useState<Cell>(CENTER);
  const raisedRef = useRef(false);
  const highlightRef = useRef<Cell | null>(null);

  const raise = useCallback((from: Cell) => {
    if (raisedRef.current) return;
    raisedRef.current = true;
    setOrigin(from);
    setRaised(true);
  }, []);

  const lower = useCallback((from: Cell) => {
    if (!raisedRef.current) return;
    raisedRef.current = false;
    setOrigin(from);
    setRaised(false);
  }, []);

  const updateHighlight = useCallback((cell: Cell | null) => {
    if (sameCell(highlightRef.current, cell)) return;
    highlightRef.current = cell;
    setHighlight(cell);
  }, []);

  const handlePointer = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const rect = event.currentTarget.getBoundingClientRect();
      const cell: Cell = {
        col: Math.min(
          COLS - 1,
          Math.max(0, Math.floor((event.clientX - rect.left) / PITCH)),
        ),
        row: Math.min(
          ROWS - 1,
          Math.max(0, Math.floor((event.clientY - rect.top) / PITCH)),
        ),
      };
      raise(cell);
      updateHighlight(cell);
    },
    [raise, updateHighlight],
  );

  const handleMouseLeave = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      const last = highlightRef.current ?? CENTER;
      updateHighlight(null);
      if (!event.currentTarget.matches(":focus-visible")) lower(last);
    },
    [lower, updateHighlight],
  );

  const handleFocus = useCallback(
    (event: FocusEvent<HTMLButtonElement>) => {
      if (event.currentTarget.matches(":focus-visible")) raise(CENTER);
    },
    [raise],
  );

  const handleBlur = useCallback(() => {
    if (!highlightRef.current) lower(CENTER);
  }, [lower]);

  return (
    <motion.button
      type="button"
      aria-label={text}
      onClick={onClick}
      onMouseEnter={handlePointer}
      onMouseMove={handlePointer}
      onMouseLeave={handleMouseLeave}
      whileTap={reduceMotion ? undefined : { scale: 0.985 }}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={`relative grid cursor-pointer rounded-[4px] border-0 p-0 outline-offset-4 focus-visible:outline-2 focus-visible:outline-[#0B2545] ${className}`}
      style={{
        width: WIDTH,
        height: HEIGHT,
        gap: GAP,
        backgroundColor: GROUT,
        gridTemplateColumns: `repeat(${COLS}, ${TILE}px)`,
        gridTemplateRows: `repeat(${ROWS}, ${TILE}px)`,
      }}
    >
      {TILES.map((cell) => {
        const delay = reduceMotion ? 0 : distance(cell, origin) * STAGGER;
        const motionTransition: Transition = reduceMotion
          ? { duration: 0.15, ease: "easeOut" }
          : { ...SPRING, delay };
        const isHighlighted = sameCell(cell, highlight);

        return (
          <motion.div
            key={`${cell.col}-${cell.row}`}
            className="relative overflow-hidden"
            style={{ width: TILE, height: TILE, ...cornerRadius(cell) }}
            initial={false}
            animate={{
              y: raised ? LIFT_Y : 0,
              x: raised ? LIFT_X : 0,
              boxShadow: raised ? SHADOW_RAISED : SHADOW_REST,
              backgroundColor: isHighlighted ? IVORY : ENAMEL,
            }}
            transition={{
              y: motionTransition,
              boxShadow: reduceMotion
                ? motionTransition
                : { duration: 0.35, ease: "easeOut", delay },
              backgroundColor: { duration: 0.2, ease: "easeOut" },
            }}
          >
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.9) 0%, rgba(255,255,255,0) 60%, rgba(214,206,194,0.35) 100%)",
              }}
            />
            <TileArtwork
              col={cell.col}
              row={cell.row}
              text={text}
              fontSize={fontSize}
            />
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                borderRadius: "inherit",
                boxShadow: "inset 0 0 4px rgba(0, 0, 0, 0.08)",
                background:
                  "linear-gradient(135deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0) 45%)",
              }}
            />
          </motion.div>
        );
      })}
      <span
        ref={measureRef}
        aria-hidden
        className={`${inkClassName} pointer-events-none invisible absolute top-0 left-0`}
        style={{ ...inkStyle(fontSize), width: TEXT_BOX_W }}
      >
        {text}
      </span>
    </motion.button>
  );
}
