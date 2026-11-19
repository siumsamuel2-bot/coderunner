import { capitalizeLabel } from '@/lib/format';

/**
 * Category chip (SPE-126 §1.2). Free-form label from the DB, capitalized,
 * truncated at 16 chars with the full value in `title`.
 */
export function CategoryChip({ category }: { category: string }) {
  return (
    <span
      title={category}
      className='inline-flex max-w-[10rem] items-center truncate rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300'
    >
      {capitalizeLabel(category)}
    </span>
  );
}
