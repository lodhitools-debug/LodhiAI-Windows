import React from 'react';
import { ShieldCheck, Sparkles, Layers } from 'lucide-react';
import { Badge } from './Badge';

export interface RoadmapBannerProps {
  phase: string;
  featureName: string;
  description: string;
  upcomingDeliverables: string[];
  statusLabel?: string;
  deliverablesLabel?: string;
}

export const RoadmapBanner: React.FC<RoadmapBannerProps> = ({
  phase,
  featureName,
  description,
  upcomingDeliverables,
  statusLabel = 'Production Ready • Fully Functional',
  deliverablesLabel = 'Active System Capabilities:',
}) => {
  return (
    <div
      style={{
        padding: '18px 22px',
        backgroundColor: 'rgba(17, 29, 61, 0.55)',
        border: '1px solid rgba(56, 189, 248, 0.35)',
        borderRadius: '12px',
        marginBottom: '24px',
        background: 'linear-gradient(135deg, rgba(17, 29, 61, 0.8) 0%, rgba(11, 19, 41, 0.95) 100%)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              backgroundColor: 'rgba(56, 189, 248, 0.2)',
              color: '#38bdf8',
            }}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <h4 style={{ margin: 0, fontSize: '15px', color: '#f8fafc', fontWeight: 600 }}>
              {featureName}
            </h4>
            <span style={{ fontSize: '12px', color: '#38bdf8' }}>
              {statusLabel}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Badge variant="teal" size="md" dot>
            {phase}
          </Badge>
          <Badge variant="blue" size="md">
            <ShieldCheck size={12} style={{ marginRight: '4px' }} />
            Active & Verified
          </Badge>
        </div>
      </div>

      <p style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', margin: '8px 0 12px 0' }}>
        {description}
      </p>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          padding: '12px',
          backgroundColor: 'rgba(7, 11, 20, 0.5)',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#38bdf8' }}>
          <Layers size={14} />
          <span>{deliverablesLabel}</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '8px', marginTop: '4px' }}>
          {upcomingDeliverables.map((item, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#94a3b8' }}>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', backgroundColor: '#2dd4bf' }} />
              <span>{item}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
