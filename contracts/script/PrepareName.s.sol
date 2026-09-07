// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {console} from "forge-std/Script.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {ITextResolver} from "../src/interfaces/ens/ITextResolver.sol";
import {SepoliaConfig as C} from "./Config.s.sol";
import {Deployed} from "./Deployed.s.sol";

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data)
        external
        returns (address);
}

interface IResolverInit {
    function initialize(address admin, uint256 roleBitmap, bytes[] calldata setters) external;
}

interface IRegistryWrite {
    function findTokenId(string calldata label) external view returns (uint256);
    function getResolver(string calldata label) external view returns (address);
    function setResolver(uint256 anyId, address resolver) external;
}

/// @notice Run as the NAME OWNER. Gives `LABEL.eth` a PermissionedResolver of its own (unless
/// RESOLVER is set), points the name at it, and lets the deployed vault write the two Spirith
/// records. This is the one owner action the resolver record needs (spec §4.3).
///
///   LABEL=<label> forge script script/PrepareName.s.sol --rpc-url $SEPOLIA_RPC_URL \
///     --private-key $DEPLOYER_PRIVATE_KEY --broadcast
contract PrepareName is Deployed {
    // PermissionedResolverLib: every regular role and its admin counterpart.
    uint256 internal constant REGULAR_ROLES = (1 << 0) | (1 << 4) | (1 << 8) | (1 << 12) | (1 << 16)
        | (1 << 20) | (1 << 24) | (1 << 28) | (1 << 32) | (1 << 36) | (1 << 120) | (1 << 124);
    uint256 internal constant ALL_ROLES = REGULAR_ROLES | (REGULAR_ROLES << 128);

    function run() external {
        require(block.chainid == C.CHAIN_ID, "sepolia only");
        string memory label = vm.envString("LABEL");
        SpirithVault v = vault();
        IRegistryWrite registry = IRegistryWrite(C.ETH_REGISTRY);
        address resolver = vm.envOr("RESOLVER", address(0));

        vm.startBroadcast();
        if (resolver == address(0)) {
            bytes memory init =
                abi.encodeCall(IResolverInit.initialize, (msg.sender, ALL_ROLES, new bytes[](0)));
            uint256 salt = uint256(keccak256(abi.encodePacked("spirith", label, msg.sender)));
            resolver = IVerifiableFactory(C.VERIFIABLE_FACTORY)
                .deployProxy(C.PERMISSIONED_RESOLVER_IMPL, salt, init);
            console.log("deployed PermissionedResolver:", resolver);
        }
        if (registry.getResolver(label) != resolver) {
            registry.setResolver(registry.findTokenId(label), resolver);
            console.log("resolver set on registry");
        }
        bytes memory name = dnsName(label);
        ITextResolver(resolver).authorizeTextRoles(name, v.RECORD_FUNDED_UNTIL(), address(v), true);
        ITextResolver(resolver).authorizeTextRoles(name, v.RECORD_PATRONS(), address(v), true);
        vm.stopBroadcast();
        console.log("vault authorised for spirith.* records on", label);
    }
}
