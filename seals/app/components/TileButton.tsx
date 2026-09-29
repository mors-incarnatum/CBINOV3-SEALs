"use client";

import React from "react";
import { theme } from "@/app/theme";

interface TileButtonProps {
  id: string;
  label: string;
  gifPath: string;
  category?: string;
  onPress: (label: string) => void;
}

const TileButton = React.memo(function TileButton({
  label,
  gifPath,
  category,
  onPress,
}: TileButtonProps) {
  const tileStyle =
    (category && category in theme.categoryTiles
      ? theme.categoryTiles[category as keyof typeof theme.categoryTiles]
      : theme.tile);

  return (
    <button
      onClick={() => onPress(label)}
      className={`${tileStyle.bg} ${tileStyle.border} ${tileStyle.hoverBg} ${tileStyle.hoverBorder} ${tileStyle.activeBg} ${tileStyle.activeBorder} ${tileStyle.focusRing} border rounded-none shadow-xs transition-all duration-100 flex flex-col items-center justify-center p-2 focus:outline-none focus:ring-2 relative group flex-1`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={gifPath}
        alt={label}
        className="w-12 h-12 md:w-16 md:h-16 object-contain mb-1 md:mb-2 group-hover:scale-105 transition-transform mix-blend-multiply"
        onError={(e) => {
          const target = e.currentTarget;
          target.style.display = "none";
          if (target.nextElementSibling) {
            (target.nextElementSibling as HTMLElement).style.display = "flex";
          }
        }}
      />
      <div
        className="w-12 h-12 md:w-16 md:h-16 mb-1 md:mb-2 items-center justify-center text-xs font-bold text-slate-400"
        style={{ display: "none" }}
      >
        GIF
      </div>
      <span className={`text-lg lg:text-xl font-semibold ${tileStyle.labelText} text-center leading-tight`}>
        {label}
      </span>
    </button>
  );
});

export default TileButton;
