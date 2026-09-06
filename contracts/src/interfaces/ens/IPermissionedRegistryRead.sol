// SPDX-License-Identifier: MIT
// Read-side subset of ensdomains/namechain IPermissionedRegistry + IStandardRegistry (2026-09-05).
// Status/State mirror the upstream layout exactly; do not reorder.
pragma solidity >=0.8.13;

interface IPermissionedRegistryRead {
    enum Status {
        AVAILABLE,
        RESERVED,
        REGISTERED
    }

    struct State {
        Status status;
        uint64 expiry;
        address latestOwner;
        uint256 tokenId;
        uint256 resource;
    }

    /// @param anyId The labelhash, token ID, or resource.
    function getState(uint256 anyId) external view returns (State memory state);

    function getStatus(uint256 anyId) external view returns (Status status);

    function getExpiry(uint256 anyId) external view returns (uint64 expiry);

    function findExpiry(string calldata label) external view returns (uint64 expiry);

    function findOwner(string calldata label) external view returns (address owner);

    function findTokenId(string calldata label) external view returns (uint256 tokenId);

    function getResolver(string calldata label) external view returns (address resolver);
}
