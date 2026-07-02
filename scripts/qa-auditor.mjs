import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const storiesDir = path.join(__dirname, "..", "docs", "stories");

function checkCompliance(content, fileName) {
  const issues = [];

  // Check if status is at least Ready for Review (or already DONE)
  const statusMatch = content.match(/## Status\n([^\n]+)/);
  const currentStatus = statusMatch ? statusMatch[1].trim() : "";
  if (!["Ready for Review", "DONE", "CONCERNS"].includes(currentStatus)) {
    issues.push(`Status atual é "${currentStatus}" (esperado: Ready for Review).`);
  }

  // Check unchecked tasks
  const hasUncheckedTasks = /-\s+\[ \]/g.test(content);
  if (hasUncheckedTasks) {
    issues.push(`Existem subtasks não concluídas (checkboxes vazias).`);
  }

  // Check Dev Agent Record
  const agentModelMatch = content.match(/### Agent Model Used\n([^\n]+)/);
  if (agentModelMatch && agentModelMatch[1].includes("_To be filled")) {
    issues.push(`Dev Agent Record: Agent Model não preenchido.`);
  }

  const debugLogMatch = content.match(/### Debug Log References\n([^\n]+)/);
  if (debugLogMatch && debugLogMatch[1].includes("_To be filled")) {
    issues.push(`Dev Agent Record: Debug Log não preenchido.`);
  }

  const notesMatch = content.match(/### Completion Notes List\n([^\n]+)/);
  if (notesMatch && notesMatch[1].includes("_To be filled")) {
    issues.push(`Dev Agent Record: Completion Notes não preenchido.`);
  }

  return issues;
}

function processStory(filePath) {
  const fileName = path.basename(filePath);
  if (!fileName.endsWith(".story.md")) return;

  let content = fs.readFileSync(filePath, "utf-8");
  const issues = checkCompliance(content, fileName);

  let newStatus = issues.length === 0 ? "DONE" : "CONCERNS";

  // Replace Status
  content = content.replace(/(## Status\n)([^\n]+)/, `$1${newStatus}`);

  // Generate QA Comments
  const qaComments =
    issues.length === 0
      ? "_QA: Verificação concluída. Todas as tasks marcadas, artefatos preenchidos e status validado. Story aprovada._"
      : `_QA: Story reprovada na checagem automática. Os seguintes problemas precisam ser resolvidos:_\n${issues.map((i) => `- ${i}`).join("\n")}`;

  // Replace QA Results
  if (content.includes("## QA Results")) {
    content = content.replace(/(## QA Results\n)([\s\S]*)/, `$1${qaComments}\n`);
  } else {
    content += `\n## QA Results\n${qaComments}\n`;
  }

  fs.writeFileSync(filePath, content, "utf-8");
  console.log(`[QA] ${fileName.padEnd(15)} -> ${newStatus} (${issues.length} issues)`);
}

function main() {
  console.log("Iniciando checagem QA nas stories...");
  const files = fs.readdirSync(storiesDir);
  for (const file of files) {
    processStory(path.join(storiesDir, file));
  }
  console.log("Checagem QA finalizada.");
}

main();
