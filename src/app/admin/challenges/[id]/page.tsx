import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default async function EditChallengePage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  
  // Check if user is admin
  const isAdmin = session?.user?.email === 'admin@example.com';
  
  if (!session?.user?.id || !isAdmin) {
    // Redirect to sign in if not authenticated or not admin
    return <div>Redirecting to sign in...</div>;
  }

  const [challenge, setChallenge] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [slug, setSlug] = useState('');
  const [difficulty, setDifficulty] = useState('easy');
  const [estimatedMinutes, setEstimatedMinutes] = useState(15);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadChallenge();
  }, [params.id]);

  async function loadChallenge() {
    try {
      const challengeData = await prisma.challenge.findUnique({
        where: { id: params.id },
      });
      
      if (!challengeData) {
        setError('Challenge not found');
        setLoading(false);
        return;
      }
      
      setChallenge(challengeData);
      setTitle(challengeData.title);
      setDescription(challengeData.description);
      setSlug(challengeData.slug);
      setDifficulty(challengeData.difficulty);
      setEstimatedMinutes(challengeData.estimatedMinutes);
      setAcceptanceCriteria(challengeData.acceptanceCriteria);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load challenge:', err);
      setError('Failed to load challenge. Please try again.');
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      // Generate slug from title if not provided
      const finalSlug = slug.trim() || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

      await prisma.challenge.update({
        where: { id: params.id },
        data: {
          title,
          description,
          slug: finalSlug,
          difficulty,
          estimatedMinutes,
          acceptanceCriteria,
          // In a real app, you'd have a proper testSpec JSON structure
          testSpec: {},
        },
      });

      setSuccess(true);
    } catch (err) {
      console.error('Failed to update challenge:', err);
      setError('Failed to update challenge. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!challenge) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
        <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between mb-8'>
            <Link
              href='/admin/challenges'
              className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWeight='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
              </svg>
              <span>Back to challenges</span>
            </Link>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Edit Challenge
            </h1>
          </div>
          
          {loading ? (
            <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
              Loading challenge...
            )
          ) : (
            <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
              Challenge not found.
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <Link
            href='/admin/challenges'
            className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWeight='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to challenges</span>
          </Link>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            Edit Challenge: {challenge.title}
          </h1>
        </div>
        
        {error && (
          <div className='mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg'>
            {error}
          </div>
        )}
        
        {success && (
          <div className='mb-4 p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 rounded-lg'>
            Challenge updated successfully!
          </div>
        )}
        
        <form onSubmit={handleSubmit} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
          <div className='space-y-5'>
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Title
              </label>
              <input
                type='text'
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Enter challenge title'
              />
            </div>
            
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={4}
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Enter challenge description'
              />
            </div>
            
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Slug (URL identifier)
              </label>
              <input
                type='text'
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Leave empty to auto-generate from title'
              />
              <p className='mt-1 text-xs text-gray-500 dark:text-gray-400'>
                Used in the challenge URL: /challenges/{slug}
              </p>
            </div>
            
            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                  Difficulty
                </label>
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value)}
                  className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                >
                  <option value='easy'>Easy</option>
                  <option value='medium'>Medium</option>
                  <option value='hard'>Hard</option>
                </select>
              </div>
              <div>
                <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                  Estimated Time (minutes)
                </label>
                <input
                  type='number'
                  value={estimatedMinutes}
                  onChange={(e) => setEstimatedMinutes(parseInt(e.target.value) || 15)}
                  min={1}
                  className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                />
              </div>
            </div>
            
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Acceptance Criteria
              </label>
              <textarea
                value={acceptanceCriteria}
                onChange={(e) => setAcceptanceCriteria(e.target.value)}
                rows={4}
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Describe what makes a submission pass verification'
              />
            </div>
          </div>
          
          <div className='mt-6'>
            <button
              type='submit'
              disabled={loading}
              className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 {loading ? 'bg-indigo-400' : ''}'
            >
              {loading ? 'Updating...' : 'Update Challenge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}