import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Vault from "./components/Vault";
import ProductDetail from "./components/ProductDetail";
import Education from "./components/Education";
import VIPClub from "./components/VIPClub";
import CommitDrawer from "./components/CommitDrawer";
import Footer from "./components/Footer";
import { useFragrances, useVIP } from "./lib/store";
import { authorizePayment, notifyAdminBatchClosed } from "./lib/stripe";
import { findFragrance } from "./lib/data";

type Route =
  | { kind: "home" }
  | { kind: "product"; slug: string };

function readRoute(): Route {
  const hash = window.location.hash.replace(/^#/, "");
  const m = hash.match(/^\/?fragrance\/([\w-]+)/);
  if (m) return { kind: "product", slug: m[1] };
  return { kind: "home" };
}

export default function App() {
  const { fragrances, commits, commit, releaseCommit } = useFragrances();
  const { vip, join, leave } = useVIP();
  const [route, setRoute] = useState<Route>(() => readRoute());
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Hash-based routing keeps the MVP single-page but shareable.
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(target: "home" | "vault" | "education" | "vip") {
    if (target === "home") {
      window.location.hash = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (target === "vault" && route.kind !== "home") {
      window.location.hash = "";
      // wait for route to update before scroll
      setTimeout(() => document.getElementById("vault")?.scrollIntoView({ behavior: "smooth" }), 50);
      return;
    }
    const el = document.getElementById(target === "vault" ? "vault" : target === "education" ? "method" : "vip");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openProduct(slug: string) {
    window.location.hash = `/fragrance/${slug}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeProduct() {
    window.location.hash = "";
    setTimeout(() => document.getElementById("vault")?.scrollIntoView({ behavior: "smooth" }), 50);
  }

  const productFragrance = useMemo(
    () => (route.kind === "product" ? findFragrance(route.slug) : undefined),
    [route],
  );

  // When a batch crosses MOQ, fire the admin notification + capture stub.
  useEffect(() => {
    fragrances.forEach((f) => {
      if (f.committed === f.moq) {
        const key = `mo:notified:${f.id}`;
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, "1");
        void notifyAdminBatchClosed({
          fragranceId: f.id,
          fragranceName: f.name,
          count: f.committed,
        });
      }
    });
  }, [fragrances]);

  async function handleCommit(label: string | null) {
    if (!productFragrance) return;
    await authorizePayment({
      fragranceId: productFragrance.id,
      amountCents: productFragrance.priceCents,
    });
    await commit(productFragrance.id, label);
    setDrawerOpen(true);
  }

  const alreadyCommitted = !!productFragrance &&
    commits.some((c) => c.fragranceId === productFragrance.id);

  return (
    <div className="grain min-h-full">
      <Header
        commitCount={commits.length}
        vip={vip}
        onOpenCommits={() => setDrawerOpen(true)}
        onNavigate={go}
      />

      {route.kind === "home" && (
        <>
          <Hero onEnterVault={() => go("vault")} />
          <Vault fragrances={fragrances} vip={vip} onOpen={openProduct} />
          <Education />
          <VIPClub vip={vip} onJoin={join} onLeave={leave} />
        </>
      )}

      {route.kind === "product" && productFragrance && (
        <ProductDetail
          fragrance={productFragrance}
          vip={vip}
          alreadyCommitted={alreadyCommitted}
          onBack={closeProduct}
          onCommit={handleCommit}
        />
      )}

      {route.kind === "product" && !productFragrance && (
        <div className="mx-auto max-w-3xl px-6 py-32 text-center">
          <h2 className="serif text-4xl text-cream">Fragrance not found</h2>
          <button
            onClick={closeProduct}
            className="mt-8 inline-block sans text-[11px] uppercase tracking-[0.28em] text-gold border-b border-gold/40 hover:border-gold pb-1"
          >
            Return to the Vault
          </button>
        </div>
      )}

      <Footer />

      <CommitDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        commits={commits}
        fragrances={fragrances}
        onRelease={releaseCommit}
      />
    </div>
  );
}
