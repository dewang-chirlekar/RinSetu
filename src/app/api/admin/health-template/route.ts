import { NextResponse } from 'next/server';
import { healthCsvTemplate } from '@/lib/health-csv';

export const dynamic = 'force-dynamic';

export async function GET() {
  const csv = healthCsvTemplate();
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rinsetu-health-template.csv"',
      'Cache-Control': 'no-store',
    },
  });
}
