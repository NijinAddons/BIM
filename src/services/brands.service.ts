import {callFrappeMethod, htmlToText, toAbsoluteFileUrl} from './frappe.client';

export type Brand = {
  id: string;
  name: string;
  image: string | null;
  description: string | null;
  banners: string[];
};

// Shape returned by `buy_in_minutes.api.get_brands` (frappe.get_all on the
// Brand doctype). `brand` is the doctype's title field; `name` is the primary
// key, which for Brand equals the brand title. The `custom_brand_banner_image*`
// fields are the three optional banner attach-image fields.
type BrandResponse = {
  name: string;
  brand?: string | null;
  image?: string | null;
  description?: string | null;
  custom_brand_banner_image?: string | null;
  custom_brand_banner_image_2?: string | null;
  custom_brand_banner_image_3?: string | null;
};

export async function fetchBrands(): Promise<Brand[]> {
  const brands = await callFrappeMethod<BrandResponse[]>(
    'buy_in_minutes.api.get_brands',
    undefined,
    'brands',
  );

  return brands.map(entry => ({
    id: entry.name,
    name: entry.brand || entry.name,
    image: toAbsoluteFileUrl(entry.image ?? null),
    description: htmlToText(entry.description),
    banners: [
      entry.custom_brand_banner_image,
      entry.custom_brand_banner_image_2,
      entry.custom_brand_banner_image_3,
    ]
      .map(path => toAbsoluteFileUrl(path ?? null))
      .filter((url): url is string => url !== null),
  }));
}
