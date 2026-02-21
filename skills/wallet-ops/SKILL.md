---
name: wallet-ops
description: Check USDC and ETH balances, and send USDC transfers on Base Sepolia
version: 1.0.0
emoji: 💳
metadata: {"openclaw":{"requires":{"env":["BASE_SEPOLIA_RPC","USDC_CONTRACT"],"bins":["node"]},"primaryEnv":"BASE_SEPOLIA_RPC"}}
---

# Wallet Operations — Base Sepolia

Blockchain wallet operations for the Ultimatum Game on Base Sepolia testnet.

## Available Commands

### Check USDC Balance
```bash
node ~/.openclaw/skills/wallet-ops/scripts/check-balance.js <address>
```
Returns the USDC balance (6 decimals) for any address on Base Sepolia.

**Example:**
```bash
node ~/.openclaw/skills/wallet-ops/scripts/check-balance.js 0xB4305A685E7370b170F5005A4efd268e3DdB2A6E
```

### Check ETH Balance (for gas)
```bash
node ~/.openclaw/skills/wallet-ops/scripts/check-eth.js <address>
```
Returns the ETH balance for gas fees.

### Send USDC
```bash
WALLET_PRIVATE_KEY=<key> node ~/.openclaw/skills/wallet-ops/scripts/send-usdc.js <recipient_address> <amount>
```
Sends USDC from the signing wallet to the recipient. Amount is in USDC (e.g., 0.5 for half a USDC).

**Example — Proposer sends 0.4 USDC to Responder:**
```bash
WALLET_PRIVATE_KEY=$PROPOSER_PRIVATE_KEY node ~/.openclaw/skills/wallet-ops/scripts/send-usdc.js 0x328DB42692f438Ab8D9e020Ac63ebF72508e7D34 0.4
```

The script outputs JSON with the transaction hash and Base Sepolia explorer link.

## Important Notes
- All transactions are on Base Sepolia testnet (chain ID 84532)
- USDC contract: 0x036CbD53842c5426634e7929541eC2318f3dCF7e
- USDC uses 6 decimal places
- Always check ETH balance before sending (need gas)
- The Proposer agent should use PROPOSER_PRIVATE_KEY environment variable

