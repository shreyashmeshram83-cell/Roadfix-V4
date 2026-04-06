import { LocationData, PotholeReport, Severity, ReportStatus } from '../types';
import { Complaint } from '../services/apiService';

export const DEFAULT_LOCATION: LocationData = {
  latitude: 20.5937,
  longitude: 78.9629,
  address: 'India'
};

export const normalizeLocation = (
  location?: Partial<LocationData> | string | null,
  fallback: LocationData = DEFAULT_LOCATION
): LocationData => {
  if (typeof location === 'string') {
    return {
      ...fallback,
      address: location
    };
  }

  const latitude = Number(location?.latitude);
  const longitude = Number(location?.longitude);

  return {
    latitude: Number.isFinite(latitude) ? latitude : fallback.latitude,
    longitude: Number.isFinite(longitude) ? longitude : fallback.longitude,
    address: location?.address || fallback.address
  };
};

export const normalizeComplaintLocation = (complaint: Complaint): LocationData => {
  return normalizeLocation({
    latitude: complaint.location?.coordinates?.latitude,
    longitude: complaint.location?.coordinates?.longitude,
    address: complaint.location?.address
  });
};

export const complaintToReport = (complaint: Complaint): PotholeReport => {
  const location = normalizeComplaintLocation(complaint);

  return {
    id: complaint._id,
    complaintId: complaint.complaintId,
    title: complaint.title,
    imageUrl: complaint.images?.[0]?.url || '',
    images: complaint.images?.map((img) => img.url) || [],
    location,
    coordinates: {
      latitude: location.latitude,
      longitude: location.longitude
    },
    severity: (complaint.severity.charAt(0).toUpperCase() + complaint.severity.slice(1)) as Severity,
    description: complaint.description,
    status: complaint.status as unknown as ReportStatus,
    category: complaint.category,
    upvotes: complaint.upvotes,
    upvotedBy: complaint.upvotedBy,
    createdAt: new Date(complaint.createdAt).getTime(),
    user: complaint.complainant.username,
    aiAnalysis: complaint.aiAnalysis,
    currentOffice: complaint.currentOffice,
    currentOfficer: complaint.currentOfficer?.username,
    priority: complaint.priority,
    resolution: complaint.resolution
      ? {
          resolvedAt: new Date(complaint.resolution.resolvedAt).getTime(),
          resolution: complaint.resolution.resolution,
          cost: complaint.resolution.cost,
          duration: complaint.resolution.duration
        }
      : undefined,
    resolutionImage: complaint.resolutionImage,
    comments: complaint.comments || []
  };
};
