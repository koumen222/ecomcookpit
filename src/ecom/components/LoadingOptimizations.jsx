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
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}
