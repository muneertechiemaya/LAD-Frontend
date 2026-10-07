'use client';
import { Suspense } from 'react';
import { ContentStudio } from '@/components/content-studio/ContentStudio';

export default function ContentStudioPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <ContentStudio />
    </Suspense>
  );
}
