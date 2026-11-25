import test from 'node:test';
import assert from 'node:assert/strict';
import {
  SEASONAL_THEME_IDS,
  SEASONAL_THEME_OPTIONS,
  getSeasonalThemeOption,
  isValidSeasonalThemeId,
  normalizeSeasonalTheme,
} from './seasonalTheme';

test('SEASONAL_THEME_OPTIONS covers all 5 seasonal modes with exact Arabic greetings', () => {
  assert.deepEqual(
    SEASONAL_THEME_IDS,
    ['default', 'ramadan', 'eid_fitr', 'eid_adha', 'oman_national_day']
  );

  assert.equal(getSeasonalThemeOption('default').bannerTextAr, null);
  assert.equal(
    getSeasonalThemeOption('ramadan').bannerTextAr,
    'مبارك عليكم الشهر | أجواء رمضانية فاخرة من لازورد'
  );
  assert.equal(
    getSeasonalThemeOption('eid_fitr').bannerTextAr,
    'عيدكم مبارك | عساكم من عواده'
  );
  assert.equal(
    getSeasonalThemeOption('eid_adha').bannerTextAr,
    'عيدكم مبارك | عساكم من عواده'
  );
  assert.equal(
    getSeasonalThemeOption('oman_national_day').bannerTextAr,
    'كل عام وعُمان بخير | فخر الأصالة العُمانية'
  );
  assert.deepEqual(
    getSeasonalThemeOption('oman_national_day').previewSwatches,
    ['#FAF8F4', '#C8102E', '#00843D', '#D4B774']
  );
  assert.equal(SEASONAL_THEME_OPTIONS.length, 5);
});

test('normalizeSeasonalTheme and isValidSeasonalThemeId safely fall back to default', () => {
  assert.equal(isValidSeasonalThemeId('ramadan'), true);
  assert.equal(isValidSeasonalThemeId('oman_national_day'), true);
  assert.equal(isValidSeasonalThemeId('unknown_holiday'), false);
  assert.equal(isValidSeasonalThemeId(123), false);

  assert.equal(normalizeSeasonalTheme(undefined), 'default');
  assert.equal(normalizeSeasonalTheme(null), 'default');
  assert.equal(normalizeSeasonalTheme(''), 'default');
  assert.equal(normalizeSeasonalTheme('invalid_theme'), 'default');
  assert.equal(normalizeSeasonalTheme('  eid_fitr  '), 'eid_fitr');
});
