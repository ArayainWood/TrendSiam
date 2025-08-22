/**
 * Test Enhanced PDF Spacing
 */

// Use regular space for better PDF compatibility
const SPACE = ' ';
const DOUBLE_SPACE = '  ';

function addScriptBoundarySpacingV2(text: string): string {
  if (!text) return '';
  
  let processed = String(text);
  
  // 1. Thai ↔ Latin transitions
  processed = processed.replace(/([\u0E00-\u0E7F])([A-Za-z])/g, `$1${SPACE}$2`);
  processed = processed.replace(/([A-Za-z])([\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // 2. Thai ↔ Number transitions
  processed = processed.replace(/([\u0E00-\u0E7F])([0-9])/g, `$1${SPACE}$2`);
  processed = processed.replace(/([0-9])([\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // 3. Emoji boundaries - use character codes for the test
  // Common emoji ranges
  const addEmojiSpacing = (str: string) => {
    let result = '';
    for (let i = 0; i < str.length; i++) {
      const char = str[i];
      const code = char.charCodeAt(0);
      const nextChar = i < str.length - 1 ? str[i + 1] : null;
      const nextCode = nextChar ? nextChar.charCodeAt(0) : 0;
      
      result += char;
      
      // Check if current is emoji and next is text
      if (code >= 0xD800 && code <= 0xDBFF) { // High surrogate (emoji)
        if (nextChar && nextCode < 0xD800) { // Next is not emoji
          result += DOUBLE_SPACE;
          continue;
        }
      }
      
      // Check if current is text and next is emoji
      if (code < 0xD800 && nextChar && nextCode >= 0xD800 && nextCode <= 0xDBFF) {
        result += DOUBLE_SPACE;
      }
    }
    return result;
  };
  
  processed = addEmojiSpacing(processed);
  
  // Special punctuation
  processed = processed.replace(/([)\]}])([^\s)\]}\-])/g, `$1${SPACE}$2`);
  
  return processed;
}

function processTitleForPDFV2(title: string): string {
  if (!title) return '';
  
  let processed = addScriptBoundarySpacingV2(title);
  
  // Fix exclamation sequences
  processed = processed.replace(/!{2,}/g, (match) => {
    return match.split('').join(' ');
  });
  
  // Handle parenthetical expressions
  processed = processed.replace(/(\))(?!\s)([A-Za-z\u0E00-\u0E7F])/g, `$1${SPACE}$2`);
  
  // Fix pipe separator
  processed = processed.replace(/\s*\|\s*/g, ' | ');
  
  // Thai + punctuation
  processed = processed.replace(/([\u0E00-\u0E7F])(!+)/g, `$1${SPACE}$2`);
  
  // Clean up multiple spaces
  processed = processed.replace(/\s{3,}/g, '  ');
  
  return processed.trim();
}

// Test the exact problematic cases
const testCases = [
  '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden',
  'แมพกระโดดแกล้งแปลกๆ (รู้ว่าเราคิดอะไร) Roblox UNEXPECTED Tower',
  '!!!!🤯ผู้กี่สุด',
  'ครับ !!!!',
  'KG++ เกาะ'
];

console.log('🔍 Testing Enhanced PDF Spacing (V2)\n');

testCases.forEach((test, i) => {
  const processed = processTitleForPDFV2(test);
  console.log(`${i + 1}. Original (${test.length} chars):`);
  console.log(`   "${test}"`);
  console.log(`   Processed (${processed.length} chars):`);
  console.log(`   "${processed}"`);
  console.log(`   Added: ${processed.length - test.length} characters\n`);
});

// Focus on the specific problem area
const problemArea = '!!!!🤯ผู้กี่สุด';
console.log('🎯 Problem Area Analysis:');
console.log(`Original: "${problemArea}"`);
const processedArea = processTitleForPDFV2(problemArea);
console.log(`Processed: "${processedArea}"`);

// Show character codes
console.log('\nCharacter-by-character:');
for (let i = 0; i < processedArea.length; i++) {
  const char = processedArea[i];
  const code = char.charCodeAt(0);
  const display = char === ' ' ? '[SPACE]' : char;
  console.log(`  [${i}]: ${display} (0x${code.toString(16).toUpperCase()})`);
}
