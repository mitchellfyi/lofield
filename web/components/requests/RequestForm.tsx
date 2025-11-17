"use client";

import { useState } from "react";
import { Music, MessageSquare, Send } from "lucide-react";
import type { CreateRequestData } from "@/lib/types";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestFormProps {
  onSubmitSuccess?: () => void;
}

export function RequestForm({ onSubmitSuccess }: RequestFormProps) {
  const [requestType, setRequestType] = useState<"music" | "talk">("music");
  const [text, setText] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const minLength = 10;
  const maxLength = 200;
  const isValid = text.trim().length >= minLength;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isValid) {
      setFeedback({
        type: "error",
        message: `Please enter at least ${minLength} characters`,
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback(null);

    try {
      const requestData: CreateRequestData = {
        type: requestType,
        text: text.trim(),
      };

      // TODO: Once backend is fully implemented, enhance error handling to:
      // - Display specific error messages from the API (e.g., moderation failures, rate limiting)
      // - Handle network timeouts gracefully
      // - Show more detailed success feedback (e.g., estimated queue position)
      const response = await fetch(`${API_URL}/api/requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error("Failed to submit request");
      }

      setFeedback({
        type: "success",
        message: "Request submitted successfully!",
      });
      setText("");
      onSubmitSuccess?.();
    } catch {
      // TODO: When connected to real backend, parse and display specific error messages
      setFeedback({
        type: "error",
        message: "Failed to submit request. Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Request Type Toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setRequestType("music")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition-all ${
            requestType === "music"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <Music size={18} />
          <span>Music</span>
        </button>
        <button
          type="button"
          onClick={() => setRequestType("talk")}
          className={`flex flex-1 items-center justify-center gap-2 rounded-lg border px-4 py-3 font-medium transition-all ${
            requestType === "talk"
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground"
          }`}
        >
          <MessageSquare size={18} />
          <span>Talk</span>
        </button>
      </div>

      {/* Text Input */}
      <div className="space-y-2">
        <label htmlFor="request-text" className="text-sm font-medium">
          {requestType === "music" ? "Music Mood" : "Talk Topic"}
        </label>
        <textarea
          id="request-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            requestType === "music"
              ? "e.g., chill sunset vibes with jazzy piano"
              : "e.g., tips for staying productive while working from home"
          }
          maxLength={maxLength}
          rows={3}
          className="w-full rounded-lg border border-input bg-background px-4 py-3 text-sm transition-colors placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-2 focus:ring-ring/20"
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {text.length >= minLength ? "✓" : ""} Minimum {minLength} characters
          </span>
          <span>
            {text.length}/{maxLength}
          </span>
        </div>
      </div>

      {/* Feedback Message */}
      {feedback && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === "success"
              ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-950 dark:text-green-200"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!isValid || isSubmitting}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send size={18} />
        <span>{isSubmitting ? "Submitting..." : "Submit Request"}</span>
      </button>
    </form>
  );
}
