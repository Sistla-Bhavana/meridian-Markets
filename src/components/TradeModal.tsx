import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { PortfolioPosition, StockAsset } from '../types/market';
import { formatCurrency } from '../utils/indicators';

interface TradeModalProps {
  isOpen: boolean;
  initialSymbol: string;
  initialSide?: 'BUY' | 'SELL';
  assets: StockAsset[];
  positions: PortfolioPosition[];
  cashBalance: number;
  onClose: () => void;
  onExecuteTrade: (symbol: string, side: 'BUY' | 'SELL', shares: number) => void;
}

export const TradeModal: React.FC<TradeModalProps> = ({
  isOpen,
  initialSymbol,
  initialSide = 'BUY',
  assets,
  positions,
  cashBalance,
  onClose,
  onExecuteTrade,
}) => {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [side, setSide] = useState<'BUY' | 'SELL'>(initialSide);
  const [sharesInput, setSharesInput] = useState('10');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSymbol(initialSymbol);
      setSide(initialSide);
      setSharesInput('10');
      setError(null);
    }
  }, [isOpen, initialSymbol, initialSide]);

  if (!isOpen) return null;

  const asset = assets.find((a) => a.symbol === symbol) ?? assets[0];
  const holding = positions.find((p) => p.symbol === asset.symbol);
  const heldShares = holding?.shares ?? 0;

  const parsedShares = Number(sharesInput);
  const validShares = Number.isFinite(parsedShares) && parsedShares > 0 && Number.isInteger(parsedShares);
  const estimatedTotal = validShares ? parsedShares * asset.price : 0;

  const maxBuyShares = Math.floor(cashBalance / Math.max(0.01, asset.price));
  const insufficientFunds = side === 'BUY' && estimatedTotal > cashBalance;
  const insufficientShares = side === 'SELL' && parsedShares > heldShares;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validShares) {
      setError('Enter a whole number of shares greater than 0.');
      return;
    }
    if (insufficientFunds) {
      setError(`Order exceeds available cash (${formatCurrency(cashBalance)}).`);
      return;
    }
    if (insufficientShares) {
      setError(`You currently hold ${heldShares} shares of ${asset.symbol}.`);
      return;
    }
    onExecuteTrade(asset.symbol, side, parsedShares);
    onClose();
  };

  const presets = side === 'BUY' ? [1, 5, 10, 25] : [1, 5, 10, Math.max(1, heldShares)];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/65 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="trade-modal-title"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#111724] border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2
              id="trade-modal-title"
              className="font-display text-base font-semibold text-slate-900 dark:text-slate-50"
            >
              Market Order Ticket
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Immediate simulated fill at live quote
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close order ticket"
            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Buy / Sell Segmented Toggle */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-md border border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setSide('BUY');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                side === 'BUY'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Buy
            </button>
            <button
              type="button"
              onClick={() => {
                setSide('SELL');
                setError(null);
              }}
              className={`py-2 text-xs font-semibold rounded transition-colors cursor-pointer ${
                side === 'SELL'
                  ? 'bg-rose-600 text-white'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
              }`}
            >
              Sell
            </button>
          </div>

          {/* Symbol Selection */}
          <div>
            <label
              htmlFor="trade-symbol"
              className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5"
            >
              Security
            </label>
            <select
              id="trade-symbol"
              value={asset.symbol}
              onChange={(e) => {
                setSymbol(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 text-sm rounded-md bg-slate-50 dark:bg-[#0D121D] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            >
              {assets.map((a) => (
                <option key={a.symbol} value={a.symbol}>
                  {a.symbol} — {a.name} ({formatCurrency(a.price)})
                </option>
              ))}
            </select>
          </div>

          {/* Quantity Input & Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="trade-shares"
                className="text-xs font-medium text-slate-600 dark:text-slate-400"
              >
                Shares
              </label>
              <span className="text-xs font-mono tabular-nums text-slate-500 dark:text-slate-400">
                {side === 'BUY'
                  ? `Max ${maxBuyShares} sh`
                  : `Held ${heldShares} sh`}
              </span>
            </div>
            <input
              id="trade-shares"
              type="number"
              min={1}
              step={1}
              value={sharesInput}
              onChange={(e) => {
                setSharesInput(e.target.value);
                setError(null);
              }}
              className="w-full px-3 py-2 text-sm font-mono tabular-nums rounded-md bg-slate-50 dark:bg-[#0D121D] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-sky-500"
            />
            <div className="flex items-center gap-1.5 mt-2">
              {presets.map((qty, idx) => {
                const isMaxSell = side === 'SELL' && idx === 3;
                return (
                  <button
                    key={`${side}-${idx}-${qty}`}
                    type="button"
                    onClick={() => {
                      setSharesInput(String(isMaxSell ? heldShares : qty));
                      setError(null);
                    }}
                    disabled={isMaxSell && heldShares === 0}
                    className="flex-1 py-1 text-xs font-mono rounded border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
                  >
                    {isMaxSell ? 'All' : `${qty} sh`}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Summary Breakdown */}
          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Live Market Price</span>
              <span className="font-mono tabular-nums font-medium text-slate-900 dark:text-slate-100">
                {formatCurrency(asset.price)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 dark:text-slate-400">Available Cash</span>
              <span className="font-mono tabular-nums text-slate-700 dark:text-slate-300">
                {formatCurrency(cashBalance)}
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800/70">
              <span className="font-medium text-slate-700 dark:text-slate-200">Estimated Total</span>
              <span className="font-mono tabular-nums text-sm font-semibold text-slate-900 dark:text-slate-50">
                {formatCurrency(estimatedTotal)}
              </span>
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!validShares || insufficientFunds || insufficientShares}
              className={`px-4 py-2 text-xs font-semibold rounded-md text-white transition-colors disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer ${
                side === 'BUY'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {side === 'BUY' ? `Buy ${asset.symbol}` : `Sell ${asset.symbol}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
