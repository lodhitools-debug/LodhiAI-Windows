import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  icon,
  style,
  className = '',
  ...props
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
      {label && (
        <label style={{ fontSize: '12px', fontWeight: 500, color: '#94a3b8' }}>
          {label}
        </label>
      )}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: '12px',
              display: 'flex',
              alignItems: 'center',
              color: '#64748b',
              pointerEvents: 'none',
            }}
          >
            {icon}
          </span>
        )}
        <input
          style={{
            width: '100%',
            padding: icon ? '9px 12px 9px 38px' : '9px 14px',
            fontSize: '13px',
            color: '#f8fafc',
            backgroundColor: 'rgba(7, 11, 20, 0.7)',
            border: `1px solid ${error ? '#f43f5e' : 'rgba(255, 255, 255, 0.12)'}`,
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
            ...style,
          }}
          onFocus={e => {
            e.currentTarget.style.borderColor = '#38bdf8';
            e.currentTarget.style.boxShadow = '0 0 0 2px rgba(56, 189, 248, 0.2)';
            props.onFocus?.(e);
          }}
          onBlur={e => {
            e.currentTarget.style.borderColor = error ? '#f43f5e' : 'rgba(255, 255, 255, 0.12)';
            e.currentTarget.style.boxShadow = 'none';
            props.onBlur?.(e);
          }}
          className={`lodhi-input ${className}`}
          {...props}
        />
      </div>
      {error && <span style={{ fontSize: '11px', color: '#f43f5e' }}>{error}</span>}
    </div>
  );
};
