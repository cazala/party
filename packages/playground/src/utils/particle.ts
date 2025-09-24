export const getRandomColor = () => {
  const colors = [
    "#F8F8F8", // Bright White
    "#FF3C3C", // Neon Red
    "#00E0FF", // Cyber Cyan
    "#C85CFF", // Electric Purple
    "#AFFF00", // Lime Neon
    "#FF2D95", // Hot Magenta
    "#FF6A00", // Sunset Orange
    "#3B82F6", // Deep Blue Glow
    "#00FFC6", // Turquoise Mint
  ];
  return colors[(Math.random() * colors.length) | 0];
};

export const calculateMassFromSize = (size: number): number => {
  const radius = size;
  const area = Math.PI * radius * radius;
  return area / 100; // Scale factor keeps default reasonable
};
