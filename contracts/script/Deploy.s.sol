// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {MockYieldAdapter} from "../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {SepoliaConfig as C} from "./Config.s.sol";

/// @notice Deploys MockYieldAdapter + SpirithVault on Sepolia and records the addresses in
/// packages/core/deployments/sepolia.json, the one source the web, agent and subgraph read.
///
///   forge script script/Deploy.s.sol --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY --broadcast [--verify]
contract Deploy is Script {
    uint16 internal constant MOCK_RATE_BPS = 400;
    uint256 internal constant DEPOSIT_CAP = 200e6;
    uint256 internal constant RESERVE_YEARS = 2;

    function run() external {
        require(block.chainid == C.CHAIN_ID, "sepolia only");

        vm.startBroadcast();
        MockYieldAdapter adapter = new MockYieldAdapter(IMintableERC20(C.MOCK_USDC), MOCK_RATE_BPS);
        SpirithVault vault = new SpirithVault(
            IERC20(C.MOCK_USDC),
            IETHRegistrarRead(C.ETH_REGISTRAR),
            IPermissionedRegistryRead(C.ETH_REGISTRY),
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
        vm.serializeAddress(json, "usdc", C.MOCK_USDC);
        string memory out = vm.serializeAddress(json, "owner", vault.owner());
        vm.writeJson(out, "../packages/core/deployments/sepolia.json");
        console.log("wrote packages/core/deployments/sepolia.json");
    }
}
