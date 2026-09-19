import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
export const projectRoot = resolve(scriptDirectory, "..");
const handbookDirectory = resolve(projectRoot, "docs/book-handbook");
const dataDirectory = resolve(handbookDirectory, "data");

const sourceKindLabels = {
  BOOK_DIRECT: "书中直接表述",
  BOOK_CASE: "书中病例",
  BOOK_QUOTED_GUIDE: "书中引用资料",
  EDITOR_SUMMARY: "整理者概括",
  SAFETY_NOTE: "安全提示"
};

const applicabilityLabels = {
  GENERAL_KNOWLEDGE: "一般知识",
  HEALTHY_ADULTS: "健康成年人",
  SPECIFIC_POPULATION: "特定人群",
  DISEASE_SPECIFIC: "疾病情境",
  SAFETY_ONLY: "仅安全提示"
};

const coverageLabels = {
  NOT_STARTED: "未开始",
  PARTIAL: "部分整理",
  VERIFIED: "已核对",
  NOT_APPLICABLE: "不适用"
};

function escapeTableCell(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\n", "<br>");
}

export async function readClaims() {
  const text = await readFile(resolve(dataDirectory, "claims.jsonl"), "utf8");
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line));
}

export async function readCoverage() {
  const text = await readFile(resolve(dataDirectory, "coverage.json"), "utf8");
  return JSON.parse(text);
}

export async function readBooks() {
  const text = await readFile(resolve(dataDirectory, "books.json"), "utf8");
  return JSON.parse(text);
}

function semanticReviews(claim) {
  return (claim.sources ?? []).flatMap((source) =>
    (source.evidenceFragments ?? []).flatMap((fragment) =>
      (fragment.evidenceBindings ?? [])
        .filter((binding) => binding.semanticReview)
        .map((binding) => ({ source, fragment, binding }))
    )
  );
}

export function isPublishableClaim(claim) {
  return (
    ["DIRECT_TEXT_CHECKED", "DOUBLE_CHECKED"].includes(
      claim.verificationStatus
    ) &&
    !semanticReviews(claim).some(
      ({ binding }) =>
        binding.semanticReview.status === "HUMAN_REVIEW_REQUIRED"
    )
  );
}

export function buildNumericReference(claims) {
  const numericClaims = claims.filter(
    (claim) =>
      ["NUMERIC", "FORMULA"].includes(claim.claimType) &&
      isPublishableClaim(claim) &&
      claim.referenceLabel &&
      claim.referenceValue
  );
  const lines = [
    "<!-- 此文件由 scripts/generate-book-handbook.mjs 生成，请修改 data/claims.jsonl 后重新生成。 -->",
    "# 数值、公式与比例速查",
    "",
    "[返回手册目录](README.md)",
    "",
    "本页只汇总已在原书中核对过的数字。不同章节、对象或引用来源的口径可能不同，不能脱离适用范围直接套用。",
    "",
    "| 主题 | 知识点 | 书中数值或公式 | 性质 | 适用范围 |",
    "|---|---|---|---|---|"
  ];

  for (const claim of numericClaims) {
    lines.push(
      `| ${escapeTableCell(claim.topic)} | ${escapeTableCell(claim.referenceLabel)} | ${escapeTableCell(claim.referenceValue)} | ${sourceKindLabels[claim.sourceKind]} | ${applicabilityLabels[claim.applicability]} |`
    );
  }

  lines.push(
    "",
    "## 使用提醒",
    "",
    "- 表中数值是对原书内容的忠实整理，不自动代表当前最新版医学指南。",
    "- 同一主题若出现多个口径，应结合章节对象和[冲突与缺口](conflicts-and-gaps.md)理解。",
    "- 疾病、用药及营养素限制问题不能只凭本表自行处理。",
    ""
  );

  return lines.join("\n");
}

export function buildCoverageMatrix(coverage) {
  const lines = [
    "<!-- 此文件由 scripts/generate-book-handbook.mjs 生成，请修改 data/coverage.json 后重新生成。 -->",
    "# 原书覆盖矩阵",
    "",
    "[返回手册目录](README.md)",
    "",
    "覆盖状态分开记录目录、核心原则、关键数字和全部知识点，避免用笼统的“已整理”掩盖尚未逐条核对的内容。",
    "",
    "## 状态说明",
    "",
    "| 状态 | 含义 |",
    "|---|---|"
  ];

  for (const [status, description] of Object.entries(coverage.statusDefinitions)) {
    lines.push(`| ${coverageLabels[status]} | ${escapeTableCell(description)} |`);
  }

  for (const book of coverage.books) {
    lines.push(
      "",
      `## ${book.bookTitle}`,
      "",
      "| 原书范围 | 手册入口 | 读者概要 | 审计目录 | 审计原则 | 审计数字 | 审计全部 | 说明 |",
      "|---|---|---|---|---|---|---|---|"
    );

    for (const section of book.sections) {
      const targets = section.handbookTargets
        .map((target) =>
          target.endsWith("/") ? `\`${target}\`` : `[${target}](${target})`
        )
        .join("、");
      const sourceRange = `${section.section}<br>${section.epubRange}`;
      const readerCoverage = [
        `目录${coverageLabels[section.readerCoverage.outline]}`,
        `原则${coverageLabels[section.readerCoverage.corePrinciples]}`,
        `数字${coverageLabels[section.readerCoverage.numericClaims]}`
      ].join("、");
      const auditCell = (dimension) => {
        const count = dimension.includedClaimIds?.length;
        const outlineCount = dimension.expectedOutlineEntries?.reduce(
          (total, entry) => total + entry.expectedCount,
          0
        );
        const suffix = count
          ? `（${count}条）`
          : outlineCount
            ? `（${outlineCount}项NCX）`
            : "";
        return `${coverageLabels[dimension.status]}${suffix}`;
      };
      lines.push(
        `| ${escapeTableCell(sourceRange)} | ${targets || "—"} | ${readerCoverage} | ${auditCell(section.auditedCoverage.outline)} | ${auditCell(section.auditedCoverage.corePrinciples)} | ${auditCell(section.auditedCoverage.numericClaims)} | ${auditCell(section.auditedCoverage.allClaims)} | ${escapeTableCell(section.note)} |`
      );
    }
  }

  lines.push(
    "",
    "## 维护规则",
    "",
    "- 只有完成对应维度的原文复核，才能把该维度改为“已核对”。",
    "- “核心原则已核对”不等于“全部知识点已核对”。",
    "- 读者概要覆盖表示Markdown已整理到什么程度，机器审计覆盖由NCX清单和[data/claims.jsonl](data/claims.jsonl)约束。",
    ""
  );

  return lines.join("\n");
}

function toLearningCard(claim) {
  return {
    id: claim.id,
    coverageSectionId: claim.coverageSectionId,
    topic: claim.topic,
    question: claim.question,
    answer: claim.statement,
    claimType: claim.claimType,
    sourceKind: claim.sourceKind,
    applicability: claim.applicability,
    verificationStatus: claim.verificationStatus,
    verifiedAt: claim.verifiedAt,
    sources: claim.sources,
    conflicts: claim.conflicts,
    notes: claim.notes
  };
}

export function buildLearningCards(claims) {
  const cards = claims.filter(isPublishableClaim).map(toLearningCard);

  return `${JSON.stringify(cards, null, 2)}\n`;
}

export function buildDraftLearningCards(claims) {
  const cards = claims.filter((claim) => !isPublishableClaim(claim)).map(toLearningCard);

  return `${JSON.stringify(cards, null, 2)}\n`;
}

export function buildManualReview(claims) {
  const pendingClaims = claims
    .map((claim) => ({
      claim,
      reviews: semanticReviews(claim).filter(
        ({ binding }) =>
          binding.semanticReview.status === "HUMAN_REVIEW_REQUIRED"
      )
    }))
    .filter(({ reviews }) => reviews.length > 0);
  const reviewCount = pendingClaims.reduce(
    (total, { reviews }) => total + reviews.length,
    0
  );
  const lines = [
    "<!-- 此文件由 scripts/generate-book-handbook.mjs 生成，请修改 data/claims.jsonl 后重新生成。 -->",
    "# 人工复核清单",
    "",
    "[返回手册目录](README.md)",
    "",
    `当前有 ${pendingClaims.length} 条知识、${reviewCount} 项证据关系等待人工复核。`,
    "",
    "复核时只需判断整理结论是否得到所列原文支持。人工状态不会绕过数字、对象、单位、比较方向或位置契约；确认后仍须通过 `npm run book:verify` 才能进入正式产物。",
    ""
  ];

  for (const { claim, reviews } of pendingClaims) {
    lines.push(
      `## ${claim.id} ${claim.topic}`,
      "",
      `- 待确认结论：${claim.statement}`,
      `- 当前知识状态：${claim.verificationStatus}`,
      `- 待复核项：${reviews.length} 项`,
      ""
    );
    for (const [index, { source, fragment, binding }] of reviews.entries()) {
      const assertionIds =
        binding.kind === "CONTIGUOUS"
          ? [binding.assertionId]
          : (binding.items ?? []).map((item) => item.assertionId);
      lines.push(
        `### ${index + 1}. ${assertionIds.join("、")}`,
        "",
        `- 原书位置：《${source.bookTitle}》／${source.part}／${source.chapter}／${source.epubFile}（目录 ${source.tocPosition}/${source.tocTotal}）`,
        `- 待复核原因：${binding.semanticReview.reason}`,
        "- 当前严格绑定跨度：",
        "",
        `> ${binding.span.text.replaceAll("\n", " ")}`,
        "",
        "- 完整原文片段：",
        "",
        `> ${fragment.text.replaceAll("\n", " ")}`,
        ""
      );
    }
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

export async function generateHandbookArtifacts() {
  const [claims, coverage] = await Promise.all([readClaims(), readCoverage()]);
  const generatedDirectory = resolve(handbookDirectory, "generated");
  await mkdir(generatedDirectory, { recursive: true });
  await Promise.all([
    writeFile(
      resolve(handbookDirectory, "numeric-reference.md"),
      buildNumericReference(claims),
      "utf8"
    ),
    writeFile(
      resolve(handbookDirectory, "coverage-matrix.md"),
      buildCoverageMatrix(coverage),
      "utf8"
    ),
    writeFile(
      resolve(generatedDirectory, "learning-cards.json"),
      buildLearningCards(claims),
      "utf8"
    ),
    writeFile(
      resolve(generatedDirectory, "learning-cards-draft.json"),
      buildDraftLearningCards(claims),
      "utf8"
    ),
    writeFile(
      resolve(handbookDirectory, "manual-review.md"),
      buildManualReview(claims),
      "utf8"
    )
  ]);

  return { claimCount: claims.length };
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  const { claimCount } = await generateHandbookArtifacts();
  console.log(`已生成手册派生文件，共 ${claimCount} 条已结构化知识。`);
}
