// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {MockYieldAdapter} from "../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {Config, EnsConfig} from "./Config.s.sol";
import {Deployed} from "./Deployed.s.sol";

/// @notice Deploys MockYieldAdapter + SpirithVault against the environment's ENSv2 set and
/// records the addresses in packages/core/deployments/<env>.json, the one source the web, agent
/// and subgraph read. A new environment then needs its import in core's spirith/registry.ts.
///
///   SPIRITH_ENV=hackathon forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY --broadcast [--verify]
contract Deploy is Deployed {
    uint16 internal constant MOCK_RATE_BPS = 400;
    uint256 internal constant DEPOSIT_CAP = 200e6;
    uint256 internal constant RESERVE_YEARS = 2;

    function run() external {
        EnsConfig memory c = ens();

        vm.startBroadcast();
        MockYieldAdapter adapter = new MockYieldAdapter(IMintableERC20(c.mockUsdc), MOCK_RATE_BPS);
        SpirithVault vault = new SpirithVault(
            IERC20(c.mockUsdc),
            IETHRegistrarRead(c.ethRegistrar),
            IPermissionedRegistryRead(c.ethRegistry),
            adapter,
            address(0),
            DEPOSIT_CAP,
            RESERVE_YEARS
        );
        vm.stopBroadcast();

        console.log("MockYieldAdapter:", address(adapter));
        console.log("SpirithVault:    ", address(vault));
        console.log("owner:           ", vault.owner());

        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeUint(json, "block", block.number);
        vm.serializeAddress(json, "spirithVault", address(vault));
        vm.serializeAddress(json, "mockYieldAdapter", address(adapter));
        vm.serializeAddress(json, "usdc", c.mockUsdc);
        string memory out = vm.serializeAddress(json, "owner", vault.owner());
        string memory path = Config.spirithPath(vm);
        vm.writeJson(out, path);
        console.log("wrote", path);
        console.log("add it to packages/core/src/spirith/registry.ts if this environment is new");
    }
}
