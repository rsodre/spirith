// SPDX-License-Identifier: MIT
// Text-record surface of ensdomains/namechain PermissionedResolver (2026-09-05). setText needs
// ROLE_SET_TEXT on resource(node, key), granted by the owner via authorizeTextRoles.
pragma solidity >=0.8.13;

interface ITextResolver {
    event TextChanged(bytes32 indexed node, string indexed indexedKey, string key, string value);

    function setText(bytes32 node, string calldata key, string calldata value) external;

    function text(bytes32 node, string calldata key) external view returns (string memory);

    function authorizeTextRoles(
        bytes calldata toName,
        string calldata key,
        address account,
        bool grant
    ) external returns (bool);
}
