export interface AdminMedia {
  id: string;
  originalFilename: string;
  url: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  altText: string;
  createdAt: string;
  createdBy: string | null;
}
