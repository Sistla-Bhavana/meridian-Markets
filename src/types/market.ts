export type Timeframe = '1D' | '1W' | '1M' | '3M' | '1Y';

export type ChartMode = 'candle' | 'area';

export type ActiveView = 'market' | 'portfolio' | 'technicals';

export interface Candle {
  timestamp: number;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StockAsset {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  previousClose: number;
  open: number;
  dayHigh: number;
  dayLow: number;
  volume: number;
  avgVolume: number;
  marketCap: number; // in billions
  peRatio: number | null;
  beta: number;
  week52High: number;
  week52Low: number;
  dividendYield: number;
  lastTickDirection: 'up' | 'down' | 'flat';
  lastTickId: number;
  history: Record<Timeframe, Candle[]>;
}

export interface IndicatorConfig {
  sma20: boolean;
  ema50: boolean;
  bollinger: boolean;
  vwap: boolean;
  volume: boolean;
  rsi: boolean;
  macd: boolean;
}

export interface PortfolioPosition {
  symbol: string;
  shares: number;
  avgCost: number;
}

export interface TradeRecord {
  id: string;
  timestamp: number;
  symbol: string;
  side: 'BUY' | 'SELL';
  shares: number;
  price: number;
  total: number;
}

export type SignalBias = 'Buy' | 'Neutral' | 'Sell';
export type CompositeBias = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';

export interface IndicatorReading {
  name: string;
  value: string;
  signal: SignalBias;
  detail: string;
}

export interface TechnicalSummary {
  symbol: string;
  rsi14: number;
  macdValue: number;
  macdSignal: number;
  macdHistogram: number;
  sma10: number;
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  ema50: number;
  bollingerPercentB: number;
  bollingerBandwidth: number;
  atr14: number;
  atrPercent: number;
  stochK: number;
  stochD: number;
  bullishCount: number;
  neutralCount: number;
  bearishCount: number;
  composite: CompositeBias;
  maAlignment: string;
  oscillators: IndicatorReading[];
  movingAverages: IndicatorReading[];
}
