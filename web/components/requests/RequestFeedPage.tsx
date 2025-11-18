"use client";

import { RequestFeed } from "./RequestFeed";

export function RequestFeedPage() {
  return (
    <div className="max-h-[600px] overflow-y-auto">
      <RequestFeed refreshKey={0} />
    </div>
  );
}
