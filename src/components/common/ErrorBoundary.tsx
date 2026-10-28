import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { logger } from '../../services/logger';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logger.error('UI Uncaught Exception captured by ErrorBoundary', 'ErrorBoundary', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '40px 20px',
            textAlign: 'center',
            width: '100%',
            height: '100%',
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '32px',
              maxWidth: '560px',
              width: '100%',
              backgroundColor: 'rgba(17, 29, 61, 0.9)',
              border: '1px solid rgba(244, 63, 94, 0.4)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
            }}
          >
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '12px',
                backgroundColor: 'rgba(244, 63, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f43f5e',
              }}
            >
              <AlertTriangle size={28} />
            </div>

            <div>
              <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#f8fafc', margin: '0 0 6px 0' }}>
                {this.props.fallbackTitle || 'Component Error Encountered'}
              </h3>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0, lineHeight: 1.5 }}>
                An unexpected condition occurred in this view. Lodhi AI isolated the component to protect active desktop data.
              </p>
            </div>

            {this.state.error && (
              <div
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#070b14',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#f87171',
                  textAlign: 'left',
                  maxHeight: '120px',
                  overflowY: 'auto',
                  wordBreak: 'break-word',
                }}
              >
                {this.state.error.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <Button
                variant="primary"
                size="sm"
                icon={<RefreshCw size={13} />}
                onClick={this.handleReset}
              >
                Try Again
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
