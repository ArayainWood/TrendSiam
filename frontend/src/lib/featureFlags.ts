/**
 * Feature Flags for TrendSiam
 * 
 * Control feature visibility and behavior
 */

// Legacy UI Feature Flag
// When true: Shows all Legacy UI sections (analysis grid, optional sections, etc.)
// When false: Shows minimal/new UI
export const USE_LEGACY_MODAL_LAYOUT = process.env.NEXT_PUBLIC_USE_LEGACY_MODAL_LAYOUT !== 'false';

// Export other feature flags that might be used elsewhere
export const FEATURE_FLAGS = {
  USE_LEGACY_MODAL_LAYOUT,
  // Add other feature flags here as needed
} as const;