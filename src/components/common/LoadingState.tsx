import React from 'react';

export interface LoadingStateProps {
  message?: string;
  subtext?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading workspace resources...',
  subtext = 'Phase 1 Local Desktop Core',
  size = 'md',
}) => {
  const spinnerSize = size === 'sm' ? 24 : size === 'lg' ? 48 : 36;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 20px',
        width: '100%',
        height: '100%',
        minHeight: '220px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          width: `${spinnerSize}px`,
          height: `${spinnerSize}px`,
          borderRadius: '50%',
          border: '3px solid rgba(56, 189, 248, 0.15)',
          borderTopColor: '#38bdf8',
          borderRightColor: '#818cf8',
          animation: 'spin 0.8s linear infinite',
          marginBottom: '16px',
        }}
      />
      <div style={{ fontSize: size === 'sm' ? '12px' : '14px', fontWeight: 600, color: '#f8fafc' }}>
        {message}
      </div>
      {subtext && (
        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
          {subtext}
        </div>
      )}
    </div>
  );
};
