// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Minimal ENSv2 registrar double for vault tests: renewability per label and a flat
/// per-second rate with no discounts. Phase 2 adds `renew()` with payment collection.
contract MockRegistrar {
    uint256 public constant PRICE_PER_YEAR = 8_000_021;

    mapping(bytes32 labelHash => bool) internal _renewable;

    function setRenewable(string calldata label, bool value) external {
        _renewable[keccak256(bytes(label))] = value;
    }

    function isRenewable(string calldata label) external view returns (bool) {
        return _renewable[keccak256(bytes(label))];
    }

    function getRenewPrice(string calldata, uint64 duration, IERC20)
        external
        pure
        returns (uint256)
    {
        return PRICE_PER_YEAR * duration / 365 days;
    }
}
