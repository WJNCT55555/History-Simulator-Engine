export type FlowSourceKind = 'event' | 'advisor' | 'journal' | 'actionCard' | 'governmentCard' | 'militaryCard';

export interface FlowSourceBundle {
  events: Record<string, string>;
  advisors?: Record<string, string>;
  journals?: Record<string, string>;
  actionCards?: Record<string, string>;
  governmentCards?: Record<string, string>;
  militaryCards?: Record<string, string>;
}

export interface FlowOption {
  id: string;
  eventId: string;
  index: number;
  text: string;
  textZh?: string;
  subtitle?: string;
  subtitleZh?: string;
  conditionSnippet?: string;
  conditionFields: string[];
  effectSnippet?: string;
  effectFields: string[];
  targetEventIds: string[];
  targetSymbols: string[];
  unresolvedTargetSymbols: string[];
  dynamicTargetReason?: string;
  endsFlow: boolean;
}

export interface FlowEvent {
  id: string;
  title: string;
  titleZh?: string;
  description: string;
  descriptionZh?: string;
  year?: number;
  month?: number;
  category?: string;
  flow?: string;
  series: string[];
  tags: string[];
  sourcePath: string;
  sourceOrder: number;
  exportName?: string;
  conditionSnippet?: string;
  conditionFields: string[];
  effectFields: string[];
  options: FlowOption[];
}

export type FlowEdgeType = 'event-option' | 'option-event' | 'option-end' | 'option-dynamic';

export interface FlowEdge {
  id: string;
  from: string;
  to: string;
  type: FlowEdgeType;
  optionId?: string;
}

export interface FlowExternalTrigger {
  id: string;
  kind: Exclude<FlowSourceKind, 'event'>;
  title: string;
  titleZh?: string;
  sourcePath: string;
  targetEventIds: string[];
  targetSymbols: string[];
  unresolvedTargetSymbols: string[];
  dynamicTargetReason?: string;
  snippet?: string;
}

export interface FlowCoupling {
  id: string;
  fromEventId: string;
  toEventId: string;
  fields: string[];
  confidence: 'field';
}

export interface FlowRisk {
  id: string;
  level: 'info' | 'warn';
  eventId?: string;
  optionId?: string;
  message: string;
  messageZh: string;
}

export interface FlowAnalysis {
  events: FlowEvent[];
  edges: FlowEdge[];
  externalTriggers: FlowExternalTrigger[];
  couplings: FlowCoupling[];
  risks: FlowRisk[];
  eventById: Map<string, FlowEvent>;
  optionById: Map<string, FlowOption>;
  incomingExplicitByEventId: Map<string, string[]>;
  outgoingExplicitByEventId: Map<string, string[]>;
  readersByField: Map<string, string[]>;
  writersByField: Map<string, string[]>;
  sourceStats: Record<FlowSourceKind, number>;
}

const cleanSourceString = (value?: string) =>
  value
    ?.replace(/\\n/g, '\n')
    .replace(/\\'/g, "'")
    .replace(/\\"/g, '"')
    .replace(/\\`/g, '`')
    .trim();

const readString = (source: string, key: string) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(['"\`])((?:\\\\.|(?!\\1)[\\s\\S])*?)\\1`));
  return cleanSourceString(match?.[2]);
};

const readReturnString = (source: string, key: string) => {
  const snippet = snippetForKey(source, key, 1200);
  if (!snippet) return undefined;
  const returned = snippet.match(/\breturn\s+(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/);
  const expression = snippet.match(/=>\s*(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/);
  return cleanSourceString(returned?.[2] || expression?.[2]);
};

const readDisplayString = (source: string, key: string) =>
  readString(source, key) || readReturnString(source, key);

const readNumber = (source: string, key: string) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(-?\\d+)`));
  return match ? Number(match[1]) : undefined;
};

const readStringArray = (source: string, key: string) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return [...match[1].matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)]
    .map((item) => cleanSourceString(item[2]))
    .filter((item): item is string => Boolean(item));
};

const compactSnippet = (source: string) => source.replace(/\s+/g, ' ').replace(/\{\s+/g, '{ ').replace(/\s+\}/g, ' }').trim();

const sourceEntries = (files: Record<string, string> = {}) =>
  Object.entries(files)
    .filter(([pathName]) => !/index\.tsx?$/.test(pathName))
    .sort(([a], [b]) => a.localeCompare(b));

const getFilename = (pathName: string) => pathName.split(/[\\/]/).pop()?.replace(/\.(tsx|ts)$/, '') || pathName;

const findMatching = (source: string, openIndex: number, openChar: string, closeChar: string) => {
  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = openIndex; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
};

const splitExportBlocks = (source: string) => {
  const starts = [...source.matchAll(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)[^=]*=\s*{/g)];
  return starts.map((match, index) => ({
    exportName: match[1],
    source: source.slice(match.index, starts[index + 1]?.index ?? source.length),
  }));
};

const collectMetaBlocks = (source: string) => {
  const meta = new Map<string, string>();
  const starts = [...source.matchAll(/\bconst\s+([A-Za-z_$][A-Za-z0-9_$]*Meta)\s*=\s*{/g)];
  starts.forEach((match) => {
    if (match.index === undefined) return;
    const openIndex = source.indexOf('{', match.index);
    const closeIndex = findMatching(source, openIndex, '{', '}');
    if (closeIndex > openIndex) meta.set(match[1], source.slice(openIndex, closeIndex + 1));
  });
  return meta;
};

const resolveMetaSource = (eventSource: string, metaBlocks: Map<string, string>) => {
  const inlineMatch = eventSource.match(/\bmeta\s*:\s*{/);
  if (inlineMatch?.index !== undefined) {
    const openIndex = eventSource.indexOf('{', inlineMatch.index);
    const closeIndex = findMatching(eventSource, openIndex, '{', '}');
    if (closeIndex > openIndex) return eventSource.slice(openIndex, closeIndex + 1);
  }
  const refMatch = eventSource.match(/\bmeta\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*)/);
  return refMatch ? metaBlocks.get(refMatch[1]) : undefined;
};

interface ResolvedMetaValues {
  category?: string;
  flow?: string;
  series: string[];
  tags: string[];
}

const resolveMetaValues = (
  source: string,
  metaBlocks: Map<string, string>,
  resolving = new Set<string>(),
): ResolvedMetaValues => {
  const result: ResolvedMetaValues = { series: [], tags: [] };
  const spreads = [...source.matchAll(/\.\.\.([A-Za-z_$][A-Za-z0-9_$]*)/g)].map((match) => match[1]);

  spreads.forEach((name) => {
    if (resolving.has(name)) return;
    const inheritedSource = metaBlocks.get(name);
    if (!inheritedSource) return;
    const inherited = resolveMetaValues(inheritedSource, metaBlocks, new Set([...resolving, name]));
    if (result.category === undefined) result.category = inherited.category;
    if (result.flow === undefined) result.flow = inherited.flow;
    if (result.series.length === 0) result.series = inherited.series;
    if (result.tags.length === 0) result.tags = inherited.tags;
  });

  const category = readString(source, 'category');
  const flow = readString(source, 'flow');
  const series = readStringArray(source, 'series');
  const tags = readStringArray(source, 'tags');
  if (category !== undefined) result.category = category;
  if (flow !== undefined) result.flow = flow;
  if (/\bseries\s*:/.test(source)) result.series = series;
  if (/\btags\s*:/.test(source)) result.tags = tags;
  return result;
};

const extractOptionsArray = (source: string) => {
  const keyMatch = source.match(/\boptions\s*:/);
  if (!keyMatch?.index && keyMatch?.index !== 0) return '';
  const openIndex = source.indexOf('[', keyMatch.index);
  if (openIndex < 0) return '';
  const closeIndex = findMatching(source, openIndex, '[', ']');
  return closeIndex > openIndex ? source.slice(openIndex + 1, closeIndex) : '';
};

const splitTopLevelObjects = (source: string) => {
  const blocks: string[] = [];
  for (let index = 0; index < source.length; index += 1) {
    if (source[index] !== '{') continue;
    const closeIndex = findMatching(source, index, '{', '}');
    if (closeIndex < 0) break;
    blocks.push(source.slice(index, closeIndex + 1));
    index = closeIndex;
  }
  return blocks;
};

const snippetForKey = (source: string, key: string, limit = 340) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:`));
  if (!match?.index && match?.index !== 0) return undefined;
  const start = match.index;
  const candidates = ['effect', 'condition', 'unavailableSubtitle', 'text', 'textZh', 'options']
    .filter((item) => item !== key)
    .map((item) => {
      const found = source.slice(start + 1).search(new RegExp(`\\b${item}\\s*:`));
      return found >= 0 ? start + 1 + found : -1;
    })
    .filter((index) => index > start + 20);
  const end = candidates.length > 0 ? Math.min(...candidates) : Math.min(source.length, start + limit);
  return compactSnippet(source.slice(start, Math.min(end, start + limit)));
};

const ignoredWriteKeys = new Set([
  'id',
  'title',
  'titleZh',
  'description',
  'descriptionZh',
  'text',
  'textZh',
  'subtitle',
  'subtitleZh',
  'condition',
  'effect',
  'options',
  'currentEvent',
  'pendingEvents',
  'date',
  'year',
  'month',
]);

const fieldRoot = (field: string) => field.split('.').slice(0, 2).join('.');

const extractReadFields = (snippet?: string) => {
  if (!snippet) return [];
  return Array.from(new Set([...snippet.matchAll(/\b(?:state|s)\.([A-Za-z0-9_.$]+)/g)].map((match) => fieldRoot(match[1])))).slice(0, 18);
};

const extractWriteFields = (snippet?: string) => {
  if (!snippet) return [];
  const fields = [...snippet.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(?:Math\.|state\.|s\.|[+-]?\d|true|false|["'`])/g)]
    .map((match) => match[1])
    .filter((field) => !ignoredWriteKeys.has(field));
  return Array.from(new Set(fields.map(fieldRoot))).slice(0, 18);
};

const extractTargetSymbols = (source: string) => {
  const symbols = new Set<string>();
  const currentEventMatches = [...source.matchAll(/\bcurrentEvent\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*|null)/g)];
  currentEventMatches.forEach((match) => {
    if (match[1] !== 'null') symbols.add(match[1]);
  });
  const pendingMatches = [...source.matchAll(/\{\s*\.\.\.([A-Za-z_$][A-Za-z0-9_$]*)\s*\}/g)];
  pendingMatches.forEach((match) => symbols.add(match[1]));
  return Array.from(symbols);
};

const hasDynamicTarget = (source: string, targetSymbols: string[]) => {
  if (targetSymbols.length > 0) return undefined;
  if (/\bcurrentEvent\s*:/.test(source) && !/\bcurrentEvent\s*:\s*null\b/.test(source)) return 'dynamic currentEvent expression';
  if (/\bpendingEvents\s*:/.test(source)) return 'dynamic pendingEvents expression';
  return undefined;
};

const parseOptions = (eventId: string, source: string) => {
  const optionsSource = extractOptionsArray(source);
  const optionBlocks = splitTopLevelObjects(optionsSource);
  const fallback = optionsSource.split(/\{\s*text\s*:/).slice(1).map((segment) => `{ text:${segment}`);
  const blocks = optionBlocks.length > 0 ? optionBlocks : fallback;

  return blocks.map((block, index): FlowOption => {
    const targetSymbols = extractTargetSymbols(block);
    const conditionSnippet = snippetForKey(block, 'condition');
    const effectSnippet = snippetForKey(block, 'effect', 2400);
    return {
      id: `${eventId}__option_${index}`,
      eventId,
      index,
      text: readDisplayString(block, 'text') || `Option ${index + 1}`,
      textZh: readDisplayString(block, 'textZh'),
      subtitle: readDisplayString(block, 'subtitle'),
      subtitleZh: readDisplayString(block, 'subtitleZh'),
      conditionSnippet,
      conditionFields: extractReadFields(conditionSnippet),
      effectSnippet,
      effectFields: extractWriteFields(effectSnippet),
      targetEventIds: [],
      targetSymbols,
      unresolvedTargetSymbols: [],
      dynamicTargetReason: hasDynamicTarget(block, targetSymbols),
      endsFlow: /\bcurrentEvent\s*:\s*null\b/.test(block),
    };
  });
};

const normalizeInput = (input: Record<string, string> | FlowSourceBundle): FlowSourceBundle => {
  const candidate = input as Partial<FlowSourceBundle>;
  if (candidate.events && typeof candidate.events === 'object') return candidate as FlowSourceBundle;
  return { events: input as Record<string, string> };
};

const parseExternalTriggers = (
  kind: FlowExternalTrigger['kind'],
  files: Record<string, string> = {},
): Omit<FlowExternalTrigger, 'targetEventIds' | 'unresolvedTargetSymbols'>[] =>
  sourceEntries(files).flatMap(([sourcePath, source]) =>
    splitExportBlocks(source)
      .filter(({ source: block }) => /\b(currentEvent|pendingEvents)\s*:/.test(block))
      .map(({ exportName, source: block }, index) => {
        const title = readString(block, 'title') || readString(block, 'name') || readString(block, 'text') || exportName || getFilename(sourcePath);
        const titleZh = readString(block, 'titleZh') || readString(block, 'nameZh') || readString(block, 'textZh');
        const targetSymbols = extractTargetSymbols(block);
        return {
          id: `${kind}:${sourcePath}:${exportName || index}`,
          kind,
          title,
          titleZh,
          sourcePath,
          targetSymbols,
          dynamicTargetReason: hasDynamicTarget(block, targetSymbols),
          snippet: snippetForKey(block, 'effect', 520) || snippetForKey(block, 'activeEffect', 520) || compactSnippet(block.slice(0, 520)),
        };
      }),
  );

export const analyzeEventFlow = (input: Record<string, string> | FlowSourceBundle): FlowAnalysis => {
  const bundle = normalizeInput(input);
  const parsedEvents: FlowEvent[] = sourceEntries(bundle.events).flatMap(([pathName, source]) => {
    const metaBlocks = collectMetaBlocks(source);
    return splitExportBlocks(source)
      .filter(({ source: block }) => /\boptions\s*:/.test(block) && /\bid\s*:/.test(block))
      .map(({ exportName, source: block }, sourceOrder) => {
        const id = readString(block, 'id') || getFilename(pathName);
        const options = parseOptions(id, block);
        const eventHeader = block.slice(0, Math.max(block.search(/\boptions\s*:/), 0));
        const conditionSnippet = snippetForKey(eventHeader, 'condition', 520);
        const metaSource = resolveMetaSource(block, metaBlocks);
        const metaValues = metaSource ? resolveMetaValues(metaSource, metaBlocks) : undefined;
        return {
          id,
          title: readString(block, 'title') || `[dynamic] ${id}`,
          titleZh: readString(block, 'titleZh'),
          description: readString(block, 'description') || '',
          descriptionZh: readString(block, 'descriptionZh'),
          year: readNumber(block, 'year'),
          month: readNumber(block, 'month'),
          category: metaValues?.category || readString(block, 'category'),
          flow: metaValues?.flow || readString(block, 'flow'),
          series: metaValues?.series || readStringArray(block, 'series'),
          tags: metaValues?.tags || readStringArray(block, 'tags'),
          sourcePath: pathName,
          sourceOrder,
          exportName,
          conditionSnippet,
          conditionFields: Array.from(new Set([...extractReadFields(conditionSnippet), ...options.flatMap((option) => option.conditionFields)])).slice(0, 18),
          effectFields: Array.from(new Set(options.flatMap((option) => option.effectFields))).slice(0, 18),
          options,
        };
      });
  });

  const eventById = new Map(parsedEvents.map((event) => [event.id, event]));
  const exportToId = new Map(parsedEvents.filter((event) => event.exportName).map((event) => [event.exportName as string, event.id]));
  const optionById = new Map<string, FlowOption>();
  const edges: FlowEdge[] = [];
  const incomingExplicitByEventId = new Map<string, string[]>();
  const outgoingExplicitByEventId = new Map<string, string[]>();

  parsedEvents.forEach((event) => {
    incomingExplicitByEventId.set(event.id, []);
    outgoingExplicitByEventId.set(event.id, []);
  });

  parsedEvents.forEach((event) => {
    event.options.forEach((option) => {
      const targetEventIds = option.targetSymbols
        .map((symbol) => exportToId.get(symbol) || (eventById.has(symbol) ? symbol : undefined))
        .filter((id): id is string => Boolean(id));
      option.targetEventIds = Array.from(new Set(targetEventIds));
      option.unresolvedTargetSymbols = option.targetSymbols.filter((symbol) => !exportToId.has(symbol) && !eventById.has(symbol));
      if (option.targetSymbols.length > 0 && option.targetEventIds.length === 0) option.dynamicTargetReason = 'target export not found';
      optionById.set(option.id, option);
      edges.push({ id: `${event.id}->${option.id}`, from: event.id, to: option.id, type: 'event-option', optionId: option.id });
      option.targetEventIds.forEach((targetId) => {
        edges.push({ id: `${option.id}->${targetId}`, from: option.id, to: targetId, type: 'option-event', optionId: option.id });
        incomingExplicitByEventId.set(targetId, [...(incomingExplicitByEventId.get(targetId) || []), event.id]);
        outgoingExplicitByEventId.set(event.id, [...(outgoingExplicitByEventId.get(event.id) || []), targetId]);
      });
      if (option.endsFlow) edges.push({ id: `${option.id}->end`, from: option.id, to: `${option.id}__end`, type: 'option-end', optionId: option.id });
      if (option.dynamicTargetReason) edges.push({ id: `${option.id}->dynamic`, from: option.id, to: `${option.id}__dynamic`, type: 'option-dynamic', optionId: option.id });
    });
  });

  const externalRaw = [
    ...parseExternalTriggers('advisor', bundle.advisors),
    ...parseExternalTriggers('journal', bundle.journals),
    ...parseExternalTriggers('actionCard', bundle.actionCards),
    ...parseExternalTriggers('governmentCard', bundle.governmentCards),
    ...parseExternalTriggers('militaryCard', bundle.militaryCards),
  ];
  const externalTriggers: FlowExternalTrigger[] = externalRaw.map((trigger) => {
    const targetEventIds = Array.from(new Set(trigger.targetSymbols
      .map((symbol) => exportToId.get(symbol) || (eventById.has(symbol) ? symbol : undefined))
      .filter((id): id is string => Boolean(id))));
    const unresolvedTargetSymbols = trigger.targetSymbols.filter((symbol) => !exportToId.has(symbol) && !eventById.has(symbol));
    targetEventIds.forEach((targetId) => {
      incomingExplicitByEventId.set(targetId, [...(incomingExplicitByEventId.get(targetId) || []), trigger.id]);
    });
    return { ...trigger, targetEventIds, unresolvedTargetSymbols };
  });

  const readersByField = new Map<string, string[]>();
  const writersByField = new Map<string, string[]>();
  parsedEvents.forEach((event) => {
    event.conditionFields.forEach((field) => readersByField.set(field, [...(readersByField.get(field) || []), event.id]));
    event.effectFields.forEach((field) => writersByField.set(field, [...(writersByField.get(field) || []), event.id]));
  });

  const couplings: FlowCoupling[] = [];
  parsedEvents.forEach((producer) => {
    if (producer.effectFields.length === 0) return;
    parsedEvents.forEach((consumer) => {
      if (producer.id === consumer.id || consumer.conditionFields.length === 0) return;
      const shared = Array.from(new Set(consumer.conditionFields.filter((field) => producer.effectFields.includes(field)))).slice(0, 6);
      if (shared.length === 0) return;
      couplings.push({
        id: `field:${producer.id}:${consumer.id}`,
        fromEventId: producer.id,
        toEventId: consumer.id,
        fields: shared,
        confidence: 'field',
      });
    });
  });

  const risks: FlowRisk[] = [];
  parsedEvents.forEach((event) => {
    const incoming = incomingExplicitByEventId.get(event.id) || [];
    if (incoming.length === 0 && !event.conditionSnippet && !event.year && !event.month) {
      risks.push({
        id: `entry:${event.id}`,
        level: 'info',
        eventId: event.id,
        message: 'No explicit incoming trigger, date, or event-level condition detected.',
        messageZh: '未检测到显式入口、日期或事件级条件。',
      });
    }
    event.options.forEach((option) => {
      if (option.dynamicTargetReason) {
        risks.push({
          id: `dynamic:${option.id}`,
          level: 'warn',
          eventId: event.id,
          optionId: option.id,
          message: option.dynamicTargetReason,
          messageZh: option.dynamicTargetReason === 'target export not found' ? '目标导出未找到。' : '存在动态目标，无法完全静态确定。',
        });
      }
      if (option.unresolvedTargetSymbols.length > 0) {
        risks.push({
          id: `unresolved:${option.id}`,
          level: 'warn',
          eventId: event.id,
          optionId: option.id,
          message: `Unresolved target symbols: ${option.unresolvedTargetSymbols.join(', ')}`,
          messageZh: `未解析目标符号：${option.unresolvedTargetSymbols.join(', ')}`,
        });
      }
    });
  });

  externalTriggers.forEach((trigger) => {
    if (trigger.dynamicTargetReason || trigger.unresolvedTargetSymbols.length > 0) {
      risks.push({
        id: `external:${trigger.id}`,
        level: 'warn',
        message: `External trigger has unresolved or dynamic target: ${trigger.title}`,
        messageZh: `外部入口存在未解析或动态目标：${trigger.titleZh || trigger.title}`,
      });
    }
  });

  const sourceStats: Record<FlowSourceKind, number> = {
    event: parsedEvents.length,
    advisor: sourceEntries(bundle.advisors).length,
    journal: sourceEntries(bundle.journals).length,
    actionCard: sourceEntries(bundle.actionCards).length,
    governmentCard: sourceEntries(bundle.governmentCards).length,
    militaryCard: sourceEntries(bundle.militaryCards).length,
  };

  return {
    events: parsedEvents,
    edges,
    externalTriggers,
    couplings,
    risks,
    eventById,
    optionById,
    incomingExplicitByEventId,
    outgoingExplicitByEventId,
    readersByField,
    writersByField,
    sourceStats,
  };
};

export const getFlowDateKey = (event: Pick<FlowEvent, 'year' | 'month'>, language: 'en' | 'zh' = 'en') => {
  if (!event.year || !event.month) return language === 'zh' ? '未定日期' : 'Undated';
  return `${event.year}.${String(event.month).padStart(2, '0')}`;
};
