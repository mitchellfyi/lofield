/**
 * Tests for Presenter Manager Module
 */

import {
  loadPresentersConfig,
  getPresenter,
  getAllPresenters,
  getPresentersForShow,
  getPresenterVoiceMap,
  getPresenterVoiceId,
  shouldBeDuo,
  selectPresenters,
  getAnchorAndSidekick,
  formatPresenterNames,
  splitScriptForDuo,
  clearPresenterConfigCache,
  getPresenterUsage,
  resetPresenterUsage,
} from "../presenter-manager";

describe("Presenter Manager", () => {
  beforeEach(() => {
    clearPresenterConfigCache();
    resetPresenterUsage(); // Reset usage tracking between tests
  });

  describe("loadPresentersConfig", () => {
    it("should load presenters configuration", async () => {
      const config = await loadPresentersConfig();
      expect(config.presenters.length).toBeGreaterThan(0);
    });

    it("should cache configuration", async () => {
      const config1 = await loadPresentersConfig();
      const config2 = await loadPresentersConfig();
      expect(config1).toBe(config2);
    });
  });

  describe("getPresenter", () => {
    it("should retrieve a specific presenter", async () => {
      const presenter = await getPresenter("morgan");
      expect(presenter).not.toBeNull();
      expect(presenter?.name).toBe("Morgan");
      expect(presenter?.role).toBe("anchor");
    });

    it("should return null for non-existent presenter", async () => {
      const presenter = await getPresenter("nonexistent");
      expect(presenter).toBeNull();
    });
  });

  describe("getAllPresenters", () => {
    it("should return all presenters", async () => {
      const presenters = await getAllPresenters();
      expect(presenters.length).toBeGreaterThan(0);
      expect(presenters[0]).toHaveProperty("id");
      expect(presenters[0]).toHaveProperty("name");
      expect(presenters[0]).toHaveProperty("voice_id");
    });
  });

  describe("getPresentersForShow", () => {
    it("should get presenters for a specific show", async () => {
      const presenters = await getPresentersForShow("mild_panic_mornings");
      expect(presenters.length).toBe(2);
      expect(presenters.map(p => p.id).sort()).toEqual(["morgan", "riley"]);
    });

    it("should return empty array for non-existent show", async () => {
      const presenters = await getPresentersForShow("nonexistent_show");
      expect(presenters).toEqual([]);
    });
  });

  describe("getPresenterVoiceMap", () => {
    it("should create a map of presenter IDs to voice IDs", async () => {
      const voiceMap = await getPresenterVoiceMap();
      expect(Object.keys(voiceMap).length).toBeGreaterThan(0);
      expect(voiceMap["morgan"]).toBe("voice_morgan_resigned");
    });
  });

  describe("getPresenterVoiceId", () => {
    it("should get voice ID for a presenter", async () => {
      const voiceId = await getPresenterVoiceId("morgan");
      expect(voiceId).toBe("voice_morgan_resigned");
    });

    it("should return null for non-existent presenter", async () => {
      const voiceId = await getPresenterVoiceId("nonexistent");
      expect(voiceId).toBeNull();
    });
  });

  describe("shouldBeDuo", () => {
    it("should return true with 100% probability", () => {
      expect(shouldBeDuo(1.0)).toBe(true);
    });

    it("should return false with 0% probability", () => {
      expect(shouldBeDuo(0.0)).toBe(false);
    });

    it("should return boolean with 50% probability", () => {
      const result = shouldBeDuo(0.5);
      expect(typeof result).toBe("boolean");
    });
  });

  describe("selectPresenters", () => {
    it("should select duo when probability is 100%", () => {
      const result = selectPresenters(["morgan", "riley"], 1.0, "test_show");
      expect(result.isDuo).toBe(true);
      expect(result.presenters).toEqual(["morgan", "riley"]);
    });

    it("should select solo when probability is 0%", () => {
      const result = selectPresenters(["morgan", "riley"], 0.0, "test_show");
      expect(result.isDuo).toBe(false);
      expect(result.presenters.length).toBe(1);
      expect(["morgan", "riley"]).toContain(result.presenters[0]);
    });

    it("should return valid selection with 50% probability", () => {
      const result = selectPresenters(["morgan", "riley"], 0.5, "test_show");
      expect(typeof result.isDuo).toBe("boolean");
      expect(result.presenters.length).toBeGreaterThan(0);
      if (result.isDuo) {
        expect(result.presenters.length).toBe(2);
      } else {
        expect(result.presenters.length).toBe(1);
      }
    });
    
    it("should rotate presenters fairly for solo segments", () => {
      const showId = "fair_rotation_test";
      const duo = ["morgan", "riley"];
      const selections: string[] = [];
      
      // Generate multiple solo selections
      for (let i = 0; i < 20; i++) {
        const result = selectPresenters(duo, 0.0, showId); // Always solo
        selections.push(result.presenters[0]);
      }
      
      // Check usage is being tracked
      const usage = getPresenterUsage(showId);
      expect(usage["morgan"]).toBeDefined();
      expect(usage["riley"]).toBeDefined();
      
      // Check that both presenters were selected
      expect(selections).toContain("morgan");
      expect(selections).toContain("riley");
      
      // Check that rotation is reasonably fair (within 20% difference)
      const morganCount = usage["morgan"];
      const rileyCount = usage["riley"];
      const diff = Math.abs(morganCount - rileyCount);
      const maxDiff = Math.ceil(selections.length * 0.2); // 20% tolerance
      expect(diff).toBeLessThanOrEqual(maxDiff);
    });
  });

  describe("getAnchorAndSidekick", () => {
    it("should identify anchor and sidekick from duo", async () => {
      const { anchor, sidekick } = await getAnchorAndSidekick(["morgan", "riley"]);
      expect(anchor).not.toBeNull();
      expect(sidekick).not.toBeNull();
      expect(anchor?.role).toBe("anchor");
      expect(sidekick?.role).toBe("sidekick");
    });

    it("should handle empty array", async () => {
      const { anchor, sidekick } = await getAnchorAndSidekick([]);
      expect(anchor).toBeNull();
      expect(sidekick).toBeNull();
    });
  });

  describe("formatPresenterNames", () => {
    it("should format single presenter name", async () => {
      const formatted = await formatPresenterNames(["morgan"]);
      expect(formatted).toBe("Morgan");
    });

    it("should format duo names", async () => {
      const formatted = await formatPresenterNames(["morgan", "riley"]);
      expect(formatted).toBe("Morgan & Riley");
    });

    it("should handle empty array", async () => {
      const formatted = await formatPresenterNames([]);
      expect(formatted).toBe("Unknown");
    });

    it("should handle non-existent presenters", async () => {
      const formatted = await formatPresenterNames(["nonexistent"]);
      expect(formatted).toBe("Unknown");
    });
  });

  describe("splitScriptForDuo", () => {
    it("should return single line for solo presenter", async () => {
      const script = "Hello, this is a test.";
      const result = await splitScriptForDuo(script, ["morgan"]);
      expect(result.length).toBe(1);
      expect(result[0].presenterId).toBe("morgan");
      expect(result[0].text).toBe(script);
    });

    it("should split script for duo presenters", async () => {
      const script = "Hello there. How are you? Great to be here.";
      const result = await splitScriptForDuo(script, ["morgan", "riley"]);
      expect(result.length).toBeGreaterThan(1);
      expect(result.some(line => line.presenterId === "morgan")).toBe(true);
      expect(result.some(line => line.presenterId === "riley")).toBe(true);
    });

    it("should assign anchor more lines", async () => {
      const script = "Line one. Line two. Line three. Line four. Line five.";
      const result = await splitScriptForDuo(script, ["morgan", "riley"]);
      const morganLines = result.filter(line => line.presenterId === "morgan").length;
      const rileyLines = result.filter(line => line.presenterId === "riley").length;
      // Anchor (morgan) should have more or equal lines
      expect(morganLines).toBeGreaterThanOrEqual(rileyLines);
    });
  });
});
