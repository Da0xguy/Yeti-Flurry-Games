import { CosmeticItem } from '../types';

export const COSMETICS_CATALOG: CosmeticItem[] = [
  {
    id: 'hat_goggles',
    name: 'Frost Goggles',
    slot: 'hat',
    costGems: 0,
    description: 'Standard-issue glacial goggles issued to every starter Lofi hero.',
    colorHex: '#38BDF8',
    walrusBlobId: 'walrus://blob_goggles_v1_8f3a',
  },
  {
    id: 'hat_beanie',
    name: 'Arctic Knit Beanie',
    slot: 'hat',
    costGems: 40,
    description: 'Warm cerulean wool beanie crafted for deep blizzard sprints.',
    colorHex: '#0284C7',
    walrusBlobId: 'walrus://blob_beanie_v1_4c91',
  },
  {
    id: 'hat_ushanka',
    name: 'Frost Pilot Ushanka',
    slot: 'hat',
    costGems: 75,
    description: 'Fur-lined earflap aviator cap built for high-altitude peak runs.',
    colorHex: '#B45309',
    walrusBlobId: 'walrus://blob_ushanka_v1_6a2c',
  },
  {
    id: 'hat_visor',
    name: 'Neon Cyber Visor',
    slot: 'hat',
    costGems: 95,
    description: 'Holographic wrap-around optics favored by Orbital Rift pilots.',
    colorHex: '#22D3EE',
    walrusBlobId: 'walrus://blob_visor_v1_3e1f',
  },
  {
    id: 'hat_crown',
    name: 'Glacier Shard Crown',
    slot: 'hat',
    costGems: 120,
    description: 'Crystalline circlet earned by dedicated Arctic Well Guardians.',
    colorHex: '#67E8F9',
    walrusBlobId: 'walrus://blob_crown_v2_91e2',
  },
  {
    id: 'scarf_lofi',
    name: 'Lofi Blue Scarf',
    slot: 'scarf',
    costGems: 0,
    description: 'Signature braided sky-blue scarf woven in the high peaks.',
    colorHex: '#0EA5E9',
    walrusBlobId: 'walrus://blob_scarf_lofi_7a2b',
  },
  {
    id: 'scarf_aurora',
    name: 'Aurora Ribbon',
    slot: 'scarf',
    costGems: 65,
    description: 'Iridescent polar weave that shimmers during Frost Dash.',
    colorHex: '#2DD4BF',
    walrusBlobId: 'walrus://blob_scarf_aurora_5d8e',
  },
  {
    id: 'scarf_crimson',
    name: 'Summit Flare Wrap',
    slot: 'scarf',
    costGems: 95,
    description: 'High-visibility rescue wrap worn by glacier pathfinders.',
    colorHex: '#F97316',
    walrusBlobId: 'walrus://blob_scarf_flare_2b4c',
  },
  {
    id: 'scarf_obsidian',
    name: 'Obsidian Gold Mantle',
    slot: 'scarf',
    costGems: 130,
    description: 'Woven midnight neck-mantle edged with brushed bronze stitching.',
    colorHex: '#FBBF24',
    walrusBlobId: 'walrus://blob_scarf_obsidian_9b2a',
  },
  {
    id: 'outfit_none',
    name: 'Natural Coat',
    slot: 'outfit',
    costGems: 0,
    description: 'Classic unadorned fur or chassis silhouette showing full custom colorways.',
    colorHex: '#94A3B8',
    walrusBlobId: 'walrus://blob_outfit_none_0001',
  },
  {
    id: 'outfit_hoodie',
    name: 'Lofi Street Hoodie',
    slot: 'outfit',
    costGems: 0,
    description: 'Cozy fleece pullover hoodie with kangaroo pocket, drawstrings, and cuffed sleeves.',
    colorHex: '#0284C7',
    walrusBlobId: 'walrus://blob_outfit_hoodie_1a4f',
  },
  {
    id: 'outfit_parka',
    name: 'Alpine Expedition Parka',
    slot: 'outfit',
    costGems: 45,
    description: 'Insulated blizzard parka with fur-trimmed collar, cargo belt, and brass clasps.',
    colorHex: '#D97706',
    walrusBlobId: 'walrus://blob_outfit_parka_3c82',
  },
  {
    id: 'outfit_jersey',
    name: 'Grand Prix Racing Suit',
    slot: 'outfit',
    costGems: 75,
    description: 'Aerodynamic racing jacket with twin speed stripes and champion chest crest.',
    colorHex: '#E11D48',
    walrusBlobId: 'walrus://blob_outfit_jersey_5d11',
  },
  {
    id: 'outfit_cyber',
    name: 'Cryo-Mech Exo-Armor',
    slot: 'outfit',
    costGems: 110,
    description: 'Beveled titanium chestplate with glowing cyan reactor core and shoulder pauldrons.',
    colorHex: '#6366F1',
    walrusBlobId: 'walrus://blob_outfit_cyber_8e94',
  },
  {
    id: 'outfit_astronaut',
    name: 'Orbital EVA Flight Suit',
    slot: 'outfit',
    costGems: 140,
    description: 'Deep-space pressurized vest with telemetry chest rig and micro-thruster pack.',
    colorHex: '#0F172A',
    walrusBlobId: 'walrus://blob_outfit_eva_9f20',
  },
  {
    id: 'trail_powder',
    name: 'Powder Flurry',
    slot: 'trail',
    costGems: 0,
    description: 'Clean crisp snow puffs kicked up on every stride.',
    colorHex: '#E0F2FE',
    walrusBlobId: 'walrus://blob_trail_powder_1f09',
  },
  {
    id: 'trail_crystals',
    name: 'Ice Shard Wake',
    slot: 'trail',
    costGems: 80,
    description: 'Faceted cyan ice crystals lingering behind each Frost Dash.',
    colorHex: '#38BDF8',
    walrusBlobId: 'walrus://blob_trail_shards_6e4a',
  },
  {
    id: 'trail_wellspring',
    name: 'Wellspring Mist',
    slot: 'trail',
    costGems: 150,
    description: 'Luminous glacial droplets honoring Lofi clean water wells.',
    colorHex: '#5EEAD4',
    walrusBlobId: 'walrus://blob_trail_well_3c7d',
  },
];

export interface MoveFileSpec {
  filename: string;
  subtitle: string;
  code: string;
}

export const MOVE_CONTRACTS: MoveFileSpec[] = [
  {
    filename: 'Move.toml',
    subtitle: 'Package manifest targeting Sui 2024.beta edition',
    code: `[package]
name = "yeti_flurry_rush"
edition = "2024.beta"
version = "0.1.0"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
yeti_flurry_rush = "0x0"
lofi_treasury = "0xLOFI_TREASURY_PLACEHOLDER"`,
  },
  {
    filename: 'sources/yeti_core.move',
    subtitle: 'Owned LofiYeti objects (fast-path execution), dynamic cosmetic fields, Display & evolution',
    code: `module yeti_flurry_rush::yeti_core {
    use std::string::{Self, String};
    use sui::clock::{Self, Clock};
    use sui::display;
    use sui::dynamic_field as df;
    use sui::event;
    use sui::package;

    const E_INSUFFICIENT_XP: u64 = 1;
    const E_MAX_STAGE_REACHED: u64 = 2;
    const E_COSMETIC_NOT_OWNED: u64 = 3;
    const E_WRONG_VERSION: u64 = 4;

    const PACKAGE_VERSION: u64 = 1;

    /// One-Time-Witness for Sui Display & Publisher setup
    public struct YETI_CORE has drop {}

    /// Admin capability for contract version upgrades & seasonal tuning
    public struct AdminCap has key, store {
        id: UID,
    }

    /// Key for dynamic field storing equipped cosmetic slot -> blob_id
    public struct EquippedSlotKey has copy, drop, store {
        slot: String,
    }

    /// Owned Player Yeti Object — operates exclusively on Sui's owned-object fast path
    /// eliminating shared-object consensus contention during personal upgrades.
    public struct LofiYeti has key, store {
        id: UID,
        name: String,
        stage: u8, // 0: Frost Cub, 1: Glacier Runner, 2: Blizzard Guardian, 3: Apex Lofi
        level: u64,
        xp: u64,
        frost_gems: u64,
        well_drops_contributed: u64,
        high_score: u64,
        runs_completed: u64,
        minted_at_ms: u64,
        version: u64,
    }

    // === Events ===
    public struct YetiMinted has copy, drop {
        yeti_id: ID,
        owner: address,
        name: String,
        timestamp_ms: u64,
    }

    public struct YetiEvolved has copy, drop {
        yeti_id: ID,
        new_stage: u8,
        new_level: u64,
    }

    public struct CosmeticEquipped has copy, drop {
        yeti_id: ID,
        slot: String,
        cosmetic_id: String,
    }

    fun init(otw: YETI_CORE, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        let mut yeti_display = display::new<LofiYeti>(&publisher, ctx);

        yeti_display.add(string::utf8(b"name"), string::utf8(b"{name} · Stage {stage}"));
        yeti_display.add(
            string::utf8(b"description"),
            string::utf8(b"Evolvable Lofi Yeti object from Yeti Flurry Rush on Sui.")
        );
        yeti_display.add(
            string::utf8(b"image_url"),
            string::utf8(b"https://aggregator.walrus-testnet.walrus.space/v1/yeti_stage_{stage}")
        );
        yeti_display.add(string::utf8(b"project_url"), string::utf8(b"https://lofitheyeti.com"));
        yeti_display.update_version();

        transfer::public_transfer(publisher, ctx.sender());
        transfer::public_transfer(yeti_display, ctx.sender());
        transfer::transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    }

    /// Mint a starter Yeti object directly to the player's address (0 gas via Sponsor Station)
    public fun mint_starter_yeti(
        name: String,
        clock: &Clock,
        ctx: &mut TxContext
    ): LofiYeti {
        let mut yeti = LofiYeti {
            id: object::new(ctx),
            name,
            stage: 0,
            level: 1,
            xp: 0,
            frost_gems: 50,
            well_drops_contributed: 0,
            high_score: 0,
            runs_completed: 0,
            minted_at_ms: clock::timestamp_ms(clock),
            version: PACKAGE_VERSION,
        };

        // Attach starter cosmetics via dynamic fields so future traits require no migration
        df::add(&mut yeti.id, EquippedSlotKey { slot: string::utf8(b"hat") }, string::utf8(b"hat_goggles"));
        df::add(&mut yeti.id, EquippedSlotKey { slot: string::utf8(b"scarf") }, string::utf8(b"scarf_lofi"));
        df::add(&mut yeti.id, EquippedSlotKey { slot: string::utf8(b"trail") }, string::utf8(b"trail_powder"));

        event::emit(YetiMinted {
            yeti_id: object::id(&yeti),
            owner: ctx.sender(),
            name: yeti.name,
            timestamp_ms: yeti.minted_at_ms,
        });

        yeti
    }

    /// Entry wrapper for single-step minting via sponsored zkLogin PTB
    public entry fun mint_and_keep(name: String, clock: &Clock, ctx: &mut TxContext) {
        let yeti = mint_starter_yeti(name, clock, ctx);
        transfer::public_transfer(yeti, ctx.sender());
    }

    /// Called by arena_session within the same Programmable Transaction Block
    public(package) fun apply_run_rewards(
        yeti: &mut LofiYeti,
        score: u64,
        xp_earned: u64,
        gems_earned: u64,
        well_drops: u64,
    ) {
        assert!(yeti.version == PACKAGE_VERSION, E_WRONG_VERSION);
        yeti.xp = yeti.xp + xp_earned;
        yeti.frost_gems = yeti.frost_gems + gems_earned;
        yeti.well_drops_contributed = yeti.well_drops_contributed + well_drops;
        yeti.runs_completed = yeti.runs_completed + 1;
        if (score > yeti.high_score) {
            yeti.high_score = score;
        };
        yeti.level = 1 + (yeti.xp / 250);
    }

    /// Evolve owned Yeti permanently on-chain using earned XP (zero pay-to-win)
    public entry fun evolve_yeti(yeti: &mut LofiYeti) {
        assert!(yeti.version == PACKAGE_VERSION, E_WRONG_VERSION);
        assert!(yeti.stage < 3, E_MAX_STAGE_REACHED);

        let required_xp = ((yeti.stage as u64) + 1) * 300;
        assert!(yeti.xp >= required_xp, E_INSUFFICIENT_XP);

        yeti.stage = yeti.stage + 1;
        event::emit(YetiEvolved {
            yeti_id: object::id(yeti),
            new_stage: yeti.stage,
            new_level: yeti.level,
        });
    }

    /// Equip a cosmetic skin stored on Walrus without changing gameplay power
    public entry fun equip_cosmetic(
        yeti: &mut LofiYeti,
        slot: String,
        cosmetic_id: String,
    ) {
        assert!(yeti.version == PACKAGE_VERSION, E_WRONG_VERSION);
        let key = EquippedSlotKey { slot };
        if (df::exists_(&yeti.id, key)) {
            let current = df::borrow_mut<EquippedSlotKey, String>(&mut yeti.id, key);
            *current = cosmetic_id;
        } else {
            df::add(&mut yeti.id, key, cosmetic_id);
        };

        event::emit(CosmeticEquipped {
            yeti_id: object::id(yeti),
            slot,
            cosmetic_id,
        });
    }

    public(package) fun spend_gems(yeti: &mut LofiYeti, amount: u64) {
        assert!(yeti.frost_gems >= amount, E_COSMETIC_NOT_OWNED);
        yeti.frost_gems = yeti.frost_gems - amount;
    }
}`,
  },
  {
    filename: 'sources/arena_session.move',
    subtitle: 'PTB run settlement, Sui Tunnels checkpoint verification, and top leaderboard',
    code: `module yeti_flurry_rush::arena_session {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::ed25519;
    use sui::event;
    use yeti_flurry_rush::well_impact::{Self, WellImpactPool};
    use yeti_flurry_rush::yeti_core::{Self, LofiYeti};

    const E_INVALID_AUTHORITY_SIG: u64 = 101;
    const E_REPLAY_NONCE: u64 = 102;

    /// Shared Arena Leaderboard & Authority Public Key for Sui Tunnel settlement
    public struct ArenaRegistry has key {
        id: UID,
        tunnel_authority_pk: vector<u8>,
        total_matches_settled: u64,
        highest_score: u64,
        champion_name: String,
    }

    /// Owned anti-replay receipt per player session
    public struct PlayerNonce has key {
        id: UID,
        owner: address,
        last_nonce: u64,
    }

    public struct MatchSettled has copy, drop {
        yeti_id: ID,
        player: address,
        score: u64,
        well_drops: u64,
        gems_earned: u64,
        mode: u8, // 0 = Solo, 1 = Sui Tunnel Room
        settled_at_ms: u64,
    }

    fun init(ctx: &mut TxContext) {
        let registry = ArenaRegistry {
            id: object::new(ctx),
            tunnel_authority_pk: vector::empty<u8>(),
            total_matches_settled: 0,
            highest_score: 0,
            champion_name: std::string::utf8(b"Lofi Pioneer"),
        };
        transfer::share_object(registry);
    }

    /// Composable PTB Settlement:
    /// 1. Verifies Sui Tunnel / Match server Ed25519 signature & monotonic nonce
    /// 2. Updates player's owned LofiYeti fast-path fields
    /// 3. Contributes Glacial Drops into Lofi's shared WellImpactPool
    public entry fun settle_match_ptb(
        registry: &mut ArenaRegistry,
        well_pool: &mut WellImpactPool,
        yeti: &mut LofiYeti,
        nonce_tracker: &mut PlayerNonce,
        score: u64,
        well_drops: u64,
        gems_earned: u64,
        mode: u8,
        nonce: u64,
        signature: vector<u8>,
        payload_bytes: vector<u8>,
        yeti_name: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(nonce > nonce_tracker.last_nonce, E_REPLAY_NONCE);

        if (!vector::is_empty(&registry.tunnel_authority_pk)) {
            let valid = ed25519::ed25519_verify(
                &signature,
                &registry.tunnel_authority_pk,
                &payload_bytes
            );
            assert!(valid, E_INVALID_AUTHORITY_SIG);
        };

        nonce_tracker.last_nonce = nonce;
        let xp_earned = (score / 5) + 25;

        // Mutate owned Yeti state
        yeti_core::apply_run_rewards(yeti, score, xp_earned, gems_earned, well_drops);

        // Contribute Glacial Water Drops to Lofi's Clean Water Well counter
        well_impact::contribute_drops(well_pool, well_drops, ctx);

        registry.total_matches_settled = registry.total_matches_settled + 1;
        if (score > registry.highest_score) {
            registry.highest_score = score;
            registry.champion_name = yeti_name;
        };

        event::emit(MatchSettled {
            yeti_id: object::id(yeti),
            player: ctx.sender(),
            score,
            well_drops,
            gems_earned,
            mode,
            settled_at_ms: clock::timestamp_ms(clock),
        });
    }
}`,
  },
  {
    filename: 'sources/well_impact.move',
    subtitle: 'Shared community Clean Water Well tracker & Guardian Badge minting',
    code: `module yeti_flurry_rush::well_impact {
    use sui::event;

    const DROPS_PER_WELL_MILESTONE: u64 = 1000;

    /// Shared global pool aggregating Glacial Drops gathered in-game
    /// to trigger transparent Lofi clean water well grants.
    public struct WellImpactPool has key {
        id: UID,
        total_drops_collected: u64,
        wells_funded: u64,
        total_contributions: u64,
    }

    /// Commemorative owned keepsake minted when a player crosses a milestone
    public struct WellGuardianBadge has key, store {
        id: UID,
        milestone_well_number: u64,
        guardian: address,
    }

    public struct WellMilestoneReached has copy, drop {
        wells_funded: u64,
        total_drops: u64,
        triggered_by: address,
    }

    fun init(ctx: &mut TxContext) {
        let pool = WellImpactPool {
            id: object::new(ctx),
            total_drops_collected: 0,
            wells_funded: 0,
            total_contributions: 0,
        };
        transfer::share_object(pool);
    }

    public(package) fun contribute_drops(
        pool: &mut WellImpactPool,
        drops: u64,
        ctx: &mut TxContext,
    ) {
        if (drops == 0) return;

        pool.total_drops_collected = pool.total_drops_collected + drops;
        pool.total_contributions = pool.total_contributions + 1;

        let expected_wells = pool.total_drops_collected / DROPS_PER_WELL_MILESTONE;
        if (expected_wells > pool.wells_funded) {
            pool.wells_funded = expected_wells;

            event::emit(WellMilestoneReached {
                wells_funded: pool.wells_funded,
                total_drops: pool.total_drops_collected,
                triggered_by: ctx.sender(),
            });

            let badge = WellGuardianBadge {
                id: object::new(ctx),
                milestone_well_number: pool.wells_funded,
                guardian: ctx.sender(),
            };
            transfer::public_transfer(badge, ctx.sender());
        };
    }
}`,
  },
  {
    filename: 'sources/cosmetics.move',
    subtitle: 'Non-P2W Kiosk-ready cosmetics & Walrus blob asset references',
    code: `module yeti_flurry_rush::cosmetics {
    use std::string::String;
    use sui::event;
    use yeti_flurry_rush::yeti_core::{Self, LofiYeti};

    /// Tradeable cosmetic voucher backed by Walrus decentralized media blobs
    public struct FrostCosmetic has key, store {
        id: UID,
        cosmetic_id: String,
        slot: String,
        walrus_blob_id: String,
    }

    public struct CosmeticUnlocked has copy, drop {
        player: address,
        cosmetic_id: String,
        gems_spent: u64,
    }

    /// Unlock & equip purely aesthetic gear using earned Frost Gems (never pay-to-win)
    public entry fun unlock_and_equip(
        yeti: &mut LofiYeti,
        cosmetic_id: String,
        slot: String,
        walrus_blob_id: String,
        gem_cost: u64,
        ctx: &mut TxContext,
    ) {
        yeti_core::spend_gems(yeti, gem_cost);
        yeti_core::equip_cosmetic(yeti, slot, cosmetic_id);

        let voucher = FrostCosmetic {
            id: object::new(ctx),
            cosmetic_id,
            slot,
            walrus_blob_id,
        };
        transfer::public_transfer(voucher, ctx.sender());

        event::emit(CosmeticUnlocked {
            player: ctx.sender(),
            cosmetic_id,
            gems_spent: gem_cost,
        });
    }
}`,
  },
];
