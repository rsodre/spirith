// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script} from "forge-std/Script.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {Config, EnsConfig} from "./Config.s.sol";

/// @dev A script over the environment's ENSv2 set and its deployed vault
/// (packages/core/deployments/<env>.json).
abstract contract Deployed is Script {
    function ens() internal view returns (EnsConfig memory c) {
        c = Config.load(vm);
        Config.requireChain(c);
    }

    function vault() internal view returns (SpirithVault) {
        string memory json = vm.readFile(Config.spirithPath(vm));
        return SpirithVault(vm.parseJsonAddress(json, ".spirithVault"));
    }

    /// @dev DNS wire format of `<label>.eth`, as PermissionedResolver's authorize* calls want.
    function dnsName(string memory label) internal pure returns (bytes memory) {
        return abi.encodePacked(uint8(bytes(label).length), label, uint8(3), "eth", uint8(0));
    }
}
