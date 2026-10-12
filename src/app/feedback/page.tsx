import type { Metadata } from 'next';
import FeedbackForm from './FeedbackForm';

export const metadata: Metadata = {
  title: 'Feedback',
  description: 'Tell us what to improve on Coderunner.',
};

export default function FeedbackPage() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8'>
        <h1 className='mb-4 text-3xl font-bold text-center text-gray-900 dark:text-gray-100'>
          Feedback
        </h1>
        <p className='mb-8 text-center text-gray-600 dark:text-gray-400'>
          Found a bug? Have a challenge idea? Tell us — we triage every week.
        </p>
        <FeedbackForm />
      </div>
    </div>
  );
}
