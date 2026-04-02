/** Core metadata extracted from every page */
export interface BasicMetadata {
  title: string;
  description: string;
  image_url: string;
  site_name: string;
  site_favicon_url: string;
  price: string;
  currency: string;
}

/** Rich product-specific metadata */
export interface ProductMetadata extends BasicMetadata {
  brand: string;
  category: string;
  availability: string;
  condition: string;
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
  seller: string;
  sku: string;
  gtin: string;
  sale_price: string;
  original_price: string;
  additional_images: string[];
  color: string;
  size: string;
  shipping: string;
  return_policy: string;
  product_metadata: Record<string, unknown>;
}

/** A similar product found via page data or search */
export interface SimilarProduct {
  title: string;
  url: string;
  image_url: string;
  price: string;
  currency: string;
  site_name: string;
  similarity_source: "json_ld" | "same_site" | "search" | "gtin_match";
}

/** Full extraction result returned by the module */
export interface ExtractionResult {
  metadata: ProductMetadata;
  similar_products: SimilarProduct[];
}
