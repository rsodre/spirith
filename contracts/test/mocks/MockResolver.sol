// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @notice PermissionedResolver double for both generations: text records gated by a
/// per-account authorisation, plus a switch that burns all gas to prove the vault's stipend
/// protects renewals. By default it is the record-linked resolver (DNS-name `setText`, ERC-165
/// `ITextSetter`); `setLegacy(true)` makes it the older node-keyed one instead.
contract MockResolver {
    bytes32 internal constant ETH_NODE =
        0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;

    mapping(bytes32 node => mapping(string key => string)) public text;
    mapping(address account => bool) public authorized;
    bool public burnAllGas;
    bool public legacy;

    error Unauthorized(address account);
    error WrongGeneration();

    function setAuthorized(address account, bool value) external {
        authorized[account] = value;
    }

    function setBurnAllGas(bool value) external {
        burnAllGas = value;
    }

    function setLegacy(bool value) external {
        legacy = value;
    }

    function supportsInterface(bytes4 interfaceId) external view returns (bool) {
        return !legacy && interfaceId == 0xc7279f88;
    }

    /// @dev Record-linked generation: `<label>.eth` in DNS wire format.
    function setText(bytes calldata name, string calldata key, string calldata value) external {
        if (legacy) revert WrongGeneration();
        _set(_namehash(name), key, value);
    }

    /// @dev Older generation: the node.
    function setText(bytes32 node, string calldata key, string calldata value) external {
        if (!legacy) revert WrongGeneration();
        _set(node, key, value);
    }

    function _set(bytes32 node, string calldata key, string calldata value) internal {
        if (burnAllGas) {
            while (true) {}
        }
        if (!authorized[msg.sender]) revert Unauthorized(msg.sender);
        text[node][key] = value;
    }

    function _namehash(bytes calldata name) internal pure returns (bytes32) {
        uint8 len = uint8(name[0]);
        require(name.length == len + 6 && name[len + 1] == 0x03, "not <label>.eth");
        return keccak256(abi.encodePacked(ETH_NODE, keccak256(name[1:1 + len])));
    }
}
