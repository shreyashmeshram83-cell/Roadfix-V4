
import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { ReportCard } from './components/ReportCard';
import { UploadModal } from './components/UploadModal';
import { AdminDashboard } from './components/AdminDashboard';
import { LoginModal } from './components/LoginModal';
import { UserProfile } from './components/UserProfile';
import { NotificationsPage } from './components/NotificationsPage';
import { ReportsMap } from './components/ReportsMap';
import { PotholeReport, ViewState, ReportStatus, Announcement } from './types';
// no demo data - only real complaints
import { LayoutGrid, Map as MapIcon, Megaphone, Search, Split, X } from 'lucide-react';
import { authAPI, complaintsAPI, adminAPI, apiUtils, User, Complaint } from './services/apiService';
import { normalizeComplaintLocation } from './utils/location';

const App = () => {
  const normalizeAssetUrl = (value?: string, filename?: string) => {
    const resolvedValue = value || (filename ? `/uploads/${filename}` : '');
    if (!resolvedValue) return '';
    if (resolvedValue.startsWith('http://') || resolvedValue.startsWith('https://')) {
      try {
        const parsedUrl = new URL(resolvedValue);
        const currentHost = window.location.hostname;

        // If backend saved localhost/127.0.0.1 but the frontend is opened from another host,
        // rewrite the image URL to the current hostname so assets still load on other devices.
        if (
          currentHost &&
          !['localhost', '127.0.0.1'].includes(currentHost) &&
          ['localhost', '127.0.0.1'].includes(parsedUrl.hostname)
        ) {
          parsedUrl.hostname = currentHost;
          return parsedUrl.toString();
        }
      } catch (error) {
        console.warn('Failed to normalize absolute asset URL:', resolvedValue, error);
      }

      return resolvedValue;
    }

    if (resolvedValue.startsWith('data:')) {
      return resolvedValue;
    }

    const backendBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
    return resolvedValue.startsWith('/') ? `${backendBase}${resolvedValue}` : `${backendBase}/${resolvedValue}`;
  };

  const mapBackendStatusToReportStatus = (status: Complaint['status'] | string): ReportStatus => {
    switch (status) {
      case 'pending':
        return ReportStatus.PENDING;
      case 'approved':
        return ReportStatus.VERIFIED;
      case 'in_progress':
        return ReportStatus.IN_PROGRESS;
      case 'resolved':
        return ReportStatus.RESOLVED;
      default:
        return ReportStatus.PENDING;
    }
  };

  // Navigation & Auth State
  const [view, setView] = useState<ViewState>('FEED');
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showUserLoginModal, setShowUserLoginModal] = useState(false);
  const [userLoginHint, setUserLoginHint] = useState('');
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string>('');

  // Data State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [reports, setReports] = useState<PotholeReport[]>([]); // start empty, load from backend
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [feedMode, setFeedMode] = useState<'list' | 'map' | 'split'>('split');
  const [feedSearch, setFeedSearch] = useState('');
  const [feedStatusFilter, setFeedStatusFilter] = useState<'all' | 'pending' | 'approved' | 'in_progress' | 'resolved'>('all');
  const [announcements, setAnnouncements] = useState<Announcement[]>([
      { id: 'a1', message: 'Monsoon repair drive initiated in North Zone. Expect delays.', date: Date.now() }
  ]);

  const filteredReports = reports.filter((report) => {
    const query = feedSearch.trim().toLowerCase();
    const matchesQuery =
      !query ||
      report.title?.toLowerCase().includes(query) ||
      report.description.toLowerCase().includes(query) ||
      report.user.toLowerCase().includes(query) ||
      (typeof report.location !== 'string' && report.location.address?.toLowerCase().includes(query));

    const backendStatus =
      report.status === ReportStatus.PENDING ? 'pending' :
      report.status === ReportStatus.VERIFIED ? 'approved' :
      report.status === ReportStatus.IN_PROGRESS ? 'in_progress' :
      report.status === ReportStatus.RESOLVED ? 'resolved' :
      'pending';

    const matchesStatus = feedStatusFilter === 'all' || backendStatus === feedStatusFilter;

    return matchesQuery && matchesStatus;
  });

  // Check for existing authentication on app load
  useEffect(() => {
    const handleNav = () => setView('NOTIFICATIONS');
    window.addEventListener('navToNotifications', handleNav);

    const checkAuth = async () => {
      if (apiUtils.isAuthenticated()) {
        try {
          const user = await authAPI.getProfile();
          setCurrentUser(user);
          setIsLoggedIn(true);
          setIsAdmin(user.role === 'admin');
          apiUtils.setStoredUser(user);
        } catch (error) {
          // Token is invalid, clear it
          authAPI.logout();
          apiUtils.clearStoredUser();
        }
      }
      setAuthLoading(false);
    };

    checkAuth();
    return () => window.removeEventListener('navToNotifications', handleNav);
  }, []);

  // Load complaints from API when user is logged in
  useEffect(() => {
    loadComplaints(1, false);
  }, [isLoggedIn, currentUser]);

  // Load complaints from API
  const loadComplaints = async (pageNumber: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setIsLoadingMore(true);
      } else {
        setComplaintsLoading(true);
      }
      
      const response = await complaintsAPI.getComplaints({ limit: 10, page: pageNumber });
      
      // Convert API complaints to frontend format
      const formattedComplaints: PotholeReport[] = response.complaints.map(complaint => {
        const location = normalizeComplaintLocation(complaint);

        return ({
        id: complaint._id,
        complaintId: complaint.complaintId,
        title: complaint.title,
        imageUrl: normalizeAssetUrl(complaint.images?.[0]?.url || '', complaint.images?.[0]?.filename),
        images: complaint.images?.map(img => normalizeAssetUrl(img.url, img.filename)) || [],
        location,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        severity: (complaint.severity.charAt(0).toUpperCase() + complaint.severity.slice(1)) as any,
        description: complaint.description,
        status: mapBackendStatusToReportStatus(complaint.status),
        category: complaint.category,
        upvotes: complaint.upvotes,
        upvotedBy: complaint.upvotedBy,
        createdAt: new Date(complaint.createdAt).getTime(),
        user: complaint.complainant.username,
        aiAnalysis: complaint.aiAnalysis?.severity,
        currentOffice: complaint.currentOffice,
        currentOfficer: complaint.currentOfficer?.username,
        priority: complaint.priority,
        resolutionImage: complaint.resolutionImage?.url ? {
          ...complaint.resolutionImage,
          url: normalizeAssetUrl(complaint.resolutionImage.url, complaint.resolutionImage.filename)
        } : complaint.resolutionImage?.filename ? {
          ...complaint.resolutionImage,
          url: normalizeAssetUrl('', complaint.resolutionImage.filename)
        } : undefined,
        comments: complaint.comments || []
      })});
      
      if (append) {
        setReports(prev => [...prev, ...formattedComplaints]);
        setComplaints(prev => [...prev, ...response.complaints]);
      } else {
        setReports(formattedComplaints);
        setComplaints(response.complaints);
      }
      
      setHasMore(response.page < response.pages);
      setPage(response.page);
    } catch (error) {
      console.error('Failed to load complaints:', error);
      // Keep existing reports (mock data) as fallback
      console.log('Keeping existing reports as fallback');
    } finally {
      if (append) {
        setIsLoadingMore(false);
      } else {
        setComplaintsLoading(false);
      }
    }
  };

  // Auth Handlers
  const handleAdminLogin = async (email: string, password: string) => {
    try {
      setAuthLoading(true);
      const response = await authAPI.login(email, password);
      const { user, token } = response;

      // Store token and user
      apiUtils.setStoredToken(token);
      apiUtils.setStoredUser(user);

      setCurrentUser(user);
      setIsLoggedIn(true);
      setIsAdmin(user.role === 'admin');
      setShowLoginModal(false);
      setView('ADMIN');
      return true;
    } catch (error: any) {
      console.error('Admin login failed:', error);
      alert(error.message || 'Login failed');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUserLogin = async (email: string, password: string) => {
    try {
      setAuthLoading(true);
      const response = await authAPI.login(email, password);
      const { user, token } = response;

      // Store token and user
      apiUtils.setStoredToken(token);
      apiUtils.setStoredUser(user);

      setCurrentUser(user);
      setIsLoggedIn(true);
      setIsAdmin(user.role === 'admin');
      setShowUserLoginModal(false);
      setView('FEED');
      return true;
    } catch (error: any) {
      console.error('User login failed:', error);
      alert(error.message || 'Login failed');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleUserSignup = async (username: string, email: string, password: string) => {
    try {
      setAuthLoading(true);
      const response = await authAPI.register({
        username,
        email,
        password,
        firstName: username, // Use username as firstName for now
        lastName: ''
      });
      const { user, token } = response;

      // Store token and user
      apiUtils.setStoredToken(token);
      apiUtils.setStoredUser(user);

      setCurrentUser(user);
      setIsLoggedIn(true);
      setIsAdmin(false);
      setShowUserLoginModal(false);
      return true;
    } catch (error: any) {
      console.error('Signup failed:', error);
      alert(error.message || 'Signup failed');
      return false;
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    apiUtils.clearStoredUser();
    setCurrentUser(null);
    setIsLoggedIn(false);
    setIsAdmin(false);
    setView('FEED');
  };

  // Content Handlers
  const handleNewReport = async (reportData: Omit<PotholeReport, 'id' | 'createdAt' | 'upvotes' | 'status' | 'user'>, imageFile?: File) => {
    try {
      // Convert frontend format to API format
      const complaintData = {
        title: reportData.title || 'Pothole Report',
        description: reportData.description,
        category: reportData.category || 'pothole',
        severity: reportData.severity.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
        location: {
          address: typeof reportData.location === 'string' ? reportData.location : reportData.location.address || '',
          coordinates: reportData.coordinates || { latitude: 0, longitude: 0 }
        },
        images: reportData.images?.map(url => ({ 
          url, 
          filename: url.split('/').pop() || 'image.jpg',
          uploadedAt: new Date().toISOString()
        })) || [],
        aiAnalysis: reportData.aiAnalysis
      };

      const response = await complaintsAPI.createComplaint(complaintData, imageFile);
      if (!response || !response._id) {
        throw new Error('Invalid response from server when creating complaint');
      }

      // Add to local state
      const location = normalizeComplaintLocation(response);

      const newReport: PotholeReport = {
        id: response._id,
        complaintId: response.complaintId,
        title: response.title,
        imageUrl: normalizeAssetUrl(response.images?.[0]?.url || '', response.images?.[0]?.filename),
        images: response.images?.map(img => normalizeAssetUrl(img.url, img.filename)) || [],
        location,
        coordinates: {
          latitude: location.latitude,
          longitude: location.longitude
        },
        severity: (response.severity.charAt(0).toUpperCase() + response.severity.slice(1)) as any,
        description: response.description,
        status: mapBackendStatusToReportStatus(response.status),
        category: response.category,
        upvotes: response.upvotes,
        upvotedBy: response.upvotedBy,
        createdAt: new Date(response.createdAt).getTime(),
        user: response.complainant.username,
        aiAnalysis: response.aiAnalysis?.severity,
        currentOffice: response.currentOffice,
        currentOfficer: response.currentOfficer?.username,
        priority: response.priority,
        resolutionImage: response.resolutionImage?.url ? {
          ...response.resolutionImage,
          url: normalizeAssetUrl(response.resolutionImage.url, response.resolutionImage.filename)
        } : response.resolutionImage?.filename ? {
          ...response.resolutionImage,
          url: normalizeAssetUrl('', response.resolutionImage.filename)
        } : undefined,
        comments: response.comments || []
      };

      setReports([newReport, ...reports]);
      setComplaints([response, ...complaints]);
    } catch (error: any) {
      console.error('Failed to create complaint:', error);
      alert(error.message || 'Failed to submit complaint');
    }
  };

  const handleUpvote = async (id: string) => {
    if (!currentUser) {
      setUserLoginHint('Login to like reports and support the community.');
      setShowUserLoginModal(true);
      return;
    }

    try {
      const response = await complaintsAPI.upvoteComplaint(id);
      if (!response || typeof response.upvotes !== 'number') {
        throw new Error('Invalid upvote response received');
      }

      // Update local state
      setReports(reports.map(r => 
        r.id === id ? { 
          ...r, 
          upvotes: response.upvotes,
          upvotedBy: response.upvotedBy
        } : r
      ));

      // Update complaints state
      setComplaints(complaints.map(c => 
        c._id === id ? { 
          ...c, 
          upvotes: response.upvotes,
          upvotedBy: response.upvotedBy
        } : c
      ));
    } catch (error: any) {
      console.error('Failed to upvote:', error);
      alert(error.message || 'Failed to upvote');
    }
  };

  const handleRequireLogin = (reason: 'like' | 'comment') => {
    setUserLoginHint(
      reason === 'like'
        ? 'Login to like this report and help surface important issues.'
        : 'Login to comment and join the community discussion.'
    );
    setShowUserLoginModal(true);
  };

  const handleUpdateStatus = async (id: string, status: ReportStatus, remarks?: string, rejectionReason?: string, resolutionImage?: File) => {
    try {
      const response = await adminAPI.updateComplaintStatus(id, status, remarks, rejectionReason, resolutionImage);
      const nextStatus = mapBackendStatusToReportStatus(response.status);

      // Update local state
      setReports(reports.map(r => 
        r.id === id ? {
          ...r,
          status: nextStatus,
          resolutionImage: response.resolutionImage?.url ? {
            ...response.resolutionImage,
            url: normalizeAssetUrl(response.resolutionImage.url, response.resolutionImage.filename)
          } : response.resolutionImage?.filename ? {
            ...response.resolutionImage,
            url: normalizeAssetUrl('', response.resolutionImage.filename)
          } : undefined
        } as any : r
      ));

      // Update complaints state
      setComplaints(complaints.map(c => 
        c._id === id ? { ...c, status: response.status, resolutionImage: response.resolutionImage, rejectionReason: response.rejectionReason, resolution: response.resolution } : c
      ));

      await loadComplaints(1, false);
    } catch (error: any) {
      console.error('Failed to update status:', error);
      alert(error.message || 'Failed to update status');
    }
  };

  const handleDeleteReport = async (id: string, reason?: string) => {
    if (!window.confirm("Are you sure you want to delete this report?")) return;

    try {
      // Admin uses the dismantle endpoint (sends reason to user as notification)
      await complaintsAPI.dismantleComplaint(id, reason);

      // Update local state
      setReports(reports.filter(r => r.id !== id));
      setComplaints(complaints.filter(c => c._id !== id));
    } catch (error: any) {
      console.error('Failed to delete complaint:', error);
      alert(error.message || 'Failed to delete complaint');
    }
  };

  const handleAddAnnouncement = (message: string) => {
      const newAnn: Announcement = {
          id: `ann_${Date.now()}`,
          message,
          date: Date.now()
      };
      setAnnouncements([newAnn, ...announcements]);
  };

  const dismissAnnouncement = (id: string) => {
     // Just hides locally for the session demo
     setAnnouncements(announcements.filter(a => a.id !== id));
  }

  const stats = {
    total: reports.length,
    pending: reports.filter((report) => report.status === ReportStatus.PENDING).length,
    active: reports.filter((report) => report.status === ReportStatus.IN_PROGRESS || report.status === ReportStatus.VERIFIED).length,
    resolved: reports.filter((report) => report.status === ReportStatus.RESOLVED).length
  };

  return (
    <div className="rf-shell min-h-screen text-slate-900 font-sans selection:bg-orange-200/70">
      
      <Sidebar 
        currentView={view} 
        setView={setView} 
        onUploadClick={() => isLoggedIn ? setIsUploadOpen(true) : setShowUserLoginModal(true)}
        isAdmin={isAdmin}
        isLoggedIn={isLoggedIn}
        currentUser={currentUser}
        onAdminLoginClick={() => setShowLoginModal(true)}
        onUserLoginClick={() => setShowUserLoginModal(true)}
        onLogout={handleLogout}
      />

      <main className="min-h-screen pb-24 pt-3 transition-all duration-300 md:pb-8 md:pl-[290px] lg:pl-[320px]">
        <div className="mx-auto max-w-[1400px] px-4 md:px-6 lg:px-8">
          
          {/* Top Bar Mobile Title */}
          <div className="rf-glass mb-5 flex items-center justify-between rounded-[24px] px-4 py-3 md:hidden">
             <div>
               <p className="font-display text-xl font-bold tracking-tight text-slate-900">RoadFix India</p>
               <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Citizen grid</p>
             </div>
             {isLoggedIn ? (
               <div className="flex items-center gap-2">
                 <span className="text-sm text-slate-600">Hi, {currentUser?.username || currentUser?.profile?.firstName || 'User'}</span>
                 <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[linear-gradient(135deg,#135d66,#ef8354)] text-sm font-bold text-white">
                   {(currentUser?.username || currentUser?.profile?.firstName || 'U')[0].toUpperCase()}
                 </div>
               </div>
             ) : (
               <div className="h-8 w-8 rounded-full border border-white/70 bg-white/60"></div>
             )}
          </div>

          {view === 'FEED' && (
            <div className="space-y-6 animate-in fade-in duration-500">
              <section className="rf-glass rf-animate-enter overflow-hidden rounded-[36px]">
                <div className="grid gap-8 px-5 py-6 md:px-8 md:py-8 xl:grid-cols-[1.25fr_0.75fr]">
                  <div>
                    <div className="rf-chip inline-flex rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-[0.26em] text-slate-600">
                      Live civic operations
                    </div>
                    <h2 className="mt-4 max-w-3xl font-display text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
                      A sharper, calmer command center for community road reporting.
                    </h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                      Every complaint, vote, update, and repair status stays exactly the same. The interface now gives those actions a stronger visual rhythm and much better mobile breathing room.
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <div className="rf-chip rf-hover-lift rounded-[22px] px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Reports</p>
                        <p className="mt-2 text-2xl font-extrabold text-slate-900">{stats.total}</p>
                      </div>
                      <div className="rf-chip rf-hover-lift rounded-[22px] px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Pending</p>
                        <p className="mt-2 text-2xl font-extrabold text-amber-700">{stats.pending}</p>
                      </div>
                      <div className="rf-chip rf-hover-lift rounded-[22px] px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Active</p>
                        <p className="mt-2 text-2xl font-extrabold text-[color:var(--rf-brand)]">{stats.active}</p>
                      </div>
                      <div className="rf-chip rf-hover-lift rounded-[22px] px-4 py-4">
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500">Resolved</p>
                        <p className="mt-2 text-2xl font-extrabold text-emerald-700">{stats.resolved}</p>
                      </div>
                    </div>
                  </div>

                  <div className="rf-animate-float rounded-[30px] border border-white/60 bg-[linear-gradient(160deg,rgba(19,93,102,0.96),rgba(28,25,20,0.92))] p-6 text-white shadow-2xl">
                    <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/55">Feed modes</p>
                    <div className="mt-4 hidden items-center gap-1 rounded-[22px] bg-white/10 p-1 md:inline-flex">
                      <button
                        type="button"
                        onClick={() => setFeedMode('list')}
                        className={`inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                          feedMode === 'list' ? 'bg-white text-slate-900' : 'text-white/75 hover:bg-white/10'
                        }`}
                      >
                        <LayoutGrid className="h-4 w-4" />
                        List
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedMode('map')}
                        className={`inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                          feedMode === 'map' ? 'bg-white text-slate-900' : 'text-white/75 hover:bg-white/10'
                        }`}
                      >
                        <MapIcon className="h-4 w-4" />
                        Map
                      </button>
                      <button
                        type="button"
                        onClick={() => setFeedMode('split')}
                        className={`inline-flex items-center gap-2 rounded-[18px] px-4 py-2.5 text-sm font-semibold transition-colors ${
                          feedMode === 'split' ? 'bg-white text-slate-900' : 'text-white/75 hover:bg-white/10'
                        }`}
                      >
                        <Split className="h-4 w-4" />
                        Split
                      </button>
                    </div>
                    <div className="mt-6 space-y-4 text-sm text-white/78">
                      <p>List is best for browsing.</p>
                      <p>Map is best for geographic awareness.</p>
                      <p>Split keeps both context layers visible.</p>
                    </div>
                  </div>
                </div>
              </section>

              <div className="rf-glass flex flex-col gap-3 rounded-[30px] p-4 md:flex-row md:items-center md:justify-between md:p-5">
                <div className="relative flex-1 max-w-xl">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={feedSearch}
                    onChange={(e) => setFeedSearch(e.target.value)}
                    placeholder="Search by title, description, user, or address"
                    className="w-full rounded-[22px] border border-white/60 bg-white/70 py-3 pl-11 pr-4 text-sm text-slate-700 outline-none transition focus:border-[color:var(--rf-brand)] focus:bg-white focus:ring-2 focus:ring-teal-100"
                  />
                </div>
                <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
                  <button
                    type="button"
                    onClick={() => setFeedMode(feedMode === 'list' ? 'split' : 'list')}
                    className="inline-flex items-center justify-center gap-2 rounded-[22px] border border-white/60 bg-white/70 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white md:hidden"
                  >
                    <Split className="h-4 w-4" />
                    Toggle Layout
                  </button>
                  <select
                    value={feedStatusFilter}
                    onChange={(e) => setFeedStatusFilter(e.target.value as typeof feedStatusFilter)}
                    className="rounded-[22px] border border-white/60 bg-white/70 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-[color:var(--rf-brand)] focus:bg-white focus:ring-2 focus:ring-teal-100"
                    aria-label="Filter complaints by status"
                  >
                    <option value="all">All statuses</option>
                    <option value="pending">Pending</option>
                    <option value="approved">Verified</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                  <div className="rf-chip rounded-full px-3 py-2 text-xs font-semibold text-slate-700">
                    {filteredReports.length} visible
                  </div>
                </div>
              </div>

              {/* Official Announcements Section */}
              {announcements.length > 0 && (
                  <div className="space-y-3">
                      {announcements.map(ann => (
                          <div key={ann.id} className="overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#135d66,#2e3b58_60%,#ef8354)] p-5 text-white shadow-[0_24px_60px_-30px_rgba(19,93,102,0.75)] flex items-start gap-3 relative">
                              <div className="rounded-2xl bg-white/15 p-3 backdrop-blur-sm shrink-0">
                                  <Megaphone className="w-5 h-5 text-white" />
                              </div>
                              <div className="flex-1 pr-6">
                                  <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.24em] text-white/60">Official Authority Update</p>
                                  <p className="text-sm font-semibold leading-relaxed text-white/95">{ann.message}</p>
                              </div>
                              <button 
                                onClick={() => dismissAnnouncement(ann.id)}
                                className="absolute right-3 top-3 rounded-full p-1.5 transition-colors hover:bg-white/10"
                                aria-label="Dismiss announcement"
                              >
                                  <X className="w-4 h-4 text-white/80" />
                              </button>
                          </div>
                      ))}
                  </div>
              )}
              
              {reports.length === 0 ? (
                  <div className="rf-glass rounded-[30px] px-6 py-16 text-center text-slate-500">No reports available yet. You can be the first to submit a pothole image.</div>
              ) : filteredReports.length === 0 ? (
                  <div className="rf-glass rounded-[30px] px-6 py-16 text-center text-slate-500">No reports match the current search or filter.</div>
              ) : (
                <div className="space-y-6">
                  {feedMode === 'map' && (
                    <div className="rf-glass rounded-[30px] p-3">
                      <ReportsMap reports={filteredReports} className="h-[70vh] min-h-[480px] w-full overflow-hidden rounded-[24px]" />
                    </div>
                  )}

                  {feedMode === 'split' && (
                    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                      <div className="space-y-6">
                        {filteredReports.map(report => (
                            <ReportCard 
                              key={report.id} 
                              report={report} 
                              onUpvote={() => handleUpvote(report.id)}
                              onRequireLogin={handleRequireLogin}
                              currentUser={currentUser}
                              isLoggedIn={isLoggedIn}
                            />
                        ))}
                      </div>
                      <div className="xl:sticky xl:top-8 h-fit">
                        <div className="rf-glass rounded-[30px] p-3">
                          <ReportsMap reports={filteredReports} className="h-[70vh] min-h-[480px] w-full overflow-hidden rounded-[24px]" />
                        </div>
                      </div>
                    </div>
                  )}

                  {feedMode === 'list' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                      {filteredReports.map(report => (
                        <ReportCard 
                          key={report.id} 
                          report={report} 
                          onUpvote={() => handleUpvote(report.id)}
                          onRequireLogin={handleRequireLogin}
                          currentUser={currentUser}
                          isLoggedIn={isLoggedIn}
                        />
                      ))}
                    </div>
                  )}
                   
                  {hasMore && (
                    <div className="flex justify-center pt-8 pb-4">
                      <button 
                         onClick={() => loadComplaints(page + 1, true)}
                         disabled={isLoadingMore}
                         className="rf-chip flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                         {isLoadingMore ? 'Loading...' : 'Load More Complaints'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {view === 'ADMIN' && (
            <div className="space-y-2">
               <div className="rf-glass rounded-[30px] px-6 py-7 mb-6">
                   <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-slate-500">Authority Dashboard</p>
                   <h2 className="mt-3 font-display text-3xl font-bold text-slate-900">Manage infrastructure reports with a cleaner command view.</h2>
                   <p className="mt-2 text-slate-600">Every moderation, announcement, bulk action, and resolution flow stays identical.</p>
                </div>
              <AdminDashboard 
                reports={reports} 
                announcements={announcements}
                onDeleteReport={handleDeleteReport}
                onAddAnnouncement={handleAddAnnouncement}
                onUpdateStatus={handleUpdateStatus}
                onRefresh={() => loadComplaints(1, false)}
              />
            </div>
          )}

          {view === 'PROFILE' && (
            <UserProfile currentUser={currentUser} onUpvote={handleUpvote} />
          )}

          {view === 'NOTIFICATIONS' && (
            <NotificationsPage />
          )}
        </div>
      </main>

      {/* Modals */}
      {isUploadOpen && (
        <UploadModal 
          onClose={() => setIsUploadOpen(false)} 
          onSubmit={handleNewReport}
          existingReports={reports}
        />
      )}

      {showLoginModal && (
        <LoginModal 
          onClose={() => setShowLoginModal(false)}
          onLogin={handleAdminLogin}
          onSignup={async () => false}
          isAdmin={true}
        />
      )}

        {showUserLoginModal && (
          <LoginModal 
            onClose={() => setShowUserLoginModal(false)}
            onLogin={handleUserLogin}
            onSignup={handleUserSignup}
            isAdmin={false}
            hintMessage={userLoginHint}
          />
        )}

    </div>
  );
};

export default App;
