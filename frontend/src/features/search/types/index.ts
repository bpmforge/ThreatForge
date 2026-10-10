/**
 * search-types - Type definitions
 */

type SearchResultType = "threat" | "component" | "mitigation";
export interface SearchResult {
  id: string;
  type: SearchResultType;
  name: string;
  description?: string;
  componentName?: string;
  severity?: string;
  status?: string;
}
