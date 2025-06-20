import { useState } from 'react';
import CollapsibleSection from '../ui/CollapsibleSection';
import NumberInput from '../ui/NumberInput';
import { ParticleSystemControls } from '../../../../core/src/index';

interface RenderPanelProps {
  controls: ParticleSystemControls;
}

export default function RenderPanel({ controls }: RenderPanelProps) {
  const [particleSize, setParticleSize] = useState(5);
  const [particleColor, setParticleColor] = useState('#ffffff');
  const [useParticleProperties, setUseParticleProperties] = useState(true);

  const handleSizeChange = (size: number) => {
    setParticleSize(size);
    updateRenderOptions(size, particleColor, useParticleProperties);
  };

  const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const color = e.target.value;
    setParticleColor(color);
    updateRenderOptions(particleSize, color, useParticleProperties);
  };

  const handleUsePropertiesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const useProperties = e.target.checked;
    setUseParticleProperties(useProperties);
    updateRenderOptions(particleSize, particleColor, useProperties);
  };

  const updateRenderOptions = (size: number, color: string, useProperties: boolean) => {
    controls.updateRenderOptions({
      size: useProperties ? undefined : size,
      color: useProperties ? undefined : color,
      useParticleSize: useProperties,
      useParticleColor: useProperties
    });
  };

  return (
    <CollapsibleSection title="Render" defaultExpanded={true}>
      <div className="form-group">
        <label className="form-label">
          <input
            type="checkbox"
            checked={useParticleProperties}
            onChange={handleUsePropertiesChange}
            style={{ marginRight: '8px' }}
          />
          Use Individual Particle Properties
        </label>
      </div>

      {!useParticleProperties && (
        <>
          <NumberInput
            label="Particle Size"
            value={particleSize}
            onChange={handleSizeChange}
            min={1}
            max={20}
            step={0.5}
            placeholder="5"
          />

          <div className="form-group">
            <label className="form-label">Particle Color</label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="color"
                value={particleColor}
                onChange={handleColorChange}
                style={{ 
                  width: '40px', 
                  height: '32px', 
                  border: '1px solid #444',
                  borderRadius: '4px',
                  backgroundColor: 'transparent'
                }}
              />
              <input
                type="text"
                className="form-input"
                value={particleColor}
                onChange={handleColorChange}
                style={{ flex: 1 }}
                placeholder="#ffffff"
              />
            </div>
          </div>
        </>
      )}

      <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '15px' }}>
        {useParticleProperties 
          ? 'Using individual particle size and color properties'
          : 'Using global render settings for all particles'
        }
      </div>
    </CollapsibleSection>
  );
}