# BOAI Demo Reward — token metadata

**TESTNET ONLY. TANPA NILAI UANG. Rp0.**

`BOAI-DEMO` is a nonredeemable demo trophy minted by `BOAIArena` on Monad Testnet. It is
not money, not a security, not a stake, and not convertible to `BOAI_CREDIT`, MON, rupiah,
or anything else. There is no public faucet, no purchase path, no transfer to a fiat rail,
and no cash-out. One unit is minted per recorded match, at most once per `matchId`, and only
by an address holding `RECORDER_ROLE`.

## Verified Monad Testnet constants

Checked against `https://docs.monad.xyz/developer-essentials/testnet` on 2026-10-24.

| Field | Value |
| --- | --- |
| Chain ID | `10143` |
| RPC URL | `https://rpc-testnet.monadinfra.com` |
| Block explorer | `https://testnet.monadscan.com` |
| Faucet | `https://faucet.monad.xyz` |
| Native currency | `MON` |

The testnet was reset from genesis on **2025-12-16**. Addresses and blocks from before that
reset do not exist on the current chain.

## Token fields

| Field | Value |
| --- | --- |
| Name | `BOAI Demo Reward` |
| Symbol | `BOAI-DEMO` |
| Decimals | `18` |
| Amount per reward | `1e18` (one whole demo unit) |
| Contract | `contracts/src/BOAIArena.sol` |
| Mint authority | `RECORDER_ROLE` only |
| Deployed Address | `0x5af642ed0427567b0dfd5ecd9474f174dbda8420` |
| Recorder Address | `0x0F459882C3ffF5707e6360AA2BDBc826CA468646` |
| Deployment Tx | `0x02f129d432461960335ad56e80dba8bcc759cd48efe8849e480c28f532826d4e` |
| Explorer URL | https://testnet.monadscan.com/address/0x5af642ed0427567b0dfd5ecd9474f174dbda8420 |

## Non-goals

No upgradeability. No proxy. No `selfdestruct`. No payable function. No public `mint`.
No mainnet deployment. Deployed to Monad Testnet for the hackathon judge flow.
