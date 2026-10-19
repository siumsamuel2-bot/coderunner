import { capitalizeLabel } from '@/lib/format';

const DIFFICULTY_STYLES: Record<string, string> = {
  easy: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  medium:
    'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const DIFFICULTY_DOT_STYLES: Record<string, string> = {
  easy: 'bg-green-500 dark:bg-green-400',
  medium: 'bg-amber-500 dark:bg-amber-400',
  hard: 'bg-red-500 dark:bg-red-400',
};

const FALLBACK_STYLE = 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
const FALLBACK_DOT_STYLE = 'bg-gray-400 dark:bg-gray-500';

/**
 * Difficulty badge with a leading status dot so meaning is not carried by
 * color alone (SPE-126 §1.2). Unknown difficulty values fall back to gray.
 */
export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const style = DIFFICULTY_STYLES[difficulty] ?? FALLBACK_STYLE;
  const dotStyle = DIFFICULTY_DOT_STYLES[difficulty] ?? FALLBACK_DOT_STYLE;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${style}`}
    >
      <span aria-hidden='true' className={`h-1.5 w-1.5 rounded-full ${dotStyle}`} />
      {capitalizeLabel(difficulty)}
    </span>
  );
}
