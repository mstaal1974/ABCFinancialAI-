import { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import Vault from "./components/Vault";
import ProductDetail from "./components/ProductDetail";
import Education from "./components/Education";
import VIPClub from "./components/VIPClub";
import CommitDrawer from "./components/CommitDrawer";
import Footer from "./components/Footer";
import AuthModal from "./components/AuthModal";
import SampleBox from "./components/SampleBox";
import GiftSection from "./components/GiftSection";
import GiftRedeem from "./components/GiftRedeem";
import { useFragrances, useVIP } from "./lib/store";
import { useAuth } from "./lib/auth";
import { useGifts } from "./lib/gifts";
import { authorizePayment, notifyAdminBatchClosed } from "./lib/stripe";
import { findFragrance } from "./lib/data";

type Route =
  | { kind: "home" }
  | { kind: "product"; slug: string }
  | { kind: "gift"; code: string };

function readRoute(): Route {
  const hash = window.location.hash.replace(/^#/, "");
  const product = hash.match(/^\/?fragrance\/([\w-]+)/);
  if (product) return { kind: "product", slug: product[1] };
  const gift = hash.match(/^\/?gift\/([A-Z0-9-]+)/i);
  if (gift) return { kind: "gift", code: gift[1].toUpperCase() };
  return { kind: "home" };
}

const SECTION_IDS = {
  vault: "vault",
  samples: "samples",
  gift: "gift",
  education: "method",
  vip: "vip",
} as const;

export default function App() {
  const { fragrances, commits, commit, releaseCommit } = useFragrances();
  const { vip, join, leave } = useVIP();
  const { user, signOut } = useAuth();
  const gifts = useGifts(user?.email ?? null);
  const [route, setRoute] = useState<Route>(() => readRoute());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<string | undefined>();

  // Hash-based routing keeps the MVP single-page but shareable.
  useEffect(() => {
    const onHash = () => setRoute(readRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  function go(target: "home" | "vault" | "samples" | "gift" | "education" | "vip") {
    if (target === "home") {
      window.location.hash = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const sectionId = SECTION_IDS[target];
    if (route.kind !== "home") {
      window.location.hash = "";
      setTimeout(
        () => document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openProduct(slug: string) {
    window.location.hash = `/fragrance/${slug}`;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backHome(targetSection?: keyof typeof SECTION_IDS) {
    window.location.hash = "";
    if (targetSection) {
      setTimeout(
        () =>
          document.getElementById(SECTION_IDS[targetSection])?.scrollIntoView({ behavior: "smooth" }),
        50,
      );
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function requireAuth(reason?: string) {
    setAuthReason(reason);
    setAuthOpen(true);
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
    if (!user) {
      requireAuth("Sign in to reserve a spot in this batch.");
      return;
    }
    // Apply any available gift balance first; only the remainder hits Stripe.
    const split = await gifts.applyBalance(productFragrance.priceCents);
    if (split.chargeCents > 0) {
      await authorizePayment({
        fragranceId: productFragrance.id,
        amountCents: split.chargeCents,
      });
    }
    await commit(productFragrance.id, label, {
      userId: user.id,
      userEmail: user.email,
    });
    setDrawerOpen(true);
  }

  const alreadyCommitted = !!productFragrance &&
    commits.some((c) => c.fragranceId === productFragrance.id);

  return (
    <div className="grain min-h-full">
      <Header
        commitCount={commits.length}
        vip={vip}
        user={user}
        giftBalanceCents={gifts.balanceCents}
        onOpenCommits={() => setDrawerOpen(true)}
        onOpenAuth={() => requireAuth()}
        onSignOut={signOut}
        onNavigate={go}
      />

      {route.kind === "home" && (
        <>
          <Hero onEnterVault={() => go("vault")} />
          <Vault fragrances={fragrances} vip={vip} onOpen={openProduct} />
          <SampleBox
            fragrances={fragrances}
            user={user}
            giftBalanceCents={gifts.balanceCents}
            onApplyGift={gifts.applyBalance}
            onRequireAuth={() =>
              requireAuth("Sign in to order your sample box.")
            }
          />
          <GiftSection
            user={user}
            onRequireAuth={requireAuth}
            onPurchase={gifts.purchase}
          />
          <Education />
          <VIPClub vip={vip} onJoin={join} onLeave={leave} />
        </>
      )}

      {route.kind === "product" && productFragrance && (
        <ProductDetail
          fragrance={productFragrance}
          vip={vip}
          alreadyCommitted={alreadyCommitted}
          giftBalanceCents={gifts.balanceCents}
          onBack={() => backHome("vault")}
          onCommit={handleCommit}
        />
      )}

      {route.kind === "product" && !productFragrance && (
        <div className="mx-auto max-w-3xl px-6 py-32 text-center">
          <h2 className="serif text-4xl text-cream">Fragrance not found</h2>
          <button
            onClick={() => backHome("vault")}
            className="mt-8 inline-block sans text-[11px] uppercase tracking-[0.28em] text-gold border-b border-gold/40 hover:border-gold pb-1"
          >
            Return to the Vault
          </button>
        </div>
      )}

      {route.kind === "gift" && (
        <GiftRedeem
          code={route.code}
          user={user}
          onLookup={gifts.lookup}
          onRedeem={gifts.redeem}
          onRequireAuth={requireAuth}
          onBack={() => backHome()}
          onEnterVault={() => backHome("vault")}
        />
      )}

      <Footer />

      <CommitDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        commits={commits}
        fragrances={fragrances}
        onRelease={releaseCommit}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        reason={authReason}
      />
    </div>
  );
}
