import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import type { Job } from "@/lib/db/schema";

export function JobHistory({ jobs }: { jobs: Job[] }) {
  if (!jobs.length) {
    return <div className="rounded-lg border bg-card p-6 text-sm text-muted-foreground">No jobs yet.</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-left text-sm">
        <thead className="bg-muted text-muted-foreground">
          <tr>
            <th className="px-4 py-3">Type</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Result</th>
            <th className="px-4 py-3">Created</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-t">
              <td className="px-4 py-3 capitalize">{job.type}</td>
              <td className="px-4 py-3"><Badge>{job.status}</Badge></td>
              <td className="px-4 py-3">
                {job.resultUrl && job.type === "image" ? (
                  <Image src={job.resultUrl} alt="" width={96} height={96} className="h-16 w-16 rounded-md object-cover" />
                ) : null}
                {job.resultUrl && job.type === "tts" ? <audio src={job.resultUrl} controls className="max-w-60" /> : null}
                {!job.resultUrl ? <span className="text-muted-foreground">{job.error ?? "Pending"}</span> : null}
              </td>
              <td className="px-4 py-3 text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
