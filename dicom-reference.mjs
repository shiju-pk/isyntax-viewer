/**
 * Extract pixel data from the DICOM, apply MLUT + WC/WW as per DICOM spec,
 * and write a reference PNG for visual comparison.
 */
import fs from 'fs';

const buf = fs.readFileSync('../OriginalDicom/iSyntax MLUT Applied.dcm');

// --- Helper: find DICOM tag offset ---
function findTag(buf, group, element) {
  const g0 = group & 0xFF, g1 = (group >> 8) & 0xFF;
  const e0 = element & 0xFF, e1 = (element >> 8) & 0xFF;
  for (let i = 0; i < buf.length - 8; i++) {
    if (buf[i] === g0 && buf[i+1] === g1 && buf[i+2] === e0 && buf[i+3] === e1) {
      return i;
    }
  }
  return -1;
}

function readUS(buf, off) {
  return buf.readUInt16LE(off + 8); // tag(4) + VR(2) + len(2) => data starts at +8
}

function readDS(buf, off) {
  const vr = String.fromCharCode(buf[off+4], buf[off+5]);
  let valOff, valLen;
  if (vr === 'DS' || vr === 'IS') {
    valLen = buf.readUInt16LE(off + 6);
    valOff = off + 8;
  } else {
    valLen = buf.readUInt32LE(off + 8);
    valOff = off + 12;
  }
  return parseFloat(buf.subarray(valOff, valOff + valLen).toString('ascii').trim());
}

// --- Read DICOM metadata ---
const rows = readUS(buf, findTag(buf, 0x0028, 0x0010));
const cols = readUS(buf, findTag(buf, 0x0028, 0x0011));
const bitsAllocated = readUS(buf, findTag(buf, 0x0028, 0x0100));
const bitsStored = readUS(buf, findTag(buf, 0x0028, 0x0101));
const highBit = readUS(buf, findTag(buf, 0x0028, 0x0102));
const pixelRep = readUS(buf, findTag(buf, 0x0028, 0x0103));
const wc = readDS(buf, findTag(buf, 0x0028, 0x1050));
const ww = readDS(buf, findTag(buf, 0x0028, 0x1051));

console.log('DICOM metadata:');
console.log(`  Rows: ${rows}, Cols: ${cols}`);
console.log(`  BitsAllocated: ${bitsAllocated}, BitsStored: ${bitsStored}, HighBit: ${highBit}`);
console.log(`  PixelRepresentation: ${pixelRep}`);
console.log(`  WindowCenter: ${wc}, WindowWidth: ${ww}`);

// --- Read LUT ---
const lutDescOff = findTag(buf, 0x0028, 0x3002);
const lutDescVR = String.fromCharCode(buf[lutDescOff+4], buf[lutDescOff+5]);
const lutDescDataOff = lutDescOff + 8; // US VR: tag(4)+VR(2)+len(2)
const lutNumEntries = buf.readUInt16LE(lutDescDataOff) || 65536;
const lutFirstMapped = buf.readUInt16LE(lutDescDataOff + 2);
const lutBitsPerEntry = buf.readUInt16LE(lutDescDataOff + 4);
console.log(`  LUT: numEntries=${lutNumEntries}, firstMapped=${lutFirstMapped}, bitsPerEntry=${lutBitsPerEntry}`);

const lutDataOff = findTag(buf, 0x0028, 0x3006);
const lutDataLen = buf.readUInt32LE(lutDataOff + 8); // OW VR: tag(4)+VR(2)+reserved(2)+len(4)
const lutDataStart = lutDataOff + 12;
const lutTable = new Array(lutNumEntries);
for (let i = 0; i < lutNumEntries; i++) {
  lutTable[i] = buf.readUInt16LE(lutDataStart + i * 2);
}
console.log(`  LUT first 5: [${lutTable.slice(0, 5)}]`);
console.log(`  LUT last  5: [${lutTable.slice(-5)}]`);
console.log(`  LUT min: ${Math.min(...lutTable)}, max: ${Math.max(...lutTable)}`);

// --- Read pixel data ---
const pixelDataOff = findTag(buf, 0x7FE0, 0x0010);
const pixelVR = String.fromCharCode(buf[pixelDataOff+4], buf[pixelDataOff+5]);
let pixelStart, pixelLen;
if (pixelVR === 'OW' || pixelVR === 'OB') {
  pixelLen = buf.readUInt32LE(pixelDataOff + 8);
  pixelStart = pixelDataOff + 12;
} else {
  pixelLen = buf.readUInt16LE(pixelDataOff + 6);
  pixelStart = pixelDataOff + 8;
}
console.log(`  Pixel data: VR=${pixelVR}, offset=${pixelStart}, length=${pixelLen}`);

const totalPixels = rows * cols;
const pixelData = new Uint16Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  let val = buf.readUInt16LE(pixelStart + i * 2);
  // Mask to bitsStored
  val = val & ((1 << bitsStored) - 1);
  pixelData[i] = val;
}

// Stats
let pMin = pixelData[0], pMax = pixelData[0];
for (let i = 1; i < totalPixels; i++) {
  if (pixelData[i] < pMin) pMin = pixelData[i];
  if (pixelData[i] > pMax) pMax = pixelData[i];
}
console.log(`  Pixel range: ${pMin} - ${pMax}`);

// --- Apply MLUT: stored → modality ---
function applyMLUT(storedValue) {
  const idx = storedValue - lutFirstMapped;
  if (idx < 0) return lutTable[0];
  if (idx >= lutNumEntries) return lutTable[lutNumEntries - 1];
  return lutTable[idx];
}

// --- Apply VOI windowing: modality → display (0-255) ---
function applyVOI(modalityValue) {
  const lower = wc - 0.5 - (ww - 1) / 2;
  const upper = wc - 0.5 + (ww - 1) / 2;
  if (modalityValue <= lower) return 0;
  if (modalityValue > upper) return 255;
  return ((modalityValue - (wc - 0.5)) / (ww - 1) + 0.5) * 255;
}

// --- Generate reference image ---
const outputPixels = new Uint8Array(totalPixels);
// Also track modality output range
let modMin = Infinity, modMax = -Infinity;
for (let i = 0; i < totalPixels; i++) {
  const mod = applyMLUT(pixelData[i]);
  if (mod < modMin) modMin = mod;
  if (mod > modMax) modMax = mod;
  const display = applyVOI(mod);
  outputPixels[i] = Math.round(Math.min(255, Math.max(0, display)));
}
console.log(`  Modality output range: ${modMin} - ${modMax}`);
console.log(`  VOI lower: ${wc - 0.5 - (ww-1)/2}, VOI upper: ${wc - 0.5 + (ww-1)/2}`);

// --- Write as raw PGM (can be opened in any image viewer) ---
const pgm = Buffer.concat([
  Buffer.from(`P5\n${cols} ${rows}\n255\n`, 'ascii'),
  Buffer.from(outputPixels),
]);
fs.writeFileSync('dicom-reference.pgm', pgm);
console.log('\nWrote dicom-reference.pgm');

// --- Also generate what our code does (simulate 8-bit JPEG path) ---
// Simulate: server sends 8-bit JPEG = pixelData >> (bitsStored - 8)
const jpegPixels = new Uint8Array(totalPixels);
const shift = bitsStored - 8; // 12 - 8 = 4
for (let i = 0; i < totalPixels; i++) {
  jpegPixels[i] = pixelData[i] >> shift;
}
let jpMin = jpegPixels[0], jpMax = jpegPixels[0];
for (let i = 1; i < totalPixels; i++) {
  if (jpegPixels[i] < jpMin) jpMin = jpegPixels[i];
  if (jpegPixels[i] > jpMax) jpMax = jpegPixels[i];
}
console.log(`\nSimulated JPEG 8-bit range: ${jpMin} - ${jpMax}`);

// Apply MLUT to 8-bit data (LUT covers 0-255 input)
const jpegModality = new Array(totalPixels);
let jmMin = Infinity, jmMax = -Infinity;
for (let i = 0; i < totalPixels; i++) {
  const mod = applyMLUT(jpegPixels[i]);
  jpegModality[i] = mod;
  if (mod < jmMin) jmMin = mod;
  if (mod > jmMax) jmMax = mod;
}
console.log(`JPEG→MLUT modality range: ${jmMin} - ${jmMax}`);

// Now apply VOI with raw DICOM WC/WW
const jpegOut1 = new Uint8Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  jpegOut1[i] = Math.round(Math.min(255, Math.max(0, applyVOI(jpegModality[i]))));
}
const pgm2 = Buffer.concat([
  Buffer.from(`P5\n${cols} ${rows}\n255\n`, 'ascii'),
  Buffer.from(jpegOut1),
]);
fs.writeFileSync('jpeg-mlut-original-ww.pgm', pgm2);
console.log('Wrote jpeg-mlut-original-ww.pgm (JPEG 8bit + MLUT + original WC/WW)');

// Apply VOI with scaled WC/WW
const scaleFactor = ((1 << bitsStored) - 1) / 255;
const scaledWC = wc / scaleFactor;
const scaledWW = ww / scaleFactor;
console.log(`Scaled WC: ${scaledWC}, Scaled WW: ${scaledWW}`);

function applyScaledVOI(modalityValue) {
  const lower = scaledWC - 0.5 - (scaledWW - 1) / 2;
  const upper = scaledWC - 0.5 + (scaledWW - 1) / 2;
  if (modalityValue <= lower) return 0;
  if (modalityValue > upper) return 255;
  return ((modalityValue - (scaledWC - 0.5)) / (scaledWW - 1) + 0.5) * 255;
}

const jpegOut2 = new Uint8Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  jpegOut2[i] = Math.round(Math.min(255, Math.max(0, applyScaledVOI(jpegModality[i]))));
}
const pgm3 = Buffer.concat([
  Buffer.from(`P5\n${cols} ${rows}\n255\n`, 'ascii'),
  Buffer.from(jpegOut2),
]);
fs.writeFileSync('jpeg-mlut-scaled-ww.pgm', pgm3);
console.log('Wrote jpeg-mlut-scaled-ww.pgm (JPEG 8bit + MLUT + scaled WC/WW)');

// Auto-window from MLUT output range
const autoWW = jmMax - jmMin || 1;
const autoWC = (jmMax + jmMin) / 2;
function applyAutoVOI(modalityValue) {
  const lower = autoWC - 0.5 - (autoWW - 1) / 2;
  const upper = autoWC - 0.5 + (autoWW - 1) / 2;
  if (modalityValue <= lower) return 0;
  if (modalityValue > upper) return 255;
  return ((modalityValue - (autoWC - 0.5)) / (autoWW - 1) + 0.5) * 255;
}
const jpegOut3 = new Uint8Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  jpegOut3[i] = Math.round(Math.min(255, Math.max(0, applyAutoVOI(jpegModality[i]))));
}
const pgm4 = Buffer.concat([
  Buffer.from(`P5\n${cols} ${rows}\n255\n`, 'ascii'),
  Buffer.from(jpegOut3),
]);
fs.writeFileSync('jpeg-mlut-auto-ww.pgm', pgm4);
console.log('Wrote jpeg-mlut-auto-ww.pgm (JPEG 8bit + MLUT + auto WC/WW)');

// No MLUT, just raw 8-bit JPEG with auto-window
const jpegOut4 = new Uint8Array(totalPixels);
const rawAutoWW = jpMax - jpMin || 1;
const rawAutoWC = (jpMax + jpMin) / 2;
for (let i = 0; i < totalPixels; i++) {
  const norm = (jpegPixels[i] - jpMin) / rawAutoWW * 255;
  jpegOut4[i] = Math.round(Math.min(255, Math.max(0, norm)));
}
const pgm5 = Buffer.concat([
  Buffer.from(`P5\n${cols} ${rows}\n255\n`, 'ascii'),
  Buffer.from(jpegOut4),
]);
fs.writeFileSync('jpeg-no-mlut-auto.pgm', pgm5);
console.log('Wrote jpeg-no-mlut-auto.pgm (JPEG 8bit, no MLUT, auto window)');
