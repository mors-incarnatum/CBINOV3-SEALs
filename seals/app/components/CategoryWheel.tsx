"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { CATEGORIES, type CategoryId } from "@/lib/board";
import Modal from "./Modal";

// Clockwise from the upper right, with a small gap between segments.
const sectors: {
  id: CategoryId;
  angle: number;
  x: number;
  y: number;
  icon: string;
}[] = [
  { id: "needs", angle: -90, x: 224, y: 76, icon: "M0-8V8M-8 0H8" },
  {
    id: "feelings",
    angle: 0,
    x: 224,
    y: 224,
    icon: "M-9-2a5 5 0 0 1 9-4 5 5 0 0 1 9 4C9 3 0 9 0 9S-9 3-9-2Z",
  },
  {
    id: "people",
    angle: 90,
    x: 76,
    y: 224,
    icon: "M-4-3a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM-12 9V6a6 6 0 0 1 12 0v3M5-10a4 4 0 0 1 0 8M5 1a6 6 0 0 1 6 5v3",
  },
  { id: "actions", angle: 180, x: 76, y: 76, icon: "M-10 0H10M3-7l7 7-7 7" },
];

function ringSegment(start: number) {
  const point = (radius: number, angle: number) => {
    const radians = (angle * Math.PI) / 180;
    return `${150 + radius * Math.cos(radians)} ${150 + radius * Math.sin(radians)}`;
  };
  const a = start + 2,
    b = start + 88;
  return `M${point(140, a)} A140 140 0 0 1 ${point(140, b)} L${point(68, b)} A68 68 0 0 0 ${point(68, a)}Z`;
}

export default function CategoryWheel({
  coords,
  onClose,
}: {
  coords: { x: number; y: number };
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const openedOn = useRef(pathname);
  const [hovered, setHovered] = useState<CategoryId | null>(null);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    if (pathname !== openedOn.current) onClose();
  }, [pathname, onClose]);

  const choose = (id: CategoryId) => {
    if (pending) return;
    if (pathname === `/board/${id}`) {
      onClose();
      return;
    }
    startTransition(() => router.push(`/board/${id}`));
  };

  return (
    <Modal
      label="Choose category"
      onClose={onClose}
      className="category-wheel border-0 p-0 bg-transparent overflow-visible"
      style={{
        position: "fixed",
        margin: 0,
        left: `clamp(8px, ${coords.x - 150}px, calc(100vw - 308px))`,
        top: `clamp(8px, ${coords.y - 150}px, calc(100dvh - 308px))`,
        width: "min(300px, calc(100vw - 16px), calc(100dvh - 16px))",
        height: "min(300px, calc(100vw - 16px), calc(100dvh - 16px))",
      }}
    >
      <svg
        viewBox="0 0 300 300"
        className="h-full w-full overflow-visible"
        aria-label="Category wheel"
        aria-busy={pending}
      >
        <circle cx="150" cy="150" r="147" fill="#fff" fillOpacity=".94" />
        {sectors.map((sector, index) => {
          const category = CATEGORIES[sector.id];
          const active = hovered === sector.id;
          const current = pathname === `/board/${sector.id}`;
          return (
            <g
              key={sector.id}
              role="button"
              tabIndex={0}
              aria-label={`Open ${category.wheel}`}
              aria-current={current ? "page" : undefined}
              className="wheel-sector"
              data-active={active}
              aria-disabled={pending}
              style={{ color: category.color }}
              onPointerEnter={() => {
                setHovered(sector.id);
                router.prefetch(`/board/${sector.id}`);
              }}
              onPointerLeave={() => setHovered(null)}
              onFocus={() => {
                setHovered(sector.id);
                router.prefetch(`/board/${sector.id}`);
              }}
              onBlur={() => setHovered(null)}
              onClick={() => choose(sector.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  choose(sector.id);
                }
                if (
                  [
                    "ArrowRight",
                    "ArrowDown",
                    "ArrowLeft",
                    "ArrowUp",
                    "Home",
                    "End",
                  ].includes(event.key)
                ) {
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? 3
                        : (index +
                            (["ArrowRight", "ArrowDown"].includes(event.key)
                              ? 1
                              : 3)) %
                          4;
                  event.currentTarget.parentElement
                    ?.querySelectorAll<SVGGElement>(".wheel-sector")
                    [next]?.focus();
                }
              }}
            >
              <path
                className="wheel-sector-shape"
                d={ringSegment(sector.angle)}
                fill={active || current ? category.fill : category.background}
                stroke="currentColor"
                strokeOpacity={active ? 0.65 : 0.16}
                strokeWidth={active ? 2 : 1}
              />
              <g
                transform={`translate(${sector.x} ${sector.y - 10})`}
                pointerEvents="none"
              >
                <path
                  d={sector.icon}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <text
                  y="30"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="13"
                  fontWeight="700"
                >
                  {category.wheel}
                </text>
                {current && <circle cy="43" r="2.5" fill="currentColor" />}
              </g>
            </g>
          );
        })}
      </svg>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close category wheel"
        className="wheel-center absolute inset-0 m-auto flex h-[40%] w-[40%] flex-col items-center justify-center rounded-full bg-white text-slate-700 focus-visible:outline-2 focus-visible:outline-sky-600"
      >
        <span className="text-sm font-bold">
          {pending
            ? "Opening…"
            : hovered
              ? CATEGORIES[hovered].wheel
              : "Categories"}
        </span>
        <span className="mt-1.5 text-[11px] text-slate-500">Close ×</span>
      </button>
    </Modal>
  );
}
