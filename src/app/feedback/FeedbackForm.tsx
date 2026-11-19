'use client';

import { useState } from 'react';

const CATEGORIES = [
  { value: 'general', label: 'General feedback' },
  { value: 'bug', label: 'Bug report' },
  { value: 'challenge-idea', label: 'Challenge idea' },
  { value: 'praise', label: 'Praise' },
] as const;

export default function FeedbackForm() {
  const [category, setCategory] = useState<string>('general');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'error'>(
    'idle'
  );
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus('submitting');
    setError(null);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, email: email || undefined }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error ?? `Request failed (${response.status})`);
      }
      setStatus('done');
      setMessage('');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (status === 'done') {
    return (
      <div className='rounded-xl bg-green-50 dark:bg-green-900/20 p-6 text-center'>
        <p className='text-green-800 dark:text-green-200 font-medium'>
          Thanks! Your feedback has been recorded.
        </p>
        <button
          type='button'
          onClick={() => setStatus('idle')}
          className='mt-4 text-sm text-indigo-600 dark:text-indigo-400 hover:underline'
        >
          Send more feedback
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className='space-y-4'>
      <div>
        <label
          htmlFor='category'
          className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
        >
          Category
        </label>
        <select
          id='category'
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className='w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100'
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label
          htmlFor='message'
          className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
        >
          Message
        </label>
        <textarea
          id='message'
          required
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder='What is working? What is broken? What challenge should we add next?'
          className='w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100'
        />
      </div>

      <div>
        <label
          htmlFor='email'
          className='block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1'
        >
          Email (optional, if you want a reply)
        </label>
        <input
          id='email'
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='you@example.com'
          className='w-full rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-gray-900 dark:text-gray-100'
        />
      </div>

      {error !== null && (
        <p className='text-sm text-red-600 dark:text-red-400'>{error}</p>
      )}

      <button
        type='submit'
        disabled={status === 'submitting'}
        className='w-full rounded-full bg-indigo-600 px-5 py-3 text-white font-medium hover:bg-indigo-700 disabled:opacity-50'
      >
        {status === 'submitting' ? 'Sending…' : 'Send feedback'}
      </button>
    </form>
  );
}
