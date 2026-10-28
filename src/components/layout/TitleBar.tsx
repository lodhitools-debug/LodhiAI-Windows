import React from 'react';
import { Minus, Square, X, Shield } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { Badge } from '../common/Badge';

export const TitleBar: React.FC = () => {
  const { edition, setEdition, isTauri } = useApp();

  const handleMinimize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().minimize();
      } catch (err) {
        console.warn('Minimize window error', err);
      }
    }
  };

  const handleMaximize = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().toggleMaximize();
      } catch (err) {
        console.warn('Toggle maximize error', err);
      }
    }
  };

  const handleClose = async () => {
    if (isTauri) {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window');
        await getCurrentWindow().close();
      } catch (err) {
        console.warn('Close window error', err);
      }
    }
  };

  return (
    <header className="app-titlebar" data-tauri-drag-region>
      <div className="titlebar-drag-region" data-tauri-drag-region>
        {/* Lodhi AI Logo and Identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/logo.svg"
            alt="Lodhi AI Logo"
            style={{ width: '22px', height: '22px', borderRadius: '5px' }}
          />
          <span
            style={{
              fontFamily: 'var(--font-heading)',
              fontWeight: 700,
              fontSize: '14px',
              letterSpacing: '0.04em',
              background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            LODHI AI
          </span>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
            Think • Create • Automate
          </span>
        </div>

        {/* Edition Switcher Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
          {(['free', 'pro', 'business'] as const).map(tier => (
            <button
              key={tier}
              onClick={() => setEdition(tier)}
              style={{
                background: edition === tier ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                border: `1px solid ${edition === tier ? 'rgba(56, 189, 248, 0.4)' : 'rgba(255, 255, 255, 0.06)'}`,
                color: edition === tier ? '#38bdf8' : '#64748b',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={`Switch to ${tier.toUpperCase()} edition preview`}
            >
              {tier}
            </button>
          ))}
        </div>

        {/* Security & Sandbox Tag */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant="teal" size="sm" dot>
            <Shield size={11} style={{ marginRight: '3px' }} />
            Local Sandbox
          </Badge>
          <Badge variant="blue" size="sm" dot>
            All Features Active
          </Badge>
        </div>
      </div>

      {/* Windows Standard Controls */}
      <div className="titlebar-controls" style={{ marginLeft: '12px' }}>
        <button
          onClick={handleMinimize}
          className="window-control-btn"
          title="Minimize"
          aria-label="Minimize"
        >
          <Minus size={14} />
        </button>
        <button
          onClick={handleMaximize}
          className="window-control-btn"
          title="Maximize / Restore"
          aria-label="Maximize / Restore"
        >
          <Square size={12} />
        </button>
        <button
          onClick={handleClose}
          className="window-control-btn close"
          title="Close"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
    </header>
  );
};
