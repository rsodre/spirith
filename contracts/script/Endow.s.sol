// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console} from "forge-std/Script.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {SepoliaConfig as C} from "./Config.s.sol";
import {Deployed} from "./Deployed.s.sol";

/// @notice Run as a PATRON (any key). Mints MockUSDC and endows `LABEL.eth` with AMOUNT.
///
///   LABEL=<label> AMOUNT=50000000 forge script script/Endow.s.sol --rpc-url ... --broadcast
contract Endow is Deployed {
    function run() external {
        require(block.chainid == C.CHAIN_ID, "sepolia only");
        string memory label = vm.envString("LABEL");
        uint256 amount = vm.envOr("AMOUNT", uint256(50e6));
        SpirithVault v = vault();
        IMintableERC20 usdc = IMintableERC20(C.MOCK_USDC);

        vm.startBroadcast();
        if (usdc.balanceOf(msg.sender) < amount) usdc.mint(msg.sender, amount);
        usdc.approve(address(v), amount);
        uint256 shares = v.endow(label, amount);
        vm.stopBroadcast();

        (uint64 low, uint64 high, uint256 assets, uint64 duration) = v.runwayOf(label);
        console.log("shares:", shares);
        console.log("assets:", assets);
        console.log("optimal duration (days):", duration / 1 days);
        console.log("funded until (low/high):", low, high);
    }
}
