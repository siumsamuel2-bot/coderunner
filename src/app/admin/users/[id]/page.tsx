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

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    notFound();
  }

  async function updateUser(formData: FormData) {
    'use server';
    await requireAdmin();

    const name = ((formData.get('name') as string) || '').trim() || null;
    const email = (formData.get('email') as string).toLowerCase().trim();
    const image = ((formData.get('image') as string) || '').trim() || null;

    await prisma.user.update({
      where: { id },
      data: { name, email, image },
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
            Edit User: {user.name || 'Anonymous'}
          </h1>
        </div>

        <form action={updateUser} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
          <div className='space-y-4'>
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Name
              </label>
              <input type='text' name='name' defaultValue={user.name ?? ''} className={inputClasses} />
            </div>

            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Email
              </label>
              <input type='email' name='email' required defaultValue={user.email ?? ''} className={inputClasses} />
            </div>

            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Profile Image URL (optional)
              </label>
              <input type='text' name='image' defaultValue={user.image ?? ''} className={inputClasses} />
            </div>
          </div>

          <div className='mt-6'>
            <button
              type='submit'
              className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
            >
              Update User
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
