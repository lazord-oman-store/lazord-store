import { roundOmr } from '../lib/storeLogic';

interface OmrPriceProps {
  amount: number;
  prefix?: string;
  className?: string;
}

export function OmrPrice({ amount, prefix = '', className = '' }: OmrPriceProps) {
  const safe = Number.isFinite(amount) ? amount : 0;
  const formatted = roundOmr(safe).toFixed(3);

  return (
    <span className={`inline-flex items-baseline gap-1.5 ${className}`}>
      <span dir="ltr" className="font-mono tabular-nums">
        {prefix}
        {formatted}
      </span>
      <span className="font-sans text-[0.78em] font-semibold">ر.ع</span>
    </span>
  );
}
