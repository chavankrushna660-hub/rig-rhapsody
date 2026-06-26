import { createFileRoute } from "@tanstack/react-router";
import { ToonseApp } from "../components/toonse/ToonseApp";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Toonse Pro Drawing Studio" },
      { name: "description", content: "A canvas drawing studio with smooth transforms, fills, frames, and bone rigging." },
      { property: "og:title", content: "Toonse Pro Drawing Studio" },
      { property: "og:description", content: "Draw, fill, deform, rig with bones, animate frames, and export from a white canvas." },
    ],
  }),
  component: Index,
});

function Index() {
  return <ToonseApp />;
}
