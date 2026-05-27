// Supabase Edge Function: create-github-issue
// Triggered by a Database Webhook/pg_net trigger on INSERT into feedback_reports.
// Creates a GitHub issue in the configured private repo using a PAT stored as a secret.
// Writes the GitHub issue URL back to the row's github_issue_url column.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.48.1";

type FeedbackType = "bug" | "feature";

interface FeedbackReport {
  id: string;
  user_id: string;
  type: FeedbackType;
  title: string;
  description: string;
  severity: string | null;
  category: string | null;
  active_module: string | null;
  app_version: string;
  os_name: string;
  os_version: string;
  status: string;
  developer_note: string | null;
  github_issue_url: string | null;
  created_at: string;
  updated_at: string;
}

interface WebhookPayload {
  type?: string;
  table?: string;
  schema?: string;
  record?: { id?: string };
}

serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let payload: WebhookPayload;
  try {
    payload = await req.json();
  } catch {
    return new Response("Invalid JSON payload", { status: 400 });
  }

  if (payload.type !== "INSERT" || payload.table !== "feedback_reports") {
    return new Response("Ignored: not a feedback_reports INSERT", { status: 200 });
  }

  const rowId = payload.record?.id;
  if (!rowId) {
    return new Response("Missing feedback row id", { status: 400 });
  }

  const githubPat = Deno.env.get("GITHUB_PAT");
  const githubRepo = Deno.env.get("GITHUB_REPO") ?? "Kimenzo/Genesis";
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!githubPat || !supabaseUrl || !supabaseServiceKey) {
    console.error("Missing required secrets: GITHUB_PAT, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY");
    return new Response("Server misconfigured", { status: 500 });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const { data: record, error: readError } = await supabase
    .from("feedback_reports")
    .select(
      "id,user_id,type,title,description,severity,category,active_module,app_version,os_name,os_version,status,developer_note,github_issue_url,created_at,updated_at",
    )
    .eq("id", rowId)
    .single<FeedbackReport>();

  if (readError || !record) {
    console.error(`Feedback row lookup failed for ${rowId}: ${readError?.message ?? "not found"}`);
    return new Response("Feedback row not found", { status: 404 });
  }

  if (record.github_issue_url) {
    return new Response(
      JSON.stringify({ success: true, github_issue_url: record.github_issue_url, skipped: true }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const isBug = record.type === "bug";
  const prefix = isBug ? "[Bug]" : "[Feature]";
  const typeLabel = isBug ? "bug" : "enhancement";
  const severityLabel = record.severity ? `severity: ${record.severity}` : null;
  const categoryLabel = record.category ? `category: ${record.category}` : null;
  const labels = [typeLabel, severityLabel, categoryLabel].filter(Boolean) as string[];

  const body = [
    `**Submitted by:** \`${record.user_id}\` (anonymized)`,
    "",
    `**Type:** ${isBug ? "Bug Report" : "Feature Request"}`,
    `**Module:** ${record.active_module || "N/A"}`,
    `**${isBug ? "Severity" : "Category"}:** ${isBug ? (record.severity || "N/A") : (record.category || "N/A")}`,
    `**App Version:** ${record.app_version}`,
    `**OS:** ${record.os_name} ${record.os_version}`,
    "",
    "---",
    "",
    record.description,
    "",
    "---",
    "",
    `**Supabase Row ID:** \`${record.id}\``,
    `**Submitted at:** ${record.created_at}`,
  ].join("\n");

  const githubResponse = await fetch(`https://api.github.com/repos/${githubRepo}/issues`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${githubPat}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Bento-Feedback-System",
    },
    body: JSON.stringify({
      title: `${prefix} ${record.title}`,
      body,
      labels,
    }),
  });

  if (!githubResponse.ok) {
    const errorText = await githubResponse.text();
    console.error(`GitHub API error (${githubResponse.status}): ${errorText}`);
    return new Response(`GitHub API error: ${githubResponse.status}`, { status: 500 });
  }

  const githubData = await githubResponse.json();
  const githubIssueUrl = githubData.html_url as string;

  const { error: updateError } = await supabase
    .from("feedback_reports")
    .update({ github_issue_url: githubIssueUrl } as never)
    .eq("id", record.id);

  if (updateError) {
    console.error(`Failed to update github_issue_url for row ${record.id}: ${updateError.message}`);
  }

  return new Response(
    JSON.stringify({ success: true, github_issue_url: githubIssueUrl }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
