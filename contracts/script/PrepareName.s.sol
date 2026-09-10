// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console} from "forge-std/Script.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {EnsConfig} from "./Config.s.sol";
import {Deployed} from "./Deployed.s.sol";
import {ResolverSetup} from "./ResolverSetup.s.sol";

interface IRegistryWrite {
    function findTokenId(string calldata label) external view returns (uint256);
    function getResolver(string calldata label) external view returns (address);
    function setResolver(uint256 anyId, address resolver) external;
}

/// @notice Run as the NAME OWNER. Gives `LABEL.eth` a PermissionedResolver of its own (unless
/// RESOLVER is set), points the name at it, and lets the deployed vault write the two Spirith
/// records. This is the one owner action the resolver record needs (spec §4.3). Works for
/// either PermissionedResolver generation (ResolverSetup).
///
///   LABEL=<label> forge script script/PrepareName.s.sol --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract PrepareName is Deployed {
    function run() external {
        EnsConfig memory c = ens();
        string memory label = vm.envString("LABEL");
        SpirithVault v = vault();
        IRegistryWrite registry = IRegistryWrite(c.ethRegistry);
        address resolver = vm.envOr("RESOLVER", address(0));

        vm.startBroadcast();
        if (resolver == address(0)) {
            uint256 salt = uint256(keccak256(abi.encodePacked("spirith", label, msg.sender)));
            resolver = ResolverSetup.deploy(
                c.verifiableFactory, c.permissionedResolverImpl, salt, msg.sender
            );
            console.log("deployed PermissionedResolver:", resolver);
        }
        if (registry.getResolver(label) != resolver) {
            registry.setResolver(registry.findTokenId(label), resolver);
            console.log("resolver set on registry");
        }
        bytes memory name = dnsName(label);
        ResolverSetup.authorizeText(resolver, name, v.RECORD_FUNDED_UNTIL(), address(v));
        ResolverSetup.authorizeText(resolver, name, v.RECORD_PATRONS(), address(v));
        vm.stopBroadcast();
        console.log("vault authorised for spirith.* records on", label);
    }
}
