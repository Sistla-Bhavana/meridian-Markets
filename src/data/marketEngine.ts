import { Candle, PortfolioPosition, StockAsset, Timeframe, TradeRecord } from '../types/market';

interface StockSeed {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  basePrice: number;
  dailyVolatility: number;
  trendBias: number; // annualized drift bias
  marketCap: number;
  peRatio: number | null;
  beta: number;
  dividendYield: number;
  avgVolume: number;
  seedOffset: number;
}

const STOCK_SEEDS: StockSeed[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA Corporation',
    exchange: 'NASDAQ',
    sector: 'Semiconductors',
    basePrice: 146.85,
    dailyVolatility: 0.024,
    trendBias: 0.0018,
    marketCap: 3580,
    peRatio: 52.4,
    beta: 1.66,
    dividendYield: 0.03,
    avgVolume: 248_000_000,
    seedOffset: 101,
  },
  {
    symbol: 'AAPL',
    name: 'Apple Inc.',
    exchange: 'NASDAQ',
    sector: 'Technology',
    basePrice: 234.4,
    dailyVolatility: 0.013,
    trendBias: 0.0009,
    marketCap: 3540,
    peRatio: 34.8,
    beta: 1.18,
    dividendYield: 0.44,
    avgVolume: 48_500_000,
    seedOffset: 202,
  },
  {
    symbol: 'MSFT',
    name: 'Microsoft Corporation',
    exchange: 'NASDAQ',
    sector: 'Technology',
    basePrice: 432.15,
    dailyVolatility: 0.014,
    trendBias: 0.0011,
    marketCap: 3210,
    peRatio: 35.9,
    beta: 0.93,
    dividendYield: 0.72,
    avgVolume: 21_400_000,
    seedOffset: 303,
  },
  {
    symbol: 'GOOGL',
    name: 'Alphabet Inc.',
    exchange: 'NASDAQ',
    sector: 'Communication',
    basePrice: 184.6,
    dailyVolatility: 0.016,
    trendBias: 0.0008,
    marketCap: 2260,
    peRatio: 24.1,
    beta: 1.05,
    dividendYield: 0.43,
    avgVolume: 25_900_000,
    seedOffset: 404,
  },
  {
    symbol: 'AMZN',
    name: 'Amazon.com, Inc.',
    exchange: 'NASDAQ',
    sector: 'Consumer',
    basePrice: 212.3,
    dailyVolatility: 0.017,
    trendBias: 0.0012,
    marketCap: 2230,
    peRatio: 44.2,
    beta: 1.15,
    dividendYield: 0,
    avgVolume: 39_100_000,
    seedOffset: 505,
  },
  {
    symbol: 'META',
    name: 'Meta Platforms, Inc.',
    exchange: 'NASDAQ',
    sector: 'Communication',
    basePrice: 594.2,
    dailyVolatility: 0.02,
    trendBias: 0.0014,
    marketCap: 1500,
    peRatio: 28.3,
    beta: 1.24,
    dividendYield: 0.34,
    avgVolume: 13_800_000,
    seedOffset: 606,
  },
  {
    symbol: 'TSLA',
    name: 'Tesla, Inc.',
    exchange: 'NASDAQ',
    sector: 'Consumer',
    basePrice: 318.75,
    dailyVolatility: 0.031,
    trendBias: -0.0005,
    marketCap: 1020,
    peRatio: 86.5,
    beta: 2.18,
    dividendYield: 0,
    avgVolume: 89_400_000,
    seedOffset: 707,
  },
  {
    symbol: 'JPM',
    name: 'JPMorgan Chase & Co.',
    exchange: 'NYSE',
    sector: 'Financials',
    basePrice: 244.9,
    dailyVolatility: 0.012,
    trendBias: 0.0007,
    marketCap: 692,
    peRatio: 13.6,
    beta: 1.08,
    dividendYield: 2.04,
    avgVolume: 8_900_000,
    seedOffset: 808,
  },
  {
    symbol: 'SPY',
    name: 'SPDR S&P 500 ETF Trust',
    exchange: 'NYSE ARCA',
    sector: 'Index ETF',
    basePrice: 598.45,
    dailyVolatility: 0.008,
    trendBias: 0.0006,
    marketCap: 625,
    peRatio: 23.4,
    beta: 1.0,
    dividendYield: 1.21,
    avgVolume: 51_200_000,
    seedOffset: 909,
  },
  {
    symbol: 'QQQ',
    name: 'Invesco QQQ Trust',
    exchange: 'NASDAQ',
    sector: 'Index ETF',
    basePrice: 512.8,
    dailyVolatility: 0.011,
    trendBias: 0.0009,
    marketCap: 312,
    peRatio: 31.2,
    beta: 1.18,
    dividendYield: 0.58,
    avgVolume: 33_600_000,
    seedOffset: 1010,
  },
];

// Deterministic PRNG (Mulberry32) so initial charts have realistic structure without erratic flicker on reload
function createRng(seed: number) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function boxMuller(rng: () => number): number {
  const u1 = Math.max(1e-7, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const TIMEFRAME_CONFIG: Record<
  Timeframe,
  { bars: number; stepMs: number; volScale: number; format: (ts: number) => string }
> = {
  '1D': {
    bars: 78, // 5-minute intraday bars across 6.5h regular session
    stepMs: 5 * 60 * 1000,
    volScale: 0.14,
    format: (ts) =>
      new Date(ts).toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
  },
  '1W': {
    bars: 65, // 30-min bars across 5 sessions
    stepMs: 30 * 60 * 1000,
    volScale: 0.32,
    format: (ts) => {
      const d = new Date(ts);
      return `${d.toLocaleDateString('en-US', { weekday: 'short' })} ${d.getHours().toString().padStart(2, '0')}:00`;
    },
  },
  '1M': {
    bars: 64, // 2-hour bars across ~21 trading days
    stepMs: 4 * 60 * 60 * 1000,
    volScale: 0.62,
    format: (ts) =>
      new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
  '3M': {
    bars: 66, // daily bars
    stepMs: 24 * 60 * 60 * 1000,
    volScale: 1.0,
    format: (ts) =>
      new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
  '1Y': {
    bars: 96, // ~3-day bars across 1 year
    stepMs: 3.7 * 24 * 60 * 60 * 1000,
    volScale: 1.55,
    format: (ts) =>
      new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
  },
};

function generateSeriesEndingAt(
  seed: StockSeed,
  timeframe: Timeframe,
  targetEndPrice: number,
  nowMs: number
): Candle[] {
  const cfg = TIMEFRAME_CONFIG[timeframe];
  const rng = createRng(seed.seedOffset * 31 + timeframe.charCodeAt(0) * 17 + timeframe.charCodeAt(1));
  const barVol = seed.dailyVolatility * cfg.volScale;
  const barDrift = seed.trendBias * cfg.volScale;

  // Generate raw random walk forward, then scale/shift smoothly to finish at targetEndPrice
  const rawCloses: number[] = [100];
  let momentum = 0;
  for (let i = 1; i < cfg.bars; i++) {
    const shock = boxMuller(rng) * barVol;
    momentum = momentum * 0.35 + shock * 0.65;
    const ret = barDrift + momentum;
    rawCloses.push(Math.max(10, rawCloses[i - 1] * (1 + ret)));
  }

  const scale = targetEndPrice / rawCloses[rawCloses.length - 1];
  const candles: Candle[] = [];
  const startMs = nowMs - (cfg.bars - 1) * cfg.stepMs;

  for (let i = 0; i < cfg.bars; i++) {
    const close = Number((rawCloses[i] * scale).toFixed(2));
    const prevClose = i === 0 ? Number((close * (1 - (rng() - 0.5) * barVol)).toFixed(2)) : candles[i - 1].close;
    const gap = (rng() - 0.5) * barVol * 0.25 * prevClose;
    const open = Number(Math.max(0.5, prevClose + gap).toFixed(2));

    const bodyHigh = Math.max(open, close);
    const bodyLow = Math.min(open, close);
    const wickScale = barVol * close * (0.25 + rng() * 0.65);
    const high = Number((bodyHigh + wickScale * rng()).toFixed(2));
    const low = Number(Math.max(0.5, bodyLow - wickScale * rng()).toFixed(2));

    const volatilityBoost = Math.abs(close - open) / Math.max(1, open * barVol);
    const baseBarVol = seed.avgVolume / (timeframe === '1D' ? 78 : timeframe === '1W' ? 13 : 1);
    const volume = Math.round(baseBarVol * (0.55 + rng() * 0.9 + volatilityBoost * 0.45));

    const timestamp = Math.round(startMs + i * cfg.stepMs);
    candles.push({
      timestamp,
      label: cfg.format(timestamp),
      open,
      high,
      low,
      close,
      volume,
    });
  }

  return candles;
}

export function createInitialMarketData(): StockAsset[] {
  const nowMs = Date.now();

  return STOCK_SEEDS.map((seed) => {
    const history: Record<Timeframe, Candle[]> = {
      '1D': generateSeriesEndingAt(seed, '1D', seed.basePrice, nowMs),
      '1W': generateSeriesEndingAt(seed, '1W', seed.basePrice, nowMs),
      '1M': generateSeriesEndingAt(seed, '1M', seed.basePrice, nowMs),
      '3M': generateSeriesEndingAt(seed, '3M', seed.basePrice, nowMs),
      '1Y': generateSeriesEndingAt(seed, '1Y', seed.basePrice, nowMs),
    };

    const intraday = history['1D'];
    const open = intraday[0].open;
    const previousClose = Number((open * (1 - (seed.trendBias * 3.5))).toFixed(2));
    const price = intraday[intraday.length - 1].close;
    const dayHigh = Math.max(...intraday.map((c) => c.high));
    const dayLow = Math.min(...intraday.map((c) => c.low));
    const volume = intraday.reduce((acc, c) => acc + c.volume, 0);

    const yearly = history['1Y'];
    const week52High = Number((Math.max(...yearly.map((c) => c.high)) * 1.03).toFixed(2));
    const week52Low = Number((Math.min(...yearly.map((c) => c.low)) * 0.97).toFixed(2));

    return {
      symbol: seed.symbol,
      name: seed.name,
      exchange: seed.exchange,
      sector: seed.sector,
      price,
      previousClose,
      open,
      dayHigh,
      dayLow,
      volume,
      avgVolume: seed.avgVolume,
      marketCap: seed.marketCap,
      peRatio: seed.peRatio,
      beta: seed.beta,
      week52High,
      week52Low,
      dividendYield: seed.dividendYield,
      lastTickDirection: 'flat',
      lastTickId: 0,
      history,
    };
  });
}

export function stepMarketTick(assets: StockAsset[]): StockAsset[] {
  // Subtle shared market factor (SPY pulse) + idiosyncratic stock movement
  const marketPulse = (Math.random() - 0.495) * 0.0014;

  return assets.map((asset) => {
    const idiosyncratic = (Math.random() - 0.5) * 0.0022 * Math.sqrt(asset.beta);
    // Gentle mean reversion toward open to avoid runaway drifts during long sessions
    const driftFromOpen = (asset.price - asset.open) / asset.open;
    const meanRev = -driftFromOpen * 0.006;

    const pctMove = marketPulse * asset.beta + idiosyncratic + meanRev;
    const nextPrice = Number(Math.max(1, asset.price * (1 + pctMove)).toFixed(2));
    const direction: 'up' | 'down' | 'flat' =
      nextPrice > asset.price ? 'up' : nextPrice < asset.price ? 'down' : 'flat';

    const addedVol = Math.round((asset.avgVolume / 4500) * (0.4 + Math.random() * 1.6));

    const updatedHistory: Record<Timeframe, Candle[]> = {
      '1D': updateLastCandle(asset.history['1D'], nextPrice, addedVol),
      '1W': updateLastCandle(asset.history['1W'], nextPrice, addedVol),
      '1M': updateLastCandle(asset.history['1M'], nextPrice, addedVol),
      '3M': updateLastCandle(asset.history['3M'], nextPrice, addedVol),
      '1Y': updateLastCandle(asset.history['1Y'], nextPrice, addedVol),
    };

    return {
      ...asset,
      price: nextPrice,
      dayHigh: Math.max(asset.dayHigh, nextPrice),
      dayLow: Math.min(asset.dayLow, nextPrice),
      week52High: Math.max(asset.week52High, nextPrice),
      week52Low: Math.min(asset.week52Low, nextPrice),
      volume: asset.volume + addedVol,
      lastTickDirection: direction,
      lastTickId: direction === 'flat' ? asset.lastTickId : asset.lastTickId + 1,
      history: updatedHistory,
    };
  });
}

function updateLastCandle(series: Candle[], nextPrice: number, addedVol: number): Candle[] {
  if (series.length === 0) return series;
  const copy = series.slice();
  const last = copy[copy.length - 1];
  copy[copy.length - 1] = {
    ...last,
    close: nextPrice,
    high: Math.max(last.high, nextPrice),
    low: Math.min(last.low, nextPrice),
    volume: last.volume + addedVol,
  };
  return copy;
}

export const INITIAL_CASH_BALANCE = 24_850.0;

export const INITIAL_POSITIONS: PortfolioPosition[] = [
  { symbol: 'NVDA', shares: 210, avgCost: 118.4 },
  { symbol: 'MSFT', shares: 65, avgCost: 392.15 },
  { symbol: 'AAPL', shares: 110, avgCost: 208.75 },
  { symbol: 'AMZN', shares: 95, avgCost: 186.5 },
  { symbol: 'JPM', shares: 70, avgCost: 214.2 },
  { symbol: 'SPY', shares: 45, avgCost: 548.9 },
];

export const INITIAL_TRADES: TradeRecord[] = [
  {
    id: 'trd-1004',
    timestamp: Date.now() - 1000 * 60 * 60 * 19,
    symbol: 'NVDA',
    side: 'BUY',
    shares: 35,
    price: 141.9,
    total: 4966.5,
  },
  {
    id: 'trd-1003',
    timestamp: Date.now() - 1000 * 60 * 60 * 52,
    symbol: 'MSFT',
    side: 'BUY',
    shares: 15,
    price: 421.6,
    total: 6324.0,
  },
  {
    id: 'trd-1002',
    timestamp: Date.now() - 1000 * 60 * 60 * 116,
    symbol: 'JPM',
    side: 'BUY',
    shares: 25,
    price: 236.4,
    total: 5910.0,
  },
  {
    id: 'trd-1001',
    timestamp: Date.now() - 1000 * 60 * 60 * 184,
    symbol: 'AAPL',
    side: 'SELL',
    shares: 20,
    price: 229.1,
    total: 4582.0,
  },
];

export interface EquityCurvePoint {
  label: string;
  portfolioReturn: number; // % return from start of window
  benchmarkReturn: number; // SPY % return from start of window
  portfolioValue: number;
}

export function buildPortfolioEquityCurve(
  assets: StockAsset[],
  positions: PortfolioPosition[],
  cashBalance: number,
  timeframe: Timeframe
): EquityCurvePoint[] {
  const spy = assets.find((a) => a.symbol === 'SPY');
  if (!spy) return [];
  const spySeries = spy.history[timeframe];
  const len = spySeries.length;
  if (len === 0) return [];

  const assetMap = new Map(assets.map((a) => [a.symbol, a]));
  const rawPortfolioValues: number[] = [];

  for (let i = 0; i < len; i++) {
    let val = cashBalance;
    for (const pos of positions) {
      const stock = assetMap.get(pos.symbol);
      if (stock) {
        const bar = stock.history[timeframe][i] ?? stock.history[timeframe][stock.history[timeframe].length - 1];
        if (bar) val += pos.shares * bar.close;
      }
    }
    rawPortfolioValues.push(val);
  }

  const basePort = rawPortfolioValues[0] || 1;
  const baseSpy = spySeries[0].close || 1;

  return spySeries.map((bar, i) => ({
    label: bar.label,
    portfolioReturn: ((rawPortfolioValues[i] - basePort) / basePort) * 100,
    benchmarkReturn: ((bar.close - baseSpy) / baseSpy) * 100,
    portfolioValue: rawPortfolioValues[i],
  }));
}
