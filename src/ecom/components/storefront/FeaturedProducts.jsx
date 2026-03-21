import React from 'react';

const ProductCard = ({ product, currency, theme }) => {
  return (
    <div 
      className="bg-white border border-gray-200 overflow-hidden hover:shadow-lg transition-all group"
      style={{ borderRadius: theme?.borderRadius || '0.75rem' }}
    >
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 
          className="font-bold text-gray-900 mb-2 line-clamp-2"
          style={{ fontFamily: theme?.fontFamily || 'inherit' }}
        >
          {product.name}
        </h3>
        
        <div className="flex items-center gap-2">
          <span className="text-xl font-black" style={{ color: theme?.ctaColor || '#0F6B4F' }}>
            {new Intl.NumberFormat('fr-FR').format(product.price)} {currency}
          </span>
          
          {product.compareAtPrice && product.compareAtPrice > product.price && (
            <span className="text-sm text-gray-400 line-through">
              {new Intl.NumberFormat('fr-FR').format(product.compareAtPrice)} {currency}
            </span>
          )}
        </div>
        
        {product.stock !== undefined && product.stock < 10 && (
          <p className="text-xs text-orange-600 mt-2">
            {product.stock > 0 ? `Plus que ${product.stock} en stock` : 'Rupture de stock'}
          </p>
        )}
      </div>
    </div>
  );
};

const FeaturedProducts = ({ config, products, currency, theme }) => {
  const { count = 8, title = 'Nos Produits' } = config || {};
  const displayProducts = products.slice(0, count);
  
  if (displayProducts.length === 0) return null;
  
  return (
    <section id="products" className="py-16 px-4" style={{ backgroundColor: theme?.backgroundColor || '#fff' }}>
      <div className="max-w-7xl mx-auto">
        <h2 
          className="text-3xl md:text-4xl font-black text-center mb-12"
          style={{ 
            color: theme?.textColor || '#111',
            fontFamily: theme?.fontFamily || 'inherit'
          }}
        >
          {title}
        </h2>
        
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
          {displayProducts.map(product => (
            <ProductCard 
              key={product._id} 
              product={product} 
              currency={currency}
              theme={theme}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturedProducts;
