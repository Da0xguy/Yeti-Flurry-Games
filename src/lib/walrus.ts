const WALRUS_PUBLISHER =
  'https://publisher.walrus-testnet.walrus.space/v1/blobs';
const WALRUS_AGGREGATOR =
  'https://aggregator.walrus-testnet.walrus.space/v1/blobs';

export interface PlayerProfileBlob {
  walletAddress: string;
  displayName: string;
  yetiName: string;
  colorway: string;
  createdAt: string;
  schemaVersion: 1;
}

export interface WalrusBlobReceipt {
  blobId: string;
  aggregatorUrl: string;
}

export async function uploadPlayerProfile(
  profile: PlayerProfileBlob
): Promise<WalrusBlobReceipt> {
  const response = await fetch(`${WALRUS_PUBLISHER}?epochs=5`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  });

  if (!response.ok) {
    throw new Error(`Walrus profile upload failed (${response.status})`);
  }

  const payload = (await response.json()) as {
    newlyCreated?: { blobObject?: { blobId?: string } };
    alreadyCertified?: { blobId?: string };
  };
  const blobId =
    payload.newlyCreated?.blobObject?.blobId || payload.alreadyCertified?.blobId;

  if (!blobId) {
    throw new Error('Walrus returned no blob ID for the player profile');
  }

  return {
    blobId,
    aggregatorUrl: `${WALRUS_AGGREGATOR}/${encodeURIComponent(blobId)}`,
  };
}
