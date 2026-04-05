/**
 * Hex-dump the InitImage response to diagnose the "Unsupported coder code: 239" error.
 */

const studyUID    = '1.3.46.670589.11.20141124120755.7766.4.1';
const instanceUID = '1.3.46.670589.11.20141124120756.1104.4.159';
const stackId     = '3dc99783-827e-4b1a-948e-9bdc44abeda7_cloudstack';
const hostname    = process.argv[2] || 'http://localhost:5001';

function readInt32LE(b, o)  { return b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24); }
function readUint32LE(b, o) { return (b[o] | (b[o+1]<<8) | (b[o+2]<<16) | (b[o+3]<<24)) >>> 0; }
function readInt16LE(b, o)  { const v = b[o] | (b[o+1]<<8); return v > 0x7FFF ? v - 0x10000 : v; }

function hexDump(buf, start, len) {
  const end = Math.min(start + len, buf.length);
  const lines = [];
  for (let i = start; i < end; i += 16) {
    const hex = Array.from(buf.subarray(i, Math.min(i + 16, end)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(buf.subarray(i, Math.min(i + 16, end)))
      .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.')
      .join('');
    lines.push(`  ${i.toString().padStart(5)}: ${hex.padEnd(48)} ${ascii}`);
  }
  return lines.join('\n');
}

const FORMATS = ['MONO','YBRF8','YBRFE','YBRP8','YBRPE','JPEG_RGB','JPEG_MONO','J2K_RGB','J2K_MONO'];

async function main() {
  const url = `${hostname}/ResultsAuthority/Study/${studyUID}/Instance/${instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid=${stackId}`;
  console.log('Fetching:', url);

  const resp = await fetch(url);
  console.log('Status:', resp.status, resp.statusText);
  console.log('Content-Type:', resp.headers.get('content-type'));
  console.log('Content-Length:', resp.headers.get('content-length'));

  if (!resp.ok) { console.log('FAILED'); return; }

  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log('Actual bytes:', buf.length);

  // Full hex dump of first 256 bytes
  console.log('\n--- First 256 bytes ---');
  console.log(hexDump(buf, 0, 256));

  // Parse header
  console.log('\n--- Header parse ---');
  const version = readUint32LE(buf, 0);
  const fmtIdx  = readInt32LE(buf, 4);
  console.log(`Version: 0x${version.toString(16).padStart(8,'0')} (${version})`);
  console.log(`Format index: ${fmtIdx} (${FORMATS[fmtIdx] || 'UNKNOWN'})`);

  let pos = 8;
  const rows = readInt16LE(buf, pos); pos += 2;
  const cols = readInt16LE(buf, pos); pos += 2;
  console.log(`Rows: ${rows}, Cols: ${cols}`);

  const quantLevel = readInt16LE(buf, pos); pos += 2;
  const quantValue = readInt16LE(buf, pos); pos += 2;
  const xformLevels = readInt16LE(buf, pos); pos += 2;
  const partitionSize = readInt16LE(buf, pos); pos += 2;
  const coeffBitDepth = readInt16LE(buf, pos); pos += 2;
  console.log(`QuantLevel: ${quantLevel}, QuantValue: ${quantValue}`);
  console.log(`XformLevels: ${xformLevels}, PartitionSize: ${partitionSize}`);
  console.log(`CoeffBitDepth: ${coeffBitDepth}`);

  const numChecksums = readInt32LE(buf, pos); pos += 4;
  console.log(`NumChecksums: ${numChecksums}`);

  if (numChecksums > 0 && numChecksums < 100) {
    for (let i = 0; i < numChecksums; i++) {
      const cs = readInt32LE(buf, pos); pos += 4;
      console.log(`  Checksum[${i}]: ${cs} (0x${(cs>>>0).toString(16)})`);
    }
  }

  if (pos + 4 <= buf.length) {
    const dataLength = readInt32LE(buf, pos); pos += 4;
    console.log(`DataLength: ${dataLength}`);
    console.log(`CoeffsOffset: ${pos}`);

    // Show bytes at coeffsOffset
    console.log(`\n--- Bytes at coeffsOffset (${pos}) ---`);
    console.log(hexDump(buf, pos, 64));

    // What would the coder code read be?
    // First, read planes count of i32 for dataLength per plane
    const planes = (fmtIdx >= 1 && fmtIdx <= 4) ? 3 : 1;
    console.log(`\nPlanes: ${planes}`);
    let pos2 = pos;
    for (let p = 0; p < planes; p++) {
      const dl = readInt32LE(buf, pos2); pos2 += 4;
      console.log(`  Plane[${p}] dataLength: ${dl}`);
    }
    // Next byte should be coder code (8 bits)
    if (pos2 < buf.length) {
      const coderCodeByte = buf[pos2];
      console.log(`\nByte at coder code position (${pos2}): ${coderCodeByte} (0x${coderCodeByte.toString(16)})`);
      console.log('(Expected: 2 = RICE)');
    }
  }

  // Also check if the first bytes look like JPEG/J2K
  console.log('\n--- Magic byte signatures ---');
  if (buf[0] === 0xFF && buf[1] === 0xD8) console.log('Starts with JPEG SOI (FF D8)');
  if (buf[0] === 0xFF && buf[1] === 0x4F) console.log('Starts with J2K codestream (FF 4F)');
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && buf[3] === 0x0C) console.log('Starts with JP2 box');
  // Check at offset 8 (after common header)
  if (buf[8] === 0xFF && buf[9] === 0xD8) console.log('JPEG SOI at offset 8');
  if (buf[8] === 0xFF && buf[9] === 0x4F) console.log('J2K codestream at offset 8');

  // Last 32 bytes
  console.log('\n--- Last 32 bytes ---');
  console.log(hexDump(buf, Math.max(0, buf.length - 32), 32));
}

main().catch(e => console.error('Fatal:', e));
