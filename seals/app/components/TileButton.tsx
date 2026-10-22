"use client";

import React from "react";
import { theme } from "@/app/theme";

interface TileButtonProps {
  id: string;
  label: string;
  gifPath?: string;
  category?: string;
  onPress: (label: string) => void;
  editing?: boolean;
  buttonProps?: Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick">;
}

const TileButton = React.memo(function TileButton({
  label,
  gifPath,
  category,
  onPress,
  editing,
  buttonProps,
}: TileButtonProps) {
  const tileStyle =
    (category && category in theme.categoryTiles
      ? theme.categoryTiles[category as keyof typeof theme.categoryTiles]
      : theme.tile);

  return (
    <button
      {...buttonProps}
      type="button"
      onClick={() => onPress(label)}
      className={`${tileStyle.bg} ${editing ? "border-2 border-dashed border-gray-500" : `border ${tileStyle.border}`} ${tileStyle.hoverBg} ${tileStyle.hoverBorder} ${tileStyle.activeBg} ${tileStyle.activeBorder} ${tileStyle.focusRing} rounded-none shadow-xs transition-all duration-100 flex flex-col items-center justify-center p-2 focus:outline-none focus:ring-2 relative group flex-1 w-full min-h-0`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {gifPath && <img
        src={gifPath}
        alt=""
        className="w-12 h-12 md:w-16 md:h-16 object-contain mb-1 md:mb-2 group-hover:scale-105 transition-transform mix-blend-multiply"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          if (target.nextElementSibling) {
            (target.nextElementSibling as HTMLElement).style.display = "flex";
          }
        }}
      />}
      <div
        className="w-12 h-12 md:w-16 md:h-16 mb-1 md:mb-2 items-center justify-center text-xs font-bold text-slate-400"
        style={{ display: gifPath ? "none" : "flex" }}
      >
        <svg aria-hidden="true" viewBox="0 0 48 48" className="w-full h-full"><path d="M6 8h36v25H23L12 42v-9H6Z" fill="currentColor" opacity=".2"/><path d="M6 8h36v25H23L12 42v-9H6Z" fill="none" stroke="currentColor" strokeWidth="3"/><path d="M14 17h20M14 24h13" stroke="currentColor" strokeWidth="3"/></svg>
      </div>
      <span className={`text-lg lg:text-xl font-semibold ${tileStyle.labelText} text-center leading-tight`}>
        {label}
      </span>
    </button>
  );
});

export default TileButton;
