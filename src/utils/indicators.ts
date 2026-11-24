import { Candle, CompositeBias, IndicatorReading, SignalBias, TechnicalSummary } from '../types/market';

export function calculateSMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) {
      sum -= values[i - period];
    }
    if (i >= period - 1) {
      result[i] = sum / period;
    }
  }
  return result;
}

export function calculateEMA(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length < period) return result;
  const k = 2 / (period + 1);
  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += values[i];
  }
  let ema = sum / period;
  result[period - 1] = ema;
  for (let i = period; i < values.length; i++) {
    ema = values[i] * k + ema * (1 - k);
    result[i] = ema;
  }
  return result;
}

export interface BollingerPoint {
  upper: number | null;
  middle: number | null;
  lower: number | null;
}

export function calculateBollingerBands(
  values: number[],
  period = 20,
  multiplier = 2
): BollingerPoint[] {
  const sma = calculateSMA(values, period);
  return values.map((_, idx) => {
    const mid = sma[idx];
    if (mid === null || idx < period - 1) {
      return { upper: null, middle: null, lower: null };
    }
    let variance = 0;
    for (let j = idx - period + 1; j <= idx; j++) {
      const diff = values[j] - mid;
      variance += diff * diff;
    }
    const stdDev = Math.sqrt(variance / period);
    return {
      upper: mid + multiplier * stdDev,
      middle: mid,
      lower: mid - multiplier * stdDev,
    };
  });
}

export function calculateVWAP(candles: Candle[]): (number | null)[] {
  let cumulativeTPV = 0;
  let cumulativeVolume = 0;
  return candles.map((c) => {
    const typicalPrice = (c.high + c.low + c.close) / 3;
    cumulativeTPV += typicalPrice * c.volume;
    cumulativeVolume += c.volume;
    return cumulativeVolume > 0 ? cumulativeTPV / cumulativeVolume : c.close;
  });
}

export function calculateRSI(values: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(values.length).fill(null);
  if (values.length <= period) return result;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const delta = values[i] - values[i - 1];
    if (delta >= 0) gainSum += delta;
    else lossSum += -delta;
  }

  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;

  const firstRS = avgLoss === 0 ? 100 : avgGain / avgLoss;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + firstRS);

  for (let i = period + 1; i < values.length; i++) {
    const delta = values[i] - values[i - 1];
    const gain = delta > 0 ? delta : 0;
    const loss = delta < 0 ? -delta : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    if (avgLoss === 0) {
      result[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      result[i] = 100 - 100 / (1 + rs);
    }
  }
  return result;
}

export interface MACDPoint {
  macd: number | null;
  signal: number | null;
  histogram: number | null;
}

export function calculateMACD(
  values: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9
): MACDPoint[] {
  const fastEma = calculateEMA(values, fastPeriod);
  const slowEma = calculateEMA(values, slowPeriod);
  const macdLine: (number | null)[] = values.map((_, i) => {
    const f = fastEma[i];
    const s = slowEma[i];
    return f !== null && s !== null ? f - s : null;
  });

  const validMacdIndices: number[] = [];
  const validMacdValues: number[] = [];
  macdLine.forEach((v, idx) => {
    if (v !== null) {
      validMacdIndices.push(idx);
      validMacdValues.push(v);
    }
  });

  const signalEmaValid = calculateEMA(validMacdValues, signalPeriod);
  const signalLine: (number | null)[] = new Array(values.length).fill(null);
  signalEmaValid.forEach((val, idx) => {
    signalLine[validMacdIndices[idx]] = val;
  });

  return values.map((_, i) => {
    const m = macdLine[i];
    const s = signalLine[i];
    return {
      macd: m,
      signal: s,
      histogram: m !== null && s !== null ? m - s : null,
    };
  });
}

export function calculateATR(candles: Candle[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return result;
  const trs: number[] = [candles[0].high - candles[0].low];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    trs.push(tr);
  }
  let atr = trs.slice(1, period + 1).reduce((a, b) => a + b, 0) / period;
  result[period] = atr;
  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
    result[i] = atr;
  }
  return result;
}

export function calculateStochastic(
  candles: Candle[],
  kPeriod = 14,
  dPeriod = 3
): { k: (number | null)[]; d: (number | null)[] } {
  const kValues: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = kPeriod - 1; i < candles.length; i++) {
    let highestHigh = -Infinity;
    let lowestLow = Infinity;
    for (let j = i - kPeriod + 1; j <= i; j++) {
      if (candles[j].high > highestHigh) highestHigh = candles[j].high;
      if (candles[j].low < lowestLow) lowestLow = candles[j].low;
    }
    const range = highestHigh - lowestLow;
    kValues[i] = range === 0 ? 50 : ((candles[i].close - lowestLow) / range) * 100;
  }
  const dValues: (number | null)[] = new Array(candles.length).fill(null);
  for (let i = kPeriod + dPeriod - 2; i < candles.length; i++) {
    let sum = 0;
    let count = 0;
    for (let j = i - dPeriod + 1; j <= i; j++) {
      const val = kValues[j];
      if (val !== null) {
        sum += val;
        count++;
      }
    }
    if (count === dPeriod) dValues[i] = sum / dPeriod;
  }
  return { k: kValues, d: dValues };
}

function getLastValid(arr: (number | null)[], fallback: number): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (arr[i] !== null && Number.isFinite(arr[i])) return arr[i] as number;
  }
  return fallback;
}

export function computeTechnicalSummary(symbol: string, candles: Candle[]): TechnicalSummary {
  const closes = candles.map((c) => c.close);
  const lastClose = closes[closes.length - 1] ?? 0;

  const sma10Arr = calculateSMA(closes, 10);
  const sma20Arr = calculateSMA(closes, 20);
  const sma50Arr = calculateSMA(closes, 50);
  const ema12Arr = calculateEMA(closes, 12);
  const ema26Arr = calculateEMA(closes, 26);
  const ema50Arr = calculateEMA(closes, 50);
  const rsiArr = calculateRSI(closes, 14);
  const macdArr = calculateMACD(closes, 12, 26, 9);
  const bbArr = calculateBollingerBands(closes, 20, 2);
  const atrArr = calculateATR(candles, 14);
  const stoch = calculateStochastic(candles, 14, 3);

  const sma10 = getLastValid(sma10Arr, lastClose);
  const sma20 = getLastValid(sma20Arr, lastClose);
  const sma50 = getLastValid(sma50Arr, lastClose);
  const ema12 = getLastValid(ema12Arr, lastClose);
  const ema26 = getLastValid(ema26Arr, lastClose);
  const ema50 = getLastValid(ema50Arr, lastClose);
  const rsi14 = getLastValid(rsiArr, 50);
  const lastMacd = macdArr[macdArr.length - 1] ?? { macd: 0, signal: 0, histogram: 0 };
  const macdValue = lastMacd.macd ?? 0;
  const macdSignal = lastMacd.signal ?? 0;
  const macdHistogram = lastMacd.histogram ?? 0;

  const lastBB = bbArr[bbArr.length - 1];
  const bbUpper = lastBB?.upper ?? lastClose * 1.04;
  const bbLower = lastBB?.lower ?? lastClose * 0.96;
  const bbMiddle = lastBB?.middle ?? lastClose;
  const bbSpan = bbUpper - bbLower;
  const bollingerPercentB = bbSpan > 0 ? (lastClose - bbLower) / bbSpan : 0.5;
  const bollingerBandwidth = bbMiddle > 0 ? (bbSpan / bbMiddle) * 100 : 0;

  const atr14 = getLastValid(atrArr, lastClose * 0.02);
  const atrPercent = lastClose > 0 ? (atr14 / lastClose) * 100 : 0;
  const stochK = getLastValid(stoch.k, 50);
  const stochD = getLastValid(stoch.d, 50);

  // Evaluate oscillator signals
  const rsiSignal: SignalBias =
    rsi14 < 35 ? 'Buy' : rsi14 > 68 ? 'Sell' : 'Neutral';
  const macdBias: SignalBias =
    macdHistogram > 0.05 ? 'Buy' : macdHistogram < -0.05 ? 'Sell' : 'Neutral';
  const stochSignal: SignalBias =
    stochK < 25 && stochK >= stochD
      ? 'Buy'
      : stochK > 75 && stochK <= stochD
      ? 'Sell'
      : 'Neutral';
  const bbSignal: SignalBias =
    bollingerPercentB < 0.2 ? 'Buy' : bollingerPercentB > 0.85 ? 'Sell' : 'Neutral';

  // Evaluate moving average signals
  const maSignal = (maVal: number): SignalBias => {
    const diffPct = ((lastClose - maVal) / maVal) * 100;
    if (diffPct > 0.25) return 'Buy';
    if (diffPct < -0.25) return 'Sell';
    return 'Neutral';
  };

  const movingAverages: IndicatorReading[] = [
    {
      name: 'SMA (10)',
      value: formatCurrency(sma10),
      signal: maSignal(sma10),
      detail: lastClose >= sma10 ? 'Price above 10-period average' : 'Price below 10-period average',
    },
    {
      name: 'SMA (20)',
      value: formatCurrency(sma20),
      signal: maSignal(sma20),
      detail: lastClose >= sma20 ? 'Short-term uptrend support' : 'Short-term overhead resistance',
    },
    {
      name: 'SMA (50)',
      value: formatCurrency(sma50),
      signal: maSignal(sma50),
      detail: lastClose >= sma50 ? 'Medium-term bullish structure' : 'Medium-term bearish structure',
    },
    {
      name: 'EMA (12)',
      value: formatCurrency(ema12),
      signal: maSignal(ema12),
      detail: ema12 >= ema26 ? 'Fast EMA leading above EMA 26' : 'Fast EMA trailing below EMA 26',
    },
    {
      name: 'EMA (26)',
      value: formatCurrency(ema26),
      signal: maSignal(ema26),
      detail: lastClose >= ema26 ? 'Positive momentum anchor' : 'Negative momentum anchor',
    },
    {
      name: 'EMA (50)',
      value: formatCurrency(ema50),
      signal: maSignal(ema50),
      detail: lastClose >= ema50 ? 'Institutional trend intact' : 'Below institutional trend line',
    },
  ];

  const oscillators: IndicatorReading[] = [
    {
      name: 'RSI (14)',
      value: rsi14.toFixed(1),
      signal: rsiSignal,
      detail:
        rsi14 > 70
          ? 'Overbought territory (>70)'
          : rsi14 < 30
          ? 'Oversold territory (<30)'
          : 'Balanced momentum zone',
    },
    {
      name: 'MACD (12, 26, 9)',
      value: `${macdValue >= 0 ? '+' : ''}${macdValue.toFixed(2)}`,
      signal: macdBias,
      detail: `Signal ${macdSignal >= 0 ? '+' : ''}${macdSignal.toFixed(2)} · Hist ${macdHistogram >= 0 ? '+' : ''}${macdHistogram.toFixed(2)}`,
    },
    {
      name: 'Stochastic (14, 3)',
      value: `${stochK.toFixed(1)} / ${stochD.toFixed(1)}`,
      signal: stochSignal,
      detail: stochK > 80 ? 'Upper range saturation' : stochK < 20 ? 'Lower range compression' : 'Mid-range oscillation',
    },
    {
      name: 'Bollinger %B (20, 2)',
      value: `${(bollingerPercentB * 100).toFixed(0)}%`,
      signal: bbSignal,
      detail: `Bandwidth ${bollingerBandwidth.toFixed(1)}%`,
    },
    {
      name: 'ATR (14)',
      value: `${formatCurrency(atr14)} (${atrPercent.toFixed(2)}%)`,
      signal: 'Neutral',
      detail: atrPercent > 3 ? 'Elevated volatility regime' : 'Contained volatility regime',
    },
  ];

  const allSignals = [...movingAverages, ...oscillators.slice(0, 4)].map((r) => r.signal);
  const bullishCount = allSignals.filter((s) => s === 'Buy').length;
  const bearishCount = allSignals.filter((s) => s === 'Sell').length;
  const neutralCount = allSignals.filter((s) => s === 'Neutral').length;

  const net = bullishCount - bearishCount;
  let composite: CompositeBias = 'Neutral';
  if (net >= 5) composite = 'Strong Buy';
  else if (net >= 2) composite = 'Buy';
  else if (net <= -5) composite = 'Strong Sell';
  else if (net <= -2) composite = 'Sell';

  let maAlignment = 'Mixed Range';
  if (lastClose > sma20 && sma20 > ema50) maAlignment = 'Bullish Stack';
  else if (lastClose < sma20 && sma20 < ema50) maAlignment = 'Bearish Stack';
  else if (lastClose > sma20) maAlignment = 'Above SMA 20';
  else maAlignment = 'Below SMA 20';

  return {
    symbol,
    rsi14,
    macdValue,
    macdSignal,
    macdHistogram,
    sma10,
    sma20,
    sma50,
    ema12,
    ema26,
    ema50,
    bollingerPercentB,
    bollingerBandwidth,
    atr14,
    atrPercent,
    stochK,
    stochD,
    bullishCount,
    neutralCount,
    bearishCount,
    composite,
    maAlignment,
    oscillators,
    movingAverages,
  };
}

export function formatCurrency(value: number, decimals = 2): string {
  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value < 0 ? `-$${formatted}` : `$${formatted}`;
}

export function formatSignedCurrency(value: number, decimals = 2): string {
  const abs = Math.abs(value).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return value > 0 ? `+$${abs}` : value < 0 ? `-$${abs}` : `$${abs}`;
}

export function formatPercent(value: number, showSign = true): string {
  const abs = Math.abs(value).toFixed(2);
  if (!showSign) return `${abs}%`;
  return value > 0 ? `+${abs}%` : value < 0 ? `-${abs}%` : `0.00%`;
}

export function formatCompactVolume(vol: number): string {
  if (vol >= 1_000_000_000) return `${(vol / 1_000_000_000).toFixed(2)}B`;
  if (vol >= 1_000_000) return `${(vol / 1_000_000).toFixed(2)}M`;
  if (vol >= 1_000) return `${(vol / 1_000).toFixed(1)}K`;
  return vol.toFixed(0);
}

export function formatMarketCap(billions: number): string {
  if (billions >= 1000) return `$${(billions / 1000).toFixed(2)}T`;
  return `$${billions.toFixed(1)}B`;
}
