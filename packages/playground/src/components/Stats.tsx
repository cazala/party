import { useEffect, useState, useRef } from "react";
import { useEngine } from "../hooks/useEngine";
import { useDemo } from "../hooks/useDemo";
import "./Stats.css";

export function Stats() {
  const { getCount, getFPS } = useEngine();
  const { isPlaying, hasStarted, reduceParticles } = useDemo();
  const [particleCount, setParticleCount] = useState(0);
  const [fps, setFPS] = useState(0);
  const lowFpsCountRef = useRef(0);
  const hasReducedRef = useRef(false);

  useEffect(() => {
    if (!hasStarted) {
      // Reset monitoring when demo stops
      lowFpsCountRef.current = 0;
      hasReducedRef.current = false;
      setParticleCount(0);
      setFPS(0);
      return;
    }

    const interval = setInterval(() => {
      const currentCount = getCount();
      const currentFPS = getFPS();
      
      setParticleCount(currentCount);
      setFPS(currentFPS);

      // Only monitor FPS when demo is actively playing
      if (isPlaying) {
        // Monitor FPS - if below 30 for 3 consecutive updates, reduce particles
        if (currentFPS < 30 && currentFPS > 0) {
          lowFpsCountRef.current++;
          
          // If FPS has been low for 3 updates and we haven't reduced yet, reduce particles
          if (lowFpsCountRef.current >= 3 && !hasReducedRef.current && currentCount > 0) {
            hasReducedRef.current = true;
            lowFpsCountRef.current = 0;
            
            // Reduce particles by half
            reduceParticles();
          }
        } else {
          // Reset counter if FPS is good
          lowFpsCountRef.current = 0;
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [hasStarted, isPlaying, getCount, getFPS, reduceParticles]);

  // Show stats when demo has started
  if (!hasStarted) {
    return null;
  }

  return (
    <div className="stats">
      <span className="stats-text">
        {particleCount} | {Math.round(fps)}
      </span>
    </div>
  );
}

