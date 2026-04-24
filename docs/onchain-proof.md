# On-Chain Proof (Arbitrum Sepolia) — Final

Timestamp (UTC): 2026-04-23

Contracts (latest deployment):
- `ConfidentialRWAToken`: `0x00094fc240029a342fB1152bBc7a15F73C7142C2`
- `DisclosureRegistry`: `0x5118aEC317dC21361Cad981944532F1f90D7aBb8`
- `TransferController`: `0x049B1712B9E624a01Eb4C40d10aBF42E89a14314`
- `AuditAnchor`: `0x79279257A998d3a5E26B70cb538b09fEe2f90174`

Command used:

```bash
cd /root/RWAOS/contracts
PRIVATE_KEY=0x... ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc \
npx hardhat run scripts/onchain-proof.ts --network arbitrumSepolia
```

Explorer base: `https://sepolia.arbiscan.io/tx/`

## Transactions

1. `mint` ✅  
Hash: `0x20b1b3abaef72509494b6d8c21a3c944a1e962b67264c8a609d43e64a86efac2`  
Block: `262228167`  
Gas: `266281`

2. `setOperator` ✅  
Hash: `0x7a217bfd657a94ba3dfc62213eaa05fd2e57c6ee42c100e3c28dff359cd44c3e`  
Block: `262228174`  
Gas: `46660`

3. `disclosure` ✅  
Hash: `0x96173766188c5ae79b7e9e58dba1013a7dd605a82f040f05649a842c5d4ccabe`  
Block: `262228185`  
Gas: `72468`

4. `directConfidentialTransfer` ✅  
Hash: `0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428`  
Block: `262228194`  
Gas: `305922`

5. `confidentialTransferViaController` ✅  
Hash: `0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad`  
Block: `262228204`  
Gas: `339016`

6. `auditAnchor` ✅  
Hash: `0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b`  
Block: `262228213`  
Gas: `117891`

## Result

Full business-critical on-chain flow is now proven end-to-end, including controller-mediated confidential transfer.

Artifact:
- `contracts/deployments/onchain-proof-latest.json`

