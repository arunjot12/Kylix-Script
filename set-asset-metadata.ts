import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';

const RPC = 'ws://127.0.0.1:9944';
const ADMIN_SEED = '//Alice'; // or use your actual seed

// Define assets and their metadata
const assets = [
  { id: 101, name: 'Solana', symbol: 'SOL', decimals: 9 },
  { id: 104, name: 'Sui', symbol: 'SUI', decimals: 9 },
  { id: 103, name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
  { id: 102, name: 'Ethereum', symbol: 'ETH', decimals: 18 }
];

async function main() {
  console.log('Connecting to node:', RPC);
  const provider = new WsProvider(RPC);
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri(ADMIN_SEED);
  console.log(`Connected to chain: ${(await api.rpc.system.chain()).toString()}`);
  console.log(`Using admin: ${admin.address}`);

  for (const asset of assets) {
    console.log(`\n🔹 Setting metadata for ${asset.name} (id=${asset.id})`);

    const tx = api.tx.assets.setMetadata(
      asset.id,
      asset.name,
      asset.symbol,
      asset.decimals
    );

    await new Promise<void>((resolve, reject) => {
      tx.signAndSend(admin, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.error(`❌ ${decoded.section}.${decoded.name}`);
          } else {
            console.error(`❌ ${dispatchError.toString()}`);
          }
          reject(dispatchError);
        } else if (status.isInBlock) {
          console.log(`✅ Metadata set for ${asset.name} in block ${status.asInBlock}`);
          resolve();
        }
      });
    });

    const meta = (await api.query.assets.metadata(asset.id)).toJSON();
    console.log(`Metadata confirmed:`, meta);
  }

  await api.disconnect();
  console.log('\nAll metadata updated successfully ✅');
}

main().catch(console.error);
