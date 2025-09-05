"use client";
import Link from "next/link";

export default function Home() {
  return (
    <main className="h-screen w-full flex flex-col justify-center items-center overflow-hidden">
      <div className="text-center max-w-xl space-y-6">
        <h1 className="text-5xl font-bold">Accessible Computing For All</h1>
        <p className="text-lg">
          Empowering disabled people to use computers with eye blinks and head
          nods. This playground helps you train and master the controls before
          using real software.
        </p>
        <div className="space-y-4">
          <Link href="/level1">
            <span className="mt-8 inline-block px-8 py-4 bg-white text-black font-semibold rounded-xl hover:bg-gray-200 shadow-lg transition">
              Start Level 1
            </span>
          </Link>
        </div>
      </div>
    </main>
  );
}
