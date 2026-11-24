import { useCallback, useEffect, useMemo, useState } from 'react';
import { Menu, Moon, Sun } from 'lucide-react';
import {
  ActiveView,
  ChartMode,
  IndicatorConfig,
  PortfolioPosition,
  StockAsset,
  Timeframe,
  TradeRecord,
} from './types/market';
import {
  createInitialMarketData,
  INITIAL_CASH_BALANCE,
  INITIAL_POSITIONS,
  INITIAL_TRADES,
  stepMarketTick,
} from './data/marketEngine';
import { WatchlistSidebar } from './components/WatchlistSidebar';
import { MarketOverviewView } from './components/MarketOverviewView';
import { PortfolioView } from './components/PortfolioView';
import { TechnicalScreenerView } from './components/TechnicalScreenerView';
import { TradeModal } from './components/TradeModal';
import { formatCurrency } from './utils/indicators';

const STORAGE_KEYS = {
  positions: 'meridian_positions_v1',
  cash: 'meridian_cash_v1',
  trades: 'meridian_trades_v1',
  theme: 'meridian_theme_v1',
};

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [assets, setAssets] = useState<StockAsset[]>(() => createInitialMarketData());
  const [selectedSymbol, setSelectedSymbol] = useState<string>('NVDA');
  const [activeView, setActiveView] = useState<ActiveView>('market');
  const [timeframe, setTimeframe] = useState<Timeframe>('1D');
  const [chartMode, setChartMode] = useState<ChartMode>('candle');
  const [isLive, setIsLive] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  const [indicators, setIndicators] = useState<IndicatorConfig>({
    sma20: true,
    ema50: true,
    bollinger: false,
    vwap: false,
    volume: true,
    rsi: true,
    macd: false,
  });

  const [positions, setPositions] = useState<PortfolioPosition[]>(() =>
    loadJson(STORAGE_KEYS.positions, INITIAL_POSITIONS)
  );
  const [cashBalance, setCashBalance] = useState<number>(() =>
    loadJson(STORAGE_KEYS.cash, INITIAL_CASH_BALANCE)
  );
  const [trades, setTrades] = useState<TradeRecord[]>(() =>
    loadJson(STORAGE_KEYS.trades, INITIAL_TRADES)
  );

  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = loadJson<string | null>(STORAGE_KEYS.theme, null);
    if (saved === 'light') return false;
    return true;
  });

  const [tradeModalState, setTradeModalState] = useState<{
    isOpen: boolean;
    symbol: string;
    side: 'BUY' | 'SELL';
  }>({
    isOpen: false,
    symbol: 'NVDA',
    side: 'BUY',
  });

  const [orderNotice, setOrderNotice] = useState<string | null>(null);

  // Sync Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (isDark) root.classList.add('dark');
    else root.classList.remove('dark');
    try {
      window.localStorage.setItem(STORAGE_KEYS.theme, JSON.stringify(isDark ? 'dark' : 'light'));
    } catch {
      // Ignore storage quota errors
    }
  }, [isDark]);

  // Persist portfolio changes
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.positions, JSON.stringify(positions));
      window.localStorage.setItem(STORAGE_KEYS.cash, JSON.stringify(cashBalance));
      window.localStorage.setItem(STORAGE_KEYS.trades, JSON.stringify(trades));
    } catch {
      // Ignore storage quota errors
    }
  }, [positions, cashBalance, trades]);

  // Real-time streaming tick simulation
  useEffect(() => {
    if (!isLive) return;
    const timer = window.setInterval(() => {
      setAssets((prev) => stepMarketTick(prev));
    }, 1350);
    return () => window.clearInterval(timer);
  }, [isLive]);

  // Auto-dismiss trade confirmation banner
  useEffect(() => {
    if (!orderNotice) return;
    const t = window.setTimeout(() => setOrderNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [orderNotice]);

  const selectedAsset = useMemo(
    () => assets.find((a) => a.symbol === selectedSymbol) ?? assets[0],
    [assets, selectedSymbol]
  );

  const handleToggleIndicator = useCallback((key: keyof IndicatorConfig) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const handleOpenTrade = useCallback((symbol: string, side: 'BUY' | 'SELL') => {
    setTradeModalState({ isOpen: true, symbol, side });
  }, []);

  const handleExecuteTrade = useCallback(
    (symbol: string, side: 'BUY' | 'SELL', shares: number) => {
      const target = assets.find((a) => a.symbol === symbol);
      if (!target || shares <= 0) return;

      const fillPrice = target.price;
      const total = Number((shares * fillPrice).toFixed(2));

      if (side === 'BUY') {
        if (total > cashBalance) return;
        setCashBalance((c) => Number((c - total).toFixed(2)));
        setPositions((prev) => {
          const existing = prev.find((p) => p.symbol === symbol);
          if (!existing) {
            return [...prev, { symbol, shares, avgCost: fillPrice }];
          }
          const newShares = existing.shares + shares;
          const newAvg =
            (existing.shares * existing.avgCost + shares * fillPrice) / newShares;
          return prev.map((p) =>
            p.symbol === symbol
              ? { ...p, shares: newShares, avgCost: Number(newAvg.toFixed(2)) }
              : p
          );
        });
      } else {
        const existing = positions.find((p) => p.symbol === symbol);
        if (!existing || existing.shares < shares) return;
        setCashBalance((c) => Number((c + total).toFixed(2)));
        setPositions((prev) =>
          prev
            .map((p) => (p.symbol === symbol ? { ...p, shares: p.shares - shares } : p))
            .filter((p) => p.shares > 0)
        );
      }

      const record: TradeRecord = {
        id: `trd-${Date.now()}`,
        timestamp: Date.now(),
        symbol,
        side,
        shares,
        price: fillPrice,
        total,
      };
      setTrades((prev) => [record, ...prev]);
      setOrderNotice(
        `${side === 'BUY' ? 'Bought' : 'Sold'} ${shares} ${symbol} @ ${formatCurrency(fillPrice)} (${formatCurrency(total)})`
      );
    },
    [assets, cashBalance, positions]
  );

  const handleResetSimulation = useCallback(() => {
    setAssets(createInitialMarketData());
  }, []);

  const handleSelectFromSidebar = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    if (activeView === 'portfolio') {
      setActiveView('market');
    }
  }, [activeView]);

  const handleInspectOnChart = useCallback((symbol: string) => {
    setSelectedSymbol(symbol);
    setActiveView('market');
  }, []);

  const viewTitle =
    activeView === 'market'
      ? `Market Chart / ${selectedAsset.symbol}`
      : activeView === 'portfolio'
      ? 'Portfolio Performance'
      : 'Technical Analysis Screener';

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100">
      {/* Left Navigation & Live Watchlist Rail */}
      <WatchlistSidebar
        assets={assets}
        selectedSymbol={selectedAsset.symbol}
        onSelectSymbol={handleSelectFromSidebar}
        activeView={activeView}
        onChangeView={setActiveView}
        isLive={isLive}
        onToggleLive={() => setIsLive((v) => !v)}
        onResetSimulation={handleResetSimulation}
        isOpenMobile={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Main Workspace Canvas */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Contextual Workspace Header (Single-Row SaaS Contract) */}
        <header className="h-14 sticky top-0 z-30 bg-white/95 dark:bg-[#0E131E]/95 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800/90 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open watchlist and navigation"
              className="lg:hidden p-1.5 -ml-1 rounded-md text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0 truncate">
              <span className="text-slate-500 dark:text-slate-400 hidden sm:inline">
                Workspace
              </span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700 hidden sm:inline">
                /
              </span>
              <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                {viewTitle}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setIsDark((d) => !d)}
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              title={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
              className="p-2 rounded-md border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              type="button"
              onClick={() => handleOpenTrade(selectedAsset.symbol, 'BUY')}
              className="px-4 py-2 text-xs font-semibold rounded-md bg-slate-900 text-white dark:bg-sky-600 hover:bg-slate-800 dark:hover:bg-sky-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Trade
            </button>
          </div>
        </header>

        {/* Execution Confirmation Notice */}
        {orderNotice && (
          <div
            role="status"
            className="mx-4 sm:mx-6 mt-4 px-4 py-2.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/70 text-xs font-medium text-emerald-800 dark:text-emerald-300 flex items-center justify-between"
          >
            <span>Order filled: {orderNotice}</span>
            <button
              type="button"
              onClick={() => setOrderNotice(null)}
              className="text-emerald-700 dark:text-emerald-400 hover:underline ml-4 cursor-pointer"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active View Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activeView === 'market' && (
            <MarketOverviewView
              asset={selectedAsset}
              assets={assets}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              chartMode={chartMode}
              onChartModeChange={setChartMode}
              indicators={indicators}
              onToggleIndicator={handleToggleIndicator}
              positions={positions}
              cashBalance={cashBalance}
              onOpenTrade={handleOpenTrade}
              onNavigatePortfolio={() => setActiveView('portfolio')}
              onNavigateTechnicals={() => setActiveView('technicals')}
            />
          )}

          {activeView === 'portfolio' && (
            <PortfolioView
              assets={assets}
              positions={positions}
              cashBalance={cashBalance}
              trades={trades}
              onOpenTrade={handleOpenTrade}
              onInspectSymbol={handleInspectOnChart}
            />
          )}

          {activeView === 'technicals' && (
            <TechnicalScreenerView
              assets={assets}
              selectedSymbol={selectedAsset.symbol}
              timeframe={timeframe}
              onTimeframeChange={setTimeframe}
              onSelectSymbol={setSelectedSymbol}
              onOpenInChart={handleInspectOnChart}
            />
          )}
        </main>
      </div>

      {/* Order Execution Ticket Modal */}
      <TradeModal
        isOpen={tradeModalState.isOpen}
        initialSymbol={tradeModalState.symbol}
        initialSide={tradeModalState.side}
        assets={assets}
        positions={positions}
        cashBalance={cashBalance}
        onClose={() => setTradeModalState((s) => ({ ...s, isOpen: false }))}
        onExecuteTrade={handleExecuteTrade}
      />
    </div>
  );
}
