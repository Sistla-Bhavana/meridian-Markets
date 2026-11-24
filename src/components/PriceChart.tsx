import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CandlestickChart, TrendingUp } from 'lucide-react';
import { Candle, ChartMode, IndicatorConfig, StockAsset, Timeframe } from '../types/market';
import {
  calculateBollingerBands,
  calculateEMA,
  calculateMACD,
  calculateRSI,
  calculateSMA,
  calculateVWAP,
  formatCompactVolume,
  formatCurrency,
} from '../utils/indicators';

interface PriceChartProps {
  asset: StockAsset;
  timeframe: Timeframe;
  onTimeframeChange: (tf: Timeframe) => void;
  chartMode: ChartMode;
  onChartModeChange: (mode: ChartMode) => void;
  indicators: IndicatorConfig;
  onToggleIndicator: (key: keyof IndicatorConfig) => void;
}

const TIMEFRAMES: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y'];

function buildPolylinePath(
  values: (number | null)[],
  xForIndex: (i: number) => number,
  yForValue: (v: number) => number
): string {
  let d = '';
  let started = false;
  for (let i = 0; i < values.length; i++) {
    const val = values[i];
    if (val === null || !Number.isFinite(val)) {
      started = false;
      continue;
    }
    const x = xForIndex(i).toFixed(1);
    const y = yForValue(val).toFixed(1);
    d += started ? ` L ${x} ${y}` : ` M ${x} ${y}`;
    started = true;
  }
  return d;
}

export const PriceChart: React.FC<PriceChartProps> = ({
  asset,
  timeframe,
  onTimeframeChange,
  chartMode,
  onChartModeChange,
  indicators,
  onToggleIndicator,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(860);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 0) {
          setWidth(Math.floor(entry.contentRect.width));
        }
      }
    });
    ro.observe(el);
    setWidth(Math.floor(el.getBoundingClientRect().width) || 860);
    return () => ro.disconnect();
  }, []);

  const candles: Candle[] = asset.history[timeframe];

  const computed = useMemo(() => {
    const closes = candles.map((c) => c.close);
    return {
      sma20: calculateSMA(closes, 20),
      ema50: calculateEMA(closes, 50),
      bollinger: calculateBollingerBands(closes, 20, 2),
      vwap: calculateVWAP(candles),
      rsi: calculateRSI(closes, 14),
      macd: calculateMACD(closes, 12, 26, 9),
    };
  }, [candles]);

  // Layout geometry
  const padLeft = 12;
  const padRight = 72;
  const plotWidth = Math.max(200, width - padLeft - padRight);
  const priceTop = 14;
  const priceHeight = 300;
  const gap = 14;

  const volHeight = indicators.volume ? 68 : 0;
  const rsiHeight = indicators.rsi ? 96 : 0;
  const macdHeight = indicators.macd ? 98 : 0;
  const xAxisHeight = 26;

  let cursorY = priceTop + priceHeight;
  const volTop = indicators.volume ? cursorY + gap : 0;
  if (indicators.volume) cursorY = volTop + volHeight;

  const rsiTop = indicators.rsi ? cursorY + gap : 0;
  if (indicators.rsi) cursorY = rsiTop + rsiHeight;

  const macdTop = indicators.macd ? cursorY + gap : 0;
  if (indicators.macd) cursorY = macdTop + macdHeight;

  const totalHeight = cursorY + xAxisHeight;

  // Price domain
  const { minPrice, maxPrice } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;
    candles.forEach((c, idx) => {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
      if (indicators.bollinger) {
        const bb = computed.bollinger[idx];
        if (bb?.lower !== null && bb.lower < min) min = bb.lower;
        if (bb?.upper !== null && bb.upper > max) max = bb.upper;
      }
      if (indicators.sma20) {
        const s = computed.sma20[idx];
        if (s !== null) {
          if (s < min) min = s;
          if (s > max) max = s;
        }
      }
      if (indicators.ema50) {
        const e = computed.ema50[idx];
        if (e !== null) {
          if (e < min) min = e;
          if (e > max) max = e;
        }
      }
    });
    if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
      return { minPrice: asset.price * 0.95, maxPrice: asset.price * 1.05 };
    }
    const pad = (max - min) * 0.08;
    return { minPrice: min - pad, maxPrice: max + pad };
  }, [candles, computed, indicators.bollinger, indicators.sma20, indicators.ema50, asset.price]);

  const maxVolume = useMemo(
    () => Math.max(1, ...candles.map((c) => c.volume)),
    [candles]
  );

  const macdExtremum = useMemo(() => {
    let maxAbs = 0.2;
    computed.macd.forEach((p) => {
      if (p.macd !== null) maxAbs = Math.max(maxAbs, Math.abs(p.macd));
      if (p.signal !== null) maxAbs = Math.max(maxAbs, Math.abs(p.signal));
      if (p.histogram !== null) maxAbs = Math.max(maxAbs, Math.abs(p.histogram));
    });
    return maxAbs * 1.15;
  }, [computed.macd]);

  const count = Math.max(1, candles.length);
  const stepX = plotWidth / count;
  const candleWidth = Math.max(2.5, Math.min(11, stepX * 0.64));

  const xForIndex = (i: number) => padLeft + (i + 0.5) * stepX;
  const yForPrice = (p: number) =>
    priceTop + ((maxPrice - p) / Math.max(1e-6, maxPrice - minPrice)) * priceHeight;
  const yForRsi = (r: number) => rsiTop + ((100 - r) / 100) * rsiHeight;
  const yForMacd = (v: number) =>
    macdTop + ((macdExtremum - v) / (2 * macdExtremum)) * macdHeight;

  const activeIdx = hoverIndex !== null && hoverIndex < candles.length ? hoverIndex : candles.length - 1;
  const activeCandle = candles[activeIdx];
  const prevCandle = activeIdx > 0 ? candles[activeIdx - 1] : activeCandle;
  const activeChange = activeCandle ? activeCandle.close - activeCandle.open : 0;
  const activeUp = activeChange >= 0;

  const lastCandle = candles[candles.length - 1];
  const seriesUp = candles.length > 1 ? lastCandle.close >= candles[0].open : true;

  // Grid ticks for price axis
  const priceTicks = useMemo(() => {
    const ticks: number[] = [];
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      ticks.push(minPrice + ((maxPrice - minPrice) * i) / steps);
    }
    return ticks;
  }, [minPrice, maxPrice]);

  // X-axis labels
  const xTickIndices = useMemo(() => {
    const targetCount = width < 560 ? 4 : width < 820 ? 6 : 8;
    const stride = Math.max(1, Math.floor(candles.length / targetCount));
    const indices: number[] = [];
    for (let i = Math.floor(stride / 2); i < candles.length; i += stride) {
      indices.push(i);
    }
    return indices;
  }, [candles.length, width]);

  // Bollinger polygon area
  const bollingerPolygon = useMemo(() => {
    if (!indicators.bollinger) return '';
    const upperPts: string[] = [];
    const lowerPts: string[] = [];
    computed.bollinger.forEach((bb, i) => {
      if (bb.upper !== null && bb.lower !== null) {
        const x = xForIndex(i).toFixed(1);
        upperPts.push(`${x},${yForPrice(bb.upper).toFixed(1)}`);
        lowerPts.unshift(`${x},${yForPrice(bb.lower).toFixed(1)}`);
      }
    });
    if (upperPts.length < 2) return '';
    return [...upperPts, ...lowerPts].join(' ');
  }, [computed.bollinger, indicators.bollinger, width, minPrice, maxPrice]);

  const areaPath = useMemo(() => {
    if (chartMode !== 'area' || candles.length === 0) return { line: '', fill: '' };
    const line = buildPolylinePath(
      candles.map((c) => c.close),
      xForIndex,
      yForPrice
    );
    const firstX = xForIndex(0).toFixed(1);
    const lastX = xForIndex(candles.length - 1).toFixed(1);
    const bottomY = (priceTop + priceHeight).toFixed(1);
    return {
      line,
      fill: `${line} L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`,
    };
  }, [chartMode, candles, width, minPrice, maxPrice]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - padLeft;
    if (x < 0 || x > plotWidth) {
      setHoverIndex(null);
      return;
    }
    const idx = Math.min(candles.length - 1, Math.max(0, Math.floor(x / stepX)));
    setHoverIndex(idx);
  };

  const overlayButtons: { key: keyof IndicatorConfig; label: string; dotColor: string }[] = [
    { key: 'sma20', label: 'SMA 20', dotColor: '#38BDF8' },
    { key: 'ema50', label: 'EMA 50', dotColor: '#F59E0B' },
    { key: 'bollinger', label: 'BB (20,2)', dotColor: '#818CF8' },
    { key: 'vwap', label: 'VWAP', dotColor: '#C084FC' },
  ];

  const paneButtons: { key: keyof IndicatorConfig; label: string }[] = [
    { key: 'volume', label: 'Volume' },
    { key: 'rsi', label: 'RSI 14' },
    { key: 'macd', label: 'MACD' },
  ];

  const activeSma = computed.sma20[activeIdx];
  const activeEma = computed.ema50[activeIdx];
  const activeVwap = computed.vwap[activeIdx];
  const activeBB = computed.bollinger[activeIdx];
  const activeRsi = computed.rsi[activeIdx];
  const activeMacd = computed.macd[activeIdx];

  return (
    <div className="bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden">
      {/* Chart Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800/90">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Timeframe segmented control */}
          <div
            role="group"
            aria-label="Chart timeframe"
            className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900/90 rounded-md border border-slate-200/80 dark:border-slate-800"
          >
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onTimeframeChange(tf)}
                className={`px-2.5 py-1 text-xs font-mono font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  timeframe === tf
                    ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Chart Mode Toggle */}
          <div
            role="group"
            aria-label="Chart visualization mode"
            className="flex items-center gap-0.5 p-0.5 bg-slate-100 dark:bg-slate-900/90 rounded-md border border-slate-200/80 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={() => onChartModeChange('candle')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'candle'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <CandlestickChart className="w-3.5 h-3.5" />
              <span>Candles</span>
            </button>
            <button
              type="button"
              onClick={() => onChartModeChange('area')}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                chartMode === 'area'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-50 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-3.5 h-3.5" />
              <span>Area</span>
            </button>
          </div>
        </div>

        {/* Technical Indicator Toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {overlayButtons.map((btn) => {
            const active = indicators[btn.key];
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => onToggleIndicator(btn.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-[2px] shrink-0"
                  style={{ backgroundColor: btn.dotColor, opacity: active ? 1 : 0.45 }}
                />
                <span>{btn.label}</span>
              </button>
            );
          })}

          <span className="h-4 w-px bg-slate-200 dark:bg-slate-800 mx-0.5 hidden sm:inline-block" />

          {paneButtons.map((btn) => {
            const active = indicators[btn.key];
            return (
              <button
                key={btn.key}
                type="button"
                onClick={() => onToggleIndicator(btn.key)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-sky-600 text-white border-sky-600 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40'
                    : 'bg-transparent text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                {btn.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live / Crosshair OHLCV Readout Strip */}
      {activeCandle && (
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5 px-4 py-2 text-xs border-b border-slate-100 dark:border-slate-800/60 bg-slate-50/70 dark:bg-[#0D121D]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono tabular-nums">
            <span className="text-slate-500 dark:text-slate-400">{activeCandle.label}</span>
            <span className="text-slate-500 dark:text-slate-400">
              O <strong className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(activeCandle.open)}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              H <strong className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(activeCandle.high)}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              L <strong className="font-medium text-slate-900 dark:text-slate-100">{formatCurrency(activeCandle.low)}</strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              C{' '}
              <strong
                className={`font-medium ${
                  activeUp
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {formatCurrency(activeCandle.close)}
              </strong>
            </span>
            <span className="text-slate-500 dark:text-slate-400">
              Vol <strong className="font-medium text-slate-800 dark:text-slate-200">{formatCompactVolume(activeCandle.volume)}</strong>
            </span>
            {prevCandle && (
              <span
                className={`${
                  activeCandle.close >= prevCandle.close
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {activeCandle.close >= prevCandle.close ? '▲' : '▼'}{' '}
                {Math.abs(((activeCandle.close - prevCandle.close) / Math.max(0.01, prevCandle.close)) * 100).toFixed(2)}%
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono tabular-nums text-[11px]">
            {indicators.sma20 && activeSma !== null && (
              <span className="text-sky-600 dark:text-sky-400">SMA20 {formatCurrency(activeSma)}</span>
            )}
            {indicators.ema50 && activeEma !== null && (
              <span className="text-amber-600 dark:text-amber-400">EMA50 {formatCurrency(activeEma)}</span>
            )}
            {indicators.vwap && activeVwap !== null && (
              <span className="text-purple-600 dark:text-purple-400">VWAP {formatCurrency(activeVwap)}</span>
            )}
            {indicators.bollinger && activeBB?.upper !== null && activeBB?.lower !== null && (
              <span className="text-indigo-600 dark:text-indigo-400">
                BB {formatCurrency(activeBB.upper)} / {formatCurrency(activeBB.lower)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Responsive SVG Financial Canvas */}
      <div ref={containerRef} className="w-full select-none relative">
        <svg
          width={width}
          height={totalHeight}
          viewBox={`0 0 ${width} ${totalHeight}`}
          className="block w-full cursor-crosshair"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverIndex(null)}
          role="img"
          aria-label={`${asset.symbol} ${timeframe} price and technical analysis chart`}
        >
          <defs>
            <linearGradient id="meridianAreaUp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#10B981" stopOpacity="0.26" />
              <stop offset="100%" stopColor="#10B981" stopOpacity="0.01" />
            </linearGradient>
            <linearGradient id="meridianAreaDown" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#EF4444" stopOpacity="0.24" />
              <stop offset="100%" stopColor="#EF4444" stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Horizontal Price Gridlines & Right Price Axis */}
          {priceTicks.map((tick, idx) => {
            const y = yForPrice(tick);
            return (
              <g key={`ptick-${idx}`}>
                <line
                  x1={padLeft}
                  x2={padLeft + plotWidth}
                  y1={y}
                  y2={y}
                  className="stroke-slate-200/80 dark:stroke-slate-800/75"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
                <text
                  x={padLeft + plotWidth + 8}
                  y={y + 3.5}
                  className="fill-slate-500 dark:fill-slate-400 font-mono"
                  fontSize="10.5"
                >
                  {tick.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* Bollinger Bands Fill & Strokes */}
          {indicators.bollinger && bollingerPolygon && (
            <g>
              <polygon points={bollingerPolygon} fill="#818CF8" fillOpacity="0.09" />
              <path
                d={buildPolylinePath(
                  computed.bollinger.map((b) => b.upper),
                  xForIndex,
                  yForPrice
                )}
                fill="none"
                stroke="#818CF8"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.8"
              />
              <path
                d={buildPolylinePath(
                  computed.bollinger.map((b) => b.lower),
                  xForIndex,
                  yForPrice
                )}
                fill="none"
                stroke="#818CF8"
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.8"
              />
            </g>
          )}

          {/* Main Price Series: Candles OR Area */}
          {chartMode === 'candle' ? (
            <g>
              {candles.map((c, i) => {
                const cx = xForIndex(i);
                const isUp = c.close >= c.open;
                const color = isUp ? '#10B981' : '#EF4444';
                const yHigh = yForPrice(c.high);
                const yLow = yForPrice(c.low);
                const yOpen = yForPrice(c.open);
                const yClose = yForPrice(c.close);
                const bodyTop = Math.min(yOpen, yClose);
                const bodyHeight = Math.max(1.5, Math.abs(yClose - yOpen));
                const isHovered = hoverIndex === i;

                return (
                  <g key={`c-${i}`}>
                    <line
                      x1={cx}
                      x2={cx}
                      y1={yHigh}
                      y2={yLow}
                      stroke={color}
                      strokeWidth={isHovered ? 1.6 : 1.15}
                    />
                    <rect
                      x={cx - candleWidth / 2}
                      y={bodyTop}
                      width={candleWidth}
                      height={bodyHeight}
                      fill={color}
                      fillOpacity={isHovered ? 1 : 0.92}
                      rx={0.75}
                    />
                  </g>
                );
              })}
            </g>
          ) : (
            <g>
              <path
                d={areaPath.fill}
                fill={seriesUp ? 'url(#meridianAreaUp)' : 'url(#meridianAreaDown)'}
              />
              <path
                d={areaPath.line}
                fill="none"
                stroke={seriesUp ? '#10B981' : '#EF4444'}
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
            </g>
          )}

          {/* Moving Averages & VWAP Overlays */}
          {indicators.sma20 && (
            <path
              d={buildPolylinePath(computed.sma20, xForIndex, yForPrice)}
              fill="none"
              stroke="#38BDF8"
              strokeWidth="1.5"
            />
          )}
          {indicators.ema50 && (
            <path
              d={buildPolylinePath(computed.ema50, xForIndex, yForPrice)}
              fill="none"
              stroke="#F59E0B"
              strokeWidth="1.5"
            />
          )}
          {indicators.vwap && (
            <path
              d={buildPolylinePath(computed.vwap, xForIndex, yForPrice)}
              fill="none"
              stroke="#C084FC"
              strokeWidth="1.35"
              strokeDasharray="4 2"
            />
          )}

          {/* Live Last Price Reference Line & Axis Tag */}
          {lastCandle && (
            <g>
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={yForPrice(lastCandle.close)}
                y2={yForPrice(lastCandle.close)}
                stroke={asset.price >= asset.previousClose ? '#10B981' : '#EF4444'}
                strokeWidth="1"
                strokeDasharray="3 3"
                strokeOpacity="0.85"
              />
              <rect
                x={padLeft + plotWidth + 2}
                y={yForPrice(lastCandle.close) - 9}
                width={padRight - 6}
                height={18}
                rx={3}
                fill={asset.price >= asset.previousClose ? '#059669' : '#DC2626'}
              />
              <text
                x={padLeft + plotWidth + 8}
                y={yForPrice(lastCandle.close) + 3.5}
                fill="#FFFFFF"
                className="font-mono font-medium"
                fontSize="10.5"
              >
                {lastCandle.close.toFixed(2)}
              </text>
            </g>
          )}

          {/* VOLUME SUB-PANE */}
          {indicators.volume && (
            <g>
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={volTop - 6}
                y2={volTop - 6}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <text
                x={padLeft + 4}
                y={volTop + 8}
                className="fill-slate-500 dark:fill-slate-400 font-mono"
                fontSize="10"
              >
                Volume · {activeCandle ? formatCompactVolume(activeCandle.volume) : ''}
              </text>
              {candles.map((c, i) => {
                const cx = xForIndex(i);
                const h = Math.max(1.5, (c.volume / maxVolume) * (volHeight - 16));
                const isUp = c.close >= c.open;
                return (
                  <rect
                    key={`v-${i}`}
                    x={cx - candleWidth / 2}
                    y={volTop + volHeight - h}
                    width={candleWidth}
                    height={h}
                    fill={isUp ? '#10B981' : '#EF4444'}
                    fillOpacity={hoverIndex === i ? 0.85 : 0.42}
                    rx={0.5}
                  />
                );
              })}
              <text
                x={padLeft + plotWidth + 8}
                y={volTop + 14}
                className="fill-slate-500 dark:fill-slate-400 font-mono"
                fontSize="10"
              >
                {formatCompactVolume(maxVolume)}
              </text>
            </g>
          )}

          {/* RSI (14) SUB-PANE */}
          {indicators.rsi && (
            <g>
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={rsiTop - 6}
                y2={rsiTop - 6}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              {/* 30-70 band */}
              <rect
                x={padLeft}
                y={yForRsi(70)}
                width={plotWidth}
                height={yForRsi(30) - yForRsi(70)}
                className="fill-slate-200/40 dark:fill-slate-800/35"
              />
              {[70, 50, 30].map((lvl) => (
                <g key={`rsi-${lvl}`}>
                  <line
                    x1={padLeft}
                    x2={padLeft + plotWidth}
                    y1={yForRsi(lvl)}
                    y2={yForRsi(lvl)}
                    className="stroke-slate-300 dark:stroke-slate-700/80"
                    strokeWidth="1"
                    strokeDasharray={lvl === 50 ? '2 4' : '3 3'}
                  />
                  <text
                    x={padLeft + plotWidth + 8}
                    y={yForRsi(lvl) + 3}
                    className="fill-slate-500 dark:fill-slate-400 font-mono"
                    fontSize="10"
                  >
                    {lvl}
                  </text>
                </g>
              ))}
              <path
                d={buildPolylinePath(computed.rsi, xForIndex, yForRsi)}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.5"
              />
              <text
                x={padLeft + 4}
                y={rsiTop + 10}
                className="fill-slate-600 dark:fill-slate-300 font-mono"
                fontSize="10"
              >
                RSI (14){' '}
                <tspan
                  fill={
                    (activeRsi ?? 50) > 70
                      ? '#EF4444'
                      : (activeRsi ?? 50) < 30
                      ? '#10B981'
                      : '#38BDF8'
                  }
                >
                  {activeRsi !== null ? activeRsi.toFixed(1) : '—'}
                </tspan>
              </text>
            </g>
          )}

          {/* MACD (12, 26, 9) SUB-PANE */}
          {indicators.macd && (
            <g>
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={macdTop - 6}
                y2={macdTop - 6}
                className="stroke-slate-200 dark:stroke-slate-800"
                strokeWidth="1"
              />
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={yForMacd(0)}
                y2={yForMacd(0)}
                className="stroke-slate-300 dark:stroke-slate-700"
                strokeWidth="1"
                strokeDasharray="2 3"
              />
              {computed.macd.map((p, i) => {
                if (p.histogram === null) return null;
                const cx = xForIndex(i);
                const zeroY = yForMacd(0);
                const valY = yForMacd(p.histogram);
                const y = Math.min(zeroY, valY);
                const h = Math.max(1, Math.abs(valY - zeroY));
                return (
                  <rect
                    key={`mh-${i}`}
                    x={cx - candleWidth / 2}
                    y={y}
                    width={candleWidth}
                    height={h}
                    fill={p.histogram >= 0 ? '#10B981' : '#EF4444'}
                    fillOpacity="0.52"
                  />
                );
              })}
              <path
                d={buildPolylinePath(
                  computed.macd.map((p) => p.macd),
                  xForIndex,
                  yForMacd
                )}
                fill="none"
                stroke="#38BDF8"
                strokeWidth="1.4"
              />
              <path
                d={buildPolylinePath(
                  computed.macd.map((p) => p.signal),
                  xForIndex,
                  yForMacd
                )}
                fill="none"
                stroke="#F59E0B"
                strokeWidth="1.3"
              />
              <text
                x={padLeft + plotWidth + 8}
                y={yForMacd(0) + 3}
                className="fill-slate-500 dark:fill-slate-400 font-mono"
                fontSize="10"
              >
                0.00
              </text>
              <text
                x={padLeft + 4}
                y={macdTop + 10}
                className="fill-slate-600 dark:fill-slate-300 font-mono"
                fontSize="10"
              >
                MACD (12,26,9){' '}
                <tspan fill="#38BDF8">
                  {activeMacd?.macd !== null && activeMacd?.macd !== undefined
                    ? activeMacd.macd.toFixed(2)
                    : '—'}
                </tspan>{' '}
                <tspan fill="#F59E0B">
                  Sig{' '}
                  {activeMacd?.signal !== null && activeMacd?.signal !== undefined
                    ? activeMacd.signal.toFixed(2)
                    : '—'}
                </tspan>
              </text>
            </g>
          )}

          {/* Crosshair Overlay */}
          {hoverIndex !== null && activeCandle && (
            <g pointerEvents="none">
              <line
                x1={xForIndex(hoverIndex)}
                x2={xForIndex(hoverIndex)}
                y1={priceTop}
                y2={cursorY}
                className="stroke-slate-400 dark:stroke-slate-500"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <line
                x1={padLeft}
                x2={padLeft + plotWidth}
                y1={yForPrice(activeCandle.close)}
                y2={yForPrice(activeCandle.close)}
                className="stroke-slate-400/70 dark:stroke-slate-500/70"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={xForIndex(hoverIndex)}
                cy={yForPrice(activeCandle.close)}
                r={3.5}
                fill={activeUp ? '#10B981' : '#EF4444'}
                stroke="#0B0F17"
                strokeWidth="1.5"
              />
            </g>
          )}

          {/* Bottom Shared X-Axis */}
          <line
            x1={padLeft}
            x2={padLeft + plotWidth}
            y1={cursorY + 2}
            y2={cursorY + 2}
            className="stroke-slate-200 dark:stroke-slate-800"
            strokeWidth="1"
          />
          {xTickIndices.map((idx) => (
            <text
              key={`xt-${idx}`}
              x={xForIndex(idx)}
              y={cursorY + 18}
              textAnchor="middle"
              className="fill-slate-500 dark:fill-slate-400 font-mono"
              fontSize="10"
            >
              {candles[idx]?.label}
            </text>
          ))}
        </svg>
      </div>
    </div>
  );
};
