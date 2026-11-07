'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_LINKS = [
  { href: '/challenges', label: 'Challenges' },
  { href: '/leaderboard', label: 'Leaderboard' },
  { href: '/dashboard', label: 'Dashboard' },
];

/**
 * Shared top navigation (SPE-137): one consistent bar on every page —
 * wordmark + primary destinations, active-link state, dark-mode parity.
 * Developer-tool slim, not a marketing mega-header.
 */
export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className='border-b border-gray-200 bg-white dark:border-gray-800 dark:bg-black'>
      <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
        <nav
          aria-label='Main navigation'
          className='flex h-14 items-center justify-between'
        >
          <Link
            href='/'
            className='flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500'
          >
            <svg
              aria-hidden='true'
              className='h-4 w-4 text-indigo-600 dark:text-indigo-400'
              fill='none'
              stroke='currentColor'
              viewBox='0 0 24 24'
            >
              <path
                strokeLinecap='round'
                strokeLinejoin='round'
                strokeWidth='2'
                d='M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z'
              />
            </svg>
            Coderunner
          </Link>
          <div className='flex items-center gap-1'>
            {NAV_LINKS.map(({ href, label }) => {
              const active =
                pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                    active
                      ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-900 dark:hover:text-gray-100'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </header>
  );
}
