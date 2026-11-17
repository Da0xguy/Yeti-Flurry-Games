module yeti_flurry_rush::player_profile {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::object::{Self, UID};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const E_NOT_OWNER: u64 = 1;

    public struct PlayerProfile has key {
        id: UID,
        wallet_address: address,
        display_name: String,
        yeti_name: String,
        colorway: String,
        walrus_blob_id: String,
        walrus_url: String,
        created_at_ms: u64,
        updated_at_ms: u64,
    }

    public struct PlayerProfileCreated has copy, drop {
        profile_id: address,
        wallet_address: address,
    }

    public struct PlayerProfileUpdated has copy, drop {
        profile_id: address,
        wallet_address: address,
    }

    public entry fun create_profile(
        display_name: String,
        yeti_name: String,
        colorway: String,
        walrus_blob_id: String,
        walrus_url: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let wallet_address = tx_context::sender(ctx);
        let profile = PlayerProfile {
            id: object::new(ctx),
            wallet_address,
            display_name,
            yeti_name,
            colorway,
            walrus_blob_id: walrus_blob_id,
            walrus_url,
            created_at_ms: clock::timestamp_ms(clock),
            updated_at_ms: clock::timestamp_ms(clock),
        };
        let profile_id = object::uid_to_inner(&profile.id);
        event::emit(PlayerProfileCreated {
            profile_id,
            wallet_address,
        });
        transfer::public_transfer(profile, wallet_address);
    }

    public entry fun update_profile(
        profile: &mut PlayerProfile,
        display_name: String,
        yeti_name: String,
        colorway: String,
        walrus_blob_id: String,
        walrus_url: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(profile.wallet_address == tx_context::sender(ctx), E_NOT_OWNER);
        profile.display_name = display_name;
        profile.yeti_name = yeti_name;
        profile.colorway = colorway;
        profile.walrus_blob_id = walrus_blob_id;
        profile.walrus_url = walrus_url;
        profile.updated_at_ms = clock::timestamp_ms(clock);
        event::emit(PlayerProfileUpdated {
            profile_id: object::uid_to_inner(&profile.id),
            wallet_address: profile.wallet_address,
        });
    }
}
