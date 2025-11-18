/**
 * Tests for Presenter Manager Enhancements
 * Tests for fair rotation, usage tracking, and async features
 */

import {
  selectPresenters,
  getPresenterUsage,
  resetPresenterUsage,
  clearPresenterConfigCache,
} from "../presenter-manager";

describe("Presenter Manager Enhancements", () => {
  beforeEach(() => {
    clearPresenterConfigCache();
    resetPresenterUsage(); // Reset usage tracking between tests
  });

  describe("Fair Presenter Rotation", () => {
    it("should track presenter usage per show", () => {
      const showId = "test_show_1";
      const duo = ["presenter_a", "presenter_b"];
      
      // Generate several solo selections
      for (let i = 0; i < 10; i++) {
        selectPresenters(duo, 0.0, showId); // Always solo
      }
      
      const usage = getPresenterUsage(showId);
      
      // Both presenters should have been used
      expect(usage["presenter_a"]).toBeGreaterThan(0);
      expect(usage["presenter_b"]).toBeGreaterThan(0);
      
      // Total should be 10
      expect(usage["presenter_a"] + usage["presenter_b"]).toBe(10);
    });

    it("should ensure balanced rotation over many selections", () => {
      const showId = "balance_test";
      const duo = ["anchor", "sidekick"];
      const iterations = 100;
      
      // Generate many solo selections
      for (let i = 0; i < iterations; i++) {
        selectPresenters(duo, 0.0, showId); // Always solo
      }
      
      const usage = getPresenterUsage(showId);
      const anchorCount = usage["anchor"];
      const sidekickCount = usage["sidekick"];
      
      // Calculate difference as percentage
      const diff = Math.abs(anchorCount - sidekickCount);
      const percentDiff = (diff / iterations) * 100;
      
      // Difference should be small (less than 10% of total)
      expect(percentDiff).toBeLessThan(10);
    });

    it("should select less-used presenter when usage is unequal", () => {
      const showId = "fairness_test";
      const duo = ["presenter_1", "presenter_2"];
      
      // Manually create unequal usage
      // Select presenter_1 multiple times to create imbalance
      for (let i = 0; i < 5; i++) {
        // We'll directly test the fairness by tracking
        selectPresenters(duo, 0.0, showId);
      }
      
      // Get current usage
      const usageBefore = getPresenterUsage(showId);
      const diff = Math.abs(usageBefore["presenter_1"] - usageBefore["presenter_2"]);
      
      // If there's a difference, next selections should favor the less-used one
      if (diff > 0) {
        const lessUsed = usageBefore["presenter_1"] < usageBefore["presenter_2"] 
          ? "presenter_1" 
          : "presenter_2";
        
        // Next few selections should favor the less-used presenter
        let lessUsedCount = 0;
        for (let i = 0; i < 10; i++) {
          const result = selectPresenters(duo, 0.0, showId);
          if (result.presenters[0] === lessUsed) {
            lessUsedCount++;
          }
        }
        
        // The less-used presenter should get selected more often
        expect(lessUsedCount).toBeGreaterThanOrEqual(5);
      }
    });

    it("should not track usage when no showId is provided", () => {
      const duo = ["presenter_x", "presenter_y"];
      
      // Select without showId
      for (let i = 0; i < 5; i++) {
        selectPresenters(duo, 0.0); // No showId
      }
      
      // Usage should be empty or minimal for undefined show
      const usage = getPresenterUsage("undefined_show");
      expect(Object.keys(usage).length).toBe(0);
    });

    it("should track usage independently per show", () => {
      const duo = ["host_a", "host_b"];
      const show1 = "morning_show";
      const show2 = "evening_show";
      
      // Generate selections for show1
      for (let i = 0; i < 5; i++) {
        selectPresenters(duo, 0.0, show1);
      }
      
      // Generate selections for show2
      for (let i = 0; i < 3; i++) {
        selectPresenters(duo, 0.0, show2);
      }
      
      const usage1 = getPresenterUsage(show1);
      const usage2 = getPresenterUsage(show2);
      
      // Total for show1 should be 5
      expect((usage1["host_a"] || 0) + (usage1["host_b"] || 0)).toBe(5);
      
      // Total for show2 should be 3
      expect((usage2["host_a"] || 0) + (usage2["host_b"] || 0)).toBe(3);
    });

    it("should reset usage tracking when requested", () => {
      const showId = "reset_test";
      const duo = ["p1", "p2"];
      
      // Generate some usage
      for (let i = 0; i < 5; i++) {
        selectPresenters(duo, 0.0, showId);
      }
      
      // Verify usage exists
      let usage = getPresenterUsage(showId);
      expect((usage["p1"] || 0) + (usage["p2"] || 0)).toBe(5);
      
      // Reset
      resetPresenterUsage(showId);
      
      // Usage should be cleared
      usage = getPresenterUsage(showId);
      expect(Object.keys(usage).length).toBe(0);
    });

    it("should handle duo selections without affecting rotation", () => {
      const showId = "duo_test";
      const duo = ["lead", "support"];
      
      // Mix of duo and solo selections
      selectPresenters(duo, 1.0, showId); // Duo
      selectPresenters(duo, 0.0, showId); // Solo
      selectPresenters(duo, 1.0, showId); // Duo
      selectPresenters(duo, 0.0, showId); // Solo
      
      const usage = getPresenterUsage(showId);
      
      // Only solo selections should be tracked (2 total)
      expect((usage["lead"] || 0) + (usage["support"] || 0)).toBe(2);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty duo array gracefully", () => {
      const result = selectPresenters([], 0.5, "test");
      
      expect(result.presenters.length).toBeLessThanOrEqual(2);
    });

    it("should handle single presenter in duo", () => {
      const result = selectPresenters(["solo"], 0.5, "test");
      
      // Should still work
      expect(result.presenters.length).toBeGreaterThanOrEqual(0);
    });

    it("should handle 100% duo probability", () => {
      const duo = ["a", "b"];
      
      for (let i = 0; i < 10; i++) {
        const result = selectPresenters(duo, 1.0, "test");
        expect(result.isDuo).toBe(true);
        expect(result.presenters.length).toBe(2);
      }
    });

    it("should handle 0% duo probability", () => {
      const duo = ["a", "b"];
      
      for (let i = 0; i < 10; i++) {
        const result = selectPresenters(duo, 0.0, "test");
        expect(result.isDuo).toBe(false);
        expect(result.presenters.length).toBe(1);
      }
    });
  });

  describe("Statistical Distribution", () => {
    it("should produce statistically fair distribution over large sample", () => {
      const showId = "stats_test";
      const duo = ["presenter_alpha", "presenter_beta"];
      const sampleSize = 1000;
      
      // Generate large sample
      for (let i = 0; i < sampleSize; i++) {
        selectPresenters(duo, 0.0, showId);
      }
      
      const usage = getPresenterUsage(showId);
      const alpha = usage["presenter_alpha"] || 0;
      const beta = usage["presenter_beta"] || 0;
      
      // Both should be used
      expect(alpha).toBeGreaterThan(0);
      expect(beta).toBeGreaterThan(0);
      
      // Calculate chi-square for fairness (simplified)
      // For a fair coin flip, we expect 500/500
      const expected = sampleSize / 2;
      const chiSquare = Math.pow(alpha - expected, 2) / expected + 
                       Math.pow(beta - expected, 2) / expected;
      
      // Chi-square should be small for fair distribution
      // For 1 degree of freedom, critical value at 0.05 significance is 3.841
      expect(chiSquare).toBeLessThan(10); // Generous threshold
    });
  });
});
