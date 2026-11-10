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
    console.error('Exam ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleResume = () => {
    window.location.reload();
  };

  handleClose = () => {
    window.close();
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
          background: '#f6f1e6',
          color: '#2a2722',
          padding: '24px',
          fontFamily: "'Inter', system-ui, sans-serif",
        }}>
          <div style={{
            maxWidth: '500px',
            width: '100%',
            background: '#fbf8f1',
            borderRadius: '12px',
            padding: '32px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
            border: '1px solid #ded4bf',
            textAlign: 'center',
          }}>
            <div style={{
              width: '52px',
              height: '52px',
              borderRadius: '50%',
              background: '#f5e2da',
              color: '#b3352b',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '26px',
              marginBottom: '16px',
            }}>
              <AlertTriangle size={24} strokeWidth={1.75} aria-hidden="true" />
            </div>
            <h2 style={{ fontSize: '1.3rem', fontWeight: 600, marginBottom: '8px' }}>
              Assessment interface interrupted
            </h2>
            <p style={{ color: '#736b5f', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: '24px' }}>
              An interface rendering error occurred. Your answered questions and remaining exam time are safely stored on the server. Click below to resume your assessment.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={this.handleResume}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  background: '#2b44a6',
                  color: '#ffffff',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Resume assessment
              </button>
              <button
                type="button"
                onClick={this.handleClose}
                style={{
                  padding: '10px 20px',
                  borderRadius: '6px',
                  background: '#ebe3d3',
                  color: '#3d3932',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                  border: '1px solid #c6b99e',
                  cursor: 'pointer',
                }}
              >
                Close tab
              </button>
            </div>
            {this.state.error?.message && (
              <details style={{ marginTop: '20px', textAlign: 'left', fontSize: '11px', color: '#998f7d' }}>
                <summary style={{ cursor: 'pointer' }}>Error details</summary>
                <pre style={{
                  marginTop: '6px',
                  padding: '8px',
                  background: '#f6f1e6',
                  borderRadius: '6px',
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
