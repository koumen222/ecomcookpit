import defaultConfig from '../components/productSettings/defaultConfig.js';

const clone = (value) => JSON.parse(JSON.stringify(value));

const cloneOrFallback = (value, fallback) => clone(value ?? fallback);

const mergeSectionCollection = (storedSections, fallbackSections = defaultConfig.general.sections) => {
  const defaults = cloneOrFallback(fallbackSections, []);
  if (!Array.isArray(storedSections) || storedSections.length === 0) {
    return defaults;
  }

  const merged = storedSections.map((section) => {
    const base = defaults.find((candidate) => candidate.id === section.id);
    return base ? { ...base, ...section } : cloneOrFallback(section, {});
  });

  defaults.forEach((base) => {
    if (!merged.find((section) => section.id === base.id)) {
      merged.push(base);
    }
  });

  return merged;
};

const stripStoreSectionContent = (sections) => {
  if (!Array.isArray(sections)) return [];
  return clone(sections).map((section) => {
    const next = { ...section };
    delete next.content;
    return next;
  });
};

export function mergeInheritedProductPageSections(storeSections, productSections) {
  const inheritedSections = mergeSectionCollection(stripStoreSectionContent(storeSections));

  if (!Array.isArray(productSections) || productSections.length === 0) {
    return inheritedSections;
  }

  const remaining = inheritedSections.map((section) => ({ ...section }));
  const merged = clone(productSections).map((productSection) => {
    const inheritedIndex = remaining.findIndex((section) => section.id === productSection.id);
    const inheritedBase = inheritedIndex >= 0 ? remaining.splice(inheritedIndex, 1)[0] : null;
    return inheritedBase ? { ...inheritedBase, ...productSection } : productSection;
  });

  return [...merged, ...remaining];
}

export function buildMergedProductPageConfig(storeConfig, productConfig) {
  const store = cloneOrFallback(storeConfig, {});
  const product = cloneOrFallback(productConfig, {});

  return {
    ...store,
    ...product,
    general: {
      ...(store.general || {}),
      ...(product.general || {}),
      sections: mergeInheritedProductPageSections(store.general?.sections, product.general?.sections),
    },
    design: {
      ...(store.design || {}),
      ...(product.design || {}),
    },
    button: {
      ...(store.button || {}),
      ...(product.button || {}),
    },
    conversion: {
      ...(store.conversion || {}),
      ...(product.conversion || {}),
    },
  };
}

export function buildProductOnlyPageConfig(existingProductConfig, sections) {
  const product = cloneOrFallback(existingProductConfig, {});

  return {
    ...product,
    general: {
      ...(product.general || {}),
      sections: cloneOrFallback(sections, []),
    },
  };
}