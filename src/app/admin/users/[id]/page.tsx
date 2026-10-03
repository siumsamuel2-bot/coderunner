import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import Link from 'next/link';
import { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default async function EditUserPage({
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

  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  useEffect(() => {
    loadUser();
  }, [params.id]);

  async function loadUser() {
    try {
      const userData = await prisma.user.findUnique({
        where: { id: params.id },
      });
      
      if (!userData) {
        setError('User not found');
        setLoading(false);
        return;
      }
      
      setUser(userData);
      setName(userData.name || '');
      setEmail(userData.email);
      setImage(userData.image || '');
      setLoading(false);
    } catch (err) {
      console.error('Failed to load user:', err);
      setError('Failed to load user. Please try again.');
      setLoading(false);
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      await prisma.user.update({
        where: { id: params.id },
        data: {
          name: name.trim() || undefined,
          email: email.toLowerCase().trim(),
          image: image.trim() || undefined,
        },
      });

      setSuccess(true);
    } catch (err) {
      console.error('Failed to update user:', err);
      setError('Failed to update user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className='min-h-screen bg-zinc-50 dark:bg-black py-12'>
        <div className='max-w-2xl mx-auto px-4 sm:px-6 lg:px-8'>
          <div className='flex items-center justify-between mb-8'>
            <Link
              href='/admin/users'
              className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
            >
              <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                <path strokeLinecap='round' strokeLinejoin='round' strokeWeight='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
              </svg>
              <span>Back to users</span>
            </Link>
            <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
              Edit User
            </h1>
          </div>
          
          {loading ? (
            <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
              Loading user...
            )
          ) : (
            <p className='text-center py-8 text-gray-500 dark:text-gray-400'>
              User not found.
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
            href='/admin/users'
            className='flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-500 dark:hover:text-gray-300'
          >
            <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
              <path strokeLinecap='round' strokeLinejoin='round' strokeWeight='2' d='M10 19l-7-7m0 0l7-7m-7 7h18' />
            </svg>
            <span>Back to users</span>
          </Link>
          <h1 className='text-2xl font-bold text-gray-900 dark:text-gray-100'>
            Edit User: {user.name || 'Anonymous'}
          </h1>
        </div>
        
        {error && (
          <div className='mb-4 p-3 bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-lg'>
            {error}
          </div>
        )}
        
        {success && (
          <div className='mb-4 p-3 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 rounded-lg'>
            User updated successfully!
          </div>
        )}
        
        <form onSubmit={handleSubmit} className='bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6'>
          <div className='space-y-4'>
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Name
              </label>
              <input
                type='text'
                value={name}
                onChange={(e) => setName(e.target.value)}
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Enter user name (optional)'
              />
            </div>
            
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Email
              </label>
              <input
                type='email'
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Enter user email'
              />
            </div>
            
            <div>
              <label className='block mb-2 text-sm font-medium text-gray-700 dark:text-gray-300'>
                Profile Image URL (optional)
              </label>
              <input
                type='text'
                value={image}
                onChange={(e) => setImage(e.target.value)}
                className='block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-300 focus:border-indigo-500 focus:shadow-indigo-outline indent-0 focus:ring-2 focus:ring-indigo-200 focus:ring-offset-0'
                placeholder='Enter profile image URL (optional)'
              />
            </div>
          </div>
          
          <div className='mt-6'>
            <button
              type='submit'
              disabled={loading}
              className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 {loading ? 'bg-indigo-400' : ''}'
            >
              {loading ? 'Updating...' : 'Update User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}