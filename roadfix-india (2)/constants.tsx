import React from 'react';
import { PotholeReport, ReportStatus, Severity } from './types';

// previously used for demo data; now removed so frontend only shows real complaints
export const MOCK_REPORTS: PotholeReport[] = [];

export const STATUS_COLORS = {
  [ReportStatus.PENDING]: 'bg-amber-100/90 text-amber-900 border-amber-200',
  [ReportStatus.VERIFIED]: 'bg-teal-100/90 text-teal-900 border-teal-200',
  [ReportStatus.IN_PROGRESS]: 'bg-sky-100/90 text-sky-900 border-sky-200',
  [ReportStatus.RESOLVED]: 'bg-emerald-100/90 text-emerald-900 border-emerald-200',
};

export const SEVERITY_COLORS = {
  [Severity.LOW]: 'bg-stone-100 text-stone-700',
  [Severity.MEDIUM]: 'bg-orange-100 text-orange-800',
  [Severity.HIGH]: 'bg-rose-100 text-rose-800',
  [Severity.CRITICAL]: 'bg-orange-700 text-white',
};
