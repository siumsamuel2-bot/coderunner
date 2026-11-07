'use client';

import { SignOutButton } from '@clerk/nextjs';

export function SignOutLink({ className }: { className?: string }) {
  return (
    <SignOutButton redirectUrl='/'>
      <button
        type='button'
        className={
          className ??
          'px-3 py-1.5 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg'
        }
      >
        Sign Out
      </button>
    </SignOutButton>
  );
}
