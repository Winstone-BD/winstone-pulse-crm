import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { logAudit } from "@/lib/audit.server";

/**
 * Approved Google Drive documents as a knowledge source.
 *
 * Rules that shape this file:
 *  - Drive is a document / historical knowledge source, never the transactional
 *    CRM database. Nothing here writes to Drive and nothing here creates leads.
 *  - Agents get no direct Drive access. Only text extracted from folders an
 *    admin approved is indexed here, and only the matching extract is shown.
 *  - Every retrieval is audited with the actor and the documents used.
 *  - Answer priority is enforced by the caller: live CRM data first, verified
 *    website knowledge second, approved Drive documents third.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const CONFIG_ID = "drive_knowledge";
const MAX_FILES = 150;
const MAX_DEPTH = 3;
const DOC_CHARS = 8000;

/** Folders an admin has approved by default: documents and compliance only. */
export const DEFAULT_APPROVED_FOLDERS = [
  { id: "13hjp-gGSQjPWs3PZrnSMqUnWvF6LFO7u", name: "05 - Documents & Summaries (ডকুমেন্ট)" },
  { id: "1AKKDQCWwNCEKORn57rSx2ItuLZ3T_mFw", name: "07 - Audit & Compliance (অডিট)" },
];

const FOLDER_MIME = "application/vnd.google-apps.folder";

/** Text-bearing types we can extract. Recordings and images are skipped. */
const EXPORTABLE: Record<string, string> = {
  "application/vnd.google-apps.document": "text/plain",
  "application/vnd.google-apps.presentation": "text/plain",
  "application/vnd.google-apps.spreadsheet": "text/csv",
};

export type ApprovedFolder = { id: string; name: string };

export type DriveDoc = {
  fileId: string;
  name: string;
  folderName: string | null;
  webViewLink: string | null;
  content: string;
  indexedAt: string;
  modifiedTime: string | null;
};

export type DriveSource = {
  fileId: string;
  name: string;
  folderName: string | null;
  webViewLink: string | null;
  indexedAt: string;
};

function credentials() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const driveKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !driveKey) throw new Error("Google Drive সংযোগ কনফিগার করা হয়নি");
  return {
    Authorization: `Bearer ${lovableKey}`,
    "X-Connection-Api-Key": driveKey,
  };
}

export function driveConfigured(): boolean {
  return Boolean(process.env["LOVABLE_API_KEY"] && process.env["GOOGLE_DRIVE_API_KEY"]);
}

async function driveGet(path: string, query: Record<string, string>): Promise<Response> {
  const url = new URL(`${GATEWAY}${path}`);
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  const response = await fetch(url, {
    headers: credentials(),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const body = await response.text();
    console.error(`[drive] request failed [${response.status}]`, body.slice(0, 500));
    throw new Error(`Google Drive সাড়া দিচ্ছে না (${response.status})`);
  }
  return response;
}

export async function approvedFolders(): Promise<ApprovedFolder[]> {
  const { data } = await supabaseAdmin
    .from("app_config")
    .select("data")
    .eq("id", CONFIG_ID)
    .maybeSingle();
  const raw = (data?.data as { folders?: unknown } | null)?.folders;
  if (!Array.isArray(raw)) return DEFAULT_APPROVED_FOLDERS;
  const folders = raw
    .map((entry) => entry as { id?: unknown; name?: unknown })
    .filter((entry) => typeof entry.id === "string" && entry.id.length > 5)
    .map((entry) => ({
      id: entry.id as string,
      name: typeof entry.name === "string" ? entry.name : (entry.id as string),
    }));
  return folders.length > 0 ? folders : DEFAULT_APPROVED_FOLDERS;
}

export async function setApprovedFolders(folders: ApprovedFolder[]): Promise<void> {
  await supabaseAdmin.from("app_config").upsert({ id: CONFIG_ID, data: { folders } });
}

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
};

async function listChildren(folderId: string): Promise<DriveFile[]> {
  const response = await driveGet("/drive/v3/files", {
    q: `'${folderId.replace(/'/g, "")}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    pageSize: "200",
  });
  const body = (await response.json()) as { files?: DriveFile[] };
  return body.files ?? [];
}

/** Files inside an approved folder tree, folders walked to a small depth. */
async function walkFolder(
  folder: ApprovedFolder,
  depth = 0,
  budget = { left: MAX_FILES },
): Promise<{ file: DriveFile; folder: ApprovedFolder }[]> {
  if (depth > MAX_DEPTH || budget.left <= 0) return [];
  const children = await listChildren(folder.id);
  const collected: { file: DriveFile; folder: ApprovedFolder }[] = [];

  for (const child of children) {
    if (budget.left <= 0) break;
    if (child.mimeType === FOLDER_MIME) {
      collected.push(
        ...(await walkFolder({ id: child.id, name: child.name }, depth + 1, budget)),
      );
      continue;
    }
    if (!EXPORTABLE[child.mimeType] && !child.mimeType.startsWith("text/")) continue;
    budget.left -= 1;
    collected.push({ file: child, folder });
  }
  return collected;
}

async function extractText(file: DriveFile): Promise<string> {
  const exportType = EXPORTABLE[file.mimeType];
  const response = exportType
    ? await driveGet(`/drive/v3/files/${file.id}/export`, { mimeType: exportType })
    : await driveGet(`/drive/v3/files/${file.id}`, { alt: "media" });
  const text = await response.text();
  return text.replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

export type DriveRefreshResult = {
  folders: ApprovedFolder[];
  found: number;
  stored: number;
  skipped: number;
  at: string;
};

/** Read approved Drive folders into the CRM index. Read-only against Drive. */
export async function refreshDriveDocuments(actor?: {
  profileId?: string | null;
  label?: string | null;
}): Promise<DriveRefreshResult> {
  const folders = await approvedFolders();
  const budget = { left: MAX_FILES };
  const files: { file: DriveFile; folder: ApprovedFolder }[] = [];
  for (const folder of folders) {
    files.push(...(await walkFolder(folder, 0, budget)));
  }

  let stored = 0;
  let skipped = 0;
  for (const entry of files) {
    let content = "";
    try {
      content = await extractText(entry.file);
    } catch {
      skipped += 1;
      continue;
    }
    if (content.length < 80) {
      skipped += 1;
      continue;
    }
    const trimmed = content.slice(0, DOC_CHARS);
    const { error } = await supabaseAdmin.from("drive_documents").upsert(
      {
        file_id: entry.file.id,
        name: entry.file.name,
        mime_type: entry.file.mimeType,
        folder_id: entry.folder.id,
        folder_name: entry.folder.name,
        web_view_link: entry.file.webViewLink ?? null,
        modified_time: entry.file.modifiedTime ?? null,
        content: trimmed,
        word_count: trimmed.split(/\s+/).length,
        indexed_at: new Date().toISOString(),
      },
      { onConflict: "file_id" },
    );
    if (error) skipped += 1;
    else stored += 1;
  }

  await logAudit({
    action: "drive_knowledge_indexed",
    entityType: "drive_knowledge",
    actorProfileId: actor?.profileId ?? null,
    actorLabel: actor?.label ?? null,
    metadata: { folders: folders.map((f) => f.id), found: files.length, stored, skipped },
  });

  return { folders, found: files.length, stored, skipped, at: new Date().toISOString() };
}

export async function storedDriveDocs(limit = 60): Promise<DriveDoc[]> {
  const { data } = await supabaseAdmin
    .from("drive_documents")
    .select("file_id, name, folder_name, web_view_link, content, indexed_at, modified_time")
    .order("indexed_at", { ascending: false })
    .limit(limit);
  return (data ?? []).map((row) => ({
    fileId: row.file_id,
    name: row.name,
    folderName: row.folder_name,
    webViewLink: row.web_view_link,
    content: row.content,
    indexedAt: row.indexed_at,
    modifiedTime: row.modified_time,
  }));
}

function tokens(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length > 2)
    .slice(0, 12);
}

/** Keyword ranking over indexed documents; a zero score is dropped on purpose
 * so unrelated internal documents are never handed to the model. */
export function rankDriveDocs(docs: DriveDoc[], query: string, limit = 2): DriveDoc[] {
  const words = tokens(query);
  if (words.length === 0) return [];
  return docs
    .map((doc) => {
      const haystack = `${doc.name}\n${doc.content}`.toLowerCase();
      let score = 0;
      for (const word of words) {
        const hits = haystack.split(word).length - 1;
        if (hits > 0) score += Math.min(hits, 5) + (doc.name.toLowerCase().includes(word) ? 3 : 0);
      }
      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.doc);
}

/** Extracts for the question, plus an audit row naming who read what. */
export async function driveExtractsFor(input: {
  question: string;
  actorProfileId?: string | null;
  actorLabel?: string | null;
}): Promise<{ source: DriveSource; content: string }[]> {
  const docs = await storedDriveDocs();
  const picked = rankDriveDocs(docs, input.question);
  if (picked.length === 0) return [];

  await logAudit({
    action: "drive_knowledge_read",
    entityType: "drive_knowledge",
    actorProfileId: input.actorProfileId ?? null,
    actorLabel: input.actorLabel ?? null,
    metadata: { question: input.question.slice(0, 200), files: picked.map((doc) => doc.fileId) },
  });

  return picked.map((doc) => ({
    source: {
      fileId: doc.fileId,
      name: doc.name,
      folderName: doc.folderName,
      webViewLink: doc.webViewLink,
      indexedAt: doc.indexedAt,
    },
    content: doc.content,
  }));
}

export async function driveKnowledgeStatus() {
  const [{ count }, docs, folders] = await Promise.all([
    supabaseAdmin.from("drive_documents").select("id", { count: "exact", head: true }),
    storedDriveDocs(8),
    approvedFolders(),
  ]);
  return {
    connected: driveConfigured(),
    folders,
    documents: count ?? 0,
    lastIndexedAt: docs[0]?.indexedAt ?? null,
    recent: docs.map((doc) => ({
      fileId: doc.fileId,
      name: doc.name,
      folderName: doc.folderName,
      webViewLink: doc.webViewLink,
    })),
  };
}
