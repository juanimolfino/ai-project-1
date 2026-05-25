import Image from "next/image";
import Link from "next/link";
import { Download, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
            <tr key={job.id} className="border-t align-top">
              <td className="px-4 py-4 capitalize">{job.type}</td>
              <td className="px-4 py-4"><Badge>{job.status}</Badge></td>
              <td className="px-4 py-4">
                <div className="flex flex-col gap-3">
                  {job.resultUrl && job.type === "image" ? (
                    <Link href={job.resultUrl} target="_blank" rel="noreferrer" className="block w-fit">
                      <Image
                        src={job.resultUrl}
                        alt=""
                        width={192}
                        height={192}
                        className="h-28 w-28 rounded-md border object-cover transition-opacity hover:opacity-85"
                      />
                    </Link>
                  ) : null}
                  {job.resultUrl && job.type === "tts" ? <audio src={job.resultUrl} controls className="max-w-72" /> : null}
                  {job.resultUrl ? (
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={job.resultUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                          View
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <a href={job.resultUrl} download>
                          <Download className="h-4 w-4" />
                          Download
                        </a>
                      </Button>
                    </div>
                  ) : null}
                  {!job.resultUrl ? <span className="text-muted-foreground">{job.error ?? "Pending"}</span> : null}
                </div>
              </td>
              <td className="px-4 py-4 text-muted-foreground">{new Date(job.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
