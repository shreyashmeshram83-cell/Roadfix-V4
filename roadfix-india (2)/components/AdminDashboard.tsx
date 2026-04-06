
import React, { useState } from 'react';
import { PotholeReport, ReportStatus, Announcement } from '../types';
import { STATUS_COLORS } from '../constants';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { CheckCircle, Clock, AlertOctagon, Filter, Trash2, Megaphone, Send } from 'lucide-react';
import { adminAPI } from '../services/apiService';
import { normalizeLocation } from '../utils/location';

interface AdminDashboardProps {
  reports: PotholeReport[];
  announcements: Announcement[];
  onDeleteReport: (id: string, reason?: string) => void;
  onAddAnnouncement: (message: string) => void;
  onUpdateStatus: (id: string, status: ReportStatus, remarks?: string, rejectionReason?: string, resolutionImage?: File) => void;
  onRefresh?: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ 
  reports, 
  announcements,
  onDeleteReport,
  onAddAnnouncement,
  onUpdateStatus,
  onRefresh
}) => {
  const [newAnnouncement, setNewAnnouncement] = useState('');
  const [filter, setFilter] = useState<ReportStatus | 'ALL'>('ALL');
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ReportStatus>(ReportStatus.VERIFIED);

  // New states for advanced resolution
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveImage, setResolveImage] = useState<File | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvingId) {
      return;
    }
    if (!resolveImage) {
      alert('Please upload a proof image before marking this report as resolved.');
      return;
    }
    onUpdateStatus(resolvingId, ReportStatus.RESOLVED, 'Repaired successfully', undefined, resolveImage || undefined);
    setResolvingId(null);
    setResolveImage(null);
  };

  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId || !rejectReason.trim()) {
      alert("Please enter a reason for rejecting the report.");
      return;
    }
    // We send Dismantle (Delete) call
    onDeleteReport(rejectingId, rejectReason);
    setRejectingId(null);
    setRejectReason('');
  };

  const filteredReports = filter === 'ALL' 
    ? reports 
    : reports.filter(r => r.status === filter);

  // Stats
  const total = reports.length;
  const pending = reports.filter(r => r.status === ReportStatus.PENDING).length;
  const resolved = reports.filter(r => r.status === ReportStatus.RESOLVED).length;
  const highSeverity = reports.filter(r => r.severity === 'High' || r.severity === 'Critical').length;

  const severityData = [
    { name: 'Low', value: reports.filter(r => r.severity === 'Low').length, color: '#94a3b8' },
    { name: 'Med', value: reports.filter(r => r.severity === 'Medium').length, color: '#f97316' },
    { name: 'High', value: reports.filter(r => r.severity === 'High').length, color: '#ef4444' },
    { name: 'Crit', value: reports.filter(r => r.severity === 'Critical').length, color: '#dc2626' },
  ];

  const handlePostAnnouncement = (e: React.FormEvent) => {
    e.preventDefault();
    if (newAnnouncement.trim()) {
      onAddAnnouncement(newAnnouncement);
      setNewAnnouncement('');
    }
  };

  // Bulk Operations
  const handleSelectAll = () => {
    if (selectedReports.size === filteredReports.length) {
      setSelectedReports(new Set());
    } else {
      setSelectedReports(new Set(filteredReports.map(r => r.id)));
    }
  };

  const handleSelectReport = (id: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedReports(newSelected);
  };

  const handleBulkStatusUpdate = async () => {
    if (selectedReports.size === 0) return;

    try {
      await adminAPI.bulkUpdateStatus(Array.from(selectedReports), bulkStatus);
      // The parent component will reload data via API
      setSelectedReports(new Set());
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Bulk status update failed:', error);
      alert(error.message || 'Failed to update selected reports');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedReports.size === 0) return;

    if (!window.confirm(`Are you sure you want to delete ${selectedReports.size} selected reports?`)) return;

    try {
      await adminAPI.bulkDelete(Array.from(selectedReports));
      // The parent component will reload data via API
      setSelectedReports(new Set());
      if (onRefresh) onRefresh();
    } catch (error: any) {
      console.error('Bulk delete failed:', error);
      alert(error.message || 'Failed to delete selected reports');
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500 pb-20">
      
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard title="Total Reports" value={total} icon={AlertOctagon} color="text-slate-600" bg="bg-slate-50" />
        <StatCard title="Pending Review" value={pending} icon={Clock} color="text-yellow-600" bg="bg-yellow-50" />
        <StatCard title="Resolved" value={resolved} icon={CheckCircle} color="text-green-600" bg="bg-green-50" />
        <StatCard title="High Risk" value={highSeverity} icon={AlertOctagon} color="text-red-600" bg="bg-red-50" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
          {/* Main Content Column */}
          <div className="lg:col-span-2 space-y-6">
              {/* Charts Area */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="rf-glass-strong rounded-[28px] p-6">
                  <h3 className="text-sm font-semibold text-slate-800 mb-6">Severity Distribution</h3>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={severityData}>
                        <XAxis dataKey="name" fontSize={12} stroke="#64748b" tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{fill: '#f1f5f9'}}
                          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                        />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {severityData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="rf-glass-strong flex flex-col items-center justify-center rounded-[28px] p-6">
                    <h3 className="text-sm font-semibold text-slate-800 w-full mb-2">Completion Rate</h3>
                    <div className="h-40 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={[
                                        { name: 'Resolved', value: resolved },
                                        { name: 'Open', value: total - resolved }
                                    ]}
                                    innerRadius={45}
                                    outerRadius={65}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    <Cell fill="#22c55e" />
                                    <Cell fill="#cbd5e1" />
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                            <span className="text-2xl font-bold text-slate-800">{Math.round((resolved/total)*100) || 0}%</span>
                        </div>
                    </div>
                </div>
              </div>

              {/* Reports Table */}
              <div className="rf-glass-strong overflow-hidden rounded-[28px]">
                <div className="flex items-center justify-between border-b border-slate-100 p-6">
                  <h3 className="font-semibold text-slate-800">Recent Grievances</h3>
                  <div className="flex items-center gap-4">
                    <Filter className="w-4 h-4 text-slate-400" />
                    <select 
                      value={filter}
                      onChange={(e) => setFilter(e.target.value as any)}
                      className="cursor-pointer border-none bg-transparent text-sm text-slate-600 outline-none transition-colors hover:text-slate-900"
                      aria-label="Filter reports"
                    >
                      <option value="ALL">All Reports</option>
                      <option value={ReportStatus.PENDING}>Pending</option>
                      <option value={ReportStatus.RESOLVED}>Resolved</option>
                    </select>
                  </div>
                </div>

                {/* Bulk Actions */}
                {selectedReports.size > 0 && (
                  <div className="flex items-center justify-between border-b border-blue-100 bg-teal-50/80 p-4">
                    <span className="text-sm text-blue-700 font-medium">
                      {selectedReports.size} report{selectedReports.size > 1 ? 's' : ''} selected
                    </span>
                    <div className="flex items-center gap-3">
                      <select
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus(e.target.value as ReportStatus)}
                        className="rounded-xl border border-blue-200 bg-white px-3 py-2 text-sm"
                        aria-label="Bulk status update"
                      >
                        <option value={ReportStatus.VERIFIED}>Mark as Verified</option>
                        <option value={ReportStatus.IN_PROGRESS}>In Progress</option>
                        <option value={ReportStatus.RESOLVED}>Mark as Resolved</option>
                      </select>
                      <button
                        onClick={handleBulkStatusUpdate}
                        className="rounded-xl bg-[color:var(--rf-brand)] px-3 py-2 text-sm text-white transition-colors hover:bg-teal-700"
                      >
                        Update Status
                      </button>
                      <button
                        onClick={handleBulkDelete}
                        className="rounded-xl bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                      >
                        Delete Selected
                      </button>
                    </div>
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 text-slate-500 font-medium">
                      <tr>
                        <th className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedReports.size === filteredReports.length && filteredReports.length > 0}
                            onChange={handleSelectAll}
                            className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            aria-label="Select all reports"
                          />
                        </th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Severity</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReports.map((report) => (
                        <tr key={report.id} className="hover:bg-slate-50 transition-colors group">
                          <td className="px-6 py-4">
                            <input
                              type="checkbox"
                              checked={selectedReports.has(report.id)}
                              onChange={() => handleSelectReport(report.id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              aria-label="Select report"
                            />
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_COLORS[report.status]}`}>
                              {report.status}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`font-medium ${
                                report.severity === 'Critical' ? 'text-red-600' : 
                                report.severity === 'High' ? 'text-orange-600' : 'text-slate-600'
                            }`}>
                              {report.severity}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                            {normalizeLocation(report.location).address}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              {(report.status === ReportStatus.PENDING || report.status === ReportStatus.VERIFIED) && (
                                <>
                                  <button 
                                      onClick={() => onUpdateStatus(report.id, ReportStatus.IN_PROGRESS)}
                                      className="p-2 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded-lg transition-colors border border-transparent hover:border-blue-200"
                                      title="Mark as In Progress (Assigned)"
                                  >
                                      Assign Task
                                  </button>
                                  <button 
                                      onClick={() => setResolvingId(report.id)}
                                      className="p-2 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-lg transition-colors border border-transparent hover:border-green-200"
                                      title="Mark as Resolved (Upload Proof)"
                                  >
                                      Resolve
                                  </button>
                                </>
                              )}
                              {report.status === ReportStatus.IN_PROGRESS && (
                                <button 
                                    onClick={() => setResolvingId(report.id)}
                                    className="p-2 hover:bg-green-50 text-slate-400 hover:text-green-600 rounded-lg transition-colors border border-transparent hover:border-green-200"
                                    title="Mark as Resolved (Upload Proof)"
                                >
                                    Resolve
                                </button>
                              )}
                              <button 
                                  onClick={() => setRejectingId(report.id)}
                                  className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors border border-transparent hover:border-red-200"
                                  title="Dismantle / Reject Report"
                              >
                                  <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
          </div>

          {/* Sidebar Column (Announcements) */}
          <div className="space-y-6">
              <div className="overflow-hidden rounded-[30px] bg-[linear-gradient(145deg,#171717,#135d66_65%,#ef8354)] p-6 text-white shadow-[0_30px_80px_-40px_rgba(19,93,102,0.85)]">
                  <div className="flex items-center gap-2 mb-4">
                      <Megaphone className="w-5 h-5 text-yellow-400" />
                      <h3 className="font-bold text-lg">Broadcast Update</h3>
                  </div>
                  <p className="text-slate-300 text-sm mb-4">Post official announcements visible to all users on the community feed.</p>
                  
                  <form onSubmit={handlePostAnnouncement} className="space-y-3">
                      <textarea 
                          value={newAnnouncement}
                          onChange={(e) => setNewAnnouncement(e.target.value)}
                          placeholder="Type announcement here..."
                          className="h-32 w-full resize-none rounded-2xl border border-white/10 bg-white/10 p-3 text-sm text-white placeholder:text-white/45 outline-none focus:ring-2 focus:ring-orange-200"
                      />
                      <button 
                          type="submit"
                          disabled={!newAnnouncement.trim()}
                          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition-colors hover:bg-orange-50 disabled:bg-white/20 disabled:text-white/40"
                      >
                          <Send className="w-4 h-4" />
                          Publish
                      </button>
                  </form>
              </div>

              <div className="rf-glass-strong rounded-[28px] p-6">
                  <h3 className="font-semibold text-slate-800 mb-4 text-sm">Active Announcements</h3>
                  <div className="space-y-4">
                      {announcements.length === 0 ? (
                          <p className="text-sm text-slate-400 italic">No active announcements</p>
                      ) : (
                          announcements.map((ann) => (
                              <div key={ann.id} className="group relative rounded-2xl border border-white/70 bg-white/70 p-3">
                                  <p className="text-sm text-slate-700">{ann.message}</p>
                                  <span className="text-xs text-slate-400 mt-2 block">
                                      {new Date(ann.date).toLocaleDateString()}
                                  </span>
                              </div>
                          ))
                      )}
                  </div>
              </div>
          </div>
      </div>

      {/* RESOLVE MODAL */}
      {resolvingId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="rf-glass-strong w-full max-w-md overflow-hidden rounded-[30px]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-white/70 p-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle className="text-green-500 w-6 h-6" /> Upload Proof of Repair
              </h2>
            </div>
            
            <form onSubmit={handleResolveSubmit} className="p-6 space-y-6">
              <div>
                <p className="text-sm text-slate-600 mb-4">Upload an after-repair proof photo. The citizen will be notified that the report was resolved with proof attached.</p>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => setResolveImage(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 transition-colors"
                />
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/70 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-800">Proof Requirement</p>
                  <p className="mt-2 text-sm text-emerald-900/80">
                    Use a normal post-repair photo of the same road area.
                  </p>
                  {resolveImage && (
                    <p className="mt-3 text-sm font-semibold text-emerald-800">
                      Selected: {resolveImage.name}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setResolvingId(null)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors shadow-sm shadow-green-600/20"
                >
                  Resolve With Proof
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REJECT MODAL */}
      {rejectingId && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="rf-glass-strong w-full max-w-md overflow-hidden rounded-[30px]">
            <div className="flex items-center justify-between border-b border-slate-100 bg-red-50/80 p-6">
              <h2 className="text-xl font-bold text-red-700 flex items-center gap-2">
                <AlertOctagon className="w-6 h-6" /> Dismantle Report
              </h2>
            </div>
            
            <form onSubmit={handleRejectSubmit} className="p-6 space-y-6">
              <div>
                <p className="text-sm text-slate-600 mb-4">This will permanently delete the report and send a mandatory rejection notification to the citizen.</p>
                <textarea 
                  value={rejectReason}
                  onChange={e => setRejectReason(e.target.value)}
                  placeholder="Reason (e.g., Duplicate, False Report, Out of Jurisdiction)"
                  className="min-h-[100px] w-full rounded-2xl border border-slate-300 p-3 text-sm shadow-sm focus:border-red-500 focus:ring-2 focus:ring-red-500"
                  required
                />
              </div>

              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100">
                <button 
                  type="button" 
                  onClick={() => setRejectingId(null)}
                  className="px-5 py-2.5 text-slate-600 hover:bg-slate-100 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={!rejectReason.trim()}
                  className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm shadow-red-600/20"
                >
                  Dismantle
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color, bg }: any) => (
  <div className="rf-glass-strong rounded-[26px] p-6">
    <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-2xl ${bg}`}>
      <Icon className={`w-5 h-5 ${color}`} />
    </div>
    <p className="text-sm text-slate-500 font-medium">{title}</p>
    <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
  </div>
);
