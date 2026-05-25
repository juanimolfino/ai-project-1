import { getAiProvider } from "@/lib/ai/providers";
import { storeAiResult } from "@/lib/ai/storage";
import { getDb } from "@/lib/db";
import { jobs, users, type JobType } from "@/lib/db/schema";
import { markJobDone, markJobProcessing, refundJobCredits } from "@/lib/db/queries";
import { sendJobReadyEmail } from "@/lib/email/send";
import { releaseJobSlot } from "@/lib/redis/rate-limit";
import { inngest } from "./client";
import { eq } from "drizzle-orm";

export const runAiJob = inngest.createFunction(
  {
    id: "run-ai-job",
    retries: 3
  },
  { event: "ai/job.created" },
  async ({ event, step }) => {
    const { jobId } = event.data as { jobId: string };
    const job = await step.run("load job", async () => getDb().query.jobs.findFirst({ where: eq(jobs.id, jobId) }));
    if (!job) throw new Error(`Job ${jobId} not found`);

    try {
      await step.run("mark processing", async () => markJobProcessing(job.id));
      const resultUrl = await step.run("generate and store result", async () => {
        const provider = getAiProvider(job.type as JobType);
        const result = await provider.generate(job.input as never);
        return storeAiResult({
          userId: job.userId,
          jobId: job.id,
          bytes: result.bytes,
          contentType: result.contentType,
          extension: result.extension
        });
      });
      await step.run("mark done", async () => markJobDone(job.id, resultUrl));
      await step.run("send ready email", async () => {
        const user = await getDb().query.users.findFirst({ where: eq(users.id, job.userId) });
        if (user?.email) await sendJobReadyEmail(user.email, resultUrl);
      });
      return { resultUrl };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown AI job failure";
      await step.run("refund credits", async () => refundJobCredits(job.id, message));
      throw error;
    } finally {
      await step.run("release concurrency slot", async () => releaseJobSlot(job.userId));
    }
  }
);
