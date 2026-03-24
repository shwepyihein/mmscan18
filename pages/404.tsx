import Head from "next/head";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFoundPage() {
  return (
    <>
      <Head>
        <title>Not found | hotManhwammhub</title>
      </Head>
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
        <p className="text-6xl font-black text-zinc-700">404</p>
        <p className="text-center text-sm text-zinc-400">
          This page does not exist or was moved.
        </p>
        <Button asChild className="rounded-xl">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </>
  );
}
