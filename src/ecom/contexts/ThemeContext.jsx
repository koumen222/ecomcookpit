import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useEcomAuth } from '../hooks/useEcomAuth';
import { useThemeSocket } from '../hooks/useThemeSocket';
import api from '../../lib/api';

const ThemeContext = createContext();

export const DEFAULT_THEME = {
  template: 'classic',
  primaryColor: '#0F6B4F',
  ctaColor: '#059669',
  backgroundColor: '#FFFFFF',
  textColor: '#111827',
  secondaryColor: '#6B7280',
  accentColor: '#F59E0B',
  successColor: '#10B981',
  errorColor: '#EF4444',
  warningColor: '#F59E0B',
  font: 'inter',
  borderRadius: 'lg',
  sections: {
    showReviews: true,
    showFaq: true,
    showStockCounter: false,
    showPromoBanner: true,
    showTrustBadges: true,
    showRelatedProducts: true,
    showWhatsappButton: false,
    showBenefits: true,
    showNewsletter: false,
  },
};

const FONT_FAMILIES = {
  inter: 'Inter, system-ui, sans-serif',
  poppins: 'Poppins, sans-serif',
  'dm-sans': '"DM Sans", sans-serif',
  montserrat: 'Montserrat, sans-serif',
  playfair: '"Playfair Display", serif',
  'space-grotesk': '"Space Grotesk", sans-serif',
};

const BORDER_RADIUS_VALUES = {
  none: '0px',
  sm: '0.375rem',
  md: '0.75rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
};

export function ThemeProvider({ children, subdomain = null }) {
  const { workspace } = useEcomAuth();
  const [theme, setTheme] = useState(DEFAULT_THEME);
  const [loading, setLoading] = useState(true);
  const [cssVariables, setCssVariables] = useState({});

  // Listen to theme updates via WebSocket for real-time preview
  useThemeSocket(subdomain, (receivedTheme) => {
    if (receivedTheme) {
      setTheme(prev => ({ ...prev, ...receivedTheme }));
    }
  });

  // Generate CSS variables from theme
  const generateCssVariables = useCallback((themeData) => {
    const fontFamily = FONT_FAMILIES[themeData.font] || FONT_FAMILIES.inter;
    const borderRadius = BORDER_RADIUS_VALUES[themeData.borderRadius] || BORDER_RADIUS_VALUES.lg;
    
    return {
      '--theme-primary': themeData.primaryColor,
      '--theme-cta': themeData.ctaColor,
      '--theme-background': themeData.backgroundColor,
      '--theme-text': themeData.textColor,
      '--theme-secondary': themeData.secondaryColor || '#6B7280',
      '--theme-accent': themeData.accentColor || '#F59E0B',
      '--theme-success': themeData.successColor || '#10B981',
      '--theme-error': themeData.errorColor || '#EF4444',
      '--theme-warning': themeData.warningColor || '#F59E0B',
      '--theme-font-family': fontFamily,
      '--theme-border-radius': borderRadius,
      '--theme-border-radius-sm': `calc(${borderRadius} * 0.5)`,
      '--theme-border-radius-lg': `calc(${borderRadius} * 1.5)`,
    };
  }, []);

  // Load initial theme
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const response = await api.get('/store/theme');
        const loadedTheme = { ...DEFAULT_THEME, ...(response.data?.data || {}) };
        setTheme(loadedTheme);
      } catch (error) {
        console.warn('Failed to load theme, using defaults:', error);
        setTheme(DEFAULT_THEME);
      } finally {
        setLoading(false);
      }
    };

    if (workspace?.id) {
      loadTheme();
    } else {
      setLoading(false);
    }
  }, [workspace?.id]);

  // Update CSS variables when theme changes
  useEffect(() => {
    const variables = generateCssVariables(theme);
    setCssVariables(variables);
    
    // Apply CSS variables to document root
    const root = document.documentElement;
    Object.entries(variables).forEach(([property, value]) => {
      root.style.setProperty(property, value);
    });
  }, [theme, generateCssVariables]);

  // Update theme function
  const updateTheme = useCallback(async (updates, persist = true) => {
    const newTheme = typeof updates === 'function' ? updates(theme) : { ...theme, ...updates };
    setTheme(newTheme);

    if (persist) {
      try {
        await api.put('/store/theme', newTheme);
      } catch (error) {
        console.error('Failed to save theme:', error);
      }
    }
  }, [theme]);

  // Get computed style function
  const getThemeColor = useCallback((colorKey) => {
    const colorMap = {
      primary: theme.primaryColor,
      cta: theme.ctaColor,
      background: theme.backgroundColor,
      text: theme.textColor,
      secondary: theme.secondaryColor || '#6B7280',
      accent: theme.accentColor || '#F59E0B',
      success: theme.successColor || '#10B981',
      error: theme.errorColor || '#EF4444',
      warning: theme.warningColor || '#F59E0B',
    };
    return colorMap[colorKey] || colorKey;
  }, [theme]);

  // Get font family function
  const getThemeFont = useCallback(() => {
    return FONT_FAMILIES[theme.font] || FONT_FAMILIES.inter;
  }, [theme.font]);

  // Get border radius function
  const getThemeBorderRadius = useCallback((size = 'default') => {
    const base = BORDER_RADIUS_VALUES[theme.borderRadius] || BORDER_RADIUS_VALUES.lg;
    if (size === 'sm') return `calc(${base} * 0.5)`;
    if (size === 'lg') return `calc(${base} * 1.5)`;
    return base;
  }, [theme.borderRadius]);

  const contextValue = {
    theme,
    loading,
    cssVariables,
    updateTheme,
    getThemeColor,
    getThemeFont,
    getThemeBorderRadius,
    // Helper functions for common patterns
    getButtonStyle: (variant = 'primary') => ({
      backgroundColor: variant === 'primary' ? theme.primaryColor : variant === 'cta' ? theme.ctaColor : theme.secondaryColor,
      color: '#FFFFFF',
      borderRadius: getThemeBorderRadius(),
      fontFamily: getThemeFont(),
    }),
    getTextStyle: (variant = 'body') => ({
      color: variant === 'primary' ? theme.textColor : variant === 'secondary' ? theme.secondaryColor : theme.textColor,
      fontFamily: getThemeFont(),
    }),
  };

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// Hook for applying theme styles to components
export function useThemeStyles() {
  const { theme, getThemeColor, getThemeFont, getThemeBorderRadius } = useTheme();

  return {
    // Common component styles
    button: (variant = 'primary', size = 'md') => ({
      backgroundColor: getThemeColor(variant),
      color: variant === 'outline' ? getThemeColor('primary') : '#FFFFFF',
      border: variant === 'outline' ? `1px solid ${getThemeColor('primary')}` : 'none',
      borderRadius: getThemeBorderRadius(),
      fontFamily: getThemeFont(),
      padding: size === 'sm' ? '0.5rem 1rem' : size === 'lg' ? '0.75rem 1.5rem' : '0.625rem 1.25rem',
      fontSize: size === 'sm' ? '0.875rem' : size === 'lg' ? '1rem' : '0.9375rem',
      fontWeight: '600',
      transition: 'all 0.2s ease',
    }),
    
    card: (elevated = false) => ({
      backgroundColor: getThemeColor('background'),
      border: `1px solid ${getThemeColor('secondary')}20`,
      borderRadius: getThemeBorderRadius(),
      boxShadow: elevated ? `0 4px 6px -1px ${getThemeColor('text')}10` : 'none',
    }),
    
    input: () => ({
      backgroundColor: getThemeColor('background'),
      border: `1px solid ${getThemeColor('secondary')}40`,
      borderRadius: getThemeBorderRadius('sm'),
      color: getThemeColor('text'),
      fontFamily: getThemeFont(),
      padding: '0.625rem 0.75rem',
      fontSize: '0.9375rem',
    }),
    
    text: (variant = 'body') => ({
      color: getThemeColor(variant === 'primary' ? 'text' : variant === 'secondary' ? 'secondary' : variant),
      fontFamily: getThemeFont(),
    }),
  };
}
