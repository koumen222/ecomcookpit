export function normalizeHomepageSections(rawSections) {
  if (!Array.isArray(rawSections) || rawSections.length === 0) {
    return rawSections;
  }

  const sections = rawSections.map((section) => ({
    ...section,
    config: section?.config ? { ...section.config } : {},
  }));

  const imageTextIndex = sections.findIndex((section) => section?.type === 'image_text');
  const featuresIndex = sections.findIndex((section) => section?.type === 'features');

  if (imageTextIndex === -1 || featuresIndex === -1) {
    return sections;
  }

  const imageTextSection = sections[imageTextIndex];
  const featuresSection = sections[featuresIndex];
  const storyImage = imageTextSection?.config?.image;
  const legacyImage = featuresSection?.config?.image;

  if (storyImage || !legacyImage) {
    return sections;
  }

  sections[imageTextIndex] = {
    ...imageTextSection,
    config: {
      ...imageTextSection.config,
      image: legacyImage,
    },
  };

  sections[featuresIndex] = {
    ...featuresSection,
    config: {
      ...featuresSection.config,
      image: '',
    },
  };

  return sections;
}