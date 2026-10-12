import type { EconomyState, EconomicShock } from './model';
export interface EconomicModifiers { growthGraph: number; inflationGraph: number; budgetGraph: number; foreignExchangeGraph: number; consumptionTaxBaseFactor: number; unemployment: number }
const EMPTY_MODIFIERS: EconomicModifiers = { growthGraph: 0, inflationGraph: 0, budgetGraph: 0, foreignExchangeGraph: 0, consumptionTaxBaseFactor: 1, unemployment: 0 };
const EMPTY_IMPULSE = { growth: 0, inflation: 0, unemployment: 0, foreignExchangeMonthly: 0, goldMonthly: 0 };
export interface EconomicInputs extends EconomyState { warActive: boolean; policyCost: number; conditionalPolicyCost?: number; modifiers?: Partial<EconomicModifiers>; impulse?: EconomicShock; profile?: Record<string, unknown> }
type NumericProfile<T> = { [K in keyof T]: T[K] extends number ? number : NumericProfile<T[K]> };
export type EconomicProfile = NumericProfile<typeof ECONOMIC_RULES>;
export function economicProfile(overrides: Record<string, unknown> = {}): EconomicProfile {
  const merge = (base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> => Object.fromEntries(Object.entries(base).map(([key,value]) => [key, typeof value === 'number' ? (typeof patch[key] === 'number' ? patch[key] : value) : merge(value as Record<string,unknown>, (patch[key] ?? {}) as Record<string,unknown>)]));
  return merge(ECONOMIC_RULES, overrides) as EconomicProfile;
}

export interface EconomyBreakdown {
  isWar: boolean;
  taxRates: { lower: number; middle: number; upper: number; tariff: number; consumption: number };
  taxBaseFactors: {
    output: number;
    employment: number;
    purchasingPower: number;
    capitalConfidence: number;
    tradeVolume: number;
  };
  taxBases: {
    lowerIncome: number;
    middleIncome: number;
    upperIncome: number;
    tariff: number;
    consumption: number;
  };
  collectionEfficiency: { lower: number; middle: number; upper: number; tariff: number; consumption: number };
  revenue: { incomeTax: number; tariff: number; consumptionTax: number; total: number };
  expenditure: {
    civilAdministration: number;
    policies: number;
    warMobilization: number;
    military: number;
    debtInterest: number;
    conditionalPolicies: number;
    total: number;
  };

  budgetDelta: number;
  financing: {
    openingCash: number;
    openingArrears: number;
    cashUsedForDeficit: number;
    newBorrowing: number;
    newArrears: number;
    arrearsPaid: number;
    principalRepayment: number;
    cashRetained: number;
  };
  nextBudget: number;
  nextDebt: number;
  nextFiscalArrears: number;
  tradeFxYield: number;
  nextForeignExchange: number;
  armyLoyaltyFactor: number;
  nextArmyLoyalty: number;
  nextGrowth: number;
  nextInflation: number;
  nextUnemployment: number;
  nextEconomicOutputIndex: number;
  conditionalPolicyCost: number;
  conditionalPolicyPaused: boolean;

  reformGraphs: EconomicModifiers;
}

export const ECONOMIC_RULES = {
  defaults: {
    lowerTax: 5,
    middleTax: 15,
    upperTax: 25,
    tariff: 10,
    consumptionTax: 8,
    budget: 12,
    fiscalArrears: 0,
    debt: 500,
    foreignExchange: 180,
    growth: 2.5,
    inflation: 3.5,
    unemployment: 11.2,
    outputIndex: 100,
    goldReserves: 2200,
    militarySpending: 15,
    armyLoyalty: 50,
  },
  incomeWeights: { lower: 4, middle: 3.5, upper: 4.5, consumption: 8, peaceTariffBase: 5 },

  taxCapacity: {
    lower: { threshold: 0.25, slope: 1 },
    middle: { threshold: 0.35, slope: 1.2 },
    upper: { threshold: 0.5, slope: 1.5 },
    tariff: { threshold: 0.3, slope: 1.2 },
    consumption: { threshold: 0.25, slope: 1.4 },
  },
  indicatorInertia: { growth: 0.35, inflation: 0.3, unemployment: 0.2 },
  growthBounds: { min: -6, max: 15 },
  inflationBounds: { min: -5, max: 100 },
  outputBounds: { min: 40, max: 200 },
  fiscalBounds: { cashMax: 5000, debtMax: 5000, arrearsMax: 5000 },
  deflationUnemployment: { mildBelow: -0.5, mildDelta: 0.4, severeBelow: -5, severeDelta: 0.8 },

  militarySpendingBounds: { min: 5, max: 100 },
} as const;

const roundTo = (value: number, decimals: number): number => Number(value.toFixed(decimals));
const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));


export const adjustUnemploymentRate = (state: Pick<EconomicInputs, 'unemployment_rate'>, delta: number): number => {
  const current = Number.isFinite(state.unemployment_rate)
    ? state.unemployment_rate
    : ECONOMIC_RULES.defaults.unemployment;
  return roundTo(clamp(current + (Number.isFinite(delta) ? delta : 0), 0, 100), 2);
};


const getCollectionEfficiency = (rate: number, threshold: number, slope: number): number =>
  clamp(1 - Math.max(0, rate - threshold) * slope, 0.1, 1);


export const clampMilitarySpending = (value: number): number => {
  if (!Number.isFinite(value)) return ECONOMIC_RULES.defaults.militarySpending;
  return Math.max(
    ECONOMIC_RULES.militarySpendingBounds.min,
    Math.min(ECONOMIC_RULES.militarySpendingBounds.max, value),
  );
};

export const calculateMonthlyEconomy = (state: EconomicInputs): EconomyBreakdown => {
  const rules = economicProfile(state.profile);
  const taxRates = {
    lower: (state.tax_lower_class ?? rules.defaults.lowerTax) / 100,
    middle: (state.tax_middle_class ?? rules.defaults.middleTax) / 100,
    upper: (state.tax_upper_class ?? rules.defaults.upperTax) / 100,
    tariff: (state.tax_tariff ?? rules.defaults.tariff) / 100,
    consumption: (state.tax_consumption ?? rules.defaults.consumptionTax) / 100,
  };
  const isWar = state.warActive;
  const reformGraphs = { ...EMPTY_MODIFIERS, ...state.modifiers };
  const impulse = state.impulse ?? EMPTY_IMPULSE;
  const currentOutputIndex = state.economic_output_index ?? rules.defaults.outputIndex;
  const currentInflation = state.inflation_rate ?? rules.defaults.inflation;
  const currentUnemployment = state.unemployment_rate ?? rules.defaults.unemployment;
  const currentDebt = clamp(state.public_debt ?? rules.defaults.debt, 0, rules.fiscalBounds.debtMax);
  const currentArrears = clamp(state.fiscal_arrears ?? rules.defaults.fiscalArrears, 0, rules.fiscalBounds.arrearsMax);

  const output = clamp(currentOutputIndex / rules.defaults.outputIndex, 0.4, 2);
  const employment = clamp((100 - currentUnemployment) / (100 - rules.defaults.unemployment), 0.45, 1.15);
  const purchasingPower = clamp(
    1 - Math.max(0, currentInflation - rules.defaults.inflation) * 0.015
      + Math.max(0, rules.defaults.inflation - currentInflation) * 0.005,
    0.45,
    1.1,
  );
  const capitalConfidence = clamp(
    1 - Math.max(0, currentDebt - 1200) / 5000
      - currentArrears / 3000
      - Math.max(0, currentInflation - 8) * 0.01,
    0.4,
    1.1,
  );
  const tradeVolume = clamp(output * purchasingPower * capitalConfidence * (isWar ? 0.4 : 1), 0.15, 2);
  const taxBaseFactors = { output, employment, purchasingPower, capitalConfidence, tradeVolume };
  const taxBases = {
    lowerIncome: rules.incomeWeights.lower * output * employment,
    middleIncome: rules.incomeWeights.middle * output * (0.7 + 0.3 * employment),
    upperIncome: rules.incomeWeights.upper * output * capitalConfidence,
    tariff: rules.incomeWeights.peaceTariffBase * tradeVolume,
    consumption: rules.incomeWeights.consumption * output * employment * purchasingPower
      * reformGraphs.consumptionTaxBaseFactor,
  };
  const collectionEfficiency = {
    lower: getCollectionEfficiency(taxRates.lower, rules.taxCapacity.lower.threshold, rules.taxCapacity.lower.slope),
    middle: getCollectionEfficiency(taxRates.middle, rules.taxCapacity.middle.threshold, rules.taxCapacity.middle.slope),
    upper: getCollectionEfficiency(taxRates.upper, rules.taxCapacity.upper.threshold, rules.taxCapacity.upper.slope),
    tariff: getCollectionEfficiency(taxRates.tariff, rules.taxCapacity.tariff.threshold, rules.taxCapacity.tariff.slope),
    consumption: getCollectionEfficiency(taxRates.consumption, rules.taxCapacity.consumption.threshold, rules.taxCapacity.consumption.slope),
  };
  const incomeTax = taxRates.lower * taxBases.lowerIncome * collectionEfficiency.lower
    + taxRates.middle * taxBases.middleIncome * collectionEfficiency.middle
    + taxRates.upper * taxBases.upperIncome * collectionEfficiency.upper;
  const tariff = taxRates.tariff * taxBases.tariff * collectionEfficiency.tariff;
  const consumptionTax = taxRates.consumption * taxBases.consumption * collectionEfficiency.consumption;
  const totalRevenue = incomeTax + tariff + consumptionTax;

  const conditionalPolicyCost = state.conditionalPolicyCost ?? 0;
  const nonConditionalExpenditure = {
    civilAdministration: 1,
    policies: state.policyCost,
    warMobilization: isWar ? 3.5 : 0,
    military: ((state.military_spending ?? rules.defaults.militarySpending) / 100) * (isWar ? 8 : 3),
    debtInterest: currentDebt * ((isWar ? 0.05 : 0.02) / 12),
  };
  const nonConditionalTotal = Object.values(nonConditionalExpenditure).reduce((sum, value) => sum + value, 0);
  const plannedConditionalCost = conditionalPolicyCost;
  const openingCash = clamp(state.budget ?? rules.defaults.budget, 0, rules.fiscalBounds.cashMax);
  const conditionalPolicyPaused = plannedConditionalCost > 0
    && openingCash + totalRevenue < nonConditionalTotal + plannedConditionalCost;
  const expenditure = { ...nonConditionalExpenditure, conditionalPolicies: conditionalPolicyPaused ? 0 : plannedConditionalCost, total: 0 };
  expenditure.total = Object.entries(expenditure)
    .filter(([key]) => key !== 'total')
    .reduce((sum, [, value]) => sum + value, 0);

  const budgetDelta = totalRevenue - expenditure.total;
  let cashUsedForDeficit = 0;
  let newBorrowing = 0;
  let newArrears = 0;
  let arrearsPaid = 0;
  let principalRepayment = 0;
  let cashRetained = 0;
  let nextBudget = openingCash;
  let nextDebt = currentDebt;
  let nextFiscalArrears = currentArrears;
  if (budgetDelta < 0) {
    const financingNeed = Math.abs(budgetDelta);
    cashUsedForDeficit = Math.min(openingCash, financingNeed);
    const borrowingNeed = financingNeed - cashUsedForDeficit;
    newBorrowing = Math.min(borrowingNeed, rules.fiscalBounds.debtMax - currentDebt);
    newArrears = Math.max(0, borrowingNeed - newBorrowing);
    nextBudget = openingCash - cashUsedForDeficit;
    nextDebt = currentDebt + newBorrowing;
    nextFiscalArrears = clamp(currentArrears + newArrears, 0, rules.fiscalBounds.arrearsMax);
  } else {
    arrearsPaid = Math.min(budgetDelta, currentArrears);
    const surplusAfterArrears = budgetDelta - arrearsPaid;
    principalRepayment = Math.min(surplusAfterArrears * 0.4, currentDebt);
    cashRetained = surplusAfterArrears - principalRepayment;
    nextBudget = clamp(openingCash + cashRetained, 0, rules.fiscalBounds.cashMax);
    nextDebt = currentDebt - principalRepayment;
    nextFiscalArrears = currentArrears - arrearsPaid;
  }
  nextBudget = clamp(nextBudget + reformGraphs.budgetGraph, 0, rules.fiscalBounds.cashMax);
  nextBudget = roundTo(nextBudget, 2);
  nextDebt = roundTo(nextDebt, 2);
  nextFiscalArrears = roundTo(nextFiscalArrears, 2);
  const financing = {
    openingCash,
    openingArrears: currentArrears,
    cashUsedForDeficit: roundTo(cashUsedForDeficit, 2),
    newBorrowing: roundTo(newBorrowing, 2),
    newArrears: roundTo(newArrears, 2),
    arrearsPaid: roundTo(arrearsPaid, 2),
    principalRepayment: roundTo(principalRepayment, 2),
    cashRetained: roundTo(cashRetained, 2),
  };

  const tradeFxYield = ((state.economy_growth ?? rules.defaults.growth) - rules.defaults.growth) * 1.5
    - (currentInflation - rules.defaults.inflation) * 0.5
    + taxRates.tariff * 4
    + (tradeVolume - 1) * 2
    - (isWar ? 2.5 : 0)
    + reformGraphs.foreignExchangeGraph
    + impulse.foreignExchangeMonthly;
  const nextForeignExchange = roundTo(clamp((state.foreign_exchange ?? rules.defaults.foreignExchange) + tradeFxYield, 0, 2500), 2);
  const armyLoyaltyFactor = ((state.military_spending ?? rules.defaults.militarySpending) - rules.defaults.militarySpending) * 0.12;
  const nextArmyLoyalty = clamp((state.armyLoyalty ?? rules.defaults.armyLoyalty) + armyLoyaltyFactor, 0, 100);

  const currentGrowth = state.economy_growth ?? rules.defaults.growth;
  const { growth: growthInertia, inflation: inflationInertia, unemployment: unemploymentInertia } = rules.indicatorInertia;
  const { min: minGrowth, max: maxGrowth } = rules.growthBounds;
  const debtGrowthDrag = Math.max(0, (nextDebt - 1200) * 0.001);
  const arrearsGrowthDrag = nextFiscalArrears * 0.003;
  const targetGrowth = clamp(
    3.5 - taxRates.lower * 1.5 - taxRates.middle * 2 - taxRates.upper * 2.5
      - taxRates.tariff * 3 - taxRates.consumption * 3.5 - debtGrowthDrag
      - arrearsGrowthDrag - (isWar ? 6 : 0)
      + reformGraphs.growthGraph
      + impulse.growth,
    minGrowth,
    maxGrowth,
  );
  const nextGrowth = roundTo(clamp(currentGrowth + growthInertia * (targetGrowth - currentGrowth), minGrowth, maxGrowth), 2);

  const goldLossConfidence = Math.max(0, (700 - (state.gold_reserves ?? rules.defaults.goldReserves)) * 0.006);
  const financingInflation = newBorrowing * 0.5 + newArrears * 0.9;
  const targetInflation = clamp(
    2.5 - taxRates.lower - taxRates.middle * 1.5 - taxRates.upper * 2
      + taxRates.tariff * 8 + taxRates.consumption * 6 + financingInflation
      + goldLossConfidence + (isWar ? 8 : 0)
      + reformGraphs.inflationGraph
      + impulse.inflation,
    rules.inflationBounds.min,
    rules.inflationBounds.max,
  );
  const nextInflation = roundTo(clamp(
    currentInflation + inflationInertia * (targetInflation - currentInflation),
    rules.inflationBounds.min,
    rules.inflationBounds.max,
  ), 2);

  const { mildBelow, mildDelta, severeBelow, severeDelta } = rules.deflationUnemployment;
  const deflationUnemployment = currentInflation <= severeBelow ? severeDelta : currentInflation < mildBelow ? mildDelta : 0;
  const laborReformReduction = state.modifiers?.unemployment ?? 0;
  const highDebtUnemploymentFactor = nextDebt > 1500 ? 1 : 0;
  const arrearsUnemploymentFactor = Math.min(4, nextFiscalArrears * 0.005);
  const targetUnemployment = clamp(
    12 - (nextGrowth - 2.5) * 0.4 + taxRates.lower + taxRates.middle * 1.5
      + taxRates.upper * 3 - taxRates.tariff * 1.5 + laborReformReduction
      + highDebtUnemploymentFactor + arrearsUnemploymentFactor
      + deflationUnemployment + (isWar ? 4 : 0)
      + impulse.unemployment,
    0,
    100,
  );
  const nextUnemployment = roundTo(clamp(
    currentUnemployment + unemploymentInertia * (targetUnemployment - currentUnemployment),
    0,
    100,
  ), 2);
  const nextEconomicOutputIndex = roundTo(clamp(
    currentOutputIndex * (1 + nextGrowth / 100 / 12),
    rules.outputBounds.min,
    rules.outputBounds.max,
  ), 2);

  return {
    isWar,
    taxRates,
    taxBaseFactors,
    taxBases,
    collectionEfficiency,
    revenue: {
      incomeTax: roundTo(incomeTax, 4),
      tariff: roundTo(tariff, 4),
      consumptionTax: roundTo(consumptionTax, 4),
      total: roundTo(totalRevenue, 4),
    },
    expenditure,
    budgetDelta: roundTo(budgetDelta, 4),
    financing,
    nextBudget,
    nextDebt,
    nextFiscalArrears,
    tradeFxYield,
    nextForeignExchange,
    armyLoyaltyFactor,
    nextArmyLoyalty,
    nextGrowth,
    nextInflation,
    nextUnemployment,
    nextEconomicOutputIndex,
    conditionalPolicyCost,
    conditionalPolicyPaused,
    reformGraphs,
  };
};
