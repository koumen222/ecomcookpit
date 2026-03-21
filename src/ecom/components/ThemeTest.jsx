import React from 'react';
import { useTheme } from '../contexts/ThemeContext';
import DynamicButton from './DynamicButton';

const ThemeTest = () => {
  const { theme, updateTheme } = useTheme();

  const testColors = [
    { name: 'Blue', value: '#3B82F6' },
    { name: 'Green', value: '#10B981' },
    { name: 'Purple', value: '#8B5CF6' },
    { name: 'Red', value: '#EF4444' },
    { name: 'Orange', value: '#F59E0B' },
  ];

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Dynamic Theme Test</h2>
      
      {/* Theme Controls */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Theme Controls</h3>
        
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
          {testColors.map((color) => (
            <button
              key={color.name}
              onClick={() => updateTheme({ primaryColor: color.value })}
              className="flex flex-col items-center p-2 rounded border hover:bg-gray-50"
            >
              <div 
                className="w-8 h-8 rounded-full border mb-1"
                style={{ backgroundColor: color.value }}
              />
              <span className="text-xs">{color.name}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="block text-sm font-medium">Primary Color:</label>
          <input
            type="color"
            value={theme.primaryColor}
            onChange={(e) => updateTheme({ primaryColor: e.target.value })}
            className="w-12 h-8 rounded border"
          />
          
          <label className="block text-sm font-medium mt-4">CTA Color:</label>
          <input
            type="color"
            value={theme.ctaColor}
            onChange={(e) => updateTheme({ ctaColor: e.target.value })}
            className="w-12 h-8 rounded border"
          />
        </div>
      </div>

      {/* Dynamic Components Demo */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Dynamic Components</h3>
        
        <div className="space-y-4">
          <div className="flex gap-2 flex-wrap">
            <DynamicButton variant="primary">Primary Button</DynamicButton>
            <DynamicButton variant="cta">CTA Button</DynamicButton>
            <DynamicButton variant="outline">Outline Button</DynamicButton>
            <DynamicButton variant="ghost">Ghost Button</DynamicButton>
          </div>

          <div className="theme-card p-4">
            <h4 className="theme-text font-semibold mb-2">Theme Card</h4>
            <p className="theme-text--secondary text-sm">
              This card uses dynamic theme classes and will update automatically when colors change.
            </p>
          </div>

          <div 
            className="p-4 rounded-lg"
            style={{
              backgroundColor: theme.backgroundColor,
              color: theme.textColor,
              border: `2px solid ${theme.primaryColor}`,
            }}
          >
            <h4 className="font-semibold mb-2">Inline Styled Component</h4>
            <p className="text-sm opacity-80">
              This component uses inline styles with theme values.
            </p>
          </div>
        </div>
      </div>

      {/* Current Theme Display */}
      <div className="bg-white p-4 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Current Theme Values</h3>
        <pre className="text-sm bg-gray-100 p-3 rounded">
          {JSON.stringify(theme, null, 2)}
        </pre>
      </div>
    </div>
  );
};

export default ThemeTest;
