import React from 'react';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'blue' | 'purple' | 'teal' | 'amber' | 'emerald' | 'rose' | 'neutral';
  size?: 'sm' | 'md';
  dot?: boolean;
  style?: React.CSSProperties;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'blue',
  size = 'md',
  dot = false,
  style,
  className = '',
}) => {
  const getColors = () => {
    switch (variant) {
      case 'blue':
        return { bg: 'rgba(56, 189, 248, 0.12)', border: 'rgba(56, 189, 248, 0.3)', text: '#38bdf8', dot: '#38bdf8' };
      case 'purple':
        return { bg: 'rgba(129, 140, 248, 0.12)', border: 'rgba(129, 140, 248, 0.3)', text: '#818cf8', dot: '#818cf8' };
      case 'teal':
        return { bg: 'rgba(45, 212, 191, 0.12)', border: 'rgba(45, 212, 191, 0.3)', text: '#2dd4bf', dot: '#2dd4bf' };
      case 'amber':
        return { bg: 'rgba(251, 191, 36, 0.12)', border: 'rgba(251, 191, 36, 0.3)', text: '#fbbf24', dot: '#fbbf24' };
      case 'emerald':
        return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.3)', text: '#34d399', dot: '#10b981' };
      case 'rose':
        return { bg: 'rgba(244, 63, 94, 0.12)', border: 'rgba(244, 63, 94, 0.3)', text: '#fb7185', dot: '#f43f5e' };
      case 'neutral':
      default:
        return { bg: 'rgba(255, 255, 255, 0.06)', border: 'rgba(255, 255, 255, 0.12)', text: '#94a3b8', dot: '#94a3b8' };
    }
  };

  const colors = getColors();
  const padding = size === 'sm' ? '2px 7px' : '3px 10px';
  const fontSize = size === 'sm' ? '11px' : '12px';

  return (
    <span
      className={`lodhi-badge ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding,
        fontSize,
        fontWeight: 500,
        borderRadius: '9999px',
        backgroundColor: colors.bg,
        border: `1px solid ${colors.border}`,
        color: colors.text,
        lineHeight: 1.2,
        letterSpacing: '0.01em',
        userSelect: 'none',
        ...style,
      }}
    >
      {dot && (
        <span
          style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            backgroundColor: colors.dot,
            boxShadow: `0 0 6px ${colors.dot}`,
          }}
        />
      )}
      {children}
    </span>
  );
};
