/**
 * Diagnostic script: Fetch and analyze a StudyDoc for overlay/GSPS/PS tags.
 * Usage: node analyze-studydoc.mjs
 */
import pako from 'pako';

const STUDY_UID = '2.16.840.1.114151.2783659648455710997644573319327333996010260330';
const SID = 'PR5';
const BASE = 'http://localhost:5001/ResultsAuthority';
const URL = `${BASE}/Study/${STUDY_UID}/iSyntaxStudy?sid=${SID}`;

function readIntLE(arr, off) {
  return (arr[off]) | (arr[off + 1] << 8) | (arr[off + 2] << 16) | (arr[off + 3] << 24);
}

// Tags of interest
const OVERLAY_PREFIX = '60';
const INTERESTING_TAGS = [
  '00280008', // NumberOfFrames
  '00200052', // FrameOfReferenceUID
  '00080016', // SOPClassUID
  '00080060', // Modality
  '00080018', // SOPInstanceUID
  '00100010', // PatientName
  '00200011', // SeriesNumber
  '0008103E', // SeriesDescription
  '00081115', // ReferencedSeriesSequence
];

async function main() {
  console.log(`Fetching: ${URL}\n`);
  const resp = await fetch(URL);
  if (!resp.ok) {
    console.error(`HTTP ${resp.status} ${resp.statusText}`);
    process.exit(1);
  }

  const buf = await resp.arrayBuffer();
  const data = new Uint8Array(buf);
  console.log(`Response size: ${data.length} bytes`);

  let idx = 0;
  const noOfEntities = readIntLE(data, idx);
  idx += 4;
  console.log(`Number of entities: ${noOfEntities}\n`);

  const entities = [];

  for (let e = 0; e < noOfEntities && idx < data.length; e++) {
    if (idx + 4 > data.length) break;

    const sizeOfXmlEntity = readIntLE(data, idx); idx += 4;
    const dtsffVersionSize = readIntLE(data, idx); idx += 4;
    let version = '';
    if (dtsffVersionSize > 0) {
      version = new TextDecoder().decode(data.subarray(idx, idx + dtsffVersionSize));
      idx += dtsffVersionSize;
    }

    const isCompressed = data[idx]; idx += 1;

    const uriSize = readIntLE(data, idx); idx += 4;
    const uri = new TextDecoder().decode(data.subarray(idx, idx + uriSize));
    idx += uriSize;

    const allocatedSize = readIntLE(data, idx); idx += 4;
    const CRC = readIntLE(data, idx); idx += 4;
    const dataLength = readIntLE(data, idx); idx += 4;

    let xmlText = null;
    if (dataLength > 0) {
      const compressedOffset = idx + 4 + 2;
      const compressedLen = dataLength - 6;
      if (compressedOffset + compressedLen <= data.length && compressedLen > 0) {
        try {
          const compressed = data.subarray(compressedOffset, compressedOffset + compressedLen);
          const inflated = pako.inflateRaw(compressed);
          xmlText = new TextDecoder().decode(inflated);
        } catch (ex) {
          console.error(`  Decompress error for entity ${e}: ${ex.message}`);
        }
      }
      idx += dataLength;
    }

    entities.push({ index: e, uri, version, isCompressed, dataLength, xmlText });
    console.log(`Entity ${e}: uri="${uri}", version="${version}", compressed=${isCompressed}, dataLen=${dataLength}, xmlLen=${xmlText?.length ?? 0}`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('DETAILED ANALYSIS');
  console.log('='.repeat(80));

  for (const ent of entities) {
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`Entity ${ent.index}: ${ent.uri}`);
    console.log(`${'─'.repeat(60)}`);

    if (!ent.xmlText) {
      console.log('  (no XML data)');
      continue;
    }

    // Count overlay tags
    const overlayMatches = ent.xmlText.match(/tag="6[0-9a-fA-F]{7}"/g) || [];
    if (overlayMatches.length > 0) {
      console.log(`\n  *** OVERLAY TAGS FOUND: ${overlayMatches.length} ***`);
      // Extract unique overlay tag groups
      const groups = new Set();
      for (const m of overlayMatches) {
        const tag = m.replace('tag="', '').replace('"', '');
        groups.add(tag.substring(0, 4));
        console.log(`    ${m}`);
      }
      console.log(`  Overlay groups present: ${[...groups].join(', ')}`);
    }

    // Check for interesting tags  
    for (const tagId of INTERESTING_TAGS) {
      const re = new RegExp(`tag="${tagId}"[^/]*?val="([^"]*)"`, 'gi');
      const matches = [...ent.xmlText.matchAll(re)];
      if (matches.length > 0) {
        for (const m of matches) {
          console.log(`  [${tagId}] val="${m[1]}"`);
        }
      }
    }

    // Count series
    const seriesMatches = ent.xmlText.match(/<series\s+name="[^"]*"/g) || [];
    if (seriesMatches.length > 0) {
      console.log(`\n  Series found (${seriesMatches.length}):`);
      for (const s of seriesMatches) {
        const uid = s.match(/name="([^"]*)"/)?.[1] || '';
        console.log(`    ${uid}`);
      }
    }

    // Count idelta (image instances)
    const ideltaMatches = ent.xmlText.match(/<idelta/g) || [];
    if (ideltaMatches.length > 0) {
      console.log(`\n  Image instances (idelta): ${ideltaMatches.length}`);
    }

    // Check for GSPS SOP classes
    if (ent.xmlText.includes('1.2.840.10008.5.1.4.1.1.11.1')) {
      console.log('\n  *** GSPS SOP Class found ***');
    }

    // Check for Presentation State references
    if (ent.xmlText.toLowerCase().includes('presentation')) {
      const psMatches = ent.xmlText.match(/[Pp]resentation[^"<>]*/g) || [];
      console.log(`\n  Presentation State references: ${psMatches.length}`);
      for (const p of psMatches.slice(0, 5)) {
        console.log(`    ${p}`);
      }
    }

    // Dump first 2000 chars of XML for inspection if it contains overlays or is _study.xml
    if (overlayMatches.length > 0 || ent.uri.toLowerCase().includes('_study')) {
      console.log(`\n  --- XML snippet (first 3000 chars) ---`);
      console.log(ent.xmlText.substring(0, 3000));
      console.log('  --- end snippet ---');
    }
  }

  // Now let's specifically search ALL entities for overlay tags in templates and ideltas
  console.log('\n' + '='.repeat(80));
  console.log('OVERLAY TAG DEEP SCAN (all 60xx tags across all entities)');
  console.log('='.repeat(80));

  let totalOverlayTags = 0;
  for (const ent of entities) {
    if (!ent.xmlText) continue;
    // Match any element with a 60xx tag
    const re = /<(?:element|diff)\s+[^>]*tag="(6[0-9a-fA-F]{7})"[^>]*>/g;
    let match;
    while ((match = re.exec(ent.xmlText)) !== null) {
      totalOverlayTags++;
      // Get surrounding context
      const start = Math.max(0, match.index - 50);
      const end = Math.min(ent.xmlText.length, match.index + match[0].length + 100);
      console.log(`  [${ent.uri}] ${ent.xmlText.substring(start, end).replace(/\n/g, ' ')}`);
    }
  }

  if (totalOverlayTags === 0) {
    console.log('  NO OVERLAY 60xx TAGS FOUND IN ANY ENTITY');
  } else {
    console.log(`\n  Total overlay tags found: ${totalOverlayTags}`);
  }

  // Also dump all unique tag IDs to see what's available
  console.log('\n' + '='.repeat(80));
  console.log('ALL UNIQUE DICOM TAG IDs IN STUDY DOC');
  console.log('='.repeat(80));

  const allTags = new Set();
  for (const ent of entities) {
    if (!ent.xmlText) continue;
    const re = /tag="([0-9a-fA-F]{8})"/g;
    let m;
    while ((m = re.exec(ent.xmlText)) !== null) {
      allTags.add(m[1]);
    }
  }

  const sorted = [...allTags].sort();
  console.log(`Total unique tags: ${sorted.length}`);
  for (const t of sorted) {
    const isOverlay = t.startsWith('60');
    console.log(`  ${t}${isOverlay ? ' *** OVERLAY ***' : ''}`);
  }
}

main().catch(console.error);
