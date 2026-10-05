'use client';
/**
 * The Media brand profile as a slide look. A brand colour is only used as the
 * cover fill when white text on it stays at 4.5:1 or better; otherwise the
 * darkest brand colour that passes, else the default navy.
 */
import { useBrand } from '@lad/frontend-features/content-studio';
import type { BrandInfo } from '@lad/frontend-features/content-studio';
import { DEFAULT_BRAND, type BrandLook } from './exports';

function luminance(hex: string): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Contrast of white text on this colour. */
export function whiteContrast(hex: string): number {
  const l = luminance(hex);
  return l == null ? 0 : 1.05 / (l + 0.05);
}

export function brandLook(info: BrandInfo | undefined): BrandLook {
  if (!info || info.source !== 'media') return DEFAULT_BRAND;
  const usable = info.colors.filter((c) => whiteContrast(c) >= 4.5);
  const primary = usable[0] || DEFAULT_BRAND.primary;
  return { name: info.name || DEFAULT_BRAND.name, primary: primary.startsWith('#') ? primary : `#${primary}` };
}

export function useBrandLook(): BrandLook {
  return brandLook(useBrand().data);
}
