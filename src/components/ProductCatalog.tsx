import { Plus } from 'lucide-react';
import { getCategoryLabelAr, isProductOutOfStock } from '../lib/storeLogic';
import type { Product } from '../types/store';
import { OmrPrice } from './OmrPrice';
import { SafeStoreImage } from './SafeStoreImage';

export type CatalogFilter = 'all' | 'perfume' | 'bukhoor';

interface ProductCatalogProps {
  products: Product[];
  activeFilter: CatalogFilter;
  onFilterChange: (filter: CatalogFilter) => void;
  onAddToCart: (product: Product) => void;
}

function ProductCard({
  product,
  onAddToCart,
}: {
  product: Product;
  onAddToCart: (product: Product) => void;
}) {
  const outOfStock = isProductOutOfStock(product);

  return (
    <article
      data-testid={`product-card-${product.id}`}
      className="group bg-white border border-[#E7E0D2] rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* 4:3 Neutral Studio Pedestal Media */}
      <div className="relative aspect-[4/3] w-full bg-[#F2EDE3] overflow-hidden">
        <SafeStoreImage
          src={product.imageUrl}
          alt={product.nameAr}
          fallbackLabel={product.nameAr}
          iconClassName="w-8 h-8"
          fallbackClassName="w-full h-full p-6"
          className={`w-full h-full object-cover object-center transition-transform duration-300 ${
            outOfStock ? 'opacity-70 grayscale-[25%]' : 'group-hover:scale-[1.03]'
          }`}
        />

        {outOfStock && (
          <div
            data-testid={`out-of-stock-badge-${product.id}`}
            className="absolute top-3 start-3 px-3 py-1 rounded-md bg-[#141311]/90 border border-[#B59449] text-[#FAF8F4] text-xs font-bold shadow-sm"
          >
            نفذت الكميه
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-4 sm:p-6 flex-1 flex flex-col justify-between gap-3.5 sm:gap-4">
        <div className="space-y-2 sm:space-y-2.5">
          {/* Unboxed clean metadata row with typographic separator */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#615B52]">
            <span className="font-semibold text-[#8E6F2D]">
              {getCategoryLabelAr(product.category)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{product.sizeLabel}</span>
          </div>

          <h3 className="text-lg sm:text-xl font-semibold text-[#181715] leading-snug">
            {product.nameAr}
          </h3>

          <p className="text-sm text-[#575148] leading-relaxed line-clamp-2">
            {product.notesAr}
          </p>
        </div>

        <div className="pt-3.5 sm:pt-4 border-t border-[#F0EAE0] flex flex-wrap items-center justify-between gap-3">
          <div className="text-base sm:text-lg font-bold text-[#181715]">
            <OmrPrice amount={product.priceOmr} />
          </div>

          {outOfStock ? (
            <button
              type="button"
              disabled
              aria-disabled="true"
              data-testid={`out-of-stock-btn-${product.id}`}
              className="inline-flex items-center justify-center px-4 py-2.5 min-h-[44px] bg-[#EFE9DC] border border-[#D7CCB8] text-[#615B52] text-sm font-semibold rounded-lg whitespace-nowrap shrink-0 cursor-not-allowed"
            >
              نفذت الكميه
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAddToCart(product)}
              aria-label={`أضف ${product.nameAr} إلى السلة`}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-[#141311] hover:bg-[#8E6F2D] text-[#FAF8F4] text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8E6F2D]"
            >
              <Plus className="w-4 h-4" aria-hidden="true" />
              <span>أضف إلى السلة</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

export function ProductCatalog({
  products,
  activeFilter,
  onFilterChange,
  onAddToCart,
}: ProductCatalogProps) {
  const filtered = products.filter((item) =>
    activeFilter === 'all' ? true : item.category === activeFilter
  );

  const tabs: { id: CatalogFilter; label: string }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'perfume', label: 'العطور' },
    { id: 'bukhoor', label: 'البخور' },
  ];

  return (
    <section id="catalog" className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 lg:py-20">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 sm:gap-6 mb-8 sm:mb-10">
        <div>
          <p className="text-xs font-medium text-[#8E6F2D] mb-1.5 sm:mb-2">مختارات الدار</p>
          <h2 className="font-editorial text-2xl sm:text-4xl font-bold text-[#181715] text-balance">
            مجموعة العطور والبخور
          </h2>
        </div>

        {/* Interactive Category Filter Tabs */}
        <div
          role="tablist"
          aria-label="تصفية المنتجات"
          className="w-full sm:w-auto grid grid-cols-3 sm:inline-flex items-center gap-1 p-1 bg-[#EFE9DC] border border-[#E2D9C5] rounded-lg"
        >
          {tabs.map((tab) => {
            const isActive = activeFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onFilterChange(tab.id)}
                className={`px-3 sm:px-4 py-2.5 sm:py-2 min-h-[42px] sm:min-h-[40px] text-sm font-medium rounded-md transition-colors whitespace-nowrap text-center cursor-pointer focus-visible:outline-2 focus-visible:outline-[#8E6F2D] ${
                  isActive
                    ? 'bg-[#141311] text-[#FAF8F4]'
                    : 'text-[#4F4A42] hover:text-[#181715]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-[#E7E0D2] rounded-xl p-10 sm:p-12 text-center">
          <p className="text-base text-[#575148]">
            لا توجد منتجات متوفرة ضمن هذا التصنيف حالياً.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-8">
          {filtered.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      )}
    </section>
  );
}
