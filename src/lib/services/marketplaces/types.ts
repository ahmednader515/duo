export interface MarketplaceProduct {
  id: string;
  name: string;
  description: string;
  sku: string | null;
  price: string;
  currency: string;
  stock: number;
  images: string[];
  categoryId: string | null;
  attributes: Record<string, string>;
}
export interface ValidationIssue {
  field: string;
  message: string;
}
export interface MarketplaceContext {
  workspaceId: string;
  connectionId: string;
}
export interface MarketplaceService {
  connectAccount(input: {
    workspaceId: string;
    returnUrl: string;
  }): Promise<{ authorizationUrl: string }>;
  disconnectAccount(context: MarketplaceContext): Promise<void>;
  validateProduct(
    product: MarketplaceProduct,
  ): Promise<{ valid: boolean; issues: ValidationIssue[] }>;
  publishProduct(
    context: MarketplaceContext,
    product: MarketplaceProduct,
  ): Promise<{ externalListingId: string }>;
  updateListing(
    context: MarketplaceContext,
    listingId: string,
    product: MarketplaceProduct,
  ): Promise<void>;
  retrieveListingStatus(
    context: MarketplaceContext,
    listingId: string,
  ): Promise<{ status: string; errors: string[] }>;
}
