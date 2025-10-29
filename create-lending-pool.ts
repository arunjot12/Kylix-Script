import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { BN } from '@polkadot/util';

const WS_ENDPOINT = 'ws://127.0.0.1:9944';
const ADMIN = '5GrwvaEF5zXb26Fz9rcQpDWS57CtERHpNehXCPcNoHGKutQY';
const TARGET = '5EYCAe5hjcu8UT2sh5HhPXrLgSbTtxpeQZCKAjvgSJPmc7LA';

interface AssetInfo {
  name: string;
  assetId: number;
  decimals: number;
  poolId: number;
}

const assets: AssetInfo[] = [
  { name: 'USD', assetId: 1, decimals: 1, poolId: 1001 },
  { name: 'Tether', assetId: 2, decimals: 1, poolId: 1002 },
  { name: 'USD Coin', assetId: 3, decimals: 1, poolId: 1003 },
  { name: 'Solana', assetId: 101, decimals: 9, poolId: 1101 },
  { name: 'Ethereum', assetId: 102, decimals: 18, poolId: 1102 },
  { name: 'Bitcoin', assetId: 103, decimals: 8, poolId: 1103 },
  { name: 'Sui', assetId: 104, decimals: 9, poolId: 1104 },
];

async function main() {
  console.log(`⛓️  Connecting to node: ${WS_ENDPOINT}`);
  const provider = new WsProvider(WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const alice = keyring.addFromUri('//Alice');

  console.log(`✅ Connected to chain: ${await api.rpc.system.chain()}`);
  console.log(`👤 Using admin: ${alice.address}`);

  // 1️⃣ Transfer some native balance to target account
  const transferAmount = new BN('1000000000000000'); // adjust if needed (1 UNIT)
  console.log(`💸 Transferring native balance to ${TARGET} ...`);
  const txBalance = api.tx.balances.transferKeepAlive(TARGET, transferAmount);

  await new Promise<void>((resolve, reject) => {
    txBalance.signAndSend(alice, ({ status, dispatchError }) => {
      if (status.isInBlock) console.log(`✅ Native transfer in block ${status.asInBlock}`);
      if (dispatchError) {
        if (dispatchError.isModule) {
          const decoded = api.registry.findMetaError(dispatchError.asModule);
          console.error(`❌ Native transfer failed: ${decoded.section}.${decoded.name}`);
        } else console.error(`❌ Native transfer failed: ${dispatchError.toString()}`);
        reject(dispatchError);
      }
      if (status.isFinalized) resolve();
    });
  });

  // 2️⃣ Create lending pools for all assets
  for (const { name, assetId, decimals, poolId } of assets) {
    try {
      console.log(`\n🏦 Creating lending pool for ${name} (asset ${assetId}) ...`);
      const amount = new BN(10_000).mul(new BN(10).pow(new BN(decimals)));

      const txPool = api.tx.lending.createLendingPool(poolId, { WithId: assetId }, amount);
      await new Promise<void>((resolve, reject) => {
        txPool.signAndSend(alice, ({ status, dispatchError }) => {
          if (status.isInBlock) console.log(`✅ Pool ${poolId} in block ${status.asInBlock}`);
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error(`❌ Pool failed: ${decoded.section}.${decoded.name}`);
            } else console.error(`❌ Pool failed: ${dispatchError.toString()}`);
            reject(dispatchError);
          }
          if (status.isFinalized) resolve();
        });
      });
    } catch (err) {
      console.error(`❌ Error for ${name}:`, err);
      break; // stop if any failure
    }
  }

  console.log('\n🎉 All lending pools created successfully.');
  await api.disconnect();
}

main().catch(console.error);
