export type SeasonalThemeId =
  | 'default'
  | 'ramadan'
  | 'eid_fitr'
  | 'eid_adha'
  | 'oman_national_day';

export const SEASONAL_THEME_IDS: readonly SeasonalThemeId[] = [
  'default',
  'ramadan',
  'eid_fitr',
  'eid_adha',
  'oman_national_day',
] as const;

export interface SeasonalThemeOption {
  id: SeasonalThemeId;
  titleAr: string;
  subtitleAr: string;
  bannerTextAr: string | null;
  previewSwatches: readonly string[];
}

export const SEASONAL_THEME_OPTIONS: readonly SeasonalThemeOption[] = [
  {
    id: 'default',
    titleAr: 'الوضع الافتراضي',
    subtitleAr: 'التصميم الأساسي الفاخر لدار لازورد بدون زينة موسمية',
    bannerTextAr: null,
    previewSwatches: ['#141311', '#B59449', '#FAF8F4'],
  },
  {
    id: 'ramadan',
    titleAr: 'زينة شهر رمضان المبارك',
    subtitleAr: 'فوانيس ذهبية متدلية بإضاءة دافئة وأهلة ونجوم متلألئة',
    bannerTextAr: 'مبارك عليكم الشهر | أجواء رمضانية فاخرة من لازورد',
    previewSwatches: ['#141311', '#E5B95C', '#7A5416'],
  },
  {
    id: 'eid_fitr',
    titleAr: 'زينة عيد الفطر المبارك',
    subtitleAr: 'لمسات احتفالية بالذهبي واللؤلؤي وزخارف هندسية راقية',
    bannerTextAr: 'عيدكم مبارك | عساكم من عواده',
    previewSwatches: ['#1A1713', '#EAD7A4', '#FAF3E3'],
  },
  {
    id: 'eid_adha',
    titleAr: 'زينة عيد الأضحى المبارك',
    subtitleAr: 'زخارف إسلامية مذهّبة وبريق احتفالي دافئ بالذهبي واللؤلؤي',
    bannerTextAr: 'عيدكم مبارك | عساكم من عواده',
    previewSwatches: ['#161310', '#D4AF5A', '#F7EFE0'],
  },
  {
    id: 'oman_national_day',
    titleAr: 'زينة اليوم الوطني العُماني',
    subtitleAr: 'أعلام سلطنة عُمان وشعار الخنجر والسيفين مع لمسات لازورد الذهبية',
    bannerTextAr: 'كل عام وعُمان بخير | فخر الأصالة العُمانية',
    previewSwatches: ['#FAF8F4', '#C8102E', '#00843D', '#D4B774'],
  },
] as const;

export function isValidSeasonalThemeId(value: unknown): value is SeasonalThemeId {
  return (
    typeof value === 'string' &&
    (SEASONAL_THEME_IDS as readonly string[]).includes(value.trim())
  );
}

export function normalizeSeasonalTheme(value: unknown): SeasonalThemeId {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if ((SEASONAL_THEME_IDS as readonly string[]).includes(trimmed)) {
      return trimmed as SeasonalThemeId;
    }
  }
  return 'default';
}

export function getSeasonalThemeOption(themeId: unknown): SeasonalThemeOption {
  const normalized = normalizeSeasonalTheme(themeId);
  return (
    SEASONAL_THEME_OPTIONS.find((item) => item.id === normalized) ?? SEASONAL_THEME_OPTIONS[0]
  );
}
