import Link from "next/link";
import { PageHero } from "@/components/walshken/public-content";

export default function PublicNotFound() {
  return <PageHero label="PAGE UNAVAILABLE" title="Let’s get you to the right place." icon="compass"
    description="Browse Walshken’s current service divisions or search by country.">
    <Link className="btn btn-blue" href="/services">Browse services</Link>
    <Link className="text-link" href="/countries">Browse countries</Link>
  </PageHero>;
}
