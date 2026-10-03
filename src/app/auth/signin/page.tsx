import { signIn } from '@/auth';
import { useState } from 'react';

export default function SignInPage() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    try {
      // For demonstration, we'll use credentials provider
      // In a real app, you'd want to implement proper email/password handling
      await signIn('credentials', {
        email,
        redirect: false,
      });

      // If successful, redirect to dashboard
      window.location.href = '/dashboard';
    } catch (err) {
      setError('Invalid credentials');
    }
  };

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center py-12'>
      <div className='w-full max-w-xs space-y-6'>
        <h1 className='text-center text-2xl font-bold text-gray-900 dark:text-gray-100'>
          Sign in to Coderunner
        </h1>
        
        {error && (
          <div className='bg-red-50 dark:bg-red-900/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 px-4 py-3 rounded-md'>
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className='space-y-4'>
          <div>
            <label htmlFor='email' className='block mb-2 text-sm font-medium text-gray-900 dark:text-gray-100'>
              Email
            </label>
            <input
              type='email'
              id='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:focus:ring-indigo-400 dark:bg-gray-700 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400'
              placeholder='Enter your email'
            />
          </div>
          
          <button
            type='submit'
            className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50'
          >
            Sign In
          </button>
          
          <div className='text-center text-sm text-gray-500 dark:text-gray-400'>
            Don't have an account? <span className='text-indigo-600 hover:text-indigo-500'>Sign up</span>
          </div>
        </form>
      </div>
    </div>
  );
}

