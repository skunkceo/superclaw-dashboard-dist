import { NextRequest, NextResponse } from 'next/server';
import { getActivityLog } from '@/lib/db';

interface DayData {
  date: string;
  count: number;
}

interface WeekData {
  days: DayData[];
}

interface HeatmapResponse {
  weeks: WeekData[];
  total: number;
  maxCount: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ label: string }> }
): Promise<NextResponse> {
  try {
    const { label } = await params;
    
    // Get activity data from the last 365 days
    const oneYearAgo = Date.now() - (365 * 24 * 60 * 60 * 1000);
    
    let activities;
    if (label === 'all') {
      // Get all agent activities for team view
      activities = getActivityLog({
        since: oneYearAgo,
      });
    } else {
      // Get activities for specific agent
      activities = getActivityLog({
        agent_label: label,
        since: oneYearAgo,
      });
    }

    // Group activities by date
    const dailyCounts: Record<string, number> = {};
    activities.forEach(activity => {
      const date = new Date(activity.timestamp);
      const dateKey = date.toISOString().split('T')[0]; // YYYY-MM-DD format
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    });

    // Build weeks array (52 weeks, Sunday to Saturday)
    const weeks: WeekData[] = [];
    const today = new Date();
    
    // Find the start of the week (Sunday) for the oldest week we need
    // Go back 52 weeks from today
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - (51 * 7)); // 51 weeks back, plus current week = 52 total
    
    // Find the Sunday of that week
    const startSunday = new Date(startDate);
    startSunday.setDate(startDate.getDate() - startDate.getDay());
    
    let currentWeekStart = new Date(startSunday);
    let totalActivities = 0;
    let maxCount = 0;
    
    for (let week = 0; week < 52; week++) {
      const weekDays: DayData[] = [];
      
      for (let day = 0; day < 7; day++) {
        const currentDay = new Date(currentWeekStart);
        currentDay.setDate(currentWeekStart.getDate() + day);
        
        // Don't include future dates
        if (currentDay > today) {
          weekDays.push({
            date: currentDay.toISOString().split('T')[0],
            count: 0,
          });
          continue;
        }
        
        const dateKey = currentDay.toISOString().split('T')[0];
        const count = dailyCounts[dateKey] || 0;
        
        weekDays.push({
          date: dateKey,
          count,
        });
        
        totalActivities += count;
        if (count > maxCount) {
          maxCount = count;
        }
      }
      
      weeks.push({ days: weekDays });
      
      // Move to next week
      currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    }

    const response: HeatmapResponse = {
      weeks,
      total: totalActivities,
      maxCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Heatmap API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch heatmap data' },
      { status: 500 }
    );
  }
}