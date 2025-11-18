/**
 * Tests for vote storage utilities
 */

// Create a simple storage mock
let storageData: Record<string, string> = {};

const localStorageMock = {
  getItem: (key: string) => storageData[key] || null,
  setItem: (key: string, value: string) => {
    storageData[key] = value;
  },
  removeItem: (key: string) => {
    delete storageData[key];
  },
  clear: () => {
    storageData = {};
  },
  length: 0,
  key: () => null,
};

// Set up global window and localStorage before importing the module
global.window = {
  localStorage: localStorageMock,
} as unknown as Window & typeof globalThis;

// Also set localStorage as a global
(global as any).localStorage = localStorageMock;

import {
  getVotedRequests,
  addVotedRequest,
  hasVotedForRequest,
  clearVotedRequests,
} from "../vote-storage";

describe("Vote Storage", () => {
  beforeEach(() => {
    storageData = {};
  });

  describe("getVotedRequests", () => {
    it("should return empty set when no votes stored", () => {
      const voted = getVotedRequests();
      expect(voted).toBeInstanceOf(Set);
      expect(voted.size).toBe(0);
    });

    it("should return stored vote IDs as a set", () => {
      storageData["lofield_voted_requests"] = JSON.stringify([
        "id1",
        "id2",
        "id3",
      ]);

      const voted = getVotedRequests();
      expect(voted.size).toBe(3);
      expect(voted.has("id1")).toBe(true);
      expect(voted.has("id2")).toBe(true);
      expect(voted.has("id3")).toBe(true);
    });

    it("should handle corrupted data gracefully", () => {
      storageData["lofield_voted_requests"] = "invalid json{";

      const voted = getVotedRequests();
      expect(voted).toBeInstanceOf(Set);
      expect(voted.size).toBe(0);
    });

    it("should handle non-array data", () => {
      storageData["lofield_voted_requests"] = JSON.stringify({
        not: "an array",
      });

      const voted = getVotedRequests();
      expect(voted.size).toBe(0);
    });
  });

  describe("addVotedRequest", () => {
    it("should add a vote ID to storage", () => {
      addVotedRequest("request123");

      expect(storageData["lofield_voted_requests"]).toBe(
        JSON.stringify(["request123"])
      );
    });

    it("should preserve existing votes when adding new one", () => {
      storageData["lofield_voted_requests"] = JSON.stringify(["id1", "id2"]);

      addVotedRequest("id3");

      const voted = getVotedRequests();
      expect(voted.size).toBe(3);
      expect(voted.has("id1")).toBe(true);
      expect(voted.has("id2")).toBe(true);
      expect(voted.has("id3")).toBe(true);
    });

    it("should not duplicate existing votes", () => {
      storageData["lofield_voted_requests"] = JSON.stringify(["id1", "id2"]);

      addVotedRequest("id1");

      const voted = getVotedRequests();
      expect(voted.size).toBe(2);
    });
  });

  describe("hasVotedForRequest", () => {
    it("should return false for non-voted request", () => {
      expect(hasVotedForRequest("never-voted")).toBe(false);
    });

    it("should return true for voted request", () => {
      storageData["lofield_voted_requests"] = JSON.stringify(["voted-id"]);

      expect(hasVotedForRequest("voted-id")).toBe(true);
    });

    it("should return false after clearing votes", () => {
      storageData["lofield_voted_requests"] = JSON.stringify(["voted-id"]);

      expect(hasVotedForRequest("voted-id")).toBe(true);

      clearVotedRequests();

      expect(hasVotedForRequest("voted-id")).toBe(false);
    });
  });

  describe("clearVotedRequests", () => {
    it("should remove all voted requests from storage", () => {
      storageData["lofield_voted_requests"] = JSON.stringify([
        "id1",
        "id2",
        "id3",
      ]);

      clearVotedRequests();

      expect(storageData["lofield_voted_requests"]).toBeUndefined();
    });

    it("should work even when no votes are stored", () => {
      expect(() => clearVotedRequests()).not.toThrow();
    });
  });

  describe("Edge Cases", () => {
    it("should handle adding multiple votes sequentially", () => {
      addVotedRequest("vote1");
      addVotedRequest("vote2");
      addVotedRequest("vote3");

      const voted = getVotedRequests();
      expect(voted.size).toBe(3);
      expect(hasVotedForRequest("vote1")).toBe(true);
      expect(hasVotedForRequest("vote2")).toBe(true);
      expect(hasVotedForRequest("vote3")).toBe(true);
    });

    it("should handle special characters in vote IDs", () => {
      const specialId = "vote-with-special-chars_123!@#";
      addVotedRequest(specialId);

      const voted = getVotedRequests();
      expect(voted.has(specialId)).toBe(true);
      expect(hasVotedForRequest(specialId)).toBe(true);
    });
  });
});
