import React, { useMemo, useState } from 'react';
import { ArrowUpRight, Search } from 'lucide-react';
import { CompositeBias, SignalBias, StockAsset, Timeframe } from '../types/market';
import {
  computeTechnicalSummary,
  formatCurrency,
  formatPercent,
} from '../utils/indicators';

interface TechnicalScreenerViewProps {
  assets: StockAsset[];
  selectedSymbol: string;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  onSelectSymbol: (symbol: string) => void;
  onOpenInChart: (symbol: string) => void;
}

type BiasFilter = 'all' | 'bullish' | 'neutral' | 'bearish';

function biasTextClass(bias: CompositeBias | SignalBias): string {
  if (bias === 'Strong Buy' || bias === 'Buy') return 'text-emerald-600 dark:text-emerald-400';
  if (bias === 'Strong Sell' || bias === 'Sell') return 'text-rose-600 dark:text-rose-400';
  return 'text-slate-500 dark:text-slate-400';
}

export const TechnicalScreenerView: React.FC<TechnicalScreenerViewProps> = ({
  assets,
  selectedSymbol,
  timeframe,
  onTimeframeChange,
  onSelectSymbol,
  onOpenInChart,
}) => {
  const [filter, setFilter] = useState<BiasFilter>('all');
  const [query, setQuery] = useState('');

  const summaries = useMemo(() => {
    return assets.map((asset) => ({
      asset,
      tech: computeTechnicalSummary(asset.symbol, asset.history[timeframe]),
    }));
  }, [assets, timeframe]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return summaries.filter(({ asset, tech }) => {
      if (q && !asset.symbol.toLowerCase().includes(q) && !asset.sector.toLowerCase().includes(q)) {
        return false;
      }
      if (filter === 'bullish') return tech.composite === 'Buy' || tech.composite === 'Strong Buy';
      if (filter === 'bearish') return tech.composite === 'Sell' || tech.composite === 'Strong Sell';
      if (filter === 'neutral') return tech.composite === 'Neutral';
      return true;
    });
  }, [summaries, filter, query]);

  const activeEntry =
    summaries.find((s) => s.asset.symbol === selectedSymbol) ?? summaries[0];

  return (
    <div className="space-y-6">
      {/* Scanner Controls & Matrix Table */}
      <section className="bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Multi-Asset Technical Scanner
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Real-time RSI, MACD, Moving Average alignment, Bollinger %B, and ATR across tracked equities
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search symbol or sector..."
                aria-label="Search technical scanner"
                className="w-44 pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#0D121D] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
              />
            </div>

            {/* Bias Filter */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
              {(['all', 'bullish', 'neutral', 'bearish'] as BiasFilter[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`px-2.5 py-1 text-xs font-medium rounded capitalize transition-colors cursor-pointer ${
                    filter === key
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {key}
                </button>
              ))}
            </div>

            {/* Timeframe */}
            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
              {(['1D', '1W', '1M', '3M', '1Y'] as Timeframe[]).map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => onTimeframeChange(tf)}
                  className={`px-2 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                    timeframe === tf
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-10 text-center text-xs text-slate-500 dark:text-slate-400">
            No equities match the selected filter criteria.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/90 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D121D]">
                  <th className="py-2.5 pl-5 pr-3">Symbol</th>
                  <th className="py-2.5 px-3 text-right">Last Price</th>
                  <th className="py-2.5 px-3 text-right">RSI (14)</th>
                  <th className="py-2.5 px-3 text-right">MACD Hist</th>
                  <th className="py-2.5 px-3">MA Structure</th>
                  <th className="py-2.5 px-3 text-right">Bollinger %B</th>
                  <th className="py-2.5 px-3 text-right">ATR (14)</th>
                  <th className="py-2.5 px-3">Composite Bias</th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Chart</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {filtered.map(({ asset, tech }) => {
                  const isSelected = asset.symbol === activeEntry.asset.symbol;
                  const chgPct =
                    ((asset.price - asset.previousClose) / Math.max(0.01, asset.previousClose)) *
                    100;
                  const isUp = chgPct >= 0;

                  return (
                    <tr
                      key={asset.symbol}
                      onClick={() => onSelectSymbol(asset.symbol)}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-sky-50/80 dark:bg-sky-500/10'
                          : 'hover:bg-slate-50/80 dark:hover:bg-slate-800/35'
                      }`}
                    >
                      <td className="py-3 pl-5 pr-3">
                        <div className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                          {asset.symbol}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {asset.sector}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <div className="font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(asset.price)}
                        </div>
                        <div
                          className={`text-[11px] ${
                            isUp
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {isUp ? '▲' : '▼'} {formatPercent(chgPct, false)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums">
                        <span
                          className={
                            tech.rsi14 > 70
                              ? 'text-rose-600 dark:text-rose-400 font-medium'
                              : tech.rsi14 < 30
                              ? 'text-emerald-600 dark:text-emerald-400 font-medium'
                              : 'text-slate-800 dark:text-slate-200'
                          }
                        >
                          {tech.rsi14.toFixed(1)}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums ${
                          tech.macdHistogram >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {tech.macdHistogram >= 0 ? '+' : ''}
                        {tech.macdHistogram.toFixed(2)}
                      </td>
                      <td className="py-3 px-3 text-slate-700 dark:text-slate-300">
                        {tech.maAlignment}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {(tech.bollingerPercentB * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {tech.atrPercent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-3">
                        <div className={`font-semibold ${biasTextClass(tech.composite)}`}>
                          {tech.composite}
                        </div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                          {tech.bullishCount}B · {tech.neutralCount}N · {tech.bearishCount}S
                        </div>
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenInChart(asset.symbol);
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <span>Chart</span>
                          <ArrowUpRight className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Selected Security Detailed Technical Breakdown */}
      {activeEntry && (
        <section className="bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 py-4 border-b border-slate-200 dark:border-slate-800/90">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                  {activeEntry.asset.symbol}
                </span>
                <span aria-hidden="true">·</span>
                <span>{activeEntry.asset.name}</span>
                <span aria-hidden="true">·</span>
                <span>{timeframe} Technical Breakdown</span>
              </div>
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className={`font-semibold text-sm ${biasTextClass(activeEntry.tech.composite)}`}>
                  {activeEntry.tech.composite}
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                  {activeEntry.tech.bullishCount} Bullish · {activeEntry.tech.neutralCount} Neutral ·{' '}
                  {activeEntry.tech.bearishCount} Bearish across 10 signals
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onOpenInChart(activeEntry.asset.symbol)}
              className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors cursor-pointer"
            >
              Inspect on Chart
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800/90">
            {/* Moving Averages Table */}
            <div>
              <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-[#0D121D] border-b border-slate-200 dark:border-slate-800/90 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Moving Averages
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {activeEntry.tech.movingAverages.map((item) => (
                  <div
                    key={item.name}
                    className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.detail}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums">
                      <span className="text-slate-800 dark:text-slate-200">{item.value}</span>
                      <span className={`w-14 text-right font-semibold ${biasTextClass(item.signal)}`}>
                        {item.signal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Oscillators & Volatility Table */}
            <div>
              <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-[#0D121D] border-b border-slate-200 dark:border-slate-800/90 text-xs font-semibold text-slate-700 dark:text-slate-300">
                Oscillators &amp; Volatility
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {activeEntry.tech.oscillators.map((item) => (
                  <div
                    key={item.name}
                    className="px-5 py-3 flex items-center justify-between gap-4 text-xs"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-slate-900 dark:text-slate-100">
                        {item.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {item.detail}
                      </div>
                    </div>
                    <div className="flex items-center gap-5 shrink-0 font-mono tabular-nums">
                      <span className="text-slate-800 dark:text-slate-200">{item.value}</span>
                      <span className={`w-14 text-right font-semibold ${biasTextClass(item.signal)}`}>
                        {item.signal}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
