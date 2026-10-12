import React from 'react';
import {
  BookOpen,
  Download,
  FilePenLine,
  FileText,
  GitBranch,
  Landmark,
  Minus,
  MousePointer2,
  Move,
  Plus,
  RotateCcw,
  Save,
  Search,
  Shield,
  Swords,
  Trash2,
  Upload,
  Users,
  Zap,
} from 'lucide-react';
import { motion } from 'motion/react';
import { analyzeEventFlow, getFlowDateKey, type FlowAnalysis, type FlowEvent, type FlowOption } from './flowAnalysis';
import { buildCardTypeScript, type CardCodegenSource } from './cardCodegen';
import { buildEventTypeScript, type EventCodegenSource } from './eventCodegen';
import type {
  SandboxDifficulty,
  SandboxLibraryKind,
  SandboxRun,
  SandboxScenario,
  SandboxSessionState,
  SandboxTriggerResult,
} from './simulator/gameSandbox';
import { formatEffectPreviewLine, getOptionEffectPreview } from '../../src/game/effectPreview';
import type {
  EffectPreviewLine,
  EventCategory,
  EventFlow,
  GameEvent,
  GameState,
} from '../../src/game/types';

const cn = (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(' ');

const handleCanvasWheel = (
  event: React.WheelEvent<HTMLDivElement>,
  patchZoom: (delta: number) => void,
  zoomStep: number,
) => {
  if (event.ctrlKey || event.metaKey) {
    event.preventDefault();
    patchZoom(event.deltaY > 0 ? -zoomStep : zoomStep);
    return;
  }
  if (event.shiftKey) {
    event.preventDefault();
    event.currentTarget.scrollLeft += event.deltaX || event.deltaY;
  }
};

type EditorTab = 'events' | 'advisors' | 'journals' | 'cards' | 'test' | 'roadmap';
type EditorCollectionKey = 'events' | 'advisors' | 'journals' | 'cards';
type EditorLanguage = 'en' | 'zh';
type CardType = 'Action' | 'Government' | 'Military';
type EffectTarget = string;

const sandboxScenarioDates: Record<SandboxScenario, { year: number; month: number }> = {
  '1931': { year: 1931, month: 4 },
  '1933': { year: 1933, month: 11 },
  '1936': { year: 1936, month: 7 },
};

const eventCategoryValues: EventCategory[] = ['news', 'cnt', 'politics', 'war', 'other'];
const eventFlowValues: EventFlow[] = ['solo', 'inline.root', 'inline.node', 'inline.leaf'];

const isEventCategory = (value: unknown): value is EventCategory =>
  typeof value === 'string' && eventCategoryValues.includes(value as EventCategory);

const isEventFlow = (value: unknown): value is EventFlow =>
  typeof value === 'string' && eventFlowValues.includes(value as EventFlow);

const splitEditorList = (value: string) =>
  Array.from(new Set(value.split(',').map((item) => item.trim()).filter(Boolean)));

const joinEditorList = (value: string[]) => value.join(', ');

const SandboxEffectPreviewTooltip: React.FC<{
  state: GameState;
  option: GameEvent['options'][number];
  language: EditorLanguage;
}> = ({ state, option, language }) => {
  let lines: EffectPreviewLine[] = [];

  try {
    lines = getOptionEffectPreview(state, option);
  } catch {
    lines = [{
      text: 'Effect preview unavailable',
      textZh: '效果预览不可用',
      tone: 'neutral'
    }];
  }

  if (lines.length === 0) return null;

  const isZh = language === 'zh';

  return (
    <div className="pointer-events-none absolute left-0 top-full z-50 mt-2 hidden w-full min-w-72 max-w-[calc(100vw-3rem)] border border-ink bg-paper p-3 text-ink shadow-[3px_3px_0_0_rgba(30,28,26,1)] group-hover:block group-focus-within:block">
      <div className="mb-2 border-b border-ink/20 pb-1 font-typewriter text-[10px] uppercase tracking-widest text-ink/60">
        {isZh ? '选项效果' : 'Option Effects'}
      </div>
      <div className="flex flex-col gap-1.5">
        {lines.map((line, index) => (
          <div
            key={`${formatEffectPreviewLine(line, isZh)}-${index}`}
            className={cn(
              'font-mono text-[11px] leading-snug normal-case tracking-normal',
              line.tone === 'positive' && 'text-green-700',
              line.tone === 'negative' && 'text-cnt-red',
              line.tone === 'neutral' && 'text-ink',
            )}
          >
            {formatEffectPreviewLine(line, isZh)}
          </div>
        ))}
      </div>
    </div>
  );
};

interface SourceEffect {
  id: string;
  label: string;
  snippet: string;
  fields: string[];
}

interface EditorEffect {
  id: string;
  presetId: string;
  target: EffectTarget;
  value: number;
  description: string;
  descriptionZh: string;
}

const sourceGlobs = {
  events: import.meta.glob('../../src/game/events/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  advisors: import.meta.glob('../../src/game/advisors/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  journals: import.meta.glob('../../src/game/journal/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  actionCards: import.meta.glob('../../src/game/action_affairs/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  governmentCards: import.meta.glob('../../src/game/government_affairs/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
  militaryCards: import.meta.glob('../../src/game/military_affairs/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true }) as Record<string, string>,
};

interface EditableOption {
  text: string;
  textZh?: string;
  subtitle?: string;
  subtitleZh?: string;
  unavailableSubtitle?: string;
  unavailableSubtitleZh?: string;
  hasCondition: boolean;
  conditionSnippet?: string;
  conditionSource?: string;
  targetEventIds: string[];
  endsFlow: boolean;
  hasScriptedEffect: boolean;
  sourceEffects: SourceEffect[];
  effects: EditorEffect[];
}

interface EditableEvent {
  id: string;
  category: EventCategory;
  flow: EventFlow;
  series: string[];
  tags: string[];
  hasMeta: boolean;
  title: string;
  titleZh?: string;
  description: string;
  descriptionZh?: string;
  image?: string;
  year?: number;
  month?: number;
  hasCondition: boolean;
  conditionSource?: string;
  hasCustomRender: boolean;
  sourcePath?: string;
  sourceOrder?: number;
  exportName?: string;
  conditionFields: string[];
  conditionSnippets: string[];
  effectFields: string[];
  referencedSymbols: string[];
  options: EditableOption[];
}

interface EditableAdvisorAction {
  id: string;
  title: string;
  titleZh?: string;
  subtitle: string;
  subtitleZh?: string;
  description: string;
  descriptionZh?: string;
  hasCondition: boolean;
  hasScriptedEffect: boolean;
  sourceEffects: SourceEffect[];
  effects: EditorEffect[];
}

interface EditableAdvisor {
  id: string;
  name: string;
  nameZh?: string;
  faction: string;
  description: string;
  descriptionZh?: string;
  image?: string;
  actions: EditableAdvisorAction[];
}

interface EditableJournal {
  id: string;
  title: string;
  titleZh?: string;
  description: string;
  descriptionZh?: string;
  successCondition?: string;
  successConditionZh?: string;
  successEffectDesc?: string;
  successEffectDescZh?: string;
  failureCondition?: string;
  failureConditionZh?: string;
  failureEffectDesc?: string;
  failureEffectDescZh?: string;
  hasProgress: boolean;
  progressMax?: number;
  hasAutomation: boolean;
  sourceEffects: SourceEffect[];
  effects: EditorEffect[];
}

interface EditableCard {
  id: string;
  title: string;
  titleZh?: string;
  type: CardType;
  description: string;
  descriptionZh?: string;
  cost: number;
  resourceCost?: number;
  armamentCost?: number;
  conditionSource?: string;
  conditionFields: string[];
  unavailableSubtitle?: string;
  unavailableSubtitleZh?: string;
  cooldown?: number;
  timer?: number;
  eventTransition: EditableEventTransition;
  hasCondition: boolean;
  hasScriptedEffect: boolean;
  sourceEffects: SourceEffect[];
  effects: EditorEffect[];
  sourcePath?: string;
  exportName?: string;
}

interface EditableEventTransition {
  currentEventTargets: string[];
  pendingEventTargets: string[];
  dynamic: boolean;
}

interface EditorDraft {
  events: EditableEvent[];
  advisors: EditableAdvisor[];
  journals: EditableJournal[];
  cards: EditableCard[];
  updatedAt?: string;
}

const STORAGE_KEY = 'cnt_fai_content_editor_draft';

const getFilename = (pathName: string) => pathName.split(/[\\/]/).pop()?.replace(/\.(tsx|ts)$/, '') || pathName;

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

const readNumber = (source: string, key: string) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(-?\\d+)`));
  return match ? Number(match[1]) : undefined;
};

const readBoolean = (source: string, key: string) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*(true|false)`));
  return match ? match[1] === 'true' : false;
};

const readStringArray = (source: string, key: string) => {
  const match = source.match(new RegExp(`\\b${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`));
  if (!match) return [];
  return Array.from(match[1].matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g))
    .map((item) => cleanSourceString(item[2]))
    .filter((item): item is string => Boolean(item));
};

const compactSnippet = (source: string) =>
  source
    .replace(/\s+/g, ' ')
    .replace(/\{\s+/g, '{ ')
    .replace(/\s+\}/g, ' }')
    .trim();

const extractFieldsFromSnippet = (snippet: string) => {
  const fieldMatches = [
    ...snippet.matchAll(/\b(?:state|s)\.([A-Za-z0-9_.$]+)/g),
    ...snippet.matchAll(/\b([A-Za-z0-9_]+)\s*:\s*(?:Math\.|state\.|s\.|[+-]?\d)/g),
  ];
  return Array.from(new Set(fieldMatches.map((match) => match[1]).filter(Boolean))).slice(0, 10);
};

const extractConditionFields = (source: string) => {
  const snippets = [...source.matchAll(/\bcondition\s*:/g)].map((match) => {
    const start = match.index || 0;
    return compactSnippet(source.slice(start, Math.min(source.length, start + 700)));
  });
  return Array.from(new Set(snippets.flatMap(extractFieldsFromSnippet))).slice(0, 16);
};

const extractConditionSnippets = (source: string) =>
  [...source.matchAll(/\bcondition\s*:/g)]
    .map((match) => {
      const start = match.index || 0;
      const nextEffect = source.slice(start).search(/\beffect\s*:/);
      const end = nextEffect > 60 ? start + nextEffect : Math.min(source.length, start + 420);
      return compactSnippet(source.slice(start, end)).slice(0, 320);
    })
    .filter(Boolean)
    .slice(0, 6);

const extractReferencedSymbols = (source: string) =>
  Array.from(new Set([...source.matchAll(/\b[A-Za-z_$][A-Za-z0-9_$]*\b/g)].map((match) => match[0])))
    .filter((symbol) => ![
      'const',
      'let',
      'return',
      'state',
      'GameEvent',
      'GameState',
      'Math',
      'true',
      'false',
      'null',
      'undefined',
      'options',
      'effect',
      'condition',
      'title',
      'titleZh',
      'description',
      'descriptionZh',
      'text',
      'textZh',
      'currentEvent',
      'pendingEvents',
    ].includes(symbol));

const extractEventTransition = (source: string): EditableEventTransition => {
  const currentEventTargets = Array.from(source.matchAll(/\bcurrentEvent\s*:\s*([A-Za-z_$][A-Za-z0-9_$]*|null)/g))
    .map((match) => match[1])
    .filter((target): target is string => Boolean(target) && target !== 'null');
  const pendingEventTargets = Array.from(source.matchAll(/\bpendingEvents\s*:[\s\S]{0,900}?\b([A-Za-z_$][A-Za-z0-9_$]*)\b/g))
    .map((match) => match[1])
    .filter((target) => target !== 'pendingEvents' && target !== 'state');
  const hasTransition = /\b(currentEvent|pendingEvents)\s*:/.test(source);

  return {
    currentEventTargets: Array.from(new Set(currentEventTargets)),
    pendingEventTargets: Array.from(new Set(pendingEventTargets)),
    dynamic: hasTransition && currentEventTargets.length === 0 && pendingEventTargets.length === 0,
  };
};

const extractSourceEffects = (source: string, fallbackLabel: string): SourceEffect[] => {
  const markers = [...source.matchAll(/\b(effect|onComplete|onFail|apply)\s*:/g)];
  const activeEffectMarkers = [...source.matchAll(/\bactiveEffect\s*:/g)];
  const allMarkers = [...markers, ...activeEffectMarkers].sort((a, b) => (a.index || 0) - (b.index || 0));

  return allMarkers.map((match, index) => {
    const start = match.index || 0;
    const end = allMarkers[index + 1]?.index ?? Math.min(source.length, start + 900);
    const rawSnippet = source.slice(start, Math.min(end, start + 900));
    const snippet = compactSnippet(rawSnippet);
    const label = match[1] || 'activeEffect';
    return {
      id: `${fallbackLabel}_${label}_${index}`,
      label,
      snippet,
      fields: extractFieldsFromSnippet(snippet),
    };
  });
};

const splitExportBlocks = (source: string) => {
  const starts = [...source.matchAll(/export\s+const\s+\w+[^=]*=\s*{/g)];
  return starts.map((match, index) => source.slice(match.index, starts[index + 1]?.index ?? source.length));
};

const sourceEntries = (files: Record<string, string>) =>
  Object.entries(files)
    .filter(([pathName]) => !/index\.ts$/.test(pathName))
    .sort(([a], [b]) => a.localeCompare(b));

const sourceEventFlow = analyzeEventFlow({ events: sourceGlobs.events });
const sourceEventFlowByLocation = new Map(
  sourceEventFlow.events.map((event) => [`${event.sourcePath}#${event.sourceOrder}`, event]),
);
const sourceEventFlowById = new Map(sourceEventFlow.events.map((event) => [event.id, event]));

const getSourceEventFlow = (pathName: string, sourceOrder: number, id: string) =>
  sourceEventFlowByLocation.get(`${pathName}#${sourceOrder}`) || sourceEventFlowById.get(id);

const parseOptions = (source: string): EditableOption[] => {
  const optionsSource = source.match(/\boptions\s*:\s*\[([\s\S]*?)\n\s*\]/)?.[1] || '';
  const segments = optionsSource.split(/\{\s*text\s*:/).slice(1).map((segment) => `text:${segment}`);

  return segments.map((segment, index) => ({
    text: readString(segment, 'text') || `Option ${index + 1}`,
    textZh: readString(segment, 'textZh'),
    subtitle: readString(segment, 'subtitle'),
    subtitleZh: readString(segment, 'subtitleZh'),
    unavailableSubtitle: readString(segment, 'unavailableSubtitle'),
    unavailableSubtitleZh: readString(segment, 'unavailableSubtitleZh'),
    hasCondition: /\bcondition\s*:/.test(segment),
    conditionSnippet: extractConditionSnippets(segment)[0],
    conditionSource: extractConditionSnippets(segment)[0],
    targetEventIds: [],
    endsFlow: false,
    hasScriptedEffect: /\beffect\s*:/.test(segment),
    sourceEffects: extractSourceEffects(segment, `option_${index + 1}`),
    effects: [],
  }));
};

const normalizeEvents = (): EditableEvent[] =>
  sourceEntries(sourceGlobs.events).flatMap(([pathName, source]) =>
    splitExportBlocks(source)
      .filter((block) => /\boptions\s*:/.test(block) && /\bid\s*:/.test(block))
      .map((block, blockIndex) => {
        const id = readString(block, 'id') || getFilename(pathName);
        const sourceEffects = extractSourceEffects(block, id);
        const flowEvent = getSourceEventFlow(pathName, blockIndex, id);
        return {
          id,
          category: isEventCategory(flowEvent?.category) ? flowEvent.category : 'other',
          flow: isEventFlow(flowEvent?.flow) ? flowEvent.flow : 'solo',
          series: flowEvent?.series || readStringArray(block, 'series'),
          tags: flowEvent?.tags || readStringArray(block, 'tags'),
          hasMeta: Boolean(flowEvent?.category || flowEvent?.flow),
          title: readString(block, 'title') || `[dynamic] ${id}`,
          titleZh: readString(block, 'titleZh'),
          description: readString(block, 'description') || '',
          descriptionZh: readString(block, 'descriptionZh'),
          image: readString(block, 'image'),
          year: readNumber(block, 'year'),
          month: readNumber(block, 'month'),
          hasCondition: /\bcondition\s*:/.test(block),
          conditionSource: extractConditionSnippets(block)[0],
          hasCustomRender: /\brenderContent\s*:/.test(block),
          sourcePath: pathName,
          sourceOrder: blockIndex,
          exportName: block.match(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/)?.[1],
          conditionFields: extractConditionFields(block),
          conditionSnippets: extractConditionSnippets(block),
          effectFields: Array.from(new Set(sourceEffects.flatMap((effect) => effect.fields))).slice(0, 16),
          referencedSymbols: extractReferencedSymbols(block),
          options: parseOptions(block).map((option, optionIndex) => ({
            ...option,
            targetEventIds: flowEvent?.options[optionIndex]?.targetEventIds || [],
            endsFlow: flowEvent?.options[optionIndex]?.endsFlow || false,
          })),
        } satisfies EditableEvent;
      }),
  );

const normalizeAdvisors = (): EditableAdvisor[] =>
  sourceEntries(sourceGlobs.advisors).flatMap(([pathName, source]) =>
    splitExportBlocks(source)
      .filter((block) => /\bactions\s*:/.test(block) && /\bname\s*:/.test(block))
      .map((block) => {
        const id = readString(block, 'id') || getFilename(pathName);
        const actionsSource = block.match(/\bactions\s*:\s*\[([\s\S]*)\]\s*}/)?.[1] || '';
        const actionSegments = actionsSource.split(/\{\s*id\s*:/).slice(1).map((segment) => `id:${segment}`);

        return {
          id,
          name: readString(block, 'name') || id,
          nameZh: readString(block, 'nameZh'),
          faction: readString(block, 'faction') || 'None',
          description: readString(block, 'description') || '',
          descriptionZh: readString(block, 'descriptionZh'),
          image: readString(block, 'image'),
          actions: actionSegments.map((segment, index) => ({
            id: readString(segment, 'id') || `${id}_action_${index + 1}`,
            title: readString(segment, 'title') || `Action ${index + 1}`,
            titleZh: readString(segment, 'titleZh'),
            subtitle: readString(segment, 'subtitle') || '',
            subtitleZh: readString(segment, 'subtitleZh'),
            description: readString(segment, 'description') || '',
            descriptionZh: readString(segment, 'descriptionZh'),
            hasCondition: /\bcondition\s*:/.test(segment),
            hasScriptedEffect: /\beffect\s*:/.test(segment),
            sourceEffects: extractSourceEffects(segment, readString(segment, 'id') || `${id}_action_${index + 1}`),
            effects: [],
          })),
        } satisfies EditableAdvisor;
      }),
  );

const normalizeJournals = (): EditableJournal[] =>
  sourceEntries(sourceGlobs.journals).flatMap(([pathName, source]) =>
    splitExportBlocks(source)
      .filter((block) => /\bJournalEntryDef\b/.test(block) || /\bsuccessCondition\b|\bfailureCondition\b/.test(block))
      .map((block) => {
        const id = readString(block, 'id') || getFilename(pathName);
        return {
          id,
          title: readString(block, 'title') || id,
          titleZh: readString(block, 'titleZh'),
          description: readString(block, 'description') || '',
          descriptionZh: readString(block, 'descriptionZh'),
          successCondition: readString(block, 'successCondition'),
          successConditionZh: readString(block, 'successConditionZh'),
          successEffectDesc: readString(block, 'successEffectDesc'),
          successEffectDescZh: readString(block, 'successEffectDescZh'),
          failureCondition: readString(block, 'failureCondition'),
          failureConditionZh: readString(block, 'failureConditionZh'),
          failureEffectDesc: readString(block, 'failureEffectDesc'),
          failureEffectDescZh: readString(block, 'failureEffectDescZh'),
          hasProgress: readBoolean(block, 'hasProgress'),
          progressMax: readNumber(block, 'progressMax'),
          hasAutomation: /\bgetProgress\s*:|\bcheckStatus\s*:|\bonComplete\s*:|\bonFail\s*:|\bactiveEffect\s*:/.test(block),
          sourceEffects: extractSourceEffects(block, id),
          effects: [],
        } satisfies EditableJournal;
      }),
  );

const normalizeCardsFrom = (files: Record<string, string>, fallbackType: CardType): EditableCard[] =>
  sourceEntries(files).flatMap(([pathName, source]) =>
    splitExportBlocks(source)
      .filter((block) =>
        /\beffect\s*:/.test(block)
        && /\btitle\s*:/.test(block)
        && /\btype\s*:\s*['"`](Action|Government|Military)['"`]/.test(block),
      )
      .map((block) => {
        const id = readString(block, 'id') || getFilename(pathName);
        return {
          id,
          title: readString(block, 'title') || id,
          titleZh: readString(block, 'titleZh'),
          type: (readString(block, 'type') as CardType | undefined) || fallbackType,
          description: readString(block, 'description') || '',
          descriptionZh: readString(block, 'descriptionZh'),
          cost: readNumber(block, 'cost') || 0,
          resourceCost: readNumber(block, 'resourceCost'),
          armamentCost: readNumber(block, 'armamentCost'),
          conditionSource: extractConditionSnippets(block)[0],
          conditionFields: extractConditionFields(block),
          unavailableSubtitle: readString(block, 'unavailableSubtitle'),
          unavailableSubtitleZh: readString(block, 'unavailableSubtitleZh'),
          cooldown: readNumber(block, 'cooldown'),
          timer: readNumber(block, 'timer'),
          eventTransition: extractEventTransition(block),
          hasCondition: /\bcondition\s*:/.test(block),
          hasScriptedEffect: /\beffect\s*:/.test(block),
          sourceEffects: extractSourceEffects(block, id),
          effects: [],
          sourcePath: pathName,
          exportName: block.match(/export\s+const\s+([A-Za-z_$][A-Za-z0-9_$]*)/)?.[1],
        } satisfies EditableCard;
      }),
  );

const normalizeCards = (): EditableCard[] => [
  ...normalizeCardsFrom(sourceGlobs.actionCards, 'Action'),
  ...normalizeCardsFrom(sourceGlobs.governmentCards, 'Government'),
  ...normalizeCardsFrom(sourceGlobs.militaryCards, 'Military'),
];

const effectTargetLabels: Record<EffectTarget, Record<EditorLanguage, string>> = {
  'stats.workerControl': { en: 'Worker Control', zh: '工人控制' },
  'stats.revolutionaryFervor': { en: 'Revolutionary Fervor', zh: '革命热情' },
  'stats.republicanAuthority': { en: 'Republican Authority', zh: '共和国权威' },
  'stats.armyLoyalty': { en: 'Army Loyalty', zh: '军队忠诚' },
  economy_growth: { en: 'Economic Growth', zh: '经济增长' },
  'stats.tension': { en: 'Tension', zh: '紧张局势' },
  'stats.bureaucratization': { en: 'Bureaucratization', zh: '官僚化' },
  'stats.anarchistMilitia': { en: 'Anarchist Militia', zh: '无政府主义民兵' },
  resources: { en: 'Resources', zh: '资源' },
  armaments: { en: 'Armaments', zh: '军备' },
  leverage: { en: 'Government Leverage', zh: '政府杠杆' },
  coupProgress: { en: 'Coup Progress', zh: '政变进度' },
  'factions.Faistas.influence': { en: 'Faistas Influence', zh: '无政府主义者影响力' },
  'factions.Treintistas.influence': { en: 'Treintistas Influence', zh: '三十人集团影响力' },
  'factions.Cenetistas.influence': { en: 'Cenetistas Influence', zh: '工团派影响力' },
  'factions.Puristas.influence': { en: 'Puristas Influence', zh: '纯粹派影响力' },
  'factions.Faistas.dissent': { en: 'Faistas Dissent', zh: '无政府主义者异议' },
  'factions.Treintistas.dissent': { en: 'Treintistas Dissent', zh: '三十人集团异议' },
  'classes.Obreros.support.CNT_FAI': { en: 'Worker Support for CNT-FAI', zh: '工人对CNT-FAI支持' },
  'classes.Braceros.support.CNT_FAI': { en: 'Rural Laborer Support for CNT-FAI', zh: '雇农对CNT-FAI支持' },
  'partyRelations.PSOE': { en: 'PSOE Relations', zh: 'PSOE关系' },
  'partyRelations.PCE': { en: 'PCE Relations', zh: 'PCE关系' },
  'partyRelations.IR': { en: 'IR Relations', zh: 'IR关系' },
  'partyRelations.POUM': { en: 'POUM Relations', zh: 'POUM关系' },
  'relations.ussr': { en: 'USSR Relations', zh: '苏联关系' },
  'relations.france': { en: 'France Relations', zh: '法国关系' },
  'relations.uk': { en: 'UK Relations', zh: '英国关系' },
  'relations.usa': { en: 'USA Relations', zh: '美国关系' },
  'relations.germany': { en: 'Germany Relations', zh: '德国关系' },
  'relations.italy': { en: 'Italy Relations', zh: '意大利关系' },
  'relations.mexico': { en: 'Mexico Relations', zh: '墨西哥关系' },
  'domesticPolicy.land_reform_progress': { en: 'Land Reform Progress', zh: '土地改革进度' },
  'domesticPolicy.regional_autonomy_progress': { en: 'Regional Autonomy Progress', zh: '地方自治进度' },
  'armedForces.regularArmy.loyalty': { en: 'Regular Army Loyalty', zh: '正规军忠诚' },
  'armedForces.guardiaAsalto.loyalty': { en: 'Guardia de Asalto Loyalty', zh: '突击卫队忠诚' },
  internationalBrigades: { en: 'International Brigades', zh: '国际纵队' },
};

Object.assign(effectTargetLabels, {
  'stats.workerControl': { en: 'Worker Control', zh: '工人控制' },
  'stats.revolutionaryFervor': { en: 'Revolutionary Fervor', zh: '革命热情' },
  'stats.republicanAuthority': { en: 'Republican Authority', zh: '共和国权威' },
  'stats.armyLoyalty': { en: 'Army Loyalty', zh: '军队忠诚' },
  economy_growth: { en: 'Economic Growth', zh: '经济增长' },
  'stats.tension': { en: 'Tension', zh: '紧张局势' },
  'stats.bureaucratization': { en: 'Bureaucratization', zh: '官僚化' },
  'stats.anarchistMilitia': { en: 'Anarchist Militia', zh: '无政府主义民兵' },
  resources: { en: 'Resources', zh: '资源' },
  armaments: { en: 'Armaments', zh: '军备' },
  leverage: { en: 'Government Leverage', zh: '政府杠杆' },
  coupProgress: { en: 'Coup Progress', zh: '政变进度' },
  'factions.Faistas.influence': { en: 'Faistas Influence', zh: '无政府主义者影响力' },
  'factions.Treintistas.influence': { en: 'Treintistas Influence', zh: '三十人集团影响力' },
  'factions.Cenetistas.influence': { en: 'Cenetistas Influence', zh: '工团派影响力' },
  'factions.Puristas.influence': { en: 'Puristas Influence', zh: '纯粹派影响力' },
  'factions.Faistas.dissent': { en: 'Faistas Dissent', zh: '无政府主义者异议' },
  'factions.Treintistas.dissent': { en: 'Treintistas Dissent', zh: '三十人集团异议' },
  'classes.Obreros.support.CNT_FAI': { en: 'Worker Support for CNT-FAI', zh: '工人对CNT-FAI支持' },
  'classes.Braceros.support.CNT_FAI': { en: 'Rural Laborer Support for CNT-FAI', zh: '雇农对CNT-FAI支持' },
  'partyRelations.PSOE': { en: 'PSOE Relations', zh: 'PSOE关系' },
  'partyRelations.PCE': { en: 'PCE Relations', zh: 'PCE关系' },
  'partyRelations.IR': { en: 'IR Relations', zh: 'IR关系' },
  'partyRelations.POUM': { en: 'POUM Relations', zh: 'POUM关系' },
  'relations.ussr': { en: 'USSR Relations', zh: '苏联关系' },
  'relations.france': { en: 'France Relations', zh: '法国关系' },
  'relations.uk': { en: 'UK Relations', zh: '英国关系' },
  'relations.usa': { en: 'USA Relations', zh: '美国关系' },
  'relations.germany': { en: 'Germany Relations', zh: '德国关系' },
  'relations.italy': { en: 'Italy Relations', zh: '意大利关系' },
  'relations.mexico': { en: 'Mexico Relations', zh: '墨西哥关系' },
  'domesticPolicy.land_reform_progress': { en: 'Land Reform Progress', zh: '土地改革进度' },
  'domesticPolicy.regional_autonomy_progress': { en: 'Regional Autonomy Progress', zh: '地方自治进度' },
  'armedForces.regularArmy.loyalty': { en: 'Regular Army Loyalty', zh: '正规军忠诚' },
  'armedForces.guardiaAsalto.loyalty': { en: 'Guardia de Asalto Loyalty', zh: '突击卫队忠诚' },
  internationalBrigades: { en: 'International Brigades', zh: '国际纵队' },
});

const effectPresets: Array<Omit<EditorEffect, 'id'>> = [
  {
    presetId: 'worker_control_up',
    target: 'stats.workerControl',
    value: 5,
    description: 'Increase worker control',
    descriptionZh: '提高工人控制',
  },
  {
    presetId: 'revolutionary_fervor_up',
    target: 'stats.revolutionaryFervor',
    value: 5,
    description: 'Increase revolutionary fervor',
    descriptionZh: '提高革命热情',
  },
  {
    presetId: 'authority_up',
    target: 'stats.republicanAuthority',
    value: 5,
    description: 'Increase republican authority',
    descriptionZh: '提高共和国权威',
  },
  {
    presetId: 'resources_gain',
    target: 'resources',
    value: 1,
    description: 'Gain resources',
    descriptionZh: '获得资源',
  },
  {
    presetId: 'armaments_gain',
    target: 'armaments',
    value: 1,
    description: 'Gain armaments',
    descriptionZh: '获得军备',
  },
  {
    presetId: 'faistas_influence_up',
    target: 'factions.Faistas.influence',
    value: 5,
    description: 'Increase Faistas influence',
    descriptionZh: '提高无政府主义者影响力',
  },
  {
    presetId: 'treintistas_influence_up',
    target: 'factions.Treintistas.influence',
    value: 5,
    description: 'Increase Treintistas influence',
    descriptionZh: '提高三十人集团影响力',
  },
  {
    presetId: 'france_relations_up',
    target: 'relations.france',
    value: 5,
    description: 'Improve relations with France',
    descriptionZh: '改善与法国关系',
  },
];

const effectPresetTextOverrides: Record<string, Pick<Omit<EditorEffect, 'id'>, 'description' | 'descriptionZh'>> = {
  worker_control_up: { description: 'Increase worker control', descriptionZh: '提高工人控制' },
  revolutionary_fervor_up: { description: 'Increase revolutionary fervor', descriptionZh: '提高革命热情' },
  authority_up: { description: 'Increase republican authority', descriptionZh: '提高共和国权威' },
  resources_gain: { description: 'Gain resources', descriptionZh: '获得资源' },
  armaments_gain: { description: 'Gain armaments', descriptionZh: '获得军备' },
  faistas_influence_up: { description: 'Increase Faistas influence', descriptionZh: '提高无政府主义者影响力' },
  treintistas_influence_up: { description: 'Increase Treintistas influence', descriptionZh: '提高三十人集团影响力' },
  france_relations_up: { description: 'Improve relations with France', descriptionZh: '改善与法国关系' },
};

effectPresets.forEach((preset) => {
  const override = effectPresetTextOverrides[preset.presetId];
  if (override) Object.assign(preset, override);
});

effectPresets.push(
  {
    presetId: 'worker_control_down',
    target: 'stats.workerControl',
    value: -5,
    description: 'Reduce worker control',
    descriptionZh: '降低工人控制',
  },
  {
    presetId: 'revolutionary_fervor_down',
    target: 'stats.revolutionaryFervor',
    value: -5,
    description: 'Reduce revolutionary fervor',
    descriptionZh: '降低革命热情',
  },
  {
    presetId: 'authority_down',
    target: 'stats.republicanAuthority',
    value: -5,
    description: 'Reduce republican authority',
    descriptionZh: '降低共和国权威',
  },
  {
    presetId: 'army_loyalty_up',
    target: 'stats.armyLoyalty',
    value: 5,
    description: 'Increase army loyalty',
    descriptionZh: '提高军队忠诚',
  },
  {
    presetId: 'army_loyalty_down',
    target: 'stats.armyLoyalty',
    value: -5,
    description: 'Reduce army loyalty',
    descriptionZh: '降低军队忠诚',
  },
  {
    presetId: 'economy_up',
    target: 'economy_growth',
    value: 5,
    description: 'Improve economy',
    descriptionZh: '改善经济',
  },
  {
    presetId: 'economy_down',
    target: 'economy_growth',
    value: -5,
    description: 'Damage economy',
    descriptionZh: '损害经济',
  },
  {
    presetId: 'tension_up',
    target: 'stats.tension',
    value: 5,
    description: 'Increase tension',
    descriptionZh: '提高紧张局势',
  },
  {
    presetId: 'tension_down',
    target: 'stats.tension',
    value: -5,
    description: 'Reduce tension',
    descriptionZh: '降低紧张局势',
  },
  {
    presetId: 'bureaucratization_up',
    target: 'stats.bureaucratization',
    value: 5,
    description: 'Increase bureaucratization',
    descriptionZh: '提高官僚化',
  },
  {
    presetId: 'bureaucratization_down',
    target: 'stats.bureaucratization',
    value: -5,
    description: 'Reduce bureaucratization',
    descriptionZh: '降低官僚化',
  },
  {
    presetId: 'anarchist_militia_up',
    target: 'stats.anarchistMilitia',
    value: 5,
    description: 'Strengthen anarchist militias',
    descriptionZh: '加强无政府主义民兵',
  },
  {
    presetId: 'resources_spend',
    target: 'resources',
    value: -1,
    description: 'Spend resources',
    descriptionZh: '消耗资源',
  },
  {
    presetId: 'armaments_spend',
    target: 'armaments',
    value: -1,
    description: 'Spend armaments',
    descriptionZh: '消耗军备',
  },
  {
    presetId: 'leverage_gain',
    target: 'leverage',
    value: 1,
    description: 'Gain government leverage',
    descriptionZh: '获得政府杠杆',
  },
  {
    presetId: 'leverage_spend',
    target: 'leverage',
    value: -1,
    description: 'Spend government leverage',
    descriptionZh: '消耗政府杠杆',
  },
  {
    presetId: 'coup_progress_up',
    target: 'coupProgress',
    value: 5,
    description: 'Advance coup progress',
    descriptionZh: '推进政变进度',
  },
  {
    presetId: 'coup_progress_down',
    target: 'coupProgress',
    value: -5,
    description: 'Delay coup progress',
    descriptionZh: '延缓政变进度',
  },
  {
    presetId: 'cenetistas_influence_up',
    target: 'factions.Cenetistas.influence',
    value: 5,
    description: 'Increase Cenetistas influence',
    descriptionZh: '提高工团派影响力',
  },
  {
    presetId: 'puristas_influence_up',
    target: 'factions.Puristas.influence',
    value: 5,
    description: 'Increase Puristas influence',
    descriptionZh: '提高纯粹派影响力',
  },
  {
    presetId: 'faistas_dissent_up',
    target: 'factions.Faistas.dissent',
    value: 5,
    description: 'Increase Faistas dissent',
    descriptionZh: '提高无政府主义者异议',
  },
  {
    presetId: 'faistas_dissent_down',
    target: 'factions.Faistas.dissent',
    value: -5,
    description: 'Reduce Faistas dissent',
    descriptionZh: '降低无政府主义者异议',
  },
  {
    presetId: 'treintistas_dissent_up',
    target: 'factions.Treintistas.dissent',
    value: 5,
    description: 'Increase Treintistas dissent',
    descriptionZh: '提高三十人集团异议',
  },
  {
    presetId: 'treintistas_dissent_down',
    target: 'factions.Treintistas.dissent',
    value: -5,
    description: 'Reduce Treintistas dissent',
    descriptionZh: '降低三十人集团异议',
  },
  {
    presetId: 'obreros_cnt_support_up',
    target: 'classes.Obreros.support.CNT_FAI',
    value: 5,
    description: 'Increase worker support for CNT-FAI',
    descriptionZh: '提高工人对CNT-FAI的支持',
  },
  {
    presetId: 'braceros_cnt_support_up',
    target: 'classes.Braceros.support.CNT_FAI',
    value: 5,
    description: 'Increase rural laborer support for CNT-FAI',
    descriptionZh: '提高雇农对CNT-FAI的支持',
  },
  {
    presetId: 'psoe_relations_up',
    target: 'partyRelations.PSOE',
    value: 5,
    description: 'Improve PSOE relations',
    descriptionZh: '改善与PSOE关系',
  },
  {
    presetId: 'psoe_relations_down',
    target: 'partyRelations.PSOE',
    value: -5,
    description: 'Worsen PSOE relations',
    descriptionZh: '恶化与PSOE关系',
  },
  {
    presetId: 'pce_relations_up',
    target: 'partyRelations.PCE',
    value: 5,
    description: 'Improve PCE relations',
    descriptionZh: '改善与PCE关系',
  },
  {
    presetId: 'pce_relations_down',
    target: 'partyRelations.PCE',
    value: -5,
    description: 'Worsen PCE relations',
    descriptionZh: '恶化与PCE关系',
  },
  {
    presetId: 'ir_relations_up',
    target: 'partyRelations.IR',
    value: 5,
    description: 'Improve IR relations',
    descriptionZh: '改善与IR关系',
  },
  {
    presetId: 'poum_relations_up',
    target: 'partyRelations.POUM',
    value: 5,
    description: 'Improve POUM relations',
    descriptionZh: '改善与POUM关系',
  },
  {
    presetId: 'ussr_relations_up',
    target: 'relations.ussr',
    value: 5,
    description: 'Improve relations with the USSR',
    descriptionZh: '改善与苏联关系',
  },
  {
    presetId: 'uk_relations_up',
    target: 'relations.uk',
    value: 5,
    description: 'Improve relations with the UK',
    descriptionZh: '改善与英国关系',
  },
  {
    presetId: 'usa_relations_up',
    target: 'relations.usa',
    value: 5,
    description: 'Improve relations with the USA',
    descriptionZh: '改善与美国关系',
  },
  {
    presetId: 'germany_relations_down',
    target: 'relations.germany',
    value: -5,
    description: 'Worsen relations with Germany',
    descriptionZh: '恶化与德国关系',
  },
  {
    presetId: 'italy_relations_down',
    target: 'relations.italy',
    value: -5,
    description: 'Worsen relations with Italy',
    descriptionZh: '恶化与意大利关系',
  },
  {
    presetId: 'mexico_relations_up',
    target: 'relations.mexico',
    value: 5,
    description: 'Improve relations with Mexico',
    descriptionZh: '改善与墨西哥关系',
  },
  {
    presetId: 'land_reform_progress_up',
    target: 'domesticPolicy.land_reform_progress',
    value: 10,
    description: 'Advance land reform',
    descriptionZh: '推进土地改革',
  },
  {
    presetId: 'regional_autonomy_progress_up',
    target: 'domesticPolicy.regional_autonomy_progress',
    value: 10,
    description: 'Advance regional autonomy',
    descriptionZh: '推进地方自治',
  },
  {
    presetId: 'regular_army_loyalty_up',
    target: 'armedForces.regularArmy.loyalty',
    value: 5,
    description: 'Increase regular army loyalty',
    descriptionZh: '提高正规军忠诚',
  },
  {
    presetId: 'regular_army_loyalty_down',
    target: 'armedForces.regularArmy.loyalty',
    value: -5,
    description: 'Reduce regular army loyalty',
    descriptionZh: '降低正规军忠诚',
  },
  {
    presetId: 'guardia_asalto_loyalty_up',
    target: 'armedForces.guardiaAsalto.loyalty',
    value: 5,
    description: 'Increase Guardia de Asalto loyalty',
    descriptionZh: '提高突击卫队忠诚',
  },
  {
    presetId: 'international_brigades_up',
    target: 'internationalBrigades',
    value: 1,
    description: 'Gain international brigades',
    descriptionZh: '获得国际纵队',
  },
);

const createEffectFromPreset = (presetId: string): EditorEffect => {
  const preset = effectPresets.find((item) => item.presetId === presetId) || effectPresets[0];
  return {
    ...preset,
    id: `effect_${Date.now()}_${Math.random().toString(16).slice(2, 6)}`,
  };
};

const createBaseDraft = (): EditorDraft => ({
  events: normalizeEvents(),
  advisors: normalizeAdvisors(),
  journals: normalizeJournals(),
  cards: normalizeCards(),
});

const ensureDraftShape = (draft: EditorDraft): EditorDraft => {
  const base = createBaseDraft();
  const nonCardIds = new Set([
    ...base.events.map((item) => item.id),
    ...base.advisors.map((item) => item.id),
    ...base.journals.map((item) => item.id),
  ]);
  const isKnownCardType = (type: string): type is CardType =>
    type === 'Action' || type === 'Government' || type === 'Military';

  return {
    ...draft,
    events: (draft.events || []).map((event) => {
      const baseEvent = base.events.find((item) => item.id === event.id);
      return {
        ...event,
        category: isEventCategory(event.category) ? event.category : baseEvent?.category || 'other',
        flow: isEventFlow(event.flow) ? event.flow : baseEvent?.flow || 'solo',
        series: event.series ?? baseEvent?.series ?? [],
        tags: event.tags ?? baseEvent?.tags ?? [],
        hasMeta: event.hasMeta ?? baseEvent?.hasMeta ?? false,
        conditionSource: event.conditionSource ?? baseEvent?.conditionSource,
        sourcePath: baseEvent?.sourcePath || event.sourcePath,
        sourceOrder: baseEvent?.sourceOrder ?? event.sourceOrder,
        exportName: baseEvent?.exportName || event.exportName,
        conditionFields: baseEvent?.conditionFields || event.conditionFields || [],
        conditionSnippets: baseEvent?.conditionSnippets || event.conditionSnippets || [],
        effectFields: baseEvent?.effectFields || event.effectFields || [],
        referencedSymbols: baseEvent?.referencedSymbols || event.referencedSymbols || [],
        options: (event.options || []).map((option, index) => ({
          ...option,
          unavailableSubtitle: option.unavailableSubtitle ?? baseEvent?.options[index]?.unavailableSubtitle,
          unavailableSubtitleZh: option.unavailableSubtitleZh ?? baseEvent?.options[index]?.unavailableSubtitleZh,
          conditionSnippet: option.conditionSnippet ?? baseEvent?.options[index]?.conditionSnippet,
          conditionSource: option.conditionSource ?? baseEvent?.options[index]?.conditionSource,
          targetEventIds: option.targetEventIds ?? baseEvent?.options[index]?.targetEventIds ?? [],
          endsFlow: option.endsFlow ?? baseEvent?.options[index]?.endsFlow ?? false,
          sourceEffects: option.sourceEffects || baseEvent?.options[index]?.sourceEffects || [],
          effects: option.effects || [],
        })),
      };
    }),
    advisors: (draft.advisors || []).map((advisor) => {
      const baseAdvisor = base.advisors.find((item) => item.id === advisor.id);
      return {
        ...advisor,
        actions: (advisor.actions || []).map((action, index) => ({
          ...action,
          sourceEffects: action.sourceEffects || baseAdvisor?.actions[index]?.sourceEffects || [],
          effects: action.effects || [],
        })),
      };
    }),
    journals: (draft.journals || []).map((journal) => {
      const baseJournal = base.journals.find((item) => item.id === journal.id);
      return { ...journal, sourceEffects: journal.sourceEffects || baseJournal?.sourceEffects || [], effects: journal.effects || [] };
    }),
    cards: (draft.cards || [])
      .filter((card) => {
        const isSourceCard = base.cards.some((item) => item.id === card.id);
        const isNewCard = card.id.startsWith('new_');
        return !nonCardIds.has(card.id) && isKnownCardType(card.type) && (isSourceCard || isNewCard);
      })
      .map((card) => {
        const baseCard = base.cards.find((item) => item.id === card.id);
        return {
          ...card,
          sourcePath: baseCard?.sourcePath || card.sourcePath,
          exportName: baseCard?.exportName || card.exportName,
          conditionSource: card.conditionSource ?? baseCard?.conditionSource,
          conditionFields: card.conditionFields || baseCard?.conditionFields || [],
          unavailableSubtitle: card.unavailableSubtitle ?? baseCard?.unavailableSubtitle,
          unavailableSubtitleZh: card.unavailableSubtitleZh ?? baseCard?.unavailableSubtitleZh,
          cooldown: card.cooldown ?? baseCard?.cooldown,
          timer: card.timer ?? baseCard?.timer,
          eventTransition: card.eventTransition || baseCard?.eventTransition || {
            currentEventTargets: [],
            pendingEventTargets: [],
            dynamic: false,
          },
          sourceEffects: card.sourceEffects || baseCard?.sourceEffects || [],
          effects: card.effects || [],
        };
      }),
  };
};

const loadDraft = (): EditorDraft => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createBaseDraft();
    const parsed = JSON.parse(raw) as EditorDraft;
    return ensureDraftShape({
      ...createBaseDraft(),
      ...parsed,
    });
  } catch {
    return createBaseDraft();
  }
};

const tabMeta: Record<EditorTab, { label: Record<EditorLanguage, string>; icon: React.ReactNode }> = {
  events: { label: { en: 'Events', zh: '事件' }, icon: <FileText className="w-4 h-4" /> },
  advisors: { label: { en: 'Advisors', zh: '顾问' }, icon: <Users className="w-4 h-4" /> },
  journals: { label: { en: 'Journals', zh: '日志' }, icon: <BookOpen className="w-4 h-4" /> },
  cards: { label: { en: 'Cards', zh: '卡牌' }, icon: <Swords className="w-4 h-4" /> },
  roadmap: { label: { en: 'Roadmap', zh: '路线图' }, icon: <GitBranch className="w-4 h-4" /> },
  test: { label: { en: 'Test', zh: '测试' }, icon: <Zap className="w-4 h-4" /> },
};

const cardIcons: Record<CardType, React.ReactNode> = {
  Action: <Zap className="w-4 h-4" />,
  Government: <Landmark className="w-4 h-4" />,
  Military: <Shield className="w-4 h-4" />,
};

const eventCategoryLabels: Record<EventCategory, Record<EditorLanguage, string>> = {
  news: { en: 'News', zh: '新闻宣告' },
  cnt: { en: 'CNT', zh: 'CNT' },
  politics: { en: 'Politics', zh: '政治' },
  war: { en: 'War', zh: '战争' },
  other: { en: 'Other', zh: '其他' },
};

const eventFlowLabels: Record<EventFlow, Record<EditorLanguage, string>> = {
  solo: { en: 'Solo', zh: '独立事件' },
  'inline.root': { en: 'Inline Root', zh: '链入口' },
  'inline.node': { en: 'Inline Node', zh: '链中间节点' },
  'inline.leaf': { en: 'Inline Leaf', zh: '链终点' },
};

const pickLocalized = (language: EditorLanguage, english?: string, chinese?: string) =>
  language === 'zh' ? chinese || english || '' : english || chinese || '';

const getLocalizedItemTitle = (
  item: { title?: string; titleZh?: string; name?: string; nameZh?: string; id: string },
  language: EditorLanguage,
) => pickLocalized(language, item.title || item.name, item.titleZh || item.nameZh) || item.id;

const getLocalizedEventTitle = (event: EditableEvent, language: EditorLanguage) =>
  pickLocalized(language, event.title, event.titleZh) || event.id;

const getCardCodegenSource = (card: EditableCard): CardCodegenSource | undefined => {
  if (!card.sourcePath) return undefined;
  const files = card.type === 'Action'
    ? sourceGlobs.actionCards
    : card.type === 'Government'
      ? sourceGlobs.governmentCards
      : sourceGlobs.militaryCards;
  const source = files[card.sourcePath];
  return source ? { pathName: card.sourcePath, source } : undefined;
};

const getEventCodegenSource = (event: EditableEvent): EventCodegenSource | undefined => {
  if (!event.sourcePath) return undefined;
  const source = sourceGlobs.events[event.sourcePath];
  return source ? { pathName: event.sourcePath, source } : undefined;
};

export default function ContentEditor() {
  const [draft, setDraft] = React.useState<EditorDraft>(() => loadDraft());
  const [activeTab, setActiveTab] = React.useState<EditorTab>('events');
  const [selectedId, setSelectedId] = React.useState<string>(draft.events[0]?.id || '');
  const [editorLanguage, setEditorLanguage] = React.useState<EditorLanguage>('en');
  const [cardTypeFilter, setCardTypeFilter] = React.useState<CardType>('Action');
  const [query, setQuery] = React.useState('');
  const [status, setStatus] = React.useState('');
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const flowAnalysis = React.useMemo(() => analyzeEventFlow(sourceGlobs), []);

  const currentCollection = React.useMemo(() => {
    if (activeTab === 'roadmap' || activeTab === 'test') return draft.events;
    if (activeTab === 'cards') return draft.cards.filter((card) => card.type === cardTypeFilter);
    return draft[activeTab];
  }, [activeTab, cardTypeFilter, draft]);
  const filteredItems = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return currentCollection;
    return currentCollection.filter((item) => {
      const values = Object.values(item).filter((value) => typeof value === 'string') as string[];
      return values.some((value) => value.toLowerCase().includes(q));
    });
  }, [currentCollection, query]);

  React.useEffect(() => {
    if (!currentCollection.some((item) => item.id === selectedId)) {
      setSelectedId(currentCollection[0]?.id || '');
    }
  }, [currentCollection, selectedId]);

  const saveDraft = async () => {
    const nextDraft = ensureDraftShape({ ...draft, updatedAt: new Date().toISOString() });
    setDraft(nextDraft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(nextDraft));
    try {
      const response = await fetch('/api/editor/save-draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextDraft),
      });
      if (!response.ok) throw new Error('save failed');
      setStatus(editorLanguage === 'zh' ? '草稿已保存到浏览器和编辑器目录。' : 'Draft saved to browser storage and editor folder.');
    } catch {
      setStatus(editorLanguage === 'zh' ? '草稿已保存到浏览器本地存储。' : 'Draft saved to local browser storage.');
    }
  };

  const exportDraft = () => {
    const payload = JSON.stringify({ ...draft, updatedAt: new Date().toISOString() }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'cnt-fai-content-draft.json';
    link.click();
    URL.revokeObjectURL(url);
    setStatus(editorLanguage === 'zh' ? '草稿已导出为 JSON。' : 'Draft exported as JSON.');
  };

  const exportCardTs = async () => {
    const card = draft.cards.find((item) => item.id === selectedId);
    if (!card) {
      setStatus(editorLanguage === 'zh' ? '当前没有选中的卡牌。' : 'No card is selected.');
      return;
    }

    const result = buildCardTypeScript(card, getCardCodegenSource(card));
    const blob = new Blob([result.content], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);

    let savedPath = result.suggestedPath;
    try {
      const response = await fetch('/api/editor/save-card-ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ family: result.family, filename: result.filename, content: result.content }),
      });
      if (response.ok) {
        const payload = await response.json() as { path?: string };
        savedPath = payload.path || savedPath;
      }
    } catch {
      // Browser download still succeeds when the editor is opened without its Vite server.
    }

    const warningText = result.warnings.length > 0 ? ` 注意：${result.warnings.join(' ')}` : '';
    setStatus(editorLanguage === 'zh'
      ? `TS 已下载并尝试写入 ${savedPath}。${warningText}`
      : `TS downloaded and written to ${savedPath} when the editor server is available.${result.warnings.length > 0 ? ` Warnings: ${result.warnings.join(' ')}` : ''}`);
  };

  const exportEventTs = async () => {
    const event = draft.events.find((item) => item.id === selectedId);
    if (!event) {
      setStatus(editorLanguage === 'zh' ? '当前没有选中的事件。' : 'No event is selected.');
      return;
    }

    const result = buildEventTypeScript(
      event,
      getEventCodegenSource(event),
      flowAnalysis.events.map((item) => ({ id: item.id, exportName: item.exportName, sourcePath: item.sourcePath })),
    );
    const blob = new Blob([result.content], { type: 'text/typescript;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.filename;
    link.click();
    URL.revokeObjectURL(url);

    let savedPath = result.suggestedPath;
    try {
      const response = await fetch('/api/editor/save-event-ts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: result.filename, content: result.content }),
      });
      if (response.ok) {
        const payload = await response.json() as { path?: string };
        savedPath = payload.path || savedPath;
      }
    } catch {
      // Browser download still succeeds when the editor is opened without its Vite server.
    }

    const warningText = result.warnings.length > 0 ? ` 注意：${result.warnings.join(' ')}` : '';
    setStatus(editorLanguage === 'zh'
      ? `事件 TS 已下载并尝试写入 ${savedPath}。${warningText}`
      : `Event TS downloaded and written to ${savedPath} when the editor server is available.${result.warnings.length > 0 ? ` Warnings: ${result.warnings.join(' ')}` : ''}`);
  };

  const importDraft = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as EditorDraft;
        setDraft(ensureDraftShape({ ...createBaseDraft(), ...parsed, updatedAt: new Date().toISOString() }));
        setStatus(editorLanguage === 'zh' ? '草稿已导入。' : 'Draft imported.');
      } catch {
        setStatus(editorLanguage === 'zh' ? '导入失败：JSON 无效。' : 'Import failed: invalid JSON.');
      }
    };
    reader.readAsText(file);
  };

  const updateItem = <T extends EditorCollectionKey>(
    collection: T,
    id: string,
    updater: (item: EditorDraft[T][number]) => EditorDraft[T][number],
  ) => {
    setDraft((prev) => ({
      ...prev,
      [collection]: (prev[collection] as EditorDraft[T][number][]).map((item) =>
        item.id === id ? updater(item) : item,
      ),
    }));
  };

  const updateNestedOption = (eventId: string, optionIndex: number, patch: Partial<EditableOption>) => {
    updateItem('events', eventId, (item) => {
      const event = item as EditableEvent;
      return {
        ...event,
        options: event.options.map((option, index) => (index === optionIndex ? { ...option, ...patch } : option)),
      };
    });
  };

  const addNestedOption = (eventId: string) => {
    updateItem('events', eventId, (item) => {
      const event = item as EditableEvent;
      return {
        ...event,
        options: [
          ...event.options,
          {
            text: 'New Option',
            textZh: '新选项',
            subtitle: '',
            subtitleZh: '',
            unavailableSubtitle: '',
            unavailableSubtitleZh: '',
            hasCondition: false,
            conditionSnippet: '',
            conditionSource: '',
            targetEventIds: [],
            endsFlow: true,
            hasScriptedEffect: false,
            sourceEffects: [],
            effects: [createEffectFromPreset('worker_control_up')],
          },
        ],
      };
    });
  };

  const deleteNestedOption = (eventId: string, optionIndex: number) => {
    updateItem('events', eventId, (item) => {
      const event = item as EditableEvent;
      return { ...event, options: event.options.filter((_, index) => index !== optionIndex) };
    });
  };

  const updateNestedAdvisorAction = (advisorId: string, actionIndex: number, patch: Partial<EditableAdvisorAction>) => {
    updateItem('advisors', advisorId, (item) => {
      const advisor = item as EditableAdvisor;
      return {
        ...advisor,
        actions: advisor.actions.map((action, index) => (index === actionIndex ? { ...action, ...patch } : action)),
      };
    });
  };

  const addNestedAdvisorAction = (advisorId: string) => {
    updateItem('advisors', advisorId, (item) => {
      const advisor = item as EditableAdvisor;
      return {
        ...advisor,
        actions: [
          ...advisor.actions,
          {
            id: `${advisor.id}_action_${Date.now()}`,
            title: 'New Action',
            titleZh: '新行动',
            subtitle: '',
            subtitleZh: '',
            description: '',
            descriptionZh: '',
            hasCondition: false,
            hasScriptedEffect: false,
            sourceEffects: [],
            effects: [createEffectFromPreset('resources_gain')],
          },
        ],
      };
    });
  };

  const deleteNestedAdvisorAction = (advisorId: string, actionIndex: number) => {
    updateItem('advisors', advisorId, (item) => {
      const advisor = item as EditableAdvisor;
      return { ...advisor, actions: advisor.actions.filter((_, index) => index !== actionIndex) };
    });
  };

  const resetDraft = () => {
    const base = createBaseDraft();
    setDraft(base);
    setSelectedId(base.events[0]?.id || '');
    localStorage.removeItem(STORAGE_KEY);
    setStatus(editorLanguage === 'zh' ? '草稿已重置为源文件数据。' : 'Draft reset to source data.');
  };

  const addItem = () => {
    const stamp = Date.now();
    if (activeTab === 'events' || activeTab === 'roadmap' || activeTab === 'test') {
      const event: EditableEvent = {
        id: `new_event_${stamp}`,
        category: 'news',
        flow: 'solo',
        series: [],
        tags: [],
        hasMeta: true,
        title: 'New Event',
        titleZh: '新事件',
        description: '',
        descriptionZh: '',
        year: 1931,
        month: 1,
        hasCondition: false,
        conditionSource: '',
        hasCustomRender: false,
        sourceOrder: 0,
        conditionFields: [],
        conditionSnippets: [],
        effectFields: [],
        referencedSymbols: [],
        options: [{
          text: 'Confirm',
          textZh: '确认',
          subtitle: '',
          subtitleZh: '',
          unavailableSubtitle: '',
          unavailableSubtitleZh: '',
          hasCondition: false,
          conditionSnippet: '',
          conditionSource: '',
          targetEventIds: [],
          endsFlow: true,
          hasScriptedEffect: false,
          sourceEffects: [],
          effects: [createEffectFromPreset('worker_control_up')],
        }],
      };
      setDraft((prev) => ({ ...prev, events: [event, ...prev.events] }));
      setActiveTab('events');
      setSelectedId(event.id);
      return;
    }

    if (activeTab === 'advisors') {
      const advisor: EditableAdvisor = {
        id: `new_advisor_${stamp}`,
        name: 'New Advisor',
        nameZh: '新顾问',
        faction: 'None',
        description: '',
        descriptionZh: '',
        image: '',
        actions: [{
          id: `new_advisor_action_${stamp}`,
          title: 'New Action',
          titleZh: '新行动',
          subtitle: '',
          subtitleZh: '',
          description: '',
          descriptionZh: '',
          hasCondition: false,
          hasScriptedEffect: false,
          sourceEffects: [],
          effects: [createEffectFromPreset('resources_gain')],
        }],
      };
      setDraft((prev) => ({ ...prev, advisors: [advisor, ...prev.advisors] }));
      setSelectedId(advisor.id);
      return;
    }

    if (activeTab === 'journals') {
      const journal: EditableJournal = {
        id: `new_journal_${stamp}`,
        title: 'New Journal',
        titleZh: '新日志',
        description: '',
        descriptionZh: '',
        successCondition: '',
        successConditionZh: '',
        successEffectDesc: '',
        successEffectDescZh: '',
        failureCondition: '',
        failureConditionZh: '',
        failureEffectDesc: '',
        failureEffectDescZh: '',
        hasProgress: true,
        progressMax: 100,
        hasAutomation: false,
        sourceEffects: [],
        effects: [createEffectFromPreset('revolutionary_fervor_up')],
      };
      setDraft((prev) => ({ ...prev, journals: [journal, ...prev.journals] }));
      setSelectedId(journal.id);
      return;
    }

    const card: EditableCard = {
      id: `new_${cardTypeFilter.toLowerCase()}_card_${stamp}`,
      title: `New ${cardTypeFilter} Card`,
      titleZh: cardTypeFilter === 'Action' ? '新行动卡牌' : cardTypeFilter === 'Government' ? '新政府卡牌' : '新武装卡牌',
      type: cardTypeFilter,
      description: '',
      descriptionZh: '',
      cost: 1,
      resourceCost: 0,
      armamentCost: 0,
      conditionSource: '',
      conditionFields: [],
      unavailableSubtitle: '',
      unavailableSubtitleZh: '',
      cooldown: undefined,
      timer: undefined,
      eventTransition: {
        currentEventTargets: [],
        pendingEventTargets: [],
        dynamic: false,
      },
      hasCondition: false,
      hasScriptedEffect: false,
      sourceEffects: [],
      effects: [createEffectFromPreset(cardTypeFilter === 'Military' ? 'armaments_gain' : 'worker_control_up')],
    };
    setDraft((prev) => ({ ...prev, cards: [card, ...prev.cards] }));
    setSelectedId(card.id);
  };

  const stats = {
    events: draft.events.length,
    advisors: draft.advisors.length,
    journals: draft.journals.length,
    cards: draft.cards.length,
  };
  const selectedCardForExport = draft.cards.find((card) => card.id === selectedId);
  const selectedEventForExport = draft.events.find((event) => event.id === selectedId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-screen bg-paper text-ink p-3 md:p-6"
    >
      <motion.div
        initial={{ y: 18, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        exit={{ y: 18, scale: 0.98 }}
        className="h-[calc(100vh-1.5rem)] md:h-[calc(100vh-3rem)] bg-paper text-ink border-print shadow-2xl flex flex-col overflow-hidden"
      >
        <header className="bg-ink text-paper border-b-4 border-cnt-red px-5 py-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-12 h-12 border-2 border-paper flex items-center justify-center text-cnt-red flex-shrink-0">
              <FilePenLine className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-3xl uppercase tracking-widest leading-none">
                {editorLanguage === 'zh' ? '内容编辑器' : 'Content Editor'}
              </h2>
              <p className="font-typewriter text-[10px] uppercase tracking-widest opacity-70 truncate">
                {editorLanguage === 'zh'
                  ? `CNT-FAI 档案桌 · ${stats.events} 事件 · ${stats.advisors} 顾问 · ${stats.journals} 日志 · ${stats.cards} 卡牌`
                  : `CNT-FAI archival desk · ${stats.events} events · ${stats.advisors} advisors · ${stats.journals} journals · ${stats.cards} cards`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="flex border border-paper/60 flex-shrink-0">
              {(['en', 'zh'] as EditorLanguage[]).map((language) => (
                <button
                  key={language}
                  onClick={() => setEditorLanguage(language)}
                  className={cn(
                    'px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest transition-colors',
                    editorLanguage === language ? 'bg-paper text-ink' : 'text-paper hover:bg-paper/10',
                  )}
                >
                  {language === 'en' ? 'EN' : '中文'}
                </button>
              ))}
            </div>
            <EditorCommand icon={<Save className="w-4 h-4" />} label={editorLanguage === 'zh' ? '保存' : 'Save'} onClick={saveDraft} />
            <EditorCommand icon={<Upload className="w-4 h-4" />} label={editorLanguage === 'zh' ? '导入' : 'Import'} onClick={() => fileInputRef.current?.click()} />
            <EditorCommand icon={<Download className="w-4 h-4" />} label={editorLanguage === 'zh' ? '导出' : 'Export'} onClick={exportDraft} />
            {activeTab === 'cards' && selectedCardForExport && (
              <EditorCommand icon={<FileText className="w-4 h-4" />} label={editorLanguage === 'zh' ? '输出 TS' : 'Emit TS'} onClick={exportCardTs} />
            )}
            {activeTab === 'events' && selectedEventForExport && (
              <EditorCommand icon={<FileText className="w-4 h-4" />} label={editorLanguage === 'zh' ? '输出事件 TS' : 'Emit Event TS'} onClick={exportEventTs} />
            )}
            <button
              onClick={resetDraft}
              className="px-3 py-2 border border-paper/60 hover:bg-paper hover:text-ink transition-colors font-typewriter text-[10px] uppercase tracking-widest flex-shrink-0"
            >
              {editorLanguage === 'zh' ? '重置' : 'Reset'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => importDraft(event.target.files?.[0])}
          />
        </header>

        {status && (
          <div className="bg-cnt-red text-paper px-5 py-2 font-typewriter text-xs uppercase tracking-widest">
            {status}
          </div>
        )}

        <div className="flex flex-1 min-h-0">
          <aside className="w-20 md:w-64 border-r-2 border-ink bg-paper-dark flex flex-col">
            <nav className="p-3 flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible">
              {(Object.keys(tabMeta) as EditorTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setActiveTab(tab);
                    setQuery('');
                  }}
                  className={cn(
                    'flex items-center justify-center md:justify-start gap-3 border-2 px-3 py-3 font-typewriter text-xs uppercase tracking-widest transition-colors',
                    activeTab === tab
                      ? 'bg-ink text-paper border-ink shadow-[3px_3px_0_0_rgba(193,39,45,1)]'
                      : 'bg-paper border-ink/40 hover:border-ink hover:bg-paper',
                  )}
                  title={tabMeta[tab].label[editorLanguage]}
                >
                  {tabMeta[tab].icon}
                  <span className="hidden md:inline">{tabMeta[tab].label[editorLanguage]}</span>
                </button>
              ))}
            </nav>

            <div className="hidden md:block px-3 pb-3">
              <button
                onClick={addItem}
                className="mb-3 w-full flex items-center justify-center gap-2 bg-cnt-red text-paper border-2 border-cnt-red px-3 py-2 font-typewriter text-xs uppercase tracking-widest hover:bg-ink hover:border-ink transition-colors"
              >
                <Plus className="w-4 h-4" />
                {editorLanguage === 'zh'
                  ? activeTab === 'cards'
                    ? `新增${cardTypeFilter === 'Action' ? '行动' : cardTypeFilter === 'Government' ? '政府' : '武装'}卡牌`
                    : `新增${tabMeta[activeTab === 'roadmap' || activeTab === 'test' ? 'events' : activeTab].label.zh}`
                  : activeTab === 'cards'
                    ? `New ${cardTypeFilter} Card`
                    : `New ${tabMeta[activeTab === 'roadmap' || activeTab === 'test' ? 'events' : activeTab].label.en}`}
              </button>

              {activeTab === 'cards' && (
                <div className="mb-3 grid grid-cols-1 gap-1">
                  {(['Action', 'Government', 'Military'] as CardType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setCardTypeFilter(type)}
                      className={cn(
                        'flex items-center justify-between border px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest transition-colors',
                        cardTypeFilter === type ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/30 hover:border-ink',
                      )}
                    >
                      <span className="inline-flex items-center gap-2">
                        {cardIcons[type]}
                        {editorLanguage === 'zh'
                          ? type === 'Action' ? '行动卡牌' : type === 'Government' ? '政府卡牌' : '武装卡牌'
                          : `${type} Cards`}
                      </span>
                      <span>{draft.cards.filter((card) => card.type === type).length}</span>
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 opacity-50" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="w-full bg-paper border border-ink pl-9 pr-3 py-2 font-typewriter text-xs focus:outline-none focus:ring-1 focus:ring-cnt-red"
                  placeholder={editorLanguage === 'zh' ? '搜索' : 'Search'}
                />
              </div>
            </div>

            <div className="hidden md:flex flex-1 min-h-0 overflow-y-auto px-3 pb-3 flex-col gap-2">
              {activeTab === 'roadmap' ? (
                <RoadmapLegend events={draft.events} selectedId={selectedId} onSelect={setSelectedId} language={editorLanguage} />
              ) : (
                filteredItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(item.id)}
                    className={cn(
                      'text-left border p-3 transition-colors',
                      selectedId === item.id ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/20 hover:border-ink',
                    )}
                  >
                    <div className="font-display uppercase text-lg leading-none truncate">{getLocalizedItemTitle(item, editorLanguage)}</div>
                    <div className="font-mono text-[10px] opacity-60 truncate mt-1">{item.id}</div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <main className="flex-1 min-w-0 overflow-y-auto bg-halftone p-4 md:p-6">
            {activeTab === 'events' && (
              <EventEditor
                item={draft.events.find((event) => event.id === selectedId) || draft.events[0]}
                language={editorLanguage}
                onPatch={(id, patch) => updateItem('events', id, (item) => ({ ...(item as EditableEvent), ...patch }))}
                onOptionPatch={updateNestedOption}
                onOptionAdd={addNestedOption}
                onOptionDelete={deleteNestedOption}
              />
            )}
            {activeTab === 'advisors' && (
              <AdvisorEditor
                item={draft.advisors.find((advisor) => advisor.id === selectedId) || draft.advisors[0]}
                language={editorLanguage}
                onPatch={(id, patch) => updateItem('advisors', id, (item) => ({ ...(item as EditableAdvisor), ...patch }))}
                onActionPatch={updateNestedAdvisorAction}
                onActionAdd={addNestedAdvisorAction}
                onActionDelete={deleteNestedAdvisorAction}
              />
            )}
            {activeTab === 'journals' && (
              <JournalEditor
                item={draft.journals.find((journal) => journal.id === selectedId) || draft.journals[0]}
                language={editorLanguage}
                onPatch={(id, patch) => updateItem('journals', id, (item) => ({ ...(item as EditableJournal), ...patch }))}
              />
            )}
            {activeTab === 'cards' && (
              <CardEditor
                item={draft.cards.find((card) => card.id === selectedId) || draft.cards[0]}
                language={editorLanguage}
                onPatch={(id, patch) => updateItem('cards', id, (item) => ({ ...(item as EditableCard), ...patch }))}
              />
            )}
            {activeTab === 'test' && (
              <SandboxTester language={editorLanguage} />
            )}
            {activeTab === 'roadmap' && (
              <FlowRoadmapView flow={flowAnalysis} selectedId={selectedId} onSelect={setSelectedId} language={editorLanguage} />
            )}
          </main>
        </div>
      </motion.div>
    </motion.div>
  );
}

const EditorCommand: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-3 py-2 border border-paper/60 hover:bg-paper hover:text-ink transition-colors font-typewriter text-[10px] uppercase tracking-widest flex-shrink-0"
  >
    {icon}
    <span>{label}</span>
  </button>
);

const Field: React.FC<{
  label: string;
  value: string | number | undefined;
  multiline?: boolean;
  type?: 'text' | 'number';
  onChange: (value: string) => void;
}> = ({ label, value, multiline, type = 'text', onChange }) => (
  <label className="flex flex-col gap-1">
    <span className="font-typewriter text-[10px] uppercase tracking-widest opacity-70">{label}</span>
    {multiline ? (
      <textarea
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        rows={5}
        className="bg-paper border-2 border-ink/50 p-3 font-serif text-base leading-relaxed focus:outline-none focus:border-cnt-red resize-y"
      />
    ) : (
      <input
        type={type}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
        className="bg-paper border-2 border-ink/50 p-3 font-mono text-sm focus:outline-none focus:border-cnt-red"
      />
    )}
  </label>
);

const EffectsEditor: React.FC<{
  effects: EditorEffect[];
  sourceEffects?: SourceEffect[];
  language: EditorLanguage;
  scripted?: boolean;
  onChange: (effects: EditorEffect[]) => void;
}> = ({ effects, sourceEffects = [], language, scripted, onChange }) => {
  const addPreset = (presetId: string) => {
    onChange([...effects, createEffectFromPreset(presetId)]);
  };

  const updateEffect = (effectId: string, patch: Partial<EditorEffect>) => {
    onChange(effects.map((effect) => effect.id === effectId ? { ...effect, ...patch } : effect));
  };

  const removeEffect = (effectId: string) => {
    onChange(effects.filter((effect) => effect.id !== effectId));
  };

  return (
    <div className="border-2 border-ink/30 bg-paper p-3">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
        <div>
          <div className="font-typewriter text-xs uppercase tracking-widest">
            {language === 'zh' ? '效果' : 'Effects'}
          </div>
          {scripted && (
            <div className="font-serif text-xs italic text-cnt-red mt-1">
              {language === 'zh' ? '源文件包含脚本效果；下方预设会作为编辑器草稿附加保存。' : 'Source has scripted effects; presets below are saved as editor draft effects.'}
            </div>
          )}
        </div>
        <select
          value=""
          onChange={(event) => {
            if (event.target.value) addPreset(event.target.value);
            event.target.value = '';
          }}
          className="bg-paper-dark border border-ink px-3 py-2 font-typewriter text-xs uppercase tracking-widest"
        >
          <option value="">{language === 'zh' ? '添加预设效果' : 'Add preset effect'}</option>
          {effectPresets.map((preset) => (
            <option key={preset.presetId} value={preset.presetId}>
              {language === 'zh' ? preset.descriptionZh : preset.description}
            </option>
          ))}
        </select>
      </div>

      {(sourceEffects.length > 0 || scripted) && (
        <div className="mb-3 border border-ink/30 bg-paper-dark p-3">
          <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-2">
            {language === 'zh' ? '当前脚本效果' : 'Current Scripted Effects'}
          </div>
          {sourceEffects.length > 0 ? (
            <div className="flex flex-col gap-2">
              {sourceEffects.map((effect) => (
                <div key={effect.id} className="border border-ink/20 bg-paper p-3">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
                    <div className="font-typewriter text-[10px] uppercase tracking-widest">{effect.label}</div>
                    {effect.fields.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {effect.fields.map((field) => (
                          <span key={field} className="border border-ink/30 px-2 py-0.5 font-mono text-[10px] bg-paper-dark">
                            {field}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-words bg-ink text-paper p-2 font-mono text-[10px] leading-relaxed">
                    {effect.snippet}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-ink/30 p-3 font-serif text-sm italic opacity-70">
              {language === 'zh'
                ? '检测到源文件包含脚本效果，但当前无法自动提取具体片段。'
                : 'A source scripted effect was detected, but no snippet could be extracted automatically.'}
            </div>
          )}
        </div>
      )}

      {effects.length === 0 ? (
        <div className="border border-dashed border-ink/30 p-3 font-serif text-sm italic opacity-70">
          {language === 'zh' ? '暂无预设效果。' : 'No preset effects yet.'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {effects.map((effect) => (
            <div key={effect.id} className="border border-ink/30 bg-paper-dark p-3 grid grid-cols-1 xl:grid-cols-[1fr_7rem_2rem] gap-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex flex-col gap-1">
                  <span className="font-typewriter text-[10px] uppercase tracking-widest opacity-70">
                    {language === 'zh' ? '目标' : 'Target'}
                  </span>
                  <select
                    value={effect.target}
                    onChange={(event) => updateEffect(effect.id, { target: event.target.value as EffectTarget })}
                    className="bg-paper border-2 border-ink/50 p-3 font-mono text-sm"
                  >
                    {(Object.keys(effectTargetLabels) as EffectTarget[]).map((target) => (
                      <option key={target} value={target}>{effectTargetLabels[target][language]}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label={language === 'zh' ? '英文说明' : 'Description'}
                  value={effect.description}
                  onChange={(value) => updateEffect(effect.id, { description: value })}
                />
                <Field
                  label={language === 'zh' ? '中文说明' : 'Chinese Description'}
                  value={effect.descriptionZh}
                  onChange={(value) => updateEffect(effect.id, { descriptionZh: value })}
                />
              </div>
              <Field
                label={language === 'zh' ? '数值' : 'Value'}
                value={effect.value}
                type="number"
                onChange={(value) => updateEffect(effect.id, { value: Number(value) || 0 })}
              />
              <button
                onClick={() => removeEffect(effect.id)}
                className="border border-cnt-red text-cnt-red hover:bg-cnt-red hover:text-paper transition-colors flex items-center justify-center min-h-10"
                title={language === 'zh' ? '删除效果' : 'Delete effect'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const ScriptBadge: React.FC<{ children: React.ReactNode; tone?: 'red' | 'ink' }> = ({ children, tone = 'ink' }) => (
  <span
    className={cn(
      'inline-flex items-center border px-2 py-1 font-typewriter text-[10px] uppercase tracking-widest',
      tone === 'red' ? 'border-cnt-red text-cnt-red bg-cnt-red/5' : 'border-ink/40 text-ink-light bg-paper-dark',
    )}
  >
    {children}
  </span>
);

const EditorShell: React.FC<{
  eyebrow: string;
  title: string;
  id: string;
  badges?: React.ReactNode;
  children: React.ReactNode;
}> = ({ eyebrow, title, id, badges, children }) => (
  <section className="max-w-6xl mx-auto bg-paper border-print p-5 md:p-7 shadow-xl">
    <div className="border-b-2 border-ink pb-4 mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">{eyebrow}</div>
        <h3 className="font-display text-4xl uppercase leading-none truncate">{title}</h3>
        <div className="font-mono text-xs opacity-60 mt-2 truncate">{id}</div>
      </div>
      {badges && <div className="flex flex-wrap gap-2">{badges}</div>}
    </div>
    {children}
  </section>
);

const EmptyState: React.FC<{ language?: EditorLanguage }> = ({ language = 'en' }) => (
  <div className="max-w-3xl mx-auto bg-paper border-print p-10 text-center">
    <h3 className="font-display text-3xl uppercase">{language === 'zh' ? '未选择条目' : 'No Entry Selected'}</h3>
  </div>
);

const EventEditor: React.FC<{
  item?: EditableEvent;
  language: EditorLanguage;
  onPatch: (id: string, patch: Partial<EditableEvent>) => void;
  onOptionPatch: (eventId: string, optionIndex: number, patch: Partial<EditableOption>) => void;
  onOptionAdd: (eventId: string) => void;
  onOptionDelete: (eventId: string, optionIndex: number) => void;
}> = ({ item, language, onPatch, onOptionPatch, onOptionAdd, onOptionDelete }) => {
  if (!item) return <EmptyState language={language} />;

  return (
    <EditorShell
      eyebrow={language === 'zh' ? '事件档案' : 'Event dossier'}
      title={getLocalizedEventTitle(item, language)}
      id={item.id}
      badges={
        <>
          <ScriptBadge tone="red">{eventCategoryLabels[item.category][language]}</ScriptBadge>
          <ScriptBadge>{eventFlowLabels[item.flow][language]}</ScriptBadge>
          {!item.hasMeta && <ScriptBadge tone="red">{language === 'zh' ? '缺少 meta' : 'meta missing'}</ScriptBadge>}
          {item.hasCondition && <ScriptBadge tone="red">{language === 'zh' ? '条件脚本' : 'condition script'}</ScriptBadge>}
          {item.hasCustomRender && <ScriptBadge>{language === 'zh' ? '自定义渲染' : 'custom render'}</ScriptBadge>}
          <ScriptBadge>{language === 'zh' ? `${item.options.length} 个选项` : `${item.options.length} options`}</ScriptBadge>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文标题' : 'Title'} value={item.title} onChange={(value) => onPatch(item.id, { title: value })} />
        <Field label={language === 'zh' ? '中文标题' : 'Chinese Title'} value={item.titleZh} onChange={(value) => onPatch(item.id, { titleZh: value })} />
        <Field label={language === 'zh' ? '年份' : 'Year'} value={item.year} type="number" onChange={(value) => onPatch(item.id, { year: Number(value) || undefined })} />
        <Field label={language === 'zh' ? '月份' : 'Month'} value={item.month} type="number" onChange={(value) => onPatch(item.id, { month: Number(value) || undefined })} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5 border border-ink/30 bg-paper-dark p-3">
        <label className="flex flex-col gap-1">
          <span className="font-typewriter text-[10px] uppercase tracking-widest opacity-70">{language === 'zh' ? '编辑器分类' : 'Editor Category'}</span>
          <select
            value={item.category}
            onChange={(event) => onPatch(item.id, { category: event.target.value as EventCategory, hasMeta: true })}
            className="bg-paper border-2 border-ink/50 p-3 font-mono text-sm focus:outline-none focus:border-cnt-red"
          >
            {eventCategoryValues.map((category) => (
              <option key={category} value={category}>{eventCategoryLabels[category][language]}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-typewriter text-[10px] uppercase tracking-widest opacity-70">{language === 'zh' ? '编辑器流程' : 'Editor Flow'}</span>
          <select
            value={item.flow}
            onChange={(event) => onPatch(item.id, { flow: event.target.value as EventFlow, hasMeta: true })}
            className="bg-paper border-2 border-ink/50 p-3 font-mono text-sm focus:outline-none focus:border-cnt-red"
          >
            {eventFlowValues.map((flow) => (
              <option key={flow} value={flow}>{eventFlowLabels[flow][language]}</option>
            ))}
          </select>
        </label>
        <Field
          label={language === 'zh' ? '系列（逗号分隔）' : 'Series (comma-separated)'}
          value={joinEditorList(item.series)}
          onChange={(value) => onPatch(item.id, { series: splitEditorList(value), hasMeta: true })}
        />
        <Field
          label={language === 'zh' ? '标签（逗号分隔）' : 'Tags (comma-separated)'}
          value={joinEditorList(item.tags)}
          onChange={(value) => onPatch(item.id, { tags: splitEditorList(value), hasMeta: true })}
        />
        <div className="lg:col-span-4 font-serif text-xs italic opacity-70">
          {language === 'zh'
            ? '这些字段属于 editor-only meta：用于分类、审阅和流程图，不直接控制主游戏触发逻辑。'
            : 'These fields are editor-only meta used for classification, review, and flow diagrams; they do not directly control runtime triggering.'}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文描述' : 'Description'} value={item.description} multiline onChange={(value) => onPatch(item.id, { description: value })} />
        <Field label={language === 'zh' ? '中文描述' : 'Chinese Description'} value={item.descriptionZh} multiline onChange={(value) => onPatch(item.id, { descriptionZh: value })} />
      </div>
      <Field
        label={language === 'zh' ? '事件条件源码（可生成）' : 'Event Condition Source (emitted)'}
        value={item.conditionSource}
        multiline
        onChange={(value) => onPatch(item.id, {
          conditionSource: value,
          hasCondition: value.trim().length > 0,
          conditionSnippets: value.trim() ? [value] : [],
        })}
      />
      <Field label={language === 'zh' ? '图片路径' : 'Image path'} value={item.image} onChange={(value) => onPatch(item.id, { image: value })} />

      <div className="mt-7">
        <div className="flex items-center justify-between border-b border-ink mb-4 pb-2">
          <h4 className="font-display text-2xl uppercase">
            {language === 'zh' ? '决策选项' : 'Decision Options'}
          </h4>
          <button
            onClick={() => onOptionAdd(item.id)}
            className="flex items-center gap-2 border border-ink px-3 py-2 font-typewriter text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
          >
            <Plus className="w-4 h-4" />
            {language === 'zh' ? '新增选项' : 'Add Option'}
          </button>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {item.options.map((option, index) => (
            <div key={`${item.id}-${index}`} className="border-2 border-ink/40 bg-paper-dark p-4">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div className="font-typewriter text-xs uppercase tracking-widest">
                  {language === 'zh' ? `选项 ${index + 1}` : `Option ${index + 1}`}
                </div>
                <div className="flex gap-2">
                  {option.hasCondition && <ScriptBadge tone="red">{language === 'zh' ? '条件锁定' : 'locked'}</ScriptBadge>}
                  {option.hasScriptedEffect && <ScriptBadge>{language === 'zh' ? '脚本效果' : 'effect'}</ScriptBadge>}
                  <button
                    onClick={() => onOptionDelete(item.id, index)}
                    className="border border-cnt-red text-cnt-red px-2 hover:bg-cnt-red hover:text-paper transition-colors"
                    title={language === 'zh' ? '删除选项' : 'Delete option'}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Field label={language === 'zh' ? '英文文本' : 'Text'} value={option.text} onChange={(value) => onOptionPatch(item.id, index, { text: value })} />
                <Field label={language === 'zh' ? '中文文本' : 'Chinese Text'} value={option.textZh} onChange={(value) => onOptionPatch(item.id, index, { textZh: value })} />
                <Field label={language === 'zh' ? '英文副标题' : 'Subtitle'} value={option.subtitle} onChange={(value) => onOptionPatch(item.id, index, { subtitle: value })} />
                <Field label={language === 'zh' ? '中文副标题' : 'Chinese Subtitle'} value={option.subtitleZh} onChange={(value) => onOptionPatch(item.id, index, { subtitleZh: value })} />
                <Field label={language === 'zh' ? '英文不可用提示' : 'Unavailable Subtitle'} value={option.unavailableSubtitle} onChange={(value) => onOptionPatch(item.id, index, { unavailableSubtitle: value })} />
                <Field label={language === 'zh' ? '中文不可用提示' : 'Chinese Unavailable Subtitle'} value={option.unavailableSubtitleZh} onChange={(value) => onOptionPatch(item.id, index, { unavailableSubtitleZh: value })} />
                <Field
                  label={language === 'zh' ? '选项条件源码（可生成）' : 'Option Condition Source (emitted)'}
                  value={option.conditionSource}
                  multiline
                  onChange={(value) => onOptionPatch(item.id, index, {
                    conditionSource: value,
                    conditionSnippet: value,
                    hasCondition: value.trim().length > 0,
                  })}
                />
                <Field
                  label={language === 'zh' ? '后续事件 ID（逗号分隔）' : 'Successor Event IDs (comma-separated)'}
                  value={joinEditorList(option.targetEventIds)}
                  onChange={(value) => onOptionPatch(item.id, index, { targetEventIds: splitEditorList(value), endsFlow: false })}
                />
                <label className="flex items-center gap-2 border border-ink/30 bg-paper px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest">
                  <input
                    type="checkbox"
                    checked={option.endsFlow}
                    onChange={(event) => onOptionPatch(item.id, index, { endsFlow: event.target.checked })}
                  />
                  <span>{language === 'zh' ? '这是链终点（currentEvent: null）' : 'This is a leaf (currentEvent: null)'}</span>
                </label>
                <EffectsEditor
                  effects={option.effects}
                  sourceEffects={option.sourceEffects}
                  language={language}
                  scripted={option.hasScriptedEffect}
                  onChange={(effects) => onOptionPatch(item.id, index, { effects })}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </EditorShell>
  );
};

const AdvisorEditor: React.FC<{
  item?: EditableAdvisor;
  language: EditorLanguage;
  onPatch: (id: string, patch: Partial<EditableAdvisor>) => void;
  onActionPatch: (advisorId: string, actionIndex: number, patch: Partial<EditableAdvisorAction>) => void;
  onActionAdd: (advisorId: string) => void;
  onActionDelete: (advisorId: string, actionIndex: number) => void;
}> = ({ item, language, onPatch, onActionPatch, onActionAdd, onActionDelete }) => {
  if (!item) return <EmptyState language={language} />;

  return (
    <EditorShell
      eyebrow={language === 'zh' ? '顾问档案' : 'Advisor file'}
      title={getLocalizedItemTitle(item, language)}
      id={item.id}
      badges={
        <>
          <ScriptBadge tone="red">{item.faction}</ScriptBadge>
          <ScriptBadge>{language === 'zh' ? `${item.actions.length} 个行动` : `${item.actions.length} actions`}</ScriptBadge>
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文姓名' : 'Name'} value={item.name} onChange={(value) => onPatch(item.id, { name: value })} />
        <Field label={language === 'zh' ? '中文姓名' : 'Chinese Name'} value={item.nameZh} onChange={(value) => onPatch(item.id, { nameZh: value })} />
        <Field label={language === 'zh' ? '派系' : 'Faction'} value={item.faction} onChange={(value) => onPatch(item.id, { faction: value })} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文描述' : 'Description'} value={item.description} multiline onChange={(value) => onPatch(item.id, { description: value })} />
        <Field label={language === 'zh' ? '中文描述' : 'Chinese Description'} value={item.descriptionZh} multiline onChange={(value) => onPatch(item.id, { descriptionZh: value })} />
      </div>
      <Field label={language === 'zh' ? '头像路径' : 'Portrait path'} value={item.image} onChange={(value) => onPatch(item.id, { image: value })} />

      <div className="mt-7 flex items-center justify-between border-b border-ink mb-4 pb-2">
        <h4 className="font-display text-2xl uppercase">{language === 'zh' ? '顾问行动' : 'Advisor Actions'}</h4>
        <button
          onClick={() => onActionAdd(item.id)}
          className="flex items-center gap-2 border border-ink px-3 py-2 font-typewriter text-xs uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
        >
          <Plus className="w-4 h-4" />
          {language === 'zh' ? '新增行动' : 'Add Action'}
        </button>
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {item.actions.map((action, index) => (
          <div key={action.id} className="border-2 border-ink/40 bg-paper-dark p-4">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <div className="font-typewriter text-xs uppercase tracking-widest">
                  {language === 'zh' ? '顾问行动' : 'Advisor Action'}
                </div>
                <div className="font-mono text-[10px] opacity-60">{action.id}</div>
              </div>
              <div className="flex gap-2">
                {action.hasCondition && <ScriptBadge tone="red">{language === 'zh' ? '条件' : 'condition'}</ScriptBadge>}
                {action.hasScriptedEffect && <ScriptBadge>{language === 'zh' ? '脚本效果' : 'effect'}</ScriptBadge>}
                <button
                  onClick={() => onActionDelete(item.id, index)}
                  className="border border-cnt-red text-cnt-red px-2 hover:bg-cnt-red hover:text-paper transition-colors"
                  title={language === 'zh' ? '删除行动' : 'Delete action'}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-3">
              <Field label={language === 'zh' ? '英文标题' : 'Title'} value={action.title} onChange={(value) => onActionPatch(item.id, index, { title: value })} />
              <Field label={language === 'zh' ? '中文标题' : 'Chinese Title'} value={action.titleZh} onChange={(value) => onActionPatch(item.id, index, { titleZh: value })} />
              <Field label={language === 'zh' ? '英文副标题' : 'Subtitle'} value={action.subtitle} onChange={(value) => onActionPatch(item.id, index, { subtitle: value })} />
              <Field label={language === 'zh' ? '中文副标题' : 'Chinese Subtitle'} value={action.subtitleZh} onChange={(value) => onActionPatch(item.id, index, { subtitleZh: value })} />
              <Field label={language === 'zh' ? '英文描述' : 'Description'} value={action.description} multiline onChange={(value) => onActionPatch(item.id, index, { description: value })} />
              <Field label={language === 'zh' ? '中文描述' : 'Chinese Description'} value={action.descriptionZh} multiline onChange={(value) => onActionPatch(item.id, index, { descriptionZh: value })} />
              <EffectsEditor
                effects={action.effects}
                sourceEffects={action.sourceEffects}
                language={language}
                scripted={action.hasScriptedEffect}
                onChange={(effects) => onActionPatch(item.id, index, { effects })}
              />
            </div>
          </div>
        ))}
      </div>
    </EditorShell>
  );
};

const JournalEditor: React.FC<{
  item?: EditableJournal;
  language: EditorLanguage;
  onPatch: (id: string, patch: Partial<EditableJournal>) => void;
}> = ({ item, language, onPatch }) => {
  if (!item) return <EmptyState language={language} />;

  return (
    <EditorShell
      eyebrow={language === 'zh' ? '日志简报' : 'Journal brief'}
      title={getLocalizedItemTitle(item, language)}
      id={item.id}
      badges={
        <>
          {item.hasProgress && <ScriptBadge tone="red">{language === 'zh' ? `进度 ${item.progressMax || 100}` : `progress ${item.progressMax || 100}`}</ScriptBadge>}
          {item.hasAutomation && <ScriptBadge>{language === 'zh' ? '自动逻辑' : 'automation'}</ScriptBadge>}
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文标题' : 'Title'} value={item.title} onChange={(value) => onPatch(item.id, { title: value })} />
        <Field label={language === 'zh' ? '中文标题' : 'Chinese Title'} value={item.titleZh} onChange={(value) => onPatch(item.id, { titleZh: value })} />
        <Field label={language === 'zh' ? '英文描述' : 'Description'} value={item.description} multiline onChange={(value) => onPatch(item.id, { description: value })} />
        <Field label={language === 'zh' ? '中文描述' : 'Chinese Description'} value={item.descriptionZh} multiline onChange={(value) => onPatch(item.id, { descriptionZh: value })} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Field label={language === 'zh' ? '成功条件' : 'Success Condition'} value={item.successCondition} onChange={(value) => onPatch(item.id, { successCondition: value })} />
        <Field label={language === 'zh' ? '成功效果描述' : 'Success Effect'} value={item.successEffectDesc} onChange={(value) => onPatch(item.id, { successEffectDesc: value })} />
        <Field label={language === 'zh' ? '失败条件' : 'Failure Condition'} value={item.failureCondition} onChange={(value) => onPatch(item.id, { failureCondition: value })} />
        <Field label={language === 'zh' ? '失败效果描述' : 'Failure Effect'} value={item.failureEffectDesc} onChange={(value) => onPatch(item.id, { failureEffectDesc: value })} />
      </div>
      <EffectsEditor
        effects={item.effects}
        sourceEffects={item.sourceEffects}
        language={language}
        scripted={item.hasAutomation}
        onChange={(effects) => onPatch(item.id, { effects })}
      />
    </EditorShell>
  );
};

const CardEditor: React.FC<{
  item?: EditableCard;
  language: EditorLanguage;
  onPatch: (id: string, patch: Partial<EditableCard>) => void;
}> = ({ item, language, onPatch }) => {
  if (!item) return <EmptyState language={language} />;

  return (
    <EditorShell
      eyebrow={language === 'zh' ? '卡牌清样' : 'Card proof'}
      title={getLocalizedItemTitle(item, language)}
      id={item.id}
      badges={
        <>
          <ScriptBadge tone="red">
            <span className="inline-flex items-center gap-1">
              {cardIcons[item.type]} {language === 'zh' ? item.type === 'Action' ? '行动卡牌' : item.type === 'Government' ? '政府卡牌' : '武装卡牌' : item.type}
            </span>
          </ScriptBadge>
          {item.hasCondition && <ScriptBadge>{language === 'zh' ? '有条件' : 'condition'}</ScriptBadge>}
          {item.cooldown !== undefined && <ScriptBadge>{language === 'zh' ? `冷却 ${item.cooldown}` : `cooldown ${item.cooldown}`}</ScriptBadge>}
          {item.timer !== undefined && <ScriptBadge>{language === 'zh' ? `计时 ${item.timer}` : `timer ${item.timer}`}</ScriptBadge>}
          {item.hasScriptedEffect && <ScriptBadge>{language === 'zh' ? '脚本效果' : 'effect'}</ScriptBadge>}
        </>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文标题' : 'Title'} value={item.title} onChange={(value) => onPatch(item.id, { title: value })} />
        <Field label={language === 'zh' ? '中文标题' : 'Chinese Title'} value={item.titleZh} onChange={(value) => onPatch(item.id, { titleZh: value })} />
        <Field label={language === 'zh' ? '行动点成本' : 'AP Cost'} value={item.cost} type="number" onChange={(value) => onPatch(item.id, { cost: Number(value) || 0 })} />
        <label className="flex flex-col gap-1">
          <span className="font-typewriter text-[10px] uppercase tracking-widest opacity-70">{language === 'zh' ? '卡牌类型' : 'Type'}</span>
          <select
            value={item.type}
            onChange={(event) => onPatch(item.id, { type: event.target.value as CardType })}
            className="bg-paper border-2 border-ink/50 p-3 font-mono text-sm focus:outline-none focus:border-cnt-red"
          >
            <option value="Action">{language === 'zh' ? '行动卡牌' : 'Action'}</option>
            <option value="Government">{language === 'zh' ? '政府卡牌' : 'Government'}</option>
            <option value="Military">{language === 'zh' ? '武装卡牌' : 'Military'}</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Field label={language === 'zh' ? '英文描述' : 'Description'} value={item.description} multiline onChange={(value) => onPatch(item.id, { description: value })} />
        <Field label={language === 'zh' ? '中文描述' : 'Chinese Description'} value={item.descriptionZh} multiline onChange={(value) => onPatch(item.id, { descriptionZh: value })} />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 border border-ink/30 bg-paper-dark p-3">
        <Field
          label={language === 'zh' ? '条件源码（草稿）' : 'Condition Source (Draft)'}
          value={item.conditionSource}
          multiline
          onChange={(value) => onPatch(item.id, { conditionSource: value, hasCondition: value.trim().length > 0 })}
        />
        <div className="flex flex-col gap-2">
          <Field label={language === 'zh' ? '英文不可用提示' : 'Unavailable Subtitle'} value={item.unavailableSubtitle} onChange={(value) => onPatch(item.id, { unavailableSubtitle: value })} />
          <Field label={language === 'zh' ? '中文不可用提示' : 'Chinese Unavailable Subtitle'} value={item.unavailableSubtitleZh} onChange={(value) => onPatch(item.id, { unavailableSubtitleZh: value })} />
        </div>
        <Field label={language === 'zh' ? '冷却（编辑器草稿）' : 'Cooldown (Editor Draft)'} value={item.cooldown} type="number" onChange={(value) => onPatch(item.id, { cooldown: value.trim() ? Number(value) : undefined })} />
        <Field label={language === 'zh' ? '计时器（编辑器草稿）' : 'Timer (Editor Draft)'} value={item.timer} type="number" onChange={(value) => onPatch(item.id, { timer: value.trim() ? Number(value) : undefined })} />
        <Field
          label={language === 'zh' ? 'currentEvent 目标（逗号分隔）' : 'currentEvent Targets (comma-separated)'}
          value={joinEditorList(item.eventTransition.currentEventTargets)}
          onChange={(value) => onPatch(item.id, { eventTransition: { ...item.eventTransition, currentEventTargets: splitEditorList(value) } })}
        />
        <Field
          label={language === 'zh' ? 'pendingEvents 目标（逗号分隔）' : 'pendingEvents Targets (comma-separated)'}
          value={joinEditorList(item.eventTransition.pendingEventTargets)}
          onChange={(value) => onPatch(item.id, { eventTransition: { ...item.eventTransition, pendingEventTargets: splitEditorList(value) } })}
        />
        <div className="lg:col-span-2 font-serif text-xs italic opacity-70">
          {language === 'zh'
            ? '条件、冷却、计时和事件转移目前作为编辑器草稿保留；卡牌 TS 生成器会写入可安全生成的条件与效果，类别专属计时和动态转移仍会提示人工审阅。'
            : 'Condition, cooldown, timer, and event-transition values are preserved as editor draft data; generated cards emit supported conditions and effects, while category-specific timers and dynamic transitions remain warnings for manual review.'}
          {item.eventTransition.dynamic && (
            <span className="ml-2 text-cnt-red">
              {language === 'zh' ? '检测到动态事件转移。' : 'Dynamic event transition detected.'}
            </span>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5">
        <Field label={language === 'zh' ? '资源成本' : 'Resource Cost'} value={item.resourceCost} type="number" onChange={(value) => onPatch(item.id, { resourceCost: Number(value) || undefined })} />
        <Field label={language === 'zh' ? '军备成本' : 'Armament Cost'} value={item.armamentCost} type="number" onChange={(value) => onPatch(item.id, { armamentCost: Number(value) || undefined })} />
      </div>
      <EffectsEditor
        effects={item.effects}
        sourceEffects={item.sourceEffects}
        language={language}
        scripted={item.hasScriptedEffect}
        onChange={(effects) => onPatch(item.id, { effects })}
      />
    </EditorShell>
  );
};

const SandboxTester: React.FC<{ language: EditorLanguage }> = ({ language }) => {
  const [sandbox, setSandbox] = React.useState<typeof import('./simulator/gameSandbox') | null>(null);
  const [loadError, setLoadError] = React.useState('');
  const [scenario, setScenario] = React.useState<SandboxScenario>('1931');
  const [difficulty, setDifficulty] = React.useState<SandboxDifficulty>('sandbox');
  const [targetYear, setTargetYear] = React.useState(1931);
  const [targetMonth, setTargetMonth] = React.useState(4);
  const [force, setForce] = React.useState(false);
  const [unlimitedActions, setUnlimitedActions] = React.useState(true);
  const [eventId, setEventId] = React.useState('');
  const [cardId, setCardId] = React.useState('');
  const [run, setRun] = React.useState<SandboxRun | null>(null);
  const [triggerResult, setTriggerResult] = React.useState<SandboxTriggerResult | null>(null);
  const [sessionState, setSessionState] = React.useState<SandboxSessionState | null>(null);
  const [activeEventOptionIndex, setActiveEventOptionIndex] = React.useState(0);
  const [cardTypePick, setCardTypePick] = React.useState<CardType>('Action');
  const [libraryKind, setLibraryKind] = React.useState<SandboxLibraryKind>('actionCards');
  const [advisorSlotIndex, setAdvisorSlotIndex] = React.useState(0);

  React.useEffect(() => {
    let mounted = true;
    import('./simulator/gameSandbox')
      .then((module) => {
        if (!mounted) return;
        setSandbox(module);
        setEventId((current) => current || module.SANDBOX_EVENT_GROUPS[0]?.rootEventId || module.SANDBOX_EVENTS[0]?.id || '');
        setCardId((current) => current || module.SANDBOX_CARDS[0]?.id || '');
        setSessionState(module.createSandboxState(scenario, difficulty));
      })
      .catch((error) => {
        if (mounted) setLoadError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedEvent = sandbox?.SANDBOX_EVENTS.find((event) => event.id === eventId) || sandbox?.SANDBOX_EVENTS[0];

  React.useEffect(() => {
    setRun(null);
    setTriggerResult(null);
  }, [eventId, cardId, scenario, difficulty]);

  React.useEffect(() => {
    const startDate = sandboxScenarioDates[scenario];
    setTargetYear(startDate.year);
    setTargetMonth(startDate.month);
  }, [scenario]);

  React.useEffect(() => {
    if (!sandbox) return;
    setSessionState(sandbox.createSandboxState(scenario, difficulty));
    setRun(null);
    setTriggerResult(null);
    setActiveEventOptionIndex(0);
  }, [sandbox, scenario, difficulty]);

  const playHandCard = (handIndex: number) => {
    if (!sandbox || !sessionState) return;
    const nextRun = sandbox.playSandboxHandCard(sessionState, handIndex, { force, unlimitedActions }, language);
    setRun(nextRun);
    if (nextRun.ok) {
      setSessionState(nextRun.after);
      setActiveEventOptionIndex(0);
    }
  };

  const playLibraryCard = (cardId: string) => {
    if (!sandbox || !sessionState) return;
    const card = sandbox.SANDBOX_CARDS.find((item) => item.id === cardId);
    if (!card) return;
    setCardId(card.id);
    setCardTypePick(card.type as CardType);
    const nextRun = sandbox.playSandboxCard(sessionState, card, { force, unlimitedActions }, language);
    setRun(nextRun);
    if (nextRun.ok) {
      setSessionState(nextRun.after);
      setActiveEventOptionIndex(0);
    }
  };

  const resolveActiveEventOption = (index = activeEventOptionIndex) => {
    if (!sandbox || !sessionState?.currentEvent) return;
    const nextRun = sandbox.resolveSandboxEventOption(sessionState, sessionState.currentEvent, index, { force }, language);
    setRun(nextRun);
    if (nextRun.ok) {
      setSessionState(nextRun.after);
      setActiveEventOptionIndex(0);
    }
  };

  const drawPendingEvent = () => {
    if (!sessionState || sessionState.pendingEvents.length === 0) return;
    const [nextEvent, ...rest] = sessionState.pendingEvents;
    setSessionState({
      ...sessionState,
      currentEvent: nextEvent,
      pendingEvents: rest,
      phase: 'event',
    });
    setActiveEventOptionIndex(0);
  };

  const setCurrentEventFromLibrary = (id: string) => {
    if (!sandbox || !sessionState) return;
    setEventId(id);
    setSessionState(sandbox.setSandboxCurrentEvent(sessionState, id));
    setActiveEventOptionIndex(0);
  };

  const setAdvisorSlotFromLibrary = (id: string) => {
    if (!sandbox || !sessionState) return;
    setSessionState(sandbox.setSandboxAdvisorSlot(sessionState, advisorSlotIndex, id));
  };

  const clearAdvisorSlot = (slotIndex: number) => {
    if (!sandbox || !sessionState) return;
    setSessionState(sandbox.clearSandboxAdvisorSlot(sessionState, slotIndex));
  };

  const runAdvisorSlotAction = (slotIndex: number, slotActionIndex: number) => {
    if (!sandbox || !sessionState) return;
    const nextRun = sandbox.resolveSandboxAdvisorSlotAction(sessionState, slotIndex, slotActionIndex, { force, unlimitedActions }, language);
    setRun(nextRun);
    if (nextRun.ok) {
      setSessionState(nextRun.after);
      setActiveEventOptionIndex(0);
    }
  };

  const resetSession = () => {
    if (!sandbox) return;
    setSessionState(sandbox.createSandboxState(scenario, difficulty));
    setRun(null);
    setTriggerResult(null);
    setActiveEventOptionIndex(0);
  };

  const checkSelectedEventTrigger = () => {
    if (!sandbox || !selectedEvent || !sessionState) return;
    setTriggerResult(sandbox.testSandboxEventTrigger(selectedEvent.id, scenario, difficulty, {
      year: targetYear,
      month: targetMonth,
    }));
  };

  type SandboxEventOption = NonNullable<SandboxSessionState['currentEvent']>['options'][number];
  const getEventOptionSubtitle = (option: SandboxEventOption) => {
    if (!sessionState) return '';
    const unavailableRaw = language === 'zh'
      ? option.unavailableSubtitleZh || option.unavailableSubtitle
      : option.unavailableSubtitle;
    const subtitleRaw = language === 'zh' ? option.subtitleZh || option.subtitle : option.subtitle;
    const rawValue = !force && option.condition && !option.condition(sessionState) && unavailableRaw
      ? unavailableRaw
      : subtitleRaw;
    try {
      return typeof rawValue === 'function' ? rawValue(sessionState) : rawValue || '';
    } catch {
      return '';
    }
  };
  const pickableCards = sandbox?.SANDBOX_CARDS.filter((card) => card.type === cardTypePick) || [];
  const visibleLibraryCards = sandbox?.SANDBOX_CARDS.filter((card) =>
    libraryKind === 'actionCards' ? card.type === 'Action' :
    libraryKind === 'governmentCards' ? card.type === 'Government' :
    libraryKind === 'militaryCards' ? card.type === 'Military' :
    false
  ) || [];
  const libraryLabels: Record<SandboxLibraryKind, { en: string; zh: string }> = {
    events: { en: 'Event Library', zh: '事件库' },
    actionCards: { en: 'Action Deck', zh: '行动卡牌库' },
    governmentCards: { en: 'Government Deck', zh: '政府卡牌库' },
    advisors: { en: 'Advisor Slots', zh: '顾问槽位' },
    militaryCards: { en: 'Military Deck', zh: '武装卡牌库' },
  };

  if (loadError) {
    return (
      <section className="bg-paper border-print p-5 shadow-xl">
        <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-2">
          {language === 'zh' ? '测试沙盒加载失败' : 'Sandbox Load Failed'}
        </div>
        <h3 className="font-display text-3xl uppercase leading-none mb-4">{language === 'zh' ? '编辑器其余功能仍可使用' : 'Other editor tools are still available'}</h3>
        <pre className="bg-paper-dark border border-ink/30 p-3 font-mono text-xs whitespace-pre-wrap break-words">{loadError}</pre>
      </section>
    );
  }

  if (!sandbox) {
    return (
      <section className="bg-paper border-print p-5 shadow-xl">
        <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-2">
          {language === 'zh' ? '正在加载测试沙盒' : 'Loading Sandbox'}
        </div>
        <h3 className="font-display text-3xl uppercase leading-none">{language === 'zh' ? '正在导入主游戏逻辑...' : 'Importing game runtime...'}</h3>
      </section>
    );
  }

  return (
    <section className="min-h-full flex flex-col gap-5">
      {sessionState && (
        <div className="bg-paper border-print p-5 shadow-xl">
          <div className="flex flex-col xl:flex-row xl:items-end xl:justify-between gap-4 border-b-2 border-ink pb-4">
            <div>
              <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                {language === 'zh' ? '主游戏式测试台' : 'Main-Game Test Bench'}
              </div>
              <h4 className="font-display text-3xl uppercase leading-none">
                {language === 'zh' ? '选库、上手、打出与触发事件' : 'Pick, Play, And Resolve'}
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              <ScriptBadge tone="red">{language === 'zh' ? `手牌 ${sessionState.hand.length}` : `Hand ${sessionState.hand.length}`}</ScriptBadge>
              <ScriptBadge>{language === 'zh' ? `行动点 ${sessionState.actionsLeft}` : `AP ${sessionState.actionsLeft}`}</ScriptBadge>
              <ScriptBadge>{language === 'zh' ? `资源 ${sessionState.resources}` : `Resources ${sessionState.resources}`}</ScriptBadge>
              <ScriptBadge>{language === 'zh' ? `武装 ${sessionState.armaments}` : `Armaments ${sessionState.armaments}`}</ScriptBadge>
              <button
                onClick={resetSession}
                className="border border-ink px-3 py-1.5 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
              >
                {language === 'zh' ? '重置会话' : 'Reset Session'}
              </button>
              <select
                value={scenario}
                onChange={(event) => setScenario(event.target.value as SandboxScenario)}
                className="bg-paper border border-ink px-3 py-1.5 font-mono text-[10px] focus:outline-none focus:border-cnt-red"
              >
                <option value="1931">1931</option>
                <option value="1933">1933</option>
                <option value="1936">1936</option>
              </select>
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as SandboxDifficulty)}
                className="bg-paper border border-ink px-3 py-1.5 font-mono text-[10px] focus:outline-none focus:border-cnt-red"
                title={language === 'zh' ? '事件触发难度模式' : 'Event trigger difficulty mode'}
              >
                <option value="historical">{language === 'zh' ? '历史模式' : 'Historical'}</option>
                <option value="easy">{language === 'zh' ? '简单模式' : 'Easy'}</option>
                <option value="normal">{language === 'zh' ? '普通模式' : 'Normal'}</option>
                <option value="hard">{language === 'zh' ? '困难模式' : 'Hard'}</option>
                <option value="sandbox">{language === 'zh' ? '沙盒模式' : 'Sandbox'}</option>
              </select>
              <label className="border border-ink px-2 py-1.5 flex items-center gap-1 font-typewriter text-[10px] uppercase tracking-widest">
                <span>{language === 'zh' ? '年' : 'Y'}</span>
                <input
                  type="number"
                  value={targetYear}
                  onChange={(event) => setTargetYear(Number(event.target.value) || 0)}
                  className="w-16 bg-paper border-b border-ink px-1 font-mono text-[10px] focus:outline-none focus:border-cnt-red"
                  aria-label={language === 'zh' ? '触发检查年份' : 'Trigger check year'}
                />
              </label>
              <label className="border border-ink px-2 py-1.5 flex items-center gap-1 font-typewriter text-[10px] uppercase tracking-widest">
                <span>{language === 'zh' ? '月' : 'M'}</span>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={targetMonth}
                  onChange={(event) => setTargetMonth(Math.min(12, Math.max(1, Number(event.target.value) || 1)))}
                  className="w-10 bg-paper border-b border-ink px-1 font-mono text-[10px] focus:outline-none focus:border-cnt-red"
                  aria-label={language === 'zh' ? '触发检查月份' : 'Trigger check month'}
                />
              </label>
              {selectedEvent && (
                <button
                  onClick={checkSelectedEventTrigger}
                  className="border border-cnt-red text-cnt-red px-3 py-1.5 font-typewriter text-[10px] uppercase tracking-widest hover:bg-cnt-red hover:text-paper transition-colors"
                >
                  {language === 'zh' ? '检查触发' : 'Check Trigger'}
                </button>
              )}
              <label className="border border-ink px-3 py-1.5 flex items-center gap-2 font-typewriter text-[10px] uppercase tracking-widest">
                <input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />
                <span>Force</span>
              </label>
              <label className="border border-ink px-3 py-1.5 flex items-center gap-2 font-typewriter text-[10px] uppercase tracking-widest bg-paper-dark">
                <input type="checkbox" checked={unlimitedActions} onChange={(event) => setUnlimitedActions(event.target.checked)} />
                <span>Unlimited AP</span>
              </label>
              <label className="hidden">
                <span>{language === 'zh' ? '忽略条件' : 'Force'}</span>
              </label>
            </div>
          </div>

          {triggerResult && (
            <div className={cn('mt-4 border-2 p-3 font-serif text-sm', triggerResult.eligible ? 'border-green-700 bg-green-50' : 'border-cnt-red bg-cnt-red/5')}>
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <ScriptBadge tone={triggerResult.eligible ? 'ink' : 'red'}>
                  {triggerResult.eligible ? language === 'zh' ? '可触发' : 'eligible' : language === 'zh' ? '不可触发' : 'blocked'}
                </ScriptBadge>
                <span className="font-mono text-[10px] opacity-70">
                  {triggerResult.mode} · {triggerResult.targetDate.year}-{String(triggerResult.targetDate.month).padStart(2, '0')}
                </span>
              </div>
              <div>{language === 'zh' ? triggerResult.reasonZh : triggerResult.reason}</div>
            </div>
          )}

          <div className="mt-5 grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_18rem] gap-5">
            <div className="min-w-0 bg-halftone border-2 border-ink/35 p-5 min-h-[44rem] relative overflow-hidden">
              <div className="absolute top-6 right-6 text-right pointer-events-none">
                <div className="font-display text-5xl uppercase text-ink opacity-15 tracking-widest">
                  {sessionState.phase === 'war'
                    ? language === 'zh' ? '战争阶段' : 'War Phase'
                    : sessionState.currentEvent
                      ? language === 'zh' ? '事件阶段' : 'Event Phase'
                      : language === 'zh' ? '行动阶段' : 'Action Phase'}
                </div>
                <div className="font-typewriter text-sm font-bold text-cnt-red opacity-80">
                  {language === 'zh' ? `剩余行动点：${sessionState.actionsLeft}` : `Actions Remaining: ${sessionState.actionsLeft}`}
                </div>
              </div>

              <div className="relative z-10 flex flex-col items-center gap-8">
                <div className="flex flex-wrap justify-center gap-6 pt-6">
                  {([
                    { kind: 'events' as SandboxLibraryKind, titleZh: '事件库', titleEn: 'Event Stack', count: sandbox.SANDBOX_EVENT_GROUPS.length, tone: 'bg-paper-dark border-ink text-ink' },
                    { kind: 'actionCards' as SandboxLibraryKind, titleZh: '行动卡牌', titleEn: 'Action Deck', count: sandbox.SANDBOX_CARDS.filter((card) => card.type === 'Action').length, tone: 'bg-cnt-red border-ink text-paper' },
                    { kind: 'governmentCards' as SandboxLibraryKind, titleZh: '政府卡牌', titleEn: 'Gov Deck', count: sandbox.SANDBOX_CARDS.filter((card) => card.type === 'Government').length, tone: 'bg-ink border-cnt-red text-paper' },
                    { kind: 'militaryCards' as SandboxLibraryKind, titleZh: '武装卡牌', titleEn: 'Mil Deck', count: sandbox.SANDBOX_CARDS.filter((card) => card.type === 'Military').length, tone: 'bg-[#7a4f2a] border-ink text-paper' },
                  ]).map((deck) => (
                    <button
                      key={deck.kind}
                      onClick={() => {
                        setLibraryKind(deck.kind);
                        if (deck.kind === 'actionCards') setCardTypePick('Action');
                        if (deck.kind === 'governmentCards') setCardTypePick('Government');
                        if (deck.kind === 'militaryCards') setCardTypePick('Military');
                      }}
                      className={cn(
                        'w-40 md:w-44 aspect-[2/3] border-2 flex flex-col items-center justify-center p-4 transition-all relative overflow-hidden shadow-[4px_4px_0_0_rgba(30,28,26,1)]',
                        deck.tone,
                        libraryKind === deck.kind ? '-translate-y-2 shadow-[8px_10px_0_0_rgba(193,39,45,1)]' : 'hover:-translate-y-2 hover:shadow-xl',
                      )}
                    >
                      <div className="absolute inset-0 opacity-10 bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:8px_8px]" />
                      <span className="font-display text-2xl text-center relative z-10 leading-none">
                        {language === 'zh' ? deck.titleZh : deck.titleEn}
                      </span>
                      <span className="font-typewriter text-[10px] mt-4 opacity-80 uppercase tracking-widest relative z-10">
                        {deck.count} {language === 'zh' ? '项' : 'items'}
                      </span>
                      <span className="font-typewriter text-[9px] mt-2 uppercase tracking-widest relative z-10 border border-current px-2 py-0.5">
                        {language === 'zh' ? '打开' : 'Open'}
                      </span>
                    </button>
                  ))}
                </div>

                <div className="hidden">
                  <div className="flex flex-row flex-wrap justify-center gap-5 min-h-[18rem]">
                    {sessionState.hand.map((card, index) => {
                      const isPlayable = force ||
                        (sessionState.actionsLeft >= card.cost &&
                          (card.resourceCost === undefined || sessionState.resources >= card.resourceCost) &&
                          (card.armamentCost === undefined || sessionState.armaments >= card.armamentCost) &&
                          (card.condition === undefined || card.condition(sessionState)));
                      return (
                        <div
                          key={`${card.id}-${index}`}
                          className={cn(
                            'bg-paper p-5 flex flex-col w-44 aspect-[2/3] relative shadow-lg transition-all',
                            card.type === 'Action' ? 'border-print-red' : 'border-print',
                            isPlayable ? 'hover:-translate-y-2 hover:-rotate-1' : 'opacity-60',
                          )}
                        >
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <span className="font-typewriter text-[9px] uppercase tracking-widest bg-ink text-paper px-2 py-1">
                              {language === 'zh'
                                ? card.type === 'Action' ? '行动' : card.type === 'Military' ? '武装' : '政府'
                                : card.type}
                            </span>
                            <div className="text-right">
                              <div className="font-display text-xl">{card.cost} AP</div>
                              {card.resourceCost !== undefined && card.resourceCost > 0 && <div className="font-typewriter text-[10px] text-yellow-700">{card.resourceCost} R</div>}
                              {card.armamentCost !== undefined && card.armamentCost > 0 && <div className="font-typewriter text-[10px] text-gray-700">{card.armamentCost} A</div>}
                            </div>
                          </div>
                          <h4 className="font-display text-xl uppercase mb-2 leading-tight line-clamp-3">
                            {sandbox.getSandboxCardTitle(card, language)}
                          </h4>
                          <div className="w-full h-px bg-ink opacity-20 mb-3" />
                          <p className="font-serif text-xs flex-1 overflow-y-auto">
                            {language === 'zh' ? card.descriptionZh || card.description : card.description}
                          </p>
                          <div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                            <button
                              disabled={!isPlayable && !force}
                              onClick={() => playHandCard(index)}
                              className="border border-ink font-typewriter text-[10px] uppercase tracking-widest py-2 hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink"
                            >
                              {language === 'zh' ? '打出卡牌' : 'Play Card'}
                            </button>
                            <button
                              onClick={() => setSessionState(sandbox.removeSandboxCardFromHand(sessionState, index))}
                              className="border border-ink px-2 font-typewriter text-[10px] uppercase hover:bg-cnt-red hover:text-paper transition-colors"
                            >
                              X
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {visibleLibraryCards.map((card) => {
                      const isPlayable = force ||
                        ((unlimitedActions || sessionState.actionsLeft >= card.cost) &&
                          (card.resourceCost === undefined || sessionState.resources >= card.resourceCost) &&
                          (card.armamentCost === undefined || sessionState.armaments >= card.armamentCost) &&
                          (card.condition === undefined || card.condition(sessionState)));
                      return (
                        <div
                          key={`library-${card.id}`}
                          className={cn(
                            'bg-paper p-5 flex flex-col w-44 aspect-[2/3] relative shadow-lg transition-all border-print',
                            card.type === 'Action' && 'border-print-red',
                            card.id === cardId && 'ring-2 ring-cnt-red',
                            isPlayable ? 'hover:-translate-y-2 hover:-rotate-1' : 'opacity-60',
                          )}
                        >
                          <div className="flex justify-between items-start gap-2 mb-3">
                            <span className="font-typewriter text-[9px] uppercase tracking-widest bg-ink text-paper px-2 py-1">{card.type}</span>
                            <div className="text-right">
                              <div className="font-display text-xl">{card.cost} AP</div>
                              {card.resourceCost !== undefined && card.resourceCost > 0 && <div className="font-typewriter text-[10px] text-yellow-700">{card.resourceCost} R</div>}
                              {card.armamentCost !== undefined && card.armamentCost > 0 && <div className="font-typewriter text-[10px] text-gray-700">{card.armamentCost} A</div>}
                            </div>
                          </div>
                          <h4 className="font-display text-xl uppercase mb-2 leading-tight line-clamp-3">{sandbox.getSandboxCardTitle(card, language)}</h4>
                          <div className="w-full h-px bg-ink opacity-20 mb-3" />
                          <p className="font-serif text-xs flex-1 overflow-y-auto">{language === 'zh' ? card.descriptionZh || card.description : card.description}</p>
                          <button
                            disabled={!isPlayable && !force}
                            onClick={() => playLibraryCard(card.id)}
                            className="mt-3 border border-ink font-typewriter text-[10px] uppercase tracking-widest py-2 hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink"
                          >
                            {language === 'zh' ? '打出卡牌' : 'Play Card'}
                          </button>
                        </div>
                      );
                    })}
                    {visibleLibraryCards.length === 0 && Array.from({ length: Math.max(0, 4 - sessionState.hand.length) }).map((_, index) => (
                      <div key={`empty-${index}`} className="border-2 border-dashed border-ink/25 w-44 aspect-[2/3] flex items-center justify-center bg-paper/40">
                        <span className="font-typewriter text-xs uppercase tracking-widest text-center opacity-50">
                          {language === 'zh' ? '空手牌槽' : 'Empty Slot'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="w-full flex flex-col gap-5">
                  <div className="bg-paper border-print p-5 shadow-lg min-w-0">
                    <div className="flex items-end justify-between gap-3 border-b-2 border-ink pb-3 mb-4">
                      <div>
                        <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                          {language === 'zh' ? '当前打开的库' : 'Open Library'}
                        </div>
                        <div className="font-display text-2xl uppercase leading-none">{libraryLabels[libraryKind][language]}</div>
                      </div>
                      <div className="font-mono text-[10px] opacity-60">
                        {language === 'zh' ? '点击条目加入测试' : 'Click an item to stage it'}
                      </div>
                    </div>

                    {libraryKind === 'events' && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[22rem] overflow-y-auto pr-1">
                        {sandbox.SANDBOX_EVENT_GROUPS.map((group) => {
                          const event = sandbox.SANDBOX_EVENTS.find((item) => item.id === group.rootEventId) || sandbox.SANDBOX_EVENTS[0];
                          const sourceName = group.sourcePath.split(/[\\/]/).slice(-2).join('/') || group.sourceName;
                          return (
                            <button
                              key={`${group.sourcePath}-${group.id}`}
                              onClick={() => setCurrentEventFromLibrary(group.rootEventId)}
                              className={cn(
                                'bg-paper-dark border p-3 text-left transition-colors',
                                group.eventIds.includes(sessionState.currentEvent?.id || '') ? 'border-cnt-red shadow-[3px_3px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                              )}
                            >
                              <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{sourceName}</div>
                              <div className="font-display text-lg uppercase leading-none mt-1 line-clamp-2">{event ? sandbox.getSandboxEventTitle(event, sessionState, language) : group.sourceName}</div>
                              <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{group.rootEventId}</div>
                              <div className="font-mono text-[9px] opacity-50 mt-1 truncate">{group.eventIds.length} nodes / {group.sourceName}</div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {(libraryKind === 'actionCards' || libraryKind === 'governmentCards' || libraryKind === 'militaryCards') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-5 max-h-[42rem] overflow-y-auto pr-1">
                        {visibleLibraryCards.map((card) => {
                          const isPlayable = force ||
                            ((unlimitedActions || sessionState.actionsLeft >= card.cost) &&
                              (card.resourceCost === undefined || sessionState.resources >= card.resourceCost) &&
                              (card.armamentCost === undefined || sessionState.armaments >= card.armamentCost) &&
                              (card.condition === undefined || card.condition(sessionState)));
                          return (
                            <button
                              key={card.id}
                              disabled={!isPlayable && !force}
                              onClick={() => playLibraryCard(card.id)}
                              className={cn(
                                'bg-paper p-5 flex flex-col min-h-[18rem] border-print text-left shadow-lg transition-all disabled:opacity-60 disabled:hover:translate-y-0',
                                card.type === 'Action' && 'border-print-red',
                                card.id === cardId && 'ring-2 ring-cnt-red',
                                isPlayable ? 'hover:-translate-y-2 hover:-rotate-1' : 'opacity-60',
                              )}
                            >
                              <div className="flex justify-between items-start gap-2 mb-3">
                                <span className="font-typewriter text-[9px] uppercase tracking-widest bg-ink text-paper px-2 py-1">
                                  {language === 'zh'
                                    ? card.type === 'Action' ? '行动' : card.type === 'Military' ? '军事' : '政府'
                                    : card.type}
                                </span>
                                <div className="text-right shrink-0">
                                  <div className="font-display text-xl">{card.cost} AP</div>
                                  {card.resourceCost !== undefined && card.resourceCost > 0 && <div className="font-typewriter text-[10px] text-yellow-700">{card.resourceCost} R</div>}
                                  {card.armamentCost !== undefined && card.armamentCost > 0 && <div className="font-typewriter text-[10px] text-gray-700">{card.armamentCost} A</div>}
                                </div>
                              </div>
                              <h4 className="font-display text-xl uppercase mb-2 leading-tight line-clamp-3">
                                {sandbox.getSandboxCardTitle(card, language)}
                              </h4>
                              <div className="w-full h-px bg-ink opacity-20 mb-3" />
                              <p className="font-serif text-xs flex-1 overflow-y-auto">
                                {language === 'zh' ? card.descriptionZh || card.description : card.description}
                              </p>
                              <div className="mt-3 border border-ink font-typewriter text-[10px] uppercase tracking-widest py-2 text-center transition-colors">
                                {language === 'zh' ? '打出卡牌' : 'Play Card'}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-paper border-print p-5 shadow-lg">
                    <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                      {language === 'zh' ? '事件弹窗' : 'Event Modal'}
                    </div>
                    <div className="font-display text-2xl uppercase leading-none mb-4">currentEvent</div>
                    {sessionState.currentEvent ? (
                      <div>
                        <h4 className="font-display text-2xl uppercase leading-none">{sandbox.getSandboxEventTitle(sessionState.currentEvent, sessionState, language)}</h4>
                        <div className="font-mono text-[10px] opacity-60 mt-1">{sessionState.currentEvent.id}</div>
                        <p className="font-serif text-sm italic border-l-4 border-ink pl-3 mt-3 max-h-28 overflow-y-auto">
                          {language === 'zh'
                            ? sessionState.currentEvent.descriptionZh || sessionState.currentEvent.description
                            : sessionState.currentEvent.description}
                        </p>
                        <div className="mt-4 flex flex-col gap-2">
                          {sessionState.currentEvent.options.map((option, index) => {
                            const rawText = language === 'zh' ? option.textZh || option.text : option.text;
                            let optionText = `[${language === 'zh' ? '动态文本' : 'dynamic text'}]`;
                            try {
                              optionText = typeof rawText === 'function' ? rawText(sessionState) : rawText;
                            } catch {
                              optionText = `[${language === 'zh' ? '动态文本' : 'dynamic text'}]`;
                            }
                            const optionSubtitle = getEventOptionSubtitle(option);
                            const optionAvailable = force || !option.condition || option.condition(sessionState);
                            return (
                              <div key={index} className="relative group">
                                <button
                                  disabled={!optionAvailable}
                                  onClick={() => {
                                    setActiveEventOptionIndex(index);
                                    resolveActiveEventOption(index);
                                  }}
                                  className="w-full text-left p-3 border border-ink/40 hover:bg-ink hover:text-paper transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-ink"
                                >
                                  <div className="font-typewriter text-xs uppercase tracking-wider">{optionText}</div>
                                  {optionSubtitle && <div className="font-serif text-xs normal-case tracking-normal leading-snug mt-2 opacity-75">{optionSubtitle}</div>}
                                </button>
                                <SandboxEffectPreviewTooltip state={sessionState} option={option} language={language} />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <div className="border border-dashed border-ink/30 p-5 text-center font-serif italic opacity-70">
                        {language === 'zh' ? '从事件库打开事件，或打出能产生 currentEvent 的卡牌。' : 'Open an event, or play a card that produces currentEvent.'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="w-full h-48 border-t-2 border-ink bg-[#e6e2d6] p-4 flex justify-center gap-6 items-center shadow-[inset_0_8px_16px_rgba(0,0,0,0.1)] relative overflow-hidden">
                  {sessionState.activeAdvisors.map((advisor, slot) => (
                    <div
                      key={slot}
                      role="button"
                      tabIndex={0}
                      onClick={() => {
                        setAdvisorSlotIndex(slot);
                        setLibraryKind('advisors');
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setAdvisorSlotIndex(slot);
                          setLibraryKind('advisors');
                        }
                      }}
                      className={cn(
                        'aspect-[2/3] h-full border-2 border-ink relative flex flex-col items-center justify-center p-2 transition-all duration-200',
                        advisor ? 'bg-paper shadow-[4px_4px_0_0_rgba(26,26,26,1)] hover:-translate-y-2' : 'border-dashed border-ink/40 bg-transparent hover:bg-ink/5',
                        advisorSlotIndex === slot && 'ring-2 ring-cnt-red',
                      )}
                    >
                      <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red mb-2">
                        {language === 'zh' ? `顾问 ${slot + 1}` : `Advisor ${slot + 1}`}
                      </div>
                      <div className="font-display text-sm text-center leading-tight uppercase">
                        {advisor ? sandbox.getSandboxAdvisorTitle(advisor, language) : (language === 'zh' ? '待任命' : 'Pending')}
                      </div>
                      {advisor && (
                        <div className="mt-3 flex flex-col gap-1 w-full max-h-20 overflow-y-auto pr-1">
                          {advisor.actions.map((action, actionIndex) => (
                            <button
                              key={action.id}
                              onClick={(event) => {
                                event.stopPropagation();
                                runAdvisorSlotAction(slot, actionIndex);
                              }}
                              className="border border-ink/40 bg-paper-dark px-1 py-1 font-typewriter text-[8px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                            >
                              {sandbox.getSandboxActionTitle(action, language)}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}

                  <button
                    onClick={() => setLibraryKind('advisors')}
                    className="aspect-[2/3] h-full border-2 border-ink bg-paper-dark relative flex flex-col justify-center items-center p-2 cursor-pointer transition-all shadow-[4px_4px_0_0_rgba(26,26,26,1)] hover:-translate-y-1"
                  >
                    <div className="absolute top-0 left-0 w-full h-2 bg-ink" />
                    <div className="font-display text-sm text-center leading-tight uppercase tracking-widest">
                      {language === 'zh' ? '档案柜' : 'Dossiers'}
                    </div>
                    <span className="font-typewriter text-[10px] mt-2 bg-ink text-paper px-1.5 py-0.5">
                      {sandbox.SANDBOX_ADVISORS.length} {language === 'zh' ? '份' : 'files'}
                    </span>
                  </button>
                </div>

                {libraryKind === 'advisors' && (
                  <div className="w-full bg-paper border-print p-5 shadow-lg">
                    <div className="flex items-end justify-between border-b-2 border-ink pb-3 mb-4">
                      <div>
                        <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                          {language === 'zh' ? '人员档案柜' : 'Personnel Files'}
                        </div>
                        <div className="font-display text-2xl uppercase leading-none">
                          {language === 'zh' ? `目标槽位 ${advisorSlotIndex + 1}` : `Target Slot ${advisorSlotIndex + 1}`}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[20rem] overflow-y-auto pr-1">
                      {sandbox.SANDBOX_ADVISORS.map((advisor) => (
                        <button
                          key={advisor.id}
                          onClick={() => setAdvisorSlotFromLibrary(advisor.id)}
                          className={cn(
                            'border-2 bg-paper-dark p-4 text-left shadow-[3px_3px_0_0_rgba(26,26,26,1)] hover:-translate-y-1 transition-all',
                            advisor.id === sessionState.activeAdvisors[advisorSlotIndex]?.id ? 'border-cnt-red shadow-[4px_4px_0_0_rgba(193,39,45,1)]' : 'border-ink',
                          )}
                        >
                          <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{advisor.faction}</div>
                          <div className="font-display text-xl uppercase leading-none mt-1">{sandbox.getSandboxAdvisorTitle(advisor, language)}</div>
                          <div className="font-mono text-[10px] opacity-60 mt-2 truncate">{advisor.id}</div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="border border-ink/40 bg-paper px-2 py-1 font-typewriter text-[9px] uppercase tracking-widest">
                              {language === 'zh' ? `替换槽位 ${advisorSlotIndex + 1}` : `Replace Slot ${advisorSlotIndex + 1}`}
                            </span>
                            {advisor.id === sessionState.activeAdvisors[advisorSlotIndex]?.id && (
                              <span className="border border-cnt-red bg-cnt-red text-paper px-2 py-1 font-typewriter text-[9px] uppercase tracking-widest">
                                {language === 'zh' ? '当前' : 'Current'}
                              </span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <aside className="bg-paper border-print p-4 shadow-xl 2xl:sticky 2xl:top-4 self-start">
              <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                {language === 'zh' ? '测试状态与最近结果' : 'State And Last Run'}
              </div>
              <div className="font-display text-2xl uppercase leading-none mb-4">{language === 'zh' ? '测试状态' : 'Test State'}</div>
              <div className="grid grid-cols-2 gap-2">
                <MetricBox label={language === 'zh' ? '行动点' : 'AP'} value={sessionState.actionsLeft} />
                <MetricBox label={language === 'zh' ? '资源' : 'Resources'} value={sessionState.resources} />
                <MetricBox label={language === 'zh' ? '武装' : 'Armaments'} value={sessionState.armaments} />
                <MetricBox label={language === 'zh' ? '阶段' : 'Phase'} value={sessionState.phase} />
                <MetricBox label={language === 'zh' ? '内战' : 'Civil War'} value={sessionState.civilWarStatus} />
                <MetricBox label={language === 'zh' ? '待处理' : 'Pending'} value={sessionState.pendingEvents.length} />
              </div>
              {sessionState.pendingEvents.length > 0 && (
                <button
                  onClick={drawPendingEvent}
                  className="mt-4 w-full border border-ink bg-paper-dark px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                >
                  {language === 'zh' ? `抽取待处理事件 (${sessionState.pendingEvents.length})` : `Open Pending Event (${sessionState.pendingEvents.length})`}
                </button>
              )}
              <div className="mt-5 border-t border-ink/30 pt-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-2">
                  {language === 'zh' ? '本次执行' : 'Last Run'}
                </div>
                {run ? (
                  <div className="flex flex-col gap-2">
                    <ScriptBadge tone={run.ok ? 'ink' : 'red'}>{run.ok ? 'OK' : 'BLOCKED'}</ScriptBadge>
                    {run.blockedReason && <div className="border border-cnt-red text-cnt-red bg-paper-dark p-3 font-serif text-sm">{run.blockedReason}</div>}
                    <div className="font-serif text-sm leading-tight">{run.targetTitle}</div>
                    {run.optionTitle && <div className="font-serif text-sm leading-tight opacity-85">{run.optionTitle}</div>}
                    {run.optionSubtitle && <div className="font-serif text-xs leading-snug opacity-70">{run.optionSubtitle}</div>}
                    <div className="max-h-[24rem] overflow-y-auto flex flex-col gap-2 pr-1">
                      {run.diffs.map((diff) => (
                        <div key={diff.path} className="bg-paper-dark border border-ink/25 p-2">
                          <div className="font-mono text-[10px] text-cnt-red break-all">{diff.path}</div>
                          <div className="font-mono text-[10px] opacity-70 break-all">{diff.before} {'->'} {diff.after}</div>
                        </div>
                      ))}
                      {run.diffs.length === 0 && <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '没有检测到可序列化状态变化。' : 'No serializable state changes detected.'}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '尚未执行测试操作。' : 'No test operation has been resolved yet.'}</div>
                )}
              </div>
            </aside>
          </div>

          <div className="hidden">
            <div className="min-w-0 flex flex-col gap-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="border-2 border-ink/30 bg-paper-dark p-3 min-h-[22rem]">
                  <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                    {language === 'zh' ? '事件库' : 'Event Library'}
                  </div>
                  <div className="font-display text-xl uppercase leading-none mb-3">{sandbox.SANDBOX_EVENTS.length}</div>
                  <div className="flex flex-col gap-2 max-h-[18rem] overflow-y-auto pr-1">
                    {sandbox.SANDBOX_EVENTS.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setCurrentEventFromLibrary(event.id)}
                        className={cn(
                          'bg-paper border p-2 text-left transition-colors',
                          sessionState.currentEvent?.id === event.id ? 'border-cnt-red shadow-[2px_2px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                        )}
                      >
                        <div className="font-serif text-sm leading-tight line-clamp-2">{sandbox.getSandboxEventTitle(event, sessionState, language)}</div>
                        <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{event.id}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {(['Action', 'Government', 'Military'] as CardType[]).map((type) => {
                  const cards = sandbox.SANDBOX_CARDS.filter((card) => card.type === type);
                  const title = type === 'Action'
                    ? language === 'zh' ? '行动卡牌库' : 'Action Deck'
                    : type === 'Government'
                      ? language === 'zh' ? '政府卡牌库' : 'Government Deck'
                      : language === 'zh' ? '武装卡牌库' : 'Military Deck';
                  return (
                    <div key={type} className="border-2 border-ink/30 bg-paper-dark p-3 min-h-[22rem]">
                      <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">{title}</div>
                      <div className="font-display text-xl uppercase leading-none mb-3">{cards.length}</div>
                      <div className="flex flex-col gap-2 max-h-[18rem] overflow-y-auto pr-1">
                        {cards.map((card) => (
                          <button
                            key={card.id}
                            onClick={() => {
                              setCardId(card.id);
                              setCardTypePick(type);
                              setSessionState(sandbox.addSandboxCardToHand(sessionState, card.id));
                            }}
                            className={cn(
                              'bg-paper border p-2 text-left transition-colors',
                              card.id === cardId ? 'border-cnt-red shadow-[2px_2px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                            )}
                          >
                            <div className="font-serif text-sm leading-tight line-clamp-2">{sandbox.getSandboxCardTitle(card, language)}</div>
                            <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{card.id}</div>
                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">AP {card.cost}</span>
                              {card.resourceCost !== undefined && <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">R {card.resourceCost}</span>}
                              {card.armamentCost !== undefined && <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">A {card.armamentCost}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-5">
                <div className="border-2 border-ink/30 bg-paper-dark p-4">
                  <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
                    <div>
                      <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                        {language === 'zh' ? '顾问牌库' : 'Advisor Library'}
                      </div>
                      <div className="font-display text-2xl uppercase leading-none">{language === 'zh' ? '下方顾问槽位' : 'Advisor Slots Below'}</div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {[0, 1, 2].map((slot) => {
                        const advisor = sessionState.activeAdvisors[slot];
                        return (
                          <button
                            key={slot}
                            onClick={() => setAdvisorSlotIndex(slot)}
                            className={cn(
                              'border px-3 py-2 text-left transition-colors',
                              advisorSlotIndex === slot ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/25 hover:border-ink',
                            )}
                          >
                            <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                              {language === 'zh' ? `槽位 ${slot + 1}` : `Slot ${slot + 1}`}
                            </div>
                            <div className="font-serif text-xs leading-tight line-clamp-2 mt-1">
                              {advisor ? sandbox.getSandboxAdvisorTitle(advisor, language) : (language === 'zh' ? '空' : 'Empty')}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[18rem] overflow-y-auto pr-1">
                    {sandbox.SANDBOX_ADVISORS.map((advisor) => (
                      <button
                        key={advisor.id}
                        onClick={() => setAdvisorSlotFromLibrary(advisor.id)}
                        className={cn(
                          'bg-paper border p-3 text-left transition-colors',
                          advisor.id === sessionState.activeAdvisors[advisorSlotIndex]?.id ? 'border-cnt-red shadow-[2px_2px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                        )}
                      >
                        <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{advisor.faction}</div>
                        <div className="font-display text-lg uppercase leading-none mt-1 line-clamp-2">{sandbox.getSandboxAdvisorTitle(advisor, language)}</div>
                        <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{advisor.id}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-5">
                  <div className="border-2 border-ink/30 bg-paper-dark p-4">
                    <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                      {language === 'zh' ? '手牌，点击打出' : 'Hand, Click To Play'}
                    </div>
                    <div className="font-display text-2xl uppercase leading-none mb-4">{language === 'zh' ? '手牌' : 'Hand'}</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[17rem] overflow-y-auto pr-1">
                      {sessionState.hand.map((card, index) => (
                        <div key={`${card.id}-${index}`} className="bg-paper border border-ink/25 p-3">
                          <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{card.type}</div>
                          <div className="font-display text-lg uppercase leading-none mt-1">{sandbox.getSandboxCardTitle(card, language)}</div>
                          <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{card.id}</div>
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => playHandCard(index)}
                              className="flex-1 bg-cnt-red text-paper border border-cnt-red px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:border-ink transition-colors"
                            >
                              {language === 'zh' ? '打出' : 'Play'}
                            </button>
                            <button
                              onClick={() => setSessionState(sandbox.removeSandboxCardFromHand(sessionState, index))}
                              className="border border-ink px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                            >
                              {language === 'zh' ? '移除' : 'Remove'}
                            </button>
                          </div>
                        </div>
                      ))}
                      {sessionState.hand.length === 0 && (
                        <div className="md:col-span-2 border border-dashed border-ink/30 p-5 text-center font-serif italic opacity-70">
                          {language === 'zh' ? '从上方牌库点击卡牌加入手牌。' : 'Click cards from the decks above to add them to hand.'}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="border-2 border-ink/30 bg-paper-dark p-4">
                    <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                      {language === 'zh' ? '顾问槽位行动' : 'Advisor Slot Actions'}
                    </div>
                    <div className="grid grid-cols-1 gap-3">
                      {[0, 1, 2].map((slot) => {
                        const advisor = sessionState.activeAdvisors[slot];
                        return (
                          <div key={slot} className="bg-paper border border-ink/25 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                                  {language === 'zh' ? `顾问 ${slot + 1}` : `Advisor ${slot + 1}`}
                                </div>
                                <div className="font-serif text-sm leading-tight mt-1">
                                  {advisor ? sandbox.getSandboxAdvisorTitle(advisor, language) : (language === 'zh' ? '空槽位' : 'Empty slot')}
                                </div>
                              </div>
                              {advisor && (
                                <button
                                  onClick={() => clearAdvisorSlot(slot)}
                                  className="border border-ink px-2 py-1 font-typewriter text-[9px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                                >
                                  {language === 'zh' ? '清空' : 'Clear'}
                                </button>
                              )}
                            </div>
                            {advisor && (
                              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                                {advisor.actions.map((action, index) => (
                                  <button
                                    key={action.id}
                                    onClick={() => runAdvisorSlotAction(slot, index)}
                                    className="bg-paper-dark border border-ink/25 p-2 text-left hover:border-ink transition-colors"
                                  >
                                    <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                                      {language === 'zh' ? `行动 ${index + 1}` : `Action ${index + 1}`}
                                    </div>
                                    <div className="font-serif text-sm leading-snug mt-1">{sandbox.getSandboxActionTitle(action, language)}</div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="border-2 border-ink/30 bg-paper-dark p-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                  {language === 'zh' ? '事件选项' : 'Event Options'}
                </div>
                <div className="font-display text-2xl uppercase leading-none mb-4">currentEvent</div>
                {sessionState.currentEvent ? (
                  <div className="bg-paper border border-ink/25 p-4">
                    <div className="font-display text-xl uppercase leading-none">{sandbox.getSandboxEventTitle(sessionState.currentEvent, sessionState, language)}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">{sessionState.currentEvent.id}</div>
                    <p className="font-serif text-sm italic border-l-4 border-ink pl-3 mt-3 max-h-24 overflow-y-auto">
                      {language === 'zh'
                        ? sessionState.currentEvent.descriptionZh || sessionState.currentEvent.description
                        : sessionState.currentEvent.description}
                    </p>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                      {sessionState.currentEvent.options.map((option, index) => {
                        const rawText = language === 'zh' ? option.textZh || option.text : option.text;
                        let optionText = `[${language === 'zh' ? '动态文本' : 'dynamic text'}]`;
                        try {
                          optionText = typeof rawText === 'function' ? rawText(sessionState) : rawText;
                        } catch {
                          optionText = `[${language === 'zh' ? '动态文本' : 'dynamic text'}]`;
                        }
                        return (
                          <div key={index} className="relative group">
                          <button
                            onClick={() => {
                              setActiveEventOptionIndex(index);
                              resolveActiveEventOption(index);
                            }}
                            className="h-full w-full bg-paper-dark border border-ink/25 p-3 text-left hover:border-ink transition-colors"
                          >
                            <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                              {language === 'zh' ? `选项 ${index + 1}` : `Option ${index + 1}`}
                            </div>
                            <div className="font-serif text-sm leading-snug mt-1">{optionText}</div>
                            {getEventOptionSubtitle(option) && <div className="font-serif text-xs leading-snug mt-2 opacity-70">{getEventOptionSubtitle(option)}</div>}
                          </button>
                          <SandboxEffectPreviewTooltip state={sessionState} option={option} language={language} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-ink/30 p-5 text-center font-serif italic opacity-70">
                    {language === 'zh' ? '打出能产生 currentEvent 的卡牌后，会在这里进入事件选项。' : 'Play a card that creates currentEvent, then resolve its options here.'}
                  </div>
                )}
              </div>
            </div>

            <aside className="border-2 border-ink/30 bg-paper-dark p-4 2xl:sticky 2xl:top-4 self-start">
              <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                {language === 'zh' ? '右侧状态变更' : 'State Changes'}
              </div>
              <div className="font-display text-2xl uppercase leading-none mb-4">{language === 'zh' ? '测试状态' : 'Test State'}</div>
              <div className="grid grid-cols-2 gap-2">
                <MetricBox label={language === 'zh' ? '行动点' : 'AP'} value={sessionState.actionsLeft} />
                <MetricBox label={language === 'zh' ? '资源' : 'Resources'} value={sessionState.resources} />
                <MetricBox label={language === 'zh' ? '武装' : 'Armaments'} value={sessionState.armaments} />
                <MetricBox label={language === 'zh' ? '内战' : 'Civil War'} value={sessionState.civilWarStatus} />
                <MetricBox label={language === 'zh' ? '坦克进度' : 'Tank R&D'} value={sessionState.tankResearchProgress} />
                <MetricBox label={language === 'zh' ? '待处理' : 'Pending'} value={sessionState.pendingEvents.length} />
              </div>

              {sessionState.pendingEvents.length > 0 && (
                <button
                  onClick={drawPendingEvent}
                  className="mt-4 w-full border border-ink bg-paper px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                >
                  {language === 'zh' ? `抽取待处理事件 (${sessionState.pendingEvents.length})` : `Open Pending Event (${sessionState.pendingEvents.length})`}
                </button>
              )}

              <div className="mt-5 border-t border-ink/30 pt-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-2">currentEvent</div>
                {sessionState.currentEvent ? (
                  <div className="bg-paper border border-ink/25 p-3">
                    <div className="font-serif text-base leading-tight">{sandbox.getSandboxEventTitle(sessionState.currentEvent, sessionState, language)}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">{sessionState.currentEvent.id}</div>
                  </div>
                ) : (
                  <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '当前没有事件。' : 'No current event.'}</div>
                )}
              </div>

              <div className="mt-5 border-t border-ink/30 pt-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-2">
                  {language === 'zh' ? '本次执行' : 'Last Run'}
                </div>
                {run ? (
                  <div className="flex flex-col gap-2">
                    <ScriptBadge tone={run.ok ? 'ink' : 'red'}>{run.ok ? 'OK' : 'BLOCKED'}</ScriptBadge>
                    {run.blockedReason && <div className="border border-cnt-red text-cnt-red bg-paper p-3 font-serif text-sm">{run.blockedReason}</div>}
                    <div className="font-serif text-sm leading-tight">{run.targetTitle}</div>
                    {run.optionTitle && <div className="font-serif text-sm leading-tight opacity-85">{run.optionTitle}</div>}
                    {run.optionSubtitle && <div className="font-serif text-xs leading-snug opacity-70">{run.optionSubtitle}</div>}
                    <div className="max-h-[18rem] overflow-y-auto flex flex-col gap-2 pr-1">
                      {run.diffs.map((diff) => (
                        <div key={diff.path} className="bg-paper border border-ink/25 p-2">
                          <div className="font-mono text-[10px] text-cnt-red break-all">{diff.path}</div>
                          <div className="font-mono text-[10px] opacity-70 break-all">{diff.before} {'->'} {diff.after}</div>
                        </div>
                      ))}
                      {run.diffs.length === 0 && <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '没有检测到可序列化状态变化。' : 'No serializable state changes detected.'}</div>}
                    </div>
                  </div>
                ) : (
                  <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '尚未打出卡牌或执行选项。' : 'No card or option has been resolved yet.'}</div>
                )}
              </div>
            </aside>
          </div>

          <div className="hidden">
            <div className="border-2 border-ink/30 bg-paper-dark p-4">
              <div className="flex flex-col gap-3 mb-4">
                <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
                  <div>
                    <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                      {language === 'zh' ? '测试库' : 'Test Libraries'}
                    </div>
                    <div className="font-display text-2xl uppercase leading-none">{libraryLabels[libraryKind][language]}</div>
                  </div>
                  <div className="font-typewriter text-[10px] uppercase tracking-widest opacity-60">
                    {language === 'zh' ? '事件进入 currentEvent，卡牌进入手牌，顾问进入槽位' : 'Events become currentEvent, cards enter hand, advisors fill slots'}
                  </div>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-1">
                  {(Object.keys(libraryLabels) as SandboxLibraryKind[]).map((kind) => (
                    <button
                      key={kind}
                      onClick={() => {
                        setLibraryKind(kind);
                        if (kind === 'actionCards') setCardTypePick('Action');
                        if (kind === 'governmentCards') setCardTypePick('Government');
                        if (kind === 'militaryCards') setCardTypePick('Military');
                      }}
                      className={cn(
                        'border px-2 py-2 font-typewriter text-[9px] uppercase tracking-widest transition-colors',
                        libraryKind === kind ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/30 hover:border-ink',
                      )}
                    >
                      {libraryLabels[kind][language]}
                    </button>
                  ))}
                </div>
              </div>

              {libraryKind === 'events' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[32rem] overflow-y-auto pr-1">
                  {sandbox.SANDBOX_EVENTS.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setCurrentEventFromLibrary(event.id)}
                      className={cn(
                        'bg-paper border p-3 text-left transition-colors',
                        sessionState.currentEvent?.id === event.id ? 'border-cnt-red shadow-[3px_3px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                      )}
                    >
                      <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{language === 'zh' ? '事件' : 'event'}</div>
                      <div className="font-display text-lg uppercase leading-none mt-1 line-clamp-2">{sandbox.getSandboxEventTitle(event, sessionState, language)}</div>
                      <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{event.id}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">{event.options.length} options</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {(libraryKind === 'actionCards' || libraryKind === 'governmentCards' || libraryKind === 'militaryCards') && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[32rem] overflow-y-auto pr-1">
                  {pickableCards.map((card) => (
                    <button
                      key={card.id}
                      onClick={() => {
                        setCardId(card.id);
                        setSessionState(sandbox.addSandboxCardToHand(sessionState, card.id));
                      }}
                      className={cn(
                        'bg-paper border p-3 text-left transition-colors',
                        card.id === cardId ? 'border-cnt-red shadow-[3px_3px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                      )}
                    >
                      <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{card.type}</div>
                      <div className="font-display text-lg uppercase leading-none mt-1 line-clamp-2">{sandbox.getSandboxCardTitle(card, language)}</div>
                      <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{card.id}</div>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">AP {card.cost}</span>
                        {card.resourceCost !== undefined && <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">R {card.resourceCost}</span>}
                        {card.armamentCost !== undefined && <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">A {card.armamentCost}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {libraryKind === 'advisors' && (
                <div className="flex flex-col gap-4">
                  <div className="grid grid-cols-3 gap-2">
                    {[0, 1, 2].map((slot) => {
                      const advisor = sessionState.activeAdvisors[slot];
                      return (
                        <button
                          key={slot}
                          onClick={() => setAdvisorSlotIndex(slot)}
                          className={cn(
                            'border p-3 text-left transition-colors min-h-24',
                            advisorSlotIndex === slot ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/25 hover:border-ink',
                          )}
                        >
                          <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                            {language === 'zh' ? `顾问槽 ${slot + 1}` : `Advisor Slot ${slot + 1}`}
                          </div>
                          <div className="font-display text-base uppercase leading-none mt-2 line-clamp-2">
                            {advisor ? sandbox.getSandboxAdvisorTitle(advisor, language) : (language === 'zh' ? '空槽位' : 'Empty')}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[25rem] overflow-y-auto pr-1">
                    {sandbox.SANDBOX_ADVISORS.map((advisor) => (
                      <button
                        key={advisor.id}
                        onClick={() => setAdvisorSlotFromLibrary(advisor.id)}
                        className={cn(
                          'bg-paper border p-3 text-left transition-colors',
                          advisor.id === sessionState.activeAdvisors[advisorSlotIndex]?.id ? 'border-cnt-red shadow-[3px_3px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                        )}
                      >
                        <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{advisor.faction}</div>
                        <div className="font-display text-lg uppercase leading-none mt-1 line-clamp-2">{sandbox.getSandboxAdvisorTitle(advisor, language)}</div>
                        <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{advisor.id}</div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">{advisor.actions.length} actions</span>
                          <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">slot {advisorSlotIndex + 1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-2 border-ink/30 bg-paper-dark p-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                <div>
                  <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                    {language === 'zh' ? '从牌库选牌' : 'Pick From Deck'}
                  </div>
                  <div className="font-display text-2xl uppercase leading-none">{language === 'zh' ? '牌库' : 'Deck'}</div>
                </div>
                <div className="flex border border-ink bg-paper w-max">
                  {(['Action', 'Government', 'Military'] as CardType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => {
                        setCardTypePick(type);
                        const first = sandbox.SANDBOX_CARDS.find((card) => card.type === type);
                        if (first) setCardId(first.id);
                      }}
                      className={cn(
                        'px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest transition-colors',
                        cardTypePick === type ? 'bg-ink text-paper' : 'hover:bg-ink/10',
                      )}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[32rem] overflow-y-auto pr-1">
                {pickableCards.map((card) => (
                  <button
                    key={card.id}
                    onClick={() => {
                      setCardId(card.id);
                      setSessionState(sandbox.addSandboxCardToHand(sessionState, card.id));
                    }}
                    className={cn(
                      'bg-paper border p-3 text-left transition-colors',
                      card.id === cardId ? 'border-cnt-red shadow-[3px_3px_0_0_rgba(193,39,45,1)]' : 'border-ink/25 hover:border-ink',
                    )}
                  >
                    <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{card.type}</div>
                    <div className="font-display text-lg uppercase leading-none mt-1 line-clamp-2">{sandbox.getSandboxCardTitle(card, language)}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{card.id}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">AP {card.cost}</span>
                      {card.resourceCost !== undefined && <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">R {card.resourceCost}</span>}
                      {card.armamentCost !== undefined && <span className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">A {card.armamentCost}</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5">
              <div className="border-2 border-ink/30 bg-paper-dark p-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                  {language === 'zh' ? '点击手牌以打出' : 'Click a hand card to play'}
                </div>
                <div className="font-display text-2xl uppercase leading-none mb-4">{language === 'zh' ? '手牌' : 'Hand'}</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {sessionState.hand.map((card, index) => (
                    <div key={`${card.id}-${index}`} className="bg-paper border border-ink/25 p-3">
                      <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{card.type}</div>
                      <div className="font-display text-lg uppercase leading-none mt-1">{sandbox.getSandboxCardTitle(card, language)}</div>
                      <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{card.id}</div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => playHandCard(index)}
                          className="flex-1 bg-cnt-red text-paper border border-cnt-red px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:border-ink transition-colors"
                        >
                          {language === 'zh' ? '打出' : 'Play'}
                        </button>
                        <button
                          onClick={() => setSessionState(sandbox.removeSandboxCardFromHand(sessionState, index))}
                          className="border border-ink px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                        >
                          {language === 'zh' ? '移除' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  ))}
                  {sessionState.hand.length === 0 && (
                    <div className="md:col-span-2 border border-dashed border-ink/30 p-5 text-center font-serif italic opacity-70">
                      {language === 'zh' ? '左侧点击卡牌即可加入手牌。' : 'Click cards on the left to add them to hand.'}
                    </div>
                  )}
                </div>
              </div>

              <div className="border-2 border-ink/30 bg-paper-dark p-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                  {language === 'zh' ? '顾问槽位行动' : 'Advisor Slot Actions'}
                </div>
                <div className="font-display text-2xl uppercase leading-none mb-4">{language === 'zh' ? '顾问槽位' : 'Advisor Slots'}</div>
                <div className="grid grid-cols-1 gap-3">
                  {[0, 1, 2].map((slot) => {
                    const advisor = sessionState.activeAdvisors[slot];
                    return (
                      <div key={slot} className="bg-paper border border-ink/25 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                              {language === 'zh' ? `顾问槽 ${slot + 1}` : `Advisor Slot ${slot + 1}`}
                            </div>
                            <div className="font-display text-lg uppercase leading-none mt-1">
                              {advisor ? sandbox.getSandboxAdvisorTitle(advisor, language) : (language === 'zh' ? '空槽位' : 'Empty')}
                            </div>
                          </div>
                          {advisor && (
                            <button
                              onClick={() => clearAdvisorSlot(slot)}
                              className="border border-ink px-2 py-1 font-typewriter text-[9px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                            >
                              {language === 'zh' ? '清空' : 'Clear'}
                            </button>
                          )}
                        </div>
                        {advisor ? (
                          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                            {advisor.actions.map((action, index) => (
                              <button
                                key={action.id}
                                onClick={() => runAdvisorSlotAction(slot, index)}
                                className="bg-paper-dark border border-ink/25 p-2 text-left hover:border-ink transition-colors"
                              >
                                <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">
                                  {language === 'zh' ? `行动 ${index + 1}` : `Action ${index + 1}`}
                                </div>
                                <div className="font-serif text-sm leading-snug mt-1">{sandbox.getSandboxActionTitle(action, language)}</div>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="mt-3 border border-dashed border-ink/30 p-3 font-serif text-sm italic opacity-70">
                            {language === 'zh' ? '在左侧顾问槽位库中选择顾问。' : 'Pick an advisor from the advisor library on the left.'}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="border-2 border-ink/30 bg-paper-dark p-4">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">
                  {language === 'zh' ? '卡牌产生事件后，在这里选择选项' : 'Choose options after a card creates an event'}
                </div>
                <div className="font-display text-2xl uppercase leading-none mb-4">currentEvent</div>
                {sessionState.currentEvent ? (
                  <div className="bg-paper border border-ink/25 p-4">
                    <div className="font-display text-xl uppercase leading-none">{sandbox.getSandboxEventTitle(sessionState.currentEvent, sessionState, language)}</div>
                    <div className="font-mono text-[10px] opacity-60 mt-1">{sessionState.currentEvent.id}</div>
                    <p className="font-serif text-sm italic border-l-4 border-ink pl-3 mt-3 max-h-28 overflow-y-auto">
                      {language === 'zh'
                        ? sessionState.currentEvent.descriptionZh || sessionState.currentEvent.description
                        : sessionState.currentEvent.description}
                    </p>
                    {sessionState.currentEvent.options.length > 0 ? (
                      <div className="mt-4 grid grid-cols-1 gap-2">
                        {sessionState.currentEvent.options.map((option, index) => {
                          const rawText = language === 'zh' ? option.textZh || option.text : option.text;
                          let optionText = `[${language === 'zh' ? '动态文本' : 'dynamic text'}]`;
                          try {
                            optionText = typeof rawText === 'function' ? rawText(sessionState) : rawText;
                          } catch {
                            optionText = `[${language === 'zh' ? '动态文本' : 'dynamic text'}]`;
                          }
                          return (
                            <div key={index} className="relative group">
                            <button
                              onClick={() => {
                                setActiveEventOptionIndex(index);
                                resolveActiveEventOption(index);
                              }}
                              className={cn(
                                'w-full border p-3 text-left transition-colors',
                                activeEventOptionIndex === index ? 'bg-ink text-paper border-ink' : 'bg-paper-dark border-ink/25 hover:border-ink',
                              )}
                            >
                              <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{language === 'zh' ? `选项 ${index + 1}` : `Option ${index + 1}`}</div>
                              <div className="font-serif text-sm leading-snug mt-1">{optionText}</div>
                              {getEventOptionSubtitle(option) && <div className="font-serif text-xs leading-snug mt-2 opacity-70">{getEventOptionSubtitle(option)}</div>}
                            </button>
                            <SandboxEffectPreviewTooltip state={sessionState} option={option} language={language} />
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="mt-4 border border-dashed border-ink/30 p-3 font-serif text-sm italic opacity-70">
                        {language === 'zh' ? '这是静态目标占位事件，没有可执行选项。' : 'This is a static target placeholder with no executable options.'}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="border border-dashed border-ink/30 p-5 text-center font-serif italic opacity-70">
                    {language === 'zh' ? '当前没有事件。打出能产生 currentEvent 的卡牌后会显示在这里。' : 'No current event. Play a card that creates currentEvent to continue here.'}
                  </div>
                )}

                {sessionState.pendingEvents.length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={drawPendingEvent}
                      className="w-full border border-ink bg-paper px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest hover:bg-ink hover:text-paper transition-colors"
                    >
                      {language === 'zh' ? `抽取待处理事件 (${sessionState.pendingEvents.length})` : `Open Pending Event (${sessionState.pendingEvents.length})`}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </section>
  );
};

const getEventDateKey = (event: EditableEvent, language: EditorLanguage = 'en') => {
  if (!event.year || !event.month) return language === 'zh' ? '未定日期' : 'Undated';
  return `${event.year}.${String(event.month).padStart(2, '0')}`;
};

const sortEvents = (events: EditableEvent[]) =>
  [...events].sort((a, b) => {
    const aTime = (a.year || 9999) * 100 + (a.month || 99);
    const bTime = (b.year || 9999) * 100 + (b.month || 99);
    return aTime - bTime || a.id.localeCompare(b.id);
  });

const RoadmapLegend: React.FC<{
  events: EditableEvent[];
  selectedId: string;
  onSelect: (id: string) => void;
  language: EditorLanguage;
}> = ({ events, selectedId, onSelect, language }) => (
  <>
    {sortEvents(events).map((event) => (
      <button
        key={event.id}
        onClick={() => onSelect(event.id)}
        className={cn(
          'text-left border p-3 transition-colors',
          selectedId === event.id ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/20 hover:border-ink',
        )}
      >
        <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">{getEventDateKey(event, language)}</div>
        <div className="font-display uppercase text-lg leading-none truncate">{getLocalizedEventTitle(event, language)}</div>
      </button>
    ))}
  </>
);

type FlowNodeKind = 'event' | 'option' | 'end' | 'dynamic' | 'note';

interface FlowLayoutNode {
  id: string;
  kind: FlowNodeKind;
  event?: FlowEvent;
  option?: FlowOption;
  label: string;
  sublabel?: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FlowLayoutEdge {
  id: string;
  from: string;
  to: string;
  type: 'option' | 'target' | 'end' | 'dynamic' | 'note' | 'coupling';
  fields?: string[];
}

const getLocalizedFlowTitle = (event: FlowEvent, language: EditorLanguage) =>
  pickLocalized(language, event.title, event.titleZh) || event.id;

const getLocalizedFlowOption = (option: FlowOption, language: EditorLanguage) =>
  pickLocalized(language, option.text, option.textZh) || `Option ${option.index + 1}`;

const getCompactTextWeight = (text: string) =>
  Array.from(text).reduce((sum, char) => sum + (/[^\u0000-\u00ff]/.test(char) ? 1 : 0.58), 0);

const getRouteOptionNodeSize = (option: FlowOption, language: EditorLanguage) => {
  const weight = getCompactTextWeight(getLocalizedFlowOption(option, language));
  if (weight > 31) return { width: 190, height: 96 };
  if (weight > 23) return { width: 176, height: 86 };
  return { width: 162, height: 76 };
};

type FlowWorkbenchMode = 'overview' | 'chain' | 'coupling' | 'risks';
type FlowMouseTool = 'select' | 'move';

const flowModeLabels: Record<FlowWorkbenchMode, { en: string; zh: string }> = {
  overview: { en: 'Routes', zh: '路线' },
  chain: { en: 'Flow', zh: '显式链图' },
  coupling: { en: 'Coupling', zh: '耦合检查' },
  risks: { en: 'Risks', zh: '风险提示' },
};

const flowCategoryLabels: Record<string, { en: string; zh: string }> = {
  news: { en: 'News', zh: '新闻' },
  cnt: { en: 'CNT', zh: 'CNT' },
  politics: { en: 'Politics', zh: '政治' },
  war: { en: 'War', zh: '战争' },
  other: { en: 'Other', zh: '其他' },
};

const prettyFlowKey = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const getFlowCategoryLabel = (category: string | undefined, language: EditorLanguage) => {
  if (!category) return language === 'zh' ? '未分类' : 'Unclassified';
  return flowCategoryLabels[category]?.[language] || prettyFlowKey(category);
};

const getFlowRouteLabel = (key: string, language: EditorLanguage) => {
  if (key.startsWith('series:')) return prettyFlowKey(key.slice('series:'.length));
  if (key.startsWith('category:')) return getFlowCategoryLabel(key.slice('category:'.length), language);
  return key;
};

const getWhiteboardEventClass = (event?: FlowEvent) => {
  switch (event?.category) {
    case 'news':
      return 'bg-paper border-ink text-ink';
    case 'cnt':
      return 'bg-paper border-cnt-red text-ink';
    case 'politics':
      return 'bg-paper-dark border-ink text-ink';
    case 'war':
      return 'bg-cnt-black border-cnt-red text-paper';
    default:
      return 'bg-paper border-ink/50 text-ink';
  }
};

type OptionRouteKind = 'historical' | 'alternate' | 'neutral';

const getOptionRouteKind = (option?: FlowOption): OptionRouteKind => {
  if (!option) return 'neutral';
  const text = [option.text, option.textZh, option.subtitle, option.subtitleZh]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/架空|非历史|反事实|改写|替代|假想|ahistorical|counterfactual|alternate|alternative|revision/.test(text)) {
    return 'alternate';
  }
  if (/历史|史实|historical|history/.test(text)) return 'historical';
  return option.index > 0 ? 'alternate' : 'neutral';
};

const getOptionRouteLabel = (option: FlowOption | undefined, language: EditorLanguage) => {
  const kind = getOptionRouteKind(option);
  if (kind === 'historical') return language === 'zh' ? '历史选项' : 'Historical';
  if (kind === 'alternate') return language === 'zh' ? '架空选项' : 'Alternate';
  return language === 'zh'
    ? `选项 ${option?.index !== undefined ? option.index + 1 : ''}`
    : `Option ${option?.index !== undefined ? option.index + 1 : ''}`;
};

const getWhiteboardOptionClass = (option?: FlowOption) => {
  const conditional = option?.conditionSnippet || option?.endsFlow ? 'border-dashed' : undefined;
  const kind = getOptionRouteKind(option);
  if (kind === 'historical') return cn('bg-paper-dark border-ink text-ink', conditional);
  if (kind === 'alternate') return cn('bg-cnt-red border-cnt-red text-paper', conditional);
  if (option?.endsFlow) return cn('bg-republic-purple border-republic-purple text-paper', conditional);
  return cn('bg-paper border-ink text-ink', conditional);
};

const externalKindLabel = (kind: string, language: EditorLanguage) => {
  const labels: Record<string, { en: string; zh: string }> = {
    advisor: { en: 'Advisor', zh: '顾问' },
    journal: { en: 'Journal', zh: '日志' },
    actionCard: { en: 'Action Card', zh: '行动卡牌' },
    governmentCard: { en: 'Government Card', zh: '政府卡牌' },
    militaryCard: { en: 'Military Card', zh: '武装卡牌' },
  };
  return labels[kind]?.[language] || kind;
};

const getTopFlowFields = (flow: FlowAnalysis) =>
  Array.from(new Set([...flow.readersByField.keys(), ...flow.writersByField.keys()]))
    .map((field) => ({
      field,
      readers: flow.readersByField.get(field) || [],
      writers: flow.writersByField.get(field) || [],
    }))
    .sort((a, b) => b.readers.length + b.writers.length - (a.readers.length + a.writers.length))
    .slice(0, 18);

const noisyRouteCouplingFields = new Set([
  'scenario',
  'year',
  'month',
  'cntStance',
  'government.type',
  'activeCoalition',
  'organizations.PRRevS.established',
  'ceda_formed',
  'ir_formed',
  'ur_formed',
]);

const noisyRouteCouplingRoots = new Set([
  'stats',
  'factions',
  'classes',
  'partyRelations',
  'relations',
  'ministers',
  'domesticPolicy',
  'budget',
]);

const isRouteCouplingFieldVisible = (field: string, flow: FlowAnalysis) => {
  if (noisyRouteCouplingFields.has(field)) return false;
  if (noisyRouteCouplingRoots.has(field.split('.')[0])) return false;
  const fanout = new Set([...(flow.readersByField.get(field) || []), ...(flow.writersByField.get(field) || [])]).size;
  return fanout <= 4;
};

const collectFlowComponent = (flow: FlowAnalysis, selectedId: string) => {
  const startId = flow.eventById.has(selectedId) ? selectedId : flow.events[0]?.id;
  if (!startId) return new Set<string>();

  const neighbors = new Map<string, string[]>();
  flow.events.forEach((event) => {
    neighbors.set(event.id, neighbors.get(event.id) || []);
    event.options.forEach((option) => {
      neighbors.set(option.id, neighbors.get(option.id) || []);
      neighbors.set(event.id, [...(neighbors.get(event.id) || []), option.id]);
      neighbors.set(option.id, [...(neighbors.get(option.id) || []), event.id]);
      option.targetEventIds.forEach((targetId) => {
        neighbors.set(targetId, neighbors.get(targetId) || []);
        neighbors.set(option.id, [...(neighbors.get(option.id) || []), targetId]);
        neighbors.set(targetId, [...(neighbors.get(targetId) || []), option.id]);
      });
    });
  });

  const visited = new Set<string>();
  const queue = [startId];
  while (queue.length > 0 && visited.size < 180) {
    const id = queue.shift() as string;
    if (visited.has(id)) continue;
    visited.add(id);
    (neighbors.get(id) || []).forEach((nextId) => {
      if (!visited.has(nextId)) queue.push(nextId);
    });
  }
  return visited;
};

const buildFlowLayout = (flow: FlowAnalysis, selectedId: string) => {
  const componentIds = collectFlowComponent(flow, selectedId);
  const componentEvents = flow.events.filter((event) => componentIds.has(event.id));
  const componentEventIds = new Set(componentEvents.map((event) => event.id));
  const componentOptions = componentEvents.flatMap((event) => event.options.filter((option) => componentIds.has(option.id)));
  const componentOptionIds = new Set(componentOptions.map((option) => option.id));
  const incoming = new Map<string, number>();
  componentEvents.forEach((event) => incoming.set(event.id, 0));
  componentOptions.forEach((option) => {
    option.targetEventIds.forEach((targetId) => {
      if (componentEventIds.has(targetId)) incoming.set(targetId, (incoming.get(targetId) || 0) + 1);
    });
  });

  const roots = componentEvents.filter((event) => (incoming.get(event.id) || 0) === 0);
  const selectedEvent = flow.eventById.get(selectedId);
  const rootEvents = roots.length > 0 ? roots : selectedEvent ? [selectedEvent] : componentEvents.slice(0, 1);
  const depth = new Map<string, number>();
  const queue = rootEvents.map((event) => {
    depth.set(event.id, 0);
    return event.id;
  });

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const currentDepth = depth.get(id) || 0;
    const event = flow.eventById.get(id);
    const option = flow.optionById.get(id);
    if (event) {
      event.options
        .filter((item) => componentOptionIds.has(item.id))
        .forEach((item) => {
          const nextDepth = currentDepth + 1;
          if (!depth.has(item.id)) {
            depth.set(item.id, nextDepth);
            queue.push(item.id);
          }
        });
    }
    if (option) {
      option.targetEventIds
        .filter((targetId) => componentEventIds.has(targetId))
        .forEach((targetId) => {
          const nextDepth = currentDepth + 1;
          if (!depth.has(targetId)) {
            depth.set(targetId, nextDepth);
            queue.push(targetId);
          }
        });
      if (option.endsFlow) depth.set(`${option.id}__end`, currentDepth + 1);
      if (option.dynamicTargetReason) depth.set(`${option.id}__dynamic`, currentDepth + 1);
    }
  }

  componentEvents.forEach((event) => {
    if (!depth.has(event.id)) depth.set(event.id, depth.size);
  });
  componentOptions.forEach((option) => {
    if (!depth.has(option.id)) depth.set(option.id, (depth.get(option.eventId) || 0) + 1);
  });

  const nodes: Omit<FlowLayoutNode, 'x' | 'y'>[] = [
    ...componentEvents.map((event) => ({
      id: event.id,
      kind: 'event' as const,
      event,
      label: getLocalizedFlowTitle(event, 'zh'),
      sublabel: event.id,
      width: 230,
      height: 116,
    })),
    ...componentOptions.map((option) => ({
      id: option.id,
      kind: 'option' as const,
      option,
      label: getLocalizedFlowOption(option, 'zh'),
      sublabel: option.conditionSnippet ? 'condition' : undefined,
      width: 190,
      height: 86,
    })),
    ...componentOptions.filter((option) => option.endsFlow).map((option) => ({
      id: `${option.id}__end`,
      kind: 'end' as const,
      option,
      label: '结束',
      sublabel: 'currentEvent: null',
      width: 160,
      height: 72,
    })),
    ...componentOptions.filter((option) => option.dynamicTargetReason).map((option) => ({
      id: `${option.id}__dynamic`,
      kind: 'dynamic' as const,
      option,
      label: '动态目标',
      sublabel: option.dynamicTargetReason,
      width: 178,
      height: 76,
    })),
  ];

  const byDepth = new Map<number, typeof nodes>();
  nodes.forEach((node) => {
    const level = depth.get(node.id) || 0;
    byDepth.set(level, [...(byDepth.get(level) || []), node]);
  });

  const columnGap = 285;
  const rowGap = 122;
  const paddingX = 52;
  const paddingY = 72;
  const layoutNodes: FlowLayoutNode[] = [];
  Array.from(byDepth.entries())
    .sort(([a], [b]) => a - b)
    .forEach(([level, levelNodes]) => {
      levelNodes
        .sort((a, b) => {
          const aOrder = a.event?.sourceOrder ?? a.option?.index ?? 9999;
          const bOrder = b.event?.sourceOrder ?? b.option?.index ?? 9999;
          return aOrder - bOrder || a.id.localeCompare(b.id);
        })
        .forEach((node, row) => {
          layoutNodes.push({
            ...node,
            x: paddingX + level * columnGap,
            y: paddingY + row * rowGap,
          });
        });
    });

  const layoutNodeIds = new Set(layoutNodes.map((node) => node.id));
  const layoutEdges: FlowLayoutEdge[] = [];
  componentEvents.forEach((event) => {
    event.options
      .filter((option) => layoutNodeIds.has(option.id))
      .forEach((option) => {
        layoutEdges.push({ id: `${event.id}->${option.id}`, from: event.id, to: option.id, type: 'option' });
      });
  });
  componentOptions.forEach((option) => {
    option.targetEventIds
      .filter((targetId) => layoutNodeIds.has(targetId))
      .forEach((targetId) => layoutEdges.push({ id: `${option.id}->${targetId}`, from: option.id, to: targetId, type: 'target' }));
    if (layoutNodeIds.has(`${option.id}__end`)) layoutEdges.push({ id: `${option.id}->end`, from: option.id, to: `${option.id}__end`, type: 'end' });
    if (layoutNodeIds.has(`${option.id}__dynamic`)) layoutEdges.push({ id: `${option.id}->dynamic`, from: option.id, to: `${option.id}__dynamic`, type: 'dynamic' });
  });

  const width = Math.max(...layoutNodes.map((node) => node.x + node.width), 600) + paddingX;
  const height = Math.max(...layoutNodes.map((node) => node.y + node.height), 360) + paddingY;
  return { nodes: layoutNodes, edges: layoutEdges, width, height, truncated: componentIds.size >= 180 };
};

const buildRouteWhiteboardLayout = (flow: FlowAnalysis, routeEvents: FlowEvent[], language: EditorLanguage) => {
  const routeEventIds = new Set(routeEvents.map((event) => event.id));
  const routeOptions = routeEvents.flatMap((event) => event.options);
  const routeOptionIds = new Set(routeOptions.map((option) => option.id));
  const routeCouplings = routeOptions.flatMap((option) =>
    routeEvents
      .filter((event) => event.id !== option.eventId && event.conditionFields.length > 0)
      .map((event) => ({
        fromOptionId: option.id,
        toEventId: event.id,
        fields: Array.from(new Set(event.conditionFields.filter((field) =>
          option.effectFields.includes(field) && isRouteCouplingFieldVisible(field, flow),
        ))).slice(0, 4),
      }))
      .filter((edge) => edge.fields.length > 0),
  );
  const explicitIncoming = new Map<string, number>();
  const couplingIncoming = new Map<string, number>();
  routeEvents.forEach((event) => {
    explicitIncoming.set(event.id, 0);
    couplingIncoming.set(event.id, 0);
  });
  routeOptions.forEach((option) => {
    option.targetEventIds.forEach((targetId) => {
      if (routeEventIds.has(targetId)) explicitIncoming.set(targetId, (explicitIncoming.get(targetId) || 0) + 1);
    });
  });
  routeCouplings.forEach((edge) => couplingIncoming.set(edge.toEventId, (couplingIncoming.get(edge.toEventId) || 0) + 1));

  const hasExplicitRouteEdges = routeOptions.some((option) => option.targetEventIds.some((targetId) => routeEventIds.has(targetId)));
  const roots = routeEvents.filter((event) => {
    if (hasExplicitRouteEdges) return (explicitIncoming.get(event.id) || 0) === 0;
    return (explicitIncoming.get(event.id) || 0) + (couplingIncoming.get(event.id) || 0) === 0;
  });
  const rootEvents = roots.length > 0 ? roots : routeEvents.slice(0, 1);
  const depth = new Map<string, number>();
  const queue = rootEvents.map((event) => {
    depth.set(event.id, 0);
    return event.id;
  });

  while (queue.length > 0) {
    const id = queue.shift() as string;
    const currentDepth = depth.get(id) || 0;
    const event = flow.eventById.get(id);
    const option = flow.optionById.get(id);
    if (event && routeEventIds.has(event.id)) {
      event.options
        .filter((item) => routeOptionIds.has(item.id))
        .forEach((item) => {
          if (!depth.has(item.id)) {
            depth.set(item.id, currentDepth + 1);
            queue.push(item.id);
          }
          if (item.conditionSnippet) depth.set(`${item.id}__note`, currentDepth + 1);
        });
    }
    if (option) {
      option.targetEventIds
        .filter((targetId) => routeEventIds.has(targetId))
        .forEach((targetId) => {
          if (!depth.has(targetId)) {
            depth.set(targetId, currentDepth + 1);
            queue.push(targetId);
          }
        });
      if (option.endsFlow) depth.set(`${option.id}__end`, currentDepth + 1);
      if (option.dynamicTargetReason) depth.set(`${option.id}__dynamic`, currentDepth + 1);
      routeCouplings
        .filter((edge) => edge.fromOptionId === option.id)
        .forEach((edge) => {
          if (!depth.has(edge.toEventId)) {
            depth.set(edge.toEventId, currentDepth + 1);
            queue.push(edge.toEventId);
          }
        });
    }
  }

  routeEvents.forEach((event) => {
    if (!depth.has(event.id)) depth.set(event.id, 0);
  });
  routeOptions.forEach((option) => {
    if (!depth.has(option.id)) depth.set(option.id, (depth.get(option.eventId) || 0) + 1);
  });

  const nodes: Omit<FlowLayoutNode, 'x' | 'y'>[] = [
    ...routeEvents.map((event) => ({
      id: event.id,
      kind: 'event' as const,
      event,
      label: getLocalizedFlowTitle(event, language),
      sublabel: getFlowDateKey(event, language),
      width: 172,
      height: 82,
    })),
    ...routeOptions.map((option) => ({
      id: option.id,
      kind: 'option' as const,
      option,
      label: getLocalizedFlowOption(option, language),
      sublabel: option.targetEventIds.filter((targetId) => routeEventIds.has(targetId)).join(', '),
      ...getRouteOptionNodeSize(option, language),
    })),
    ...routeOptions.filter((option) => option.conditionSnippet).map((option) => ({
      id: `${option.id}__note`,
      kind: 'note' as const,
      option,
      label: language === 'zh' ? '前置条件' : 'Condition',
      sublabel: option.conditionSnippet,
      width: 184,
      height: 104,
    })),
    ...routeOptions.filter((option) => option.endsFlow).map((option) => ({
      id: `${option.id}__end`,
      kind: 'end' as const,
      option,
      label: language === 'zh' ? '结束' : 'End',
      sublabel: 'currentEvent: null',
      width: 154,
      height: 76,
    })),
    ...routeOptions.filter((option) => option.dynamicTargetReason).map((option) => ({
      id: `${option.id}__dynamic`,
      kind: 'dynamic' as const,
      option,
      label: language === 'zh' ? '动态目标' : 'Dynamic',
      sublabel: option.dynamicTargetReason,
      width: 162,
      height: 78,
    })),
  ];

  const paddingX = 90;
  const paddingY = 64;
  const columnGap = 92;
  const rowGap = 86;
  const componentGap = 130;
  const maxRouteRowWidth = 920;
  const layoutNodes: FlowLayoutNode[] = [];
  const baseNodeIds = new Set([...routeEvents.map((event) => event.id), ...routeOptions.map((option) => option.id)]);
  const adjacency = new Map<string, Set<string>>();
  const connect = (a: string, b: string) => {
    if (!baseNodeIds.has(a) || !baseNodeIds.has(b)) return;
    adjacency.set(a, new Set([...(adjacency.get(a) || []), b]));
    adjacency.set(b, new Set([...(adjacency.get(b) || []), a]));
  };
  baseNodeIds.forEach((id) => adjacency.set(id, adjacency.get(id) || new Set()));
  routeEvents.forEach((event) => {
    event.options.filter((option) => routeOptionIds.has(option.id)).forEach((option) => connect(event.id, option.id));
  });
  routeOptions.forEach((option) => {
    option.targetEventIds.filter((targetId) => routeEventIds.has(targetId)).forEach((targetId) => connect(option.id, targetId));
  });
  if (!hasExplicitRouteEdges) {
    routeCouplings.forEach((edge) => connect(edge.fromOptionId, edge.toEventId));
  }

  const visited = new Set<string>();
  const components: string[][] = [];
  baseNodeIds.forEach((startId) => {
    if (visited.has(startId)) return;
    const queueIds = [startId];
    const component: string[] = [];
    visited.add(startId);
    while (queueIds.length > 0) {
      const current = queueIds.shift() as string;
      component.push(current);
      adjacency.get(current)?.forEach((next) => {
        if (visited.has(next)) return;
        visited.add(next);
        queueIds.push(next);
      });
    }
    components.push(component);
  });

  const getNodeBaseId = (node: Omit<FlowLayoutNode, 'x' | 'y'>) => {
    if (node.kind === 'event' || node.kind === 'option') return node.id;
    return node.option?.id || node.id;
  };
  let componentX = paddingX;
  let maxLayoutHeight = paddingY;
  components
    .sort((a, b) => {
      const firstA = Math.min(...a.map((id) => flow.eventById.get(id)?.sourceOrder ?? flow.optionById.get(id)?.index ?? 9999));
      const firstB = Math.min(...b.map((id) => flow.eventById.get(id)?.sourceOrder ?? flow.optionById.get(id)?.index ?? 9999));
      return firstA - firstB || a[0].localeCompare(b[0]);
    })
    .forEach((componentIds) => {
      const componentSet = new Set(componentIds);
      const componentNodes = nodes.filter((node) => componentSet.has(getNodeBaseId(node)));
      const byDepth = new Map<number, typeof nodes>();
      componentNodes.forEach((node) => {
        const level = depth.get(node.id) ?? depth.get(getNodeBaseId(node)) ?? 0;
        byDepth.set(level, [...(byDepth.get(level) || []), node]);
      });
      const rows = Array.from(byDepth.entries()).sort(([a], [b]) => a - b);
      const rowData = rows.flatMap(([level, levelNodes]) => {
        const sorted = [...levelNodes].sort((a, b) => {
          const aOrder = a.event?.sourceOrder ?? a.option?.index ?? (a.kind === 'note' ? 500 : 9999);
          const bOrder = b.event?.sourceOrder ?? b.option?.index ?? (b.kind === 'note' ? 500 : 9999);
          return aOrder - bOrder || a.id.localeCompare(b.id);
        });
        const visualRows: typeof sorted[] = [];
        sorted.forEach((node) => {
          const current = visualRows[visualRows.length - 1];
          const currentWidth = current
            ? current.reduce((sum, item) => sum + item.width, 0) + Math.max(0, current.length - 1) * columnGap
            : 0;
          const nextWidth = current ? currentWidth + columnGap + node.width : node.width;
          if (!current || nextWidth > maxRouteRowWidth) {
            visualRows.push([node]);
          } else {
            current.push(node);
          }
        });
        return visualRows.map((visualNodes, rowIndex) => {
          const rowWidth = visualNodes.reduce((sum, node) => sum + node.width, 0) + Math.max(0, visualNodes.length - 1) * columnGap;
          const rowHeight = Math.max(...visualNodes.map((node) => node.height));
          return { level, rowIndex, nodes: visualNodes, rowWidth, rowHeight };
        });
      });
      const componentWidth = Math.max(220, ...rowData.map((row) => row.rowWidth));
      let rowY = paddingY;
      rowData.forEach((row) => {
        let x = componentX + Math.max(0, (componentWidth - row.rowWidth) / 2);
        row.nodes.forEach((node) => {
          layoutNodes.push({
            ...node,
            x,
            y: rowY + (row.rowHeight - node.height) / 2,
          });
          x += node.width + columnGap;
        });
        rowY += row.rowHeight + rowGap;
      });
      maxLayoutHeight = Math.max(maxLayoutHeight, rowY);
      componentX += componentWidth + componentGap;
    });

  const layoutNodeIds = new Set(layoutNodes.map((node) => node.id));
  const layoutEdges: FlowLayoutEdge[] = [];
  routeEvents.forEach((event) => {
    event.options
      .filter((option) => layoutNodeIds.has(option.id))
      .forEach((option) => {
        layoutEdges.push({ id: `${event.id}->${option.id}`, from: event.id, to: option.id, type: 'option' });
        if (layoutNodeIds.has(`${option.id}__note`)) {
          layoutEdges.push({ id: `${option.id}->note`, from: option.id, to: `${option.id}__note`, type: 'note' });
        }
      });
  });
  routeOptions.forEach((option) => {
    option.targetEventIds
      .filter((targetId) => layoutNodeIds.has(targetId))
      .forEach((targetId) => layoutEdges.push({ id: `${option.id}->${targetId}`, from: option.id, to: targetId, type: 'target' }));
    if (layoutNodeIds.has(`${option.id}__end`)) layoutEdges.push({ id: `${option.id}->end`, from: option.id, to: `${option.id}__end`, type: 'end' });
    if (layoutNodeIds.has(`${option.id}__dynamic`)) layoutEdges.push({ id: `${option.id}->dynamic`, from: option.id, to: `${option.id}__dynamic`, type: 'dynamic' });
  });
  routeCouplings.forEach((edge) => {
    if (!layoutNodeIds.has(edge.fromOptionId) || !layoutNodeIds.has(edge.toEventId)) return;
    layoutEdges.push({
      id: `${edge.fromOptionId}->coupling->${edge.toEventId}`,
      from: edge.fromOptionId,
      to: edge.toEventId,
      type: 'coupling',
      fields: edge.fields,
    });
  });

  const width = Math.max(...layoutNodes.map((node) => node.x + node.width), componentX, 1280) + paddingX;
  const height = Math.max(...layoutNodes.map((node) => node.y + node.height), maxLayoutHeight, 720) + paddingY;
  return { nodes: layoutNodes, edges: layoutEdges, width, height, truncated: false };
};

const FlowRoadmapView: React.FC<{
  flow: FlowAnalysis;
  selectedId: string;
  onSelect: (id: string) => void;
  language: EditorLanguage;
}> = ({ flow, selectedId, onSelect, language }) => {
  const [mode, setMode] = React.useState<FlowWorkbenchMode>('overview');
  const [zoom, setZoom] = React.useState(0.78);
  const [selectedOptionId, setSelectedOptionId] = React.useState<string | undefined>();
  const [fieldFocus, setFieldFocus] = React.useState<string | undefined>();
  const [routeFocus, setRouteFocus] = React.useState<string | undefined>();
  const [mouseTool, setMouseTool] = React.useState<FlowMouseTool>('select');
  const [isPanning, setIsPanning] = React.useState(false);
  const panState = React.useRef<{ x: number; y: number; scrollLeft: number; scrollTop: number } | null>(null);
  const selectedEvent = flow.eventById.get(selectedId) || flow.events[0];
  const selectedOption = selectedOptionId ? flow.optionById.get(selectedOptionId) : undefined;
  const layout = React.useMemo(() => buildFlowLayout(flow, selectedEvent?.id || selectedId), [flow, selectedEvent?.id, selectedId]);
  const nodeById = React.useMemo(() => new Map(layout.nodes.map((node) => [node.id, node])), [layout.nodes]);
  const topFields = React.useMemo(() => getTopFlowFields(flow), [flow]);
  const visibleRisks = selectedEvent
    ? flow.risks.filter((risk) => !risk.eventId || risk.eventId === selectedEvent.id).slice(0, 18)
    : flow.risks.slice(0, 18);
  const couplingsFrom = selectedEvent ? flow.couplings.filter((edge) => edge.fromEventId === selectedEvent.id).slice(0, 16) : [];
  const couplingsTo = selectedEvent ? flow.couplings.filter((edge) => edge.toEventId === selectedEvent.id).slice(0, 16) : [];
  const externalEntries = selectedEvent
    ? flow.externalTriggers.filter((entry) => entry.targetEventIds.includes(selectedEvent.id)).slice(0, 12)
    : [];
  const seriesCount = React.useMemo(() => new Set(flow.events.flatMap((event) => event.series)).size, [flow.events]);
  const inlineCount = React.useMemo(() => flow.events.filter((event) => event.flow === 'inline').length, [flow.events]);
  const overviewGroups = React.useMemo(() => {
    const groups: Record<string, FlowEvent[]> = {};
    flow.events.forEach((event) => {
      const keys = event.series.length > 0
        ? event.series.map((series) => `series:${series}`)
        : [`category:${event.category || 'other'}`];
      keys.forEach((key) => {
        groups[key] = [...(groups[key] || []), event];
      });
    });
    return Object.entries(groups)
      .sort(([a], [b]) => {
        const rank = (key: string) => key.startsWith('series:') ? 0 : 1;
        return rank(a) - rank(b) || a.localeCompare(b);
      })
      .map(([key, events]) => ({
        key,
        label: getFlowRouteLabel(key, language),
        kind: key.startsWith('series:') ? 'series' : 'category',
        events: [...events]
          .sort((a, b) =>
            (a.year || 9999) - (b.year || 9999) ||
            (a.month || 99) - (b.month || 99) ||
            a.sourcePath.localeCompare(b.sourcePath) ||
            a.sourceOrder - b.sourceOrder),
        total: events.length,
      }));
  }, [flow.events, language]);
  const selectedRouteKey = React.useMemo(() => {
    const available = new Set(overviewGroups.map((group) => group.key));
    if (routeFocus && available.has(routeFocus)) return routeFocus;
    const preferredSeries = selectedEvent?.series.find((series) => available.has(`series:${series}`));
    if (preferredSeries) return `series:${preferredSeries}`;
    return overviewGroups[0]?.key;
  }, [overviewGroups, routeFocus, selectedEvent?.series]);
  const selectedRouteGroup = overviewGroups.find((group) => group.key === selectedRouteKey) || overviewGroups[0];
  const routeLayout = React.useMemo(
    () => buildRouteWhiteboardLayout(flow, selectedRouteGroup?.events || [], language),
    [flow, language, selectedRouteGroup?.events],
  );
  const routeNodeById = React.useMemo(() => new Map(routeLayout.nodes.map((node) => [node.id, node])), [routeLayout.nodes]);

  const patchZoom = (delta: number) => {
    setZoom((current) => Math.max(0.38, Math.min(1.45, Number((current + delta).toFixed(2)))));
  };

  const onWheel: React.WheelEventHandler<HTMLDivElement> = (event) => {
    handleCanvasWheel(event, patchZoom, 0.04);
  };

  const startCanvasPan: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (mouseTool !== 'move' || event.button !== 0) return;
    panState.current = {
      x: event.clientX,
      y: event.clientY,
      scrollLeft: event.currentTarget.scrollLeft,
      scrollTop: event.currentTarget.scrollTop,
    };
    setIsPanning(true);
    event.preventDefault();
  };

  const moveCanvasPan: React.MouseEventHandler<HTMLDivElement> = (event) => {
    if (!panState.current) return;
    event.currentTarget.scrollLeft = panState.current.scrollLeft - (event.clientX - panState.current.x);
    event.currentTarget.scrollTop = panState.current.scrollTop - (event.clientY - panState.current.y);
    event.preventDefault();
  };

  const stopCanvasPan = () => {
    panState.current = null;
    setIsPanning(false);
  };

  const renderMouseToolControls = () => (
    <div className="flex border border-ink bg-paper w-max">
      <button
        onClick={() => setMouseTool('select')}
        className={cn(
          'w-9 h-9 flex items-center justify-center transition-colors',
          mouseTool === 'select' ? 'bg-ink text-paper' : 'hover:bg-ink hover:text-paper',
        )}
        title={language === 'zh' ? '选择模式：点击节点' : 'Select mode'}
      >
        <MousePointer2 className="w-4 h-4" />
      </button>
      <button
        onClick={() => setMouseTool('move')}
        className={cn(
          'w-9 h-9 flex items-center justify-center border-l border-ink transition-colors',
          mouseTool === 'move' ? 'bg-ink text-paper' : 'hover:bg-ink hover:text-paper',
        )}
        title={language === 'zh' ? '移动模式：拖动画布' : 'Move mode'}
      >
        <Move className="w-4 h-4" />
      </button>
    </div>
  );

  const canvasInteractionClass = cn(
    mouseTool === 'move' ? (isPanning ? 'cursor-grabbing select-none' : 'cursor-grab') : 'cursor-default',
  );

  if (!selectedEvent) {
    return (
      <section className="bg-paper border-print p-5 shadow-xl">
        <h3 className="font-display text-3xl uppercase">{language === 'zh' ? '没有读取到事件' : 'No Events Loaded'}</h3>
      </section>
    );
  }

  return (
    <section className="min-h-full flex flex-col gap-5">
      <div className="bg-paper border-print p-5 shadow-xl">
        <div className="flex flex-col 2xl:flex-row 2xl:items-end 2xl:justify-between gap-4 border-b-2 border-ink pb-4">
          <div>
            <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
              {language === 'zh' ? '统一事件可视化工作台' : 'Unified Event Visualization Desk'}
            </div>
            <h3 className="font-display text-4xl uppercase leading-none">
              {language === 'zh' ? '事件网与耦合关系' : 'Event Network & Coupling'}
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <ScriptBadge tone="red">{language === 'zh' ? `${flow.events.length} 个事件` : `${flow.events.length} events`}</ScriptBadge>
            <ScriptBadge>{language === 'zh' ? `${flow.edges.length} 条显式边` : `${flow.edges.length} explicit links`}</ScriptBadge>
            <ScriptBadge>{language === 'zh' ? `${seriesCount} 条路线` : `${seriesCount} series`}</ScriptBadge>
            <ScriptBadge>{language === 'zh' ? `${inlineCount} 个链内事件` : `${inlineCount} inline events`}</ScriptBadge>
            <ScriptBadge>{language === 'zh' ? `${flow.externalTriggers.length} 个外部入口` : `${flow.externalTriggers.length} external entries`}</ScriptBadge>
            <ScriptBadge>{language === 'zh' ? `${flow.couplings.length} 条字段耦合` : `${flow.couplings.length} field couplings`}</ScriptBadge>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-2">
          {Object.entries(flow.sourceStats).map(([kind, count]) => (
            <div key={kind} className="border border-ink/25 bg-paper-dark p-3">
              <div className="font-typewriter text-[9px] uppercase tracking-widest opacity-60">
                {kind === 'event' ? (language === 'zh' ? '主事件' : 'Events') : externalKindLabel(kind, language)}
              </div>
              <div className="font-display text-2xl leading-none mt-1">{count}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(Object.keys(flowModeLabels) as FlowWorkbenchMode[]).map((item) => (
            <button
              key={item}
              onClick={() => setMode(item)}
              className={cn(
                'border-2 px-4 py-2 font-typewriter text-[10px] uppercase tracking-widest transition-colors',
                mode === item ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/35 hover:border-ink',
              )}
            >
              {flowModeLabels[item][language]}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_25rem] gap-5">
        <div className="bg-paper border-print p-5 shadow-xl min-w-0">
          {mode === 'overview' && (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-ink/30 pb-3">
                <div>
                  <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                    {language === 'zh' ? '按 series 与 category 生成的事件路线' : 'Series and category event routes'}
                  </div>
                  <h4 className="font-display text-3xl uppercase leading-none">{language === 'zh' ? '路线图' : 'Route Map'}</h4>
                </div>
                <div className="font-typewriter text-[10px] uppercase tracking-widest opacity-60">
                  {language === 'zh' ? '虚线表示选项写入字段后可能解锁后续事件' : 'Dashed links show option-state couplings that may unlock later events'}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {overviewGroups.map((group) => (
                  <button
                    key={group.key}
                    onClick={() => setRouteFocus(group.key)}
                    className={cn(
                      'border px-3 py-2 font-typewriter text-[10px] uppercase tracking-widest transition-colors',
                      selectedRouteKey === group.key ? 'bg-ink text-paper border-ink' : 'bg-paper-dark border-ink/25 hover:border-ink',
                    )}
                  >
                    {group.label}
                    <span className="ml-2 font-mono opacity-70">{group.total}</span>
                  </button>
                ))}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-4 font-typewriter text-[10px] uppercase tracking-widest">
                  <div className="flex items-center gap-2"><span className="w-8 h-0.5 bg-ink/55 inline-block" />{language === 'zh' ? '流程连线' : 'Flow links'}</div>
                  <div className="flex items-center gap-2"><span className="w-8 h-0 border-t-2 border-dashed border-republic-purple inline-block" />{language === 'zh' ? '字段耦合' : 'Field coupling'}</div>
                  <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full border-2 border-ink bg-paper-dark inline-block" />{language === 'zh' ? '历史选项' : 'Historical'}</div>
                  <div className="flex items-center gap-2"><span className="w-5 h-5 rounded-full border-2 border-cnt-red bg-cnt-red inline-block" />{language === 'zh' ? '架空选项' : 'Alternate'}</div>
                  <div className="flex items-center gap-2"><span className="w-5 h-5 border-2 border-cnt-red bg-paper inline-block" />{language === 'zh' ? '事件' : 'Event'}</div>
                  <div className="flex items-center gap-2"><span className="w-5 h-5 border border-ink/30 bg-paper inline-block" />{language === 'zh' ? '条件旁注' : 'Condition note'}</div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderMouseToolControls()}
                  <div className="flex border border-ink bg-paper w-max">
                    <button onClick={() => patchZoom(-0.1)} className="w-9 h-9 flex items-center justify-center hover:bg-ink hover:text-paper transition-colors" title={language === 'zh' ? '缩小' : 'Zoom out'}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-16 h-9 flex items-center justify-center border-x border-ink font-mono text-xs">{Math.round(zoom * 100)}%</div>
                    <button onClick={() => patchZoom(0.1)} className="w-9 h-9 flex items-center justify-center hover:bg-ink hover:text-paper transition-colors" title={language === 'zh' ? '放大' : 'Zoom in'}>
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => setZoom(0.78)} className="w-9 h-9 flex items-center justify-center border-l border-ink hover:bg-ink hover:text-paper transition-colors" title={language === 'zh' ? '重置缩放' : 'Reset zoom'}>
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div
                onWheel={onWheel}
                onMouseDown={startCanvasPan}
                onMouseMove={moveCanvasPan}
                onMouseUp={stopCanvasPan}
                onMouseLeave={stopCanvasPan}
                className={cn('mt-4 relative overflow-auto border-2 border-ink/40 bg-paper-dark bg-halftone h-[72vh] min-h-[40rem]', canvasInteractionClass)}
              >
                <div style={{ width: routeLayout.width * zoom, height: routeLayout.height * zoom }}>
                  <div className="relative" style={{ width: routeLayout.width, height: routeLayout.height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                    <svg className="absolute inset-0 pointer-events-none" width={routeLayout.width} height={routeLayout.height}>
                      <defs>
                        <marker id="route-arrow-gray" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7a7469" /></marker>
                        <marker id="route-arrow-coupling" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6c1d45" /></marker>
                      </defs>
                      {routeLayout.edges.map((edge) => {
                        const from = routeNodeById.get(edge.from);
                        const to = routeNodeById.get(edge.to);
                        if (!from || !to) return null;
                        const x1 = from.x + from.width / 2;
                        const y1 = from.y + from.height;
                        const x2 = to.x + to.width / 2;
                        const y2 = to.y;
                        const midY = y1 + Math.max(34, (y2 - y1) / 2);
                        const isNote = edge.type === 'note';
                        const isCoupling = edge.type === 'coupling';
                        const path = isNote
                          ? `M ${from.x + from.width} ${from.y + from.height / 2} H ${to.x} V ${to.y + to.height / 2}`
                          : isCoupling && Math.abs(x1 - x2) > 260
                            ? `M ${x1} ${y1} V ${Math.max(18, Math.min(y1, y2) - 44)} H ${x2} V ${y2}`
                          : `M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`;
                        return (
                          <path
                            key={edge.id}
                            d={path}
                            fill="none"
                            stroke={isNote ? '#c1272d' : isCoupling ? '#6c1d45' : '#7a7469'}
                            strokeWidth={isCoupling ? 1.8 : 1.6}
                            strokeDasharray={isNote || isCoupling || edge.type === 'dynamic' ? '5 6' : undefined}
                            markerEnd={isNote ? undefined : isCoupling ? 'url(#route-arrow-coupling)' : 'url(#route-arrow-gray)'}
                            opacity={0.95}
                          />
                        );
                      })}
                    </svg>
                    {routeLayout.nodes.map((node) => {
                      const isSelectedEvent = node.event?.id === selectedEvent.id;
                      const isSelectedOption = node.option?.id === selectedOptionId;
                      return (
                        <button
                          key={node.id}
                          onClick={() => {
                            if (mouseTool === 'move') return;
                            if (node.event) {
                              onSelect(node.event.id);
                              setSelectedOptionId(undefined);
                            }
                            if (node.option) setSelectedOptionId(node.option.id);
                          }}
                          className={cn(
                            'absolute text-center transition-all overflow-hidden',
                            node.kind === 'event' && 'border-2 px-3 py-2 shadow-sm',
                            node.kind === 'option' && 'border-2 rounded-full px-4 py-3 flex flex-col items-center justify-center',
                            node.kind === 'note' && 'bg-paper border border-ink/30 px-3 py-3 text-left shadow-[3px_3px_0_0_rgba(43,43,43,0.25)]',
                            (node.kind === 'end' || node.kind === 'dynamic') && 'bg-republic-purple border-2 border-republic-yellow text-paper rounded-full px-3 py-3 flex flex-col items-center justify-center',
                            node.kind === 'event' && getWhiteboardEventClass(node.event),
                            node.kind === 'option' && getWhiteboardOptionClass(node.option),
                            isSelectedEvent || isSelectedOption ? 'ring-2 ring-cnt-red z-20' : 'hover:ring-2 hover:ring-ink/35',
                          )}
                          style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                        >
                          <div className={cn(
                            'font-typewriter text-[9px] uppercase tracking-widest',
                            node.kind === 'note'
                              ? 'text-cnt-red mb-1'
                              : node.kind === 'option' && (getOptionRouteKind(node.option) === 'alternate' || node.option?.endsFlow)
                                ? 'text-paper/80'
                                : 'opacity-70',
                          )}>
                            {node.event ? node.sublabel : node.kind === 'option' ? getOptionRouteLabel(node.option, language) : node.label}
                          </div>
                          <div className={cn(node.kind === 'event' ? 'font-display text-base uppercase leading-none line-clamp-3' : node.kind === 'note' ? 'font-mono text-[9px] leading-snug line-clamp-5' : 'font-serif text-[12px] leading-[1.08] line-clamp-4 break-words [overflow-wrap:anywhere]')}>
                            {node.kind === 'note' ? node.sublabel : node.event ? getLocalizedFlowTitle(node.event, language) : node.option ? getLocalizedFlowOption(node.option, language) : node.label}
                          </div>
                          {node.event && (
                            <div className="mt-1 flex items-center justify-center gap-1 font-mono text-[9px] opacity-70">
                              {node.event.flow && <span>{node.event.flow}</span>}
                              {node.event.tags.slice(0, 1).map((tag) => <span key={tag}>#{tag}</span>)}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'chain' && (
            <>
              <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 border-b border-ink/30 pb-3">
                <div>
                  <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                    {language === 'zh' ? '事件 -> 选项 -> 目标事件' : 'Event -> Option -> Target'}
                  </div>
                  <h4 className="font-display text-3xl uppercase leading-none">{language === 'zh' ? '显式链图' : 'Explicit Flow'}</h4>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {renderMouseToolControls()}
                  <div className="flex border border-ink bg-paper w-max">
                    <button onClick={() => patchZoom(-0.1)} className="w-9 h-9 flex items-center justify-center hover:bg-ink hover:text-paper transition-colors" title={language === 'zh' ? '缩小' : 'Zoom out'}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <div className="w-16 h-9 flex items-center justify-center border-x border-ink font-mono text-xs">{Math.round(zoom * 100)}%</div>
                    <button onClick={() => patchZoom(0.1)} className="w-9 h-9 flex items-center justify-center hover:bg-ink hover:text-paper transition-colors" title={language === 'zh' ? '放大' : 'Zoom in'}>
                      <Plus className="w-4 h-4" />
                    </button>
                    <button onClick={() => setZoom(0.78)} className="w-9 h-9 flex items-center justify-center border-l border-ink hover:bg-ink hover:text-paper transition-colors" title={language === 'zh' ? '重置缩放' : 'Reset zoom'}>
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-4 py-3 font-typewriter text-[10px] uppercase tracking-widest">
                <div className="flex items-center gap-2"><span className="w-8 h-0.5 bg-cnt-red inline-block" />{language === 'zh' ? '事件到选项' : 'Event to option'}</div>
                <div className="flex items-center gap-2"><span className="w-8 h-0.5 bg-ink inline-block" />{language === 'zh' ? '选项到目标' : 'Option to target'}</div>
                {layout.truncated && <div className="text-cnt-red">{language === 'zh' ? '节点过多，已截断显示' : 'Large component truncated'}</div>}
              </div>
              <div
                onWheel={onWheel}
                onMouseDown={startCanvasPan}
                onMouseMove={moveCanvasPan}
                onMouseUp={stopCanvasPan}
                onMouseLeave={stopCanvasPan}
                className={cn('relative overflow-auto border-2 border-ink/40 bg-paper-dark h-[66vh] min-h-[32rem]', canvasInteractionClass)}
              >
                <div style={{ width: layout.width * zoom, height: layout.height * zoom }}>
                  <div className="relative" style={{ width: layout.width, height: layout.height, transform: `scale(${zoom})`, transformOrigin: 'top left' }}>
                    <svg className="absolute inset-0 pointer-events-none" width={layout.width} height={layout.height}>
                      <defs>
                        <marker id="flow-workbench-arrow-red" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#c1272d" /></marker>
                        <marker id="flow-workbench-arrow-ink" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#1f1f1f" /></marker>
                      </defs>
                      {layout.edges.map((edge) => {
                        const from = nodeById.get(edge.from);
                        const to = nodeById.get(edge.to);
                        if (!from || !to) return null;
                        const x1 = from.x + from.width;
                        const y1 = from.y + from.height / 2;
                        const x2 = to.x;
                        const y2 = to.y + to.height / 2;
                        const midX = x1 + Math.max(42, (x2 - x1) / 2);
                        const stroke = edge.type === 'option' ? '#c1272d' : '#1f1f1f';
                        return (
                          <path
                            key={edge.id}
                            d={`M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`}
                            fill="none"
                            stroke={stroke}
                            strokeWidth={edge.type === 'option' ? 2 : 1.35}
                            strokeDasharray={edge.type === 'dynamic' || edge.type === 'end' ? '5 6' : undefined}
                            markerEnd={edge.type === 'option' ? 'url(#flow-workbench-arrow-red)' : 'url(#flow-workbench-arrow-ink)'}
                            opacity={0.76}
                          />
                        );
                      })}
                    </svg>
                    {layout.nodes.map((node) => {
                      const isSelectedEvent = node.event?.id === selectedEvent.id;
                      const isSelectedOption = node.option?.id === selectedOptionId;
                      return (
                        <button
                          key={node.id}
                          onClick={() => {
                            if (mouseTool === 'move') return;
                            if (node.event) {
                              onSelect(node.event.id);
                              setSelectedOptionId(undefined);
                            }
                            if (node.option) setSelectedOptionId(node.option.id);
                          }}
                          className={cn(
                            'absolute text-left transition-all overflow-hidden',
                            node.kind === 'event' && 'bg-paper border-2 px-3 py-3',
                            node.kind === 'option' && cn('border-2 rounded-full px-4 py-3 text-center flex flex-col items-center justify-center', getWhiteboardOptionClass(node.option)),
                            (node.kind === 'end' || node.kind === 'dynamic') && 'bg-paper border-2 border-dashed px-3 py-3 text-center flex flex-col items-center justify-center',
                            isSelectedEvent || isSelectedOption ? 'border-cnt-red shadow-[5px_5px_0_0_rgba(193,39,45,1)] z-20' : 'border-ink/45 hover:border-ink hover:shadow-[3px_3px_0_0_rgba(26,26,26,1)]',
                          )}
                          style={{ left: node.x, top: node.y, width: node.width, height: node.height }}
                        >
                          {node.kind === 'event' && <div className="absolute top-0 left-0 h-1 w-full bg-cnt-red" />}
                          <div className={cn(
                            'font-typewriter text-[10px] uppercase tracking-widest mb-1',
                            node.kind === 'option'
                              ? getOptionRouteKind(node.option) === 'alternate' || node.option?.endsFlow ? 'text-paper/80' : 'text-cnt-red'
                              : 'text-ink/65',
                          )}>
                            {node.event ? getFlowDateKey(node.event, language) : node.kind === 'option' ? getOptionRouteLabel(node.option, language) : node.kind}
                          </div>
                          <div className={cn(node.kind === 'event' ? 'font-display text-lg uppercase leading-none line-clamp-2' : 'font-serif text-[12px] leading-[1.08] line-clamp-4 break-words [overflow-wrap:anywhere]')}>
                            {node.event ? getLocalizedFlowTitle(node.event, language) : node.option ? getLocalizedFlowOption(node.option, language) : node.label}
                          </div>
                          <div className="font-mono text-[10px] opacity-60 mt-2 truncate">{node.sublabel}</div>
                          {node.option?.conditionSnippet && <div className="inline-block mt-1 border border-cnt-red text-cnt-red px-1.5 py-0.5 font-typewriter text-[9px] uppercase tracking-widest">{language === 'zh' ? '条件' : 'condition'}</div>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {mode === 'coupling' && (
            <>
              <div className="border-b border-ink/30 pb-3">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                  {language === 'zh' ? '状态字段读写关系，不进入主画布默认连线' : 'State read/write links; kept out of the main canvas'}
                </div>
                <h4 className="font-display text-3xl uppercase leading-none">{language === 'zh' ? '耦合检查器' : 'Coupling Inspector'}</h4>
              </div>
              <div className="mt-5 grid grid-cols-1 xl:grid-cols-[18rem_minmax(0,1fr)] gap-5">
                <div className="border-2 border-ink/30 bg-paper-dark p-3 max-h-[38rem] overflow-y-auto">
                  <div className="font-typewriter text-xs uppercase tracking-widest mb-3">{language === 'zh' ? '高耦合字段' : 'High-coupling fields'}</div>
                  <div className="flex flex-col gap-2">
                    {topFields.map((item) => (
                      <button
                        key={item.field}
                        onClick={() => setFieldFocus(item.field)}
                        className={cn(
                          'border p-2 text-left transition-colors',
                          fieldFocus === item.field ? 'bg-ink text-paper border-ink' : 'bg-paper border-ink/25 hover:border-ink',
                        )}
                      >
                        <div className="font-mono text-xs truncate">{item.field}</div>
                        <div className="font-typewriter text-[9px] uppercase tracking-widest opacity-65 mt-1">
                          W {item.writers.length} / R {item.readers.length}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <CouplingList
                    title={language === 'zh' ? '当前事件影响这些事件' : 'Selected event may affect'}
                    empty={language === 'zh' ? '未检测到字段写入导致的后续耦合。' : 'No outgoing field coupling detected.'}
                    couplings={couplingsFrom}
                    flow={flow}
                    language={language}
                    direction="to"
                    onSelect={onSelect}
                  />
                  <CouplingList
                    title={language === 'zh' ? '当前事件可能受这些事件影响' : 'Selected event may be affected by'}
                    empty={language === 'zh' ? '未检测到读取字段对应的上游写入。' : 'No incoming field coupling detected.'}
                    couplings={couplingsTo}
                    flow={flow}
                    language={language}
                    direction="from"
                    onSelect={onSelect}
                  />
                  {fieldFocus && (
                    <div className="lg:col-span-2 border-2 border-ink/30 bg-paper-dark p-4">
                      <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">{language === 'zh' ? '字段详情' : 'Field detail'}</div>
                      <div className="font-display text-2xl uppercase leading-none mb-4">{fieldFocus}</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <FieldEventList title={language === 'zh' ? '写入此字段' : 'Writers'} eventIds={flow.writersByField.get(fieldFocus) || []} flow={flow} language={language} onSelect={onSelect} />
                        <FieldEventList title={language === 'zh' ? '读取此字段' : 'Readers'} eventIds={flow.readersByField.get(fieldFocus) || []} flow={flow} language={language} onSelect={onSelect} />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {mode === 'risks' && (
            <>
              <div className="border-b border-ink/30 pb-3">
                <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">
                  {language === 'zh' ? '静态分析无法完全确认的地方' : 'Places static analysis cannot fully confirm'}
                </div>
                <h4 className="font-display text-3xl uppercase leading-none">{language === 'zh' ? '风险提示' : 'Risk Notes'}</h4>
              </div>
              <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-3">
                {visibleRisks.map((risk) => (
                  <button
                    key={risk.id}
                    onClick={() => risk.eventId && onSelect(risk.eventId)}
                    className="bg-paper-dark border border-ink/30 p-4 text-left hover:border-ink transition-colors"
                  >
                    <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red mb-1">{risk.level}</div>
                    <div className="font-serif text-base leading-snug">{language === 'zh' ? risk.messageZh : risk.message}</div>
                    {risk.eventId && <div className="font-mono text-[10px] opacity-60 mt-2">{risk.eventId}</div>}
                  </button>
                ))}
                {visibleRisks.length === 0 && (
                  <div className="font-serif italic opacity-70">{language === 'zh' ? '当前选择没有风险提示。' : 'No risk notes for the current selection.'}</div>
                )}
              </div>
            </>
          )}
        </div>

        <aside className="bg-paper border-print p-5 shadow-xl min-w-0">
          <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">{getFlowDateKey(selectedEvent, language)}</div>
          <h4 className="font-display text-3xl uppercase leading-none mt-1">{getLocalizedFlowTitle(selectedEvent, language)}</h4>
          <div className="font-mono text-[10px] opacity-60 mt-2 break-all">{selectedEvent.id}</div>
          <div className="font-mono text-[10px] opacity-60 mt-1 break-all">{selectedEvent.sourcePath}</div>
          <p className="font-serif text-base italic border-l-4 border-ink pl-3 leading-relaxed max-h-32 overflow-y-auto mt-4">
            {pickLocalized(language, selectedEvent.description, selectedEvent.descriptionZh) || (language === 'zh' ? '无描述。' : 'No description.')}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <MetricBox label={language === 'zh' ? '入口' : 'Incoming'} value={flow.incomingExplicitByEventId.get(selectedEvent.id)?.length || 0} />
            <MetricBox label={language === 'zh' ? '出口' : 'Outgoing'} value={flow.outgoingExplicitByEventId.get(selectedEvent.id)?.length || 0} />
            <MetricBox label={language === 'zh' ? '读取字段' : 'Reads'} value={selectedEvent.conditionFields.length} />
            <MetricBox label={language === 'zh' ? '写入字段' : 'Writes'} value={selectedEvent.effectFields.length} />
          </div>

          <div className="mt-5 border-t border-ink/30 pt-4">
            <div className="font-typewriter text-xs uppercase tracking-widest mb-2">{language === 'zh' ? '路线元数据' : 'Route Metadata'}</div>
            <div className="flex flex-wrap gap-2">
              <span className="border border-ink/30 bg-paper-dark px-2 py-1 font-mono text-[10px]">
                {language === 'zh' ? '分类' : 'category'}: {getFlowCategoryLabel(selectedEvent.category, language)}
              </span>
              <span className="border border-ink/30 bg-paper-dark px-2 py-1 font-mono text-[10px]">
                flow: {selectedEvent.flow || 'unknown'}
              </span>
              {selectedEvent.series.length === 0 && (
                <span className="border border-ink/30 bg-paper-dark px-2 py-1 font-mono text-[10px]">
                  series: none
                </span>
              )}
              {selectedEvent.series.map((series) => (
                <span key={series} className="border border-cnt-red text-cnt-red bg-paper px-2 py-1 font-mono text-[10px]">
                  {series}
                </span>
              ))}
              {selectedEvent.tags.map((tag) => (
                <span key={tag} className="border border-ink/20 bg-paper-dark px-2 py-1 font-mono text-[10px] opacity-75">
                  #{tag}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 border-t border-ink/30 pt-4">
            <div className="font-typewriter text-xs uppercase tracking-widest mb-3">{language === 'zh' ? '选项与目标' : 'Options & Targets'}</div>
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {selectedEvent.options.map((option) => (
                <button
                  key={option.id}
                  onClick={() => {
                    setSelectedOptionId(option.id);
                    setMode('chain');
                  }}
                  className={cn(
                    'bg-paper-dark border p-3 text-left hover:border-ink transition-colors',
                    selectedOptionId === option.id ? 'border-cnt-red' : 'border-ink/25',
                  )}
                >
                  <div className="font-typewriter text-[10px] uppercase tracking-widest text-cnt-red">{language === 'zh' ? `选项 ${option.index + 1}` : `Option ${option.index + 1}`}</div>
                  <div className="font-serif text-sm leading-snug mt-1">{getLocalizedFlowOption(option, language)}</div>
                  <div className="font-mono text-[10px] opacity-60 mt-2 truncate">
                    {option.targetEventIds.length > 0 ? option.targetEventIds.join(', ') : option.endsFlow ? 'currentEvent: null' : option.dynamicTargetReason || (language === 'zh' ? '无显式目标' : 'no explicit target')}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedOption && (
            <div className="mt-5 border-t border-ink/30 pt-4">
              <div className="font-typewriter text-xs uppercase tracking-widest mb-2">{language === 'zh' ? '当前选项脚本' : 'Selected option script'}</div>
              {selectedOption.conditionSnippet && <pre className="bg-paper-dark border border-ink/20 p-2 font-mono text-[10px] whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{selectedOption.conditionSnippet}</pre>}
              {selectedOption.effectSnippet && <pre className="mt-2 bg-paper-dark border border-ink/20 p-2 font-mono text-[10px] whitespace-pre-wrap break-words max-h-40 overflow-y-auto">{selectedOption.effectSnippet}</pre>}
            </div>
          )}

          <div className="mt-5 border-t border-ink/30 pt-4">
            <div className="font-typewriter text-xs uppercase tracking-widest mb-2">{language === 'zh' ? '外部入口' : 'External Entries'}</div>
            <div className="flex flex-col gap-2">
              {externalEntries.map((entry) => (
                <div key={entry.id} className="bg-paper-dark border border-ink/25 p-2">
                  <div className="font-typewriter text-[9px] uppercase tracking-widest text-cnt-red">{externalKindLabel(entry.kind, language)}</div>
                  <div className="font-serif text-sm leading-snug">{pickLocalized(language, entry.title, entry.titleZh)}</div>
                </div>
              ))}
              {externalEntries.length === 0 && <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '未发现卡牌、顾问或日志直接指向此事件。' : 'No card, advisor, or journal entry points found for this event.'}</div>}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
};

const MetricBox: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="border border-ink/25 bg-paper-dark p-3">
    <div className="font-typewriter text-[9px] uppercase tracking-widest opacity-60">{label}</div>
    <div className="font-display text-2xl leading-none mt-1">{value}</div>
  </div>
);

const CouplingList: React.FC<{
  title: string;
  empty: string;
  couplings: FlowAnalysis['couplings'];
  flow: FlowAnalysis;
  language: EditorLanguage;
  direction: 'from' | 'to';
  onSelect: (id: string) => void;
}> = ({ title, empty, couplings, flow, language, direction, onSelect }) => (
  <div className="border-2 border-ink/30 bg-paper-dark p-4 min-h-72">
    <div className="font-typewriter text-xs uppercase tracking-widest mb-3">{title}</div>
    <div className="flex flex-col gap-2">
      {couplings.map((edge) => {
        const targetId = direction === 'to' ? edge.toEventId : edge.fromEventId;
        const event = flow.eventById.get(targetId);
        return (
          <button key={edge.id} onClick={() => onSelect(targetId)} className="bg-paper border border-ink/25 p-3 text-left hover:border-ink transition-colors">
            <div className="font-display text-lg uppercase leading-none line-clamp-2">{event ? getLocalizedFlowTitle(event, language) : targetId}</div>
            <div className="font-mono text-[10px] opacity-60 mt-1 truncate">{targetId}</div>
            <div className="mt-2 flex flex-wrap gap-1">
              {edge.fields.map((field) => <span key={field} className="border border-ink/25 px-1.5 py-0.5 font-mono text-[9px]">{field}</span>)}
            </div>
          </button>
        );
      })}
      {couplings.length === 0 && <div className="font-serif text-sm italic opacity-70">{empty}</div>}
    </div>
  </div>
);

const FieldEventList: React.FC<{
  title: string;
  eventIds: string[];
  flow: FlowAnalysis;
  language: EditorLanguage;
  onSelect: (id: string) => void;
}> = ({ title, eventIds, flow, language, onSelect }) => (
  <div className="bg-paper border border-ink/25 p-3">
    <div className="font-typewriter text-[10px] uppercase tracking-widest mb-2">{title}</div>
    <div className="flex flex-col gap-1 max-h-60 overflow-y-auto">
      {eventIds.map((eventId) => {
        const event = flow.eventById.get(eventId);
        return (
          <button key={eventId} onClick={() => onSelect(eventId)} className="text-left border border-ink/15 bg-paper-dark px-2 py-1.5 hover:border-ink transition-colors">
            <div className="font-serif text-sm leading-tight truncate">{event ? getLocalizedFlowTitle(event, language) : eventId}</div>
            <div className="font-mono text-[9px] opacity-60 truncate">{eventId}</div>
          </button>
        );
      })}
      {eventIds.length === 0 && <div className="font-serif text-sm italic opacity-70">{language === 'zh' ? '无事件。' : 'No events.'}</div>}
    </div>
  </div>
);
