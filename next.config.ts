import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Story art is versioned via a ?v=N query so caches drop the old set when
    // the art is replaced; Next 16 requires declaring that pattern up front.
    localPatterns: [{ pathname: "/story/**", search: "?v=2" }],
  },
};

export default nextConfig;
