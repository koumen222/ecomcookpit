import React from 'react';
import BuilderAiChat from './BuilderAiChat.jsx';

// Wrapper de compatibilité pour ProductPageBuilder et PremiumPageBuilder
// Props: productPageConfig, theme, productName, onApplyChanges, onApplyTheme
export default function BuilderAIChatWidget({ productPageConfig, theme, productName = '', onApplyChanges, onApplyTheme }) {
  return (
    <BuilderAiChat
      mode="product"
      context={{ productPageConfig, theme, productName }}
      onPatch={({ pageConfigPatch, themePatch }) => {
        if (pageConfigPatch && onApplyChanges) onApplyChanges(pageConfigPatch);
        if (themePatch && onApplyTheme) onApplyTheme(themePatch);
      }}
    />
  );
}
