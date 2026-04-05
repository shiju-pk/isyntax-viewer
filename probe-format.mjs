/**
 * Quick probe: fetch InitImage for a study/stack and inspect the binary header
 * to determine whether it's iSyntax, JPEG, or JPEG 2000.
 *
 * Usage: node probe-format.mjs [hostname]
 */

const FORMATS = ['MONO','YBRF8','YBRFE','YBRP8','YBRPE','JPEG_RGB','JPEG_MONO','J2K_RGB','J2K_MONO'];

const studyUID  = '1.3.46.670589.11.20141124120755.7766.4.1';
const stackId   = '3dc99783-827e-4b1a-948e-9bdc44abeda7_cloudstack';
const hostname  = process.argv[2] || 'http://localhost:5000';

function readInt32LE(buf, off) {
  return buf[off] | (buf[off+1]<<8) | (buf[off+2]<<16) | (buf[off+3]<<24);
}
function readInt16LE(buf, off) {
  const v = buf[off] | (buf[off+1]<<8);
  return v > 0x7FFF ? v - 0x10000 : v;
}
function readUint32LE(buf, off) {
  return (buf[off] | (buf[off+1]<<8) | (buf[off+2]<<16) | (buf[off+3]<<24)) >>> 0;
}

// ---------- Step 1: fetch StudyDoc to find instanceUIDs ------------------
async function getInstanceUIDs() {
  const url = `${hostname}/ResultsAuthority/Study/${studyUID}/iSyntaxStudy?sid=${stackId}`;
  console.log('Fetching StudyDoc:', url);
  const resp = await fetch(url);
  if (!resp.ok) { console.log('StudyDoc fetch failed:', resp.status); return []; }

  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log('StudyDoc bytes:', buf.length);

  // Quick XML extraction: look for SOPInstanceUID (tag 00080018) val="..."
  // We need to inflate the compressed XML first
  let idx = 0;
  const nEntities = readInt32LE(buf, idx); idx += 4;
  console.log('Entities:', nEntities);

  const uids = [];
  for (let e = 0; e < nEntities && idx < buf.length; e++) {
    if (idx + 4 > buf.length) break;
    const sizeOfXml = readInt32LE(buf, idx); idx += 4;
    const dtsffVerSize = readInt32LE(buf, idx); idx += 4;
    if (dtsffVerSize > 0) idx += dtsffVerSize;
    if (idx >= buf.length) break;

    const isCompressed = buf[idx]; idx += 1;
    const uriSize = readInt32LE(buf, idx); idx += 4;
    if (uriSize < 0 || idx + uriSize > buf.length) break;
    const uri = new TextDecoder().decode(buf.subarray(idx, idx + uriSize));
    idx += uriSize;

    idx += 4; // allocatedSize
    idx += 4; // CRC
    const dataLength = readInt32LE(buf, idx); idx += 4;

    if (dataLength > 0) {
      idx += 4; // uncompressedDataLength
      const compressedOffset = idx + 2;
      const compressedLen = dataLength - 6;

      try {
        // Use DecompressionStream (Node 18+)
        const ds = new DecompressionStream('deflate-raw');
        const writer = ds.writable.getWriter();
        const reader = ds.readable.getReader();

        const slice = buf.slice(compressedOffset, compressedOffset + compressedLen);
        writer.write(slice);
        writer.close();

        const chunks = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
        const total = chunks.reduce((s, c) => s + c.length, 0);
        const inflated = new Uint8Array(total);
        let off = 0;
        for (const c of chunks) { inflated.set(c, off); off += c.length; }
        const xmlText = new TextDecoder().decode(inflated);

        // Extract SOPInstanceUIDs
        const matches = xmlText.matchAll(/tag=["']00080018["']\s+val=["']([^"']+)["']/g);
        for (const m of matches) {
          uids.push(m[1]);
        }
      } catch (ex) {
        console.log(`  inflate failed for entity ${e}: ${ex.message}`);
      }

      idx += dataLength - 4; // already read 4 bytes (uncompressedDataLength)
    }
  }
  return [...new Set(uids)];
}

// ---------- Step 2: fetch InitImage and inspect header -------------------
async function probeInitImage(instanceUID) {
  const url = `${hostname}/ResultsAuthority/Study/${studyUID}/Instance/${instanceUID}/iSyntaxInitImage?TQ=0&V=0&P=0&sid=${stackId}`;
  console.log(`\n=== Probing InitImage for instance: ${instanceUID} ===`);
  console.log('URL:', url);

  const resp = await fetch(url);
  if (!resp.ok) {
    console.log(`  FAILED: ${resp.status} ${resp.statusText}`);
    return;
  }

  const buf = new Uint8Array(await resp.arrayBuffer());
  console.log(`  Total bytes: ${buf.length}`);

  if (buf.length < 8) {
    console.log('  Too short to parse header');
    return;
  }

  const version = readInt32LE(buf, 0);
  const formatIdx = readInt32LE(buf, 4);
  const formatStr = FORMATS[formatIdx] || `UNKNOWN(${formatIdx})`;

  console.log(`  Version: 0x${(version >>> 0).toString(16).padStart(8, '0')}`);
  console.log(`  Format index: ${formatIdx}`);
  console.log(`  Format: ${formatStr}`);

  const isISyntax = formatIdx >= 0 && formatIdx <= 4;
  const isJPEG    = formatIdx === 5 || formatIdx === 6;
  const isJ2K     = formatIdx === 7 || formatIdx === 8;

  if (isISyntax) {
    console.log('  >> This is an iSyntax (wavelet) format');
    // Parse wavelet-specific fields
    let pos = 8;
    const rows = readInt16LE(buf, pos); pos += 2;
    const cols = readInt16LE(buf, pos); pos += 2;
    const quantLevel = readInt16LE(buf, pos); pos += 2;
    const quantValue = readInt16LE(buf, pos); pos += 2;
    const xformLevels = readInt16LE(buf, pos); pos += 2;
    const partitionSize = readInt16LE(buf, pos); pos += 2;
    const coeffBitDepth = readInt16LE(buf, pos); pos += 2;
    console.log(`  Rows=${rows}, Cols=${cols}, XformLevels=${xformLevels}, CoeffBitDepth=${coeffBitDepth}`);
  } else if (isJPEG || isJ2K) {
    console.log(`  >> This is a ${isJPEG ? 'JPEG' : 'JPEG 2000'} format!`);
    let pos = 8;
    const rows = readInt16LE(buf, pos); pos += 2;
    const cols = readInt16LE(buf, pos); pos += 2;
    const partLength = readUint32LE(buf, pos); pos += 4;
    console.log(`  Rows=${rows}, Cols=${cols}, PartitionLength=${partLength}`);
    console.log(`  Compressed data starts at offset ${pos}`);
    // Show first few bytes of compressed data (magic bytes)
    if (pos + 4 <= buf.length) {
      const magic = Array.from(buf.subarray(pos, Math.min(pos + 16, buf.length)))
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ');
      console.log(`  First compressed bytes: ${magic}`);
      // JPEG starts with FF D8; J2K starts with FF 4F or 00 00 00 0C
      if (buf[pos] === 0xFF && buf[pos+1] === 0xD8) {
        console.log('  Magic: JPEG SOI marker detected (FF D8)');
      } else if (buf[pos] === 0xFF && buf[pos+1] === 0x4F) {
        console.log('  Magic: JPEG 2000 codestream marker detected (FF 4F)');
      } else if (buf[pos] === 0x00 && buf[pos+1] === 0x00 && buf[pos+2] === 0x00 && buf[pos+3] === 0x0C) {
        console.log('  Magic: JPEG 2000 JP2 box detected');
      }
    }
  } else {
    console.log(`  >> Unknown format index: ${formatIdx}`);
  }
}

// ---------- Main ---------------------------------------------------------
async function main() {
  console.log(`Study: ${studyUID}`);
  console.log(`Stack: ${stackId}`);
  console.log(`Server: ${hostname}\n`);

  const instanceUIDs = await getInstanceUIDs();
  console.log(`\nFound ${instanceUIDs.length} instance UIDs`);

  if (instanceUIDs.length === 0) {
    console.log('No instances found. Trying direct InitImage probe with studyUID as instanceUID...');
    await probeInitImage(studyUID);
    return;
  }

  for (const uid of instanceUIDs) {
    await probeInitImage(uid);
  }
}

main().catch(e => console.error('Fatal:', e.message));
