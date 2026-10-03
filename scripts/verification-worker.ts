
import { processVerificationJobs } from '@/lib/verification/queue';
import { prisma } from '@/lib/prisma';

async function main() {
  console.log('Starting verification worker...');

  // Process jobs continuously
  while (true) {
    try {
      const job = await processVerificationJobs();
      if (job) {
        console.log(`Processed verification job ${job.id}`);
      } else {
        // No pending jobs, wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds
      }
    } catch (error) {
      console.error('Error in verification worker:', error);
      // Wait longer on error to avoid tight loop
      await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Received SIGINT. Shutting down verification worker...');
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM. Shutting down verification worker...');
  await prisma.$disconnect();
  process.exit(0);
});

main().catch((error) => {
  console.error('Fatal error in verification worker:', error);
  process.exit(1);
});

