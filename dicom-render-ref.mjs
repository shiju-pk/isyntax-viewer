/**
 * Render the reference DICOM image (iSyntax MLUT Applied.dcm) with correct
 * MLUT + VOI pipeline, producing a raw RGBA file that we can inspect.
 */
import fs from 'fs';

const buf = fs.readFileSync('../OriginalDicom/iSyntax MLUT Applied.dcm');

// ---- Helper: find a DICOM tag offset ----
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
  return buf.readUInt16LE(off + 8); // tag(4) + VR(2) + length(2) = 8
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

// ---- Read DICOM metadata ----
const rows = readUS(buf, findTag(buf, 0x0028, 0x0010));
const cols = readUS(buf, findTag(buf, 0x0028, 0x0011));
const bitsAllocated = readUS(buf, findTag(buf, 0x0028, 0x0100));
const bitsStored = readUS(buf, findTag(buf, 0x0028, 0x0101));
const highBit = readUS(buf, findTag(buf, 0x0028, 0x0102));
const pixelRep = readUS(buf, findTag(buf, 0x0028, 0x0103));
const wc = readDS(buf, findTag(buf, 0x0028, 0x1050));
const ww = readDS(buf, findTag(buf, 0x0028, 0x1051));

console.log('Image:', rows, 'x', cols);
console.log('BitsAllocated:', bitsAllocated, 'BitsStored:', bitsStored, 'HighBit:', highBit, 'PixelRep:', pixelRep);
console.log('WindowCenter:', wc, 'WindowWidth:', ww);

// ---- Read LUT Descriptor and LUT Data ----
const lutDescOff = findTag(buf, 0x0028, 0x3002);
const numLUTEntries = buf.readUInt16LE(lutDescOff + 8) || 65536;
const firstMapped = buf.readUInt16LE(lutDescOff + 10);
const bitsPerEntry = buf.readUInt16LE(lutDescOff + 12);
console.log('LUT Descriptor: numEntries:', numLUTEntries, 'firstMapped:', firstMapped, 'bitsPerEntry:', bitsPerEntry);

const lutDataOff = findTag(buf, 0x0028, 0x3006);
// OW VR: tag(4) + VR(2) + reserved(2) + length(4) = 12
const lutDataLen = buf.readUInt32LE(lutDataOff + 8);
const lutValues = [];
for (let i = 0; i < numLUTEntries; i++) {
  lutValues.push(buf.readUInt16LE(lutDataOff + 12 + i * 2));
}
console.log('LUT[0..4]:', lutValues.slice(0, 5));
console.log('LUT[251..255]:', lutValues.slice(251));

// ---- Read Pixel Data ----
const pixDataOff = findTag(buf, 0x7FE0, 0x0010);
const pixVR = String.fromCharCode(buf[pixDataOff+4], buf[pixDataOff+5]);
let pixOff, pixLen;
if (pixVR === 'OW' || pixVR === 'OB') {
  // OW/OB: tag(4) + VR(2) + reserved(2) + length(4)
  pixLen = buf.readUInt32LE(pixDataOff + 8);
  pixOff = pixDataOff + 12;
} else {
  pixLen = buf.readUInt16LE(pixDataOff + 6);
  pixOff = pixDataOff + 8;
}
console.log('Pixel data offset:', pixOff, 'length:', pixLen, 'VR:', pixVR);
console.log('Expected:', rows * cols * (bitsAllocated / 8), 'bytes');

// Read as unsigned 16-bit
const totalPixels = rows * cols;
const pixelData = new Uint16Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  pixelData[i] = buf.readUInt16LE(pixOff + i * 2);
}

// Mask to bitsStored
const mask = (1 << bitsStored) - 1;
for (let i = 0; i < totalPixels; i++) {
  pixelData[i] &= mask;
}

// Pixel stats
let pMin = pixelData[0], pMax = pixelData[0];
for (let i = 1; i < totalPixels; i++) {
  if (pixelData[i] < pMin) pMin = pixelData[i];
  if (pixelData[i] > pMax) pMax = pixelData[i];
}
console.log('Pixel range:', pMin, '-', pMax);

// ---- Apply Modality LUT ----
const modalityValues = new Float64Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  const sv = pixelData[i];
  const idx = sv - firstMapped;
  if (idx < 0) modalityValues[i] = lutValues[0];
  else if (idx >= numLUTEntries) modalityValues[i] = lutValues[numLUTEntries - 1];
  else modalityValues[i] = lutValues[idx];
}

let mMin = modalityValues[0], mMax = modalityValues[0];
for (let i = 1; i < totalPixels; i++) {
  if (modalityValues[i] < mMin) mMin = modalityValues[i];
  if (modalityValues[i] > mMax) mMax = modalityValues[i];
}
console.log('Modality range:', mMin, '-', mMax);

// ---- Apply VOI LUT (linear windowing) ----
// DICOM linear: output = ((x - (c - 0.5)) / (w - 1) + 0.5) * 255
const lower = wc - 0.5 - (ww - 1) / 2;
const upper = wc - 0.5 + (ww - 1) / 2;
console.log('VOI window: lower =', lower, 'upper =', upper);

const displayValues = new Uint8Array(totalPixels);
for (let i = 0; i < totalPixels; i++) {
  const mv = modalityValues[i];
  if (mv <= lower) {
    displayValues[i] = 0;
  } else if (mv >= upper) {
    displayValues[i] = 255;
  } else {
    displayValues[i] = Math.round(((mv - (wc - 0.5)) / (ww - 1) + 0.5) * 255);
  }
}

let dMin = displayValues[0], dMax = displayValues[0];
for (let i = 1; i < totalPixels; i++) {
  if (displayValues[i] < dMin) dMin = displayValues[i];
  if (displayValues[i] > dMax) dMax = displayValues[i];
}
console.log('Display range:', dMin, '-', dMax);

// Sample some pixel values at specific locations
console.log('\nSample pixels (center area):');
const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
for (let dy = -2; dy <= 2; dy++) {
  const y = cy + dy * 100;
  for (let dx = -2; dx <= 2; dx++) {
    const x = cx + dx * 100;
    const idx = y * cols + x;
    console.log(`  [${x},${y}] stored=${pixelData[idx]} → MLUT=${modalityValues[idx]} → display=${displayValues[idx]}`);
  }
}

// Histogram of display values
const hist = new Uint32Array(256);
for (let i = 0; i < totalPixels; i++) {
  hist[displayValues[i]]++;
}
console.log('\nDisplay histogram (non-zero bins):');
for (let i = 0; i < 256; i++) {
  if (hist[i] > 0) console.log(`  bin[${i}]: ${hist[i]}`);
}

// Save as raw bytes for inspection
fs.writeFileSync('ref-display.raw', displayValues);
console.log('\nSaved ref-display.raw (' + displayValues.length + ' bytes, 1 byte/pixel, ' + cols + 'x' + rows + ')');
