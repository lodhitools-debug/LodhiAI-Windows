import React from 'react';
import { Activity, ShieldCheck, Cpu, HardDrive } from 'lucide-react';
import { useApp } from '../../store/AppContext';

export const StatusBar: React.FC = () => {
  const { systemInfo, setActiveScreen, isTauri } = useApp();

  return (
    <footer className="app-statusbar">
      <div className="statusbar-section">
        <div className="statusbar-item">
          <span className="status-dot green animate-pulse-glow" />
          <span>Lodhi AI Engine: <strong>Ready</strong></span>
        </div>

        <div className="statusbar-item">
          <HardDrive size={12} color="#38bdf8" />
          <span>RAM Profile: <strong>{systemInfo ? `${systemInfo.target_ram_gb} GB (Optimized)` : '8 GB (Optimized)'}</strong></span>
        </div>

        <div className="statusbar-item">
          <ShieldCheck size={12} color="#2dd4bf" />
          <span>Sandbox: <strong>Isolated (0 Egress)</strong></span>
        </div>
      </div>

      <div className="statusbar-section">
        <div className="statusbar-item">
          <Cpu size={12} color="#818cf8" />
          <span>Runtime: <strong>{isTauri ? 'Tauri Native Core' : 'Web Evaluation Host'}</strong></span>
        </div>

        <button
          onClick={() => setActiveScreen('diagnostics')}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#38bdf8',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            fontSize: '11px',
            padding: '2px 6px',
            borderRadius: '4px',
          }}
          title="Open Diagnostics and Event Logs"
        >
          <Activity size={12} />
          <span>Diagnostics View</span>
        </button>
      </div>
    </footer>
  );
};
