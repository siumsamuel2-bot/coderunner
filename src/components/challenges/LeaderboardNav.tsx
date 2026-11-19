'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Same-page anchor chips (SPE-127 §2.2): scroll within the page instead of
 * navigating. aria-current syncs with the section in view via
 * IntersectionObserver (progressive enhancement — plain anchors work
 * without JS). Sections with zero verified runs are omitted upstream.
 */
export function LeaderboardNav({
  sections,
}: {
  sections: { slug: string; title: string }[];
}) {
  const [current, setCurrent] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (sections.length === 0) return;

    const visible = new Map<string, boolean>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          visible.set(entry.target.id, entry.isIntersecting);
        }
        // Highest visible section in DOM order wins.
        for (const { slug } of sections) {
          if (visible.get(slug)) {
            setCurrent(slug);
            return;
          }
        }
        setCurrent(null);
      },
      { rootMargin: '-20% 0px -60% 0px' }
    );
    observerRef.current = observer;

    for (const { slug } of sections) {
      const section = document.getElementById(slug);
      if (section) observer.observe(section);
    }

    return () => {
      observer.disconnect();
      observerRef.current = null;
    };
  }, [sections]);

  if (sections.length === 0) return null;

  return (
    <div className='mb-8 flex flex-wrap gap-2' role='navigation' aria-label='Challenge sections'>
      {sections.map(({ slug, title }) => (
        <a
          key={slug}
          href={`#${slug}`}
          aria-current={current === slug ? 'true' : undefined}
          className={`rounded-full px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
            current === slug
              ? 'bg-indigo-600 text-white dark:bg-indigo-500'
              : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
          }`}
        >
          {title}
        </a>
      ))}
    </div>
  );
}
