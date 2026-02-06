import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { execSync } from "node:child_process";
import { parse as parseYaml } from "yaml";

const ROOT = resolve(import.meta.dirname, "..");
const LEXICONS_DIR = join(ROOT, "src", "lexicons");
const TMP_DIR = join(ROOT, "tmp-lexicons");
const OUT_DIR = join(ROOT, "src", "generated");

rmSync(TMP_DIR, { recursive: true, force: true });
mkdirSync(TMP_DIR, { recursive: true });
rmSync(OUT_DIR, { recursive: true, force: true });
mkdirSync(OUT_DIR, { recursive: true });

const files = readdirSync(LEXICONS_DIR).filter((f) => f.endsWith(".yaml"));

for (const file of files) {
  const yaml = readFileSync(join(LEXICONS_DIR, file), "utf-8");
  const json = parseYaml(yaml);
  const jsonFile = file.replace(/\.yaml$/, ".json");
  writeFileSync(join(TMP_DIR, jsonFile), JSON.stringify(json, null, 2));
}

const lexCli = join(ROOT, "node_modules", ".bin", "lex");

execSync(`${lexCli} gen-api --yes ${OUT_DIR} ${TMP_DIR}/*.json`, {
  stdio: "inherit",
  cwd: ROOT,
});

rmSync(TMP_DIR, { recursive: true, force: true });

const generatedIndex = join(OUT_DIR, "index.ts");
const content = readFileSync(generatedIndex, "utf-8");

const atprotoImport = `import type {
  ComAtprotoRepoListRecords,
  ComAtprotoRepoGetRecord,
  ComAtprotoRepoCreateRecord,
  ComAtprotoRepoPutRecord,
  ComAtprotoRepoDeleteRecord,
} from '@atproto/api'
`;

const patched = content.replace(
  "import { schemas }",
  `${atprotoImport}\nimport { schemas }`,
);

writeFileSync(generatedIndex, patched);
