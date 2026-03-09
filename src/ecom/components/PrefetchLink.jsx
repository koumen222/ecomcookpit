import React, { forwardRef, useCallback } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { usePrefetch } from '../hooks/usePrefetch.js';

/**
 * Link optimisé avec préchargement automatique au hover
 * Remplace tous les <Link> standard pour une navigation instantanée
 * 
 * Usage: <PrefetchLink to="/ecom/orders">Commandes</PrefetchLink>
 */
const PrefetchLink = forwardRef(({ 
  to, 
  children, 
  prefetch = true,
  prefetchDelay = 50,
  onClick,
  className,
  ...props 
}, ref) => {
  const { prefetchRoute } = usePrefetch();
  const navigate = useNavigate();
  const prefetchTimeout = React.useRef(null);

  const handleMouseEnter = useCallback(() => {
    if (!prefetch || !to) return;
    
    // Délai court pour éviter les requêtes intempestives
    prefetchTimeout.current = setTimeout(() => {
      prefetchRoute(to, { delay: 0 });
    }, prefetchDelay);
  }, [prefetch, to, prefetchRoute, prefetchDelay]);

  const handleMouseLeave = useCallback(() => {
    if (prefetchTimeout.current) {
      clearTimeout(prefetchTimeout.current);
    }
  }, []);

  const handleClick = useCallback((e) => {
    // Si Ctrl/Cmd+clic, laisser le comportement par défaut (ouverture nouvelle onglet)
    if (e.ctrlKey || e.metaKey) {
      return;
    }

    // Précharger immédiatement
    if (prefetch && to) {
      prefetchRoute(to, { delay: 0 });
    }

    // Appeler le onClick personnalisé si fourni
    if (onClick) {
      onClick(e);
    }
  }, [prefetch, to, prefetchRoute, onClick]);

  // Gestion du touch pour mobile
  const handleTouchStart = useCallback(() => {
    if (!prefetch || !to) return;
    prefetchRoute(to, { delay: 0 });
  }, [prefetch, to, prefetchRoute]);

  return (
    <RouterLink
      ref={ref}
      to={to}
      className={className}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onClick={handleClick}
      {...props}
    >
      {children}
    </RouterLink>
  );
});

PrefetchLink.displayName = 'PrefetchLink';

/**
 * NavigationLink avec effet visuel de transition fluide
 * Ajoute une transition visuelle lors de la navigation
 */
export const NavigationLink = forwardRef(({
  to,
  children,
  className = '',
  activeClassName = '',
  isActive = false,
  onClick,
  ...props
}, ref) => {
  const [isNavigating, setIsNavigating] = React.useState(false);
  const navigate = useNavigate();

  const handleClick = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) return;
    
    e.preventDefault();
    setIsNavigating(true);
    
    // Délai très court pour permettre au navigateur de peindre l'état
    requestAnimationFrame(() => {
      navigate(to);
      
      // Reset après la navigation
      setTimeout(() => setIsNavigating(false), 150);
    });

    if (onClick) onClick(e);
  }, [to, navigate, onClick]);

  const combinedClassName = `${className} ${isActive ? activeClassName : ''} ${isNavigating ? 'opacity-70 scale-[0.98]' : ''} transition-all duration-150`.trim();

  return (
    <PrefetchLink
      ref={ref}
      to={to}
      className={combinedClassName}
      onClick={handleClick}
      prefetchDelay={0}
      {...props}
    >
      {children}
    </PrefetchLink>
  );
});

NavigationLink.displayName = 'NavigationLink';

/**
 * ButtonLink - Bouton qui navigue avec préchargement
 */
export const ButtonLink = forwardRef(({
  to,
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  onClick,
  ...props
}, ref) => {
  const navigate = useNavigate();
  const { prefetchRoute } = usePrefetch();

  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
    secondary: 'bg-gray-100 text-gray-700 hover:bg-gray-200 active:bg-gray-300',
    ghost: 'bg-transparent text-gray-600 hover:bg-gray-100 active:bg-gray-200',
    danger: 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
  };

  const sizes = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const handleClick = useCallback((e) => {
    if (disabled) {
      e.preventDefault();
      return;
    }

    // Précharger avant navigation
    prefetchRoute(to, { delay: 0 });

    if (onClick) {
      onClick(e);
    }

    // Navigation
    navigate(to);
  }, [to, navigate, prefetchRoute, onClick, disabled]);

  return (
    <button
      ref={ref}
      onClick={handleClick}
      disabled={disabled}
      className={`
        ${variants[variant] || variants.primary}
        ${sizes[size] || sizes.md}
        rounded-lg font-medium transition-all duration-150
        active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
});

ButtonLink.displayName = 'ButtonLink';

/**
 * MenuItem - Élément de menu avec préchargement
 */
export const MenuItem = forwardRef(({
  to,
  icon: Icon,
  label,
  isActive = false,
  badge,
  onClick,
  ...props
}, ref) => {
  return (
    <PrefetchLink
      ref={ref}
      to={to}
      prefetchDelay={0}
      className={`
        flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-150
        ${isActive 
          ? 'bg-emerald-50 text-emerald-700 font-medium' 
          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        }
        active:scale-[0.98]
      `}
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon className="w-5 h-5 flex-shrink-0" />}
      <span className="flex-1">{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs font-medium rounded-full">
          {badge}
        </span>
      )}
    </PrefetchLink>
  );
});

MenuItem.displayName = 'MenuItem';

export default PrefetchLink;
