import { useState } from "react";
import { Navigate, NavLink, useParams } from "react-router-dom";
import {
  BOOK_CHAPTERS,
  bookLocationLabel,
  findBookChapter,
  type BookChapterKnowledge,
  type BookKnowledgeCategory,
  type BookKnowledgeItem,
  type BookKnowledgeSourceKind
} from "./domain/knowledge/bookKnowledge";

const BOOK_SOURCE_KIND_LABELS: Record<BookKnowledgeSourceKind, string> = {
  BOOK_DIRECT: "书中明确",
  BOOK_CASE: "书中案例",
  APP_DERIVED: "应用推导",
  SAFETY: "安全提示"
};

const BOOK_KNOWLEDGE_CATEGORY_LABELS: Record<BookKnowledgeCategory, string> = {
  NUTRIENT: "营养素基础",
  MICRONUTRIENT: "维生素与矿物质",
  FOOD_SELECTION: "食物选择",
  MEAL_PLANNING: "一日搭配",
  RECORD_SAFETY: "记录与安全"
};

function normalizedSearch(value: string): string {
  return value.trim().toLocaleLowerCase("zh-CN").replace(/\s+/g, "");
}

function PageIntro({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <section className="page-intro"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></section>;
}

function KnowledgeSourceChip({ kind }: { kind: BookKnowledgeSourceKind }) {
  return <small className={`knowledge-source-chip source-${kind.toLowerCase()}`}>{BOOK_SOURCE_KIND_LABELS[kind]}</small>;
}

function KnowledgeList({ items }: { items: BookKnowledgeItem[] }) {
  return <ul className="knowledge-list">{items.map((item) => <li key={`${item.sourceKind}:${item.text}`}><span>{item.text}</span><KnowledgeSourceChip kind={item.sourceKind} /></li>)}</ul>;
}

export function BookChapterCard({ chapter }: { chapter: BookChapterKnowledge }) {
  return (
    <article className="card book-chapter-card">
      <NavLink className="book-chapter-link" to={`/book/${chapter.id}`}>
        <h2>{chapter.source.chapterTitle}</h2>
        <span aria-hidden="true">→</span>
      </NavLink>
    </article>
  );
}

function BookIndexPage() {
  const [query, setQuery] = useState("");
  const [book, setBook] = useState<"ALL" | "BOOK_1" | "BOOK_2">("ALL");
  const [category, setCategory] = useState<"ALL" | BookKnowledgeCategory>("ALL");
  const normalizedQuery = normalizedSearch(query);
  const chapters = BOOK_CHAPTERS.filter((chapter) => {
    if (book !== "ALL" && chapter.source.bookId !== book) return false;
    if (category !== "ALL" && chapter.category !== category) return false;
    if (!normalizedQuery) return true;
    return normalizedSearch([
      chapter.source.chapterTitle,
      chapter.source.part,
      chapter.coreIdea,
      BOOK_KNOWLEDGE_CATEGORY_LABELS[chapter.category],
      chapter.id,
      ...chapter.knowledgePoints.map((item) => item.text),
      ...(chapter.decisionRules ?? []).map((item) => item.text),
      ...(chapter.bookExamples ?? []).map((item) => item.text),
      ...(chapter.commonMisuses ?? []).map((item) => item.text),
      ...(chapter.appNotes ?? []).map((item) => item.text),
      ...chapter.relatedRuleIds
    ].join(" ")).includes(normalizedQuery);
  });

  return (
    <div className="page-stack">
      <PageIntro eyebrow="两本书的核心内容" title="核心饮食知识" description="从七大营养素、维生素与矿物质，到食物选择和一日搭配；内容以书中真正有用的知识为主，计算规则只是其中一部分。" />
      <section className="card">
        <div className="section-heading"><div><span className="eyebrow">章节查找</span><h2>核心知识目录</h2></div><span className="count-badge">{chapters.length} 章</span></div>
        <div className="compact-grid book-filters">
          <label>搜索章节或规则<input value={query} placeholder="如：早餐、饮水、BR-F-003" onChange={(event) => setQuery(event.target.value)} /></label>
          <label>书籍<select value={book} onChange={(event) => setBook(event.target.value as typeof book)}>
            <option value="ALL">两本书</option>
            <option value="BOOK_1">你是你吃出来的</option>
            <option value="BOOK_2">你是你吃出来的2</option>
          </select></label>
          <label>知识分类<select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            <option value="ALL">全部分类</option>
            {Object.entries(BOOK_KNOWLEDGE_CATEGORY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select></label>
        </div>
        <p className="helper">这两本 EPUB 没有纸书页码映射，因此应用显示目录序号和约全书百分比，不伪造“第几页”。</p>
      </section>
      <div className="book-chapter-grid">
        {chapters.map((chapter) => <BookChapterCard chapter={chapter} key={chapter.id} />)}
      </div>
      {chapters.length === 0 && <p className="empty-state">没有找到匹配章节。</p>}
    </div>
  );
}

function BookChapterPage({ chapterId }: { chapterId: string }) {
  const chapter = findBookChapter(chapterId);
  if (!chapter) return <Navigate replace to="/book" />;

  const primaryItems = chapter.decisionRules ?? chapter.knowledgePoints;
  const primaryPreview = primaryItems.slice(0, 4);
  const remainingPrimary = primaryItems.slice(4);
  const mechanismItems = chapter.decisionRules ? chapter.knowledgePoints : [];
  const boundaryItem = chapter.cautions?.[0] ?? chapter.commonMisuses?.[0];
  const remainingCautions = chapter.cautions?.slice(1);
  const remainingMisuses = chapter.cautions ? chapter.commonMisuses : chapter.commonMisuses?.slice(1);

  return (
    <div className="page-stack">
      <NavLink className="back-link" to="/book">← 返回书本知识</NavLink>
      <PageIntro eyebrow={`${chapter.source.bookId === "BOOK_1" ? "第一册" : "第二册"} · ${chapter.source.part}`} title={chapter.source.chapterTitle} description={chapter.coreIdea} />
      <div className="knowledge-core-source"><KnowledgeSourceChip kind={chapter.coreIdeaSource} /></div>
      <section className="card book-knowledge-section knowledge-priority-card">
        <span className="eyebrow">{chapter.decisionRules ? "先按这些规则判断" : "先记住这些重点"}</span>
        <KnowledgeList items={primaryPreview} />
      </section>
      {boundaryItem && <section className="card book-misuse-card knowledge-boundary-card">
        <span className="eyebrow">先注意这个边界</span>
        <KnowledgeList items={[boundaryItem]} />
      </section>}
      <details className="card knowledge-disclosure">
        <summary>展开原理、案例与完整来源</summary>
        <div className="knowledge-disclosure-body">
          {mechanismItems.length > 0 && <section className="book-knowledge-section"><span className="eyebrow">为什么这样做</span><KnowledgeList items={mechanismItems} /></section>}
          {remainingPrimary.length > 0 && <section className="book-knowledge-section"><span className="eyebrow">更多判断要点</span><KnowledgeList items={remainingPrimary} /></section>}
          {chapter.bookExamples && <section className="book-knowledge-section"><span className="eyebrow">书中数据与案例</span><KnowledgeList items={chapter.bookExamples} /></section>}
          {remainingMisuses && remainingMisuses.length > 0 && <section className="book-knowledge-section book-misuse-section"><span className="eyebrow">其他容易用错的地方</span><KnowledgeList items={remainingMisuses} /></section>}
          {chapter.appNotes && <section className="book-knowledge-section"><span className="eyebrow">应用如何使用</span><KnowledgeList items={chapter.appNotes} /></section>}
          {remainingCautions && remainingCautions.length > 0 && <section className="book-knowledge-section"><span className="eyebrow">其他适用边界</span><KnowledgeList items={remainingCautions} /></section>}
          <section className="book-source-card">
            <span className="eyebrow">引用位置</span>
            <h2>{chapter.source.bookTitle}</h2>
            <p>{bookLocationLabel(chapter.source)}</p>
            {chapter.source.sourceKeywords && <p>原文定位关键词：{chapter.source.sourceKeywords.join(" · ")}</p>}
            <p className="helper">内部定位：<code>{chapter.source.epubFile}</code>{chapter.source.epubAnchor ? <> · 锚点：<code>{chapter.source.epubAnchor}</code></> : null} · 最近核对：{chapter.source.verifiedAt} · 纸书页码：该 EPUB 未提供</p>
          </section>
        </div>
      </details>
      <section className="card"><span className="eyebrow">关联规则</span><div className="book-rule-links">{chapter.relatedRuleIds.map((ruleId) => <code key={ruleId}>{ruleId}</code>)}</div></section>
    </div>
  );
}

export default function BookKnowledgePage() {
  const { chapterId } = useParams();
  return chapterId ? <BookChapterPage chapterId={chapterId} /> : <BookIndexPage />;
}
