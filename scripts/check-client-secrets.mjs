import fs from "node:fs";
import path from "node:path";

const clientOutputDir = path.join(process.cwd(), ".next", "static");
const forbiddenPatterns = [
  "LDC_CLIENT_SECRET",
  "LDC_ED25519_PRIVATE_KEY_PKCS8_BASE64",
  "MC4CAQAwBQYDK2VwBCIEIJ1hsZ3v",
];

if (!fs.existsSync(clientOutputDir)) {
  console.error("未找到 .next/static，请先运行 pnpm build");
  process.exit(1);
}

const matches = [];

function scanDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
      continue;
    }

    const content = fs.readFileSync(fullPath);
    for (const pattern of forbiddenPatterns) {
      if (content.includes(Buffer.from(pattern))) {
        matches.push(`${path.relative(process.cwd(), fullPath)}: ${pattern}`);
      }
    }
  }
}

scanDirectory(clientOutputDir);

if (matches.length > 0) {
  console.error("客户端构建产物包含支付凭证标识：");
  for (const match of matches) console.error(`- ${match}`);
  process.exit(1);
}

console.log("客户端构建产物未发现支付凭证标识");
