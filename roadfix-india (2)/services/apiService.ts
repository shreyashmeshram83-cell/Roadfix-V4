// API Service for RoadFix Backend Integration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Types for API responses
export interface User {
  _id: string;
  username: string;
  email: string;
  role: 'user' | 'officer' | 'admin';
  office?: string;
  department?: string;
  profile: {
    firstName: string;
    lastName: string;
    phone?: string;
    address?: string;
  };
  isActive: boolean;
}

export interface Complaint {
  _id: string;
  complaintId: string;
  title: string;
  description: string;
  category: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'pending' | 'in_progress' | 'resolved' | 'rejected';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  location: {
    address: string;
    coordinates: { latitude: number; longitude: number };
    city?: string;
    state?: string;
    pincode?: string;
  };
  currentOffice: string;
  currentOfficer?: User;
  complainant: User;
  upvotes: number;
  upvotedBy: string[];
  images: Array<{ url: string; filename: string; uploadedAt: string }>;
  aiAnalysis?: {
    isPothole: boolean;
    severity: string;
    estimatedCost: string;
    confidence: number;
    analyzedAt: string;
    rejectionReason?: string;
  };
  resolutionImage?: {
    url: string;
    filename: string;
    uploadedAt: string;
  };
  resolution?: {
    resolvedAt: string;
    resolvedBy: User;
    resolution: string;
    cost: number;
    duration: number;
  };
  comments?: Array<{
    user: User | string; // Populated or ID
    text: string;
    createdAt: string;
    _id: string;
  }>;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Notification {
  _id: string;
  user: string;
  title: string;
  message: string;
  type: 'status_update' | 'new_comment' | 'upvote' | 'system' | 'rejected';
  relatedComplaint?: string;
  isRead: boolean;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  unreadCount?: number;
}

const getAuthToken = (): string | null => {
  return localStorage.getItem('roadfix_token');
};

const setAuthToken = (token: string): void => {
  localStorage.setItem('roadfix_token', token);
};

const removeAuthToken = (): void => {
  localStorage.removeItem('roadfix_token');
};

const formatStatusForBackend = (status: string): string => {
  switch (status) {
    case 'Pending Review': return 'pending';
    case 'Verified': return 'approved';
    case 'In Progress': return 'in_progress';
    case 'Resolved': return 'resolved';
    case 'Rejected': return 'rejected';
    default: return status.toLowerCase().replace(/ /g, '_');
  }
};

const apiRequest = async <T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getAuthToken();

  if (!token) {
    // still allow non-auth requests such as login, register, health; caller
    // should guard themselves for protected endpoints
    console.debug('apiRequest called without token for', endpoint);
  }

  const headers: Record<string, string> = {
    ...(token && { Authorization: `Bearer ${token}` }),
  };

  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...options.headers as Record<string, string>,
    },
    credentials: 'include',    // ensure cookies (httpOnly token) are sent
  };

  try {
    const response = await fetch(url, config);
    const isJson = response.headers.get('content-type')?.includes('application/json');
    let data;
    
    try {
      data = isJson ? await response.json() : { success: false, message: await response.text() };
    } catch (parseError) {
      data = { success: false, message: 'Invalid response format from server.' };
    }

    if (!response.ok) {
      // Only clear credentials if the token itself is expired/invalid,
      // NOT on every 401 (e.g. role-based "not authorized" errors should NOT log the user out)
      if (response.status === 401) {
        const msg = (data.message || '').toLowerCase();
        const isTokenInvalid =
          msg.includes('token') ||
          msg.includes('jwt') ||
          msg.includes('expired') ||
          msg.includes('not logged in') ||
          msg.includes('authentication');
        if (isTokenInvalid) {
          console.warn('Token expired or invalid, clearing credentials');
          removeAuthToken();
          apiUtils.clearStoredUser();
        }
      }
      throw new Error(data.message || `API request failed with status ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API Request failed:', error);
    throw error;
  }
};

// Authentication API calls
export const authAPI = {
  // Register a new user
  register: async (userData: {
    username: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    phone?: string;
  }): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    if (response.success && response.data?.token) {
      setAuthToken(response.data.token);
    }
    return response.data!;
  },

  // Login user
  login: async (email: string, password: string): Promise<AuthResponse> => {
    const response = await apiRequest<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (response.success && response.data?.token) {
      setAuthToken(response.data.token);
    } else if (response.success && !response.data?.token) {
      console.warn('login succeeded but no token returned');
    }
    return response.data!;
  },

  getProfile: async (): Promise<User> => {
    const response = await apiRequest<{ user: User }>('/auth/me');
    // The backend /auth/me returns { success: true, data: user_object }
    // So response.data IS the user object itself, not an object containing a user property.
    return response.data as unknown as User;
  },

  // Update user profile
  updateProfile: async (profileData: Partial<User['profile']>): Promise<User> => {
    const response = await apiRequest<User>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    return response.data!;
  },

  // Change password
  changePassword: async (currentPassword: string, newPassword: string): Promise<{ success: boolean }> => {
    return await apiRequest('/auth/change-password', {
      method: 'PUT',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  },

  // Logout (client-side)
  logout: (): void => {
    removeAuthToken();
  },
};

// Complaints API calls
export const complaintsAPI = {
  // Get complaints with filters
  getComplaints: async (filters: {
    status?: string;
    category?: string;
    priority?: string;
    limit?: number;
    page?: number;
    user_only?: boolean;
  } = {}): Promise<{ complaints: Complaint[]; total: number; page: number; pages: number }> => {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const response = await apiRequest<Complaint[]>(`/complaints?${queryParams}`);
    return {
      complaints: response.data || [],
      total: response.pagination?.total || 0,
      page: response.pagination?.page || 1,
      pages: response.pagination?.pages || 1
    };
  },

  // Get single complaint
  getComplaint: async (id: string): Promise<Complaint> => {
    const response = await apiRequest<Complaint>(`/complaints/${id}`);
    if (!response.data) {
      throw new Error('Complaint not found');
    }
    return response.data;
  },

  // Create new complaint
  createComplaint: async (complaintData: {
    title: string;
    description: string;
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    location: {
      address: string;
      coordinates: { latitude: number; longitude: number };
      city?: string;
      state?: string;
      pincode?: string;
    };
    images?: Array<{ url: string; filename: string; uploadedAt: string }>;
    aiAnalysis?: any;
  }, imageFile?: File): Promise<Complaint> => {
    if (!getAuthToken()) {
      throw new Error('Not authenticated');
    }

    const formData = new FormData();
    formData.append('title', complaintData.title);
    formData.append('description', complaintData.description);
    formData.append('category', complaintData.category);
    formData.append('severity', complaintData.severity);
    formData.append('location', JSON.stringify(complaintData.location));
    
    if (complaintData.aiAnalysis) {
      formData.append('aiAnalysis', JSON.stringify(complaintData.aiAnalysis));
    }
    
    if (complaintData.images && complaintData.images.length > 0) {
      formData.append('images', JSON.stringify(complaintData.images));
    }
    
    if (imageFile) {
      formData.append('images', imageFile);
    }

    // backend returns { success, message, data: complaint }
    const response = await apiRequest<Complaint>('/complaints', {
      method: 'POST',
      body: formData,
    });
    console.debug('createComplaint api response', response);
    if (!response.data) {
      throw new Error('Failed to create complaint');
    }
    return response.data;
  },

  // Analyze pothole image
  analyzePotholeImage: async (base64Image: string): Promise<{
    isPothole: boolean;
    severity: 'Low' | 'Medium' | 'High' | 'Critical';
    description: string;
    estimatedRepairCost?: string;
    rejectionReason?: string;
  }> => {
    // We send to backend, getting the unified JSON payload
    const response = await apiRequest<{
      isPothole: boolean;
      severity: 'Low' | 'Medium' | 'High' | 'Critical';
      description: string;
      estimatedRepairCost?: string;
      rejectionReason?: string;
    }>('/complaints/analyze', {
      method: 'POST',
      body: JSON.stringify({ base64Image }),
    });
    return response.data!;
  },

  // Get complaint timeline/history
  getComplaintTimeline: async (id: string): Promise<Array<{
    complaintId: string;
    action: string;
    actionDescription: string;
    actionBy: User;
    remarks: string;
    timestamp: string;
    formattedTimestamp: string;
    previousStatus?: string;
    newStatus?: string;
    previousOffice?: string;
    newOffice?: string;
    newOfficer?: User;
  }>> => {
    const response = await apiRequest<{
      data: Array<{
        complaintId: string;
        action: string;
        actionDescription: string;
        actionBy: User;
        remarks: string;
        timestamp: string;
        formattedTimestamp: string;
        previousStatus?: string;
        newStatus?: string;
        previousOffice?: string;
        newOffice?: string;
        newOfficer?: User;
      }>;
    }>(`/complaints/${id}/timeline`);
    if (!response.data) {
      throw new Error('Timeline response missing data');
    }
    return response.data as any;
  },

  // Forward complaint (officers/admin)
  forwardComplaint: async (
    id: string,
    forwardData: {
      office: string;
      officerId?: string;
      remarks: string;
    }
  ): Promise<Complaint> => {
    const response = await apiRequest<Complaint>(`/complaints/${id}/forward`, {
      method: 'PUT',
      body: JSON.stringify(forwardData),
    });
    if (!response.data) throw new Error('Forward failed');
    return response.data;
  },

  // Add remarks to complaint
  addRemarks: async (id: string, remarks: string): Promise<{ success: boolean }> => {
    return await apiRequest(`/complaints/${id}/remarks`, {
      method: 'POST',
      body: JSON.stringify({ remarks }),
    });
  },

  // Upvote complaint
  upvoteComplaint: async (id: string): Promise<{ upvotes: number; upvotedBy: string[]; hasUpvoted: boolean }> => {
    const response = await apiRequest<{
      data: { upvotes: number; upvotedBy: string[]; hasUpvoted: boolean };
    }>(`/complaints/${id}/upvote`, {
      method: 'POST',
    });
    console.debug('upvote API response', response);
    if (!response.data) {
      throw new Error('Upvote response missing data');
    }
    // backend returns { success, message, data: {upvotes,...} }
    return response.data as any;
  },

  updateComplaintStatus: async (
    id: string, 
    status: string,
    remarks?: string,
    rejectionReason?: string,
    resolutionImage?: File
  ): Promise<Complaint> => {
    let options: RequestInit = { method: 'PUT' };
    const backendStatus = formatStatusForBackend(status);

    if (resolutionImage) {
      const formData = new FormData();
      formData.append('status', backendStatus);
      if (remarks) formData.append('remarks', remarks);
      if (rejectionReason) formData.append('rejectionReason', rejectionReason);
      formData.append('resolutionImage', resolutionImage);
      options.body = formData;
    } else {
      options.body = JSON.stringify({ 
        status: backendStatus, 
        remarks: remarks || 'Status updated',
        rejectionReason 
      });
    }

    const response = await apiRequest<Complaint>(`/complaints/${id}/status`, options);
    return response.data as any; // Backend returns complaint block
  },

  // Admin-only: Dismantle/reject a complaint with a reason
  dismantleComplaint: async (id: string, reason?: string): Promise<{ success: boolean }> => {
    const response = await apiRequest(`/complaints/${id}/dismantle`, {
      method: 'DELETE',
      body: JSON.stringify({ reason })
    });
    return response as any;
  },

  // User: Delete own complaint
  deleteComplaint: async (id: string): Promise<{ success: boolean }> => {
    const response = await apiRequest(`/complaints/${id}`, {
      method: 'DELETE'
    });
    return response as any;
  },

  // Add a comment
  addComment: async (id: string, text: string): Promise<Complaint['comments']> => {
    const response = await apiRequest<Complaint['comments']>(`/complaints/${id}/comment`, {
      method: 'POST',
      body: JSON.stringify({ text })
    });
    return response.data!;
  }
};

// Admin API calls
export const adminAPI = {
  // Get dashboard statistics
  getDashboard: async (): Promise<{
    overview: {
      totalComplaints: number;
      pendingComplaints: number;
      inProgressComplaints: number;
      resolvedComplaints: number;
      rejectedComplaints: number;
      avgResolutionTime: string;
    };
    severityBreakdown: Array<{ _id: string; count: number }>;
    categoryBreakdown: Array<{ _id: string; count: number }>;
    officeWorkload: Array<{
      _id: string;
      count: number;
      pending: number;
      inProgress: number;
    }>;
    recentActivity: Array<{
      _id: string;
      action: string;
      remarks: string;
      timestamp: string;
    }>;
  }> => {
    const response = await apiRequest<{
      overview: {
        totalComplaints: number;
        pendingComplaints: number;
        inProgressComplaints: number;
        resolvedComplaints: number;
        rejectedComplaints: number;
        avgResolutionTime: string;
      };
      severityBreakdown: Array<{ _id: string; count: number }>;
      categoryBreakdown: Array<{ _id: string; count: number }>;
      officeWorkload: Array<{
        _id: string;
        count: number;
        pending: number;
        inProgress: number;
      }>;
      recentActivity: Array<{
        _id: string;
        action: string;
        remarks: string;
        timestamp: string;
      }>;
    }>('/admin/dashboard');
    return response.data!;
  },

  // Get users for management
  getUsers: async (filters: { role?: string; isActive?: boolean } = {}): Promise<{
    users: User[];
    total: number;
  }> => {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const response = await apiRequest<User[]>(
      `/admin/users?${queryParams}`
    );
    return {
      users: response.data || [],
      total: response.pagination?.total || 0
    };
  },

  // Update user status
  updateUserStatus: async (userId: string, isActive: boolean): Promise<User> => {
    const response = await apiRequest<User>(`/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ isActive }),
    });
    return response.data!;
  },

  // Bulk operations on complaints
  bulkOperation: async (operationData: {
    operation: 'update_status' | 'delete' | 'assign_priority';
    complaintIds: string[];
    data: any;
  }): Promise<{ success: boolean; updated: number }> => {
    const response = await apiRequest<{ success: boolean; updated: number }>(
      '/admin/bulk-operation',
      {
        method: 'POST',
        body: JSON.stringify(operationData),
      }
    );
    return response.data!;
  },

  // Bulk update status
  bulkUpdateStatus: async (complaintIds: string[], status: string): Promise<{ success: boolean; updated: number }> => {
    return await adminAPI.bulkOperation({
      operation: 'update_status',
      complaintIds,
      data: { status: formatStatusForBackend(status) }
    });
  },

  updateComplaintStatus: async (
    id: string,
    status: string,
    remarks?: string,
    rejectionReason?: string,
    resolutionImage?: File
  ): Promise<Complaint> => {
    const backendStatus = formatStatusForBackend(status);
    let options: RequestInit = { method: 'PUT' };

    if (resolutionImage) {
      const formData = new FormData();
      formData.append('status', backendStatus);
      if (remarks) formData.append('remarks', remarks);
      if (rejectionReason) formData.append('rejectionReason', rejectionReason);
      formData.append('resolutionImage', resolutionImage);
      options.body = formData;
    } else {
      options.body = JSON.stringify({
        status: backendStatus,
        remarks,
        rejectionReason
      });
    }

    const response = await apiRequest<Complaint>(`/admin/complaints/${id}/status`, options);
    if (!response.data) {
      throw new Error('Failed to update complaint status');
    }
    return response.data;
  },

  // Bulk delete
  bulkDelete: async (complaintIds: string[]): Promise<{ success: boolean; updated: number }> => {
    return await adminAPI.bulkOperation({
      operation: 'delete',
      complaintIds,
      data: {}
    });
  },

  // Get system settings
  getSettings: async (): Promise<Record<string, any>> => {
    const response = await apiRequest<Record<string, any>>('/admin/settings');
    return response.data!;
  },

  // Update system settings
  updateSettings: async (settings: Record<string, any>): Promise<Record<string, any>> => {
    const response = await apiRequest<Record<string, any>>('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
    return response.data!;
  },
};

// Utility functions
export const apiUtils = {
  // Check if user is authenticated
  isAuthenticated: (): boolean => {
    return !!getAuthToken();
  },

  // Get stored user data
  getStoredUser: (): User | null => {
    const userData = localStorage.getItem('roadfix_user');
    return userData ? JSON.parse(userData) : null;
  },

  // Store user data
  setStoredUser: (user: User): void => {
    localStorage.setItem('roadfix_user', JSON.stringify(user));
  },

  // Store auth token
  setStoredToken: (token: string): void => {
    localStorage.setItem('roadfix_token', token);
  },

  // Clear stored user data
  clearStoredUser: (): void => {
    localStorage.removeItem('roadfix_user');
    localStorage.removeItem('roadfix_token');
  },

  // Format API errors
  formatError: (error: any): string => {
    if (error.response?.data?.message) {
      return error.response.data.message;
    }
    if (error.message) {
      return error.message;
    }
    return 'An unexpected error occurred';
  },
};

// Notifications API
export const notificationsAPI = {
  getNotifications: async (): Promise<{ data: Notification[], unreadCount: number }> => {
    const response = await apiRequest<{ data: Notification[], unreadCount: number }>('/notifications');
    return {
      data: (response.data as unknown as Notification[]) || [],
      unreadCount: response.unreadCount || 0
    };
  },
  
  markAsRead: async (id: string): Promise<void> => {
    await apiRequest(`/notifications/${id}/read`, { method: 'PUT' });
  },

  markAllAsRead: async (): Promise<void> => {
    await apiRequest('/notifications/read-all', { method: 'PUT' });
  }
};
