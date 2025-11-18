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
} from "../presenter-manager";

describe("Presenter Manager", () => {
  beforeEach(() => {
    clearPresenterConfigCache();
  });

  describe("loadPresentersConfig", () => {
    it("should load presenters configuration", () => {
      const config = loadPresentersConfig();
      expect(config.presenters.length).toBeGreaterThan(0);
    });

    it("should cache configuration", () => {
      const config1 = loadPresentersConfig();
      const config2 = loadPresentersConfig();
      expect(config1).toBe(config2);
    });
  });

  describe("getPresenter", () => {
    it("should retrieve a specific presenter", () => {
      const presenter = getPresenter("alex");
      expect(presenter).not.toBeNull();
      expect(presenter?.name).toBe("Alex");
      expect(presenter?.role).toBe("anchor");
    });

    it("should return null for non-existent presenter", () => {
      const presenter = getPresenter("nonexistent");
      expect(presenter).toBeNull();
    });
  });

  describe("getAllPresenters", () => {
    it("should return all presenters", () => {
      const presenters = getAllPresenters();
      expect(presenters.length).toBeGreaterThan(0);
      expect(presenters[0]).toHaveProperty("id");
      expect(presenters[0]).toHaveProperty("name");
      expect(presenters[0]).toHaveProperty("voice_id");
    });
  });

  describe("getPresentersForShow", () => {
    it("should get presenters for a specific show", () => {
      const presenters = getPresentersForShow("insomniac_office");
      expect(presenters.length).toBe(2);
      expect(presenters.map(p => p.id).sort()).toEqual(["alex", "sam"]);
    });

    it("should return empty array for non-existent show", () => {
      const presenters = getPresentersForShow("nonexistent_show");
      expect(presenters).toEqual([]);
    });
  });

  describe("getPresenterVoiceMap", () => {
    it("should create a map of presenter IDs to voice IDs", () => {
      const voiceMap = getPresenterVoiceMap();
      expect(Object.keys(voiceMap).length).toBeGreaterThan(0);
      expect(voiceMap["alex"]).toBe("voice_alex_contemplative");
    });
  });

  describe("getPresenterVoiceId", () => {
    it("should get voice ID for a presenter", () => {
      const voiceId = getPresenterVoiceId("alex");
      expect(voiceId).toBe("voice_alex_contemplative");
    });

    it("should return null for non-existent presenter", () => {
      const voiceId = getPresenterVoiceId("nonexistent");
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
      const result = selectPresenters(["alex", "sam"], 1.0);
      expect(result.isDuo).toBe(true);
      expect(result.presenters).toEqual(["alex", "sam"]);
    });

    it("should select solo when probability is 0%", () => {
      const result = selectPresenters(["alex", "sam"], 0.0);
      expect(result.isDuo).toBe(false);
      expect(result.presenters.length).toBe(1);
      expect(["alex", "sam"]).toContain(result.presenters[0]);
    });

    it("should return valid selection with 50% probability", () => {
      const result = selectPresenters(["alex", "sam"], 0.5);
      expect(typeof result.isDuo).toBe("boolean");
      expect(result.presenters.length).toBeGreaterThan(0);
      if (result.isDuo) {
        expect(result.presenters.length).toBe(2);
      } else {
        expect(result.presenters.length).toBe(1);
      }
    });
  });

  describe("getAnchorAndSidekick", () => {
    it("should identify anchor and sidekick from duo", () => {
      const { anchor, sidekick } = getAnchorAndSidekick(["alex", "sam"]);
      expect(anchor).not.toBeNull();
      expect(sidekick).not.toBeNull();
      expect(anchor?.role).toBe("anchor");
      expect(sidekick?.role).toBe("sidekick");
    });

    it("should handle empty array", () => {
      const { anchor, sidekick } = getAnchorAndSidekick([]);
      expect(anchor).toBeNull();
      expect(sidekick).toBeNull();
    });
  });

  describe("formatPresenterNames", () => {
    it("should format single presenter name", () => {
      const formatted = formatPresenterNames(["alex"]);
      expect(formatted).toBe("Alex");
    });

    it("should format duo names", () => {
      const formatted = formatPresenterNames(["alex", "sam"]);
      expect(formatted).toBe("Alex & Sam");
    });

    it("should handle empty array", () => {
      const formatted = formatPresenterNames([]);
      expect(formatted).toBe("Unknown");
    });

    it("should handle non-existent presenters", () => {
      const formatted = formatPresenterNames(["nonexistent"]);
      expect(formatted).toBe("Unknown");
    });
  });

  describe("splitScriptForDuo", () => {
    it("should return single line for solo presenter", () => {
      const script = "Hello, this is a test.";
      const result = splitScriptForDuo(script, ["alex"]);
      expect(result.length).toBe(1);
      expect(result[0].presenterId).toBe("alex");
      expect(result[0].text).toBe(script);
    });

    it("should split script for duo presenters", () => {
      const script = "Hello there. How are you? Great to be here.";
      const result = splitScriptForDuo(script, ["alex", "sam"]);
      expect(result.length).toBeGreaterThan(1);
      expect(result.some(line => line.presenterId === "alex")).toBe(true);
      expect(result.some(line => line.presenterId === "sam")).toBe(true);
    });

    it("should assign anchor more lines", () => {
      const script = "Line one. Line two. Line three. Line four. Line five.";
      const result = splitScriptForDuo(script, ["alex", "sam"]);
      const alexLines = result.filter(line => line.presenterId === "alex").length;
      const samLines = result.filter(line => line.presenterId === "sam").length;
      // Anchor (alex) should have more or equal lines
      expect(alexLines).toBeGreaterThanOrEqual(samLines);
    });
  });
});
