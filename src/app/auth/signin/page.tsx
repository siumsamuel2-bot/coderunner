import { signIn } from '@/auth';

export default function SignInPage() {
  async function signInWithEmail(formData: FormData) {
    'use server';
    await signIn('credentials', {
      email: formData.get('email'),
      redirectTo: '/dashboard',
    });
  }

  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center py-12'>
      <div className='w-full max-w-xs space-y-6'>
        <h1 className='text-center text-2xl font-bold text-gray-900 dark:text-gray-100'>
          Sign in to Coderunner
        </h1>

        <form action={signInWithEmail} className='space-y-4'>
          <div>
            <label
              htmlFor='email'
              className='block mb-2 text-sm font-medium text-gray-900 dark:text-gray-100'
            >
              Email
            </label>
            <input
              type='email'
              id='email'
              name='email'
              required
              className='w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:text-gray-100'
              placeholder='Enter your email'
            />
          </div>

          <button
            type='submit'
            className='w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500'
          >
            Sign In
          </button>

          <div className='text-center text-sm text-gray-500 dark:text-gray-400'>
            New here? An account is created automatically on first sign-in.
          </div>
        </form>
      </div>
    </div>
  );
}
