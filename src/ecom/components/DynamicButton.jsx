import React from 'react';
import { useTheme } from '../contexts/ThemeContext';

const DynamicButton = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  style = {},
  ...props 
}) => {
  const { getThemeColor, getThemeBorderRadius, getThemeFont } = useTheme();

  const getButtonStyles = () => {
    const baseStyles = {
      fontFamily: getThemeFont(),
      borderRadius: getThemeBorderRadius(),
      border: 'none',
      cursor: 'pointer',
      fontWeight: '600',
      transition: 'all 0.2s ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '0.5rem',
    };

    // Size variants
    const sizeStyles = {
      sm: { padding: '0.5rem 1rem', fontSize: '0.875rem' },
      md: { padding: '0.625rem 1.25rem', fontSize: '0.9375rem' },
      lg: { padding: '0.75rem 1.5rem', fontSize: '1rem' },
    };

    // Color variants
    const variantStyles = {
      primary: {
        backgroundColor: getThemeColor('primary'),
        color: '#FFFFFF',
      },
      cta: {
        backgroundColor: getThemeColor('cta'),
        color: '#FFFFFF',
      },
      secondary: {
        backgroundColor: getThemeColor('secondary'),
        color: '#FFFFFF',
      },
      outline: {
        backgroundColor: 'transparent',
        color: getThemeColor('primary'),
        border: `2px solid ${getThemeColor('primary')}`,
      },
      ghost: {
        backgroundColor: 'transparent',
        color: getThemeColor('primary'),
      },
    };

    return {
      ...baseStyles,
      ...sizeStyles[size],
      ...variantStyles[variant],
      ...style,
    };
  };

  const handleMouseEnter = (e) => {
    if (variant === 'outline' || variant === 'ghost') {
      e.target.style.backgroundColor = getThemeColor('primary');
      e.target.style.color = '#FFFFFF';
    } else {
      e.target.style.opacity = '0.9';
      e.target.style.transform = 'translateY(-1px)';
    }
  };

  const handleMouseLeave = (e) => {
    if (variant === 'outline' || variant === 'ghost') {
      e.target.style.backgroundColor = 'transparent';
      e.target.style.color = getThemeColor('primary');
    } else {
      e.target.style.opacity = '1';
      e.target.style.transform = 'translateY(0)';
    }
  };

  return (
    <button
      className={`theme-transition ${className}`}
      style={getButtonStyles()}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {children}
    </button>
  );
};

export default DynamicButton;
