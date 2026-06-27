import fs from 'node:fs/promises';
import path from 'node:path';
import { packageRoot, repoRoot } from '../config.mjs';
import { normalizeText, tokenize } from './normalize.mjs';

const sourceConfigUrl = new URL('../../config/knowledge-sources.json', import.meta.url);

async function readJson(url) {
  return JSON.parse(await fs.readFile(url, 'utf8'));
}

function splitMarkdownSections(source, content) {
  const lines = content.split(/\r?\n/);
  const chunks = [];
  let currentTitle = source.path;
  let current = [];

  function flush() {
    const text = current.join('\n').trim();
    if (!text) return;
    chunks.push({
      id: `${source.domain}:${chunks.length + 1}`,
      sourcePath: source.path,
      domain: source.domain,
      priority: source.priority ?? 1,
      title: currentTitle,
      text,
      tokens: tokenize(`${currentTitle}\n${text}`)
    });
  }

  for (const line of lines) {
    if (/^#{1,3}\s+/.test(line)) {
      flush();
      currentTitle = line.replace(/^#{1,3}\s+/, '').trim();
      current = [line];
    } else {
      current.push(line);
    }
  }
  flush();
  return chunks;
}

export async function loadKnowledgeBase({ sourcesUrl = sourceConfigUrl, rootDir = repoRoot } = {}) {
  const sources = await readJson(sourcesUrl);
  const documents = [];
  const missing = [];

  for (const source of sources) {
    const fullPath = path.resolve(rootDir, source.path);
    try {
      const content = await fs.readFile(fullPath, 'utf8');
      documents.push(...splitMarkdownSections(source, content));
    } catch (error) {
      missing.push({
        path: source.path,
        reason: error.code ?? error.message
      });
    }
  }

  return {
    packageRoot,
    repoRoot: rootDir,
    loadedAt: new Date().toISOString(),
    documents,
    missing,
    sources
  };
}

function scoreDocument(queryTokens, document) {
  if (queryTokens.length === 0) return 0;
  const tokenSet = new Set(document.tokens);
  let score = 0;

  for (const token of queryTokens) {
    if (tokenSet.has(token)) score += 4;
    if (normalizeText(document.title).includes(token)) score += 3;
    if (normalizeText(document.domain).includes(token)) score += 2;
  }

  return score * (document.priority ?? 1);
}

export function searchKnowledgeBase(knowledgeBase, query, { limit = 5, domain } = {}) {
  const queryTokens = tokenize(query);
  const scored = knowledgeBase.documents
    .filter((document) => !domain || document.domain === domain)
    .map((document) => ({
      ...document,
      score: scoreDocument(queryTokens, document)
    }))
    .filter((document) => document.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored.map((document) => ({
    id: document.id,
    sourcePath: document.sourcePath,
    domain: document.domain,
    title: document.title,
    score: document.score,
    snippet: createSnippet(document.text, queryTokens)
  }));
}

function createSnippet(text, queryTokens) {
  const clean = text.replace(/^#{1,3}\s+/gm, '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';

  const normalized = normalizeText(clean);
  const index = queryTokens
    .map((token) => normalized.indexOf(token))
    .filter((value) => value >= 0)
    .sort((a, b) => a - b)[0];

  const start = Math.max(0, (index ?? 0) - 100);
  const snippet = clean.slice(start, start + 320);
  return start > 0 ? `...${snippet}` : snippet;
}

export function buildKnowledgeAnswer(results) {
  if (results.length === 0) {
    return {
      answer:
        'Bu konuda onayli bilgi tabaninda net kaynak bulamadim. Konuyu destek ekibine aktarmam daha saglikli olur.',
      citations: []
    };
  }

  const citations = results.slice(0, 3).map((result) => ({
    title: result.title,
    sourcePath: result.sourcePath,
    domain: result.domain
  }));

  const bullets = results
    .slice(0, 3)
    .map((result) => `- ${result.title}: ${result.snippet}`)
    .join('\n');

  return {
    answer: `Bilgi tabanindaki en ilgili notlar sunlar:\n${bullets}`,
    citations
  };
}
