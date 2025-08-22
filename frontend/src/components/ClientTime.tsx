/**
 * Client-side time rendering component for Thai Buddhist year display
 * 
 * Fixes hydration errors by using suppressHydrationWarning and client-side rendering.
 * Displays time in Thai Buddhist Era with proper timezone handling.
 */

'use client';

import React from 'react';
import dayjs from 'dayjs';
import buddhistEra from 'dayjs/plugin/buddhistEra';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import 'dayjs/locale/th';

// Configure dayjs plugins
dayjs.extend(buddhistEra);
dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.locale('th');

interface ClientTimeProps {
  iso: string;
  format?: string;
  className?: string;
}

/**
 * Client-side time component that prevents hydration mismatches
 */
const ClientTime: React.FC<ClientTimeProps> = ({ 
  iso, 
  format = 'D/M/BBBB H:mm:ss',
  className = ''
}) => {
  const [isClient, setIsClient] = React.useState(false);

  React.useEffect(() => {
    setIsClient(true);
  }, []);

  // Return placeholder during SSR to prevent hydration mismatch
  if (!isClient) {
    return <span className={className}>Loading...</span>;
  }

  try {
    // Parse the ISO string and convert to Bangkok timezone
    const thaiTime = dayjs(iso)
      .tz('Asia/Bangkok')
      .format(format);

    return (
      <span 
        className={className}
        suppressHydrationWarning
        title={`Original: ${iso}`}
      >
        {thaiTime}
      </span>
    );
  } catch (error) {
    console.error('[ClientTime] Error formatting time:', error);
    return (
      <span className={className} suppressHydrationWarning>
        {iso}
      </span>
    );
  }
};

export default ClientTime;

/**
 * Higher-order component for dynamic imports without SSR
 */
export const DynamicClientTime = React.lazy(() => import('./ClientTime').then(module => ({ default: module.default })));

/**
 * Utility function to format Thai Buddhist year on client side
 */
export const formatThaiBuddhistTime = (iso: string, format: string = 'D/M/BBBB H:mm:ss'): string => {
  if (typeof window === 'undefined') {
    return iso; // Return ISO on server-side
  }
  
  try {
    return dayjs(iso).tz('Asia/Bangkok').format(format);
  } catch (error) {
    console.error('[formatThaiBuddhistTime] Error:', error);
    return iso;
  }
};
