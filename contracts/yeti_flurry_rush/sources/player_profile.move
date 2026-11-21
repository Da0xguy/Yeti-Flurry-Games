module yeti_flurry_rush::player_profile {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const E_NOT_OWNER: u64 = 1;

    /// Owned on-chain player save object storing character choice, custom colors,
    /// equipped clothes/cosmetics, lifetime progression stats, and the immutable
    /// Walrus decentralized blob pointer for full run history.
    public struct PlayerProfile has key, store {
        id: UID,
        wallet_address: address,
        display_name: String,
        character_id: String,
        yeti_name: String,
        colorway: String,
        custom_colors_json: String,
        equipped_hat: String,
        equipped_scarf: String,
        equipped_outfit: String,
        equipped_trail: String,
        level: u64,
        xp: u64,
        frost_gems: u64,
        well_drops_contributed: u64,
        high_score: u64,
        runs_completed: u64,
        walrus_blob_id: String,
        walrus_url: String,
        created_at_ms: u64,
        updated_at_ms: u64,
    }

    public struct PlayerProfileCreated has copy, drop {
        profile_id: address,
        wallet_address: address,
        character_id: String,
    }

    public struct PlayerProfileUpdated has copy, drop {
        profile_id: address,
        wallet_address: address,
        character_id: String,
        high_score: u64,
        runs_completed: u64,
        walrus_blob_id: String,
    }

    public entry fun create_profile(
        display_name: String,
        character_id: String,
        yeti_name: String,
        colorway: String,
        custom_colors_json: String,
        equipped_hat: String,
        equipped_scarf: String,
        equipped_outfit: String,
        equipped_trail: String,
        walrus_blob_id: String,
        walrus_url: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let wallet_address = tx_context::sender(ctx);
        let now_ms = clock::timestamp_ms(clock);
        let profile = PlayerProfile {
            id: object::new(ctx),
            wallet_address,
            display_name,
            character_id,
            yeti_name,
            colorway,
            custom_colors_json,
            equipped_hat,
            equipped_scarf,
            equipped_outfit,
            equipped_trail,
            level: 1,
            xp: 0,
            frost_gems: 75,
            well_drops_contributed: 0,
            high_score: 0,
            runs_completed: 0,
            walrus_blob_id,
            walrus_url,
            created_at_ms: now_ms,
            updated_at_ms: now_ms,
        };
        let profile_id = object::uid_to_inner(&profile.id);
        event::emit(PlayerProfileCreated {
            profile_id,
            wallet_address,
            character_id: profile.character_id,
        });
        transfer::public_transfer(profile, wallet_address);
    }

    public entry fun sync_game_data(
        profile: &mut PlayerProfile,
        display_name: String,
        character_id: String,
        yeti_name: String,
        colorway: String,
        custom_colors_json: String,
        equipped_hat: String,
        equipped_scarf: String,
        equipped_outfit: String,
        equipped_trail: String,
        level: u64,
        xp: u64,
        frost_gems: u64,
        well_drops_contributed: u64,
        high_score: u64,
        runs_completed: u64,
        walrus_blob_id: String,
        walrus_url: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(profile.wallet_address == tx_context::sender(ctx), E_NOT_OWNER);
        profile.display_name = display_name;
        profile.character_id = character_id;
        profile.yeti_name = yeti_name;
        profile.colorway = colorway;
        profile.custom_colors_json = custom_colors_json;
        profile.equipped_hat = equipped_hat;
        profile.equipped_scarf = equipped_scarf;
        profile.equipped_outfit = equipped_outfit;
        profile.equipped_trail = equipped_trail;
        profile.level = level;
        profile.xp = xp;
        profile.frost_gems = frost_gems;
        profile.well_drops_contributed = well_drops_contributed;
        if (high_score > profile.high_score) {
            profile.high_score = high_score;
        };
        profile.runs_completed = runs_completed;
        profile.walrus_blob_id = walrus_blob_id;
        profile.walrus_url = walrus_url;
        profile.updated_at_ms = clock::timestamp_ms(clock);

        event::emit(PlayerProfileUpdated {
            profile_id: object::uid_to_inner(&profile.id),
            wallet_address: profile.wallet_address,
            character_id: profile.character_id,
            high_score: profile.high_score,
            runs_completed: profile.runs_completed,
            walrus_blob_id: profile.walrus_blob_id,
        });
    }
}
