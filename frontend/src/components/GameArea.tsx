"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";

type Props = {
  level: number; // 1, 2, or 3
  onComplete: () => void;
  onFail: () => void;
  maxTasks?: number; // Override the default max tasks for this level
};

type Shape = "square" | "rect-h" | "rect-v" | "oval";
type ActionType = "left" | "right" | "hover";

const LEVEL_CONFIG = [
  { max: 5, size: 180, speed: 0 },
  { max: 3, size: 140, speed: 0.4 },
  { max: 1, size: 130, speed: 0.8 },
];
const DIRECTION_ANGLES = [30, 60, 120, 150, 210, 240, 300, 330];

function randomShape(): Shape {
  const shapes: Shape[] = ["square", "rect-h", "rect-v", "oval"];
  return shapes[Math.floor(Math.random() * shapes.length)];
}

function randomPos(size = 100) {
  if (typeof window === "undefined") return { left: 100, top: 150 };
  // Use viewport dimensions but account for the actual playground area
  const ww = window.innerWidth - size - 80; // 40px margin on each side
  const wh = window.innerHeight - size - 200; // Account for tabs and margins
  return {
    left: Math.max(40, Math.floor(Math.random() * ww)),
    top: Math.max(120, Math.floor(Math.random() * wh) + 120), // Start below tabs
  };
}

function getCardType(): { bg: string; action: ActionType } {
  const options: { bg: string; action: ActionType }[] = [
    { bg: "bg-red-500", action: "left" },
    { bg: "bg-green-500", action: "right" },
    { bg: "bg-blue-500", action: "hover" },
  ];
  return options[Math.floor(Math.random() * options.length)];
}

export default function GameArea({
  level,
  onComplete,

  maxTasks,
}: Props) {
  const {
    max: defaultMax,
    size,
    speed,
  } = LEVEL_CONFIG[Math.max(1, Math.min(level, 3)) - 1];
  const max = maxTasks || defaultMax;
  const [step, setStep] = useState(0);
  const [running, setRunning] = useState(true);

  const [card, setCard] = useState<null | {
    shape: Shape;
    action: ActionType;
    color: string;
    pos: { left: number; top: number };
    size: number;
  }>(null);

  const reqRef = useRef<number | null>(null);
  const directionRef = useRef<{ dx: number; dy: number }>({ dx: 1, dy: 1 });

  const dealNewCard = useCallback(() => {
    const { bg, action } = getCardType();
    const angle =
      DIRECTION_ANGLES[Math.floor(Math.random() * DIRECTION_ANGLES.length)] *
      (Math.PI / 180);

    directionRef.current = { dx: Math.cos(angle), dy: Math.sin(angle) };

    setCard({
      shape: randomShape(),
      action,
      color: bg,
      pos: randomPos(size),
      size,
    });
  }, [size]);

  // Reset on level change
  useEffect(() => {
    setStep(1);
    setRunning(true);
    dealNewCard();
    return () => {
      if (reqRef.current) {
        cancelAnimationFrame(reqRef.current);
      }
    };
  }, [level, dealNewCard]);

  // Movement
  useEffect(() => {
    if (!running || !card || speed === 0) return;

    let { left, top } = card.pos;
    let { dx, dy } = directionRef.current;

    const animate = () => {
      if (!running) return;

      // Use the same boundaries as randomPos for consistency
      const ww = window.innerWidth - card.size - 80; // 40px margin on each side
      const wh = window.innerHeight - card.size - 200; // Account for tabs and margins

      let nextLeft = left + dx * speed;
      let nextTop = top + dy * speed;

      // Bounce off boundaries
      if (nextLeft <= 40 || nextLeft >= ww) dx *= -1;
      if (nextTop <= 120 || nextTop >= wh) dy *= -1;

      // Clamp to boundaries
      nextLeft = Math.max(40, Math.min(nextLeft, ww));
      nextTop = Math.max(120, Math.min(nextTop, wh));

      setCard((c) => (c ? { ...c, pos: { left: nextLeft, top: nextTop } } : c));
      left = nextLeft;
      top = nextTop;
      directionRef.current = { dx, dy };

      reqRef.current = requestAnimationFrame(animate);
    };
    reqRef.current = requestAnimationFrame(animate);

    return () => {
      if (reqRef.current) {
        cancelAnimationFrame(reqRef.current);
      }
    };
  }, [card, running, speed]);

  function handleAction(type: ActionType) {
    if (!running || !card) return;
    if (type === card.action) {
      toast.success("Correct!");
      setStep((s) => s + 1);

      if (step < max) {
        // Small delay to prevent rapid clicking issues
        setTimeout(() => {
          dealNewCard();
        }, 100);
      } else {
        setRunning(false);
        toast.success("Level complete!");
        onComplete(); // Only call onComplete when ALL tasks are done
      }
    } else {
      toast.error("Wrong action!");
    }
  }

  function ShapeWrapper() {
    if (!card) return null;

    const style: React.CSSProperties = {
      left: card.pos.left,
      top: card.pos.top,
      width: card.size,
      height: card.size,
    };

    if (card.shape === "rect-h") {
      style.width = card.size * 1.5;
      style.height = card.size * 0.6;
    } else if (card.shape === "rect-v") {
      style.width = card.size * 0.9;
      style.height = card.size * 1.3;
    } else if (card.shape === "oval") {
      style.borderRadius = "50%";
      style.width = card.size * 1.5;
      style.height = card.size;
    }

    return (
      <div
        className={`absolute flex items-center justify-center cursor-pointer shadow-lg ${card.color}`}
        style={style}
        onMouseDown={(e) => {
          if (e.button === 0 && card.action === "left") {
            e.preventDefault();
            handleAction("left");
          }
        }}
        onClick={(e) => {
          if (card.action === "left") {
            e.preventDefault();
            handleAction("left");
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (card.action === "right") handleAction("right");
        }}
        onMouseOver={() => card.action === "hover" && handleAction("hover")}
      >
        <span className="text-lg font-bold text-white">
          {getActionText(card.action)}
        </span>
      </div>
    );
  }

  const getActionText = (action: ActionType) => {
    switch (action) {
      case "hover":
        return "Hover";
      case "right":
        return "Right click";
      case "left":
        return "Left click";
      default:
        return "";
    }
  };

  return (
    <div className="relative h-full w-full flex justify-center items-center select-none overflow-hidden">
      <span className="absolute top-16 left-8 text-lg z-10 text-white">
        Step: {step}/{max}
      </span>
      <ShapeWrapper />
    </div>
  );
}
