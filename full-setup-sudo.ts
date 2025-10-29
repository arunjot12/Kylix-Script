import { ApiPromise, WsProvider, Keyring } from '@polkadot/api';
import { BN } from '@polkadot/util';

const WS_ENDPOINT = 'ws://127.0.0.1:9944';
const ADMIN_SEED = '//Alice';
const TARGET = '5EYCAe5hjcu8UT2sh5HhPXrLgSbTtxpeQZCKAjvgSJPmc7LA';

interface AssetConfig {
  id: number;
  name: string;
  symbol: string;
  decimals: number;
  poolId: number;
}

const assets: AssetConfig[] = [
  { id: 1, name: 'USD', symbol: 'USD', decimals: 1, poolId: 1001 },
  { id: 2, name: 'Tether', symbol: 'USDT', decimals: 1, poolId: 1002 },
  { id: 3, name: 'USD Coin', symbol: 'USDC', decimals: 1, poolId: 1003 },
  { id: 101, name: 'Solana', symbol: 'SOL', decimals: 9, poolId: 1101 },
  { id: 102, name: 'Ethereum', symbol: 'ETH', decimals: 18, poolId: 1102 },
  { id: 103, name: 'Bitcoin', symbol: 'BTC', decimals: 8, poolId: 1103 },
  { id: 104, name: 'Sui', symbol: 'SUI', decimals: 9, poolId: 1104 },
];

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms));

function toChainUnits(amount: number, decimals: number): BN {
  return new BN(amount).mul(new BN(10).pow(new BN(decimals)));
}

async function main() {
  console.log(`⛓️  Connecting to node: ${WS_ENDPOINT}`);
  const provider = new WsProvider(WS_ENDPOINT);
  const api = await ApiPromise.create({ provider });

  const keyring = new Keyring({ type: 'sr25519' });
  const admin = keyring.addFromUri(ADMIN_SEED);
  
  console.log(`✅ Connected to chain: ${await api.rpc.system.chain()}`);
  console.log(`👤 Using admin: ${admin.address}`);
  console.log(`🎯 Target account: ${TARGET}\n`);

  // Track nonce manually for admin
  let nonce = await api.rpc.system.accountNextIndex(admin.address);

  // Step 1: Transfer native balance to target account
  console.log(`💸 Transferring native balance to ${TARGET}...`);
  const transferAmount = new BN('1000000000000000');
  
  await new Promise<void>((resolve, reject) => {
    api.tx.balances
      .transferKeepAlive(TARGET, transferAmount)
      .signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
        if (dispatchError) {
          if (dispatchError.isModule) {
            const decoded = api.registry.findMetaError(dispatchError.asModule);
            console.error(`❌ Transfer failed: ${decoded.section}.${decoded.name}`);
          } else {
            console.error(`❌ Transfer failed: ${dispatchError.toString()}`);
          }
          reject(dispatchError);
        } else if (status.isInBlock) {
          console.log(`✅ Native transfer in block ${status.asInBlock}`);
          resolve();
        }
      });
  });

  await sleep(2000);

  // Step 2: Process each asset
  for (const asset of assets) {
    try {
      console.log(`\n${'='.repeat(60)}`);
      console.log(`⚙️  Setting up: ${asset.name} (${asset.symbol}) - ID ${asset.id}`);
      console.log(`${'='.repeat(60)}`);

      // Check if asset exists
      const assetDetails = await api.query.assets.asset(asset.id);
      
      if (assetDetails.isNone) {
        console.log(`🪙 Creating asset ${asset.id}...`);
        
        // Create asset
        const createTx = api.tx.assets.create(asset.id, admin.address, 1);
        await new Promise<void>((resolve, reject) => {
          createTx.signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                console.error(`❌ Create failed: ${decoded.section}.${decoded.name}`);
              } else {
                console.error(`❌ Create failed: ${dispatchError.toString()}`);
              }
              reject(dispatchError);
            } else if (status.isInBlock) {
              console.log(`✅ Asset created in block ${status.asInBlock}`);
              resolve();
            }
          });
        });

        await sleep(2000);

        // Set metadata
        console.log(`📝 Setting metadata for ${asset.symbol}...`);
        const metaTx = api.tx.assets.setMetadata(
          asset.id,
          asset.name,
          asset.symbol,
          asset.decimals
        );

        await new Promise<void>((resolve, reject) => {
          metaTx.signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
            if (dispatchError) {
              if (dispatchError.isModule) {
                const decoded = api.registry.findMetaError(dispatchError.asModule);
                console.error(`❌ Metadata failed: ${decoded.section}.${decoded.name}`);
              } else {
                console.error(`❌ Metadata failed: ${dispatchError.toString()}`);
              }
              reject(dispatchError);
            } else if (status.isInBlock) {
              console.log(`✅ Metadata set in block ${status.asInBlock}`);
              resolve();
            }
          });
        });

        await sleep(2000);
      } else {
        console.log(`ℹ️  Asset ${asset.id} already exists, skipping creation`);
      }

      // Mint tokens to admin (1,000,000 tokens)
      console.log(`💰 Minting 1,000,000 ${asset.symbol} to admin...`);
      const mintAmount = toChainUnits(1_000_000, asset.decimals);
      const mintTx = api.tx.assets.mint(asset.id, admin.address, mintAmount);

      await new Promise<void>((resolve, reject) => {
        mintTx.signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error(`❌ Mint failed: ${decoded.section}.${decoded.name}`);
            } else {
              console.error(`❌ Mint failed: ${dispatchError.toString()}`);
            }
            reject(dispatchError);
          } else if (status.isInBlock) {
            console.log(`✅ Minted ${mintAmount.toString()} ${asset.symbol}`);
            resolve();
          }
        });
      });

      await sleep(2000);

      // Transfer to target account (10,000 tokens)
      console.log(`📤 Transferring 10,000 ${asset.symbol} to target...`);
      const transferTokenAmount = toChainUnits(10_000, asset.decimals);
      const transferTx = api.tx.assets.transfer(asset.id, TARGET, transferTokenAmount);

      await new Promise<void>((resolve, reject) => {
        transferTx.signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error(`❌ Transfer failed: ${decoded.section}.${decoded.name}`);
            } else {
              console.error(`❌ Transfer failed: ${dispatchError.toString()}`);
            }
            reject(dispatchError);
          } else if (status.isInBlock) {
            console.log(`✅ Transferred ${transferTokenAmount.toString()} ${asset.symbol}`);
            resolve();
          }
        });
      });

      await sleep(2000);

      // Create lending pool (10,000 tokens)
      console.log(`🏦 Creating lending pool ${asset.poolId}...`);
      const poolAmount = toChainUnits(10_000, asset.decimals);
      const poolTx = api.tx.lending.createLendingPool(
        asset.poolId,
        { WithId: asset.id },
        poolAmount
      );

      await new Promise<void>((resolve, reject) => {
        poolTx.signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error(`❌ Pool creation failed: ${decoded.section}.${decoded.name}`);
            } else {
              console.error(`❌ Pool creation failed: ${dispatchError.toString()}`);
            }
            reject(dispatchError);
          } else if (status.isInBlock) {
            console.log(`✅ Pool ${asset.poolId} created in block ${status.asInBlock}`);
            resolve();
          }
        });
      });

      await sleep(3000);

      // Activate lending pool using sudo
      console.log(`🔓 Activating lending pool ${asset.poolId}...`);
      const activateTx = api.tx.lending.activateLendingPool({ WithId: asset.id });
      const sudoActivateTx = api.tx.sudo.sudo(activateTx);

      await new Promise<void>((resolve, reject) => {
        sudoActivateTx.signAndSend(admin, { nonce: nonce++ }, ({ status, dispatchError }) => {
          if (dispatchError) {
            if (dispatchError.isModule) {
              const decoded = api.registry.findMetaError(dispatchError.asModule);
              console.error(`❌ Pool activation failed: ${decoded.section}.${decoded.name}`);
            } else {
              console.error(`❌ Pool activation failed: ${dispatchError.toString()}`);
            }
            reject(dispatchError);
          } else if (status.isInBlock) {
            console.log(`✅ Pool ${asset.poolId} activated in block ${status.asInBlock}`);
            resolve();
          }
        });
      });

      await sleep(2000);

      // Query and display balances
      const targetBalance = (await api.query.assets.account(asset.id, TARGET)).toJSON();
      console.log(`📊 Target balance for ${asset.symbol}:`, targetBalance);

    } catch (err) {
      console.error(`❌ Error while processing ${asset.name}:`, err);
      break;
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`🎉 All assets and lending pools created successfully!`);
  console.log(`${'='.repeat(60)}\n`);
  
  await api.disconnect();
}

main().catch(console.error);