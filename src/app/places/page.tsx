import { redirect } from "next/navigation";

// Temporary redirect to Browse until Task 9 replaces this with the swipe deck.
export default function PlacesIndex() {
  redirect("/places/browse");
}
