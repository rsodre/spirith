// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console} from "forge-std/Script.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {ITextResolver} from "../src/interfaces/ens/ITextResolver.sol";
import {SepoliaConfig as C} from "./Config.s.sol";
import {Deployed} from "./Deployed.s.sol";

/// @notice Run as a KEEPER (any key, never the owner). Renews `LABEL.eth` from its earmark for
/// the vault's optimal duration and collects the tip.
///
///   LABEL=<label> forge script script/Renew.s.sol --rpc-url ... --private-key $KEEPER_PRIVATE_KEY --broadcast
contract Renew is Deployed {
    function run() external {
        require(block.chainid == C.CHAIN_ID, "sepolia only");
        string memory label = vm.envString("LABEL");
        SpirithVault v = vault();
        IPermissionedRegistryRead registry = IPermissionedRegistryRead(C.ETH_REGISTRY);

        uint64 duration = v.optimalDuration(label);
        uint64 before = registry.findExpiry(label);
        console.log("expiry before:", before);
        console.log("duration (days):", duration / 1 days);

        vm.startBroadcast();
        (uint256 price, uint256 tip) = v.renew(label, duration);
        vm.stopBroadcast();

        console.log("price paid:", price);
        console.log("tip received:", tip);
        console.log("expiry after:", registry.findExpiry(label));
        address resolver = registry.getResolver(label);
        if (resolver.code.length > 0) {
            try ITextResolver(resolver).text(v.node(label), v.RECORD_FUNDED_UNTIL()) returns (
                string memory value
            ) {
                console.log("spirith.funded-until:", value);
            } catch {}
        }
    }
}
