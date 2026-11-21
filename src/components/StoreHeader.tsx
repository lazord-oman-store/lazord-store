import { Search, ShoppingBag } from 'lucide-react';

interface StoreHeaderProps {
  cartCount: number;
  onOpenCart: () => void;
  onOpenTrackOrder: () => void;
  onFilterCategory: (cat: 'all' | 'perfume' | 'bukhoor') => void;
}

export function StoreHeader({
  cartCount,
  onOpenCart,
  onOpenTrackOrder,
  onFilterCategory,
}: StoreHeaderProps) {
  const scrollToCatalog = (cat: 'all' | 'perfume' | 'bukhoor') => {
    onFilterCategory(cat);
    const el = document.getElementById('catalog');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-[#FAF8F4]/95 backdrop-blur-md border-b border-[#E7E0D2]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Single-line Brand Wordmark */}
        <a
          href="#top"
          className="font-editorial text-xl sm:text-2xl font-bold tracking-tight text-[#181715] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#8E6F2D] rounded-sm"
        >
          LAZORD | لازورد
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav
          aria-label="التنقل الرئيسي"
          className="hidden md:flex items-center gap-6 text-sm font-medium text-[#4F4A42]"
        >
          <a
            href="#top"
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0"
          >
            الرئيسية
          </a>
          <button
            type="button"
            onClick={() => scrollToCatalog('all')}
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            المجموعة
          </button>
          <button
            type="button"
            onClick={() => scrollToCatalog('perfume')}
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            العطور
          </button>
          <button
            type="button"
            onClick={() => scrollToCatalog('bukhoor')}
            className="hover:text-[#181715] hover:underline underline-offset-8 decoration-[#B59449] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            البخور
          </button>
        </nav>

        {/* Zone 3: Track Order + Cart Action */}
        <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={onOpenTrackOrder}
            className="inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 min-h-[40px] text-xs sm:text-sm font-medium text-[#181715] border border-[#D9CEB8] bg-white hover:bg-[#F2EDE3] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8E6F2D]"
          >
            <Search className="w-4 h-4 text-[#8E6F2D]" aria-hidden="true" />
            <span>تتبع طلبك</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            aria-label={`سلة التسوق (${cartCount})`}
            data-testid="cart-button"
            className="relative inline-flex items-center justify-center gap-2 px-3.5 py-2 min-h-[40px] min-w-[44px] text-sm font-medium bg-[#141311] text-[#FAF8F4] hover:bg-[#2A2723] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#B59449]"
          >
            <ShoppingBag className="w-4 h-4 text-[#B59449]" aria-hidden="true" />
            <span className="hidden sm:inline">السلة</span>
            <span
              data-testid="cart-badge"
              className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-mono font-semibold tabular-nums rounded-full bg-[#B59449] text-[#141311]"
            >
              {cartCount}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
