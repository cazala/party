import { useState } from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import NumberInput from '../ui/NumberInput';
import { ParticleSystemControls, Vector2D } from '../../../../core/src/index';

interface SpawnerPanelProps {
  controls: ParticleSystemControls;
}

export default function SpawnerPanel({ controls }: SpawnerPanelProps) {
  const [spawnType, setSpawnType] = useState<'random' | 'grid' | 'center'>('random');
  const [particleCount, setParticleCount] = useState(50);
  const [gridSpacing, setGridSpacing] = useState(30);
  const [initialVelocity, setInitialVelocity] = useState(50);

  const handleSpawn = () => {
    const { spawner } = controls.state;
    
    spawner.setParticleOptions({
      velocity: Vector2D.random(-initialVelocity, initialVelocity)
    });

    let particles;
    
    switch (spawnType) {
      case 'grid':
        const cols = Math.ceil(Math.sqrt(particleCount));
        const rows = Math.ceil(particleCount / cols);
        particles = spawner.spawnGrid({
          rows,
          cols,
          spacing: new Vector2D(gridSpacing, gridSpacing),
          center: new Vector2D(400, 200)
        });
        break;
      
      case 'center':
        particles = spawner.spawnBurst(new Vector2D(400, 300), particleCount, initialVelocity);
        break;
      
      case 'random':
      default:
        particles = spawner.spawnRandom({
          bounds: {
            min: new Vector2D(50, 50),
            max: new Vector2D(750, 550)
          },
          count: particleCount
        });
        break;
    }

    controls.state.system.addParticles(particles);
  };

  return (
    <CollapsibleSection title="Spawner" defaultExpanded={true}>
      <div className="form-group">
        <label className="form-label">Spawn Pattern</label>
        <select 
          className="form-select"
          value={spawnType}
          onChange={(e) => setSpawnType(e.target.value as any)}
        >
          <option value="random">Random</option>
          <option value="grid">Grid</option>
          <option value="center">Burst from Center</option>
        </select>
      </div>

      <NumberInput
        label="Particle Count"
        value={particleCount}
        onChange={setParticleCount}
        min={1}
        max={200}
        step={1}
        placeholder="50"
      />

      {spawnType === 'grid' && (
        <NumberInput
          label="Grid Spacing"
          value={gridSpacing}
          onChange={setGridSpacing}
          min={10}
          max={100}
          step={5}
          placeholder="30"
        />
      )}

      <NumberInput
        label="Initial Velocity"
        value={initialVelocity}
        onChange={setInitialVelocity}
        min={0}
        max={200}
        step={5}
        placeholder="50"
      />

      <button 
        className="button" 
        onClick={handleSpawn}
        style={{ width: '100%', marginTop: '15px' }}
      >
        Spawn Particles
      </button>
    </CollapsibleSection>
  );
}