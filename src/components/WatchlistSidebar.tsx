import React, { useMemo, useState } from 'react';
import {
  Activity,
  Briefcase,
  LineChart,
  Pause,
  Play,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { ActiveView, StockAsset } from '../types/market';
import { formatCurrency, formatPercent } from '../utils/indicators';

interface WatchlistSidebarProps {
  assets: StockAsset[];
  selectedSymbol: string;
  onSelectSymbol: (symbol: string) => void;
  activeView: ActiveView;
  onChangeView: (view: ActiveView) => void;
  isLive: boolean;
  onToggleLive: () => void;
  onResetSimulation: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

const MiniSparkline: React.FC<{ values: number[]; isUp: boolean }> = ({ values, isUp }) => {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = Math.max(1e-5, max - min);
  const w = 48;
  const h = 18;
  const pts = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / span) * (h - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" className="shrink-0">
      <polyline
        fill="none"
        stroke={isUp ? '#10B981' : '#EF4444'}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
      />
    </svg>
  );
};

export const WatchlistSidebar: React.FC<WatchlistSidebarProps> = ({
  assets,
  selectedSymbol,
  onSelectSymbol,
  activeView,
  onChangeView,
  isLive,
  onToggleLive,
  onResetSimulation,
  isOpenMobile,
  onCloseMobile,
}) => {
  const [query, setQuery] = useState('');

  const filteredAssets = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return assets;
    return assets.filter(
      (a) =>
        a.symbol.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.sector.toLowerCase().includes(q)
    );
  }, [assets, query]);

  const navItems: { id: ActiveView; label: string; icon: React.ReactNode }[] = [
    { id: 'market', label: 'Market Chart', icon: <LineChart className="w-4 h-4" /> },
    { id: 'portfolio', label: 'Portfolio', icon: <Briefcase className="w-4 h-4" /> },
    { id: 'technicals', label: 'Technicals', icon: <Activity className="w-4 h-4" /> },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0E131E] border-r border-slate-200 dark:border-slate-800/90 w-[268px]">
      {/* Brand Header */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        <button
          type="button"
          onClick={() => onChangeView('market')}
          className="font-display text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          Meridian Markets
        </button>
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close navigation drawer"
          className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Primary Workspace Navigation */}
      <nav aria-label="Workspace sections" className="p-2.5 border-b border-slate-200 dark:border-slate-800/90 shrink-0">
        <div className="space-y-0.5">
          {navItems.map((item) => {
            const active = activeView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onChangeView(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-slate-800/90 dark:text-slate-50'
                    : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/45 hover:text-slate-900 dark:hover:text-slate-100'
                }`}
              >
                <span className={active ? 'text-sky-400' : 'text-slate-400 dark:text-slate-500'}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Watchlist Header & Search */}
      <div className="px-3 pt-3 pb-2 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            Watchlist
          </h2>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleLive}
              title={isLive ? 'Pause live market feed' : 'Resume live market feed'}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isLive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
              <span>{isLive ? 'Live' : 'Paused'}</span>
            </button>
            <button
              type="button"
              onClick={onResetSimulation}
              title="Reset simulated prices"
              aria-label="Reset simulated prices"
              className="p-1 rounded border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter symbol or sector..."
            aria-label="Filter watchlist symbols"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md bg-slate-50 dark:bg-[#131A29] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-500"
          />
        </div>
      </div>

      {/* Watchlist Items */}
      <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/60">
        {filteredAssets.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
            No matching symbols for "{query}".
          </div>
        ) : (
          filteredAssets.map((asset) => {
            const change = asset.price - asset.previousClose;
            const changePct = (change / Math.max(0.01, asset.previousClose)) * 100;
            const isUp = change >= 0;
            const isSelected = asset.symbol === selectedSymbol;
            const intradayCloses = asset.history['1D'].slice(-24).map((c) => c.close);
            const flashClass =
              asset.lastTickDirection === 'up'
                ? 'tick-flash-up'
                : asset.lastTickDirection === 'down'
                ? 'tick-flash-down'
                : '';

            return (
              <button
                key={asset.symbol}
                type="button"
                onClick={() => {
                  onSelectSymbol(asset.symbol);
                  onCloseMobile();
                }}
                className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-sky-50/90 dark:bg-sky-500/10'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/35'
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`font-mono text-xs font-semibold ${
                        isSelected
                          ? 'text-sky-700 dark:text-sky-300'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {asset.symbol}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[96px]">
                    {asset.name}
                  </p>
                </div>

                <MiniSparkline values={intradayCloses} isUp={isUp} />

                <div
                  key={`${asset.symbol}-${asset.lastTickId}`}
                  className={`text-right font-mono tabular-nums px-1 py-0.5 rounded ${flashClass}`}
                >
                  <div className="text-xs font-medium text-slate-900 dark:text-slate-100">
                    {formatCurrency(asset.price)}
                  </div>
                  <div
                    className={`text-[11px] ${
                      isUp
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isUp ? '▲' : '▼'} {formatPercent(changePct, false)}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block shrink-0 h-screen sticky top-0">{content}</aside>

      {/* Mobile slide-over drawer */}
      {isOpenMobile && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[1px]"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{content}</aside>
        </div>
      )}
    </>
  );
};
