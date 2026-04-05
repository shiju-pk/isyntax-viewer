/**
 * Probe GSPS series data from StudyDoc.
 */
import pako from 'pako';

const STUDY_UID = '2.16.840.1.114151.2783659648455710997644573319327333996010260330';
const SID = 'PR5';
const BASE = 'http://localhost:5001/ResultsAuthority';
const URL = `${BASE}/Study/${STUDY_UID}/iSyntaxStudy?sid=${SID}`;

function readIntLE(arr, off) {
  return (arr[off]) | (arr[off + 1] << 8) | (arr[off + 2] << 16) | (arr[off + 3] << 24);
}

async function main() {
  const resp = await fetch(URL);
  const buf = await resp.arrayBuffer();
  const data = new Uint8Array(buf);
  let idx = 0;
  const n = readIntLE(data, idx); idx += 4;

  const entities = {};

  for (let e = 0; e < n && idx < data.length; e++) {
    const sz = readIntLE(data, idx); idx += 4;
    const vSz = readIntLE(data, idx); idx += 4;
    idx += vSz;
    idx += 1; // isCompressed
    const uSz = readIntLE(data, idx); idx += 4;
    const uri = new TextDecoder().decode(data.subarray(idx, idx + uSz));
    idx += uSz;
    idx += 4; // allocatedSize
    idx += 4; // CRC
    const dl = readIntLE(data, idx); idx += 4;

    if (dl > 0) {
      const co = idx + 4 + 2;
      const cl = dl - 6;
      try {
        const inf = pako.inflateRaw(data.subarray(co, co + cl));
        const xml = new TextDecoder().decode(inf);
        if (uri.includes('_Study')) entities.study = xml;
        if (uri.includes('_Images') || uri.includes('_images')) entities.images = xml;
      } catch (e) {}
    }
    idx += dl;
  }

  // Parse _study.xml: find GSPS series
  const studyXml = entities.study;
  if (!studyXml) { console.log('No study XML found'); return; }

  // Find all series, check for GSPS SOP class
  const GSPS_SOP = '1.2.840.10008.5.1.4.1.1.11.1';
  // Simple regex to find series blocks
  const seriesRe = /<series\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/series>/g;
  let match;
  const gspsSeriesUIDs = [];

  while ((match = seriesRe.exec(studyXml)) !== null) {
    const seriesUID = match[1];
    const seriesContent = match[2];
    if (seriesContent.includes(GSPS_SOP)) {
      gspsSeriesUIDs.push(seriesUID);
      console.log('=== GSPS SERIES ===');
      console.log('Series UID:', seriesUID);
      console.log('Template content (first 5000 chars):');
      console.log(seriesContent.substring(0, 5000));
      console.log('...');
    }
  }

  if (gspsSeriesUIDs.length === 0) {
    console.log('No GSPS series found in study XML');
    return;
  }

  // Find GSPS ideltas in _images.xml
  const imagesXml = entities.images;
  if (!imagesXml) { console.log('No images XML found'); return; }

  const ideltaRe = /<idelta\s+parent="([^"]+)"[^>]*>([\s\S]*?)<\/idelta>/g;
  let idMatch;
  let gspsInstanceCount = 0;

  while ((idMatch = ideltaRe.exec(imagesXml)) !== null) {
    const parent = idMatch[1];
    if (gspsSeriesUIDs.includes(parent)) {
      gspsInstanceCount++;
      console.log('\n=== GSPS INSTANCE (idelta) ===');
      console.log('Parent series:', parent);
      const content = idMatch[2];
      console.log('Content (first 5000 chars):');
      console.log(content.substring(0, 5000));

      // Check for specific GSPS tags
      const tags0070 = content.match(/tag="0070[0-9a-fA-F]{4}"/g);
      if (tags0070) {
        console.log('\nGSPS 0070xxxx tags found:', [...new Set(tags0070)]);
      }

      // Check for embedded iSite PS
      if (content.includes('0073101e') || content.includes('00731010')) {
        console.log('\n*** EMBEDDED iSite PS DATA FOUND ***');
      }

      // Check for sqElement (sequences)
      const sqTags = content.match(/sqElement\s+tag="[^"]+"/g);
      if (sqTags) {
        console.log('\nSequence tags:', [...new Set(sqTags)]);
      }
    }
  }

  console.log('\n\nTotal GSPS instances found:', gspsInstanceCount);
}

main().catch(console.error);
