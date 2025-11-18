import { notFound } from "next/navigation";
import { getShowById, getPresentersForShow, loadShows } from "@/lib/shows";
import { ShowDetailContent } from "@/components/shows/ShowDetailContent";
import type { Metadata } from "next";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const show = getShowById(id);

  if (!show) {
    return {
      title: "Show Not Found - Lofield FM",
    };
  }

  return {
    title: `${show.name} - Lofield FM`,
    description: show.description,
  };
}

export async function generateStaticParams() {
  const shows = loadShows();
  return shows.map((show) => ({
    id: show.id,
  }));
}

export default async function ShowDetailPage({ params }: Props) {
  const { id } = await params;
  const show = getShowById(id);

  if (!show) {
    notFound();
  }

  const presenters = getPresentersForShow(show);

  return <ShowDetailContent show={show} presenters={presenters} />;
}
