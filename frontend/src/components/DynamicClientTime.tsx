/**
 * Dynamic Client Time Component Wrapper
 * 
 * Uses next/dynamic to load ClientTime without SSR to prevent hydration mismatches.
 */

import dynamic from 'next/dynamic';

// Import ClientTime component without SSR
const DynamicClientTime = dynamic(() => import('./ClientTime'), {
  ssr: false,
  loading: () => <span className="text-gray-500">Loading time...</span>
});

export default DynamicClientTime;
