// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";

import {IETHRenewer} from "../src/interfaces/ens/IETHRenewer.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {ITextResolver} from "../src/interfaces/ens/ITextResolver.sol";
import {
    IPermissionedResolverInitializable,
    IPermissionedResolverV2,
    ITextSetter
} from "../src/interfaces/ens/IPermissionedResolverV2.sol";

/// @notice Pins the vendored ENSv2 selectors to the upstream signatures. A red test means the
/// vendored copy drifted from ensdomains/namechain, not that the expected value is wrong.
contract InterfacesTest is Test {
    function test_renewSelector() public pure {
        assertEq(
            IETHRenewer.renew.selector, bytes4(keccak256("renew((string,uint64,bytes32),address)"))
        );
        assertEq(
            IETHRenewer.renewBatch.selector,
            bytes4(keccak256("renewBatch((string,uint64,bytes32)[],address)"))
        );
        assertEq(
            IETHRenewer.getRenewPrice.selector,
            bytes4(keccak256("getRenewPrice(string,uint64,address)"))
        );
        assertEq(IETHRenewer.isRenewable.selector, bytes4(keccak256("isRenewable(string)")));
    }

    function test_registrySelectors() public pure {
        assertEq(
            IPermissionedRegistryRead.findExpiry.selector, bytes4(keccak256("findExpiry(string)"))
        );
        assertEq(
            IPermissionedRegistryRead.getState.selector, bytes4(keccak256("getState(uint256)"))
        );
        assertEq(uint8(IPermissionedRegistryRead.Status.REGISTERED), 2);
    }

    function test_resolverSelectors() public pure {
        assertEq(
            ITextResolver.setText.selector, bytes4(keccak256("setText(bytes32,string,string)"))
        );
        assertEq(
            ITextResolver.authorizeTextRoles.selector,
            bytes4(keccak256("authorizeTextRoles(bytes,string,address,bool)"))
        );
    }

    /// @dev The record-linked generation, as its own source documents the selectors.
    function test_recordLinkedResolverSelectors() public pure {
        assertEq(type(ITextSetter).interfaceId, bytes4(0xc7279f88));
        assertEq(ITextSetter.setText.selector, bytes4(keccak256("setText(bytes,string,string)")));
        assertEq(type(IPermissionedResolverInitializable).interfaceId, bytes4(0x33cc44a0));
        assertEq(
            IPermissionedResolverV2.grantSetterRoles.selector,
            bytes4(keccak256("grantSetterRoles(bytes,address)"))
        );
    }
}
