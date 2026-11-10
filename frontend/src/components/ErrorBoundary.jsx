import { AlertTriangle } from 'lucide-react';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleHome = () => {
    window.location.assign('/');
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-color, #f6f1e6)',
          color: 'var(--text-primary, #1b1a17)',
          padding: '24px',
          fontFamily: 'var(--font-family, system-ui, sans-serif)',
        }}>
          <div style={{
            maxWidth: '520px',
            width: '100%',
            background: 'var(--card-bg-solid, #ffffff)',
            borderRadius: '16px',
            padding: '36px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid var(--border-color, #ded4bf)',
            textAlign: 'center',
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: '#f5e2da',
              color: '#b3352b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '28px',
              marginBottom: '20px',
            }}>
              <AlertTriangle size={24} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 600, marginBottom: '10px' }}>
              Something went wrong
            </h2>
            <p style={{ color: 'var(--text-secondary, #736b5f)', fontSize: '0.95rem', lineHeight: 1.5, marginBottom: '28px' }}>
              An unexpected error occurred while displaying this page. Your data is safe. Try reloading or heading back to the home page.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'var(--color-dashboard-blue, #2b44a6)',
                  color: '#ffffff',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(43, 68, 166, 0.25)',
                }}
              >
                Reload page
              </button>
              <button
                type="button"
                onClick={this.handleHome}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: 'var(--bg-color, #ebe3d3)',
                  color: 'var(--text-primary, #1b1a17)',
                  fontWeight: 500,
                  fontSize: '0.95rem',
                  border: '1px solid var(--border-color, #c6b99e)',
                  cursor: 'pointer',
                }}
              >
                Return to Home
              </button>
            </div>
            {this.state.error?.message && (
              <details style={{ marginTop: '24px', textAlign: 'left', fontSize: '12px', color: '#998f7d' }}>
                <summary style={{ cursor: 'pointer', outline: 'none' }}>Technical details</summary>
                <pre style={{
                  marginTop: '8px',
                  padding: '10px',
                  background: '#f6f1e6',
                  borderRadius: '8px',
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  color: '#b3352b',
                }}>
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
