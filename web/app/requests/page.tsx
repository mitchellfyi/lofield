import { RequestsContent } from "@/components/requests/RequestsContent";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Requests - Lofield FM",
  description:
    "Request a song or topic and see what others are requesting. Vote for your favorites.",
};

export default function RequestsPage() {
  return <RequestsContent />;
}
