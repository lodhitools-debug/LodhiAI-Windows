import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  width?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  width = '520px',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 100,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: '100%',
          maxWidth: width,
          backgroundColor: '#0b1329',
          border: '1px solid rgba(56, 189, 248, 0.3)',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(56, 189, 248, 0.15)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          }}
        >
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f8fafc', margin: 0 }}>
            {title}
          </h3>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {children}
        </div>

        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '14px 20px',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              backgroundColor: 'rgba(7, 11, 20, 0.5)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
