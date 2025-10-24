import { useCallback } from "react";

// Helper function to parse color string to RGBA object
export const parseColor = (colorStr: string) => {
  // Handle hex colors
  if (colorStr.startsWith("#")) {
    const hex = colorStr.slice(1);
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    return { r, g, b, a: 1 };
  }
  // Fallback to white
  return { r: 1, g: 1, b: 1, a: 1 };
};

// Helper function to randomly select a color
export const useRandomColorSelector = (colors: string[]) => {
  return useCallback(() => {
    if (colors.length === 0) return "#ffffff";
    if (colors.length === 1) return colors[0];
    return colors[Math.floor(Math.random() * colors.length)];
  }, [colors]);
};