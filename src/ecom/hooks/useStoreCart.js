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

function toPositiveNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
}

function normalizeQuantity(value) {
  return Math.max(1, parseInt(value, 10) || 1);
}

function cartItemKey(item) {
  return [
    item.productId || item._id || '',
    item.offerQty || '',
    item.offerPrice || '',
  ].join(':');
}

function getLineTotal(item) {
  const hasOffer = item.offerPrice != null || item.offerQty != null;
  const offerPrice = hasOffer ? toPositiveNumber(item.offerPrice) : 0;
  if (offerPrice > 0) return offerPrice;
  return toPositiveNumber(item.price) * normalizeQuantity(item.quantity);
}

export function useStoreCart(subdomain) {
  const [items, setItems] = useState(() => readCart(subdomain));

  const sync = useCallback((next) => {
    setItems(next);
    writeCart(subdomain, next);
  }, [subdomain]);

  const addToCart = useCallback((product, qty = 1) => {
    setItems(prev => {
      const productId = product.productId || product._id;
      const offerPrice = toPositiveNumber(product.offerPrice);
      const offerQty = product.offerQty != null ? normalizeQuantity(product.offerQty) : null;
      const hasOffer = offerPrice > 0 && offerQty;
      const quantity = hasOffer ? offerQty : normalizeQuantity(qty);
      const nextItem = {
        productId,
        name: product.name,
        price: product.price,
        image: product.image || product.images?.[0]?.url || '',
        currency: product.currency || 'XAF',
        quantity,
        ...(hasOffer ? { offerPrice, offerQty } : {}),
      };
      const nextKey = cartItemKey(nextItem);
      const existing = prev.find(i => cartItemKey(i) === nextKey);
      const next = existing
        ? prev.map(i => cartItemKey(i) === nextKey
            ? (hasOffer ? nextItem : { ...i, quantity: normalizeQuantity(i.quantity) + quantity })
            : i)
        : [...prev, nextItem];
      writeCart(subdomain, next);
      return next;
    });
  }, [subdomain]);

  const removeFromCart = useCallback((productId) => {
    setItems(prev => {
      const next = prev.filter(i => i.productId !== productId && cartItemKey(i) !== productId);
      writeCart(subdomain, next);
      return next;
    });
  }, [subdomain]);

  const clearCart = useCallback(() => {
    setItems([]);
    writeCart(subdomain, []);
  }, [subdomain]);

  const cartCount = items.reduce((s, i) => s + normalizeQuantity(i.quantity), 0);
  const cartTotal = items.reduce((s, i) => s + getLineTotal(i), 0);

  return { items, addToCart, removeFromCart, clearCart, cartCount, cartTotal };
}
