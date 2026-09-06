// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {SepoliaConfig as C} from "./Config.s.sol";

/// @notice Phase 0 proof of path: an account that does NOT own `label` renews it with MockUSDC.
///
///   LABEL=<label> DURATION=<seconds, default 1 year> \
///   forge script script/ProveRenew.s.sol --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract ProveRenew is Script {
    function run() external {
        string memory label = vm.envString("LABEL");
        uint64 duration = uint64(vm.envOr("DURATION", uint256(C.ONE_YEAR)));
        require(block.chainid == C.CHAIN_ID, "sepolia only");

        IETHRegistrarRead registrar = IETHRegistrarRead(C.ETH_REGISTRAR);
        IPermissionedRegistryRead registry = IPermissionedRegistryRead(C.ETH_REGISTRY);
        IMintableERC20 usdc = IMintableERC20(C.MOCK_USDC);

        require(registrar.isRenewable(label), "not renewable");
        uint64 expiryBefore = registry.findExpiry(label);
        address owner = registry.findOwner(label);
        uint256 price = registrar.getRenewPrice(label, duration, IERC20(address(usdc)));
        bytes32 referrer = bytes32(uint256(uint160(msg.sender)));

        console.log("label:", label);
        console.log("owner:", owner);
        console.log("caller:", msg.sender);
        console.log("expiry before:", expiryBefore);
        console.log("price (USDC, 6 dec):", price);

        vm.startBroadcast();
        if (usdc.balanceOf(msg.sender) < price) usdc.mint(msg.sender, price);
        usdc.approve(address(registrar), price);
        registrar.renew(label, duration, IERC20(address(usdc)), referrer);
        vm.stopBroadcast();

        uint64 expiryAfter = registry.findExpiry(label);
        console.log("expiry after:", expiryAfter);
        require(expiryAfter == expiryBefore + duration, "expiry did not extend");
        require(owner != msg.sender, "caller owns the name; proof is weaker");
    }
}
