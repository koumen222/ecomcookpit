/**
 * useStoreCart — Minimal localStorage-backed cart for public storefront.
 * Scoped per subdomain to avoid cross-store collisions.
 */
import { useState, useCallback } from 'react';

function getKey(subdomain) {
  return `cart_${subdomain || 'default'}`;
}

function readCart(subdomain) {
  try {
    return JSON.parse(localStorage.getItem(getKey(subdomain)) || '[]');
  } catch {
    return [];
  }
}

function writeCart(subdomain, items) {
  try {
    localStorage.setItem(getKey(subdomain), JSON.stringify(items));
  } catch {}
}

export function useStoreCart(subdomain) {
  const [items, setItems] = useState(() => readCart(subdomain));

  const sync = useCallback((next) => {
    setItems(next);
    writeCart(subdomain, next);
  }, [subdomain]);

  const addToCart = useCallback((product, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === product._id);
      const next = existing
        ? prev.map(i => i.productId === product._id
            ? { ...i, quantity: i.quantity + qty }
            : i)
        : [...prev, {
            productId: product._id,
            name: product.name,
            price: product.price,
            image: product.image || product.images?.[0]?.url || '',
            currency: product.currency || 'XAF',
            quantity: qty,
          }];
      writeCart(subdomain, next);
      return next;
    });
  }, [subdomain]);

  const removeFromCart = useCallback((productId) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId);
      writeCart(subdomain, next);
      return next;
    });
  }, [subdomain]);

  const clearCart = useCallback(() => {
    setItems([]);
    writeCart(subdomain, []);
  }, [subdomain]);

  const cartCount = items.reduce((s, i) => s + i.quantity, 0);
  const cartTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return { items, addToCart, removeFromCart, clearCart, cartCount, cartTotal };
}
