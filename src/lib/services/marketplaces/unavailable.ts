import "server-only";
import type { MarketplaceService } from "./types";
export function unavailableMarketplace(platform: string): MarketplaceService {
  async function unavailable(): Promise<never> {
    throw new Error(
      `${platform} integration is coming soon. No account or listing has been changed.`,
    );
  }
  return {
    connectAccount: unavailable,
    disconnectAccount: unavailable,
    validateProduct: unavailable,
    publishProduct: unavailable,
    updateListing: unavailable,
    retrieveListingStatus: unavailable,
  };
}
