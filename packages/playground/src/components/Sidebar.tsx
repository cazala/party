import EnvironmentPanel from './controls/EnvironmentPanel';
import SpawnerPanel from './controls/SpawnerPanel';
import RenderPanel from './controls/RenderPanel';
import { ParticleSystemControls } from '../../../core/src/index';

interface SidebarProps {
  controls: ParticleSystemControls;
}

export default function Sidebar({ controls }: SidebarProps) {
  return (
    <div className="sidebar">
      <EnvironmentPanel controls={controls} />
      <SpawnerPanel controls={controls} />
      <RenderPanel controls={controls} />
    </div>
  );
}