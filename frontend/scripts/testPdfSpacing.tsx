/**
 * Test PDF Spacing - CLI Compatible
 * 
 * Tests the text spacing logic without server-only dependencies
 */

// Hair space (U+200A) - thinner than regular space
const HAIR_SPACE = '\u200A';

// Thin space (U+2009) - slightly wider, for emoji boundaries  
const THIN_SPACE = '\u2009';

function addScriptBoundarySpacingTest(text: string): string {
  if (!text) return '';
  
  let processed = String(text);
  
  // Test if Unicode property escapes work
  try {
    // 1. Thai ↔ Latin transitions
    processed = processed.replace(/([\p{Script=Thai}])([\p{Script=Latin}])/gu, `$1${HAIR_SPACE}$2`);
    processed = processed.replace(/([\p{Script=Latin}])([\p{Script=Thai}])/gu, `$1${HAIR_SPACE}$2`);
    
    // 2. Thai ↔ Number transitions
    processed = processed.replace(/([\p{Script=Thai}])([\p{Number}])/gu, `$1${HAIR_SPACE}$2`);
    processed = processed.replace(/([\p{Number}])([\p{Script=Thai}])/gu, `$1${HAIR_SPACE}$2`);
    
    // 3. Latin ↔ Number transitions
    processed = processed.replace(/([\p{Script=Latin}])([\p{Number}])/gu, `$1${HAIR_SPACE}$2`);
    processed = processed.replace(/([\p{Number}])([\p{Script=Latin}])/gu, `$1${HAIR_SPACE}$2`);
    
    // 4. Emoji boundaries
    processed = processed.replace(/([\p{Extended_Pictographic}])([\p{Script=Thai}\p{Script=Latin}\p{Number}])/gu, `$1${THIN_SPACE}$2`);
    processed = processed.replace(/([\p{Script=Thai}\p{Script=Latin}\p{Number}])([\p{Extended_Pictographic}])/gu, `$1${THIN_SPACE}$2`);
    
    console.log('✅ Unicode property escapes are working');
  } catch (e) {
    console.log('❌ Unicode property escapes failed, using fallback');
    
    // Fallback: Use character ranges
    // Thai characters: U+0E00 to U+0E7F
    processed = processed.replace(/([\u0E00-\u0E7F])([A-Za-z])/g, `$1${HAIR_SPACE}$2`);
    processed = processed.replace(/([A-Za-z])([\u0E00-\u0E7F])/g, `$1${HAIR_SPACE}$2`);
    
    // Thai ↔ Number
    processed = processed.replace(/([\u0E00-\u0E7F])([0-9])/g, `$1${HAIR_SPACE}$2`);
    processed = processed.replace(/([0-9])([\u0E00-\u0E7F])/g, `$1${HAIR_SPACE}$2`);
    
    // Latin ↔ Number
    processed = processed.replace(/([A-Za-z])([0-9])/g, `$1${HAIR_SPACE}$2`);
    processed = processed.replace(/([0-9])([A-Za-z])/g, `$1${HAIR_SPACE}$2`);
    
    // Emoji boundaries (basic emoji ranges)
    // Using common emoji ranges
    const emojiPattern = /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/u;
    
    // This is trickier without lookbehind/lookahead, so we'll do it in steps
    // First mark emoji positions
    let emojiPositions: number[] = [];
    let match;
    const emojiRegex = new RegExp(emojiPattern, 'gu');
    while ((match = emojiRegex.exec(processed)) !== null) {
      emojiPositions.push(match.index);
    }
    
    // Add spacing around each emoji (working backwards to preserve indices)
    for (let i = emojiPositions.length - 1; i >= 0; i--) {
      const pos = emojiPositions[i];
      if (pos > 0 && /[\u0E00-\u0E7FA-Za-z0-9]/.test(processed[pos - 1])) {
        processed = processed.slice(0, pos) + THIN_SPACE + processed.slice(pos);
      }
      // Adjust for the added space
      const emojiEnd = pos + (processed[pos - 1] === THIN_SPACE ? 2 : 1);
      if (emojiEnd < processed.length && /[\u0E00-\u0E7FA-Za-z0-9]/.test(processed[emojiEnd])) {
        processed = processed.slice(0, emojiEnd) + THIN_SPACE + processed.slice(emojiEnd);
      }
    }
  }
  
  // Special punctuation handling
  processed = processed.replace(/([)\]}])([^\s)\]}])/g, `$1${HAIR_SPACE}$2`);
  
  // Clean up multiple spaces
  processed = processed.replace(/[ ]{2,}/g, ' ');
  
  return processed;
}

function processTitleForPDFTest(title: string): string {
  if (!title) return '';
  
  let processed = addScriptBoundarySpacingTest(title);
  
  // Fix "KG++" pattern
  processed = processed.replace(/(\d+)([A-Z]+)(\++)/g, `$1${HAIR_SPACE}$2$3`);
  
  // Fix exclamation sequences
  processed = processed.replace(/([!]{2,})/g, (match) => {
    return match.split('').join('\u200A');
  });
  
  // Handle parenthetical expressions
  processed = processed.replace(/(\))(\s*)([A-Za-z\u0E00-\u0E7F])/g, `$1${HAIR_SPACE}$3`);
  
  // Fix pipe separator
  processed = processed.replace(/(\s*)\|(\s*)/g, ` | `);
  
  return processed.trim();
}

// Test the problematic string
const problemText = '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden';

console.log('🔍 Testing PDF Text Spacing\n');
console.log('Original text:');
console.log(`"${problemText}"`);
console.log(`Length: ${problemText.length}\n`);

// Process with the title processor
const processed = processTitleForPDFTest(problemText);
console.log('Processed text:');
console.log(`"${processed}"`);
console.log(`Length: ${processed.length}`);
console.log(`Characters added: ${processed.length - problemText.length}\n`);

// Show specific problem area
const problemArea = '!!!!🤯ผู้กี่สุด';
const processedArea = processTitleForPDFTest(problemArea);
console.log('Problem area analysis:');
console.log(`Original: "${problemArea}"`);
console.log(`Processed: "${processedArea}"`);

// Character by character
console.log('\nCharacter breakdown:');
for (let i = 0; i < processedArea.length; i++) {
  const char = processedArea[i];
  const code = char.charCodeAt(0);
  let desc = char;
  if (code === 0x200A) desc = '[HAIR SPACE]';
  if (code === 0x2009) desc = '[THIN SPACE]';
  console.log(`  [${i}]: ${desc} (U+${code.toString(16).toUpperCase().padStart(4, '0')})`);
}

// Test other problematic patterns
console.log('\n🧪 Other patterns:');
const patterns = [
  'KG++',
  'ครับ !!!!',
  '🤯ผู้',
  'สุด ใน',
  '!!!! |'
];

patterns.forEach(pattern => {
  const proc = processTitleForPDFTest(pattern);
  console.log(`"${pattern}" → "${proc}" (${proc.length - pattern.length > 0 ? '+' + (proc.length - pattern.length) : '0'})`);
});
