import { SignIn } from '@clerk/nextjs';

export default function SignInPage() {
  return (
    <div className='min-h-screen bg-zinc-50 dark:bg-black flex items-center justify-center py-12'>
      <div className='w-full max-w-xs flex justify-center'>
        <SignIn fallbackRedirectUrl='/dashboard' signUpUrl='/auth/signin' />
      </div>
    </div>
  );
}
