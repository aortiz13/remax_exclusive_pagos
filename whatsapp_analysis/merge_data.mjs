/**
 * Robust parser for Supabase MCP output files
 */
import fs from 'fs';

const BATCH_DIR = '/Users/adrianortiz/.gemini/antigravity/brain/a76f2e72-1e1b-455c-baa0-ad7f9e29500d/.system_generated/steps';

const batchFiles = [
  { step: '38', offset: 0 },
  { step: '41', offset: 500 },
  { step: '42', offset: 1000 },
  { step: '43', offset: 1500 },
  { step: '44', offset: 2000 },
  { step: '45', offset: 2500 },
  { step: '46', offset: 3000 },
  { step: '47', offset: 3500 },
];

let allRows = [];

for (const batch of batchFiles) {
  const filePath = `${BATCH_DIR}/${batch.step}/output.txt`;
  console.log(`\nReading batch at offset ${batch.offset} (step ${batch.step})...`);
  
  const raw = fs.readFileSync(filePath, 'utf-8');
  
  try {
    // Step 1: Parse the outer JSON wrapper
    const outer = JSON.parse(raw);
    const resultStr = outer.result;
    
    // Step 2: Find the array between untrusted-data tags
    // The pattern is: <untrusted-data-UUID>\n[...]\n</untrusted-data-UUID>
    const tagMatch = resultStr.match(/<untrusted-data-[^>]+>\n([\s\S]+?)\n<\/untrusted-data/);
    
    if (tagMatch) {
      const arrayStr = tagMatch[1].trim();
      
      // Step 3: Parse the JSON array
      const rows = JSON.parse(arrayStr);
      allRows = allRows.concat(rows);
      console.log(`  ✓ Parsed ${rows.length} rows`);
    } else {
      console.error('  ✗ Could not find data between tags');
      // Try fallback: look for [...] pattern
      const arrayMatch = resultStr.match(/\[[\s\S]+\]/);
      if (arrayMatch) {
        const rows = JSON.parse(arrayMatch[0]);
        allRows = allRows.concat(rows);
        console.log(`  ✓ Fallback parsed ${rows.length} rows`);
      }
    }
  } catch (e) {
    console.error(`  ✗ Error: ${e.message}`);
    console.log(`  First 200 chars: ${raw.substring(0, 200)}`);
  }
}

console.log(`\n═══════════════════════════════`);
console.log(`Total rows: ${allRows.length}`);

// Deduplicate by id
const unique = new Map();
for (const row of allRows) {
  unique.set(row.id, row);
}
const deduped = Array.from(unique.values()).sort((a, b) => a.id - b.id);
console.log(`After dedup: ${deduped.length} unique rows`);
console.log(`Session IDs: ${new Set(deduped.map(r => r.session_id)).size} unique`);

// Save
const outputPath = '/Users/adrianortiz/Desktop/miniapp_remax/remax-exclusive-requests/whatsapp_analysis/raw_data.json';
fs.writeFileSync(outputPath, JSON.stringify(deduped));
console.log(`Saved to ${outputPath}`);
console.log(`File size: ${(fs.statSync(outputPath).size / 1024 / 1024).toFixed(2)} MB`);
