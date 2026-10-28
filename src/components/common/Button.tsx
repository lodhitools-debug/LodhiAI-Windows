import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'glow';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  iconPosition = 'left',
  loading = false,
  className = '',
  disabled,
  style,
  ...props
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case 'primary':
        return {
          background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
          color: '#ffffff',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          boxShadow: '0 2px 10px rgba(56, 189, 248, 0.25)',
        };
      case 'secondary':
        return {
          background: 'rgba(255, 255, 255, 0.08)',
          color: '#f8fafc',
          border: '1px solid rgba(255, 255, 255, 0.12)',
        };
      case 'outline':
        return {
          background: 'transparent',
          color: '#38bdf8',
          border: '1px solid rgba(56, 189, 248, 0.5)',
        };
      case 'ghost':
        return {
          background: 'transparent',
          color: '#94a3b8',
          border: '1px solid transparent',
        };
      case 'danger':
        return {
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.3)',
        };
      case 'glow':
        return {
          background: 'linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #2dd4bf 100%)',
          color: '#070b14',
          fontWeight: 600,
          border: 'none',
          boxShadow: '0 0 16px rgba(56, 189, 248, 0.45)',
        };
    }
  };

  const getSizeStyles = (): React.CSSProperties => {
    switch (size) {
      case 'sm':
        return { padding: '5px 10px', fontSize: '12px', borderRadius: '6px' };
      case 'lg':
        return { padding: '12px 22px', fontSize: '15px', borderRadius: '10px' };
      default:
        return { padding: '8px 16px', fontSize: '13px', borderRadius: '8px' };
    }
  };

  return (
    <button
      disabled={disabled || loading}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '8px',
        fontWeight: 500,
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
        userSelect: 'none',
        ...getVariantStyles(),
        ...getSizeStyles(),
        ...style,
      }}
      className={`lodhi-btn ${className}`}
      {...props}
    >
      {loading ? (
        <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid currentColor', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
      ) : (
        <>
          {icon && iconPosition === 'left' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
          {children}
          {icon && iconPosition === 'right' && <span style={{ display: 'inline-flex' }}>{icon}</span>}
        </>
      )}
    </button>
  );
};
