import { ApiPromise, WsProvider } from '@polkadot/api';
import { Keyring } from '@polkadot/keyring';
import BN from 'bn.js';

const RPC = 'ws://127.0.0.1:9944';
const ADMIN_SEED = '//Alice'; // your admin
const RECEIVER = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY'; // Alice or recipient

// Define existing assets
const assets = [
  { id: 1, name: 'USD', symbol: 'USD', decimals: 1 },
  { id: 101, name: 'Solana', symbol: 'SOL', decimals: 9 },
  { id: 102, name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  { id: 103, name: 'Bitcoin', symbol: 'BTC', decimals: 8 },
  { id: 104, name: 'Sui', symbol: 'SUI', decimals: 9 },
];

// Utility: convert to on-chain integer based on decimals
function toChainUnits(amount: number, decimals: number): BN {
  return new BN(amount).mul(new BN(10).pow(new BN(decimals)));
}

async function main() {
  console.log(`🔗 Connecting to node: ${RPC}`);
  const provider = new WsProvider(RPC);
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri(ADMIN_SEED);

  console.log(`Connected to chain: ${(await api.rpc.system.chain()).toString()}`);
  console.log(`Admin: ${admin.address}`);
  console.log(`Receiver: ${RECEIVER}`);

  for (const asset of assets) {
    console.log(`\n💰 Processing ${asset.symbol} (id=${asset.id})`);

    const assetDetails = await api.query.assets.asset(asset.id);
    if (assetDetails.isNone) {
      console.warn(`⚠️ Asset ${asset.id} (${asset.symbol}) does not exist! Skipping.`);
      continue;
    }

    // Mint 1,000,000 tokens to admin
    const mintAmount = toChainUnits(1_000_000, asset.decimals);
    const mintTx = api.tx.assets.mint(asset.id, admin.address, mintAmount);

    await new Promise<void>((resolve, reject) => {
      mintTx.signAndSend(admin, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.error(`❌ Mint failed: ${decoded.section}.${decoded.name}`);
          } else {
            console.error(`❌ Mint failed: ${dispatchError.toString()}`);
          }
          reject(dispatchError);
        } else if (status.isInBlock) {
          console.log(`✅ Minted ${mintAmount.toString()} ${asset.symbol} to admin`);
          resolve();
        }
      });
    });

    // Transfer 10,000 tokens to Alice
    const transferAmount = toChainUnits(10_000, asset.decimals);
    const transferTx = api.tx.assets.transfer(asset.id, RECEIVER, transferAmount);

    await new Promise<void>((resolve, reject) => {
      transferTx.signAndSend(admin, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.error(`❌ Transfer failed: ${decoded.section}.${decoded.name}`);
          } else {
            console.error(`❌ Transfer failed: ${dispatchError.toString()}`);
          }
          reject(dispatchError);
        } else if (status.isInBlock) {
          console.log(`✅ Transferred ${transferAmount.toString()} ${asset.symbol} to Alice`);
          resolve();
        }
      });
    });

    // Query balance after transfer
    const balance = (await api.query.assets.account(asset.id, RECEIVER)).toJSON();
    console.log(`📊 Alice’s ${asset.symbol} balance:`, balance);
  }

  console.log('\n✨ All assets minted and transferred successfully!');
  await api.disconnect();
}

main().catch(console.error);
