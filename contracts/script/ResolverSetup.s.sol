// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {ITextResolver} from "../src/interfaces/ens/ITextResolver.sol";
import {
    Grant,
    IPermissionedResolverInitializable,
    IPermissionedResolverV2,
    ITextSetter
} from "../src/interfaces/ens/IPermissionedResolverV2.sol";

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data)
        external
        returns (address);
}

interface ILegacyResolverInit {
    function initialize(address admin, uint256 roleBitmap, bytes[] calldata setters) external;
}

/// @notice The owner-side resolver setup (spec §4.3) for either PermissionedResolver
/// generation: deploy a proxy owned by `admin`, then let the vault set one text key. The
/// generation is read from the implementation with ERC-165, so scripts and fork tests run
/// unchanged against the beta and the hackathon set.
library ResolverSetup {
    bytes4 internal constant RECORD_LINKED_ID = 0x33cc44a0; // IPermissionedResolverInitializable

    // Every regular role and its admin counterpart, per PermissionedResolverLib of each
    // generation (the older one also had nybbles 8 and 9).
    uint256 internal constant LEGACY_ROLES = (1 << 0) | (1 << 4) | (1 << 8) | (1 << 12) | (1 << 16)
        | (1 << 20) | (1 << 24) | (1 << 28) | (1 << 32) | (1 << 36) | (1 << 120) | (1 << 124);
    uint256 internal constant LINKED_ROLES = (1 << 0) | (1 << 4) | (1 << 8) | (1 << 12) | (1 << 16)
        | (1 << 20) | (1 << 24) | (1 << 28) | (1 << 120) | (1 << 124);

    function isRecordLinked(address implementation) internal view returns (bool) {
        return ERC165Checker.supportsERC165InterfaceUnchecked(implementation, RECORD_LINKED_ID);
    }

    /// @dev A resolver proxy of `implementation`, with `admin` holding every role.
    function deploy(address factory, address implementation, uint256 salt, address admin)
        internal
        returns (address)
    {
        bytes memory init;
        if (isRecordLinked(implementation)) {
            Grant[] memory grants = new Grant[](1);
            grants[0] = Grant(admin, LINKED_ROLES | (LINKED_ROLES << 128));
            init = abi.encodeCall(
                IPermissionedResolverInitializable.initialize, (grants, new bytes[](0))
            );
        } else {
            init = abi.encodeCall(
                ILegacyResolverInit.initialize,
                (admin, LEGACY_ROLES | (LEGACY_ROLES << 128), new bytes[](0))
            );
        }
        return IVerifiableFactory(factory).deployProxy(implementation, salt, init);
    }

    /// @dev Let `account` set text `key` on `name` (DNS wire format). Caller must be an admin.
    function authorizeText(address resolver, bytes memory name, string memory key, address account)
        internal
    {
        if (isRecordLinked(resolver)) {
            IPermissionedResolverV2(resolver)
                .grantSetterRoles(abi.encodeCall(ITextSetter.setText, (name, key, "")), account);
        } else {
            ITextResolver(resolver).authorizeTextRoles(name, key, account, true);
        }
    }

    /// @dev Read text `key` for `name` through the generation's own read path.
    function readText(address resolver, bytes memory name, bytes32 node, string memory key)
        internal
        view
        returns (string memory)
    {
        if (isRecordLinked(resolver)) {
            bytes memory out = IPermissionedResolverV2(resolver)
                .resolve(name, abi.encodeCall(ITextResolver.text, (node, key)));
            return abi.decode(out, (string));
        }
        return ITextResolver(resolver).text(node, key);
    }
}
