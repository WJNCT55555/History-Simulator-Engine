import type { EventCategory, EventFlow } from '../../src/game/types';
import { buildGeneratedEffect, type EffectDraftForCodegen } from './cardCodegen';

export interface EventOptionDraftForCodegen {
  text: string;
  textZh?: string;
  subtitle?: string;
  subtitleZh?: string;
  unavailableSubtitle?: string;
  unavailableSubtitleZh?: string;
  conditionSource?: string;
  hasCondition: boolean;
  effects: EffectDraftForCodegen[];
  targetEventIds: string[];
  endsFlow: boolean;
}

export interface EventDraftForCodegen {
  id: string;
  category: EventCategory;
  flow: EventFlow;
  series: string[];
  tags: string[];
  title: string;
  titleZh?: string;
  description: string;
  descriptionZh?: string;
  image?: string;
  year?: number;
  month?: number;
  conditionSource?: string;
  hasCondition: boolean;
  hasCustomRender: boolean;
  options: EventOptionDraftForCodegen[];
  sourcePath?: string;
  exportName?: string;
}

export interface EventCodegenSource {
  pathName: string;
  source: string;
}

export interface EventCodegenReference {
  id: string;
  exportName?: string;
  sourcePath?: string;
}

export interface EventCodegenResult {
  content: string;
  filename: string;
  suggestedPath: string;
  warnings: string[];
}

const quote = (value: string | undefined) => JSON.stringify(value ?? '');

const safeFilePart = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90) || 'generated_event';

const toIdentifier = (value: string) => {
  const normalized = value
    .replace(/[^A-Za-z0-9]+(.)?/g, (_match, next: string | undefined) => next ? next.toUpperCase() : '')
    .replace(/^[^A-Za-z_$]+/, '');
  return normalized || 'generatedEvent';
};

const isSnakeCase = (value: string) => /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/.test(value);

const callbackExpression = (source?: string) => {
  const trimmed = source?.trim();
  if (!trimmed) return undefined;
  const property = trimmed.match(/^condition\s*:\s*/);
  const expression = property ? trimmed.slice(property[0].length).trim() : trimmed;
  return expression.replace(/,\s*$/, '').trim() || undefined;
};

const eventModulePath = (sourcePath?: string) => {
  if (!sourcePath) return undefined;
  const normalized = sourcePath.replace(/\\/g, '/');
  const marker = '/src/game/events/';
  const markerIndex = normalized.lastIndexOf(marker);
  if (markerIndex < 0) return undefined;
  return `./${normalized.slice(markerIndex + marker.length).replace(/\.(tsx|ts)$/, '')}`;
};

const staticMeta = (event: EventDraftForCodegen) => {
  const fields = [
    `    category: ${quote(event.category)},`,
    `    flow: ${quote(event.flow)},`,
    event.series.length > 0 ? `    series: ${JSON.stringify(event.series)},` : '',
    event.tags.length > 0 ? `    tags: ${JSON.stringify(event.tags)},` : '',
  ].filter(Boolean);
  return ['  meta: {', ...fields, '  },'];
};

const skipQuoted = (source: string, start: number, quoteChar: string) => {
  for (let index = start + 1; index < source.length; index += 1) {
    if (source[index] === '\\') {
      index += 1;
      continue;
    }
    if (source[index] === quoteChar) return index + 1;
  }
  return source.length;
};

const findMatchingBrace = (source: string, start: number) => {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    if (source[index] === '/' && source[index + 1] === '/') {
      const end = source.indexOf('\n', index + 2);
      index = end < 0 ? source.length : end;
      continue;
    }
    if (source[index] === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index + 2);
      index = end < 0 ? source.length : end + 1;
      continue;
    }
    if (source[index] === '"' || source[index] === "'" || source[index] === '`') {
      index = skipQuoted(source, index, source[index]) - 1;
      continue;
    }
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
};

const patchLiteralProperty = (objectSource: string, key: string, value: string) => {
  const property = new RegExp(`(\\n\\s*${key}\\s*:\\s*)([^\\n]+)`);
  return objectSource.replace(property, `$1${value},`);
};

const patchSourceEvent = (
  source: EventCodegenSource,
  event: EventDraftForCodegen,
  warnings: string[],
) => {
  if (!event.exportName) return undefined;
  const declaration = new RegExp(`export\\s+const\\s+${event.exportName}\\b[\\s\\S]*?=\\s*\\{`).exec(source.source);
  if (!declaration || declaration.index === undefined) return undefined;
  const objectStart = declaration.index + declaration[0].lastIndexOf('{');
  const objectEnd = findMatchingBrace(source.source, objectStart);
  if (objectEnd < 0) return undefined;

  let objectSource = source.source.slice(objectStart, objectEnd + 1);
  objectSource = patchLiteralProperty(objectSource, 'id', quote(event.id));
  objectSource = patchLiteralProperty(objectSource, 'title', quote(event.title));
  if (event.titleZh) objectSource = patchLiteralProperty(objectSource, 'titleZh', quote(event.titleZh));
  objectSource = patchLiteralProperty(objectSource, 'description', quote(event.description));
  if (event.descriptionZh) objectSource = patchLiteralProperty(objectSource, 'descriptionZh', quote(event.descriptionZh));
  if (event.image) objectSource = patchLiteralProperty(objectSource, 'image', quote(event.image));

  const metadata = staticMeta(event).join('\n');
  if (/\n\s*meta\s*:/.test(objectSource)) {
    objectSource = objectSource.replace(/\n\s*meta\s*:\s*[^\n]+/, `\n${metadata}`);
  } else {
    objectSource = objectSource.replace(/^\{/, `{\n${metadata}`);
  }

  if (event.year !== undefined && event.month !== undefined) {
    const dateValue = `{ year: ${event.year}, month: ${event.month} }`;
    if (/\n\s*date\s*:/.test(objectSource)) objectSource = patchLiteralProperty(objectSource, 'date', dateValue);
    else objectSource = objectSource.replace(/^\{/, `{\n  date: ${dateValue},`);
  }

  if (event.conditionSource) warnings.push('Existing event condition/effect scripts were preserved; conditionSource edits are not injected into an existing source copy.');
  if (event.options.some((option) => option.conditionSource || option.effects.length > 0 || option.targetEventIds.length > 0)) {
    warnings.push('Existing event option text, conditions, effects, and transitions were preserved; draft option edits require the generated template or manual merge.');
  }
  if (event.hasCustomRender) warnings.push('Custom renderContent was preserved; the editor does not generate custom React rendering.');

  return `${source.source.slice(0, objectStart)}${objectSource}${source.source.slice(objectEnd + 1)}`;
};

const buildTransition = (
  option: EventOptionDraftForCodegen,
  references: Map<string, EventCodegenReference>,
  warnings: string[],
) => {
  const imports = new Map<string, string>();
  const variables: string[] = [];
  option.targetEventIds.forEach((targetId) => {
    const reference = references.get(targetId);
    const modulePath = eventModulePath(reference?.sourcePath);
    if (!reference?.exportName || !modulePath) {
      warnings.push(`Event option target ${targetId} could not be resolved to an export; transition was left for manual completion.`);
      return;
    }
    const variable = toIdentifier(reference.exportName);
    imports.set(`${variable}|${modulePath}`, `import { ${reference.exportName} } from '${modulePath}';`);
    variables.push(variable);
  });

  const returnFields = variables.length === 1
    ? ['      currentEvent: ' + variables[0] + ',']
    : variables.length > 1
      ? [`      pendingEvents: [${variables.join(', ')}],`]
      : option.endsFlow
        ? ['      currentEvent: null,']
        : [];
  if (option.targetEventIds.length === 0 && !option.endsFlow) warnings.push('Event option has no explicit successor and is not marked as a leaf; verify its chain transition manually.');
  return { imports, returnFields };
};

const buildTemplateEvent = (
  event: EventDraftForCodegen,
  exportName: string,
  references: Map<string, EventCodegenReference>,
  warnings: string[],
) => {
  if (!isSnakeCase(event.id)) warnings.push(`Event id ${event.id} is not snake_case.`);
  if (event.hasCondition && !callbackExpression(event.conditionSource)) warnings.push('Event is marked conditional but has no executable condition source.');
  if (event.hasCustomRender) warnings.push('Custom renderContent is not generated; add it manually if required.');
  if (event.year !== undefined && event.month === undefined || event.year === undefined && event.month !== undefined) warnings.push('Event date is incomplete; both year and month are required for generated date metadata.');

  const imports = new Map<string, string>();
  const optionBodies = event.options.map((option, index) => {
    const transition = buildTransition(option, references, warnings);
    transition.imports.forEach((value, key) => imports.set(key, value));
    const generatedEffect = buildGeneratedEffect({ effects: option.effects || [] }, warnings, { extraReturnFields: transition.returnFields });
    generatedEffect.imports.forEach((name) => imports.set(`helper:${name}`, `import { ${name} } from '../utils';`));
    if (option.effects.length === 0 && transition.returnFields.length === 0) warnings.push(`Option ${index + 1} has no generated effect or transition.`);
    const condition = option.hasCondition ? callbackExpression(option.conditionSource) : undefined;
    if (option.hasCondition && !condition) warnings.push(`Option ${index + 1} is marked conditional but has no executable condition source.`);
    const lines = [
      '    {',
      `      text: ${quote(option.text)},`,
      `      textZh: ${quote(option.textZh)},`,
      `      subtitle: ${quote(option.subtitle)},`,
      `      subtitleZh: ${quote(option.subtitleZh)},`,
      condition ? `      condition: ${condition},` : '',
      option.unavailableSubtitle ? `      unavailableSubtitle: () => ${quote(option.unavailableSubtitle)},` : '',
      option.unavailableSubtitleZh ? `      unavailableSubtitleZh: () => ${quote(option.unavailableSubtitleZh)},` : '',
      ...generatedEffect.body.split('\n').map((line) => `    ${line}`),
      '    },',
    ].filter(Boolean);
    return lines.join('\n');
  });

  const condition = event.hasCondition ? callbackExpression(event.conditionSource) : undefined;
  const fields = [
    `  id: ${quote(event.id)},`,
    ...staticMeta(event),
    event.year !== undefined && event.month !== undefined ? `  date: { year: ${event.year}, month: ${event.month} },` : '',
    condition ? `  condition: ${condition},` : '',
    `  title: ${quote(event.title)},`,
    `  titleZh: ${quote(event.titleZh)},`,
    `  description: ${quote(event.description)},`,
    `  descriptionZh: ${quote(event.descriptionZh)},`,
    event.image ? `  image: ${quote(event.image)},` : '',
    '  options: [',
    optionBodies.join('\n'),
    '  ],',
  ].filter(Boolean);
  const helperImports = Array.from(imports.values()).sort();
  return [
    '// Generated by the CNT-FAI event editor. Review conditions, effects, and registry membership before activation.',
    "import type { GameEvent, GameState } from '../types';",
    ...helperImports,
    '',
    `export const ${exportName}: GameEvent = {`,
    ...fields,
    '};',
    '',
  ].join('\n');
};

export const buildEventTypeScript = (
  event: EventDraftForCodegen,
  source: EventCodegenSource | undefined,
  references: EventCodegenReference[] = [],
): EventCodegenResult => {
  const warnings: string[] = [];
  const referenceMap = new Map(references.map((reference) => [reference.id, reference]));
  const exportName = event.exportName || toIdentifier(event.id);
  const safeId = safeFilePart(event.id);
  const sourceExtension = source?.pathName.endsWith('.tsx') ? '.tsx' : '.ts';

  if (source && event.exportName) {
    const patched = patchSourceEvent(source, event, warnings);
    if (patched) {
      const sourceBase = source.pathName.split(/[\\/]/).pop()?.replace(/\.(tsx|ts)$/, '') || 'event';
      const filename = `${safeFilePart(sourceBase)}.${safeId}.generated${sourceExtension}`;
      return {
        content: `// Generated copy. Existing event scripts and options were preserved; review the warnings before merging.\n${patched}`,
        filename,
        suggestedPath: `src/game/events/${filename}`,
        warnings,
      };
    }
    warnings.push('Could not locate the original GameEvent object; generated a standalone template instead.');
  }

  return {
    content: buildTemplateEvent(event, exportName, referenceMap, warnings),
    filename: `${safeId}.generated.ts`,
    suggestedPath: `src/game/events/${safeId}.generated.ts`,
    warnings,
  };
};
