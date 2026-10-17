// Text-only DIRECT brains: keep image/PDF content out of the request.
//
// Claude Code's Read tool returns an image block for .png/.jpg/.jpeg/.gif/.webp and a document
// block for .pdf, whatever the model — Claude Code 2.1.281 has no "no image input" capability
// or setting (checked in the bundle). A text-only vLLM model then fails the whole run with
// HTTP 400 "At most 0 image(s) may be provided in one prompt". Claude Code does not recover.
//
// Fix: deny those Reads through Claude Code's own permission rules, passed with --settings. A
// denied Read comes back to the model as a tool error and the run continues. The rules match
// case-insensitively and hold in every permission mode, --dangerously-skip-permissions included
// (verified with a local fake /v1/messages server).
// Not covered: an image file with NO extension (Read sniffs its bytes) and images from MCP tools.

export const MEDIA_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "pdf"] as const;

/** Permission deny rules for every image/PDF Read. */
export function textOnlyDenyRules(): string[] {
  return MEDIA_EXTENSIONS.map((e) => `Read(**/*.${e})`);
}

/** Claude Code args that keep image/PDF content out of a text-only brain's requests. */
export function textOnlyArgs(): string[] {
  return ["--settings", JSON.stringify({ permissions: { deny: textOnlyDenyRules() } })];
}

/** Told to a delegated worker so a denied Read isn't a surprise. */
export const TEXT_ONLY_NOTE =
  "This model is text-only: image and PDF files cannot be read (Read of them is denied) — work from text files only.";
