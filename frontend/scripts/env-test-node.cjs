/**
 * Node.js Environment Test Helper
 * 
 * Tests environment variable loading outside of Next.js.
 * Useful for debugging environment issues.
 * 
 * Usage: node scripts/env-test-node.cjs
 */

// Load .env.local for local development
require('dotenv').config({ path: '.env.local' });

console.log('🔍 Environment Variable Check (Raw Node.js)');
console.log('===========================================');

// Check Supabase URL
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log('SUPABASE_URL:', !!url, `(length: ${(url || '').length})`);
if (url) {
  console.log('  Preview:', url.substring(0, 30) + '...');
}

// Check Service Role Key (CRITICAL - server only)
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log('SUPABASE_SERVICE_ROLE_KEY:', !!serviceRole, `(length: ${(serviceRole || '').length})`);
if (serviceRole) {
  console.log('  Preview:', serviceRole.substring(0, 10) + '...');
}

// Check Public URL
const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
console.log('NEXT_PUBLIC_SUPABASE_URL:', !!publicUrl, `(length: ${(publicUrl || '').length})`);

// Check Anon Key
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!anonKey, `(length: ${(anonKey || '').length})`);

// Validation
console.log('\n✅ Validation:');
console.log('- Has server URL:', !!url);
console.log('- Has service role key:', !!serviceRole);
console.log('- Has public URL:', !!publicUrl);
console.log('- Has anon key:', !!anonKey);
console.log('- URLs match:', url === publicUrl);

// Summary
const criticalMissing = [];
if (!url) criticalMissing.push('SUPABASE_URL');
if (!serviceRole) criticalMissing.push('SUPABASE_SERVICE_ROLE_KEY');
if (!publicUrl) criticalMissing.push('NEXT_PUBLIC_SUPABASE_URL');
if (!anonKey) criticalMissing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

if (criticalMissing.length > 0) {
  console.log('\n❌ Missing critical environment variables:');
  criticalMissing.forEach(key => console.log(`   - ${key}`));
  console.log('\n💡 Add these to your .env.local file');
  process.exit(1);
} else {
  console.log('\n🎉 All required environment variables are present!');
  console.log('📋 Node PID:', process.pid);
  console.log('📋 Node ENV:', process.env.NODE_ENV || 'undefined');
  process.exit(0);
}
