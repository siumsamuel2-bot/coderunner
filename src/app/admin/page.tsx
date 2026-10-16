import Link from 'next/link';

import { prisma } from '@/lib/prisma';
import { SignOutLink } from '@/components/SignOutLink';
import { requireAdmin } from '@/lib/admin';
import { revalidatePath } from 'next/cache';

export const dynamic = 'force-dynamic';

const inputClasses =
  'block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200';
void inputClasses;

export default async function AdminPage() {
  const session = await requireAdmin();

  async function deleteChallenge(formData: FormData) {
    'use server';
    await requireAdmin();
    const id = formData.get('id') as string;
    if (id) {
      await prisma.challenge.delete({ where: { id } });
      revalidatePath('/admin');
    }
  }

  async function deleteUser(formData: FormData) {
    'use server';
    const current = await requireAdmin();
    const id = formData.get('id') as string;
    if (id && id !== current.user.id) {
      await prisma.user.delete({ where: { id } });
      revalidatePath('/admin');
    }
  }

  const [challenges, users] = await Promise.all([
    prisma.challenge.findMany({ orderBy: { createdAt: 'desc' } }),
    prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        createdAt: true,
        _count: { select: { runs: true } },
      },
    }),
  ]);

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
      <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
        <div className='flex items-center justify-between mb-8'>
          <h1 className='text-3xl font-bold text-gray-900 dark:text-gray-100'>
            Admin Panel
          </h1>
          <div className='flex items-center space-x-4'>
            {session.user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt={`${session.user.name ?? 'user'}'s avatar`}
                className='h-10 w-10 rounded-full'
              />
            ) : (
              <div className='h-10 w-10 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center'>
                {session.user.name?.[0]?.toUpperCase()}
              </div>
            )}
            <div className='space-y-2'>
              <p className='text-sm font-medium text-gray-900 dark:text-gray-100'>
                {session.user.name}
              </p>
              <p className='text-xs text-gray-500 dark:text-gray-400'>
                {session.user.email}
              </p>
            </div>
            <SignOutLink />
          </div>
        </div>

        <div className='grid gap-6'>
          <div className='col-span-1'>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm'>
              <div className='p-6'>
                <h2 className='mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100'>
                  Manage Challenges
                </h2>
                <div className='mb-4 flex items-center justify-between'>
                  <Link
                    href='/admin/challenges/new'
                    className='px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors'
                  >
                    Add New Challenge
                  </Link>
                </div>

                {challenges.length === 0 ? (
                  <p className='text-center py-4 text-gray-500 dark:text-gray-400'>
                    No challenges found.
                  </p>
                ) : (
                  <div className='space-y-3'>
                    {challenges.map((challenge) => (
                      <div key={challenge.id} className='border-b py-3 last:border-b-0'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center space-x-3'>
                            <div className='w-8 h-8 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg flex items-center justify-center'>
                              {challenge.title.slice(0, 1).toUpperCase()}
                            </div>
                            <div>
                              <p className='font-medium text-gray-900 dark:text-gray-100'>
                                {challenge.title}
                              </p>
                              <p className='text-xs text-gray-500 dark:text-gray-400'>
                                {challenge.slug}
                              </p>
                            </div>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <Link
                              href={`/admin/challenges/${challenge.id}`}
                              className='text-sm text-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-400'
                            >
                              Edit
                            </Link>
                            <form action={deleteChallenge}>
                              <input type='hidden' name='id' value={challenge.id} />
                              <button
                                type='submit'
                                className='text-sm text-red-600 hover:text-red-500 dark:hover:text-red-300'
                                title='Delete challenge'
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className='col-span-1'>
            <div className='bg-white dark:bg-gray-800 rounded-xl shadow-sm'>
              <div className='p-6'>
                <h2 className='mb-4 text-xl font-semibold text-gray-900 dark:text-gray-100'>
                  Manage Users
                </h2>
                <div className='mb-4 flex items-center justify-between'>
                  <Link
                    href='/admin/users/new'
                    className='px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors'
                  >
                    Add New User
                  </Link>
                </div>

                {users.length === 0 ? (
                  <p className='text-center py-4 text-gray-500 dark:text-gray-400'>
                    No users found.
                  </p>
                ) : (
                  <div className='space-y-3'>
                    {users.map((user) => (
                      <div key={user.id} className='border-b py-3 last:border-b-0'>
                        <div className='flex items-center justify-between'>
                          <div className='flex items-center space-x-3'>
                            <div className='w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg flex items-center justify-center'>
                              {user.name?.[0]?.toUpperCase()}
                            </div>
                            <div>
                              <p className='font-medium text-gray-900 dark:text-gray-100'>
                                {user.name || 'Anonymous'}
                              </p>
                              <p className='text-xs text-gray-500 dark:text-gray-400'>
                                {user.email}
                              </p>
                            </div>
                          </div>
                          <div className='flex items-center space-x-2'>
                            <Link
                              href={`/admin/users/${user.id}`}
                              className='text-sm text-indigo-600 hover:text-indigo-500 dark:hover:text-indigo-400'
                            >
                              Edit
                            </Link>
                            {user.id !== session.user.id && (
                              <form action={deleteUser}>
                                <input type='hidden' name='id' value={user.id} />
                                <button
                                  type='submit'
                                  className='text-sm text-red-600 hover:text-red-500 dark:hover:text-red-300'
                                  title='Delete user'
                                >
                                  Delete
                                </button>
                              </form>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className='mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg'>
                  <p className='text-sm font-medium text-gray-600 dark:text-gray-400'>
                    Note: You cannot delete your own account from this panel.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

