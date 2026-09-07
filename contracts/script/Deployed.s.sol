// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";

import {SpirithVault} from "../src/SpirithVault.sol";

/// @dev Reads the deployed vault from packages/core/deployments/sepolia.json.
abstract contract Deployed is Script {
    function vault() internal view returns (SpirithVault) {
        string memory json = vm.readFile("../packages/core/deployments/sepolia.json");
        return SpirithVault(vm.parseJsonAddress(json, ".spirithVault"));
    }

    /// @dev DNS wire format of `<label>.eth`, as PermissionedResolver's authorize* calls want.
    function dnsName(string memory label) internal pure returns (bytes memory) {
        return abi.encodePacked(uint8(bytes(label).length), label, uint8(3), "eth", uint8(0));
    }
}
