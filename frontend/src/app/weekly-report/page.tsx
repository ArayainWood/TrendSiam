import { BUILD_TAG } from '@/lib/buildInfo'
import WeeklyReportClient from './WeeklyReportClient'
import { fetchWeeklySnapshot } from '@/lib/data/weeklySnapshot'

// Force dynamic rendering to always fetch fresh data
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Use snapshot-based data fetching
export default async function WeeklyReportPage({ 
  searchParams 
}: { 
  searchParams: { snapshot?: string } 
}) {
  // Fetch from snapshot system
  const snapshotData = await fetchWeeklySnapshot(searchParams?.snapshot);
  
  return (
    <WeeklyReportClient 
      snapshotData={snapshotData}
      buildTag={BUILD_TAG}
    />
  );
}