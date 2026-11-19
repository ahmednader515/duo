export interface GenerationRequest {
  workspaceId: string;
  productId: string;
  product: {
    name: string;
    description: string;
    category: string | null;
    price: string;
    currency: string;
    sku: string | null;
  };
  language: "ar" | "en";
  tone: "professional" | "friendly" | "persuasive";
  prompt: string;
  keywords: string[];
}
export interface TextGeneration {
  content: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string;
}
export interface ImageGeneration {
  imageBase64: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: string;
}
export interface AIService {
  generateTitle(input: GenerationRequest): Promise<TextGeneration>;
  generateDescription(input: GenerationRequest): Promise<TextGeneration>;
  generateSEO(input: GenerationRequest): Promise<TextGeneration>;
  generateImage(input: GenerationRequest): Promise<ImageGeneration>;
  editImage(
    input: GenerationRequest & { image: File },
  ): Promise<ImageGeneration>;
}
export interface GenerationView {
  id: string;
  productId: string | null;
  productName: string;
  kind: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  model: string;
  tokenUsage: number;
  estimatedCost: string;
}
