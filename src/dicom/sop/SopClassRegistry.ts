/**
 * Non-image SOP Class UIDs (Presentation States, Encapsulated PDFs, etc.)
 * Series with these SOPClassUIDs in their template should be excluded
 * from the image list.
 */
export const NON_IMAGE_SOP_CLASSES = new Set([
  '1.2.840.10008.5.1.4.1.1.11.1',   // Grayscale Softcopy Presentation State
  '1.2.840.10008.5.1.4.1.1.104.1',  // Encapsulated PDF
]);

/**
 * Extensible SOP class registry.
 * Add new SOP classes here as support grows (e.g. CT, MR, US, RT, SR).
 */
export const IMAGE_SOP_CLASSES: Record<string, string> = {
  '1.2.840.10008.5.1.4.1.1.2': 'CT Image Storage',
  '1.2.840.10008.5.1.4.1.1.4': 'MR Image Storage',
  '1.2.840.10008.5.1.4.1.1.1': 'CR Image Storage',
  '1.2.840.10008.5.1.4.1.1.1.1': 'Digital X-Ray Image Storage',
  '1.2.840.10008.5.1.4.1.1.7': 'Secondary Capture Image Storage',
};
