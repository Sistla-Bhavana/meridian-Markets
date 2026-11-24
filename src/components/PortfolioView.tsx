import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, ExternalLink } from 'lucide-react';
import { PortfolioPosition, StockAsset, Timeframe, TradeRecord } from '../types/market';
import { buildPortfolioEquityCurve } from '../data/marketEngine';
import {
  formatCurrency,
  formatPercent,
  formatSignedCurrency,
} from '../utils/indicators';

interface PortfolioViewProps {
  assets: StockAsset[];
  positions: PortfolioPosition[];
  cashBalance: number;
  trades: TradeRecord[];
  onOpenTrade: (symbol: string, side: 'BUY' | 'SELL') => void;
  onInspectSymbol: (symbol: string) => void;
}

type SortKey = 'symbol' | 'marketValue' | 'dayChange' | 'totalReturnPct' | 'weight';

const SECTOR_COLORS: Record<string, string> = {
  Semiconductors: '#38BDF8',
  Technology: '#6366F1',
  Consumer: '#F59E0B',
  Financials: '#10B981',
  Communication: '#A78BFA',
  'Index ETF': '#64748B',
  Cash: '#94A3B8',
};

const CURVE_TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y'];

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  assets,
  positions,
  cashBalance,
  trades,
  onOpenTrade,
  onInspectSymbol,
}) => {
  const [curveTf, setCurveTf] = useState<Timeframe>('3M');
  const [sortKey, setSortKey] = useState<SortKey>('marketValue');
  const [sortAsc, setSortAsc] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [chartWidth, setChartWidth] = useState(640);

  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setChartWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    ro.observe(el);
    setChartWidth(Math.floor(el.getBoundingClientRect().width) || 640);
    return () => ro.disconnect();
  }, []);

  const assetMap = useMemo(() => new Map(assets.map((a) => [a.symbol, a])), [assets]);

  const enrichedHoldings = useMemo(() => {
    const rows = positions
      .filter((p) => p.shares > 0)
      .map((pos) => {
        const asset = assetMap.get(pos.symbol);
        const price = asset?.price ?? pos.avgCost;
        const prevClose = asset?.previousClose ?? price;
        const marketValue = pos.shares * price;
        const costBasis = pos.shares * pos.avgCost;
        const totalReturn = marketValue - costBasis;
        const totalReturnPct = costBasis > 0 ? (totalReturn / costBasis) * 100 : 0;
        const dayChange = pos.shares * (price - prevClose);
        const dayChangePct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;

        return {
          ...pos,
          name: asset?.name ?? pos.symbol,
          sector: asset?.sector ?? 'Other',
          beta: asset?.beta ?? 1,
          price,
          marketValue,
          costBasis,
          totalReturn,
          totalReturnPct,
          dayChange,
          dayChangePct,
        };
      });

    const equityTotal = rows.reduce((acc, r) => acc + r.marketValue, 0);
    const totalPortfolio = equityTotal + cashBalance;

    return rows.map((r) => ({
      ...r,
      weight: totalPortfolio > 0 ? (r.marketValue / totalPortfolio) * 100 : 0,
    }));
  }, [positions, assetMap, cashBalance]);

  const metrics = useMemo(() => {
    const equityValue = enrichedHoldings.reduce((acc, h) => acc + h.marketValue, 0);
    const totalValue = equityValue + cashBalance;
    const totalCost = enrichedHoldings.reduce((acc, h) => acc + h.costBasis, 0);
    const unrealizedPnl = equityValue - totalCost;
    const unrealizedPct = totalCost > 0 ? (unrealizedPnl / totalCost) * 100 : 0;
    const dayPnl = enrichedHoldings.reduce((acc, h) => acc + h.dayChange, 0);
    const prevTotal = totalValue - dayPnl;
    const dayPnlPct = prevTotal > 0 ? (dayPnl / prevTotal) * 100 : 0;
    const weightedBeta =
      equityValue > 0
        ? enrichedHoldings.reduce((acc, h) => acc + h.beta * (h.marketValue / equityValue), 0)
        : 0;
    const cashPct = totalValue > 0 ? (cashBalance / totalValue) * 100 : 100;

    return {
      totalValue,
      equityValue,
      unrealizedPnl,
      unrealizedPct,
      dayPnl,
      dayPnlPct,
      weightedBeta,
      cashPct,
    };
  }, [enrichedHoldings, cashBalance]);

  const sectorBreakdown = useMemo(() => {
    const map = new Map<string, { value: number; dayPnl: number }>();
    for (const h of enrichedHoldings) {
      const cur = map.get(h.sector) ?? { value: 0, dayPnl: 0 };
      cur.value += h.marketValue;
      cur.dayPnl += h.dayChange;
      map.set(h.sector, cur);
    }
    if (cashBalance > 0) {
      map.set('Cash', { value: cashBalance, dayPnl: 0 });
    }
    const list = Array.from(map.entries()).map(([sector, data]) => ({
      sector,
      value: data.value,
      dayPnl: data.dayPnl,
      weight: metrics.totalValue > 0 ? (data.value / metrics.totalValue) * 100 : 0,
      color: SECTOR_COLORS[sector] ?? '#64748B',
    }));
    return list.sort((a, b) => b.value - a.value);
  }, [enrichedHoldings, cashBalance, metrics.totalValue]);

  const sortedHoldings = useMemo(() => {
    const copy = [...enrichedHoldings];
    copy.sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'symbol') cmp = a.symbol.localeCompare(b.symbol);
      else cmp = a[sortKey] - b[sortKey];
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [enrichedHoldings, sortKey, sortAsc]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // Equity curve vs SPY
  const curvePoints = useMemo(
    () => buildPortfolioEquityCurve(assets, positions, cashBalance, curveTf),
    [assets, positions, cashBalance, curveTf]
  );

  const chartHeight = 228;
  const padL = 8;
  const padR = 54;
  const padT = 16;
  const padB = 26;
  const plotW = Math.max(180, chartWidth - padL - padR);
  const plotH = chartHeight - padT - padB;

  const { minRet, maxRet } = useMemo(() => {
    let min = 0;
    let max = 0;
    for (const p of curvePoints) {
      min = Math.min(min, p.portfolioReturn, p.benchmarkReturn);
      max = Math.max(max, p.portfolioReturn, p.benchmarkReturn);
    }
    const span = Math.max(1, max - min);
    return { minRet: min - span * 0.12, maxRet: max + span * 0.12 };
  }, [curvePoints]);

  const xFor = (i: number) =>
    padL + (i / Math.max(1, curvePoints.length - 1)) * plotW;
  const yFor = (val: number) =>
    padT + ((maxRet - val) / Math.max(1e-5, maxRet - minRet)) * plotH;

  const portPath = useMemo(
    () =>
      curvePoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.portfolioReturn).toFixed(1)}`)
        .join(' '),
    [curvePoints, chartWidth, minRet, maxRet]
  );

  const spyPath = useMemo(
    () =>
      curvePoints
        .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.benchmarkReturn).toFixed(1)}`)
        .join(' '),
    [curvePoints, chartWidth, minRet, maxRet]
  );

  const activePoint =
    curvePoints[
      hoverIdx !== null && hoverIdx < curvePoints.length
        ? hoverIdx
        : curvePoints.length - 1
    ];

  const alphaSpread = activePoint
    ? activePoint.portfolioReturn - activePoint.benchmarkReturn
    : 0;

  return (
    <div className="space-y-6">
      {/* 4-Column Flat KPI Summary Strip */}
      <section
        aria-label="Portfolio performance summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-slate-800/90"
      >
        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Total Portfolio Value
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {formatCurrency(metrics.totalValue)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            Equities {formatCurrency(metrics.equityValue)} · {enrichedHoldings.length} positions
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Today's Return
          </div>
          <div
            className={`mt-1.5 font-mono tabular-nums text-2xl font-semibold ${
              metrics.dayPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatSignedCurrency(metrics.dayPnl)}
          </div>
          <div
            className={`mt-1 text-xs font-mono tabular-nums ${
              metrics.dayPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {metrics.dayPnl >= 0 ? '▲' : '▼'} {formatPercent(metrics.dayPnlPct, false)} intraday
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Unrealized P&amp;L
          </div>
          <div
            className={`mt-1.5 font-mono tabular-nums text-2xl font-semibold ${
              metrics.unrealizedPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {formatSignedCurrency(metrics.unrealizedPnl)}
          </div>
          <div
            className={`mt-1 text-xs font-mono tabular-nums ${
              metrics.unrealizedPnl >= 0
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {metrics.unrealizedPnl >= 0 ? '▲' : '▼'} {formatPercent(metrics.unrealizedPct, false)} vs cost basis
          </div>
        </div>

        <div className="p-5">
          <div className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Buying Power &amp; Beta
          </div>
          <div className="mt-1.5 font-mono tabular-nums text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {formatCurrency(cashBalance)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 font-mono tabular-nums">
            {metrics.cashPct.toFixed(1)}% Cash · Weighted Beta {metrics.weightedBeta.toFixed(2)}
          </div>
        </div>
      </section>

      {/* Performance Curve + Sector Allocation Split */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch">
        {/* Equity Curve vs Benchmark */}
        <section className="xl:col-span-8 bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
                Portfolio Performance vs. S&amp;P 500 (SPY)
              </h2>
              {activePoint && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs font-mono tabular-nums">
                  <span className="text-slate-500 dark:text-slate-400">{activePoint.label}</span>
                  <span className="text-sky-600 dark:text-sky-400">
                    Portfolio {formatPercent(activePoint.portfolioReturn)}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400">
                    SPY {formatPercent(activePoint.benchmarkReturn)}
                  </span>
                  <span
                    className={
                      alphaSpread >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }
                  >
                    Alpha {formatPercent(alphaSpread)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
              {CURVE_TIMEFRAMES.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setCurveTf(tf)}
                  className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors cursor-pointer ${
                    curveTf === tf
                      ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div ref={chartContainerRef} className="p-4 flex-1 flex items-center">
            <svg
              width={chartWidth - 32 > 180 ? chartWidth - 32 : chartWidth}
              height={chartHeight}
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              className="w-full block cursor-crosshair select-none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const relX = ((e.clientX - rect.left) / rect.width) * chartWidth - padL;
                if (relX < 0 || relX > plotW) {
                  setHoverIdx(null);
                  return;
                }
                const idx = Math.round((relX / plotW) * (curvePoints.length - 1));
                setHoverIdx(Math.max(0, Math.min(curvePoints.length - 1, idx)));
              }}
              onMouseLeave={() => setHoverIdx(null)}
              role="img"
              aria-label="Portfolio return compared to S&P 500 benchmark"
            >
              {/* Grid lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((frac, idx) => {
                const val = minRet + (maxRet - minRet) * frac;
                const y = yFor(val);
                return (
                  <g key={`cg-${idx}`}>
                    <line
                      x1={padL}
                      x2={padL + plotW}
                      y1={y}
                      y2={y}
                      className="stroke-slate-200/80 dark:stroke-slate-800/80"
                      strokeDasharray="2 3"
                    />
                    <text
                      x={padL + plotW + 6}
                      y={y + 3.5}
                      className="fill-slate-500 dark:fill-slate-400 font-mono"
                      fontSize="10"
                    >
                      {val >= 0 ? '+' : ''}
                      {val.toFixed(1)}%
                    </text>
                  </g>
                );
              })}

              {/* 0% baseline */}
              <line
                x1={padL}
                x2={padL + plotW}
                y1={yFor(0)}
                y2={yFor(0)}
                className="stroke-slate-300 dark:stroke-slate-700"
                strokeWidth="1"
              />

              {/* SPY Benchmark Line */}
              <path
                d={spyPath}
                fill="none"
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth="1.4"
                strokeDasharray="4 3"
              />

              {/* Portfolio Equity Line */}
              <path
                d={portPath}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Hover Marker */}
              {hoverIdx !== null && curvePoints[hoverIdx] && (
                <g pointerEvents="none">
                  <line
                    x1={xFor(hoverIdx)}
                    x2={xFor(hoverIdx)}
                    y1={padT}
                    y2={padT + plotH}
                    className="stroke-slate-400 dark:stroke-slate-600"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={xFor(hoverIdx)}
                    cy={yFor(curvePoints[hoverIdx].portfolioReturn)}
                    r={4}
                    fill="#38BDF8"
                    stroke="#0B0F17"
                    strokeWidth="1.5"
                  />
                  <circle
                    cx={xFor(hoverIdx)}
                    cy={yFor(curvePoints[hoverIdx].benchmarkReturn)}
                    r={3.5}
                    className="fill-slate-400"
                    stroke="#0B0F17"
                    strokeWidth="1.5"
                  />
                </g>
              )}

              {/* X labels */}
              {[0, Math.floor(curvePoints.length / 2), curvePoints.length - 1].map((idx) => {
                const pt = curvePoints[idx];
                if (!pt) return null;
                return (
                  <text
                    key={`cl-${idx}`}
                    x={xFor(idx)}
                    y={chartHeight - 6}
                    textAnchor={idx === 0 ? 'start' : idx === curvePoints.length - 1 ? 'end' : 'middle'}
                    className="fill-slate-500 dark:fill-slate-400 font-mono"
                    fontSize="10"
                  >
                    {pt.label}
                  </text>
                );
              })}
            </svg>
          </div>
        </section>

        {/* Sector Allocation */}
        <section className="xl:col-span-4 bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg p-5 flex flex-col">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Allocation by Sector
            </h2>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
              {sectorBreakdown.length} groups
            </span>
          </div>

          {/* Stacked Bar */}
          <div className="mt-4 h-3 w-full rounded-sm overflow-hidden flex bg-slate-100 dark:bg-slate-800">
            {sectorBreakdown.map((seg) => (
              <div
                key={seg.sector}
                style={{ width: `${seg.weight}%`, backgroundColor: seg.color }}
                title={`${seg.sector}: ${seg.weight.toFixed(1)}%`}
                className="h-full transition-all duration-200"
              />
            ))}
          </div>

          {/* Breakdown Rows */}
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800/70 flex-1">
            {sectorBreakdown.map((seg) => (
              <div
                key={seg.sector}
                className="py-2.5 flex items-center justify-between text-xs gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-[2px] shrink-0"
                    style={{ backgroundColor: seg.color }}
                  />
                  <span className="text-slate-700 dark:text-slate-200 truncate">
                    {seg.sector}
                  </span>
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums shrink-0">
                  <span className="text-slate-500 dark:text-slate-400">
                    {formatCurrency(seg.value, 0)}
                  </span>
                  <span className="w-12 text-right font-medium text-slate-900 dark:text-slate-100">
                    {seg.weight.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Holdings Table */}
      <section className="bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
              Current Positions
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Live mark-to-market valuations updated with market stream
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpenTrade(assets[0]?.symbol ?? 'NVDA', 'BUY')}
            className="px-3.5 py-1.5 text-xs font-medium rounded-md bg-slate-900 text-white dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            New Order
          </button>
        </div>

        {sortedHoldings.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
              No open equity positions
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              You hold {formatCurrency(cashBalance)} in cash. Place a buy order to open your first position.
            </p>
            <button
              type="button"
              onClick={() => onOpenTrade('NVDA', 'BUY')}
              className="mt-4 px-4 py-2 text-xs font-medium rounded-md bg-sky-600 text-white hover:bg-sky-500 transition-colors cursor-pointer"
            >
              Buy First Position
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800/90 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D121D]">
                  <th className="py-2.5 pl-5 pr-3">
                    <button
                      type="button"
                      onClick={() => handleSort('symbol')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Symbol <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">Shares</th>
                  <th className="py-2.5 px-3 text-right">Avg Cost</th>
                  <th className="py-2.5 px-3 text-right">Last Price</th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('marketValue')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Market Value <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('dayChange')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Day P&amp;L <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('totalReturnPct')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Total Return <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleSort('weight')}
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
                    >
                      Weight <ArrowUpDown className="w-3 h-3" />
                    </button>
                  </th>
                  <th className="py-2.5 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 text-xs">
                {sortedHoldings.map((row) => {
                  const dayUp = row.dayChange >= 0;
                  const retUp = row.totalReturn >= 0;
                  return (
                    <tr
                      key={row.symbol}
                      className="hover:bg-slate-50/90 dark:hover:bg-slate-800/35 transition-colors"
                    >
                      <td className="py-3 pl-5 pr-3">
                        <button
                          type="button"
                          onClick={() => onInspectSymbol(row.symbol)}
                          className="text-left group cursor-pointer"
                        >
                          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 group-hover:text-sky-600 dark:group-hover:text-sky-400 inline-flex items-center gap-1">
                            {row.symbol}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[150px]">
                            {row.name}
                          </div>
                        </button>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {row.shares}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-600 dark:text-slate-400">
                        {formatCurrency(row.avgCost)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.price)}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                        {formatCurrency(row.marketValue)}
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums ${
                          dayUp
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <div>{formatSignedCurrency(row.dayChange)}</div>
                        <div className="text-[11px] opacity-85">
                          {dayUp ? '▲' : '▼'} {formatPercent(row.dayChangePct, false)}
                        </div>
                      </td>
                      <td
                        className={`py-3 px-3 text-right font-mono tabular-nums ${
                          retUp
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        <div>{formatSignedCurrency(row.totalReturn)}</div>
                        <div className="text-[11px] opacity-85">
                          {retUp ? '▲' : '▼'} {formatPercent(row.totalReturnPct, false)}
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 dark:text-slate-300">
                        {row.weight.toFixed(1)}%
                      </td>
                      <td className="py-3 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenTrade(row.symbol, 'BUY')}
                            className="px-2.5 py-1 text-[11px] font-medium rounded border border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-600/10 transition-colors cursor-pointer"
                          >
                            Buy
                          </button>
                          <button
                            type="button"
                            onClick={() => onOpenTrade(row.symbol, 'SELL')}
                            className="px-2.5 py-1 text-[11px] font-medium rounded border border-rose-600/30 text-rose-700 dark:text-rose-400 hover:bg-rose-600/10 transition-colors cursor-pointer"
                          >
                            Sell
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Recent Executions Ledger */}
      <section className="bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/90 flex items-center justify-between">
          <h2 className="font-display text-sm font-semibold text-slate-900 dark:text-slate-100">
            Recent Executions
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
            {trades.length} orders
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800/90 text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-50/70 dark:bg-[#0D121D]">
                <th className="py-2.5 pl-5 pr-3">Timestamp</th>
                <th className="py-2.5 px-3">Side</th>
                <th className="py-2.5 px-3">Symbol</th>
                <th className="py-2.5 px-3 text-right">Shares</th>
                <th className="py-2.5 px-3 text-right">Fill Price</th>
                <th className="py-2.5 pl-3 pr-5 text-right">Notional Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70 font-mono tabular-nums">
              {trades.slice(0, 8).map((trd) => (
                <tr key={trd.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/25">
                  <td className="py-2.5 pl-5 pr-3 text-slate-500 dark:text-slate-400">
                    {new Date(trd.timestamp).toLocaleString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td
                    className={`py-2.5 px-3 font-semibold ${
                      trd.side === 'BUY'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {trd.side}
                  </td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-slate-100">
                    {trd.symbol}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                    {trd.shares}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-700 dark:text-slate-300">
                    {formatCurrency(trd.price)}
                  </td>
                  <td className="py-2.5 pl-3 pr-5 text-right font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(trd.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
};
