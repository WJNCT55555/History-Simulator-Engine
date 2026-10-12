export type GeneratedCardType = 'Action' | 'Government' | 'Military';

export interface EffectDraftForCodegen {
  target: string;
  value: number;
}

export interface CardDraftForCodegen {
  id: string;
  title: string;
  titleZh?: string;
  type: GeneratedCardType;
  description: string;
  descriptionZh?: string;
  cost: number;
  resourceCost?: number;
  armamentCost?: number;
  conditionSource?: string;
  unavailableSubtitle?: string;
  unavailableSubtitleZh?: string;
  cooldown?: number;
  timer?: number;
  eventTransition?: {
    currentEventTargets: string[];
    pendingEventTargets: string[];
    dynamic: boolean;
  };
  hasCondition: boolean;
  hasScriptedEffect: boolean;
  effects: EffectDraftForCodegen[];
  sourcePath?: string;
  exportName?: string;
}

export interface CardCodegenSource {
  pathName: string;
  source: string;
}

export interface CardCodegenResult {
  content: string;
  filename: string;
  family: 'action_affairs' | 'government_affairs' | 'military_affairs';
  suggestedPath: string;
  warnings: string[];
}

const familyDirectory: Record<GeneratedCardType, CardCodegenResult['family']> = {
  Action: 'action_affairs',
  Government: 'government_affairs',
  Military: 'military_affairs',
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const safeFilePart = (value: string) =>
  value
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 90) || 'generated_card';

const toIdentifier = (value: string) => {
  const normalized = value
    .replace(/[^A-Za-z0-9]+(.)?/g, (_match, next: string | undefined) => next ? next.toUpperCase() : '')
    .replace(/^[^A-Za-z_$]+/, '');
  return normalized || 'generatedCard';
};

const quote = (value: string | undefined) => JSON.stringify(value ?? '');

const conditionExpression = (source?: string) => {
  const trimmed = source?.trim();
  if (!trimmed) return undefined;
  const property = trimmed.match(/^condition\s*:\s*/);
  const expression = property ? trimmed.slice(property[0].length).trim() : trimmed;
  return expression.replace(/,\s*$/, '').trim() || undefined;
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

const skipLexicalToken = (source: string, start: number) => {
  if (source.startsWith('//', start)) {
    const end = source.indexOf('\n', start + 2);
    return end < 0 ? source.length : end;
  }
  if (source.startsWith('/*', start)) {
    const end = source.indexOf('*/', start + 2);
    return end < 0 ? source.length : end + 2;
  }
  const char = source[start];
  if (char === "'" || char === '"' || char === '`') return skipQuoted(source, start, char);
  return -1;
};

const findMatchingBrace = (source: string, start: number) => {
  let depth = 0;
  for (let index = start; index < source.length; index += 1) {
    const skipped = skipLexicalToken(source, index);
    if (skipped >= 0) {
      index = skipped - 1;
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

interface TopLevelProperty {
  keyStart: number;
  valueStart: number;
  valueEnd: number;
  commaIndex: number;
}

const findTopLevelProperty = (objectSource: string, key: string): TopLevelProperty | undefined => {
  const keyPattern = new RegExp(`^${escapeRegExp(key)}\\s*:`);
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenDepth = 0;

  for (let index = 0; index < objectSource.length; index += 1) {
    const skipped = skipLexicalToken(objectSource, index);
    if (skipped >= 0) {
      index = skipped - 1;
      continue;
    }

    const char = objectSource[index];
    if (char === '{') braceDepth += 1;
    if (char === '}') braceDepth -= 1;
    if (char === '[') bracketDepth += 1;
    if (char === ']') bracketDepth -= 1;
    if (char === '(') parenDepth += 1;
    if (char === ')') parenDepth -= 1;

    if (braceDepth !== 1 || bracketDepth !== 0 || parenDepth !== 0) continue;
    const match = objectSource.slice(index).match(keyPattern);
    if (!match) continue;

    const valueStart = index + match[0].length;
    let localBrace = 0;
    let localBracket = 0;
    let localParen = 0;
    for (let valueIndex = valueStart; valueIndex < objectSource.length; valueIndex += 1) {
      const valueSkipped = skipLexicalToken(objectSource, valueIndex);
      if (valueSkipped >= 0) {
        valueIndex = valueSkipped - 1;
        continue;
      }
      const valueChar = objectSource[valueIndex];
      if (valueChar === '{') localBrace += 1;
      if (valueChar === '}') {
        if (localBrace === 0 && localBracket === 0 && localParen === 0) {
          return { keyStart: index, valueStart, valueEnd: valueIndex, commaIndex: -1 };
        }
        localBrace -= 1;
      }
      if (valueChar === '[') localBracket += 1;
      if (valueChar === ']') localBracket -= 1;
      if (valueChar === '(') localParen += 1;
      if (valueChar === ')') localParen -= 1;
      if (valueChar === ',' && localBrace === 0 && localBracket === 0 && localParen === 0) {
        return { keyStart: index, valueStart, valueEnd: valueIndex, commaIndex: valueIndex };
      }
    }
  }
  return undefined;
};

const replaceTopLevelProperty = (objectSource: string, key: string, value: string | undefined) => {
  const property = findTopLevelProperty(objectSource, key);
  if (!property) return objectSource;
  if (value !== undefined) {
    return `${objectSource.slice(0, property.valueStart)} ${value}${objectSource.slice(property.valueEnd)}`;
  }

  const lineStart = objectSource.lastIndexOf('\n', property.keyStart - 1) + 1;
  const indentation = objectSource.slice(lineStart, property.keyStart);
  const removeStart = indentation.trim() ? property.keyStart : lineStart;
  let removeEnd = property.commaIndex >= 0 ? property.commaIndex + 1 : property.valueEnd;
  if (objectSource[removeEnd] === '\r') removeEnd += 1;
  if (objectSource[removeEnd] === '\n') removeEnd += 1;
  return `${objectSource.slice(0, removeStart)}${objectSource.slice(removeEnd)}`;
};

const insertTopLevelProperty = (objectSource: string, key: string, value: string) => {
  if (findTopLevelProperty(objectSource, key)) return objectSource;
  const anchor = findTopLevelProperty(objectSource, 'condition') || findTopLevelProperty(objectSource, 'effect');
  if (!anchor) {
    const closeIndex = objectSource.lastIndexOf('}');
    return `${objectSource.slice(0, closeIndex)}  ${key}: ${value},\n${objectSource.slice(closeIndex)}`;
  }
  const lineStart = objectSource.lastIndexOf('\n', anchor.keyStart - 1) + 1;
  const indentation = objectSource.slice(lineStart, anchor.keyStart).match(/^\s*/)?.[0] || '  ';
  return `${objectSource.slice(0, lineStart)}${indentation}${key}: ${value},\n${objectSource.slice(lineStart)}`;
};

const setCardProperty = (objectSource: string, key: string, value: string | undefined) => {
  if (findTopLevelProperty(objectSource, key)) return replaceTopLevelProperty(objectSource, key, value);
  return value === undefined ? objectSource : insertTopLevelProperty(objectSource, key, value);
};

const patchSourceCard = (source: string, exportName: string, card: CardDraftForCodegen) => {
  const declaration = new RegExp(`export\\s+const\\s+${escapeRegExp(exportName)}\\b[\\s\\S]*?=\\s*\\{`).exec(source);
  if (!declaration || declaration.index === undefined) return undefined;
  const objectStart = declaration.index + declaration[0].lastIndexOf('{');
  const objectEnd = findMatchingBrace(source, objectStart);
  if (objectEnd < 0) return undefined;

  let objectSource = source.slice(objectStart, objectEnd + 1);
  const fields: Array<[string, string | undefined]> = [
    ['id', quote(card.id)],
    ['title', quote(card.title)],
    ['titleZh', card.titleZh ? quote(card.titleZh) : undefined],
    ['type', quote(card.type)],
    ['description', quote(card.description)],
    ['descriptionZh', card.descriptionZh ? quote(card.descriptionZh) : undefined],
    ['cost', String(Number.isFinite(card.cost) ? card.cost : 0)],
    ['resourceCost', card.resourceCost === undefined ? undefined : String(card.resourceCost)],
    ['armamentCost', card.armamentCost === undefined ? undefined : String(card.armamentCost)],
  ];
  for (const [key, value] of fields) objectSource = setCardProperty(objectSource, key, value);
  return `${source.slice(0, objectStart)}${objectSource}${source.slice(objectEnd + 1)}`;
};

const addDelta = (deltas: Map<string, number>, target: string, value: number) => {
  deltas.set(target, (deltas.get(target) || 0) + value);
};

export const buildGeneratedEffect = (
  card: Pick<CardDraftForCodegen, 'effects'>,
  warnings: string[],
  options: { extraReturnFields?: string[] } = {},
) => {
  const directDeltas = new Map<string, number>();
  const statsDeltas = new Map<string, number>();
  const factionCalls: string[] = [];
  const classCalls: string[] = [];
  const relationDeltas = new Map<string, number>();
  const partyRelationDeltas = new Map<string, number>();
  const domesticPolicyDeltas = new Map<string, number>();
  const armedForceDeltas = new Map<string, number>();
  const imports = new Set<string>();

  for (const effect of card.effects || []) {
    const value = Number(effect.value);
    if (!Number.isFinite(value)) {
      warnings.push(`跳过无效数值效果：${effect.target}`);
      continue;
    }
    const statsMatch = effect.target.match(/^stats\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (statsMatch) {
      const validStats = new Set([
        'armyLoyalty',
        'tension',
        'workerControl',
        'anarchistMilitia',
        'republicanAuthority',
        'revolutionaryFervor',
        'bureaucratization',
      ]);
      if (!validStats.has(statsMatch[1])) {
        warnings.push(`目标 ${effect.target} 不存在于 GameState.stats，已跳过。`);
      } else {
        addDelta(statsDeltas, statsMatch[1], value);
      }
      continue;
    }

    if (/^(resources|armaments|leverage|coupProgress|economy_growth|internationalBrigades)$/.test(effect.target)) {
      addDelta(directDeltas, effect.target, value);
      continue;
    }

    const factionMatch = effect.target.match(/^factions\.([A-Za-z_$][A-Za-z0-9_$]*)\.(influence|dissent)$/);
    if (factionMatch) {
      imports.add(factionMatch[2] === 'influence' ? 'adjustFactionInfluence' : 'adjustFactionDissent');
      const helper = factionMatch[2] === 'influence' ? 'adjustFactionInfluence' : 'adjustFactionDissent';
      factionCalls.push(`    nextFactions = ${helper}(nextFactions, '${factionMatch[1]}', ${value});`);
      continue;
    }

    const classMatch = effect.target.match(/^classes\.([A-Za-z_$][A-Za-z0-9_$]*)\.support\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (classMatch) {
      imports.add('adjustClassSupport');
      classCalls.push(`    nextClasses = adjustClassSupport(nextClasses, '${classMatch[1]}', '${classMatch[2]}', ${value});`);
      continue;
    }

    const relationMatch = effect.target.match(/^relations\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (relationMatch) {
      addDelta(relationDeltas, relationMatch[1], value);
      continue;
    }

    const partyRelationMatch = effect.target.match(/^partyRelations\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (partyRelationMatch) {
      addDelta(partyRelationDeltas, partyRelationMatch[1], value);
      continue;
    }

    const domesticPolicyMatch = effect.target.match(/^domesticPolicy\.([A-Za-z_$][A-Za-z0-9_$]*)$/);
    if (domesticPolicyMatch) {
      addDelta(domesticPolicyDeltas, domesticPolicyMatch[1], value);
      continue;
    }

    const armedForceMatch = effect.target.match(/^armedForces\.([A-Za-z_$][A-Za-z0-9_$]*)\.loyalty$/);
    if (armedForceMatch) {
      addDelta(armedForceDeltas, armedForceMatch[1], value);
      continue;
    }

    warnings.push(`目标 ${effect.target} 尚未接入 TypeScript 生成器，已跳过。`);
  }

  const lines: string[] = [];
  if (factionCalls.length > 0) {
    lines.push('    let nextFactions = state.factions;', ...factionCalls);
  }
  if (classCalls.length > 0) {
    lines.push('    let nextClasses = state.classes;', ...classCalls);
  }
  if (statsDeltas.size > 0) {
    lines.push('    let nextStats = state.stats;');
    for (const [field, delta] of statsDeltas) {
      lines.push(`    nextStats = { ...nextStats, ${field}: Math.max(0, Math.min(100, nextStats.${field} + ${delta})) };`);
    }
  }
  if (relationDeltas.size > 0) {
    lines.push('    let nextRelations = state.relations;');
    for (const [field, delta] of relationDeltas) {
      lines.push(`    nextRelations = { ...nextRelations, ${field}: Math.max(-100, Math.min(100, nextRelations.${field} + ${delta})) };`);
    }
  }
  if (partyRelationDeltas.size > 0) {
    lines.push('    let nextPartyRelations = state.partyRelations;');
    for (const [field, delta] of partyRelationDeltas) {
      lines.push(`    nextPartyRelations = { ...nextPartyRelations, ${field}: Math.max(-100, Math.min(100, nextPartyRelations.${field} + ${delta})) };`);
    }
  }
  if (domesticPolicyDeltas.size > 0) {
    lines.push('    let nextDomesticPolicy = state.domesticPolicy;');
    for (const [field, delta] of domesticPolicyDeltas) {
      lines.push(`    nextDomesticPolicy = { ...nextDomesticPolicy, ${field}: Math.max(0, Math.min(100, nextDomesticPolicy.${field} + ${delta})) };`);
    }
  }
  if (armedForceDeltas.size > 0) {
    lines.push('    let nextArmedForces = state.armedForces;');
    for (const [field, delta] of armedForceDeltas) {
      lines.push(`    nextArmedForces = { ...nextArmedForces, ${field}: { ...nextArmedForces.${field}, loyalty: Math.max(0, Math.min(100, nextArmedForces.${field}.loyalty + ${delta})) } };`);
    }
  }

  const returnedFields: string[] = [];
  for (const [field, delta] of directDeltas) {
    const expression = field === 'coupProgress'
      ? `Math.max(0, Math.min(100, state.${field} + ${delta}))`
      : `Math.max(0, state.${field} + ${delta})`;
    returnedFields.push(`      ${field}: ${expression},`);
  }
  if (factionCalls.length > 0) returnedFields.push('      factions: nextFactions,');
  if (classCalls.length > 0) returnedFields.push('      classes: nextClasses,');
  if (statsDeltas.size > 0) returnedFields.push('      stats: nextStats,');
  if (relationDeltas.size > 0) returnedFields.push('      relations: nextRelations,');
  if (partyRelationDeltas.size > 0) returnedFields.push('      partyRelations: nextPartyRelations,');
  if (domesticPolicyDeltas.size > 0) returnedFields.push('      domesticPolicy: nextDomesticPolicy,');
  if (armedForceDeltas.size > 0) returnedFields.push('      armedForces: nextArmedForces,');
  returnedFields.push(...(options.extraReturnFields || []));

  if (returnedFields.length === 0) returnedFields.push('      // No supported preset effects were selected.');
  return {
    imports,
    body: [
      '  effect: (state: GameState): Partial<GameState> => {',
      ...lines,
      '    return {',
      ...returnedFields,
      '    };',
      '  },',
    ].join('\n'),
  };
};

const buildTemplateCard = (card: CardDraftForCodegen, exportName: string, warnings: string[]) => {
  const conditionSource = conditionExpression(card.conditionSource);
  if (card.hasCondition && !conditionSource) warnings.push('新卡牌没有可执行的条件表达式，已省略 condition；请在生成文件中补充。');
  if (card.unavailableSubtitle || card.unavailableSubtitleZh) {
    warnings.push('Card 没有顶层 unavailableSubtitle 运行时字段；相关文字已保留在草稿中但未写入 Card 对象。');
  }
  if (card.cooldown !== undefined || card.timer !== undefined) {
    warnings.push('Card 的 cooldown/timer 需要映射到具体类别的 GameState 计时字段；当前生成器未猜测运行时字段。');
  }
  if (card.eventTransition && (card.eventTransition.currentEventTargets.length > 0 || card.eventTransition.pendingEventTargets.length > 0 || card.eventTransition.dynamic)) {
    warnings.push('Card 的事件转移仍由原始 effect 脚本负责；草稿中的目标信息暂未自动注入。');
  }
  const effect = buildGeneratedEffect(card, warnings);
  const helperImports = Array.from(effect.imports).sort();
  const imports = [
    "import type { Card, GameState } from '../types';",
    helperImports.length > 0 ? `import { ${helperImports.join(', ')} } from '../utils';` : '',
  ].filter(Boolean);
  const fields = [
    `  id: ${quote(card.id)},`,
    `  title: ${quote(card.title)},`,
    card.titleZh ? `  titleZh: ${quote(card.titleZh)},` : '',
    `  type: ${quote(card.type)},`,
    `  description: ${quote(card.description)},`,
    card.descriptionZh ? `  descriptionZh: ${quote(card.descriptionZh)},` : '',
    `  cost: ${Number.isFinite(card.cost) ? card.cost : 0},`,
    card.resourceCost === undefined ? '' : `  resourceCost: ${card.resourceCost},`,
    card.armamentCost === undefined ? '' : `  armamentCost: ${card.armamentCost},`,
    conditionSource ? `  condition: ${conditionSource.replace(/,$/, '')},` : '',
  ].filter(Boolean);
  return [
    '// Generated by the CNT-FAI card editor. Add this export to the appropriate card index to activate it.',
    ...imports,
    '',
    `export const ${exportName}: Card = {`,
    ...fields,
    effect.body,
    '};',
    '',
  ].join('\n');
};

export const buildCardTypeScript = (
  card: CardDraftForCodegen,
  source?: CardCodegenSource,
): CardCodegenResult => {
  const family = familyDirectory[card.type];
  const exportName = card.exportName || toIdentifier(card.id);
  const warnings: string[] = [];
  const sourceExtension = source?.pathName.endsWith('.tsx') ? '.tsx' : '.ts';
  const safeId = safeFilePart(card.id);

  if (source && card.exportName) {
    const patched = patchSourceCard(source.source, card.exportName, card);
    if (patched) {
      if (card.effects.length > 0) {
        warnings.push('该卡牌已有手写 effect；编辑器中的预设效果不会自动注入，原始脚本会完整保留。');
      }
      if (card.conditionSource) {
        warnings.push('该卡牌已有手写 condition；编辑器中的 conditionSource 不会自动覆盖原始脚本。');
      }
      if (card.unavailableSubtitle || card.unavailableSubtitleZh) {
        warnings.push('Card 没有顶层 unavailableSubtitle 运行时字段；相关文字保留在草稿中，需放入具体事件选项。');
      }
      if (card.cooldown !== undefined || card.timer !== undefined || card.eventTransition?.dynamic) {
        warnings.push('该卡牌的计时/事件转移草稿不会覆盖原始 effect；请在手写脚本中审阅。');
      }
      const sourceBase = source.pathName.split(/[\\/]/).pop()?.replace(/\.(tsx|ts)$/, '') || 'card';
      const filename = `${safeFilePart(sourceBase)}.${safeId}.generated${sourceExtension}`;
      return {
        content: `// Generated copy. The original condition/effect script is preserved; only editable scalar fields were patched.\n${patched}`,
        filename,
        family,
        suggestedPath: `src/game/${family}/${filename}`,
        warnings,
      };
    }
    warnings.push('未能定位原始 Card 对象，已回退到模板生成；原始 condition/effect 不会被带入。');
  }

  const filename = `${safeId}.generated.ts`;
  return {
    content: buildTemplateCard(card, exportName, warnings),
    filename,
    family,
    suggestedPath: `src/game/${family}/${filename}`,
    warnings,
  };
};
