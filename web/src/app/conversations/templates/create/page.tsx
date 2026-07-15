'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function CreateTemplatePage() {
  const router = useRouter();
  const [selected, setSelected] = useState<'manual' | 'ai' | null>(null);

  const handleManualCreate = () => {
    router.push('/conversations/templates/create/manual');
  };

  const handleAIGenerate = () => {
    router.push('/conversations/templates/create/ai');
  };

  return (
    <div className="min-h-screen bg-[#F8F9FE] dark:bg-[#000724]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-8 py-6 dark:bg-[#000724] dark:border-slate-800/60">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="text-gray-600 hover:text-gray-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer"
          >
            ← Back
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Create Email Template</h1>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-8 py-12">
        <p className="text-gray-600 dark:text-slate-300 mb-8">Choose how you&apos;d like to create your email template:</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Manual Editor Option */}
          <button
            onClick={() => {
              setSelected('manual');
              setTimeout(handleManualCreate, 200);
            }}
            className={`p-8 rounded-lg border-2 transition-all text-left ${
              selected === 'manual'
                ? 'border-[#0b1957] bg-[#0b1957]/5 dark:border-[#3b52b3] dark:bg-[#3b52b3]/20'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-[#000c3b] dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">✍️</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Create Manually</h2>
                <p className="text-gray-600 dark:text-slate-300">Write and customize your email content directly. Perfect for when you already know exactly what you want to say.</p>
                <ul className="mt-4 space-y-1 text-sm text-gray-600 dark:text-slate-300">
                  <li>✓ Full control over content</li>
                  <li>✓ Use dynamic placeholders</li>
                  <li>✓ Quick and straightforward</li>
                </ul>
              </div>
            </div>
          </button>

          {/* AI Generation Option */}
          <button
            onClick={() => {
              setSelected('ai');
              setTimeout(handleAIGenerate, 200);
            }}
            className={`p-8 rounded-lg border-2 transition-all text-left ${
              selected === 'ai'
                ? 'border-[#0b1957] bg-[#0b1957]/5 dark:border-[#3b52b3] dark:bg-[#3b52b3]/20'
                : 'border-gray-200 bg-white hover:border-gray-300 dark:border-gray-800 dark:bg-[#000c3b] dark:hover:border-gray-700'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="text-3xl">✨</div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Generate with AI</h2>
                <p className="text-gray-600 dark:text-slate-300">Answer a few questions about your campaign and let AI generate professional email content for you.</p>
                <ul className="mt-4 space-y-1 text-sm text-gray-600 dark:text-slate-300">
                  <li>✓ AI-powered content generation</li>
                  <li>✓ Based on your campaign details</li>
                  <li>✓ Edit and refine as needed</li>
                </ul>
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
