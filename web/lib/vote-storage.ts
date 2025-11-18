// Utility functions for managing voted request IDs in localStorage

const VOTED_REQUESTS_KEY = "lofield_voted_requests";

/**
 * Get all voted request IDs from localStorage
 */
export function getVotedRequests(): Set<string> {
  if (typeof window === "undefined") {
    return new Set();
  }

  try {
    const stored = localStorage.getItem(VOTED_REQUESTS_KEY);
    if (!stored) {
      return new Set();
    }
    const parsed = JSON.parse(stored);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch (error) {
    console.error("Error reading voted requests from localStorage:", error);
    return new Set();
  }
}

/**
 * Add a request ID to the voted list
 */
export function addVotedRequest(requestId: string): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const voted = getVotedRequests();
    voted.add(requestId);
    localStorage.setItem(VOTED_REQUESTS_KEY, JSON.stringify([...voted]));
  } catch (error) {
    console.error("Error saving voted request to localStorage:", error);
  }
}

/**
 * Check if a request has been voted on
 */
export function hasVotedForRequest(requestId: string): boolean {
  return getVotedRequests().has(requestId);
}

/**
 * Clear all voted requests (for testing/debugging)
 */
export function clearVotedRequests(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(VOTED_REQUESTS_KEY);
  } catch (error) {
    console.error("Error clearing voted requests from localStorage:", error);
  }
}
