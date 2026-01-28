import { Slider } from "../ui/Slider";
import { useGameOfLife } from "../../hooks/modules/useGameOfLife";

export function GameOfLifeModule({ enabled = true }: { enabled?: boolean }) {
  const {
    birthMask,
    surviveMask,
    seedDensity,
    cellSize,
    setBirthMask,
    setSurviveMask,
    setSeedDensity,
    setCellSize,
  } = useGameOfLife();

  return (
    <>
      <Slider
        sliderId="gol.birthMask"
        label="Birth Mask"
        value={birthMask}
        min={0}
        max={255}
        step={1}
        formatValue={(v) => `${Math.floor(v)}`}
        onChange={(v) => setBirthMask(Math.floor(v))}
        disabled={!enabled}
      />
      <Slider
        sliderId="gol.surviveMask"
        label="Survive Mask"
        value={surviveMask}
        min={0}
        max={255}
        step={1}
        formatValue={(v) => `${Math.floor(v)}`}
        onChange={(v) => setSurviveMask(Math.floor(v))}
        disabled={!enabled}
      />
      <Slider
        sliderId="gol.seedDensity"
        label="Seed Density"
        value={seedDensity}
        min={0}
        max={1}
        step={0.01}
        formatValue={(v) => v.toFixed(2)}
        onChange={setSeedDensity}
        disabled={!enabled}
      />
      <Slider
        sliderId="gol.cellSize"
        label="Cell Size"
        value={cellSize}
        min={0.5}
        max={10}
        step={0.1}
        formatValue={(v) => v.toFixed(1)}
        onChange={setCellSize}
        disabled={!enabled}
      />
    </>
  );
}
