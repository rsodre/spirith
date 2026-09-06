// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice ENSv2 Sepolia beta addresses (spec §2), verified live 2026-09-05 through the fixed
/// Universal Resolver entry point. The namechain repo ships two other Sepolia sets; never copy
/// from there. Mirrors packages/core/src/ens/addresses.ts; keep the two in lockstep.
library SepoliaConfig {
    uint256 internal constant CHAIN_ID = 11155111;

    address internal constant ETH_REGISTRAR = 0xa88553F454b77203B0D036A05c894d555EAAa2Cc;
    address internal constant ETH_REGISTRY = 0xBDC85dD5b15D7ecb354cd7cb6f2c50b4f2c4F0E2;
    address internal constant ROOT_REGISTRY = 0x8115186E8f2E0B0281e86ab91f0f48Ba90364354;
    address internal constant RENT_PRICE_ORACLE = 0x8914b66260EB8C4fff795650c3AE8Cd335958987;
    address internal constant MOCK_USDC = 0x768F42455A2D082E23ceeF7d51e5787C82d67a39;
    address internal constant MOCK_DAI = 0x5472C5725A00B7bA11F0794A79D08ade6F4683bD;
    address internal constant CIRCLE_USDC = 0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238;
    address internal constant PERMISSIONED_RESOLVER_IMPL =
        0x9EAe5C2730a7dD16BDD1DeE6421a1B91e3B0365e;
    address internal constant VERIFIABLE_FACTORY = 0x10dC6333CDFe1FCEf624c6e0a8221b91804Cd7ef;
    address internal constant UNIVERSAL_RESOLVER = 0xeEeEEEeE14D718C2B47D9923Deab1335E144EeEe;
    address internal constant PUBLIC_RESOLVER_V2 = 0xe7B9A25607E02da8145E4eB1836CA539e53F11f7;
    address internal constant PAYMENT_BENEFICIARY = 0x84D3a426D4E12E955d1DF95db0B24fe26afE39D3;

    uint64 internal constant ONE_YEAR = 365 days;
    uint64 internal constant MIN_REGISTER_DURATION = 28 days;
}
