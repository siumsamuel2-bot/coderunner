'use client';

import { useEffect, useState } from 'react';

export function ChallengeTimer({ deadline }: { deadline: string | null }) {
  const [remaining, setRemaining] = useState(() => {
    if (!deadline) return null;
    return Math.max(0, new Date(deadline).getTime() - Date.now());
  });

  useEffect(() => {
    if (!deadline) return;
    const end = new Date(deadline).getTime();
    const tick = () => {
      setRemaining(() => Math.max(0, end - Date.now()));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  if (remaining === 0) {
    return (
      <div className='flex items-center gap-2 text-sm font-medium text-red-600 dark:text-red-400'>
        <span>Time expired</span>
      </div>
    );
  }

  if (remaining == null) {
    return null;
  }

  const totalSeconds = Math.ceil(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const critical = totalSeconds <= 30;

  return (
    <div className='flex items-center gap-2 text-sm font-mono font-medium'>
      <span>Time remaining</span>
      <span
        className={`text-xs ${critical ? 'text-red-600 dark:text-red-400 animate-pulse' : 'text-gray-600 dark:text-gray-400'}`}
      >
        {minutes.toString().padStart(2, '0')}:{seconds
        .toString()
        .padStart(2, '0')}
      </span>
    </div>
  );
}
