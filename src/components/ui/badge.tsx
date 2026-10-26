'use client';

type BadgeVariant = 'difficulty' | 'category' | 'language' | 'time' | 'verification';

function difficultyColor(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case 'easy':
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'medium':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
    case 'hard':
      return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

function verificationColor(status: string) {
  switch (status.toLowerCase()) {
    case 'verified':
      return 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400';
    case 'failed':
      return 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400';
    case 'pending':
      return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }
}

export function Badge({
  variant = 'category',
  value,
  className,
}: {
  variant?: BadgeVariant;
  value: string;
  className?: string;
}) {
  const base = 'px-2.5 py-0.5 rounded-full text-xs font-medium';
  let color = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';

  switch (variant) {
    case 'difficulty':
      color = difficultyColor(value);
      break;
    case 'verification':
      color = verificationColor(value);
      break;
    default:
      color = 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  }

  return (
    <span className={`${base} ${color} ${className ?? ''}`}>
      {value.charAt(0).toUpperCase() + value.slice(1)}
    </span>
  );
}
