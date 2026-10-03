import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';

const inputClasses =
  'block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';

async function requireAdmin() {
  const session = await auth();
  const isAdmin = session?.user?.email === 'admin@example.com';
  if (!session?.user?.id || !isAdmin) {
    redirect('/auth/signin');
  }
}

export default async function EditChallengePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const challenge = await prisma.challenge.findUnique({ where: { id } });
  if (!challenge) {
    notFound();
  }

  async function updateChallenge(formData: FormData) {
    'use server';
    await requireAdmin();

    const title = (formData.get('title') as string).trim();
    const description = (formData.get('description') as string).trim();
    const rawSlug = (formData.get('slug') as string).trim();
    const difficulty = (formData.get('difficulty') as string) || 'easy';
    const estimatedMinutes = parseInt((formData.get('estimatedMinutes') as string) || '15', 10) || 15;
    const acceptanceCriteria = ((formData.get('acceptanceCriteria') as string) || '').trim();

    const slug =
      rawSlug ||
      title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    await prisma.challenge.update({
      where: { id },
      data: {
        title,
        description,
        slug,
        difficulty,
        estimatedMinutes,
        acceptanceCriteria,
      },
    });

    redirect('/admin');
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <Link
            href='/admin'
            className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWidth='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to admin</span>
          </Link>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            Edit Challenge: {challenge.title}
          </h1>
        </div>

        <form action={updateChallenge} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
          <div className='space-y-5'>
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Title
              </label>
              <input type='text' name='title' required defaultValue={challenge.title} className={inputClasses} />
            </div>

            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Description
              </label>
              <textarea name='description' required rows={4} defaultValue={challenge.description} className={inputClasses} />
            </div>

            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Slug (URL identifier)
              </label>
              <input type='text' name='slug' defaultValue={challenge.slug} className={inputClasses} />
            </div>

            <div className='grid gap-4 sm:grid-cols-2'>
              <div>
                <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                  Difficulty
                </label>
                <select name='difficulty' defaultValue={challenge.difficulty} className={inputClasses}>
                  <option value='easy'>Easy</option>
                  <option value='medium'>Medium</option>
                  <option value='hard'>Hard</option>
                </select>
              </div>
              <div>
                <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                  Estimated Time (minutes)
                </label>
                <input type='number' name='estimatedMinutes' defaultValue={challenge.estimatedMinutes} min={1} className={inputClasses} />
              </div>
            </div>

            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Acceptance Criteria
              </label>
              <textarea name='acceptanceCriteria' rows={4} defaultValue={challenge.acceptanceCriteria} className={inputClasses} />
            </div>
          </div>

          <div className='mt-6'>
            <button
              type='submit'
              className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            >
              Update Challenge
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
