import React, { useState } from "react";
import { X, ArrowLeft, Play, Download, ExternalLink, Image as ImageIcon, Video, Trash2, Paperclip, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageGroup {
  generation_id: string;
  urls: string[];
  created_at: number;
}

interface VideoAsset {
  url: string;
  created_at: number;
}

interface SelectedAsset {
  url: string;
  type: "image" | "video";
}

export function AgentBuilderGallery({
  images = [],
  videos = [],
  onBack,
  onClose,
  onGenerateImages,
  onAnimateImage,
  onExtendVideo,
  onDeleteAssets,
}: {
  images?: ImageGroup[];
  videos?: VideoAsset[];
  onBack: () => void;
  onClose?: () => void;
  onGenerateImages?: (urls: string[]) => void;
  onAnimateImage?: (url: string) => void;
  onExtendVideo?: (url: string) => void;
  onDeleteAssets?: (urls: string[]) => void;
}) {
  const [selectedGroup, setSelectedGroup] = useState<ImageGroup | null>(null);
  const [activeVideo, setActiveVideo] = useState<string | null>(null);
  const [selectedAssets, setSelectedAssets] = useState<SelectedAsset[]>([]);
  const [activeImage, setActiveImage] = useState<{ url: string; urls: string[] } | null>(null);

  const formatTimestamp = (ts: number) => {
    if (!ts) return "Unknown Date";
    const date = new Date(ts * 1000);
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownload = async (url: string, name: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const toggleAssetSelection = (url: string, type: "image" | "video") => {
    setSelectedAssets((prev) => {
      const exists = prev.find((item) => item.url === url);
      if (exists) {
        return prev.filter((item) => item.url !== url);
      } else {
        return [...prev, { url, type }];
      }
    });
  };

  const isAssetSelected = (url: string) => {
    return selectedAssets.some((asset) => asset.url === url);
  };

  const getAssetTypeCount = (type: "image" | "video") => {
    return selectedAssets.filter((a) => a.type === type).length;
  };

  const hasSelected = selectedAssets.length > 0;
  const imageCount = getAssetTypeCount("image");
  const videoCount = getAssetTypeCount("video");

  // Constraints
  const showAnimate = selectedAssets.length === 1 && imageCount === 1;
  const showExtend = selectedAssets.length === 1 && videoCount === 1;
  const showAttach = selectedAssets.length >= 1 && selectedAssets.length <= 5 && videoCount === 0;
  const showDelete = selectedAssets.length > 0;

  const handleDeselect = () => {
    setSelectedAssets([]);
  };

  const handleAnimate = () => {
    if (onAnimateImage && showAnimate) {
      onAnimateImage(selectedAssets[0].url);
      setSelectedAssets([]);
    }
  };

  const handleExtend = () => {
    if (onExtendVideo && showExtend) {
      onExtendVideo(selectedAssets[0].url);
      setSelectedAssets([]);
    }
  };

  const handleAttach = () => {
    if (onGenerateImages && showAttach) {
      onGenerateImages(selectedAssets.map((a) => a.url));
      setSelectedAssets([]);
    }
  };

  const handleDelete = () => {
    if (onDeleteAssets && showDelete) {
      if (confirm(`Are you sure you want to delete the ${selectedAssets.length} selected asset(s)?`)) {
        onDeleteAssets(selectedAssets.map((a) => a.url));
        setSelectedAssets([]);
      }
    }
  };

  return (
    <div className="relative flex flex-col items-center w-[480px] max-w-full h-[620px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 outline-none">
      {/* ── HEADER (CONTEXTUAL OR STANDARD) ── */}
      {hasSelected ? (
        <div className="w-full flex shrink-0 items-center justify-between p-4 bg-slate-900 text-white z-20 animate-in slide-in-from-top duration-200">
          <div className="flex items-center gap-3">
            <button
              onClick={handleDeselect}
              className="p-1.5 hover:bg-slate-800 rounded-full text-slate-300 hover:text-white transition-colors active:scale-95"
            >
              <X className="size-4" />
            </button>
            <span className="text-xs font-bold uppercase tracking-wider">
              {selectedAssets.length} Selected
            </span>
          </div>

          <div className="flex items-center gap-1">
            {showAnimate && (
              <div className="relative group">
                <button
                  onClick={handleAnimate}
                  className="p-2 hover:bg-slate-800 rounded-xl text-emerald-400 hover:text-emerald-300 transition-colors active:scale-95 cursor-pointer"
                >
                  <Video className="size-4.5" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded-lg whitespace-nowrap z-[99] pointer-events-none shadow-lg border border-slate-700">
                  Animate Image
                </div>
              </div>
            )}

            {showExtend && (
              <div className="relative group">
                <button
                  onClick={handleExtend}
                  className="p-2 hover:bg-slate-800 rounded-xl text-blue-400 hover:text-blue-300 transition-colors active:scale-95 cursor-pointer"
                >
                  <Video className="size-4.5" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded-lg whitespace-nowrap z-[99] pointer-events-none shadow-lg border border-slate-700">
                  Extend Video
                </div>
              </div>
            )}

            {showAttach && (
              <div className="relative group">
                <button
                  onClick={handleAttach}
                  className="p-2 hover:bg-slate-800 rounded-xl text-yellow-400 hover:text-yellow-300 transition-colors active:scale-95 cursor-pointer"
                >
                  <Paperclip className="size-4.5" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded-lg whitespace-nowrap z-[99] pointer-events-none shadow-lg border border-slate-700">
                  Attach as Reference
                </div>
              </div>
            )}

            {showDelete && (
              <div className="relative group">
                <button
                  onClick={handleDelete}
                  className="p-2 hover:bg-slate-800 rounded-xl text-rose-500 hover:text-rose-400 transition-colors active:scale-95 cursor-pointer"
                >
                  <Trash2 className="size-4.5" />
                </button>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 hidden group-hover:block bg-slate-800 text-white text-[9px] font-bold py-1 px-2 rounded-lg whitespace-nowrap z-[99] pointer-events-none shadow-lg border border-slate-700">
                  Delete Selected
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full flex shrink-0 items-center justify-between p-4 border-b border-slate-100 bg-white/80 z-10">
          <div className="flex items-center gap-2 pl-2">
            <button
              onClick={onBack}
              className="p-1.5 hover:bg-slate-50 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-95"
              title="Back to Welcome"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="text-[11px] font-bold text-[#0b1957] uppercase tracking-wider">
              Asset Vault & Gallery
            </span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-all active:scale-95 border border-slate-100"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      )}

      {/* Main Content (Scrollable Container) */}
      <div className="flex-1 w-full min-h-0 overflow-y-auto px-6 py-4 space-y-6 scrollbar-none bg-slate-50/50">
        {images.length === 0 && videos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-center space-y-4">
            <div className="size-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
              <Sparkles className="size-8" />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-slate-700 text-sm">No assets found</h3>
              <p className="text-xs text-slate-400 max-w-[240px] leading-relaxed">
                Start generating image concepts or videos to see them listed in your asset vault.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* ── VIDEOS SECTION (TOP) ── */}
            {videos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-[#0b1957] uppercase tracking-wider flex items-center gap-1.5 pl-1">
                  <Video className="size-3.5 text-[#0b1957]" />
                  Videos ({videos.length})
                </h3>
                
                {/* Horizontal scroll container for video previews */}
                <div className="flex gap-3 overflow-x-auto pb-3 scrollbar-thin scrollbar-thumb-slate-200">
                  {videos.map((vid, idx) => {
                    const isSel = isAssetSelected(vid.url);
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleAssetSelection(vid.url, "video")}
                        className={cn(
                          "flex-shrink-0 w-[160px] aspect-video rounded-xl bg-slate-900 border overflow-hidden relative cursor-pointer group shadow-sm hover:shadow transition-all",
                          isSel ? "border-[#0b1957] ring-2 ring-[#0b1957]/20" : "border-slate-200 hover:border-[#0b1957]/30"
                        )}
                      >
                        <video
                          src={vid.url}
                          preload="metadata"
                          className="w-full h-full object-cover pointer-events-none"
                        />
                        {/* Play overlay */}
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveVideo(vid.url);
                          }}
                          className="absolute inset-0 bg-black/45 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity"
                        >
                          <div className="size-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30 group-hover:scale-110 transition-transform">
                            <Play className="size-4 text-white fill-current translate-x-0.5" />
                          </div>
                        </div>
                        {/* Selection check icon overlay */}
                        <div className={cn(
                          "absolute top-1.5 right-1.5 size-4 rounded-full border flex items-center justify-center transition-all z-25",
                          isSel ? "bg-[#0b1957] border-[#0b1957] text-white" : "bg-white/70 border-slate-300 backdrop-blur-sm opacity-0 group-hover:opacity-100"
                        )}>
                          {isSel && <Check className="size-2.5 stroke-[3]" />}
                        </div>
                        {/* Timestamp badge */}
                        <div className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/60 rounded text-[9px] text-white font-medium">
                          {formatTimestamp(vid.created_at)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── PHOTO GROUPS (BOTTOM) ── */}
            {images.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-[#0b1957] uppercase tracking-wider flex items-center gap-1.5 pl-1">
                  <ImageIcon className="size-3.5 text-[#0b1957]" />
                  Image Generations ({images.length})
                </h3>

                {/* Vertical list of image groups */}
                <div className="space-y-4">
                  {images.map((group) => (
                    <div
                      key={group.generation_id}
                      onClick={() => setSelectedGroup(group)}
                      className="p-3 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 hover:shadow-sm cursor-pointer transition-all space-y-2 group/card"
                    >
                      <div className="flex justify-between items-center px-1">
                        <span className="text-[10px] font-bold text-[#0b1957]/70 uppercase tracking-wider">
                          Group: {group.generation_id.slice(-6)}
                        </span>
                        <span className="text-[9px] text-slate-400 font-medium">
                          {formatTimestamp(group.created_at)}
                        </span>
                      </div>
                      
                      {/* Row of 4 thumbnails (arranged horizontally) */}
                      <div className="grid grid-cols-4 gap-2">
                        {group.urls.slice(0, 4).map((url, i) => {
                          const isSel = isAssetSelected(url);
                          return (
                            <div
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveImage({ url, urls: group.urls });
                              }}
                              className={cn(
                                "aspect-square rounded-lg overflow-hidden bg-slate-100 border relative group/thumb cursor-pointer transition-all",
                                isSel ? "border-[#0b1957] ring-2 ring-[#0b1957]/10" : "border-slate-150"
                              )}
                            >
                              <img
                                src={url}
                                alt={`Thumbnail ${i + 1}`}
                                className="w-full h-full object-cover group-hover/card:scale-102 transition-transform duration-300"
                                loading="lazy"
                              />
                              {/* Selection check icon overlay */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleAssetSelection(url, "image");
                                }}
                                className={cn(
                                  "absolute top-1 right-1 size-5 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer active:scale-95",
                                  isSel ? "bg-[#0b1957] border-[#0b1957] text-white animate-in zoom-in-50" : "bg-white/80 border-slate-300 backdrop-blur-sm opacity-100"
                                )}
                              >
                                {isSel && <Check className="size-2.5 stroke-[3]" />}
                              </div>
                            </div>
                          );
                        })}
                        {/* If less than 4 generated items exist in group */}
                        {Array.from({ length: Math.max(0, 4 - group.urls.length) }).map((_, idx) => (
                          <div
                            key={`empty-${idx}`}
                            className="aspect-square rounded-lg border border-dashed border-slate-200 bg-slate-50/50"
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── OVERLAYS / LIGHTBOX MODALS ── */}

      {/* Image Group Detailed Modal Overlay */}
      {selectedGroup && (
        <div className="absolute inset-0 bg-slate-950/80 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full rounded-2xl p-4 max-h-[90%] flex flex-col space-y-4 shadow-2xl relative animate-in zoom-in-95 duration-200">
            <button
              onClick={() => setSelectedGroup(null)}
              className="absolute top-3 right-3 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <div className="pr-8">
              <h4 className="font-bold text-sm text-[#0b1957]">
                Image Group Previews
              </h4>
              <p className="text-[10px] text-slate-400">
                Generated {formatTimestamp(selectedGroup.created_at)}
              </p>
            </div>

            {/* Grid of 4 images */}
            <div className="grid grid-cols-2 gap-3 flex-1 overflow-y-auto pr-1">
              {selectedGroup.urls.map((url, idx) => {
                const isSel = isAssetSelected(url);
                return (
                  <div
                    key={idx}
                    onClick={() => setActiveImage({ url, urls: selectedGroup.urls })}
                    className={cn(
                      "rounded-xl overflow-hidden bg-slate-50 border relative group aspect-square flex flex-col cursor-pointer transition-all",
                      isSel ? "border-[#0b1957] ring-2 ring-[#0b1957]/20" : "border-slate-200"
                    )}
                  >
                    <img
                      src={url}
                      alt={`Preview ${idx + 1}`}
                      className="w-full h-full object-cover flex-1"
                    />
                    {/* Action overlays on hover */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(url, "_blank");
                        }}
                        className="p-1 bg-white/20 hover:bg-white/30 text-white rounded transition-colors"
                        title="Open Original"
                      >
                        <ExternalLink className="size-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownload(url, `concept-${selectedGroup.generation_id.slice(-6)}-${idx + 1}.png`);
                        }}
                        className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded transition-colors"
                        title="Download Image"
                      >
                        <Download className="size-3.5" />
                      </button>
                    </div>
                    {/* Selection check icon overlay */}
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleAssetSelection(url, "image");
                      }}
                      className={cn(
                        "absolute top-2 right-2 size-5 rounded-full border flex items-center justify-center transition-all z-20 cursor-pointer active:scale-95",
                        isSel ? "bg-[#0b1957] border-[#0b1957] text-white animate-in zoom-in-50" : "bg-white/80 border-slate-300 backdrop-blur-sm opacity-100"
                      )}
                    >
                      {isSel && <Check className="size-3 stroke-[3]" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Video Modal Player Overlay */}
      {activeVideo && (
        <div className="absolute inset-0 bg-slate-950/90 z-50 flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="w-full max-w-[380px] bg-slate-900 rounded-2xl overflow-hidden shadow-2xl relative animate-in zoom-in-95 duration-200 border border-slate-800 flex flex-col">
            <button
              onClick={() => setActiveVideo(null)}
              className="absolute top-3 right-3 z-10 p-1.5 bg-black/40 hover:bg-black/60 rounded-full text-white/80 hover:text-white transition-colors"
            >
              <X className="size-4" />
            </button>
            
            <div className="aspect-video bg-black flex items-center justify-center relative">
              <video
                src={activeVideo}
                controls
                autoPlay
                className="w-full h-full object-contain"
              />
            </div>
            
            <div className="p-4 flex items-center justify-between bg-slate-950">
              <span className="text-[10px] text-slate-400 font-semibold">Video Playback</span>
              <div className="flex gap-2">
                {onExtendVideo && (
                  <button
                    onClick={() => {
                      onExtendVideo(activeVideo);
                      setActiveVideo(null);
                    }}
                    className="py-1.5 px-3 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Video className="size-3.5" />
                    Extend Video
                  </button>
                )}
                <button
                  onClick={() => handleDownload(activeVideo, "playground-video.mp4")}
                  className="py-1.5 px-3 bg-[#0b1957] hover:bg-blue-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Download className="size-3.5" />
                  Download Video
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Image Fullscreen Lightbox Modal */}
      {activeImage && (() => {
        const currentIdx = activeImage.urls.indexOf(activeImage.url);
        const isSel = isAssetSelected(activeImage.url);
        return (
          <div 
            className="absolute inset-0 bg-slate-950/95 z-55 flex flex-col items-center justify-between p-6 animate-in fade-in duration-200"
            onClick={() => setActiveImage(null)}
          >
            {/* Top bar */}
            <div className="w-full flex justify-between items-center z-20" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">
                Image Preview {currentIdx + 1} of {activeImage.urls.length}
              </span>
              <button
                onClick={() => setActiveImage(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-white/80 hover:text-white transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Center container with arrows & image */}
            <div className="relative flex-1 w-full flex items-center justify-center min-h-0" onClick={(e) => e.stopPropagation()}>
              {activeImage.urls.length > 1 && (
                <>
                  {/* Previous Button */}
                  <button
                    disabled={currentIdx <= 0}
                    onClick={() => {
                      if (currentIdx > 0) {
                        setActiveImage({ url: activeImage.urls[currentIdx - 1], urls: activeImage.urls });
                      }
                    }}
                    className="absolute left-2 z-30 p-2 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white rounded-full transition-all active:scale-95 cursor-pointer"
                  >
                    <ChevronLeft className="size-5" />
                  </button>

                  {/* Next Button */}
                  <button
                    disabled={currentIdx >= activeImage.urls.length - 1}
                    onClick={() => {
                      if (currentIdx < activeImage.urls.length - 1) {
                        setActiveImage({ url: activeImage.urls[currentIdx + 1], urls: activeImage.urls });
                      }
                    }}
                    className="absolute right-2 z-30 p-2 bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white rounded-full transition-all active:scale-95 cursor-pointer"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                </>
              )}

              <img
                src={activeImage.url}
                alt={`Expanded Preview ${currentIdx + 1}`}
                className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-2xl"
              />
            </div>

            {/* Bottom Footer Actions */}
            <div 
              className="w-full flex items-center justify-center gap-3 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-white/10 z-20 max-w-full overflow-x-auto select-none" 
              onClick={(e) => e.stopPropagation()}
            >
              {/* Select Toggle Button */}
              <button
                onClick={() => toggleAssetSelection(activeImage.url, "image")}
                className={cn(
                  "h-9 px-4 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95",
                  isSel 
                    ? "bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700" 
                    : "bg-white/10 hover:bg-white/20 text-white border border-white/10"
                )}
              >
                <Check className={cn("size-3.5", isSel ? "text-emerald-400 stroke-[3]" : "text-white/50")} />
                {isSel ? "Selected" : "Select"}
              </button>

              {/* Animate Concept Button (Camera icon) */}
              {onAnimateImage && (
                <button
                  onClick={() => {
                    onAnimateImage(activeImage.url);
                    setActiveImage(null);
                  }}
                  className="h-9 px-4 bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-500/30 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  title="Animate Concept"
                >
                  <Video className="size-3.5" />
                  Animate
                </button>
              )}

              {/* Attach as Reference Button */}
              {onGenerateImages && (
                <button
                  onClick={() => {
                    onGenerateImages([activeImage.url]);
                    setActiveImage(null);
                  }}
                  className="h-9 px-4 bg-amber-600 hover:bg-amber-500 text-white border border-amber-500/30 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95"
                  title="Attach as Reference"
                >
                  <Paperclip className="size-3.5" />
                  Attach
                </button>
              )}

              {/* Download Button */}
              <button
                onClick={() => handleDownload(activeImage.url, `concept-max-${currentIdx + 1}.png`)}
                className="h-9 px-4 bg-[#0b1957] hover:bg-blue-800 text-white border border-blue-900/50 flex items-center justify-center gap-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95"
              >
                <Download className="size-3.5" />
                Download
              </button>
            </div>
          </div>
        )}
      )()}
    </div>
  );
}
