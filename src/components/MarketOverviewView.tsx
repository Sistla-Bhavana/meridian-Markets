import React, { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  ChartMode,
  IndicatorConfig,
  PortfolioPosition,
  StockAsset,
  Timeframe,
} from '../types/market';
import {
  computeTechnicalSummary,
  formatCompactVolume,
  formatCurrency,
  formatMarketCap,
  formatPercent,
  formatSignedCurrency,
} from '../utils/indicators';
import { PriceChart } from './PriceChart';

interface MarketOverviewViewProps {
  asset: StockAsset;
  assets: StockAsset[];
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
  indicators: IndicatorConfig;
  onToggleIndicator: (key: keyof IndicatorConfig) => void;
  positions: PortfolioPosition[];
  cashBalance: number;
  onOpenTrade: (symbol: string, side: 'BUY' | 'SELL') => void;
  onNavigatePortfolio: () => void;
  onNavigateTechnicals: () => void;
}

export const MarketOverviewView: React.FC<MarketOverviewViewProps> = ({
  asset,
  assets,
  timeframe,
  onTimeframeChange,
  chartMode,
  onChartModeChange,
  indicators,
  onToggleIndicator,
  positions,
  cashBalance,
  onOpenTrade,
  onNavigatePortfolio,
  onNavigateTechnicals,
}) => {
  const change = asset.price - asset.previousClose;
  const changePct = (change / Math.max(0.01, asset.previousClose)) * 100;
  const isUp = change >= 0;

  const tech = useMemo(
    () => computeTechnicalSummary(asset.symbol, asset.history[timeframe]),
    [asset.symbol, asset.history, timeframe]
  );

  const portfolioSnapshot = useMemo(() => {
    const assetMap = new Map(assets.map((a) => [a.symbol, a]));
    let equityTotal = 0;
    let dayPnl = 0;
    for (const p of positions) {
      const a = assetMap.get(p.symbol);
      if (a) {
        equityTotal += p.shares * a.price;
        dayPnl += p.shares * (a.price - a.previousClose);
      }
    }
    const totalValue = equityTotal + cashBalance;
    const prevTotal = totalValue - dayPnl;
    const dayPnlPct = prevTotal > 0 ? (dayPnl / prevTotal) * 100 : 0;

    const currentPos = positions.find((p) => p.symbol === asset.symbol && p.shares > 0) ?? null;
    const posMarketVal = currentPos ? currentPos.shares * asset.price : 0;
    const posCost = currentPos ? currentPos.shares * currentPos.avgCost : 0;
    const posUnrealized = posMarketVal - posCost;
    const posUnrealizedPct = posCost > 0 ? (posUnrealized / posCost) * 100 : 0;
    const posWeight = totalValue > 0 ? (posMarketVal / totalValue) * 100 : 0;

    return {
      totalValue,
      dayPnl,
      dayPnlPct,
      currentPos,
      posMarketVal,
      posUnrealized,
      posUnrealizedPct,
      posWeight,
    };
  }, [assets, positions, cashBalance, asset.symbol, asset.price]);

  const week52Progress = Math.max(
    0,
    Math.min(
      100,
      ((asset.price - asset.week52Low) /
        Math.max(0.01, asset.week52High - asset.week52Low)) *
        100
    )
  );

  const totalSignals = Math.max(
    1,
    tech.bullishCount + tech.neutralCount + tech.bearishCount
  );

  return (
    <div className="space-y-5">
      {/* Equity Quote Header & Market Fundamentals */}
      <section className="bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden">
        <div className="p-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
                {asset.symbol}
              </h1>
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 truncate">
                {asset.name}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{asset.exchange}</span>
              <span aria-hidden="true">·</span>
              <span>{asset.sector}</span>
              <span aria-hidden="true">·</span>
              <span>Beta {asset.beta.toFixed(2)}</span>
              {asset.dividendYield > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Yield {asset.dividendYield.toFixed(2)}%</span>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end justify-between md:justify-end gap-5">
            <div className="text-left md:text-right font-mono tabular-nums">
              <div
                key={`${asset.symbol}-hdr-${asset.lastTickId}`}
                className={`inline-block px-1 -mx-1 rounded text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50 ${
                  asset.lastTickDirection === 'up'
                    ? 'tick-flash-up'
                    : asset.lastTickDirection === 'down'
                    ? 'tick-flash-down'
                    : ''
                }`}
              >
                {formatCurrency(asset.price)}
              </div>
              <div
                className={`mt-0.5 text-xs font-medium ${
                  isUp
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isUp ? '▲' : '▼'} {formatSignedCurrency(change)} ({formatPercent(changePct)}) today
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => onOpenTrade(asset.symbol, 'BUY')}
                className="px-4 py-2 text-xs font-semibold rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Buy {asset.symbol}
              </button>
              <button
                type="button"
                onClick={() => onOpenTrade(asset.symbol, 'SELL')}
                className="px-4 py-2 text-xs font-semibold rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Sell
              </button>
            </div>
          </div>
        </div>

        {/* Key Session Metrics Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 border-t border-slate-200 dark:border-slate-800/90 divide-x divide-y xl:divide-y-0 divide-slate-200 dark:divide-slate-800/90 bg-slate-50/50 dark:bg-[#0D121D]">
          <div className="px-4 py-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Open</div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(asset.open)}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Day Range</div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(asset.dayLow)} – {formatCurrency(asset.dayHigh)}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Volume</div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-slate-100">
              {formatCompactVolume(asset.volume)}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">Market Cap</div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-slate-100">
              {formatMarketCap(asset.marketCap)}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="text-[11px] text-slate-500 dark:text-slate-400">P/E Ratio</div>
            <div className="mt-0.5 font-mono tabular-nums text-xs font-medium text-slate-900 dark:text-slate-100">
              {asset.peRatio !== null ? `${asset.peRatio.toFixed(1)}x` : '—'}
            </div>
          </div>
          <div className="px-4 py-2.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>52W Range</span>
              <span className="font-mono">{week52Progress.toFixed(0)}%</span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
              <div
                className="h-full bg-sky-500 rounded-full"
                style={{ width: `${week52Progress}%` }}
              />
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] font-mono tabular-nums text-slate-500 dark:text-slate-400">
              <span>{formatCurrency(asset.week52Low, 0)}</span>
              <span>{formatCurrency(asset.week52High, 0)}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Focal Anchor: Interactive Financial Chart */}
      <PriceChart
        asset={asset}
        timeframe={timeframe}
        onTimeframeChange={onTimeframeChange}
        chartMode={chartMode}
        onChartModeChange={onChartModeChange}
        indicators={indicators}
        onToggleIndicator={onToggleIndicator}
      />

      {/* Lower Intelligence Row: Position & Technical Signal Summary */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Position & Portfolio Context */}
        <section className="xl:col-span-7 bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/70">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Portfolio Exposure · {asset.symbol}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Account net value {formatCurrency(portfolioSnapshot.totalValue)} (
                  <span
                    className={
                      portfolioSnapshot.dayPnl >= 0
                        ? 'text-emerald-600 dark:text-emerald-400 font-mono'
                        : 'text-rose-600 dark:text-rose-400 font-mono'
                    }
                  >
                    {formatSignedCurrency(portfolioSnapshot.dayPnl)} ·{' '}
                    {formatPercent(portfolioSnapshot.dayPnlPct)}
                  </span>{' '}
                  today)
                </p>
              </div>

              <button
                type="button"
                onClick={onNavigatePortfolio}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Full Portfolio</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {portfolioSnapshot.currentPos ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4">
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Held Shares</div>
                  <div className="mt-1 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
                    {portfolioSnapshot.currentPos.shares}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Avg {formatCurrency(portfolioSnapshot.currentPos.avgCost)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Market Value</div>
                  <div className="mt-1 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(portfolioSnapshot.posMarketVal)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    {portfolioSnapshot.posWeight.toFixed(1)}% of equity
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Unrealized P&amp;L</div>
                  <div
                    className={`mt-1 font-mono tabular-nums text-base font-semibold ${
                      portfolioSnapshot.posUnrealized >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {formatSignedCurrency(portfolioSnapshot.posUnrealized)}
                  </div>
                  <div
                    className={`text-[11px] font-mono ${
                      portfolioSnapshot.posUnrealized >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {portfolioSnapshot.posUnrealized >= 0 ? '▲' : '▼'}{' '}
                    {formatPercent(portfolioSnapshot.posUnrealizedPct, false)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">Available Cash</div>
                  <div className="mt-1 font-mono tabular-nums text-base font-semibold text-slate-900 dark:text-slate-100">
                    {formatCurrency(cashBalance)}
                  </div>
                  <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                    Buying power
                  </div>
                </div>
              </div>
            ) : (
              <div className="pt-4 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    No active position in {asset.symbol}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    You have {formatCurrency(cashBalance)} in buying power available to initiate a position.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenTrade(asset.symbol, 'BUY')}
                  className="px-3.5 py-1.5 text-xs font-medium rounded-md border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Open Position
                </button>
              </div>
            )}
          </div>
        </section>

        {/* Technical Consensus Summary */}
        <section className="xl:col-span-5 bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800/70">
              <div>
                <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Technical Indicators · {timeframe}
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Computed from 6 moving averages &amp; 4 oscillators
                </p>
              </div>
              <button
                type="button"
                onClick={onNavigateTechnicals}
                className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 dark:text-sky-400 hover:underline whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>Screener</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="pt-4">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`font-display text-lg font-bold ${
                    tech.composite.includes('Buy')
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : tech.composite.includes('Sell')
                      ? 'text-rose-600 dark:text-rose-400'
                      : 'text-slate-700 dark:text-slate-300'
                  }`}
                >
                  {tech.composite}
                </span>
                <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                  {tech.bullishCount} Buy · {tech.neutralCount} Neutral · {tech.bearishCount} Sell
                </span>
              </div>

              {/* Proportional Indicator Distribution Bar */}
              <div className="mt-2.5 h-2 w-full rounded-sm overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                <div
                  style={{ width: `${(tech.bullishCount / totalSignals) * 100}%` }}
                  className="bg-emerald-500 h-full transition-all duration-200"
                />
                <div
                  style={{ width: `${(tech.neutralCount / totalSignals) * 100}%` }}
                  className="bg-slate-400 dark:bg-slate-600 h-full transition-all duration-200"
                />
                <div
                  style={{ width: `${(tech.bearishCount / totalSignals) * 100}%` }}
                  className="bg-rose-500 h-full transition-all duration-200"
                />
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-xs font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">RSI (14)</div>
                  <div className="mt-0.5 font-medium text-slate-900 dark:text-slate-100">
                    {tech.rsi14.toFixed(1)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">MACD Hist</div>
                  <div
                    className={`mt-0.5 font-medium ${
                      tech.macdHistogram >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {tech.macdHistogram >= 0 ? '+' : ''}
                    {tech.macdHistogram.toFixed(2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">MA Trend</div>
                  <div className="mt-0.5 font-sans font-medium text-slate-900 dark:text-slate-100 truncate">
                    {tech.maAlignment}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};
