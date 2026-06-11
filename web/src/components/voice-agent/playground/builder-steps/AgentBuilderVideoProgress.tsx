import React from "react";
import { Loader2, CheckCircle2, Circle, AlertCircle, Video, Download, ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProgressBlock {
  label: string;
  value: string; // "pending" | "generating prompt" | "generating video" | "analyzing visual flow" | "completed" | "failed"
}

export function AgentBuilderVideoProgress({
  title = "Generating Video Ad...",
  description = "Sequential generation loop is running.",
  blocks = [],
  onClose,
  phase,
  videoUrl,
  status = "active",
  onNext,
}: {
  title?: string;
  description?: string;
  blocks?: ProgressBlock[];
  onClose?: () => void;
  phase?: string;
  videoUrl?: string;
  status?: "active" | "completed" | "cancelled" | "failed";
  onNext?: (val?: string) => void;
}) {
  const getWeight = (val: string) => {
    switch (val) {
      case "completed": return 1.0;
      case "analyzing visual flow": return 0.8;
      case "generating video": return 0.5;
      case "generating prompt": return 0.2;
      default: return 0.0;
    }
  };
  
  const total = blocks.length || 4;
  const totalWeight = blocks.reduce((acc, b) => acc + getWeight(b.value), 0);
  const allCompleted = blocks.length > 0 && blocks.every((b) => b.value === "completed");
  const progressPercent = allCompleted ? 100 : Math.min(99, Math.round((totalWeight / total) * 100));

  const handleDownload = async () => {
    if (!videoUrl) return;
    try {
      const response = await fetch(videoUrl);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = "video-ad-segment.mp4";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.warn("Direct download failed, opening in tab:", err);
      const a = document.createElement("a");
      a.href = videoUrl;
      a.target = "_blank";
      a.click();
    }
  };

  // Helper to get status color and icon
  const getStatusDetails = (statusVal: string) => {
    switch (statusVal) {
      case "completed":
        return {
          icon: <CheckCircle2 className="size-5 text-emerald-500 shrink-0" />,
          statusText: "Completed",
          colorClass: "text-emerald-600 bg-emerald-50 border-emerald-100",
        };
      case "generating prompt":
        return {
          icon: <Loader2 className="size-5 text-blue-500 animate-spin shrink-0" />,
          statusText: "Drafting prompt...",
          colorClass: "text-blue-600 bg-blue-50 border-blue-100 animate-pulse",
        };
      case "generating video":
        return {
          icon: <Loader2 className="size-5 text-blue-600 animate-spin shrink-0" />,
          statusText: "Generating video segment...",
          colorClass: "text-blue-700 bg-blue-50/80 border-blue-200 animate-pulse",
        };
      case "analyzing visual flow":
        return {
          icon: <Loader2 className="size-5 text-amber-500 animate-spin shrink-0" />,
          statusText: "Analyzing flow continuity...",
          colorClass: "text-amber-700 bg-amber-50/50 border-amber-100 animate-pulse",
        };
      case "failed":
        return {
          icon: <AlertCircle className="size-5 text-red-500 shrink-0" />,
          statusText: "Failed",
          colorClass: "text-red-700 bg-red-50 border-red-100",
        };
      case "pending":
      default:
        return {
          icon: <Circle className="size-5 text-slate-300 shrink-0" />,
          statusText: "Pending",
          colorClass: "text-slate-400 bg-slate-50/50 border-slate-100",
        };
    }
  };

  return (
    <div className="relative flex flex-col items-center w-[460px] max-w-full h-[620px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 outline-none">
      {/* Header */}
      <div className="w-full flex shrink-0 items-center justify-between p-4 border-b border-slate-100 bg-white/80 z-10">
        <div className="flex items-center gap-2 pl-4">
          <Video className={cn("size-4 text-[#0b1957]", status === "active" && "animate-pulse")} />
          <span className="text-[11px] font-bold text-[#0b1957] uppercase tracking-wider">
            {phase || "Production Pipeline"}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 min-h-0 w-full flex flex-col pt-6 px-6 overflow-y-auto scrollbar-none">
        <h2 className="text-xl font-bold text-[#0b1957] text-center leading-snug mb-2">
          {title}
        </h2>
        <p className="text-xs text-slate-500 text-center mb-6 font-medium max-w-[320px] mx-auto leading-relaxed">
          {description}
        </p>

        {/* Real-time Video Player Preview */}
        {videoUrl && (
          <div className="w-full flex flex-col items-center mb-6 shrink-0">
            <div className="w-full max-w-[340px] rounded-2xl overflow-hidden border border-slate-200 shadow-lg bg-slate-950 aspect-video relative group">
              <video
                src={videoUrl}
                controls
                autoPlay
                loop
                className="w-full h-full object-contain"
              />
            </div>
            {status === "active" && (
              <button
                onClick={handleDownload}
                className="mt-2 text-[10px] font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 transition-colors active:scale-95 cursor-pointer"
              >
                <Download className="size-3" />
                Download Current Video
              </button>
            )}
          </div>
        )}

        {/* Dynamic Progress Bar (Only show when active) */}
        {status === "active" && (
          <div className="w-full flex items-center justify-between gap-4 mb-6 shrink-0">
            <div className="flex-1 bg-slate-100 h-2.5 rounded-full overflow-hidden relative shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <span className="text-xs font-bold text-[#0b1957] min-w-[32px] text-right shrink-0">
              {progressPercent}%
            </span>
          </div>
        )}

        {/* Segments Progress List */}
        <div className="flex-1 w-full space-y-3 pb-8">
          {blocks.map((block, idx) => {
            const { icon, statusText, colorClass } = getStatusDetails(block.value);
            return (
              <div
                key={idx}
                className={cn(
                  "flex items-center justify-between p-3.5 border rounded-2xl transition-all shadow-sm",
                  colorClass
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {icon}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-700 truncate">
                      {block.label}
                    </div>
                    <div className="text-[10px] font-medium opacity-85 mt-0.5">
                      {statusText}
                    </div>
                  </div>
                </div>
                <div className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-white/60 border border-slate-100 rounded-full shrink-0">
                  Step {idx + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Footer / Action Controls */}
      <div className="w-full border-t border-slate-100 bg-slate-50/80 p-4 flex flex-col items-center justify-center gap-2 shrink-0 z-20">
        {status === "active" ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <Loader2 className="size-3 text-slate-500 animate-spin" />
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest animate-pulse">
                Processing Generation Loop...
              </span>
            </div>
            <button
              onClick={() => onNext?.("[CANCEL_VIDEO_GEN]")}
              className="w-full max-w-[280px] py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 font-bold text-[11px] rounded-xl transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
            >
              Stop & Keep Video
            </button>
          </>
        ) : (
          <div className="w-full flex items-center justify-center gap-2 px-2">
            <button
              onClick={() => onNext?.("[SHOW_GALLERY]")}
              className="flex-1 py-2.5 border border-slate-200 hover:bg-slate-50 text-[#0b1957] font-bold text-[11px] rounded-xl transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
            >
              <ArrowLeft className="size-3.5" />
              Back to Gallery
            </button>
            {status !== "completed" && (
              <button
                onClick={() => onNext?.("Back to script approval")}
                className="flex-1 py-2.5 border border-blue-200 hover:bg-blue-50/50 text-blue-700 bg-blue-50/25 font-bold text-[11px] rounded-xl transition-all active:scale-95 cursor-pointer text-center flex items-center justify-center gap-1 shadow-sm"
              >
                Back to Script
              </button>
            )}
            {videoUrl && (
              <button
                onClick={handleDownload}
                className="flex-1 py-2.5 bg-gradient-to-br from-[#0b1957] to-[#1e293b] hover:from-[#0b1957] hover:to-[#0b1957] text-white font-bold text-[11px] rounded-xl transition-all active:scale-95 shadow-md hover:shadow-lg cursor-pointer text-center flex items-center justify-center gap-1"
              >
                <Download className="size-3.5" />
                Download Video
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
