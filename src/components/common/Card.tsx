import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  glow?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const Card: React.FC<CardProps> = ({
  children,
  title,
  subtitle,
  action,
  glow = false,
  onClick,
  className = '',
  style,
}) => {
  return (
    <div
      onClick={onClick}
      className={`glass-panel ${glow ? 'glass-panel-glow' : ''} ${className}`}
      style={{
        padding: '20px',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        ...style,
      }}
    >
      {(title || subtitle || action) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '16px',
            gap: '12px',
          }}
        >
          <div>
            {title && (
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
                {title}
              </h3>
            )}
            {subtitle && (
              <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px', margin: 0 }}>
                {subtitle}
              </p>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      {children}
    </div>
  );
};
