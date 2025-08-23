/**
 * Thai Font Resolver - Server Wrapper
 * 
 * Server-only wrapper for font resolution
 * Use this in Next.js server components and API routes
 */

import 'server-only';
export {
  resolveThaiFonts,
  getThaiFontBasenames
} from './fontResolver.core';
