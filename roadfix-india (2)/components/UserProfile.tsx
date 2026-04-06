import React, { useState, useEffect } from 'react';
import { Activity, AlertCircle, Trash2 } from 'lucide-react';
import { ReportCard } from './ReportCard';
import { complaintsAPI } from '../services/apiService';
import { PotholeReport } from '../types';
import { normalizeComplaintLocation } from '../utils/location';

interface UserProfileProps {
  currentUser: any;
  onUpvote: (id: string) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ currentUser, onUpvote }) => {
  const [myReports, setMyReports] = useState<PotholeReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetchMyReports();
  }, []);

  const fetchMyReports = async () => {
    try {
      setLoading(true);
      const data = await complaintsAPI.getComplaints({ user_only: true, limit: 100 });
      const formatted = data.complaints.map((c: any) => ({
        ...(() => {
          const location = normalizeComplaintLocation(c);
          return {
            location,
            coordinates: {
              latitude: location.latitude,
              longitude: location.longitude
            }
          };
        })(),
        id: c._id,
        complaintId: c.complaintId,
        title: c.title,
        imageUrl: c.images?.[0]?.url || '',
        images: c.images?.map((img: any) => img.url) || [],
        severity: c.severity,
        description: c.description || 'No description provided.',
        status: c.status,
        upvotes: c.upvotes || 0,
        upvotedBy: c.upvotedBy || [],
        createdAt: new Date(c.createdAt).getTime(),
        user: typeof c.complainant === 'object' ? c.complainant.username : (currentUser?.username || 'You'),
        aiAnalysis: c.aiAnalysis,
        currentOffice: c.currentOffice,
        currentOfficer: c.currentOfficer?.username,
        priority: c.priority,
        resolutionImage: c.resolutionImage,
        comments: c.comments || []
      }));
      setMyReports(formatted);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReport = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this report? This cannot be undone.')) return;
    setDeletingId(id);
    try {
      await complaintsAPI.deleteComplaint(id);
      // Remove from local state instantly
      setMyReports(prev => prev.filter(r => r.id !== id));
    } catch (e: any) {
      alert(e.message || 'Failed to delete report.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 max-w-3xl mx-auto pb-20">
      <div className="rf-glass flex items-center gap-6 rounded-[32px] p-6">
        <div className="flex h-20 w-20 items-center justify-center rounded-[26px] bg-[linear-gradient(135deg,#135d66,#ef8354)] text-3xl font-bold text-white shadow-lg">
          {currentUser?.username?.[0]?.toUpperCase() || 'U'}
        </div>
        <div>
          <h2 className="font-display text-3xl font-bold text-slate-900">{currentUser?.profile?.firstName} {currentUser?.profile?.lastName}</h2>
          <p className="font-medium text-slate-500">@{currentUser?.username}</p>
          <div className="mt-3 flex gap-4">
            <div className="rf-chip flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold text-slate-700">
               <Activity className="h-4 w-4 text-[color:var(--rf-brand)]" />
               {myReports.length} Reports Submitted
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="mb-6 flex items-center gap-3 font-display text-2xl font-bold text-slate-900">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/70">
            <AlertCircle className="h-5 w-5 text-slate-500" />
          </span>
          My Submissions
        </h3>
        
        {loading ? (
          <div className="text-center p-12 text-slate-500">Loading your reports...</div>
        ) : myReports.length === 0 ? (
          <div className="rf-glass rounded-[30px] border-dashed p-12 text-center">
             <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <h3 className="text-lg font-semibold text-slate-700">No reports yet</h3>
             <p className="text-slate-500 text-sm mt-2 max-w-sm mx-auto">You haven't reported any potholes yet. Use the + button to submit your first report and help fix your community.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {myReports.map(report => (
              <div key={report.id} className="relative group">
                <ReportCard 
                  report={report} 
                  onUpvote={() => onUpvote(report.id)}
                  currentUser={currentUser}
                  isLoggedIn={true}
                />
                {/* Delete button — only visible in My Submissions */}
                <button
                  onClick={() => handleDeleteReport(report.id)}
                  disabled={deletingId === report.id}
                  className="absolute top-4 right-4 z-10 flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 hover:text-red-700 border border-red-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 shadow-sm"
                  title="Delete your report"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {deletingId === report.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
