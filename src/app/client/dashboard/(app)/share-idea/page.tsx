import type { Metadata } from "next";
import { ProductIdeaForm } from "./product-idea-form";

export const metadata: Metadata = {
  title: "Share An Idea | Client | Match Fit",
};

export default function ClientShareIdeaPage() {
  return (
    <div className="space-y-8">
      <header className="space-y-2 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#FF7E00]/90">Product Feedback</p>
        <h1 className="text-3xl font-black uppercase tracking-[0.06em] text-white sm:text-4xl">SHARE AN IDEA</h1>
        <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
          Tell us what would make Match Fit better for you or your clients. You can include your name or submit
          anonymously. We read every submission.
        </p>
      </header>
      <section className="rounded-3xl border border-white/[0.08] bg-[#12151C]/90 p-6 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.85)] backdrop-blur-xl sm:p-8">
        <ProductIdeaForm />
      </section>
    </div>
  );
}
