import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ensurePlatformOwner, landingPath, readContext } from "@/lib/auth/session";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Opening FloorTrack…</p>}>
      <HomeRedirect />
    </Suspense>
  );
}

async function HomeRedirect() {
  await ensurePlatformOwner();
  const context = await readContext();
  redirect(await landingPath(context));
  return null;
}
