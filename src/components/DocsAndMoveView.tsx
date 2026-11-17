import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { MOVE_CONTRACTS } from '../data/moveContracts';

type DocTab = 'gdd' | 'architecture' | 'move' | 'seasons';

export const DocsAndMoveView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<DocTab>('gdd');
  const [selectedFile, setSelectedFile] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  const currentMove = MOVE_CONTRACTS[selectedFile];

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(currentMove.code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <div className="space-y-8">
      {/* Sub-navigation */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <p className="text-xs font-medium text-sky-400">
            Yeti Flurry Rush · Lofi the Yeti on Sui
          </p>
          <h2 className="font-display text-2xl md:text-3xl font-bold text-white mt-1">
            Game Guide & Sui Move Architecture
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 p-1">
          {(
            [
              { key: 'gdd', label: '01. Gameplay & Economy' },
              { key: 'architecture', label: '02. Sui Stack' },
              { key: 'move', label: '03. Move Contracts' },
              { key: 'seasons', label: '04. Seasons & Security' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.key
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* 01. GAMEPLAY & ECONOMY */}
      {activeTab === 'gdd' && (
        <div className="grid gap-8 lg:grid-cols-2">
          <div className="space-y-6 rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Game Overview
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                <strong className="text-white">Yeti Flurry Rush</strong> is a fast-paced 3D arctic survival arcade game on Sui where players glide as evolvable Lofi Yetis across shrinking glacial arenas, outplay rivals in low-latency Sui Tunnels, and turn every collected water drop into transparent funding for Lofi real-world clean water wells.
              </p>
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white">Core 60-Second Loop</h4>
              <ol className="space-y-2 text-sm text-slate-300 list-decimal list-inside">
                <li>
                  <strong className="text-slate-100">Glide & Gather:</strong> Navigate icy physics around the central stone rune well, scooping Glacial Drops (Well Pool) and Frost Gems (Cosmetics).
                </li>
                <li>
                  <strong className="text-slate-100">Dash & Knockback:</strong> Trigger Frost Dash (Space) to dodge falling icicles and launch snowballs (Click / J) to knock rivals into the closing Blizzard Ring.
                </li>
                <li>
                  <strong className="text-slate-100">Single-Click PTB Settlement:</strong> At round end, settle score, XP, Frost Gems, and Well Drops in one sponsored Programmable Transaction Block.
                </li>
                <li>
                  <strong className="text-slate-100">Evolve & Customize:</strong> Level up your owned <code className="font-mono text-sky-300">LofiYeti</code> object from Frost Cub to Apex Lofi and equip Walrus-hosted cosmetics.
                </li>
              </ol>
            </div>
          </div>

          <div className="space-y-6 rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
            <div>
              <h3 className="font-display text-xl font-bold text-white">
                Fair Play & Cosmetics Economy
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                Strict <strong className="text-white">zero pay-to-win</strong> rule: Frost Gems earned through skill or seasonal challenges unlock hats, scarves, and dash trails only. Competitive speed, snowball cooldown, and heart count remain equal for every Yeti in ranked rooms.
              </p>
            </div>

            <div className="space-y-3 border-t border-slate-800 pt-5">
              <h4 className="text-sm font-semibold text-white">Player Onboarding & Social Loops</h4>
              <ul className="space-y-2 text-sm text-slate-300">
                <li>
                  <strong className="text-slate-100">1-Click zkLogin + Gas Sponsorship:</strong> Players enter with Google sign-in and play 100% gas-free via a Sui Sponsor Station.
                </li>
                <li>
                  <strong className="text-slate-100">Shareable Well Impact Receipts:</strong> Every run card highlights how many clean water drops the player added toward the next real-world Lofi well.
                </li>
                <li>
                  <strong className="text-slate-100">Kiosk-Compatible Seasonal Gear:</strong> Limited-edition tournament scarves and crowns live as tradeable <code className="font-mono text-sky-300">FrostCosmetic</code> objects.
                </li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* 02. SUI ARCHITECTURE */}
      {activeTab === 'architecture' && (
        <div className="space-y-6">
          <div className="grid gap-6 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-800 bg-[#0D1C30] p-5 space-y-2">
              <h3 className="font-display text-lg font-bold text-white">
                01. Owned Object Fast Path
              </h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Each player holds <code className="font-mono text-sky-300">LofiYeti</code> and <code className="font-mono text-sky-300">PlayerNonce</code> as strictly owned objects. Equipping cosmetics, viewing Display metadata, and evolving stages bypass shared-object consensus via Sui Mysticeti fast path.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0D1C30] p-5 space-y-2">
              <h3 className="font-display text-lg font-bold text-white">
                02. Sui Tunnels Real-Time Layer
              </h3>
              <p className="text-xs leading-relaxed text-slate-300">
                Real-time 60fps 3D movement and snowball collisions run inside low-latency state channels over WebSockets. Only the signed final state digest settles on-chain through <code className="font-mono text-sky-300">settle_match_ptb</code>.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0D1C30] p-5 space-y-2">
              <h3 className="font-display text-lg font-bold text-white">
                03. Walrus + Dynamic Fields
              </h3>
              <p className="text-xs leading-relaxed text-slate-300">
                High-res sprite sheets, seasonal arena tilesets, and cosmetic textures reside on Walrus decentralized blob storage, referenced by <code className="font-mono text-sky-300">walrus_blob_id</code> inside Dynamic Fields attached to each Yeti.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#0D1C30] p-6 space-y-4">
            <h3 className="font-display text-xl font-bold text-white">
              Composable Programmable Transaction Block (PTB) Flow
            </h3>
            <p className="text-sm text-slate-300">
              Instead of forcing players to approve three separate wallet popups after a match, a single atomic PTB executes all post-run state transitions together:
            </p>
            <pre className="overflow-x-auto rounded-xl border border-slate-800 bg-[#050E1C] p-4 font-mono text-xs text-sky-200 leading-relaxed">
{`const tx = new Transaction();
// 1. Verify Tunnel authority Ed25519 signature + increment PlayerNonce
// 2. Mutate player's owned LofiYeti (XP, Frost Gems, High Score)
// 3. Contribute Glacial Drops into shared WellImpactPool (mints WellGuardianBadge on milestone)
tx.moveCall({
  target: \`\${PACKAGE_ID}::arena_session::settle_match_ptb\`,
  arguments: [
    tx.object(ARENA_REGISTRY_ID),
    tx.object(WELL_IMPACT_POOL_ID),
    tx.object(playerYetiId),
    tx.object(playerNonceId),
    tx.pure.u64(score),
    tx.pure.u64(wellDrops),
    tx.pure.u64(frostGems),
    tx.pure.u8(mode),
    tx.pure.u64(nonce),
    tx.pure.vector('u8', tunnelSigBytes),
    tx.pure.vector('u8', payloadBytes),
    tx.pure.string(yetiName),
    tx.object('0x6'), // Sui Clock
  ],
});`}
            </pre>
          </div>
        </div>
      )}

      {/* 03. PRODUCTION MOVE CONTRACTS */}
      {activeTab === 'move' && (
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          <div className="space-y-2">
            {MOVE_CONTRACTS.map((file, idx) => (
              <button
                key={file.filename}
                type="button"
                onClick={() => setSelectedFile(idx)}
                className={`w-full rounded-xl border p-3.5 text-left transition-colors ${
                  selectedFile === idx
                    ? 'border-sky-400 bg-sky-500/15 text-white'
                    : 'border-slate-800 bg-[#0D1C30] text-slate-300 hover:border-slate-700'
                }`}
              >
                <div className="font-mono text-xs font-semibold text-sky-300">
                  {file.filename}
                </div>
                <div className="mt-1 text-xs text-slate-400 line-clamp-2">
                  {file.subtitle}
                </div>
              </button>
            ))}
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#050E1C] overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b border-slate-800 bg-[#0D1C30] px-4 py-3">
              <div>
                <span className="font-mono text-xs font-semibold text-white">
                  {currentMove.filename}
                </span>
                <span className="ml-3 text-xs text-slate-400 hidden sm:inline">
                  {currentMove.subtitle}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0"
              >
                {copiedCode ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    Copy Module
                  </>
                )}
              </button>
            </div>
            <pre className="max-h-[540px] overflow-auto p-4 font-mono text-xs leading-relaxed text-slate-200">
              {currentMove.code}
            </pre>
          </div>
        </div>
      )}

      {/* 04. SEASONS & SECURITY */}
      {activeTab === 'seasons' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
            <h3 className="font-display text-xl font-bold text-white">
              Upcoming Seasons & Arenas
            </h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li>
                <strong className="text-sky-300">Season 1 — Frozen Lake:</strong> Classic 4-Yeti survival skirmishes centered around the rune water well with shrinking blizzard perimeter.
              </li>
              <li>
                <strong className="text-sky-300">Season 2 — Aurora Cavern:</strong> Slippery crystal bridge lanes, shifting ice pillars, and seasonal Walrus-hosted Frost Crown drops.
              </li>
              <li>
                <strong className="text-sky-300">Community Tournaments:</strong> Weekend bracket lobbies powered by Sui Tunnels with commemorative <code className="font-mono">WellGuardianBadge</code> keepsakes.
              </li>
              <li>
                <strong className="text-sky-300">Kiosk Cosmetic Trading:</strong> Trade unlocked seasonal scarves, hats, and dash trails seamlessly on Sui Kiosk marketplaces.
              </li>
            </ul>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-800 bg-[#0D1C30] p-6">
            <h3 className="font-display text-xl font-bold text-white">
              Scalability & Security Guarantees
            </h3>
            <ul className="space-y-3 text-sm text-slate-300">
              <li>
                <strong className="text-white">Zero Shared-Object Contention:</strong> Yetis and PlayerNonces remain strictly owned, touching <code className="font-mono text-sky-300">WellImpactPool</code> only once per settled round.
              </li>
              <li>
                <strong className="text-white">Zero-Gas Onboarding:</strong> Enoki zkLogin + Gas Station sponsorship allow any player to mint and compete without acquiring SUI first.
              </li>
              <li>
                <strong className="text-white">Replay & Spoof Protection:</strong> Authoritative Tunnel server Ed25519 signatures paired with monotonic <code className="font-mono text-sky-300">PlayerNonce</code> checks in <code className="font-mono text-sky-300">arena_session.move</code>.
              </li>
              <li>
                <strong className="text-white">Upgradable Dynamic Fields:</strong> New cosmetic slots and seasonal traits attach cleanly via <code className="font-mono text-sky-300">sui::dynamic_field</code> with package version guards.
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
