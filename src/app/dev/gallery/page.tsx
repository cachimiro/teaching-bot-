import { notFound } from "next/navigation";
import { Gallery } from "./gallery";

export default function GalleryPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <Gallery />;
}
