/**
 * LoadingOptimizations.jsx - Composants d'optimisation du chargement
 */

// Suspense invisible - pas de loader visible
export const InvisibleSuspense = ({ children, fallback = null }) => {
  return (
    <React.Suspense fallback={fallback}>
      {children}
    </React.Suspense>
  );
};

// Transition de page fluide
export const PageTransition = ({ children, locationKey }) => {
  return (
    <div key={locationKey} className="page-transition">
      {children}
    </div>
  );
};

// Error boundary minimal
export class MinimalErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 24, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>
          Une erreur est survenue.{' '}
          <button onClick={() => this.setState({ hasError: false })} style={{ color: '#0F6B4F', textDecoration: 'underline', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14 }}>
            Réessayer
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
