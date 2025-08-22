/**
 * Test PDF Text Processing
 * 
 * Tests the text processing functions with the actual problematic strings
 */

import { processTitleForPDF, addScriptBoundarySpacing, getSpacingStats } from '../src/lib/pdf/pdfTypo';

// The exact problematic string from the screenshot
const problemText = '2,052 KG++ เกาะพังแล้วครับ !!!!🤯ผู้กี่สุด ในชีวิต !!!! | Roblox Grow a Garden';

console.log('🔍 Testing PDF Text Processing\n');
console.log('Original text:');
console.log(`"${problemText}"`);
console.log(`Length: ${problemText.length}\n`);

// Process with the title processor
const processed = processTitleForPDF(problemText);
console.log('Processed text:');
console.log(`"${processed}"`);
console.log(`Length: ${processed.length}`);
console.log(`Characters added: ${processed.length - problemText.length}\n`);

// Get detailed stats
const stats = getSpacingStats(problemText);
console.log('Spacing Statistics:');
console.log(`Hair spaces added: ${stats.hairSpaces}`);
console.log(`Thin spaces added: ${stats.thinSpaces}`);
console.log(`Regular spaces: ${stats.regularSpaces}`);
console.log(`Total spacing chars: ${stats.totalSpacingChars}\n`);

// Show character-by-character breakdown around the problematic emoji
const emojiIndex = problemText.indexOf('🤯');
console.log('Character breakdown around emoji:');
console.log('Original:');
for (let i = emojiIndex - 5; i < emojiIndex + 10; i++) {
  if (i >= 0 && i < problemText.length) {
    const char = problemText[i];
    console.log(`  [${i}]: "${char}" (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
  }
}

console.log('\nProcessed:');
const processedEmojiIndex = processed.indexOf('🤯');
for (let i = processedEmojiIndex - 5; i < processedEmojiIndex + 10; i++) {
  if (i >= 0 && i < processed.length) {
    const char = processed[i];
    console.log(`  [${i}]: "${char}" (U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')})`);
  }
}

// Test specific problematic patterns
console.log('\n🧪 Testing specific patterns:\n');

const patterns = [
  '!!!!🤯ผู้',
  'KG++',
  'กี่สุด',
  '!!!! |'
];

patterns.forEach(pattern => {
  const processedPattern = addScriptBoundarySpacing(pattern);
  console.log(`"${pattern}" → "${processedPattern}"`);
  if (processedPattern.length > pattern.length) {
    console.log(`  (added ${processedPattern.length - pattern.length} chars)`);
  }
});

// Check if Unicode property escapes are working
console.log('\n🔧 Testing Unicode property support:');
try {
  const testRegex = /[\p{Script=Thai}]/u;
  console.log('✅ Unicode property escapes supported');
  
  // Test each regex pattern
  const thaiMatch = /[\p{Script=Thai}]/u.test('ผู้');
  const latinMatch = /[\p{Script=Latin}]/u.test('KG');
  const emojiMatch = /[\p{Extended_Pictographic}]/u.test('🤯');
  
  console.log(`Thai detection: ${thaiMatch ? '✅' : '❌'}`);
  console.log(`Latin detection: ${latinMatch ? '✅' : '❌'}`);
  console.log(`Emoji detection: ${emojiMatch ? '✅' : '❌'}`);
} catch (e) {
  console.log('❌ Unicode property escapes NOT supported');
  console.log('This is likely why the spacing isn\'t working!');
}
