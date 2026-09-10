// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Vm} from "forge-std/Vm.sol";

/// @notice The ENSv2 contract set of one environment (spec §2).
struct EnsConfig {
    uint256 chainId;
    address ethRegistrar;
    address ethRegistry;
    address rootRegistry;
    address rentPriceOracle;
    address mockUsdc;
    address mockDai;
    address circleUsdc;
    address permissionedResolverImpl;
    address verifiableFactory;
    address universalResolver;
    address publicResolverV2;
    address paymentBeneficiary;
}

/// @notice Reads the environment's ENSv2 addresses from packages/core/deployments/ens/<env>.json,
/// the one source the web, the agent and the subgraph read too. `SPIRITH_ENV` picks the
/// environment (`hackathon`, `sepolia`; default `hackathon`). Both Sepolia sets were verified live
/// through their own Universal Resolver entry point; the namechain repo ships other Sepolia
/// sets, never copy from there.
library Config {
    uint64 internal constant ONE_YEAR = 365 days;
    uint64 internal constant MIN_REGISTER_DURATION = 28 days;

    string internal constant DEPLOYMENTS = "../packages/core/deployments/";

    function envName(Vm vm) internal view returns (string memory) {
        return vm.envOr("SPIRITH_ENV", string("hackathon"));
    }

    /// @dev Where Deploy.s.sol writes and Deployed.s.sol reads the vault of this environment.
    function spirithPath(Vm vm) internal view returns (string memory) {
        return string.concat(DEPLOYMENTS, envName(vm), ".json");
    }

    function load(Vm vm) internal view returns (EnsConfig memory c) {
        string memory json = vm.readFile(string.concat(DEPLOYMENTS, "ens/", envName(vm), ".json"));
        c.chainId = vm.parseJsonUint(json, ".chainId");
        c.ethRegistrar = vm.parseJsonAddress(json, ".ethRegistrar");
        c.ethRegistry = vm.parseJsonAddress(json, ".ethRegistry");
        c.rootRegistry = vm.parseJsonAddress(json, ".rootRegistry");
        c.rentPriceOracle = vm.parseJsonAddress(json, ".rentPriceOracle");
        c.mockUsdc = vm.parseJsonAddress(json, ".mockUsdc");
        c.mockDai = vm.parseJsonAddress(json, ".mockDai");
        c.circleUsdc = vm.parseJsonAddress(json, ".circleUsdc");
        c.permissionedResolverImpl = vm.parseJsonAddress(json, ".permissionedResolverImpl");
        c.verifiableFactory = vm.parseJsonAddress(json, ".verifiableFactory");
        c.universalResolver = vm.parseJsonAddress(json, ".universalResolver");
        c.publicResolverV2 = vm.parseJsonAddress(json, ".publicResolverV2");
        c.paymentBeneficiary = vm.parseJsonAddress(json, ".paymentBeneficiary");
    }

    /// @dev Scripts run against the chain the environment lives on, never another.
    function requireChain(EnsConfig memory c) internal view {
        require(block.chainid == c.chainId, "wrong chain for SPIRITH_ENV");
    }
}
