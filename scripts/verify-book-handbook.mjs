import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { basename, dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import {
  buildCoverageMatrix,
  buildDraftLearningCards,
  buildLearningCards,
  buildManualReview,
  buildNumericReference,
  isPublishableClaim,
  projectRoot,
  readBooks,
  readClaims,
  readCoverage
} from "./generate-book-handbook.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const handbookDirectory = resolve(scriptDirectory, "../docs/book-handbook");
const dataDirectory = resolve(handbookDirectory, "data");
const verifiedStatuses = new Set(["DIRECT_TEXT_CHECKED", "DOUBLE_CHECKED"]);
const validCoverageStatuses = new Set([
  "NOT_STARTED",
  "PARTIAL",
  "VERIFIED",
  "NOT_APPLICABLE"
]);

function addFailure(report, condition, message) {
  if (!condition) report.failures.push(message);
}

function normalizeText(value) {
  return value.normalize("NFKC").replace(/\s+/gu, "");
}

function normalizeSemanticText(value) {
  return normalizeText(value)
    .replace(/[∶：]/gu, ":")
    .replace(/[＝]/gu, "=")
    .replace(/[～〜—–]/gu, "~")
    .replace(/(\d(?:\.\d+)?)至(?=\d)/gu, "$1~")
    .replace(/≤/gu, "<=")
    .replace(/≥/gu, ">=");
}

function decodeHtml(html) {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/giu, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&#x([0-9a-f]+);/giu, (_, value) =>
      String.fromCodePoint(Number.parseInt(value, 16))
    )
    .replace(/&#(\d+);/gu, (_, value) =>
      String.fromCodePoint(Number.parseInt(value, 10))
    )
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'");
}

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function containsNumericToken(text, token) {
  const expression = new RegExp(
    `(?:^|[^\\d.])${escapeRegularExpression(token)}(?![\\d.])`,
    "u"
  );
  return expression.test(text);
}

const knownUnits = [
  "千卡",
  "千克",
  "毫克",
  "毫升",
  "分钟",
  "厘米",
  "小时",
  "克",
  "天",
  "周",
  "步",
  "种",
  "杯",
  "个",
  "分",
  "%"
].sort((left, right) => right.length - left.length);

const comparatorPatterns = {
  APPROX: /约|左右|大约|接近|近似|大致/u,
  GTE: /不低于|不能低于|不少于|不应少于|至少|以上|>=/u,
  LTE: /不超过|不能超过|至多|最多|及以下|<=/u,
  GT: /大于|高于|(?<![不能可未])超过|(?<![<>=])>(?!=)/u,
  LT: /低于|少于|以下|(?<![<>=])<(?!=)/u,
  RECOMMENDED: /最好|建议|推荐|尽量/u
};

const timeBasisPatterns = {
  DAY: /每天|每日|一天|一日|日常|单日|食用日|\/日/u,
  WEEK: /每周|一周|\/周/u,
  PER_KG: /每千克|每公斤|\/千克|\/公斤/u,
  PER_100_ML: /每100毫升|100毫升|\/100毫升/u,
  PER_ITEM: /每个|1个|\/个/u
};

function hasExactUnit(text, unit) {
  const normalized = normalizeSemanticText(text);
  const expression = new RegExp(knownUnits.map(escapeRegularExpression).join("|"), "gu");
  const recognized = normalized.match(expression) ?? [];
  return knownUnits.includes(unit) ? recognized.includes(unit) : normalized.includes(unit);
}

function fractionTokens(numerator, denominator) {
  const tokens = [`${numerator}/${denominator}`];
  if (numerator === 1 && denominator === 2) tokens.push("一半", "二分之一");
  if (numerator === 1 && denominator === 3) tokens.push("三分之一");
  if (numerator === 1 && denominator === 4) tokens.push("四分之一");
  return tokens;
}

function includesOneOf(text, values) {
  return values.some((value) => text.includes(normalizeSemanticText(value)));
}

function comparatorIsPresent(text, comparator) {
  if (comparator === "EQ") {
    return !Object.values(comparatorPatterns).some((pattern) => pattern.test(text));
  }
  return comparatorPatterns[comparator]?.test(text) ?? false;
}

const comparatorPrefixPatterns = {
  APPROX: /(?:约|大约|接近|近似|大致)[^\d.]{0,10}$/u,
  GTE: /(?:不低于|不能低于|不少于|不应少于|至少|>=)[^\d.]{0,10}$/u,
  LTE: /(?:不超过|不能超过|至多|最多|<=)[^\d.]{0,10}$/u,
  GT: /(?:大于|高于|(?<![不能可未不])超过|(?<![<>=])>(?!=))[^\d.]{0,10}$/u,
  LT: /(?:低于|少于|(?<![<>=])<(?!=))[^\d.]{0,10}$/u,
  RECOMMENDED: /(?:最好|建议|推荐|尽量)[^\d.]{0,8}$/u
};

const comparatorSuffixPatterns = {
  APPROX: /^左右/u,
  GTE: /^以上/u,
  LTE: /^及以下/u,
  LT: /^以下/u
};

function stripTimeBasisSuffix(text) {
  return text.replace(/^\/(?:日|周|千克|公斤|100毫升|个)/u, "");
}

function comparatorIsBoundToMeasurement(beforeValue, afterUnit, comparator) {
  const before = beforeValue.slice(-16);
  const after = stripTimeBasisSuffix(afterUnit).slice(0, 8);
  const matchingComparators = new Set(Object.keys(comparatorPatterns).filter(
    (candidate) =>
      comparatorPrefixPatterns[candidate]?.test(before) ||
      comparatorSuffixPatterns[candidate]?.test(after)
  ));
  if (matchingComparators.has("GTE")) matchingComparators.delete("LT");
  if (matchingComparators.has("LTE")) {
    matchingComparators.delete("GT");
    matchingComparators.delete("LT");
  }
  if (comparator === "EQ") return matchingComparators.size === 0;
  if (!matchingComparators.has(comparator)) return false;
  const conflictingDirections = [...matchingComparators].filter(
    (candidate) => candidate !== comparator && candidate !== "RECOMMENDED"
  );
  return conflictingDirections.length === 0;
}

function timeBasisIsPresent(text, timeBasis) {
  if (!timeBasis || timeBasis === "NONE") return true;
  return timeBasisPatterns[timeBasis]?.test(text) ?? false;
}

const timeBasisPrefixPatterns = {
  DAY: /(?:每天|每日|一天|一日|日常|单日|食用日)[^\d.]{0,16}$/u,
  WEEK: /(?:每周|一周)[^\d.]{0,16}$/u,
  PER_KG: /(?:每千克|每公斤)[^\d.]{0,16}$/u,
  PER_100_ML: /(?:每100毫升|100毫升)[^\d.]{0,16}$/u,
  PER_ITEM: /(?:每个|1个)[^\d.]{0,16}$/u
};

const timeBasisSuffixPatterns = {
  DAY: /^[^\d.]{0,8}\/日/u,
  WEEK: /^[^\d.]{0,8}\/周/u,
  PER_KG: /^[^\d.]{0,8}\/(?:千克|公斤)/u,
  PER_100_ML: /^[^\d.]{0,8}\/100毫升/u,
  PER_ITEM: /^[^\d.]{0,8}\/个/u
};

function timeBasisIsBoundToMeasurement(beforeValue, afterUnit, timeBasis) {
  if (!timeBasis || timeBasis === "NONE") return true;
  return (
    timeBasisPrefixPatterns[timeBasis]?.test(beforeValue.slice(-32)) ||
    timeBasisSuffixPatterns[timeBasis]?.test(afterUnit.slice(0, 12)) ||
    false
  );
}

function subjectsAppearInOrder(text, subjects) {
  let cursor = 0;
  for (const subject of subjects) {
    const normalizedSubject = normalizeSemanticText(subject);
    const index = text.indexOf(normalizedSubject, cursor);
    if (index < 0) return false;
    cursor = index + normalizedSubject.length;
  }
  return true;
}

function longestCommonSuffix(values) {
  const normalizedValues = values.map(normalizeSemanticText);
  const shortestLength = Math.min(...normalizedValues.map((value) => value.length));
  let length = 0;
  while (
    length < shortestLength &&
    normalizedValues.every(
      (value) => value.at(-(length + 1)) === normalizedValues[0].at(-(length + 1))
    )
  ) {
    length += 1;
  }
  return normalizedValues[0].slice(normalizedValues[0].length - length);
}

function ratioSubjectsAppearInOrder(text, subjects) {
  const normalizedSubjects = subjects.map(normalizeSemanticText);
  const commonSuffix = longestCommonSuffix(normalizedSubjects);
  let tokens = normalizedSubjects;
  for (let suffixLength = commonSuffix.length; suffixLength >= 2; suffixLength -= 1) {
    const candidateTokens = normalizedSubjects.map((subject) =>
      subject.slice(0, -suffixLength)
    );
    if (
      candidateTokens.every((token) => token.length >= 2) &&
      new Set(candidateTokens).size === candidateTokens.length
    ) {
      tokens = candidateTokens;
      break;
    }
  }
  return subjectsAppearInOrder(text, tokens);
}

function normalizeSubjectVocabulary(value) {
  return normalizeSemanticText(value)
    .replaceAll("碳水化合物", "碳水")
    .replaceAll("脂类", "脂肪")
    .replaceAll("长期卧床的人", "卧床")
    .replaceAll("三种脂肪酸", "三类脂肪酸")
    .replaceAll("全谷物", "全谷")
    .replaceAll("杂豆类", "杂豆")
    .replaceAll("鱼肉", "鱼")
    .replaceAll("蛋类", "蛋")
    .replaceAll("饮食摄入胆固醇", "膳食胆固醇")
    .replaceAll("摄入总量", "合计")
    .replaceAll("总摄入量", "合计");
}

function subjectCandidates(subject) {
  const normalized = normalizeSubjectVocabulary(subject);
  return [
    normalized,
    normalized.replace(/^纯/u, "").replace(/类$/u, ""),
    normalized.replace(/系列不饱和脂肪酸$/u, ""),
    normalized.replace(/脂肪酸$/u, ""),
    normalized.replace(/食物$/u, ""),
    normalized.replace(/劳动者$/u, ""),
    normalized.replace(/的人$/u, ""),
    normalized.replace(/的能量$/u, ""),
    normalized.replace("身体活动", "活动"),
    normalized.replace("每一类", "每类"),
    normalized.replace("摄入总量", "摄入量"),
    normalized.replace("饮食摄入", "饮食"),
    normalized.replace("算好能量比例", "能量"),
    normalized.replace("选足食物种类,搭好结构", "食物结构")
  ].filter(
    (value, index, values) =>
      value.length >= 1 && values.indexOf(value) === index
  );
}

function subjectIsPresent(text, subject) {
  const normalizedTarget = normalizeSubjectVocabulary(text);
  const normalizedSubject = normalizeSubjectVocabulary(subject);
  if (
    normalizedSubject === "三类脂肪酸" &&
    ["饱和", "单不饱和", "多不饱和"].every((item) =>
      normalizedTarget.includes(item)
    )
  ) {
    return true;
  }
  if (
    ["动物脂肪", "植物脂肪"].includes(normalizedSubject) &&
    normalizedTarget.includes(normalizedSubject.slice(0, 2)) &&
    normalizedTarget.includes("脂肪")
  ) {
    return true;
  }
  if (normalizedSubject.includes("和")) {
    const parts = normalizedSubject
      .replace(/^纯/u, "")
      .split("和")
      .map((part) => part.replace(/类$/u, ""))
      .filter((part) => part.length >= 1);
    if (parts.length > 1 && parts.every((part) => normalizedTarget.includes(part))) {
      return true;
    }
  }
  return subjectCandidates(subject).some((candidate) => normalizedTarget.includes(candidate));
}

function assertionLabel(label, assertion) {
  return `${label} 的断言 ${assertion.id}`;
}

function rangeIsPresent(text, min, max, unit = "") {
  const normalizedUnit = normalizeSemanticText(unit);
  return [
    `${min}~${max}${normalizedUnit}`,
    `${min}~${max})${normalizedUnit}`,
    `${min}${normalizedUnit}~${max}${normalizedUnit}`
  ].some((candidate) => text.includes(candidate));
}

const sentenceBoundaries = /[。；;！？!?]/u;
const comparisonBoundaries = /[，,。；;！？!?]/u;

function enclosingSegment(text, index, boundaries) {
  let start = index;
  while (start > 0 && !boundaries.test(text[start - 1])) start -= 1;
  let end = index;
  while (end < text.length && !boundaries.test(text[end])) end += 1;
  return text.slice(start, end);
}

function normalizeBindingText(text) {
  return normalizeSemanticText(text).replace(/\[注:[^\]]*\]/gu, "");
}

function numericTokenIndices(text, token) {
  const expression = new RegExp(
    `(?:^|[^\\d.])(${escapeRegularExpression(token)})(?![\\d.])`,
    "gu"
  );
  return [...text.matchAll(expression)].map(
    (match) => (match.index ?? 0) + match[0].length - match[1].length
  );
}

function measurementContexts(text, value, unit, timeBasis) {
  const normalized = normalizeBindingText(text);
  const normalizedUnit = normalizeSemanticText(unit);
  return numericTokenIndices(normalized, String(value))
    .map((index) => {
      const afterValue = normalized.slice(index + String(value).length);
      const unitOffset = afterValue.startsWith(`)${normalizedUnit}`) ? 1 : 0;
      const unitIsAdjacent =
        afterValue.startsWith(normalizedUnit) || unitOffset === 1;
      const afterUnit = unitIsAdjacent
        ? afterValue.slice(unitOffset + normalizedUnit.length)
        : afterValue;
      return {
        comparison: enclosingSegment(normalized, index, comparisonBoundaries),
        sentence: enclosingSegment(normalized, index, sentenceBoundaries),
        beforeValue: normalized.slice(0, index),
        afterUnit,
        unitIsAdjacent
      };
    })
    .filter(
      ({ beforeValue, afterUnit, unitIsAdjacent }) =>
        unitIsAdjacent &&
        timeBasisIsBoundToMeasurement(beforeValue, afterUnit, timeBasis)
    );
}

function rangeBindingIsPresent(text, assertion, checkTimeBasis = true) {
  const normalized = normalizeBindingText(text);
  const normalizedUnit = normalizeSemanticText(assertion.unit);
  const candidates = [
    `${assertion.min}~${assertion.max}${normalizedUnit}`,
    `${assertion.min}~${assertion.max})${normalizedUnit}`,
    `${assertion.min}${normalizedUnit}~${assertion.max}${normalizedUnit}`
  ];
  return candidates.some((candidate) =>
    tokenIndices(normalized, candidate).some((index) =>
      !checkTimeBasis ||
      timeBasisIsBoundToMeasurement(
        normalized.slice(0, index),
        normalized.slice(index + candidate.length),
        assertion.timeBasis
      )
    )
  );
}

function tokenIndices(text, token) {
  const indices = [];
  let cursor = 0;
  while (cursor <= text.length) {
    const index = text.indexOf(token, cursor);
    if (index < 0) break;
    indices.push(index);
    cursor = index + Math.max(1, token.length);
  }
  return indices;
}

function comparatorIsBoundToTokens(text, comparator, tokens) {
  const normalized = normalizeBindingText(text);
  return tokens.some((token) =>
    tokenIndices(normalized, normalizeSemanticText(token)).some((index) =>
      comparatorIsBoundToMeasurement(
        normalized.slice(0, index),
        normalized.slice(index + normalizeSemanticText(token).length),
        comparator
      )
    )
  );
}

function quantityBindingIsPresent(text, assertion, targetKind) {
  const comparator =
    assertion.targetComparators?.[targetKind]?.comparator ?? assertion.comparator;
  return measurementContexts(
    text,
    assertion.value,
    assertion.unit,
    assertion.timeBasis
  ).some(({ beforeValue, afterUnit }) =>
    comparatorIsBoundToMeasurement(beforeValue, afterUnit, comparator)
  );
}

function scopeCoversTarget(claimScope, targetKind) {
  if (targetKind === "statement") {
    return ["BOTH", "STATEMENT_ONLY"].includes(claimScope);
  }
  return ["BOTH", "REFERENCE_ONLY"].includes(claimScope);
}

function collectComparatorOverrideIssues(claim, assertion) {
  const issues = [];
  for (const [targetKind, override] of Object.entries(
    assertion.targetComparators ?? {}
  )) {
    const label = `${claim.id} 的断言 ${assertion.id}`;
    if (!scopeCoversTarget(assertion.claimScope, targetKind)) {
      issues.push(`${label} 为未绑定目标 ${targetKind} 声明了比较符转换`);
      continue;
    }
    if (override.comparator === assertion.comparator) {
      issues.push(`${label} 的 ${targetKind} 比较符转换与原文相同，属于冗余声明`);
    }
    if (!(assertion.comparator === "EQ" && override.comparator === "APPROX")) {
      issues.push(
        `${label} 的 ${targetKind} 比较符转换不在白名单：${assertion.comparator} → ${override.comparator}`
      );
    }
    if (typeof override.reason !== "string" || override.reason.trim().length < 8) {
      issues.push(`${label} 的 ${targetKind} 比较符转换缺少充分理由`);
    }
    if (claim.verificationStatus !== "DOUBLE_CHECKED") {
      issues.push(`${label} 使用比较符转换时必须为 DOUBLE_CHECKED`);
    }
  }
  return issues;
}

function assertionSignatureKey(assertion) {
  if (assertion.kind === "QUANTITY") {
    return `QUANTITY:${assertion.value}:${assertion.unit}`;
  }
  if (assertion.kind === "RANGE") {
    return `RANGE:${assertion.min}:${assertion.max}:${assertion.unit}`;
  }
  if (assertion.kind === "RATIO") return `RATIO:${assertion.ratioValues.join(":")}`;
  if (assertion.kind === "FORMULA") return `FORMULA:${assertion.expression}`;
  if (assertion.kind === "FRACTION") {
    return `FRACTION:${assertion.numerator}/${assertion.denominator}`;
  }
  if (assertion.kind === "FRACTION_RANGE") {
    return `FRACTION_RANGE:${assertion.minNumerator}/${assertion.minDenominator}~${assertion.maxNumerator}/${assertion.maxDenominator}`;
  }
  if (assertion.kind === "SELECTION") {
    return `SELECTION:${assertion.result}:${assertion.unit}`;
  }
  return `TEXT:${assertion.text}`;
}

function assertionSignatureIsPresent(fragment, assertion, targetKind) {
  const normalized = normalizeSemanticText(fragment);
  if (assertion.kind === "QUANTITY") {
    return measurementContexts(
      normalized,
      assertion.value,
      assertion.unit,
      "NONE"
    ).length > 0;
  }
  if (assertion.kind === "RANGE") {
    return rangeIsPresent(normalized, assertion.min, assertion.max, assertion.unit);
  }
  if (assertion.kind === "RATIO") {
    return normalized.includes(
      assertion.ratioValues.map(normalizeSemanticText).join(":")
    );
  }
  if (assertion.kind === "FORMULA") {
    const expression = normalizeSemanticText(assertion.expression);
    const rightHandSide = expression.includes("=") ? expression.split("=").at(-1) : expression;
    return targetKind === "statement"
      ? normalized.includes(expression)
      : normalized.includes(expression) || normalized.includes(rightHandSide);
  }
  if (assertion.kind === "FRACTION") {
    return includesOneOf(
      normalized,
      fractionTokens(assertion.numerator, assertion.denominator)
    );
  }
  if (assertion.kind === "FRACTION_RANGE") {
    return normalized.includes(
      `${assertion.minNumerator}/${assertion.minDenominator}~${assertion.maxNumerator}/${assertion.maxDenominator}`
    );
  }
  if (assertion.kind === "SELECTION") {
    return measurementContexts(
      normalized,
      assertion.result,
      assertion.unit,
      "NONE"
    ).length > 0;
  }
  return normalized.includes(normalizeSemanticText(assertion.text));
}

function assertionSubjectIsPresent(fragment, assertion) {
  if (assertion.subject) return subjectIsPresent(fragment, assertion.subject);
  if (assertion.subjects) {
    return ratioSubjectsAppearInOrder(
      normalizeSemanticText(fragment),
      assertion.subjects
    );
  }
  return true;
}

function signaturesMayOverlap(current, other) {
  if (current.kind !== "FRACTION_RANGE" || other.kind !== "FRACTION") {
    return false;
  }
  return [
    [current.minNumerator, current.minDenominator],
    [current.maxNumerator, current.maxDenominator]
  ].some(
    ([numerator, denominator]) =>
      numerator === other.numerator && denominator === other.denominator
  );
}

function collectTargetFragmentAtomicityIssues(targetKind, bindings) {
  const issues = [];
  for (const binding of bindings) {
    for (const other of bindings) {
      if (binding.assertion.id === other.assertion.id) continue;
      if (signaturesMayOverlap(binding.assertion, other.assertion)) continue;
      if (!assertionSignatureIsPresent(binding.fragment, other.assertion, targetKind)) {
        continue;
      }
      const sameSignature =
        assertionSignatureKey(binding.assertion) ===
        assertionSignatureKey(other.assertion);
      if (
        !sameSignature ||
        assertionSubjectIsPresent(binding.fragment, other.assertion)
      ) {
        issues.push(
          `${binding.claimId} 的断言 ${binding.assertion.id} 在 ${targetKind} 的目标片段包含其他断言 ${other.assertion.id} 的测量签名`
        );
      }
    }
  }
  return issues;
}

function collectSourceSpanIssues(sourceText, span, label, parentSpan = null) {
  const issues = [];
  if (!span || !Number.isInteger(span.start) || !Number.isInteger(span.end)) {
    return [`${label} 缺少有效的 UTF-16 start/end`];
  }
  if (span.start < 0 || span.end <= span.start || span.end > sourceText.length) {
    issues.push(`${label} 的范围越界或不是正向半开区间`);
    return issues;
  }
  if (sourceText.slice(span.start, span.end) !== span.text) {
    issues.push(`${label} 的 text 与原始证据 slice(start, end) 不一致`);
  }
  if (
    parentSpan &&
    (span.start < parentSpan.start || span.end > parentSpan.end)
  ) {
    issues.push(`${label} 不在所属列表整体跨度内`);
  }
  return issues;
}

function measurementExpressions(text) {
  const normalized = normalizeBindingText(text);
  const unitPattern = knownUnits.map(escapeRegularExpression).join("|");
  const expressions = [
    ...normalized.matchAll(
      new RegExp(
        `\\d+(?:\\.\\d+)?(?:~\\d+(?:\\.\\d+)?)?\\)?(?:${unitPattern})`,
        "gu"
      )
    ),
    ...normalized.matchAll(/\d+(?:\.\d+)?(?::\d+(?:\.\d+)?(?:~\d+(?:\.\d+)?)?)+/gu),
    ...normalized.matchAll(/\d+\/\d+(?:~\d+\/\d+)?/gu)
  ].map((match) => match[0]);
  return [...new Set(expressions)];
}

function expectedMeasurementExpressions(assertion) {
  const expected = new Set();
  if (assertion.kind === "QUANTITY") {
    expected.add(normalizeSemanticText(`${assertion.value}${assertion.unit}`));
  }
  if (["RANGE", "SELECTION"].includes(assertion.kind)) {
    for (const candidate of [
      `${assertion.min}～${assertion.max}${assertion.unit}`,
      `${assertion.min}～${assertion.max}）${assertion.unit}`,
      `${assertion.min}${assertion.unit}～${assertion.max}${assertion.unit}`
    ]) {
      expected.add(normalizeSemanticText(candidate));
    }
    expected.add(normalizeSemanticText(`${assertion.min}${assertion.unit}`));
    expected.add(normalizeSemanticText(`${assertion.max}${assertion.unit}`));
  }
  if (assertion.kind === "RATIO") {
    expected.add(
      assertion.ratioValues.map(normalizeSemanticText).join(":")
    );
  }
  if (assertion.kind === "FRACTION") {
    expected.add(`${assertion.numerator}/${assertion.denominator}`);
  }
  if (assertion.kind === "FRACTION_RANGE") {
    expected.add(
      `${assertion.minNumerator}/${assertion.minDenominator}~${assertion.maxNumerator}/${assertion.maxDenominator}`
    );
  }
  if (assertion.timeBasis === "PER_ITEM") expected.add("1个");
  if (assertion.timeBasis === "PER_100_ML") expected.add("100毫升");
  return expected;
}

function unexpectedMeasurementExpressions(text, assertion) {
  const expected = expectedMeasurementExpressions(assertion);
  return measurementExpressions(text).filter(
    (expression) => !expected.has(normalizeSemanticText(expression))
  );
}

function assertionMeasurementPosition(text, assertion) {
  const normalized = normalizeBindingText(text);
  const tokens = [];
  if (assertion.kind === "QUANTITY") {
    tokens.push(`${assertion.value}${assertion.unit}`);
  }
  if (["RANGE", "SELECTION"].includes(assertion.kind)) {
    tokens.push(
      `${assertion.min}~${assertion.max}${assertion.unit}`,
      `${assertion.min}~${assertion.max})${assertion.unit}`,
      `${assertion.min}${assertion.unit}~${assertion.max}${assertion.unit}`
    );
  }
  if (assertion.kind === "FRACTION") {
    tokens.push(...fractionTokens(assertion.numerator, assertion.denominator));
  }
  if (assertion.kind === "FRACTION_RANGE") {
    tokens.push(
      `${assertion.minNumerator}/${assertion.minDenominator}~${assertion.maxNumerator}/${assertion.maxDenominator}`
    );
  }
  if (assertion.kind === "RATIO") {
    tokens.push(assertion.ratioValues.map(normalizeSemanticText).join(":"));
  }
  return tokens
    .map(normalizeSemanticText)
    .map((token) => normalized.indexOf(token))
    .find((index) => index >= 0) ?? -1;
}

function nearestSubjectDistance(text, subject, measurementPosition) {
  const normalized = normalizeSubjectVocabulary(text);
  const positions = subjectCandidates(subject).flatMap((candidate) =>
    tokenIndices(normalized, candidate)
  );
  if (positions.length === 0) return Number.POSITIVE_INFINITY;
  return Math.min(
    ...positions.map((position) => Math.abs(position - measurementPosition))
  );
}

function subjectsAreEquivalent(left, right) {
  const leftCandidates = subjectCandidates(left);
  const rightCandidates = subjectCandidates(right);
  return leftCandidates.some((leftCandidate) =>
    rightCandidates.some(
      (rightCandidate) =>
        leftCandidate === rightCandidate ||
        leftCandidate.includes(rightCandidate) ||
        rightCandidate.includes(leftCandidate)
    )
  );
}

function collectCompetingSubjectIssues(text, assertion, assertions, label) {
  if (!assertion.subject) return [];
  const measurementPosition = assertionMeasurementPosition(text, assertion);
  if (measurementPosition < 0) return [];
  const currentDistance = nearestSubjectDistance(
    text,
    assertion.subject,
    measurementPosition
  );
  for (const other of assertions) {
    if (
      other.id === assertion.id ||
      !other.subject ||
      subjectsAreEquivalent(assertion.subject, other.subject)
    ) {
      continue;
    }
    const otherDistance = nearestSubjectDistance(
      text,
      other.subject,
      measurementPosition
    );
    if (otherDistance < currentDistance) {
      return [
        `${label} 的测量更接近其他对象 ${other.id}，不能绑定到 ${assertion.id}`
      ];
    }
  }
  return [];
}

function sharedBindingMatchesAssertion(assertion, field, value) {
  if (field === "unit") return assertion.unit === value;
  if (field === "comparator") return assertion.comparator === value;
  if (field === "timeBasis") return assertion.timeBasis === value;
  return false;
}

function sharedBindingTextIsValid(field, binding) {
  const text = normalizeSemanticText(binding.span.text);
  if (field === "unit") return hasExactUnit(text, binding.value);
  if (field === "comparator") return comparatorIsPresent(text, binding.value);
  if (field === "timeBasis") return timeBasisIsPresent(text, binding.value);
  return false;
}

export function collectAssertionEvidenceIssues(
  assertion,
  evidenceText,
  label = "证据片段"
) {
  const issues = [];
  const evidence = normalizeSemanticText(evidenceText);
  const prefix = assertionLabel(label, assertion);
  const requireCondition = (condition, message) => {
    if (!condition) issues.push(`${prefix}${message}`);
  };

  if (assertion.kind === "QUANTITY") {
    requireCondition(
      subjectIsPresent(evidence, assertion.subject),
      "缺少对象"
    );
    requireCondition(
      quantityBindingIsPresent(evidence, assertion, "evidence"),
      `数值、单位、比较方向或时间口径未绑定到 ${assertion.value}${assertion.unit}`
    );
  }
  if (assertion.kind === "RANGE") {
    requireCondition(
      subjectIsPresent(evidence, assertion.subject),
      "缺少对象"
    );
    requireCondition(
      rangeBindingIsPresent(evidence, assertion),
      `范围、单位或时间口径未绑定到 ${assertion.min}～${assertion.max}${assertion.unit}`
    );
  }
  if (assertion.kind === "RATIO") {
    requireCondition(
      subjectsAppearInOrder(evidence, assertion.subjects),
      "缺少按顺序排列的比例对象"
    );
    requireCondition(
      evidence.includes(assertion.ratioValues.map(normalizeSemanticText).join(":")),
      `缺少同方向比例 ${assertion.ratioValues.join("∶")}`
    );
  }
  if (assertion.kind === "FORMULA") {
    requireCondition(
      evidence.includes(normalizeSemanticText(assertion.expression)),
      `缺少公式 ${assertion.expression}`
    );
  }
  if (assertion.kind === "FRACTION") {
    requireCondition(evidence.includes(normalizeSemanticText(assertion.subject)), "缺少对象");
    requireCondition(
      includesOneOf(evidence, fractionTokens(assertion.numerator, assertion.denominator)),
      `缺少分数 ${assertion.numerator}/${assertion.denominator}`
    );
    requireCondition(
      comparatorIsBoundToTokens(
        evidence,
        assertion.comparator,
        fractionTokens(assertion.numerator, assertion.denominator)
      ),
      "比较方向未与分数绑定"
    );
  }
  if (assertion.kind === "FRACTION_RANGE") {
    const range = `${assertion.minNumerator}/${assertion.minDenominator}~${assertion.maxNumerator}/${assertion.maxDenominator}`;
    requireCondition(evidence.includes(normalizeSemanticText(assertion.subject)), "缺少对象");
    requireCondition(evidence.includes(range), `缺少分数范围 ${range}`);
  }
  if (assertion.kind === "SELECTION") {
    const selectionPattern = assertion.selection === "MIN" ? /低值|下限|最小/u : /高值|上限|最大/u;
    requireCondition(evidence.includes(normalizeSemanticText(assertion.subject)), "缺少对象");
    requireCondition(
      rangeIsPresent(evidence, assertion.min, assertion.max, assertion.unit),
      `缺少候选范围 ${assertion.min}～${assertion.max}${assertion.unit}`
    );
    requireCondition(
      selectionPattern.test(evidence),
      "缺少取值方向"
    );
    requireCondition(
      assertion.result === (assertion.selection === "MIN" ? assertion.min : assertion.max),
      "选择结果与范围边界不一致"
    );
  }
  if (assertion.kind === "TEXT") {
    requireCondition(evidence.includes(normalizeSemanticText(assertion.text)), "缺少声明文本");
  }
  return issues;
}

function collectOrderedListItemIssues(
  fragment,
  group,
  item,
  assertion,
  nextItem,
  label
) {
  const issues = [];
  const subjectLabel = `${label} 的 item ${item.assertionId} subjectSpan`;
  const measurementLabel = `${label} 的 item ${item.assertionId} measurementSpan`;
  issues.push(
    ...collectSourceSpanIssues(fragment.text, item.subjectSpan, subjectLabel, group.span),
    ...collectSourceSpanIssues(
      fragment.text,
      item.measurementSpan,
      measurementLabel,
      group.span
    )
  );
  if (!assertion) return issues;
  if (!subjectIsPresent(item.subjectSpan?.text ?? "", assertion.subject ?? "")) {
    issues.push(`${label} 的 item ${item.assertionId} 对象跨度与 assertion 不一致`);
  }
  if (item.measurementSpan.start < item.subjectSpan.end) {
    issues.push(`${label} 的 item ${item.assertionId} 测量必须位于当前对象之后`);
  }
  if (nextItem && item.measurementSpan.end > nextItem.subjectSpan.start) {
    issues.push(`${label} 的 item ${item.assertionId} 测量越过了下一个对象`);
  }

  const shared = group.sharedBindings ?? {};
  for (const [field, binding] of Object.entries(shared)) {
    if (!sharedBindingMatchesAssertion(assertion, field, binding.value)) {
      issues.push(
        `${label} 的共享 ${field}=${binding.value} 与 assertion ${item.assertionId} 不一致`
      );
    }
  }
  if (!["QUANTITY", "RANGE"].includes(assertion.kind)) {
    issues.push(`${label} 的 ORDERED_LIST 只允许 QUANTITY 或 RANGE 断言`);
    return issues;
  }
  const unexpectedMeasurements = unexpectedMeasurementExpressions(
    item.measurementSpan.text,
    assertion
  );
  if (unexpectedMeasurements.length > 0) {
    issues.push(
      `${label} 的 item ${item.assertionId} measurementSpan 包含额外测量表达：${unexpectedMeasurements.join("、")}`
    );
  }

  const itemText = fragment.text.slice(
    item.subjectSpan.start,
    item.measurementSpan.end
  );
  const effectiveAssertion = {
    ...assertion,
    ...(shared.timeBasis ? { timeBasis: "NONE" } : {})
  };
  if (shared.unit || shared.comparator) {
    if (assertion.kind === "QUANTITY") {
      if (!containsNumericToken(item.measurementSpan.text, String(assertion.value))) {
        issues.push(`${label} 的 item ${item.assertionId} 缺少数值 ${assertion.value}`);
      }
      if (!shared.unit && !hasExactUnit(item.measurementSpan.text, assertion.unit)) {
        issues.push(`${label} 的 item ${item.assertionId} 缺少单位 ${assertion.unit}`);
      }
      if (
        !shared.comparator &&
        !comparatorIsBoundToTokens(
          item.measurementSpan.text,
          assertion.comparator,
          [String(assertion.value)]
        )
      ) {
        issues.push(`${label} 的 item ${item.assertionId} 比较符未绑定到数值`);
      }
      if (!subjectIsPresent(itemText, assertion.subject)) {
        issues.push(`${label} 的 item ${item.assertionId} 缺少对象`);
      }
    } else {
      const rangeToken = normalizeSemanticText(`${assertion.min}～${assertion.max}`);
      if (!normalizeSemanticText(item.measurementSpan.text).includes(rangeToken)) {
        issues.push(`${label} 的 item ${item.assertionId} 缺少范围 ${rangeToken}`);
      }
      if (!shared.unit && !hasExactUnit(item.measurementSpan.text, assertion.unit)) {
        issues.push(`${label} 的 item ${item.assertionId} 缺少单位 ${assertion.unit}`);
      }
    }
  } else {
    issues.push(
      ...collectAssertionEvidenceIssues(
        effectiveAssertion,
        itemText,
        `${label} item ${item.assertionId}`
      )
    );
  }
  return issues;
}

function collectEvidenceBindingIssues(claim, fragment, label) {
  const issues = [];
  const assertions = new Map(
    (fragment.assertions ?? []).map((assertion) => [assertion.id, assertion])
  );
  const boundAssertionIds = [];
  const bindingIds = new Set();
  const contiguousBindings = [];

  for (const binding of fragment.evidenceBindings ?? []) {
    if (bindingIds.has(binding.id)) {
      issues.push(`${label} 存在重复证据绑定 ID ${binding.id}`);
    }
    bindingIds.add(binding.id);
    const bindingLabel = `${label}/${binding.id}`;
    issues.push(
      ...collectSourceSpanIssues(fragment.text, binding.span, `${bindingLabel} span`)
    );

    if (binding.kind === "CONTIGUOUS") {
      const assertion = assertions.get(binding.assertionId);
      boundAssertionIds.push(binding.assertionId);
      if (!assertion) {
        issues.push(`${bindingLabel} 引用了不存在的 assertion ${binding.assertionId}`);
        continue;
      }
      issues.push(
        ...collectAssertionEvidenceIssues(
          assertion,
          binding.span.text,
          bindingLabel
        )
      );
      issues.push(
        ...collectCompetingSubjectIssues(
          binding.span.text,
          assertion,
          [...assertions.values()],
          bindingLabel
        )
      );
      const unexpected = unexpectedMeasurementExpressions(
        binding.span.text,
        assertion
      );
      if (unexpected.length > 0) {
        issues.push(
          `${bindingLabel} 的连续跨度包含额外测量表达：${unexpected.join("、")}`
        );
      }
      contiguousBindings.push({
        assertion,
        claimId: claim.id,
        fragment: binding.span.text
      });
      continue;
    }

    if (binding.kind === "ORDERED_LIST") {
      const items = binding.items ?? [];
      if (items.length < 2) {
        issues.push(`${bindingLabel} 的 ORDERED_LIST 至少需要两个 item`);
      }
      if (Object.keys(binding.sharedBindings ?? {}).length === 0) {
        issues.push(`${bindingLabel} 的 ORDERED_LIST 必须声明真实共享口径`);
      }
      const itemIds = items.map((item) => item.assertionId);
      boundAssertionIds.push(...itemIds);
      if (new Set(itemIds).size !== itemIds.length) {
        issues.push(`${bindingLabel} 的 items 存在重复 assertionId`);
      }
      for (const [field, sharedBinding] of Object.entries(
        binding.sharedBindings ?? {}
      )) {
        issues.push(
          ...collectSourceSpanIssues(
            fragment.text,
            sharedBinding.span,
            `${bindingLabel} sharedBindings.${field}`,
            binding.span
          )
        );
        if (!sharedBindingTextIsValid(field, sharedBinding)) {
          issues.push(`${bindingLabel} 的共享 ${field} 原文跨度与声明值不一致`);
        }
        const firstMeasurementStart = items[0]?.measurementSpan?.start;
        if (
          Number.isInteger(firstMeasurementStart) &&
          sharedBinding.span.end > firstMeasurementStart
        ) {
          issues.push(`${bindingLabel} 的共享 ${field} 必须位于首个测量之前`);
        }
      }
      for (const [index, item] of items.entries()) {
        const previousItem = items[index - 1];
        if (
          previousItem &&
          (item.subjectSpan.start <= previousItem.subjectSpan.start ||
            item.measurementSpan.start <= previousItem.measurementSpan.start)
        ) {
          issues.push(`${bindingLabel} 的 item 必须按原文对象和数值顺序递增`);
        }
        issues.push(
          ...collectOrderedListItemIssues(
            fragment,
            binding,
            item,
            assertions.get(item.assertionId),
            items[index + 1],
            bindingLabel
          )
        );
      }
    }
  }

  const duplicates = boundAssertionIds.filter(
    (id, index) => boundAssertionIds.indexOf(id) !== index
  );
  if (duplicates.length > 0) {
    issues.push(`${label} 的 assertion 被多个证据模型重复绑定：${[...new Set(duplicates)].join("、")}`);
  }
  const missing = [...assertions.keys()].filter(
    (id) => !boundAssertionIds.includes(id)
  );
  if (missing.length > 0) {
    issues.push(`${label} 的 assertion 未归属证据模型：${missing.join("、")}`);
  }
  const unknown = boundAssertionIds.filter((id) => !assertions.has(id));
  if (unknown.length > 0) {
    issues.push(`${label} 的证据模型引用组外 assertion：${[...new Set(unknown)].join("、")}`);
  }
  issues.push(
    ...collectTargetFragmentAtomicityIssues(
      "evidence",
      contiguousBindings
    )
  );
  return issues;
}

function collectAssertionTargetIssues(assertion, targetText, targetKind, label) {
  const issues = [];
  const target = normalizeSemanticText(targetText);
  const prefix = assertionLabel(label, assertion);
  const requireCondition = (condition, message) => {
    if (!condition) issues.push(`${prefix}${message}`);
  };

  if (assertion.kind === "QUANTITY") {
    requireCondition(subjectIsPresent(target, assertion.subject), "缺少对象");
    requireCondition(
      quantityBindingIsPresent(target, assertion, targetKind),
      `数值、单位、比较方向或时间口径未绑定到 ${assertion.value}${assertion.unit}`
    );
  }
  if (assertion.kind === "RANGE") {
    requireCondition(subjectIsPresent(target, assertion.subject), "缺少对象");
    requireCondition(
      rangeBindingIsPresent(target, assertion),
      `范围、单位或时间口径未绑定到 ${assertion.min}～${assertion.max}${assertion.unit}`
    );
    requireCondition(hasExactUnit(target, assertion.unit), `缺少精确单位 ${assertion.unit}`);
  }
  if (assertion.kind === "RATIO") {
    requireCondition(
      ratioSubjectsAppearInOrder(target, assertion.subjects),
      "缺少按顺序排列的比例对象"
    );
    requireCondition(
      target.includes(assertion.ratioValues.map(normalizeSemanticText).join(":")),
      `缺少同方向比例 ${assertion.ratioValues.join("∶")}`
    );
  }
  if (assertion.kind === "FORMULA") {
    const expression = normalizeSemanticText(assertion.expression);
    const rightHandSide = expression.includes("=") ? expression.split("=").at(-1) : expression;
    requireCondition(
      targetKind === "statement"
        ? target.includes(expression)
        : target.includes(expression) || target.includes(rightHandSide),
      `缺少公式 ${assertion.expression}`
    );
  }
  if (assertion.kind === "FRACTION") {
    requireCondition(subjectIsPresent(target, assertion.subject), "缺少对象");
    requireCondition(
      includesOneOf(target, fractionTokens(assertion.numerator, assertion.denominator)),
      `缺少分数 ${assertion.numerator}/${assertion.denominator}`
    );
    requireCondition(
      comparatorIsBoundToTokens(
        target,
        assertion.targetComparators?.[targetKind]?.comparator ?? assertion.comparator,
        fractionTokens(assertion.numerator, assertion.denominator)
      ),
      "比较方向未与分数绑定"
    );
  }
  if (assertion.kind === "FRACTION_RANGE") {
    const range = `${assertion.minNumerator}/${assertion.minDenominator}~${assertion.maxNumerator}/${assertion.maxDenominator}`;
    requireCondition(subjectIsPresent(target, assertion.subject), "缺少对象");
    requireCondition(target.includes(range), `缺少分数范围 ${range}`);
  }
  if (assertion.kind === "SELECTION") {
    requireCondition(subjectIsPresent(target, assertion.subject), "缺少对象");
    requireCondition(containsNumericToken(target, String(assertion.result)), `缺少选择结果 ${assertion.result}`);
    requireCondition(hasExactUnit(target, assertion.unit), `缺少精确单位 ${assertion.unit}`);
    if (targetKind === "statement") {
      const selectionPattern = assertion.selection === "MIN" ? /低值|下限|最小/u : /高值|上限|最大/u;
      requireCondition(selectionPattern.test(target), "缺少取值方向");
    }
  }
  if (assertion.kind === "TEXT") {
    requireCondition(
      target.includes(normalizeSemanticText(assertion.text)),
      `缺少声明文本 ${assertion.text}`
    );
  }
  return issues;
}

export function collectClaimAssertionIssues(claim) {
  const issues = [];
  const assertionIds = new Set();
  let coversStatement = false;
  let coversReferenceValue = false;
  let assertionCount = 0;
  let evidenceOnlyCount = 0;
  const targetBindings = { statement: [], referenceValue: [] };
  for (const [sourceIndex, source] of (claim.sources ?? []).entries()) {
    const fragmentIds = new Set();
    for (const fragment of source.evidenceFragments ?? []) {
      if (fragmentIds.has(fragment.id)) {
        issues.push(`${claim.id} 的来源 ${sourceIndex + 1} 存在重复证据片段 ID ${fragment.id}`);
      }
      fragmentIds.add(fragment.id);
      const evidenceLabel = `${claim.id}/${fragment.id}`;
      issues.push(
        ...collectEvidenceBindingIssues(claim, fragment, evidenceLabel)
      );
      for (const assertion of fragment.assertions ?? []) {
        assertionCount += 1;
        if (assertion.claimScope === "EVIDENCE_ONLY") evidenceOnlyCount += 1;
        if (assertionIds.has(assertion.id)) {
          issues.push(`${claim.id} 存在重复断言 ID ${assertion.id}`);
        }
        assertionIds.add(assertion.id);
        issues.push(...collectComparatorOverrideIssues(claim, assertion));
        const targets = [];
        if (["BOTH", "STATEMENT_ONLY"].includes(assertion.claimScope)) {
          coversStatement = true;
          targets.push([
            claim.statement,
            assertion.targetFragments?.statement,
            "statement",
            `${claim.id} statement`
          ]);
        }
        if (["BOTH", "REFERENCE_ONLY"].includes(assertion.claimScope)) {
          coversReferenceValue = true;
          targets.push([
            `${claim.referenceLabel ?? ""}：${claim.referenceValue ?? ""}`,
            assertion.targetFragments?.referenceValue,
            "referenceValue",
            `${claim.id} referenceValue`
          ]);
        }
        for (const [target, targetFragment, targetKind, targetLabel] of targets) {
          const normalizedTarget = normalizeSemanticText(target ?? "");
          const normalizedFragment = normalizeSemanticText(targetFragment ?? "");
          if (!normalizedFragment || !normalizedTarget.includes(normalizedFragment)) {
            issues.push(
              `${claim.id} 的断言 ${assertion.id} 的 ${targetKind} 目标片段不是目标文本的真实子串`
            );
            continue;
          }
          targetBindings[targetKind].push({
            assertion,
            claimId: claim.id,
            fragment: targetFragment
          });
          issues.push(
            ...collectAssertionTargetIssues(
              assertion,
              targetFragment,
              targetKind,
              targetLabel
            )
          );
        }
      }
    }
  }
  issues.push(
    ...collectTargetFragmentAtomicityIssues("statement", targetBindings.statement),
    ...collectTargetFragmentAtomicityIssues(
      "referenceValue",
      targetBindings.referenceValue
    )
  );
  if (
    ["NUMERIC", "FORMULA"].includes(claim.claimType) &&
    verifiedStatuses.has(claim.verificationStatus)
  ) {
    if (!coversStatement) issues.push(`${claim.id} 的已核验结论没有断言覆盖 statement`);
    if (!coversReferenceValue) {
      issues.push(`${claim.id} 的已核验结论没有断言覆盖 referenceValue`);
    }
    if (assertionCount > 0 && evidenceOnlyCount === assertionCount) {
      issues.push(`${claim.id} 的已核验结论不能只包含 EVIDENCE_ONLY 断言`);
    }
  }
  return issues;
}

export function collectEvidenceBindingStats(claims) {
  const stats = {
    assertionCount: 0,
    contiguousCount: 0,
    orderedListCount: 0,
    orderedListAssertionCount: 0,
    humanReviewRequiredCount: 0,
    humanReviewedCount: 0
  };
  for (const claim of claims) {
    for (const source of claim.sources ?? []) {
      for (const fragment of source.evidenceFragments ?? []) {
        stats.assertionCount += fragment.assertions?.length ?? 0;
        for (const binding of fragment.evidenceBindings ?? []) {
          if (binding.kind === "CONTIGUOUS") stats.contiguousCount += 1;
          if (binding.kind === "ORDERED_LIST") {
            stats.orderedListCount += 1;
            stats.orderedListAssertionCount += binding.items?.length ?? 0;
          }
          if (binding.semanticReview?.status === "HUMAN_REVIEW_REQUIRED") {
            stats.humanReviewRequiredCount += 1;
          }
          if (binding.semanticReview?.status === "HUMAN_REVIEWED") {
            stats.humanReviewedCount += 1;
          }
        }
      }
    }
  }
  return stats;
}

export function collectSchemaIssues(claims, schema) {
  const issues = [];
  const ajv = new Ajv2020({ allErrors: true, strict: true, strictRequired: false });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  for (const claim of claims) {
    if (validate(claim)) continue;
    issues.push(
      `${claim.id ?? "未知条目"} 不符合 schema.json：${ajv.errorsText(validate.errors, {
        separator: "；"
      })}`
    );
  }
  return issues;
}

function validateClaimRelationships(claims, report) {
  const ids = new Set();
  const questions = new Set();
  for (const claim of claims) {
    addFailure(report, !ids.has(claim.id), `${claim.id} 的 ID 重复`);
    ids.add(claim.id);
    addFailure(report, !questions.has(claim.question), `${claim.id} 的问题与其他条目重复`);
    questions.add(claim.question);
    for (const source of claim.sources) {
      addFailure(
        report,
        source.tocPosition <= source.tocTotal,
        `${claim.id} 的 tocPosition 超出 tocTotal`
      );
    }
  }

  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  for (const claim of claims) {
    for (const conflictId of claim.conflicts) {
      const conflict = claimsById.get(conflictId);
      addFailure(report, Boolean(conflict), `${claim.id} 引用了不存在的冲突 ${conflictId}`);
      addFailure(
        report,
        conflict?.conflicts.includes(claim.id),
        `${claim.id} 与 ${conflictId} 的冲突关系不是双向的`
      );
    }
  }

  const omegaRatio = claimsById.get("B1-FAT-006");
  addFailure(report, Boolean(omegaRatio), "缺少必需脂肪酸推荐比例 B1-FAT-006");
  addFailure(
    report,
    omegaRatio?.referenceValue === "ω-3∶ω-6＝1∶4～6",
    "B1-FAT-006 必须保持原书方向：ω-3∶ω-6＝1∶4～6"
  );
}

function validateCoverageShape(coverage, report) {
  addFailure(report, /^\d{4}-\d{2}-\d{2}$/u.test(coverage.updatedAt), "覆盖数据缺少有效 updatedAt");
  addFailure(report, Array.isArray(coverage.books), "覆盖数据的 books 必须是数组");
  const sectionIds = new Set();
  for (const book of coverage.books ?? []) {
    addFailure(report, Boolean(book.bookId), "覆盖数据中的书籍缺少 bookId");
    addFailure(report, Boolean(book.bookTitle), `${book.bookId ?? "未知书籍"} 缺少 bookTitle`);
    addFailure(
      report,
      Number.isInteger(book.tocTotal) && book.tocTotal > 0,
      `${book.bookId ?? "未知书籍"} 的 tocTotal 无效`
    );
    addFailure(report, Array.isArray(book.sections), `${book.bookId ?? "未知书籍"} 的 sections 必须是数组`);
    for (const section of book.sections ?? []) {
      const label = `${book.bookId ?? "未知书籍"}:${section.section ?? "未知章节"}`;
      addFailure(report, Boolean(section.sectionId), `${label} 缺少 sectionId`);
      addFailure(report, !sectionIds.has(section.sectionId), `${label} 的 sectionId 重复`);
      sectionIds.add(section.sectionId);
      addFailure(report, Boolean(section.section), `${label} 缺少 section`);
      addFailure(report, Boolean(section.epubRange), `${label} 缺少 epubRange`);
      addFailure(report, Array.isArray(section.handbookTargets), `${label} 的 handbookTargets 必须是数组`);
      addFailure(report, Boolean(section.note), `${label} 缺少 note`);
      for (const dimension of ["outline", "corePrinciples", "numericClaims", "allClaims"]) {
        addFailure(
          report,
          validCoverageStatuses.has(section.readerCoverage?.[dimension]),
          `${label} 的 readerCoverage.${dimension} 覆盖状态无效`
        );
        addFailure(
          report,
          validCoverageStatuses.has(section.auditedCoverage?.[dimension]?.status),
          `${label} 的 auditedCoverage.${dimension}.status 覆盖状态无效`
        );
      }
    }
  }
}

const claimDimensions = {
  corePrinciples: (claim) => ["PRINCIPLE", "DEFINITION"].includes(claim.claimType),
  numericClaims: (claim) => ["NUMERIC", "FORMULA"].includes(claim.claimType),
  allClaims: () => true
};

function sameStringSet(left, right) {
  return (
    JSON.stringify([...(left ?? [])].sort()) ===
    JSON.stringify([...(right ?? [])].sort())
  );
}

export function collectCoverageConsistencyIssues(claims, coverage) {
  const issues = [];
  const sections = (coverage.books ?? []).flatMap((book) =>
    (book.sections ?? []).map((section) => ({ ...section, bookId: book.bookId }))
  );
  const sectionsById = new Map(sections.map((section) => [section.sectionId, section]));
  for (const claim of claims) {
    const section = sectionsById.get(claim.coverageSectionId);
    if (!section) {
      issues.push(`${claim.id} 引用了不存在的覆盖章节 ${claim.coverageSectionId}`);
      continue;
    }
    if (claim.sources.some((source) => source.bookId !== section.bookId)) {
      issues.push(`${claim.id} 的覆盖章节与原书编号不一致`);
    }
  }

  for (const section of sections) {
    const outline = section.auditedCoverage?.outline;
    if (outline?.status === "VERIFIED") {
      if (!Array.isArray(outline.expectedOutlineEntries) || outline.expectedOutlineEntries.length === 0) {
        issues.push(`${section.sectionId} 的目录标为 VERIFIED，但没有完整预期目录清单`);
      }
    }

    for (const [dimensionName, predicate] of Object.entries(claimDimensions)) {
      const dimension = section.auditedCoverage?.[dimensionName];
      if (!dimension) {
        issues.push(`${section.sectionId} 缺少 auditedCoverage.${dimensionName}`);
        continue;
      }
      const actualClaims = claims.filter(
        (claim) =>
          claim.coverageSectionId === section.sectionId &&
          predicate(claim) &&
          isPublishableClaim(claim)
      );
      const actualIds = actualClaims.map((claim) => claim.id);
      if (!sameStringSet(actualIds, dimension.includedClaimIds)) {
        issues.push(`${section.sectionId} 的 ${dimensionName} includedClaimIds 与实际 claim 不一致`);
      }
      if (dimension.status === "PARTIAL" && actualIds.length === 0) {
        issues.push(`${section.sectionId} 的 ${dimensionName} 标为 PARTIAL，但没有对应 claim`);
      }
      if (["NOT_STARTED", "NOT_APPLICABLE"].includes(dimension.status) && actualIds.length > 0) {
        issues.push(`${section.sectionId} 的 ${dimensionName} 已有 claim，不能标为 ${dimension.status}`);
      }
      if (dimension.status === "VERIFIED") {
        if (!Array.isArray(dimension.expectedClaimIds) || dimension.expectedClaimIds.length === 0) {
          issues.push(`${section.sectionId} 的 ${dimensionName} 标为 VERIFIED，但没有完整预期清单`);
        } else if (!sameStringSet(actualIds, dimension.expectedClaimIds)) {
          issues.push(`${section.sectionId} 的 ${dimensionName} claim 与完整预期清单不一致`);
        }
        if (actualClaims.some((claim) => !verifiedStatuses.has(claim.verificationStatus))) {
          issues.push(`${section.sectionId} 的 ${dimensionName} 标为 VERIFIED，但仍有 claim 未完成原文核对`);
        }
      }
    }
  }
  return issues;
}

function validateBooks(booksData, coverage, report) {
  addFailure(report, Array.isArray(booksData.books), "books.json 的 books 必须是数组");
  const ids = new Set();
  for (const book of booksData.books ?? []) {
    addFailure(report, /^BOOK_[12]$/u.test(book.bookId), "books.json 包含无效 bookId");
    addFailure(report, !ids.has(book.bookId), `books.json 的 ${book.bookId} 重复`);
    ids.add(book.bookId);
    addFailure(report, Boolean(book.bookTitle), `${book.bookId} 缺少 bookTitle`);
    addFailure(report, /\.epub$/u.test(book.fileName), `${book.bookId} 的 fileName 必须是 EPUB`);
    addFailure(report, /^[a-f0-9]{64}$/u.test(book.sha256), `${book.bookId} 的 SHA-256 无效`);
    addFailure(report, Boolean(book.tocFile), `${book.bookId} 缺少 tocFile`);
    addFailure(
      report,
      Number.isInteger(book.tocTotal) && book.tocTotal > 0,
      `${book.bookId} 的 tocTotal 无效`
    );
  }
  for (const coverageBook of coverage.books ?? []) {
    addFailure(
      report,
      ids.has(coverageBook.bookId),
      `覆盖矩阵中的 ${coverageBook.bookId} 未在 books.json 登记`
    );
  }
}

function readZipDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 65_557);
  let endOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("找不到 ZIP 中央目录");

  const entryCount = buffer.readUInt16LE(endOffset + 10);
  let offset = buffer.readUInt32LE(endOffset + 16);
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error(`ZIP 中央目录第 ${index + 1} 项损坏`);
    }
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");
    entries.push({ name, method, compressedSize, localHeaderOffset });
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function extractZipEntry(buffer, entry) {
  const offset = entry.localHeaderOffset;
  if (buffer.readUInt32LE(offset) !== 0x04034b50) {
    throw new Error(`${entry.name} 的 ZIP 本地文件头损坏`);
  }
  const fileNameLength = buffer.readUInt16LE(offset + 26);
  const extraLength = buffer.readUInt16LE(offset + 28);
  const start = offset + 30 + fileNameLength + extraLength;
  const compressed = buffer.subarray(start, start + entry.compressedSize);
  if (entry.method === 0) return compressed;
  if (entry.method === 8) return inflateRawSync(compressed);
  throw new Error(`${entry.name} 使用了不支持的 ZIP 压缩方法 ${entry.method}`);
}

function parseNcx(ncxText) {
  const items = [];
  const expression = /<navPoint\b[^>]*>[\s\S]*?<navLabel\b[^>]*>[\s\S]*?<text\b[^>]*>([\s\S]*?)<\/text>[\s\S]*?<\/navLabel>[\s\S]*?<content\b[^>]*\bsrc=(["'])(.*?)\2/giu;
  for (const match of ncxText.matchAll(expression)) {
    items.push({
      label: decodeHtml(match[1]).trim(),
      source: decodeURIComponent(match[3]).split("#", 1)[0]
    });
  }
  return items;
}

function findZipEntry(entries, requestedName) {
  return entries.filter(
    (entry) => entry.name === requestedName || basename(entry.name) === basename(requestedName)
  );
}

function outlineHash(navigation, startPosition, endPosition) {
  const canonical = navigation
    .slice(startPosition - 1, endPosition)
    .map(
      (item, index) =>
        `${startPosition + index}|${basename(item.source)}|${normalizeText(item.label)}`
    )
    .join("\n");
  return createHash("sha256").update(canonical, "utf8").digest("hex");
}

function parseDeclaredEpubRange(value) {
  const tokens = value.match(/(?:index_split_|part)?\d+/gu) ?? [];
  if (tokens.length === 0) return null;
  const firstMatch = tokens[0].match(/^(index_split_|part)(\d+)$/u);
  if (!firstMatch) return null;
  const prefix = firstMatch[1];
  const normalizeStem = (token) => (token.startsWith(prefix) ? token : `${prefix}${token}`);
  return {
    first: normalizeStem(tokens[0]),
    last: normalizeStem(tokens.at(-1))
  };
}

function epubStem(source) {
  const file = basename(source);
  return file.slice(0, file.length - extname(file).length);
}

function verifyOutlineCoverage(coverage, loadedBooks, unavailableBooks, report) {
  for (const bookCoverage of coverage.books ?? []) {
    if (unavailableBooks.has(bookCoverage.bookId)) continue;
    const loaded = loadedBooks.get(bookCoverage.bookId);
    if (!loaded) continue;
    for (const section of bookCoverage.sections ?? []) {
      const outline = section.auditedCoverage?.outline;
      if (outline?.status !== "VERIFIED") continue;
      const entries = outline.expectedOutlineEntries ?? [];
      for (const entry of entries) {
        const validPositions =
          Number.isInteger(entry.startPosition) &&
          Number.isInteger(entry.endPosition) &&
          entry.startPosition >= 1 &&
          entry.endPosition >= entry.startPosition &&
          entry.endPosition <= loaded.navigation.length;
        addFailure(report, validPositions, `${section.sectionId} 的预期 NCX 位置范围无效`);
        if (!validPositions) continue;
        const actualCount = entry.endPosition - entry.startPosition + 1;
        addFailure(
          report,
          actualCount === entry.expectedCount,
          `${section.sectionId} 的预期 NCX 数量与位置范围不一致`
        );
        const actualHash = outlineHash(
          loaded.navigation,
          entry.startPosition,
          entry.endPosition
        );
        addFailure(
          report,
          actualHash === entry.sha256,
          `${section.sectionId} 的 NCX 范围内容或顺序发生变化（实际 ${actualHash}）`
        );
      }

      const declaredRange = parseDeclaredEpubRange(section.epubRange);
      addFailure(report, Boolean(declaredRange), `${section.sectionId} 的 epubRange 无法解析`);
      if (!declaredRange || entries.length === 0) continue;
      const firstPosition = Math.min(...entries.map((entry) => entry.startPosition));
      const lastPosition = Math.max(...entries.map((entry) => entry.endPosition));
      const firstNavigation = loaded.navigation[firstPosition - 1];
      const lastNavigation = loaded.navigation[lastPosition - 1];
      addFailure(
        report,
        Boolean(firstNavigation) && epubStem(firstNavigation.source) === declaredRange.first,
        `${section.sectionId} 的 epubRange 起点与 NCX 不一致`
      );
      addFailure(
        report,
        Boolean(lastNavigation) && epubStem(lastNavigation.source) === declaredRange.last,
        `${section.sectionId} 的 epubRange 终点与 NCX 不一致`
      );
    }
  }
}

async function verifyEpubSources(claims, booksData, coverage, options, report) {
  const loadedBooks = new Map();
  const unavailableBooks = new Set();
  for (const book of booksData.books) {
    const path = resolve(options.epubDirectory, book.fileName);
    let buffer;
    try {
      buffer = await readFile(path);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
      unavailableBooks.add(book.bookId);
      if (options.allowMissingEpub) {
        report.warnings.push(`${book.fileName} 不存在`);
      } else {
        report.failures.push(`${book.fileName} 不存在；严格核验不能跳过原书`);
      }
      continue;
    }

    const actualHash = createHash("sha256").update(buffer).digest("hex");
    addFailure(
      report,
      actualHash === book.sha256,
      `${book.fileName} 的 SHA-256 与 books.json 登记版本不一致`
    );
    const entries = readZipDirectory(buffer);
    const tocMatches = findZipEntry(entries, book.tocFile);
    addFailure(
      report,
      tocMatches.length === 1,
      `${book.fileName} 应唯一包含 ${book.tocFile}，实际 ${tocMatches.length} 个`
    );
    if (tocMatches.length !== 1) continue;
    const navigation = parseNcx(extractZipEntry(buffer, tocMatches[0]).toString("utf8"));
    addFailure(
      report,
      navigation.length === book.tocTotal,
      `${book.fileName} 的 NCX 目录数应为 ${book.tocTotal}，实际 ${navigation.length}`
    );
    loadedBooks.set(book.bookId, { book, buffer, entries, navigation, pageCache: new Map() });
  }

  verifyOutlineCoverage(coverage, loadedBooks, unavailableBooks, report);

  for (const claim of claims) {
    for (const source of claim.sources) {
      if (unavailableBooks.has(source.bookId)) continue;
      const loaded = loadedBooks.get(source.bookId);
      addFailure(report, Boolean(loaded), `${claim.id} 的书籍 ${source.bookId} 未成功加载`);
      if (!loaded) continue;
      addFailure(
        report,
        source.bookTitle === loaded.book.bookTitle,
        `${claim.id} 的 bookTitle 与 books.json 不一致`
      );
      addFailure(
        report,
        source.tocTotal === loaded.book.tocTotal,
        `${claim.id} 的 tocTotal 与 books.json 不一致`
      );

      const navItem = loaded.navigation[source.tocPosition - 1];
      addFailure(report, Boolean(navItem), `${claim.id} 的 tocPosition 在 NCX 中不存在`);
      if (navItem) {
        addFailure(
          report,
          basename(navItem.source) === source.epubFile,
          `${claim.id} 的 tocPosition 未指向 ${source.epubFile}`
        );
        const navLabel = normalizeText(navItem.label);
        const chapter = normalizeText(source.chapter);
        addFailure(
          report,
          navLabel.includes(chapter) || chapter.includes(navLabel),
          `${claim.id} 的章节名与 NCX 不一致：${source.chapter} / ${navItem.label}`
        );
        const partKey = normalizeText(source.part);
        const partItem = loaded.navigation
          .slice(0, source.tocPosition)
          .reverse()
          .find((item) => /^PART\d{2}/iu.test(normalizeText(item.label)));
        addFailure(
          report,
          Boolean(partItem) && normalizeText(partItem.label).includes(partKey),
          `${claim.id} 的 PART 与 NCX 上下文不一致`
        );
      }

      const pageMatches = findZipEntry(loaded.entries, source.epubFile);
      addFailure(
        report,
        pageMatches.length === 1,
        `${claim.id} 在 ${loaded.book.fileName} 中应唯一定位 ${source.epubFile}，实际 ${pageMatches.length} 个`
      );
      if (pageMatches.length !== 1) continue;
      if (!loaded.pageCache.has(source.epubFile)) {
        loaded.pageCache.set(
          source.epubFile,
          decodeHtml(extractZipEntry(loaded.buffer, pageMatches[0]).toString("utf8"))
        );
      }
      const pageText = loaded.pageCache.get(source.epubFile);
      const anchors = [
        ...source.evidenceFragments.map((fragment) => fragment.text),
        ...source.sourceKeywords
      ];
      for (const anchor of anchors) {
        addFailure(
          report,
          normalizeSemanticText(pageText).includes(normalizeSemanticText(anchor)),
          `${claim.id} 在 ${source.epubFile} 中找不到证据：${anchor}`
        );
      }
    }
  }

  return unavailableBooks;
}

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listMarkdownFiles(path)));
    if (entry.isFile() && extname(entry.name) === ".md") files.push(path);
  }
  return files;
}

async function verifyMarkdown(report) {
  const files = await listMarkdownFiles(handbookDirectory);
  files.push(resolve(projectRoot, "docs/book-knowledge-handbook.md"));
  for (const path of files) {
    const text = await readFile(path, "utf8");
    const headings = [...text.matchAll(/^(#{1,6})\s+.+$/gmu)].map(
      (match) => match[1].length
    );
    addFailure(
      report,
      headings.filter((level) => level === 1).length === 1,
      `${path} 必须有且只有一个 H1`
    );
    for (let index = 1; index < headings.length; index += 1) {
      addFailure(
        report,
        headings[index] <= headings[index - 1] + 1,
        `${path} 存在标题层级跳跃`
      );
    }

    for (const match of text.matchAll(/\[[^\]]+\]\(([^)]+)\)/gu)) {
      let target = match[1].trim();
      if (/^(?:https?:|mailto:|#)/u.test(target)) continue;
      if (target.startsWith("<") && target.endsWith(">")) {
        target = target.slice(1, -1);
      }
      target = decodeURIComponent(target.split("#", 1)[0]);
      try {
        await readFile(resolve(dirname(path), target));
      } catch (error) {
        if (error.code === "EISDIR") continue;
        addFailure(report, false, `${path} 包含无效链接 ${match[1]}`);
      }
    }
  }
}

async function verifyGeneratedArtifacts(claims, coverage, report) {
  const expectedFiles = new Map([
    [resolve(handbookDirectory, "numeric-reference.md"), buildNumericReference(claims)],
    [resolve(handbookDirectory, "coverage-matrix.md"), buildCoverageMatrix(coverage)],
    [resolve(handbookDirectory, "manual-review.md"), buildManualReview(claims)],
    [
      resolve(handbookDirectory, "generated/learning-cards.json"),
      buildLearningCards(claims)
    ],
    [
      resolve(handbookDirectory, "generated/learning-cards-draft.json"),
      buildDraftLearningCards(claims)
    ]
  ]);
  for (const [path, expected] of expectedFiles) {
    let actual = "";
    try {
      actual = await readFile(path, "utf8");
    } catch (error) {
      if (error.code === "ENOENT") {
        report.failures.push(`${path} 尚未生成`);
        continue;
      }
      throw error;
    }
    addFailure(
      report,
      actual === expected,
      `${path} 与结构化数据不一致，请先运行 npm run book:generate`
    );
  }
}

async function verifyAppKnowledgeConsistency(claims, report) {
  const appKnowledge = await readFile(
    resolve(projectRoot, "src/domain/knowledge/bookKnowledge.ts"),
    "utf8"
  );
  const normalizedAppKnowledge = normalizeText(appKnowledge);
  const claimsById = new Map(claims.map((claim) => [claim.id, claim]));
  const contracts = [
    {
      id: "B1-ENERGY-001",
      referenceValue: "身高（厘米）－105",
      appAnchor: "标准体重（kg）=身高（cm）−105"
    },
    {
      id: "B1-ENERGY-002",
      referenceValue: "卧床25千卡/千克、轻体力30千卡/千克、中体力35千卡/千克、重体力40千卡/千克",
      appAnchor: "长期卧床、轻、中、重体力的活动系数分别是25、30、35、40 kcal/kg"
    },
    {
      id: "B1-ENERGY-004",
      referenceValue: "碳水化合物低值55%，蛋白质高值15%，脂类高值30%",
      appAnchor: "健康模式采用碳水55%、蛋白质15%、脂肪30%"
    },
    {
      id: "B1-WATER-001",
      referenceValue: "一般1200～1500毫升/日",
      appAnchor: "普通情况下书中建议每天直接饮水1200～1500毫升"
    }
  ];
  for (const contract of contracts) {
    const claim = claimsById.get(contract.id);
    addFailure(report, Boolean(claim), `跨层一致性契约缺少结构化条目 ${contract.id}`);
    addFailure(
      report,
      claim?.referenceValue === contract.referenceValue,
      `${contract.id} 的结构化规范值发生变化`
    );
    addFailure(
      report,
      normalizedAppKnowledge.includes(normalizeText(contract.appAnchor)),
      `${contract.id} 与 bookKnowledge.ts 的应用表述不一致`
    );
  }
}

export async function runVerification(options = {}) {
  const report = {
    failures: [],
    warnings: [],
    unavailableBooks: new Set(),
    claimCount: 0,
    bindingStats: null
  };
  const settings = {
    allowMissingEpub: options.allowMissingEpub ?? false,
    epubDirectory: options.epubDirectory ?? projectRoot
  };
  const [claims, coverage, booksData, schema] = await Promise.all([
    readClaims(),
    readCoverage(),
    readBooks(),
    readFile(resolve(dataDirectory, "schema.json"), "utf8").then(JSON.parse)
  ]);
  report.claimCount = claims.length;
  report.bindingStats = collectEvidenceBindingStats(claims);
  report.failures.push(...collectSchemaIssues(claims, schema));
  for (const claim of claims) {
    report.failures.push(...collectClaimAssertionIssues(claim));
  }
  validateClaimRelationships(claims, report);
  validateCoverageShape(coverage, report);
  report.failures.push(...collectCoverageConsistencyIssues(claims, coverage));
  validateBooks(booksData, coverage, report);
  await verifyGeneratedArtifacts(claims, coverage, report);
  await verifyAppKnowledgeConsistency(claims, report);
  await verifyMarkdown(report);
  report.unavailableBooks = await verifyEpubSources(
    claims,
    booksData,
    coverage,
    settings,
    report
  );
  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const allowedArgs = new Set(["--allow-missing-epub"]);
  const unknownArg = args.find((arg) => !allowedArgs.has(arg));
  if (unknownArg) throw new Error(`未知参数：${unknownArg}`);
  const epubDirectory = process.env.BOOK_HANDBOOK_EPUB_DIR
    ? resolve(process.env.BOOK_HANDBOOK_EPUB_DIR)
    : projectRoot;
  const report = await runVerification({
    allowMissingEpub: args.includes("--allow-missing-epub"),
    epubDirectory
  });
  const bindingSummary = `CONTIGUOUS ${report.bindingStats.contiguousCount} 条，ORDERED_LIST ${report.bindingStats.orderedListCount} 组/${report.bindingStats.orderedListAssertionCount} 条断言，人工语义复核待办 ${report.bindingStats.humanReviewRequiredCount} 条、已复核 ${report.bindingStats.humanReviewedCount} 条`;
  for (const warning of report.warnings) console.warn(`警告：${warning}`);
  if (report.failures.length > 0) {
    for (const failure of report.failures) console.error(`失败：${failure}`);
    throw new Error(`手册核验失败，共 ${report.failures.length} 项。`);
  }
  if (report.unavailableBooks.size > 0) {
    console.log(
      `结构校验通过：${report.claimCount} 条结构化知识；原文校验跳过：缺少 ${[
        ...report.unavailableBooks
      ].join("、")}；${bindingSummary}。`
    );
    return;
  }
  console.log(
    `手册证据契约核验通过：${report.claimCount} 条结构化知识；${bindingSummary}。Schema、EPUB版本、NCX导航、证据跨度、四维覆盖、派生文件、链接与冲突关系一致；人工复核待办不代表程序已证明指代语义。`
  );
}

if (resolve(process.argv[1] ?? "") === fileURLToPath(import.meta.url)) {
  await main();
}
