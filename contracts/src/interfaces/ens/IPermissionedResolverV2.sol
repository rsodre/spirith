// SPDX-License-Identifier: MIT
// Vendored subset of the record-linked PermissionedResolver deployed on the ENSv2 hackathon set
// (Sepolia impl 0xa9d3814ab151bf6e37a427432795371a8361614e, verified source, 2026-09-10):
// ensdomains/namechain contracts/src/resolver/interfaces/{IPermissionedResolver,
// IPermissionedResolverInitializable, setters/ITextSetter}.sol and
// access-control/interfaces/IEACGrantInitializable.sol. Setters take the DNS-encoded name, not
// the node; reads go through ENSIP-10 `resolve`; the owner grants one setter with
// `grantSetterRoles(setterCalldata, account)`. The beta's PermissionedResolver is the older
// node-keyed API in ITextResolver.sol; the vault tells them apart by ERC-165.
pragma solidity >=0.8.13;

struct Grant {
    address account;
    uint256 roleBitmap;
}

/// @dev Interface selector: `0x33cc44a0`
interface IPermissionedResolverInitializable {
    /// @notice Initialize the contract.
    /// @param grants Accounts and roles granted on root.
    /// @param calls The calldata that avoids permission checks.
    function initialize(Grant[] calldata grants, bytes[] calldata calls) external;
}

/// @dev Interface selector: `0xc7279f88`
interface ITextSetter {
    /// @notice Text was changed.
    event TextUpdated(uint256 indexed recordId, string indexed keyHash, string key, string value);

    /// @notice Set text for `key`.
    /// @param name The DNS-encoded name.
    /// @param key The text key.
    /// @param value The text value.
    function setText(bytes calldata name, string calldata key, string calldata value) external;
}

interface IPermissionedResolverV2 is ITextSetter {
    /// @notice Authorize fine-grained permission to `account`.
    /// @param setter The ABI-encoded setter calldata to authorize.
    /// @param account The account to be authorize for role.
    /// @return `true` if an authorization was changed.
    function grantSetterRoles(bytes calldata setter, address account) external returns (bool);

    /// @notice Get the record linked to `node`.
    /// @return The record ID or 0 if not linked.
    function getRecordId(bytes32 node) external view returns (uint256);

    /// @notice ENSIP-10 read; `data` is a legacy profile call such as `text(node, key)`.
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}
