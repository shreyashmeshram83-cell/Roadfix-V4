import React, { useState } from 'react';
import { MapPin, ThumbsUp, MessageCircle, Share2, AlertTriangle, Clock, Send, Camera } from 'lucide-react';
import { PotholeReport } from '../types';
import { STATUS_COLORS, SEVERITY_COLORS } from '../constants';
import { complaintsAPI } from '../services/apiService';
import { normalizeLocation } from '../utils/location';

interface ReportCardProps {
  report: PotholeReport;
  onUpvote?: () => void;
  onRequireLogin?: (reason: 'like' | 'comment') => void;
  currentUser?: any; // User object or string
  isLoggedIn?: boolean;
}

export const ReportCard: React.FC<ReportCardProps> = ({ report, onUpvote, onRequireLogin, currentUser, isLoggedIn = false }) => {
  const resolvedLocation = normalizeLocation(report.location);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [comments, setComments] = useState(report.comments || []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAfterImg, setShowAfterImg] = useState(false); // Used for Before/After toggle
  const [afterImageFailed, setAfterImageFailed] = useState(false);
  const [afterImageIndex, setAfterImageIndex] = useState(0);

  const beforeImageUrl = report.imageUrl;
  const backendBase = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api').replace(/\/api\/?$/, '');
  const afterImageCandidates = React.useMemo(() => {
    const candidates = new Set<string>();
    const rawUrl = report.resolutionImage?.url;
    const filename = report.resolutionImage?.filename;

    if (rawUrl) {
      candidates.add(rawUrl);

      try {
        const parsed = new URL(rawUrl);
        candidates.add(`${backendBase}${parsed.pathname}`);
        candidates.add(`${window.location.origin}${parsed.pathname}`);
      } catch (error) {
        if (rawUrl.startsWith('/')) {
          candidates.add(`${backendBase}${rawUrl}`);
          candidates.add(`${window.location.origin}${rawUrl}`);
        } else {
          candidates.add(`${backendBase}/${rawUrl}`);
        }
      }
    }

    if (filename) {
      candidates.add(`${backendBase}/uploads/${filename}`);
      candidates.add(`${window.location.origin}/uploads/${filename}`);
    }

    return Array.from(candidates).filter(Boolean);
  }, [backendBase, report.resolutionImage?.filename, report.resolutionImage?.url]);
  const afterImageUrl = !afterImageFailed ? afterImageCandidates[afterImageIndex] || '' : '';

  const hasLiked = currentUser && report.upvotedBy ? 
    report.upvotedBy.includes(currentUser._id || currentUser) : false;

  React.useEffect(() => {
    setAfterImageFailed(false);
    setShowAfterImg(false);
    setAfterImageIndex(0);
  }, [report.id, report.resolutionImage?.filename, report.resolutionImage?.url]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    if (!isLoggedIn) {
      onRequireLogin?.('comment');
      return;
    }
    setIsSubmitting(true);
    try {
      const updatedComments = await complaintsAPI.addComment(report.id || report.complaintId!, commentText);
      setComments(updatedComments);
      setCommentText('');
    } catch (err) {
      console.error(err);
      alert('Failed to post comment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rf-glass-strong rf-hover-lift rf-animate-enter mb-6 overflow-hidden rounded-[30px] transition-all">
      {/* Header */}
      <div className="flex items-start justify-between p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#135d66,#ef8354)] text-sm font-bold text-white shadow-lg shadow-orange-100/50">
            {report.user.charAt(0).toUpperCase()}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">{report.user}</h3>
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin className="w-3 h-3" />
              <span className="truncate max-w-[200px]">
                {resolvedLocation.address || "Unknown Location"}
              </span>
            </div>
          </div>
        </div>
        <span className={`px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-[0.18em] border ${STATUS_COLORS[report.status] || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
          {report.status.toUpperCase()}
        </span>
      </div>

      {/* Image / Slider */}
      <div className="group relative aspect-square w-full bg-slate-100 md:aspect-video">
        <img 
          src={showAfterImg && afterImageUrl ? afterImageUrl : beforeImageUrl} 
          alt={showAfterImg ? "Resolved Pothole" : "Reported Pothole"} 
          className="w-full h-full object-cover transition-opacity duration-300"
          onError={() => {
            if (showAfterImg) {
              if (afterImageIndex < afterImageCandidates.length - 1) {
                setAfterImageIndex((prev) => prev + 1);
              } else {
                setAfterImageFailed(true);
                setShowAfterImg(false);
              }
            }
          }}
        />
        
        {/* Before / After Toggle if Resolved */}
        {afterImageCandidates.length > 0 && (
          <div className="absolute right-4 top-4 flex rounded-2xl border border-white/40 bg-white/75 p-1 shadow-sm backdrop-blur-sm">
            <button 
              onClick={() => setShowAfterImg(false)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${!showAfterImg ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              BEFORE
            </button>
            <button 
              onClick={() => setShowAfterImg(true)}
              className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${showAfterImg ? 'bg-green-600 text-white' : 'text-slate-600 hover:bg-slate-200'}`}
            >
              AFTER
            </button>
          </div>
        )}

        <div className="absolute bottom-4 left-4 flex gap-2">
            <span className={`rounded-full px-3 py-1.5 text-xs font-bold shadow-sm ${SEVERITY_COLORS[report.severity] || 'bg-slate-800 text-white'}`}>
                {report.severity}
            </span>
            {showAfterImg && (
              <span className="flex items-center gap-1 rounded-full bg-green-500 px-3 py-1.5 text-xs font-bold text-white shadow-sm">
                <Camera className="w-3 h-3" /> Repaired
              </span>
            )}
        </div>

        <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Content */}
        <div className="space-y-4 p-5">
        {afterImageCandidates.length > 0 && afterImageFailed && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Proof image could not be loaded right now. Try again after refresh.
          </div>
        )}
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-5">
              <button 
                onClick={() => {
                  if (!isLoggedIn) {
                    onRequireLogin?.('like');
                    return;
                  }
                  onUpvote?.();
                }}
                className={`flex items-center gap-1.5 transition-colors ${
                  hasLiked ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
                }`}
                title={!isLoggedIn ? 'Login to vote' : hasLiked ? 'Remove Vote' : 'Upvote Issue'}
              >
                <ThumbsUp className={`w-5 h-5 ${hasLiked ? 'fill-current' : ''}`} />
                <span className="font-semibold">{report.upvotes}</span>
              </button>
              
              <button 
                onClick={() => setShowComments(!showComments)}
                className={`flex items-center gap-1.5 transition-colors ${
                  showComments ? 'text-blue-600' : 'text-slate-500 hover:text-blue-600'
                }`}
              >
                <MessageCircle className="w-5 h-5 text-current" />
                <span className="font-semibold">{comments.length}</span>
              </button>
              
              <button className="text-slate-500 hover:text-blue-600 transition-colors">
                <Share2 className="w-5 h-5" />
              </button>
           </div>
           <span className="flex items-center gap-1 text-xs font-medium text-slate-400">
             <Clock className="w-3.5 h-3.5" />
             {new Date(report.createdAt).toLocaleDateString()}
           </span>
        </div>

        <div>
            {report.title && (
              <h4 className="mb-2 font-display text-xl font-bold leading-tight text-slate-900">
                {report.title}
              </h4>
            )}
            <p className="text-sm leading-7 text-slate-700">
                <span className="mr-2 font-bold text-slate-900">{report.user}</span> 
                {report.description}
            </p>
            {report.aiAnalysis && typeof report.aiAnalysis === 'string' && (
                <div className="mt-4 rounded-[22px] border border-teal-100 bg-teal-50/80 p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--rf-brand)]" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--rf-brand)]">AI Verification</span>
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-slate-700">
                        {report.aiAnalysis}
                    </p>
                </div>
            )}
            {report.aiAnalysis && typeof report.aiAnalysis === 'object' && (
                <div className="mt-4 rounded-[22px] border border-teal-100 bg-teal-50/80 p-4">
                    <div className="mb-1.5 flex items-center gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-[color:var(--rf-brand)]" />
                        <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[color:var(--rf-brand)]">AI Verification</span>
                    </div>
                    <p className="text-xs font-medium leading-relaxed text-slate-700">
                        Analyzed severity: {report.aiAnalysis.severity} (Confidence: {Math.round(report.aiAnalysis.confidence * 100)}%)
                        <br/>Est. Repair Cost: {report.aiAnalysis.estimatedCost}
                    </p>
                </div>
            )}
        </div>

        {/* Comments Section */}
        {showComments && (
          <div className="mt-2 space-y-4 border-t border-slate-200/70 pt-4 animate-in fade-in duration-200">
             <div className="rf-scrollbar max-h-60 space-y-3 overflow-y-auto pr-2">
               {comments.length === 0 ? (
                 <p className="text-xs text-center text-slate-400 py-2">No comments yet. Start the conversation!</p>
               ) : (
                 comments.map((comment, idx) => (
                   <div key={comment._id || idx} className="flex gap-2.5">
                     <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                       {(typeof comment.user === 'object' && comment.user.username) 
                          ? comment.user.username.charAt(0).toUpperCase() 
                          : typeof comment.user === 'string' ? "U" : "?"}
                     </div>
                     <div className="flex-1 rounded-2xl rounded-tl-none border border-white/70 bg-white/70 px-3 py-2">
                        <p className="text-[11px] font-bold text-slate-900 mb-0.5">
                          {(typeof comment.user === 'object' && comment.user.username) ? comment.user.username : 'Community Member'}
                        </p>
                        <p className="text-xs text-slate-700 leading-relaxed">{comment.text}</p>
                     </div>
                   </div>
                 ))
               )}
             </div>

             {isLoggedIn ? (
               <form onSubmit={handleAddComment} className="relative mt-4 flex gap-2">
                 <input 
                   type="text" 
                   value={commentText}
                   onChange={e => setCommentText(e.target.value)}
                   placeholder="Add a comment..."
                   className="w-full rounded-full border border-white/80 bg-white/80 py-3 pl-4 pr-12 text-sm text-slate-800 transition-all focus:border-[color:var(--rf-brand)] focus:outline-none focus:ring-2 focus:ring-teal-100"
                 />
                 <button 
                   type="submit" 
                   disabled={isSubmitting || !commentText.trim()}
                   className="absolute right-1.5 top-1.5 rounded-full bg-[color:var(--rf-brand)] p-2 text-white transition-colors hover:bg-teal-700 disabled:bg-slate-400 disabled:opacity-50"
                 >
                   <Send className="w-3.5 h-3.5" />
                 </button>
               </form>
             ) : (
               <div className="rounded-2xl border border-white/70 bg-white/60 p-3 text-center">
                 <p className="text-xs text-slate-500">Login to like or comment on this report.</p>
                 <button
                   type="button"
                   onClick={() => onRequireLogin?.('comment')}
                   className="mt-2 rounded-full bg-[color:var(--rf-brand)] px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-teal-700"
                 >
                   Login to interact
                 </button>
               </div>
             )}
          </div>
        )}
      </div>
    </div>
  );
};
