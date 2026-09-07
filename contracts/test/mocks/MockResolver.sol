// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice PermissionedResolver double: text records gated by a per-account authorisation, plus
/// a switch that burns all gas to prove the vault's stipend protects renewals.
contract MockResolver {
    mapping(bytes32 node => mapping(string key => string)) public text;
    mapping(address account => bool) public authorized;
    bool public burnAllGas;

    error Unauthorized(address account);

    function setAuthorized(address account, bool value) external {
        authorized[account] = value;
    }

    function setBurnAllGas(bool value) external {
        burnAllGas = value;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external {
        if (burnAllGas) {
            while (true) {}
        }
        if (!authorized[msg.sender]) revert Unauthorized(msg.sender);
        text[node][key] = value;
    }
}
