import { httpBatchLink } from '@trpc/client';
import { createTRPCNext } from '@trpc/react-query';
import { type AppRouter } from '@/src/trpc/appRouter';

function getBaseUrl() {
  if (typeof window !== 'undefined')
    return '';
  if (process.env.VERCEL_URL)
    return https://;
  return http://localhost:;
}

/**
 * This is the tRPC client used by both server and client
 */
export const trpc = createTRPCNext<AppRouter>({
  config() {
    return {
      links: [
        httpBatchLink({
          /**
           * If you want to use SSR, you need to use the server's full URL
           * @link https://trpc.io/docs/ssr
           **/
          url: ${getBaseUrl()}/api/trpc,
        }),
      ],
      /**
       * @link https://trpc.io/docs/ssr
       **/
      ssr: false,
    };
  },
});

