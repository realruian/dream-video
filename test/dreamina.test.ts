import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { extractDreaminaSubmitId, findNewestVideo } from "../src/dreamina.ts";

test("extracts Dreamina submit_id from JSON or plain output", () => {
  assert.equal(
    extractDreaminaSubmitId('{"submit_id":"task-123","gen_status":"processing"}'),
    "task-123",
  );
  assert.equal(extractDreaminaSubmitId("submit_id=abc_456 task_status=success"), "abc_456");
  assert.equal(extractDreaminaSubmitId("no task id here"), null);
});

test("finds the newest downloaded video recursively", async () => {
  const root = await mkdtemp(join(tmpdir(), "dreamina-test-"));
  try {
    await writeFile(join(root, "old.mp4"), "old");
    const nested = join(root, "result");
    await mkdir(nested);
    await new Promise((resolve) => setTimeout(resolve, 10));
    const newest = join(nested, "video.webm");
    await writeFile(newest, "new");
    await writeFile(join(nested, "ignore.jpg"), "image");
    assert.equal(await findNewestVideo(root), newest);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
