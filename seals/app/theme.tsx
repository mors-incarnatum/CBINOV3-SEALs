/**
 * WiKahon Theme Configuration
 * 
 * Edit this file to customize colors, borders, and visual styling across the application.
 */

export const theme = {
  // Full-screen application background
  screenBg: "bg-slate-200",

  // Top navigation / header bar
  header: {
    bg: "bg-white",
    border: "border-slate-300",
  },

  // App logo & title badge
  brand: {
    logoBg: "bg-sky-700",
    logoText: "text-white",
    titleText: "text-slate-800",
  },

  // Center display bar showing currently selected / spoken word
  displayBar: {
    bg: "bg-slate-50",
    border: "border-slate-300",
    text: "text-sky-900",
  },

  // Volume slider controls
  volume: {
    accent: "accent-sky-700",
    icon: "text-slate-500",
  },

  // Column category headers (Needs, Actions, People, Feelings)
  categoryHeader: {
    bg: "bg-slate-300/50",
    border: "border-slate-300",
    text: "text-slate-700",
  },

  // Interactive communication tile buttons (Default/Fallback)
  tile: {
    // Normal / resting state
    bg: "bg-white",
    border: "border-slate-300",
    labelText: "text-slate-800",

    // Hover state (mouse pointer)
    hoverBg: "hover:bg-sky-50/50",
    hoverBorder: "hover:border-sky-600",

    // Active / pressed state (tap or click)
    activeBg: "active:bg-sky-100",
    activeBorder: "active:border-sky-700",

    // Keyboard / accessibility focus ring
    focusRing: "focus:ring-sky-600/40",
  },

  // Category-specific tile and header themes
  categoryTiles: {
    "Needs / Emergency": {
      headerBg: "bg-rose-100",
      headerBorder: "border-rose-300",
      headerText: "text-rose-900",
      bg: "bg-rose-50/70",
      border: "border-rose-300",
      labelText: "text-rose-950",
      hoverBg: "hover:bg-rose-100/80",
      hoverBorder: "hover:border-rose-500",
      activeBg: "active:bg-rose-200",
      activeBorder: "active:border-rose-700",
      focusRing: "focus:ring-rose-500/40",
    },
    "Actions / Response": {
      headerBg: "bg-emerald-100",
      headerBorder: "border-emerald-300",
      headerText: "text-emerald-900",
      bg: "bg-emerald-50/70",
      border: "border-emerald-300",
      labelText: "text-emerald-950",
      hoverBg: "hover:bg-emerald-100/80",
      hoverBorder: "hover:border-emerald-500",
      activeBg: "active:bg-emerald-200",
      activeBorder: "active:border-emerald-700",
      focusRing: "focus:ring-emerald-500/40",
    },
    "People": {
      headerBg: "bg-amber-100",
      headerBorder: "border-amber-300",
      headerText: "text-amber-900",
      bg: "bg-amber-50/70",
      border: "border-amber-300",
      labelText: "text-amber-950",
      hoverBg: "hover:bg-amber-100/80",
      hoverBorder: "hover:border-amber-500",
      activeBg: "active:bg-amber-200",
      activeBorder: "active:border-amber-700",
      focusRing: "focus:ring-amber-500/40",
    },
    "Feelings": {
      headerBg: "bg-blue-100",
      headerBorder: "border-blue-300",
      headerText: "text-blue-900",
      bg: "bg-blue-50/70",
      border: "border-blue-300",
      labelText: "text-blue-950",
      hoverBg: "hover:bg-blue-100/80",
      hoverBorder: "hover:border-blue-500",
      activeBg: "active:bg-blue-200",
      activeBorder: "active:border-blue-700",
      focusRing: "focus:ring-blue-500/40",
    },
  },

  // Empty placeholder boxes rendered while loading
  placeholder: {
    bg: "bg-white",
    border: "border-slate-200",
  },
} as const;

export type Theme = typeof theme;

// Helper hook for backwards compatibility
export function useTheme() {
  return { theme };
}
