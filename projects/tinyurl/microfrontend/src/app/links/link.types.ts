/** The public link shape exactly as the service's `/api/links` exposes it (no creator identity). */
export interface Link {
  slug: string;
  targetUrl: string;
  clickCount: number;
  createdAt: string;
}

export interface LinkListResponse {
  links: Link[];
}
