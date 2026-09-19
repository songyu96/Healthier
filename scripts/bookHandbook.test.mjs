import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { afterAll, describe, expect, it } from "vitest";
import {
  buildDraftLearningCards,
  buildLearningCards,
  buildManualReview,
  buildNumericReference,
  isPublishableClaim
} from "./generate-book-handbook.mjs";
import {
  collectClaimAssertionIssues,
  collectCoverageConsistencyIssues,
  collectEvidenceBindingStats,
  collectSchemaIssues
} from "./verify-book-handbook.mjs";

const temporaryDirectories = [];
const pendingReviewClaimIds = [
  "B1-ENERGY-004",
  "B1-FAT-003",
  "B1-FAT-008",
  "B1-WATER-002",
  "B1-FOOD-007",
  "B1-FOOD-012",
  "B1-ACTIVITY-001",
  "B1-BREAKFAST-002",
  "B1-BREAKFAST-004"
];

function makeSpan(sourceText, text) {
  const start = sourceText.indexOf(text);
  if (start < 0) throw new Error(`测试证据中找不到子串：${text}`);
  return { start, end: start + text.length, text };
}

function makeContiguousBinding(sourceText, assertionId, spanText = sourceText) {
  return {
    id: "b1",
    kind: "CONTIGUOUS",
    assertionId,
    span: makeSpan(sourceText, spanText)
  };
}

function replaceContiguousEvidence(fragment, sourceText, spanText = sourceText) {
  fragment.text = sourceText;
  fragment.evidenceBindings[0].span = makeSpan(sourceText, spanText);
}

function makeSaltClaim(statement, referenceValue) {
  const evidenceText = "成人每天食盐不超过6克。";
  const evidenceSpanText = "成人每天食盐不超过6克";
  return {
    id: "B1-FOOD-TEST",
    claimType: "NUMERIC",
    statement,
    referenceLabel: "食盐",
    referenceValue,
    verificationStatus: "DIRECT_TEXT_CHECKED",
    sources: [
      {
        evidenceFragments: [
          {
            id: "e1",
            text: evidenceText,
            assertions: [
              {
                id: "salt-limit",
                kind: "QUANTITY",
                claimScope: "BOTH",
                subject: "食盐",
                value: 6,
                unit: "克",
                comparator: "LTE",
                timeBasis: "DAY",
                targetFragments: {
                  statement,
                  referenceValue: `食盐：${referenceValue}`
                }
              }
            ],
            evidenceBindings: [
              makeContiguousBinding(evidenceText, "salt-limit", evidenceSpanText)
            ]
          }
        ]
      }
    ]
  };
}

async function readHandbookClaims() {
  return (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
    .trim()
    .split(/\r?\n/u)
    .map((line) => JSON.parse(line));
}

async function makeCholesterolBypassClaim(reviewStatus) {
  const claims = await readHandbookClaims();
  const claim = structuredClone(claims.find(({ id }) => id === "B1-FAT-009"));
  const fragment = claim.sources[0].evidenceFragments[0];
  const assertion = fragment.assertions[0];
  Object.assign(assertion, {
    kind: "QUANTITY",
    subject: "肝脏合成",
    value: 1000,
    unit: "毫克",
    comparator: "EQ",
    timeBasis: "DAY"
  });
  delete assertion.min;
  delete assertion.max;
  claim.statement = "书中给出的每日肝脏合成量是1000毫克。";
  claim.referenceLabel = "肝脏合成";
  claim.referenceValue = "1000毫克/日";
  assertion.targetFragments = {
    statement: "每日肝脏合成量是1000毫克",
    referenceValue: "肝脏合成：1000毫克/日"
  };
  const binding = fragment.evidenceBindings[0];
  binding.span = { start: 0, end: fragment.text.length, text: fragment.text };
  binding.semanticReview = {
    status: reviewStatus,
    reason: "测试人工状态不能放宽额外测量表达或原子性检查。",
    ...(reviewStatus === "HUMAN_REVIEWED"
      ? { reviewedAt: "2026-09-08" }
      : {})
  };
  return claim;
}

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.map((directory) => rm(directory, { recursive: true, force: true }))
  );
});

describe("book handbook quality gate", () => {
  it("默认缺少 EPUB 时失败，显式结构模式准确说明跳过原文核验", async () => {
    const emptyDirectory = await mkdtemp(join(tmpdir(), "healthier-book-verify-"));
    temporaryDirectories.push(emptyDirectory);
    const verifier = resolve("scripts/verify-book-handbook.mjs");
    const environment = { ...process.env, BOOK_HANDBOOK_EPUB_DIR: emptyDirectory };
    const strictResult = spawnSync(process.execPath, [verifier], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: environment
    });
    expect(strictResult.status).not.toBe(0);
    expect(`${strictResult.stdout}${strictResult.stderr}`).toContain("严格核验不能跳过原书");

    const structuralResult = spawnSync(
      process.execPath,
      [verifier, "--allow-missing-epub"],
      { cwd: process.cwd(), encoding: "utf8", env: environment }
    );
    expect(structuralResult.status).toBe(0);
    expect(structuralResult.stdout).toContain("结构校验通过");
    expect(structuralResult.stdout).toContain("原文校验跳过");
    expect(structuralResult.stdout).toContain("CONTIGUOUS 59 条");
    expect(structuralResult.stdout).toContain("ORDERED_LIST 4 组/11 条断言");
    expect(structuralResult.stdout).toContain("人工语义复核待办 12 条");
  });

  it("6克不能被改成6毫克", () => {
    const issues = collectClaimAssertionIssues(
      makeSaltClaim("成人每日食盐不超过6毫克。", "≤6毫克/日")
    );
    expect(issues.join(" ")).toContain("未绑定到 6克");
  });

  it("不超过6克不能被改成无方向的6克", () => {
    const issues = collectClaimAssertionIssues(
      makeSaltClaim("成人每日食盐为6克。", "6克/日")
    );
    expect(issues.join(" ")).toContain("未绑定到 6克");
  });

  it("只反转ω-3与ω-6对象时也必须失败", () => {
    const claim = {
      id: "B1-FAT-TEST",
      claimType: "NUMERIC",
      statement: "书中给出的较好比例是ω-6∶ω-3＝1∶4～6。",
      referenceLabel: "ω-6与ω-3",
      referenceValue: "ω-6∶ω-3＝1∶4～6",
      verificationStatus: "DOUBLE_CHECKED",
      sources: [
        {
          evidenceFragments: [
            {
              id: "e1",
              text: "必需脂肪酸最佳比例：ω-3∶ω-6要调整为1∶4～6",
              assertions: [
                {
                  id: "omega-ratio",
                  kind: "RATIO",
                  claimScope: "BOTH",
                  subjects: ["ω-3", "ω-6"],
                  ratioValues: ["1", "4～6"],
                  targetFragments: {
                    statement: "书中给出的较好比例是ω-6∶ω-3＝1∶4～6。",
                    referenceValue: "ω-6与ω-3：ω-6∶ω-3＝1∶4～6"
                  }
                }
              ],
              evidenceBindings: [
                makeContiguousBinding(
                  "必需脂肪酸最佳比例：ω-3∶ω-6要调整为1∶4～6",
                  "omega-ratio"
                )
              ]
            }
          ]
        }
      ]
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("比例对象");
  });

  it("多数字结论不能交换各自的比较方向", () => {
    const claim = {
      id: "B1-SUGAR-TEST",
      claimType: "NUMERIC",
      statement: "添加糖每日低于50克；添加糖每日最好不超过25克。",
      referenceLabel: "添加糖",
      referenceValue: "添加糖低于50克/日；添加糖最好不超过25克/日",
      verificationStatus: "DIRECT_TEXT_CHECKED",
      sources: [
        {
          evidenceFragments: [
            {
              id: "e1",
              text: "控制添加糖的摄入量，每天摄入不超过50克，最好控制在25克以下；",
              assertions: [
                {
                  id: "sugar-max",
                  kind: "QUANTITY",
                  claimScope: "BOTH",
                  subject: "添加糖",
                  value: 50,
                  unit: "克",
                  comparator: "LTE",
                  timeBasis: "DAY",
                  targetFragments: {
                    statement: "添加糖每日低于50克",
                    referenceValue: "添加糖低于50克/日"
                  }
                },
                {
                  id: "sugar-preferred",
                  kind: "QUANTITY",
                  claimScope: "BOTH",
                  subject: "添加糖",
                  value: 25,
                  unit: "克",
                  comparator: "LT",
                  timeBasis: "DAY",
                  targetFragments: {
                    statement: "添加糖每日最好不超过25克",
                    referenceValue: "添加糖最好不超过25克/日"
                  }
                }
              ],
              evidenceBindings: [
                {
                  ...makeContiguousBinding(
                    "控制添加糖的摄入量，每天摄入不超过50克，最好控制在25克以下；",
                    "sugar-max",
                    "控制添加糖的摄入量，每天摄入不超过50克"
                  ),
                  id: "b1"
                },
                {
                  ...makeContiguousBinding(
                    "控制添加糖的摄入量，每天摄入不超过50克，最好控制在25克以下；",
                    "sugar-preferred",
                    "控制添加糖的摄入量，每天摄入不超过50克，最好控制在25克以下"
                  ),
                  id: "b2",
                  semanticReview: {
                    status: "HUMAN_REVIEW_REQUIRED",
                    reason: "第二个数值沿用前文添加糖主语和每日口径。"
                  }
                }
              ]
            }
          ]
        }
      ]
    };
    const issues = collectClaimAssertionIssues(claim).join(" ");
    expect(issues).toContain("sugar-max");
    expect(issues).toContain("sugar-preferred");
  });

  it("多数字结论不能借用另一个数字的单位", () => {
    const claim = makeSaltClaim(
      "成人每日食盐不超过6毫克且另有调味料25克。",
      "食盐不超过6毫克/日且另有调味料25克"
    );
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("未绑定到 6克");
  });

  it("约300克不能改成不超过300克", () => {
    const claim = {
      id: "B1-MILK-TEST",
      claimType: "NUMERIC",
      statement: "奶制品摄入量不超过每日300克液态奶。",
      referenceLabel: "奶类",
      referenceValue: "不超过300克液态奶/日",
      verificationStatus: "DOUBLE_CHECKED",
      sources: [
        {
          evidenceFragments: [
            {
              id: "e1",
              text: "吃各种各样的奶制品，相当于应该每天摄入300克液态奶；",
              assertions: [
                {
                  id: "milk",
                  kind: "QUANTITY",
                  claimScope: "BOTH",
                  subject: "液态奶",
                  value: 300,
                  unit: "克",
                  comparator: "EQ",
                  targetComparators: {
                    statement: {
                      comparator: "APPROX",
                      reason: "原文为定值，摘要使用约数表达执行口径。"
                    },
                    referenceValue: {
                      comparator: "APPROX",
                      reason: "原文为定值，摘要使用约数表达执行口径。"
                    }
                  },
                  timeBasis: "DAY",
                  targetFragments: {
                    statement: "奶制品摄入量不超过每日300克液态奶。",
                    referenceValue: "奶类：不超过300克液态奶/日"
                  }
                }
              ],
              evidenceBindings: [
                makeContiguousBinding(
                  "吃各种各样的奶制品，相当于应该每天摄入300克液态奶；",
                  "milk"
                )
              ]
            }
          ]
        }
      ]
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("未绑定到 300克");
  });

  it("三元比例不能把饱和脂肪酸替换为反式脂肪酸", () => {
    const claim = {
      id: "B1-FAT-RATIO-TEST",
      claimType: "NUMERIC",
      statement: "反式、单不饱和和多不饱和脂肪酸的比例为3∶4∶3。",
      referenceLabel: "反式、单不饱和、多不饱和脂肪酸",
      referenceValue: "3∶4∶3",
      verificationStatus: "DIRECT_TEXT_CHECKED",
      sources: [
        {
          evidenceFragments: [
            {
              id: "e1",
              text: "饱和脂肪酸、单不饱和脂肪酸和多不饱和脂肪酸之间更加推荐的比例是3∶4∶3。",
              assertions: [
                {
                  id: "fat-ratio",
                  kind: "RATIO",
                  claimScope: "BOTH",
                  subjects: ["饱和脂肪酸", "单不饱和脂肪酸", "多不饱和脂肪酸"],
                  ratioValues: ["3", "4", "3"],
                  targetFragments: {
                    statement: "反式、单不饱和和多不饱和脂肪酸的比例为3∶4∶3。",
                    referenceValue: "反式、单不饱和、多不饱和脂肪酸：3∶4∶3"
                  }
                }
              ],
              evidenceBindings: [
                makeContiguousBinding(
                  "饱和脂肪酸、单不饱和脂肪酸和多不饱和脂肪酸之间更加推荐的比例是3∶4∶3。",
                  "fat-ratio"
                )
              ]
            }
          ]
        }
      ]
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("比例对象");
  });

  it("EQ不能接受数值附近出现方向性比较符", () => {
    const claim = makeSaltClaim("成人每日食盐不超过6克。", "不超过6克/日");
    const assertion = claim.sources[0].evidenceFragments[0].assertions[0];
    assertion.comparator = "EQ";
    replaceContiguousEvidence(
      claim.sources[0].evidenceFragments[0],
      "成人每天食盐为6克。",
      "成人每天食盐为6克"
    );
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("未绑定到 6克");
  });

  it("只修改公式左侧时必须失败", () => {
    const claim = {
      id: "B1-ENERGY-TEST",
      claimType: "FORMULA",
      statement: "错误指标＝身高（厘米）－105。",
      referenceLabel: "标准体重",
      referenceValue: "身高（厘米）－105",
      verificationStatus: "DIRECT_TEXT_CHECKED",
      sources: [
        {
          evidenceFragments: [
            {
              id: "e1",
              text: "标准体重=身高（厘米）－105。",
              assertions: [
                {
                  id: "standard-weight",
                  kind: "FORMULA",
                  claimScope: "BOTH",
                  expression: "标准体重=身高（厘米）－105",
                  targetFragments: {
                    statement: "错误指标＝身高（厘米）－105。",
                    referenceValue: "标准体重：身高（厘米）－105"
                  }
                }
              ],
              evidenceBindings: [
                makeContiguousBinding(
                  "标准体重=身高（厘米）－105。",
                  "standard-weight"
                )
              ]
            }
          ]
        }
      ]
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      "statement 的断言 standard-weight缺少公式"
    );
  });

  it("正式条目不能用全 EVIDENCE_ONLY 绕过错误结论", () => {
    const claim = makeSaltClaim("任意错误结论。", "任意错误值");
    claim.sources[0].evidenceFragments[0].assertions[0].claimScope =
      "EVIDENCE_ONLY";
    const issues = collectClaimAssertionIssues(claim).join(" ");
    expect(issues).toContain("没有断言覆盖 statement");
    expect(issues).toContain("没有断言覆盖 referenceValue");
    expect(issues).toContain("不能只包含 EVIDENCE_ONLY");
  });

  it("targetComparators不能为错误比较方向自我授权", () => {
    const claim = makeSaltClaim("成人每日食盐少于6克。", "少于6克/日");
    claim.verificationStatus = "DOUBLE_CHECKED";
    const assertion = claim.sources[0].evidenceFragments[0].assertions[0];
    assertion.targetComparators = {
      statement: { comparator: "LT", reason: "试图将原文上限改成严格小于。" },
      referenceValue: { comparator: "LT", reason: "试图将原文上限改成严格小于。" }
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("不在白名单");
  });

  it("白名单比较符转换必须说明充分理由", () => {
    const claim = makeSaltClaim("成人每日食盐约6克。", "约6克/日");
    claim.verificationStatus = "DOUBLE_CHECKED";
    const fragment = claim.sources[0].evidenceFragments[0];
    replaceContiguousEvidence(fragment, "成人每天食盐为6克。", "成人每天食盐为6克");
    const assertion = fragment.assertions[0];
    assertion.comparator = "EQ";
    assertion.targetComparators = {
      statement: { comparator: "APPROX", reason: "" },
      referenceValue: { comparator: "APPROX", reason: "" }
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("缺少充分理由");
  });

  it("白名单比较符转换必须经过双重核对", () => {
    const claim = makeSaltClaim("成人每日食盐约6克。", "约6克/日");
    const fragment = claim.sources[0].evidenceFragments[0];
    replaceContiguousEvidence(fragment, "成人每天食盐为6克。", "成人每天食盐为6克");
    const assertion = fragment.assertions[0];
    assertion.comparator = "EQ";
    assertion.targetComparators = {
      statement: { comparator: "APPROX", reason: "原文定值在摘要中以约数表达。" },
      referenceValue: { comparator: "APPROX", reason: "原文定值在摘要中以约数表达。" }
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      "必须为 DOUBLE_CHECKED"
    );
  });

  it("结论与目标片段同步篡改也不能通过", () => {
    const claim = makeSaltClaim("成人每日食盐不超过60克。", "≤60克/日");
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("未绑定到 6克");
  });

  it("活动系数对象和值互换时必须失败", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims.find(({ id }) => id === "B1-ENERGY-002"));
    claim.statement = "书中按标准体重计算每日能量：长期卧床者40千卡/千克，轻体力劳动者30千卡/千克，中体力劳动者35千卡/千克，重体力劳动者25千卡/千克。";
    claim.referenceValue = "卧床40千卡/千克、轻体力30千卡/千克、中体力35千卡/千克、重体力25千卡/千克";
    const assertions = claim.sources[0].evidenceFragments[0].assertions;
    assertions.find(({ id }) => id === "bedridden").targetFragments = {
      statement: "长期卧床者40千卡/千克",
      referenceValue: "卧床40千卡/千克"
    };
    assertions.find(({ id }) => id === "heavy").targetFragments = {
      statement: "重体力劳动者25千卡/千克",
      referenceValue: "重体力25千卡/千克"
    };
    const issues = collectClaimAssertionIssues(claim).join(" ");
    expect(issues).toContain("bedridden");
    expect(issues).toContain("heavy");
  });

  it("不同食物的范围和值互换时必须失败", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims.find(({ id }) => id === "B1-PROTEIN-002"));
    claim.statement = "书中近似估算：1个鸡蛋含蛋白质17%～20%，100毫升牛奶约3克，瘦肉和鱼的蛋白质为6～7克/个。";
    claim.referenceValue = "鸡蛋17%～20%；牛奶约3克/100毫升；瘦肉和鱼6～7克/个";
    const assertions = claim.sources[0].evidenceFragments[0].assertions;
    assertions.find(({ id }) => id === "egg").targetFragments = {
      statement: "1个鸡蛋含蛋白质17%～20%",
      referenceValue: "鸡蛋17%～20%"
    };
    assertions.find(({ id }) => id === "lean-meat-fish").targetFragments = {
      statement: "瘦肉和鱼的蛋白质为6～7克/个",
      referenceValue: "瘦肉和鱼6～7克/个"
    };
    const issues = collectClaimAssertionIssues(claim).join(" ");
    expect(issues).toContain("egg");
    expect(issues).toContain("lean-meat-fish");
  });

  it("同步交换活动系数断言、结论和证据片段时必须失败", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims.find(({ id }) => id === "B1-ENERGY-002"));
    const assertions = claim.sources[0].evidenceFragments[0].assertions;
    const bedridden = assertions.find(({ id }) => id === "bedridden");
    const heavy = assertions.find(({ id }) => id === "heavy");
    [bedridden.value, heavy.value] = [heavy.value, bedridden.value];
    const bindings = claim.sources[0].evidenceFragments[0].evidenceBindings;
    const group = bindings.find(({ kind }) => kind === "ORDERED_LIST");
    const heavyItem = group.items.find(({ assertionId }) => assertionId === "heavy");
    const bedriddenBinding = bindings.find(
      ({ assertionId }) => assertionId === "bedridden"
    );
    heavyItem.assertionId = "bedridden";
    bedriddenBinding.assertionId = "heavy";
    claim.statement = "书中按标准体重计算每日能量：长期卧床者40千卡/千克，轻体力劳动者30千卡/千克，中体力劳动者35千卡/千克，重体力劳动者25千卡/千克。";
    claim.referenceValue = "卧床40千卡/千克、轻体力30千卡/千克、中体力35千卡/千克、重体力25千卡/千克";
    bedridden.targetFragments = {
      statement: "长期卧床者40千卡/千克",
      referenceValue: "卧床40千卡/千克"
    };
    heavy.targetFragments = {
      statement: "重体力劳动者25千卡/千克",
      referenceValue: "重体力25千卡/千克"
    };
    const issues = collectClaimAssertionIssues(claim).join(" ");
    expect(issues).toContain("bedridden");
    expect(issues).toContain("heavy");
  });

  it("同步交换食物范围断言、结论和证据片段时必须失败", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims.find(({ id }) => id === "B1-PROTEIN-002"));
    const assertions = claim.sources[0].evidenceFragments[0].assertions;
    const egg = assertions.find(({ id }) => id === "egg");
    const leanMeatFish = assertions.find(({ id }) => id === "lean-meat-fish");
    const eggMeasurement = {
      min: egg.min,
      max: egg.max,
      unit: egg.unit,
      timeBasis: egg.timeBasis
    };
    Object.assign(egg, {
      min: leanMeatFish.min,
      max: leanMeatFish.max,
      unit: leanMeatFish.unit,
      timeBasis: leanMeatFish.timeBasis
    });
    Object.assign(leanMeatFish, eggMeasurement);
    const bindings = claim.sources[0].evidenceFragments[0].evidenceBindings;
    const eggBinding = bindings.find(({ assertionId }) => assertionId === "egg");
    const leanBinding = bindings.find(
      ({ assertionId }) => assertionId === "lean-meat-fish"
    );
    [eggBinding.span, leanBinding.span] = [leanBinding.span, eggBinding.span];
    claim.statement = "书中近似估算：1个鸡蛋含蛋白质17%～20%，100毫升牛奶约3克，瘦肉和鱼的蛋白质为6～7克/个。";
    claim.referenceValue = "鸡蛋17%～20%；牛奶约3克/100毫升；瘦肉和鱼6～7克/个";
    egg.targetFragments = {
      statement: "1个鸡蛋含蛋白质17%～20%",
      referenceValue: "鸡蛋17%～20%"
    };
    leanMeatFish.targetFragments = {
      statement: "瘦肉和鱼的蛋白质为6～7克/个",
      referenceValue: "瘦肉和鱼6～7克/个"
    };
    const issues = collectClaimAssertionIssues(claim).join(" ");
    expect(issues).toContain("egg");
    expect(issues).toContain("lean-meat-fish");
  });

  it("扩大连续跨度并标记人工复核也不能为跨对象错配授权", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims.find(({ id }) => id === "B1-PROTEIN-002"));
    const fragment = claim.sources[0].evidenceFragments[0];
    const assertions = fragment.assertions;
    const egg = assertions.find(({ id }) => id === "egg");
    const leanMeatFish = assertions.find(({ id }) => id === "lean-meat-fish");
    [egg.min, leanMeatFish.min] = [leanMeatFish.min, egg.min];
    [egg.max, leanMeatFish.max] = [leanMeatFish.max, egg.max];
    [egg.unit, leanMeatFish.unit] = [leanMeatFish.unit, egg.unit];
    [egg.timeBasis, leanMeatFish.timeBasis] = [leanMeatFish.timeBasis, egg.timeBasis];
    const fullSpan = { start: 0, end: fragment.text.length, text: fragment.text };
    for (const binding of fragment.evidenceBindings.filter(
      ({ assertionId }) => ["egg", "lean-meat-fish"].includes(assertionId)
    )) {
      binding.span = fullSpan;
      binding.semanticReview = {
        status: "HUMAN_REVIEW_REQUIRED",
        reason: "测试不得使用人工复核标记为跨对象错配授权。"
      };
    }
    claim.statement = "书中近似估算：1个鸡蛋含蛋白质17%～20%，100毫升牛奶约3克，瘦肉和鱼的蛋白质为6～7克/个。";
    claim.referenceValue = "鸡蛋17%～20%；牛奶约3克/100毫升；瘦肉和鱼6～7克/个";
    egg.targetFragments = {
      statement: "1个鸡蛋含蛋白质17%～20%",
      referenceValue: "鸡蛋17%～20%"
    };
    leanMeatFish.targetFragments = {
      statement: "瘦肉和鱼的蛋白质为6～7克/个",
      referenceValue: "瘦肉和鱼6～7克/个"
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      "测量更接近其他对象"
    );
  });

  it.each(["HUMAN_REVIEW_REQUIRED", "HUMAN_REVIEWED"])(
    "人工状态%s不能放行胆固醇1000毫克反例",
    async (reviewStatus) => {
      const claim = await makeCholesterolBypassClaim(reviewStatus);
      expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
        "额外测量表达"
      );
    }
  );

  it("仅改变人工状态不会改变严格契约错误集合", async () => {
    const requiredClaim = await makeCholesterolBypassClaim(
      "HUMAN_REVIEW_REQUIRED"
    );
    const reviewedClaim = await makeCholesterolBypassClaim("HUMAN_REVIEWED");
    expect(collectClaimAssertionIssues(reviewedClaim)).toEqual(
      collectClaimAssertionIssues(requiredClaim)
    );
  });

  it("草稿知识中的结构化断言发生对象错配仍然失败", () => {
    const claim = makeSaltClaim("成人每日食盐不超过6克。", "≤6克/日");
    claim.verificationStatus = "SOURCE_LOCATED";
    claim.sources[0].evidenceFragments[0].assertions[0].subject = "烹调油";
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain("缺少对象");
  });

  it("ORDERED_LIST内部同步交换断言值和measurementSpan仍必须失败", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims.find(({ id }) => id === "B1-ENERGY-002"));
    const fragment = claim.sources[0].evidenceFragments[0];
    const light = fragment.assertions.find(({ id }) => id === "light");
    const heavy = fragment.assertions.find(({ id }) => id === "heavy");
    [light.value, heavy.value] = [heavy.value, light.value];
    const group = fragment.evidenceBindings.find(({ kind }) => kind === "ORDERED_LIST");
    const lightItem = group.items.find(({ assertionId }) => assertionId === "light");
    const heavyItem = group.items.find(({ assertionId }) => assertionId === "heavy");
    [lightItem.measurementSpan, heavyItem.measurementSpan] = [
      heavyItem.measurementSpan,
      lightItem.measurementSpan
    ];
    claim.statement = "书中按标准体重计算每日能量：长期卧床者25千卡/千克，轻体力劳动者40千卡/千克，中体力劳动者35千卡/千克，重体力劳动者30千卡/千克。";
    claim.referenceValue = "卧床25千卡/千克、轻体力40千卡/千克、中体力35千卡/千克、重体力30千卡/千克";
    light.targetFragments = {
      statement: "轻体力劳动者40千卡/千克",
      referenceValue: "轻体力40千卡/千克"
    };
    heavy.targetFragments = {
      statement: "重体力劳动者30千卡/千克",
      referenceValue: "重体力30千卡/千克"
    };
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      "必须按原文对象和数值顺序递增"
    );
  });

  it.each(["且", "和", "、", "分别"])(
    "6克不能通过连接词%s借用另一数值的比较符",
    (connector) => {
      const claim = makeSaltClaim(
        `成人每日食盐低于6克${connector}烹调油不超过25克。`,
        `食盐低于6克${connector}烹调油不超过25克/日`
      );
      expect(collectClaimAssertionIssues(claim).join(" ")).toContain("未绑定到 6克");
    }
  );

  it.each(["且", "和", "、", "分别"])(
    "6克不能通过连接词%s借用另一数值的每日口径",
    (connector) => {
      const claim = makeSaltClaim(
        `成人每周食盐不超过6克${connector}蔬菜每日300克。`,
        `食盐每周不超过6克${connector}蔬菜300克/日`
      );
      expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
        "时间口径未绑定到 6克"
      );
    }
  );

  it.each([
    ["STATEMENT_ONLY", "referenceValue"],
    ["REFERENCE_ONLY", "statement"]
  ])("正式条目使用%s时会报告缺少%s覆盖", (scope, missingTarget) => {
    const claim = makeSaltClaim("成人每日食盐不超过6克。", "≤6克/日");
    claim.sources[0].evidenceFragments[0].assertions[0].claimScope = scope;
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      `没有断言覆盖 ${missingTarget}`
    );
  });

  it("连续证据的UTF-16半开区间必须与原文精确一致", () => {
    const claim = makeSaltClaim("成人每日食盐不超过6克。", "≤6克/日");
    claim.sources[0].evidenceFragments[0].evidenceBindings[0].span.end -= 1;
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      "slice(start, end) 不一致"
    );
  });

  it("ORDERED_LIST遗漏或重复assertion时必须失败", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const missingClaim = structuredClone(
      claims.find(({ id }) => id === "B1-ENERGY-002")
    );
    const missingGroup = missingClaim.sources[0].evidenceFragments[0].evidenceBindings.find(
      ({ kind }) => kind === "ORDERED_LIST"
    );
    missingGroup.items.pop();
    expect(collectClaimAssertionIssues(missingClaim).join(" ")).toContain(
      "assertion 未归属证据模型"
    );

    const duplicateClaim = structuredClone(
      claims.find(({ id }) => id === "B1-ENERGY-002")
    );
    const duplicateGroup = duplicateClaim.sources[0].evidenceFragments[0].evidenceBindings.find(
      ({ kind }) => kind === "ORDERED_LIST"
    );
    duplicateGroup.items.push(structuredClone(duplicateGroup.items[0]));
    expect(collectClaimAssertionIssues(duplicateClaim).join(" ")).toContain(
      "重复 assertionId"
    );
  });

  it("单条普通断言不能改用ORDERED_LIST绕过连续跨度", () => {
    const claim = makeSaltClaim("成人每日食盐不超过6克。", "≤6克/日");
    const fragment = claim.sources[0].evidenceFragments[0];
    const originalSpan = fragment.evidenceBindings[0].span;
    fragment.evidenceBindings = [
      {
        id: "b1",
        kind: "ORDERED_LIST",
        span: originalSpan,
        sharedBindings: {
          timeBasis: {
            value: "DAY",
            span: makeSpan(fragment.text, "每天")
          }
        },
        items: [
          {
            assertionId: "salt-limit",
            subjectSpan: makeSpan(fragment.text, "食盐"),
            measurementSpan: makeSpan(fragment.text, "不超过6克")
          }
        ]
      }
    ];
    expect(collectClaimAssertionIssues(claim).join(" ")).toContain(
      "至少需要两个 item"
    );
  });

  it("旧自由证据上下文字段必须被Schema拒绝", async () => {
    const schema = JSON.parse(
      await readFile(resolve("docs/book-handbook/data/schema.json"), "utf8")
    );
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const claim = structuredClone(claims[0]);
    claim.sources[0].evidenceFragments[0].assertions[0].evidenceSubjectFragment =
      "任意对象";
    expect(collectSchemaIssues([claim], schema).join(" ")).toContain(
      "must NOT have additional properties"
    );
  });

  it("三类脂肪酸草稿保留直接文本组件，不伪造比例对象", async () => {
    const claims = await readHandbookClaims();
    const claim = claims.find(({ id }) => id === "B1-FAT-003");
    const fragment = claim.sources[0].evidenceFragments[0];
    const assertion = fragment.assertions.find(
      ({ id }) => id === "recommended-pronoun-text"
    );
    expect(assertion).toEqual({
      id: "recommended-pronoun-text",
      kind: "TEXT",
      claimScope: "EVIDENCE_ONLY",
      text: "现在这三者之间更加推荐的比例"
    });
    expect(fragment.text).toContain("更加推荐的比例是3∶4∶3");
    expect(claim.referenceValue).toBe("3∶4∶3");
    expect(claim.verificationStatus).toBe("SOURCE_LOCATED");
    expect(isPublishableClaim(claim)).toBe(false);
    expect(collectClaimAssertionIssues(claim)).toEqual([]);
  });

  it("密度定义在正文和术语表中统一使用书中的单位体积口径", async () => {
    const texts = await Promise.all(
      ["food-and-meals.md", "glossary.md"].map((file) =>
        readFile(resolve("docs/book-handbook", file), "utf8")
      )
    );
    for (const text of texts) {
      expect(text).toContain("单位体积食物提供的能量多少");
      expect(text).toContain("单位体积食物所含营养素的种类和数量");
      expect(text).not.toContain("单位重量或体积");
    }
  });

  it("70条assertion必须且只能归属两种证据模型之一", async () => {
    const claims = (await readFile(resolve("docs/book-handbook/data/claims.jsonl"), "utf8"))
      .trim()
      .split(/\r?\n/u)
      .map((line) => JSON.parse(line));
    const stats = collectEvidenceBindingStats(claims);
    expect(stats).toMatchObject({
      assertionCount: 70,
      contiguousCount: 59,
      orderedListCount: 4,
      orderedListAssertionCount: 11,
      humanReviewRequiredCount: 12,
      humanReviewedCount: 0
    });
    expect(stats.contiguousCount + stats.orderedListAssertionCount).toBe(
      stats.assertionCount
    );
  });

  it("实际执行 schema.json 并拒绝空来源和非法日期", async () => {
    const schema = JSON.parse(
      await readFile(resolve("docs/book-handbook/data/schema.json"), "utf8")
    );
    const invalidSafetyClaim = {
      id: "B1-SAFETY-TEST",
      coverageSectionId: "B1-PART-01",
      topic: "测试",
      statement: "测试安全提示",
      question: "测试问题？",
      claimType: "SAFETY",
      sourceKind: "SAFETY_NOTE",
      sources: [],
      applicability: "SAFETY_ONLY",
      verificationStatus: "UNVERIFIED",
      verifiedAt: "2026-13-40",
      conflicts: [],
      notes: []
    };
    const issues = collectSchemaIssues([invalidSafetyClaim], schema).join(" ");
    expect(issues).toContain("must NOT have fewer than 1 items");
    expect(issues).toContain("must match format");
  });

  it("未完成原文核对的数字不进入数值速查", () => {
    const baseClaim = {
      claimType: "NUMERIC",
      sourceKind: "BOOK_DIRECT",
      applicability: "HEALTHY_ADULTS",
      referenceLabel: "食盐",
      referenceValue: "≤6克/日"
    };
    const output = buildNumericReference([
      {
        ...baseClaim,
        id: "B1-FOOD-UNVERIFIED",
        topic: "未核验食盐",
        verificationStatus: "UNVERIFIED"
      },
      {
        ...baseClaim,
        id: "B1-FOOD-VERIFIED",
        topic: "已核验食盐",
        verificationStatus: "DIRECT_TEXT_CHECKED"
      }
    ]);
    expect(output).not.toContain("未核验食盐");
    expect(output).toContain("已核验食盐");
  });

  it("没有对应 claim 的数字覆盖不能标为 PARTIAL", () => {
    const coverage = {
      books: [
        {
          bookId: "BOOK_2",
          sections: [
            {
              sectionId: "B2-PART-05",
              auditedCoverage: {
                outline: { status: "NOT_STARTED" },
                corePrinciples: { status: "NOT_STARTED", includedClaimIds: [] },
                numericClaims: { status: "PARTIAL", includedClaimIds: [] },
                allClaims: { status: "NOT_STARTED", includedClaimIds: [] }
              }
            }
          ]
        }
      ]
    };
    expect(collectCoverageConsistencyIssues([], coverage).join(" ")).toContain(
      "numericClaims 标为 PARTIAL"
    );
  });

  it("四维覆盖的 VERIFIED 必须有完成清单", () => {
    const coverage = {
      books: [
        {
          bookId: "BOOK_1",
          sections: [
            {
              sectionId: "B1-PART-01",
              auditedCoverage: {
                outline: { status: "VERIFIED" },
                corePrinciples: { status: "VERIFIED", includedClaimIds: ["B1-PRINCIPLE-TEST"] },
                numericClaims: { status: "NOT_STARTED", includedClaimIds: [] },
                allClaims: { status: "PARTIAL", includedClaimIds: ["B1-PRINCIPLE-TEST"] }
              }
            }
          ]
        }
      ]
    };
    const claims = [
      {
        id: "B1-PRINCIPLE-TEST",
        coverageSectionId: "B1-PART-01",
        claimType: "PRINCIPLE",
        verificationStatus: "DIRECT_TEXT_CHECKED",
        sources: [{ bookId: "BOOK_1" }]
      }
    ];
    const issues = collectCoverageConsistencyIssues(claims, coverage).join(" ");
    expect(issues).toContain("目录标为 VERIFIED，但没有完整预期目录清单");
    expect(issues).toContain("corePrinciples 标为 VERIFIED，但没有完整预期清单");
  });

  it("正式学习卡只含已核验条目，草稿卡单独输出并保留核验日期", () => {
    const common = {
      coverageSectionId: "B1-PART-01",
      topic: "测试",
      question: "测试？",
      statement: "测试",
      claimType: "PRINCIPLE",
      sourceKind: "BOOK_DIRECT",
      applicability: "GENERAL_KNOWLEDGE",
      verifiedAt: "2026-09-03",
      sources: [],
      conflicts: [],
      notes: []
    };
    const claims = [
      { ...common, id: "B1-VERIFIED-TEST", verificationStatus: "DIRECT_TEXT_CHECKED" },
      { ...common, id: "B1-DRAFT-TEST", verificationStatus: "SOURCE_LOCATED" }
    ];
    const formalCards = buildLearningCards(claims);
    const draftCards = buildDraftLearningCards(claims);
    expect(formalCards).toContain("B1-VERIFIED-TEST");
    expect(formalCards).not.toContain("B1-DRAFT-TEST");
    expect(draftCards).toContain("B1-DRAFT-TEST");
    expect(draftCards).toContain('"verifiedAt": "2026-09-03"');
  });

  it("人工状态只控制发布资格，不改变严格契约", () => {
    const claim = makeSaltClaim("成人每日食盐不超过6克。", "≤6克/日");
    const binding = claim.sources[0].evidenceFragments[0].evidenceBindings[0];
    binding.semanticReview = {
      status: "HUMAN_REVIEW_REQUIRED",
      reason: "测试待人工复核的知识不能进入正式产物。"
    };
    expect(isPublishableClaim(claim)).toBe(false);
    expect(collectClaimAssertionIssues(claim)).toEqual([]);
    binding.semanticReview = {
      status: "HUMAN_REVIEWED",
      reason: "测试完成人工复核后只改变发布资格。",
      reviewedAt: "2026-09-08"
    };
    expect(isPublishableClaim(claim)).toBe(true);
    expect(collectClaimAssertionIssues(claim)).toEqual([]);
  });

  it("正式卡与草稿卡互斥并完整覆盖全部知识", async () => {
    const claims = await readHandbookClaims();
    const formalCards = JSON.parse(buildLearningCards(claims));
    const draftCards = JSON.parse(buildDraftLearningCards(claims));
    const formalIds = new Set(formalCards.map(({ id }) => id));
    const draftIds = new Set(draftCards.map(({ id }) => id));
    expect([...formalIds].filter((id) => draftIds.has(id))).toEqual([]);
    expect(new Set([...formalIds, ...draftIds]).size).toBe(claims.length);
    expect(formalIds.size + draftIds.size).toBe(claims.length);
  });

  it("9条人工复核待办只进入草稿和复核清单", async () => {
    const claims = await readHandbookClaims();
    const formalCards = JSON.parse(buildLearningCards(claims));
    const draftCards = JSON.parse(buildDraftLearningCards(claims));
    const formalIds = new Set(formalCards.map(({ id }) => id));
    const draftIds = new Set(draftCards.map(({ id }) => id));
    const numericReference = buildNumericReference(claims);
    const manualReview = buildManualReview(claims);
    for (const id of pendingReviewClaimIds) {
      const claim = claims.find((candidate) => candidate.id === id);
      expect(formalIds.has(id)).toBe(false);
      expect(draftIds.has(id)).toBe(true);
      expect(numericReference).not.toContain(claim.topic);
      expect(manualReview).toContain(id);
    }
  });
});
