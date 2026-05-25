import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { credits, jobs, subscriptions, transactions, users, type JobType } from "@/lib/db/schema";
import { sendPurchaseConfirmationEmail, sendWelcomeEmail } from "@/lib/email/send";
import type { User } from "@supabase/supabase-js";

export async function ensureUserProfile(authUser: User) {
  const db = getDb();
  const email = authUser.email ?? "";
  const existing = await db.query.users.findFirst({ where: eq(users.authUserId, authUser.id) });
  if (existing) return existing;

  const [profile] = await db
    .insert(users)
    .values({
      authUserId: authUser.id,
      email,
      fullName: authUser.user_metadata?.full_name ?? authUser.user_metadata?.name ?? null
    })
    .returning();

  const signupCredits = Number(process.env.FREE_SIGNUP_CREDITS ?? 5);
  await db.insert(credits).values({ userId: profile.id, balance: signupCredits });
  await db.insert(subscriptions).values({ userId: profile.id, plan: "free", status: "active" });
  await db.insert(transactions).values({
    userId: profile.id,
    type: "signup_bonus",
    credits: signupCredits,
    metadata: { source: "first_login" }
  });
  await sendWelcomeEmail(email, signupCredits);

  return profile;
}

export async function getDashboard(userId: string) {
  const db = getDb();
  const [creditRow, subscriptionRows, jobRows] = await Promise.all([
    db.query.credits.findFirst({ where: eq(credits.userId, userId) }),
    db.query.subscriptions.findMany({ where: eq(subscriptions.userId, userId), orderBy: desc(subscriptions.createdAt), limit: 1 }),
    db.query.jobs.findMany({ where: eq(jobs.userId, userId), orderBy: desc(jobs.createdAt), limit: 50 })
  ]);

  return {
    credits: creditRow?.balance ?? 0,
    subscription: subscriptionRows[0] ?? null,
    jobs: jobRows
  };
}

export async function createPendingJob(input: {
  userId: string;
  type: JobType;
  payload: Record<string, unknown>;
  creditsUsed: number;
}) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [creditRow] = await tx
      .select()
      .from(credits)
      .where(and(eq(credits.userId, input.userId), sql`${credits.balance} >= ${input.creditsUsed}`))
      .for("update");

    if (!creditRow) throw new Error("INSUFFICIENT_CREDITS");

    await tx
      .update(credits)
      .set({ balance: sql`${credits.balance} - ${input.creditsUsed}`, updatedAt: new Date() })
      .where(eq(credits.userId, input.userId));

    const [job] = await tx
      .insert(jobs)
      .values({
        userId: input.userId,
        type: input.type,
        input: input.payload,
        creditsUsed: input.creditsUsed
      })
      .returning();

    return job;
  });
}

export async function refundJobCredits(jobId: string, reason: string) {
  const db = getDb();
  return db.transaction(async (tx) => {
    const job = await tx.query.jobs.findFirst({ where: eq(jobs.id, jobId) });
    if (!job) throw new Error("Job not found");

    await tx.update(credits).set({ balance: sql`${credits.balance} + ${job.creditsUsed}`, updatedAt: new Date() }).where(eq(credits.userId, job.userId));
    await tx.insert(transactions).values({
      userId: job.userId,
      type: "credit_refund",
      credits: job.creditsUsed,
      metadata: { jobId, reason }
    });
    await tx.update(jobs).set({ status: "failed", error: reason, updatedAt: new Date() }).where(eq(jobs.id, jobId));
  });
}

export async function markJobProcessing(jobId: string) {
  return getDb().update(jobs).set({ status: "processing", updatedAt: new Date() }).where(eq(jobs.id, jobId));
}

export async function markJobDone(jobId: string, resultUrl: string) {
  return getDb().update(jobs).set({ status: "done", resultUrl, updatedAt: new Date() }).where(eq(jobs.id, jobId));
}

export async function getJobForUser(jobId: string, userId: string) {
  return getDb().query.jobs.findFirst({ where: and(eq(jobs.id, jobId), eq(jobs.userId, userId)) });
}

export async function addCredits(userId: string, amount: number, metadata: Record<string, unknown>, stripeEventId?: string) {
  const db = getDb();
  const profile = await db.query.users.findFirst({ where: eq(users.id, userId) });
  await db.transaction(async (tx) => {
    await tx
      .insert(credits)
      .values({ userId, balance: amount })
      .onConflictDoUpdate({
        target: credits.userId,
        set: { balance: sql`${credits.balance} + ${amount}`, updatedAt: new Date() }
      });
    await tx.insert(transactions).values({
      userId,
      type: metadata.kind === "subscription" ? "subscription_payment" : "credit_purchase",
      credits: amount,
      amountCents: typeof metadata.amountCents === "number" ? metadata.amountCents : null,
      stripeEventId,
      metadata
    }).onConflictDoNothing();
  });
  if (profile?.email && amount > 0) await sendPurchaseConfirmationEmail(profile.email, amount);
}
