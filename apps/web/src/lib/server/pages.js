import { getPbnTranslations } from "@/i18n/server";
import { runtimeTranslate as pbnRuntimeT } from "@/i18n/translate";
import { cache } from 'react';
import { fetchData } from './api';
export function normalizeSlugSegments(slug) {
  return (Array.isArray(slug) ? slug : [slug]).filter(Boolean).map(segment => decodeURIComponent(String(segment))).filter(Boolean);
}
export function joinSlugSegments(slug) {
  return normalizeSlugSegments(slug).join('/');
}
export function encodeSlugPath(slug) {
  return normalizeSlugSegments(slug).map(segment => encodeURIComponent(segment)).join('/');
}
const fetchPageByEncodedSlug = cache(async encodedSlug => {
  const pbnT = await getPbnTranslations();
  return fetchData(`/pages/${encodedSlug}`, {
    fallback: null,
    options: {
      cache: 'no-store'
    }
  }, pbnT);
});
export async function getPageBySlug(slug) {
  const encodedSlug = encodeSlugPath(slug);
  if (!encodedSlug) {
    return null;
  }
  return fetchPageByEncodedSlug(encodedSlug);
}
