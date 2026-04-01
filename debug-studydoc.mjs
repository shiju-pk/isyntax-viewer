import pako from './node_modules/pako/dist/pako.esm.mjs';

const SIZEOF_INT32 = 4;
const ZLIB_DEFLATE_DATA_OFFSET = 2;
const ZLIB_ADDITIONAL_STR_OFFSET = 6;

function readIntLE(arr, off) {
  return (arr[off]) | (arr[off+1]<<8) | (arr[off+2]<<16) | (arr[off+3]<<24);
}

async function main() {
  const studyUID = '2.16.840.1.114151.2783659648455710997644573319327333996010260330';
  const stackId = 'PR3';
  const url = `http://localhost:5000/ResultsAuthority/Study/${studyUID}/iSyntaxStudy?sid=${stackId}`;
  
  console.log('Fetching:', url);
  const resp = await fetch(url);
  if (!resp.ok) { console.log('FETCH FAILED:', resp.status); return; }
  
  const ab = await resp.arrayBuffer();
  const data = new Uint8Array(ab);
  console.log('Total bytes:', data.length);
  
  let idx = 0;
  const nEntities = readIntLE(data, idx); idx += 4;
  console.log('Entities:', nEntities);
  
  for (let e = 0; e < nEntities && idx < data.length; e++) {
    if (idx + 4 > data.length) break;
    const sizeOfXmlEntity = readIntLE(data, idx); idx += 4;
    const dtsffVersionSize = readIntLE(data, idx); idx += 4;
    if (dtsffVersionSize > 0) idx += dtsffVersionSize;
    if (idx >= data.length) break;
    
    const isCompressed = data[idx]; idx += 1;
    const uriSize = readIntLE(data, idx); idx += 4;
    if (uriSize < 0 || idx + uriSize > data.length) break;
    const uri = new TextDecoder().decode(data.subarray(idx, idx + uriSize));
    idx += uriSize;
    
    const allocatedSize = readIntLE(data, idx); idx += 4;
    const CRC = readIntLE(data, idx); idx += 4;
    const dataLength = readIntLE(data, idx); idx += 4;
    
    console.log(`\n--- Entity[${e}] ---`);
    console.log(`  URI: ${uri}`);
    console.log(`  sizeOfXmlEntity=${sizeOfXmlEntity}, dtsffVersionSize=${dtsffVersionSize}`);
    console.log(`  isCompressed=${isCompressed}, dataLength=${dataLength}`);
    
    if (dataLength > 0) {
      const uncompressedDataLength = readIntLE(data, idx);
      console.log(`  uncompressedDataLength=${uncompressedDataLength}`);
      
      // Single inflate
      const compressedOffset = idx + 4 + 2;
      const compressedLen = dataLength - 6;
      console.log(`  compressedOffset=${compressedOffset}, compressedLen=${compressedLen}`);
      
      try {
        const slice = data.subarray(compressedOffset, compressedOffset + compressedLen);
        const inflated = pako.inflateRaw(slice);
        const xmlText = new TextDecoder().decode(inflated);
        console.log(`  [Single inflate] ${xmlText.length} chars`);
        
        // Count SOPInstanceUIDs (tag 00080018) and SOPClassUIDs (tag 00080016)
        const sopInstanceMatches = xmlText.match(/tag=["']00080018["']\s+val=["']([^"']+)["']/g);
        const sopClassMatches = xmlText.match(/tag=["']00080016["']\s+val=["']([^"']+)["']/g);
        const ideltaMatches = xmlText.match(/<idelta/g);
        const seriesMatches = xmlText.match(/<series/g);
        const seriesNameMatches = xmlText.match(/<series\s+name=["']([^"']+)["']/g);
        const ideltaParentMatches = xmlText.match(/<idelta\s+parent=["']([^"']+)["']/g);
        if (seriesNameMatches) {
          seriesNameMatches.forEach(m => {
            const val = m.match(/name=["']([^"']+)["']/);
            console.log(`    Series name: ${val?.[1]}`);
          });
        }
        if (ideltaParentMatches) {
          ideltaParentMatches.forEach(m => {
            const val = m.match(/parent=["']([^"']+)["']/);
            console.log(`    Idelta parent: ${val?.[1]}`);
          });
        }
        
        console.log(`  <series>: ${seriesMatches?.length || 0}`);
        console.log(`  <idelta>: ${ideltaMatches?.length || 0}`);
        console.log(`  SOPInstanceUIDs: ${sopInstanceMatches?.length || 0}`);
        console.log(`  SOPClassUIDs: ${sopClassMatches?.length || 0}`);
        
        if (sopInstanceMatches) {
          sopInstanceMatches.forEach(m => {
            const val = m.match(/val=["']([^"']+)["']/);
            console.log(`    SOPInstanceUID: ${val?.[1]}`);
          });
        }
        if (sopClassMatches) {
          sopClassMatches.forEach(m => {
            const val = m.match(/val=["']([^"']+)["']/);
            console.log(`    SOPClassUID: ${val?.[1]}`);
          });
        }
        
        // Show first 800 chars of XML
        console.log(`  XML preview (first 800):\n${xmlText.substring(0, 800)}`);
      } catch (ex) {
        console.log(`  [Single inflate] FAILED: ${ex.message}`);
        
        // Try multi-stream
        console.log('  Trying multi-stream...');
        let inflateDataPos = idx + SIZEOF_INT32 + ZLIB_DEFLATE_DATA_OFFSET;
        let inflateDataSize = dataLength - SIZEOF_INT32 - ZLIB_DEFLATE_DATA_OFFSET;
        let fullXml = '';
        let streamCount = 0;
        
        while (inflateDataSize > 0) {
          const slice2 = data.subarray(inflateDataPos, inflateDataPos + inflateDataSize);
          if (slice2.length === 0) break;
          try {
            const inflater = new pako.Inflate({ raw: true });
            inflater.push(slice2, true);
            if (inflater.err) { console.log(`    Stream ${streamCount} error: ${inflater.msg}`); break; }
            if (inflater.result instanceof Uint8Array) {
              fullXml += new TextDecoder().decode(inflater.result);
            }
            const consumed = inflater.strm?.next_in ?? inflateDataSize;
            console.log(`    Stream ${streamCount}: consumed=${consumed}, resultLen=${inflater.result?.length || 0}`);
            streamCount++;
            const advance = consumed + ZLIB_ADDITIONAL_STR_OFFSET;
            inflateDataPos += advance;
            inflateDataSize -= advance;
          } catch (ex2) { console.log(`    Stream ${streamCount} error: ${ex2.message}`); break; }
        }
        console.log(`  [Multi-stream] ${streamCount} streams, total ${fullXml.length} chars`);
        const ideltaMatches2 = fullXml.match(/<idelta/g);
        console.log(`  [Multi-stream] <idelta>: ${ideltaMatches2?.length || 0}`);
      }
      
      idx += dataLength;
    }
  }
  
  console.log('\n=== DONE ===');
}
main();
