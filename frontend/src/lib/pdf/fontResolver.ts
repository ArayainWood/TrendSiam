/**
 * Thai Font Resolver - Legacy Server Wrapper
 * 
 * Legacy wrapper that imports from server-specific module
 * Maintains backward compatibility for existing server code
 */

export {
  resolveThaiFonts,
  getThaiFontBasenames
} from './fontResolver.server';