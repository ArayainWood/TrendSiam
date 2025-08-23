/**
 * Build information with consistent client/server values
 * 
 * Fixed: No dynamic values to prevent hydration mismatches
 */

const BUILD_TAG_VALUE =
  process.env.NEXT_PUBLIC_BUILD_TAG ??
  process.env.BUILD_TAG ??
  'weekly-fix-' + (process.env.BUILD_ID ?? 'dev');

export const BUILD_TAG = BUILD_TAG_VALUE;