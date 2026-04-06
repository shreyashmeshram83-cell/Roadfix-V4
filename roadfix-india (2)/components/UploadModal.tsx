import React, { useState, useRef, useEffect } from 'react';
import { X, Camera, Loader2, MapPin, LocateFixed } from 'lucide-react';
import { complaintsAPI } from '../services/apiService';
import { PotholeReport, LocationData, Severity } from '../types';
import { DEFAULT_LOCATION } from '../utils/location';

interface AnalysisResult {
    isPothole: boolean;
    severity: Severity;
    description: string;
    estimatedRepairCost?: string;
    rejectionReason?: string;
}

const normalizeSeverity = (severity: string): Severity => {
  const normalized = severity.toLowerCase();
  if (normalized === 'critical') return Severity.CRITICAL;
  if (normalized === 'high') return Severity.HIGH;
  if (normalized === 'medium') return Severity.MEDIUM;
  return Severity.LOW;
};

interface UploadModalProps {
  onClose: () => void;
  onSubmit: (report: Omit<PotholeReport, 'id' | 'createdAt' | 'upvotes' | 'status' | 'user'>, file: File) => void;
  existingReports: PotholeReport[];
}

export const UploadModal: React.FC<UploadModalProps> = ({ onClose, onSubmit, existingReports }) => {
  const fallbackAnalysis: AnalysisResult = {
    isPothole: false,
    severity: Severity.LOW,
    description: "Image could not be verified as road damage.",
    estimatedRepairCost: "N/A",
    rejectionReason: "Upload a clear road photo showing the pothole."
  };

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1); // 1: Select, 2: Analyze, 3: Confirm, 4: Duplicate
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState<LocationData>({
    ...DEFAULT_LOCATION,
    address: 'Detecting your location...'
  });
  const [analysisWarning, setAnalysisWarning] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const requestBrowserLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const latitude = Number(position.coords.latitude.toFixed(6));
          const longitude = Number(position.coords.longitude.toFixed(6));

          setLocation({
            latitude,
            longitude,
            address: `${latitude}, ${longitude}`
          });
        },
        () => {
          setLocation({
            ...DEFAULT_LOCATION,
            address: 'Location access denied. Enter the address manually.'
          });
        }
      );
    } else {
      setLocation({
        ...DEFAULT_LOCATION,
        address: 'Geolocation not supported. Enter the address manually.'
      });
    }
  };

  useEffect(() => {
    requestBrowserLocation();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        
        // Check for duplicate images
        const isDuplicate = existingReports.some(report => report.imageUrl === result);
        if (isDuplicate) {
          setImagePreview(result);
          setStep(4); // Duplicate found
          return;
        }
        
        setImagePreview(result);
        setImageFile(file);
        setStep(2);
        runAnalysis(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const runAnalysis = async (base64: string) => {
    setIsAnalyzing(true);
    setAnalysisWarning('');
    // Strip prefix for API
    const base64Data = base64.split(',')[1];
    try {
      const result = await complaintsAPI.analyzePotholeImage(base64Data);
      const normalizedResult: AnalysisResult = {
        ...result,
        severity: normalizeSeverity(result.severity)
      };
      setAnalysis(normalizedResult);
      if (normalizedResult.description) setDescription(normalizedResult.description);
    } catch (error) {
       console.error("AI Analysis failed", error);
       setAnalysis(fallbackAnalysis);
       setDescription(fallbackAnalysis.description);
       setAnalysisWarning('AI verification failed. Please upload a clearer pothole photo.');
    }
    setIsAnalyzing(false);
    setStep(3);
  };

  const handleSubmit = () => {
    if (!imagePreview || !imageFile || !analysis) return;
    if (!analysis.isPothole) {
      alert(analysis.rejectionReason || 'Cannot submit - the uploaded image is not a valid pothole report.');
      return;
    }

    if (!Number.isFinite(location.latitude) || !Number.isFinite(location.longitude)) {
      alert('Please enter a valid latitude and longitude.');
      return;
    }
    if (!location.address?.trim()) {
      alert('Please enter the issue location or landmark.');
      return;
    }
    if (!title.trim()) {
      alert('Please enter a title for this report.');
      return;
    }

    onSubmit({
      title: title.trim(),
      imageUrl: imagePreview,
      images: [imagePreview],
      location,
      coordinates: {
        latitude: location.latitude,
        longitude: location.longitude
      },
      severity: analysis.severity,
      description: description,
      category: 'pothole',
      aiAnalysis: {
        isPothole: analysis.isPothole,
        severity: analysis.severity,
        estimatedCost: analysis.estimatedRepairCost || 'N/A',
        confidence: 0.95,
        analyzedAt: new Date().toISOString(),
        rejectionReason: analysis.rejectionReason || ''
      }
    }, imageFile);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="rf-glass-strong flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-[32px]">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-white/70 px-6 py-4">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-800">Report Issue</h2>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Photo to action flow</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 transition-colors hover:bg-slate-100" aria-label="Close">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 && (
            <div className="flex h-64 cursor-pointer flex-col items-center justify-center rounded-[28px] border-2 border-dashed border-slate-300 bg-[linear-gradient(180deg,rgba(19,93,102,0.07),rgba(239,131,84,0.08))] transition-colors hover:bg-slate-100/80"
                 onClick={() => fileInputRef.current?.click()}>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*"
                onChange={handleFileChange}
                aria-label="Upload image"
              />
              <div className="mb-4 rounded-full bg-white p-4 shadow-sm">
                 <Camera className="h-8 w-8 text-[color:var(--rf-brand)]" />
              </div>
              <p className="text-sm font-medium text-slate-700">Click to upload photo</p>
              <p className="mt-1 text-xs text-slate-500">Supports JPG, PNG</p>
            </div>
          )}

          {(step === 2 || step === 3) && imagePreview && (
            <div className="space-y-6">
              <div className="relative rounded-xl overflow-hidden bg-slate-100 aspect-video shadow-inner">
                <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                {isAnalyzing && (
                  <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center backdrop-blur-[2px]">
                    <Loader2 className="w-10 h-10 text-white animate-spin mb-2" />
                    <p className="text-white font-medium text-sm animate-pulse">AI Analyzing Pothole...</p>
                  </div>
                )}
              </div>

              {!isAnalyzing && analysis && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                  {analysisWarning && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                      {analysisWarning}
                    </div>
                  )}
                  {/* AI Badge */}
                  <div className="flex flex-wrap gap-2">
                     <span className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider ${
                        analysis.isPothole ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                     }`}>
                        {analysis.isPothole ? 'Confirmed Pothole' : 'AI Unsure / Not Pothole'}
                     </span>
                     <span className="px-3 py-1.5 rounded-md text-xs font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                        Severity: {analysis.severity}
                     </span>
                     <button 
                        onClick={() => setStep(1)}
                        className="rounded-xl bg-teal-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-[color:var(--rf-brand)] transition-colors hover:bg-teal-100"
                     >
                        Change Photo
                     </button>
                  </div>

                  {!analysis.isPothole && (
                    <p className="text-red-600 font-medium">
                      {analysis.rejectionReason || 'The AI did not identify valid road damage in this image.'}
                    </p>
                  )}

                  {/* Location (Mock) */}
                  <div className="space-y-3 rounded-[22px] border border-slate-100 bg-white/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-slate-500 text-sm min-w-0">
                        <MapPin className="w-4 h-4 text-blue-500 shrink-0" />
                        <span className="truncate">{location.address}</span>
                      </div>
                      <button
                        type="button"
                        onClick={requestBrowserLocation}
                        className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-[color:var(--rf-brand)] hover:text-teal-700"
                      >
                        <LocateFixed className="w-3.5 h-3.5" />
                        Refresh
                      </button>
                    </div>
                    <input
                      type="text"
                      value={location.address || ''}
                      onChange={(e) => setLocation((prev) => ({ ...prev, address: e.target.value }))}
                      className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-[color:var(--rf-brand)] focus:ring-2 focus:ring-teal-100"
                      placeholder="Street, landmark, or area"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="number"
                        step="any"
                        value={location.latitude}
                        onChange={(e) => setLocation((prev) => ({ ...prev, latitude: Number(e.target.value) }))}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                        placeholder="Latitude"
                        aria-label="Latitude"
                      />
                      <input
                        type="number"
                        step="any"
                        value={location.longitude}
                        onChange={(e) => setLocation((prev) => ({ ...prev, longitude: Number(e.target.value) }))}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                        placeholder="Longitude"
                        aria-label="Longitude"
                      />
                    </div>
                  </div>

                  {/* Title Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm bg-white"
                      placeholder="Give this issue a short title"
                      maxLength={200}
                    />
                  </div>

                  {/* Description Input */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Description</label>
                    <textarea 
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="w-full p-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm min-h-[100px]"
                        placeholder="Describe the issue..."
                    />
                  </div>
                  
                   {analysis.estimatedRepairCost && (
                      <div className="text-xs text-slate-500">
                          Estimated Repair Cost: <span className="font-semibold text-slate-700">{analysis.estimatedRepairCost}</span>
                      </div>
                   )}
                </div>
              )}
            </div>
          )}

          {step === 4 && imagePreview && (
            <div className="flex flex-col items-center justify-center h-64 space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-slate-100 aspect-video shadow-inner max-w-sm">
                <img src={imagePreview} alt="Duplicate" className="w-full h-full object-cover opacity-50" />
                <div className="absolute inset-0 bg-red-500/20 flex items-center justify-center">
                  <div className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold text-sm">
                    DUPLICATE DETECTED
                  </div>
                </div>
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-lg font-bold text-slate-900">Complaint Already Reported</h3>
                <p className="text-slate-600">This image has already been uploaded. Please try a different photo.</p>
              </div>
              <button 
                onClick={() => {
                  setImagePreview(null);
                  setImageFile(null);
                  setStep(1);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
              >
                Upload Different Photo
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-100 bg-white">
          {step === 3 ? (
             <button 
                onClick={handleSubmit}
                disabled={analysis ? !analysis.isPothole : false}
                className={`w-full py-3 rounded-lg font-semibold transition-all active:scale-[0.98] ${analysis && !analysis.isPothole ? 'bg-gray-400 cursor-not-allowed' : 'bg-slate-900 hover:bg-slate-800 text-white'}`}
             >
                Submit Report
             </button>
          ) : step === 1 ? (
             <button onClick={onClose} className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50">
                Cancel
             </button>
          ) : step === 4 ? (
             <button onClick={onClose} className="w-full bg-white border border-slate-200 text-slate-700 py-3 rounded-lg font-medium hover:bg-slate-50">
                Close
             </button>
          ) : null}
        </div>
      </div>
    </div>
  );
};
