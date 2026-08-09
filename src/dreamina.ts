/**
 * Video generation through the official Dreamina CLI.
 *
 * Seedance 2.5 accepts multiple image references, which maps directly to this
 * project's first / middle / last scene frames. The CLI owns authentication,
 * upload, polling, and download; this adapter only supplies explicit args and
 * returns the downloaded media path to the runner.
 */

import { spawn } from "node:child_process";
import { mkdtemp, readdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import type { GrokRunResult } from "./grok.ts";

export const DREAMINA_BIN = process.env.CANVAS_DREAMINA_BIN ?? "dreamina";
export const DREAMINA_MODEL = process.env.CANVAS_DREAMINA_MODEL ?? "seedance2.5";
export const DREAMINA_RESOLUTION = process.env.CANVAS_DREAMINA_RESOLUTION ?? "720p";

const VIDEO_EXTS = new Set([".mp4", ".mov", ".webm"]);

function pollSeconds(): number {
  const parsed = Number(process.env.CANVAS_DREAMINA_POLL_SECONDS ?? "900");
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 900;
}

function execDreamina(
  args: string[],
  cwd: string,
  timeoutMs: number,
): Promise<{ code: number; output: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(DREAMINA_BIN, args, {
      cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    const onData = (chunk: Buffer) => {
      output += chunk.toString();
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Dreamina timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);

    child.on("error", (err) => {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes("ENOENT")) {
        reject(
          new Error(
            `Dreamina CLI not found ("${DREAMINA_BIN}"). Install it, put it on PATH, ` +
              `then run \`dreamina login\`. Override the binary with CANVAS_DREAMINA_BIN.`,
          ),
        );
        return;
      }
      reject(err);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, output });
    });
  });
}

/** Extract a task id from either JSON or the CLI's human-readable output. */
export function extractDreaminaSubmitId(output: string): string | null {
  const match = /["']?submit_id["']?\s*[:=]\s*["']?([A-Za-z0-9_-]+)/i.exec(output);
  return match?.[1] ?? null;
}

export async function findNewestVideo(dir: string): Promise<string | null> {
  const videos: Array<{ path: string; mtime: number }> = [];

  async function walk(current: string): Promise<void> {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
        continue;
      }
      if (!entry.isFile() || !VIDEO_EXTS.has(extname(entry.name).toLowerCase())) continue;
      try {
        const info = await stat(path);
        videos.push({ path, mtime: info.mtimeMs });
      } catch {
        // Ignore files that disappear while the CLI is finishing a download.
      }
    }
  }

  await walk(dir);
  videos.sort((a, b) => b.mtime - a.mtime);
  return videos[0]?.path ?? null;
}

function blockedByAccount(output: string): boolean {
  return /AigcComplianceConfirmationRequired|VIP|not logged in|login required|permission denied/i.test(
    output,
  );
}

export interface DreaminaAnimateInput {
  prompt: string;
  imagePaths: string[];
  aspect: string;
  duration: 6 | 10;
  cwd: string;
}

export async function animateWithDreamina(
  input: DreaminaAnimateInput,
): Promise<GrokRunResult> {
  if (input.imagePaths.length === 0) {
    return {
      ok: false,
      mediaPath: null,
      text: "",
      blocked: false,
      message: "Dreamina video generation requires at least one image.",
      costUsd: 0,
      turns: 0,
    };
  }

  const poll = pollSeconds();
  const args = [
    "multimodal2video",
    ...input.imagePaths.flatMap((path) => ["--image", path]),
    "--prompt",
    input.prompt,
    "--duration",
    String(input.duration),
    "--ratio",
    input.aspect,
    "--video_resolution",
    DREAMINA_RESOLUTION,
    "--model_version",
    DREAMINA_MODEL,
    "--poll",
    String(poll),
  ];

  let submitted: { code: number; output: string };
  try {
    submitted = await execDreamina(args, input.cwd, (poll + 180) * 1000);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      mediaPath: null,
      text: message,
      blocked: false,
      message,
      costUsd: 0,
      turns: 1,
    };
  }

  const submitId = extractDreaminaSubmitId(submitted.output);
  if (submitted.code !== 0 || !submitId) {
    const message =
      submitted.output.slice(0, 1200) ||
      `Dreamina exited ${submitted.code} without returning a submit_id.`;
    return {
      ok: false,
      mediaPath: null,
      text: submitted.output,
      blocked: blockedByAccount(message),
      message,
      costUsd: 0,
      turns: 1,
    };
  }

  const downloadDir = await mkdtemp(join(tmpdir(), "canvas-dreamina-"));
  let queried: { code: number; output: string };
  try {
    queried = await execDreamina(
      ["query_result", "--submit_id", submitId, "--download_dir", downloadDir],
      input.cwd,
      3 * 60_000,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      mediaPath: null,
      text: `${submitted.output}\n${message}`,
      blocked: false,
      message,
      costUsd: 0,
      turns: 2,
    };
  }

  const mediaPath = await findNewestVideo(downloadDir);
  if (queried.code !== 0 || !mediaPath) {
    const combined = `${submitted.output}\n${queried.output}`.trim();
    const message =
      queried.output.slice(0, 1200) ||
      `Dreamina task ${submitId} completed without a downloaded video.`;
    return {
      ok: false,
      mediaPath: null,
      text: combined,
      blocked: blockedByAccount(message),
      message,
      costUsd: 0,
      turns: 2,
    };
  }

  return {
    ok: true,
    mediaPath,
    text: `${submitted.output}\n${queried.output}`.slice(0, 2000),
    blocked: false,
    message: null,
    costUsd: 0,
    turns: 2,
  };
}

export async function dreaminaAvailable(): Promise<boolean> {
  try {
    const { code } = await execDreamina(["--version"], process.cwd(), 15_000);
    return code === 0;
  } catch {
    return false;
  }
}
