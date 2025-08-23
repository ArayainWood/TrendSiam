/**
 * Weekly Report Snapshot Builder
 * 
 * Server-side wrapper that adds Next.js-specific guards to the runtime-agnostic core.
 * Re-exports all functionality from builderCore for use in Next.js server components.
 */

import 'server-only';

// Re-export everything from the runtime-agnostic core
export * from '../snapshots/builderCore';
