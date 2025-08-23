/**
 * Image URL utilities for Home page
 * Handles conversion of relative paths to full Supabase URLs and provides placeholders
 */

export const PLACEHOLDER_NEWS_IMAGE = '/placeholder-image.svg';  // existing file in public/

export const isAbsoluteUrl = (u?: string) => !!u && /^https?:\/\//i.test(u);

export const toPublicUrl = (rel?: string) => {
  if (!rel) return '';
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!;   // pre-existing env; do not edit env files
  const bucket = 'ai-images'; // existing bucket name from codebase
  return `${base}/storage/v1/object/public/${bucket}/${rel}`.replace(/([^:])\/+/g, '$1/');
};
