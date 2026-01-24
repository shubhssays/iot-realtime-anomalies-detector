import { exec } from "child_process";
import { promisify } from "util";
import { rm, access } from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import fs from "fs";

// Correct way to import undici in ESM
import undiciPkg from "undici";
const { fetch, FormData, File } = undiciPkg;

const execPromise = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const flinkJobDir = join(__dirname, "..", "apps", "flink-job");
const targetDir = join(flinkJobDir, "target");

// Use whichever exists (shade plugin may rename)
const JAR_PRIMARY = join(targetDir, "flink-job-1.0-shaded.jar");
const JAR_FALLBACK = join(targetDir, "flink-job-1.0.jar");

const FLINK = "http://localhost:8081";

async function fileExists(p) {
    try { await access(p); return true; } catch { return false; }
}

async function findJar() {
    if (await fileExists(JAR_PRIMARY)) return JAR_PRIMARY;
    if (await fileExists(JAR_FALLBACK)) return JAR_FALLBACK;
    throw new Error("No Flink JAR found in target/");
}

async function main() {
    try {
        console.log("🧹 Cleaning target...");
        await rm(targetDir, { recursive: true, force: true });

        console.log("🔨 Building Flink job...");
        await execPromise("mvn clean package", { cwd: flinkJobDir });

        const jarPath = await findJar();
        console.log("📦 Using jar:", jarPath);

        const jobs = await fetch(`${FLINK}/jobs`).then(r => r.json());

        if (jobs.jobs.length > 0) {
            console.log("🛑 Cancelling running jobs...");
        }

        for (const j of jobs.jobs) {
            console.log("Cancelled", j.id);
            await fetch(`${FLINK}/jobs/${j.id}`, { method: "PATCH" });
        }

        console.log("📤 Uploading jar to Flink...");

        const jarBuffer = fs.readFileSync(jarPath);
        const form = new FormData();
        form.append("jarfile", new Blob([jarBuffer]), "flink-job.jar");

        const uploadRes = await fetch(`${FLINK}/jars/upload`, {
            method: "POST",
            body: form
        });

        const upload = await uploadRes.json();

        let jarId;
        if (upload.filename) {
            jarId = upload.filename.split("/").pop();
        } else if (upload.files && upload.files.length) {
            jarId = upload.files[0].id;
        } else {
            throw new Error("Upload failed: " + JSON.stringify(upload));
        }

        console.log("🚀 Running job...");
        await fetch(`${FLINK}/jars/${jarId}/run`, { method: "POST" });

        console.log("✅ Flink job deployed successfully!");
        console.log("UI → http://localhost:8081");

    } catch (e) {
        console.error("❌ Deployment failed:", e.message);
    }
}

main();
