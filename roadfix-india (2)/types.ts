
export enum Severity {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  CRITICAL = 'Critical'
}

export enum ReportStatus {
  PENDING = 'Pending Review',
  VERIFIED = 'Verified',
  IN_PROGRESS = 'In Progress',
  RESOLVED = 'Resolved'
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface PotholeReport {
  id: string;
  complaintId?: string;
  title?: string;
  imageUrl: string;
  images?: string[];
  location: LocationData | string;
  coordinates?: { latitude: number; longitude: number };
  severity: Severity;
  description: string;
  status: ReportStatus;
  category?: string;
  upvotes: number;
  upvotedBy?: string[];
  createdAt: number; // timestamp
  user: string;
  aiAnalysis?: any;
  currentOffice?: string;
  currentOfficer?: string;
  priority?: string;
  resolution?: {
    resolvedAt: number;
    resolution: string;
    cost: number;
    duration: number;
  };
  resolutionImage?: {
    url: string;
    filename?: string;
  };
  comments?: Array<{
    user: any;
    text: string;
    createdAt: string;
    _id: string;
  }>;
}

export interface Announcement {
  id: string;
  message: string;
  date: number;
}

export type ViewState = 'FEED' | 'ADMIN' | 'PROFILE' | 'NOTIFICATIONS';
