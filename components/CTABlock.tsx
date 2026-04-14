'use client';

import { LeadStage } from '@/lib/types';
import { CTA_COPY } from '@/lib/salesPrompt';

interface CTABlockProps {
  stage: LeadStage;
  onCtaClick: (action: string) => void;
}

export default function CTABlock({ stage, onCtaClick }: CTABlockProps) {
  if (stage !== 'hot') return null;

  const ctas = CTA_COPY.hot;

  return (
    <div className="my-3 p-4 rounded-xl border-2 border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
      <p className="text-sm font-medium text-gray-800 mb-3">
        It sounds like you&apos;re ready to take the next step!
      </p>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => onCtaClick(ctas.primary.action)}
          className="w-full py-2.5 px-4 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          {ctas.primary.label}
        </button>
        <button
          onClick={() => onCtaClick(ctas.secondary.action)}
          className="w-full py-2.5 px-4 bg-white text-blue-600 text-sm font-medium rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors"
        >
          {ctas.secondary.label}
        </button>
        <button
          onClick={() => onCtaClick(ctas.tertiary.action)}
          className="w-full py-2 px-4 text-gray-600 text-sm hover:text-gray-800 transition-colors"
        >
          {ctas.tertiary.label}
        </button>
      </div>
    </div>
  );
}
