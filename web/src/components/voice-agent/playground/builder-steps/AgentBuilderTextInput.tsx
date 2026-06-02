import React from "react";
import { BuilderBottomInput } from "./BuilderBottomInput";
import { X, Sparkles } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function AgentBuilderTextInput({
  question = "Enter your business's name.",
  description = "",
  showSkip = true,
  onClose,
  onNext,
  phase,
}: {
  question?: string;
  description?: string;
  showSkip?: boolean;
  onClose?: () => void;
  onNext?: (val?: string, action?: string) => void;
  phase?: string;
}) {
  return (
    <div className="relative flex flex-col items-center w-full max-w-md h-[550px] bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-300 outline-none focus:outline-none focus:ring-0">
      
      <div className="w-full flex shrink-0 items-center justify-between p-4 border-b border-slate-100 bg-white/80 z-10">
         <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-emerald-500" />
            <span className="text-[11px] font-bold text-[#0b1957] uppercase tracking-wider">
               {phase || "Builder / Step"}
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

      <div className="flex-1 flex flex-col justify-center px-8 w-full pb-10">
         <h2 className="text-xl md:text-2xl font-bold text-[#0b1957] text-center leading-snug">
            {question}
         </h2>
         {description && (
           <div className="mt-4 text-xs md:text-sm text-slate-500 text-center leading-relaxed font-medium">
             <ReactMarkdown
               components={{
                 strong: ({ node, ref, ...props }) => <strong className="font-bold" {...props} />,
                 p: ({ node, ref, ...props }) => <p className="leading-relaxed" {...props} />,
                 ul: ({ node, ref, ...props }) => <ul className="list-disc pl-4 space-y-1 text-left my-2" {...props} />,
                 ol: ({ node, ref, ...props }) => <ol className="list-decimal pl-4 space-y-1 text-left my-2" {...props} />,
                 li: ({ node, ref, ...props }) => <li className="text-slate-500 font-medium" {...props} />,
               }}
             >
               {description}
             </ReactMarkdown>
           </div>
         )}
      </div>

      <div className="w-full flex flex-col mt-auto pb-4 pt-2 bg-gradient-to-t from-white via-white to-transparent relative z-20">
         {showSkip && (
            <div className="w-full flex justify-end px-6 -mb-1 z-10">
              <button 
                 type="button"
                 onClick={() => onNext?.("")}
                 className="px-4 py-1.5 rounded-full border border-slate-200 text-[10px] font-semibold text-slate-400 hover:bg-slate-50 hover:text-[#0b1957] transition-all uppercase tracking-wider cursor-pointer shadow-sm"
              >
                Skip
              </button>
            </div>
         )}
         <BuilderBottomInput onSend={(val) => onNext?.(val)} />
      </div>
    </div>
  );
}
