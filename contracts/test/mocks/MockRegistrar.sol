// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {RenewData} from "../../src/interfaces/ens/IETHRenewer.sol";

/// @notice ENSv2 registrar + registry double for vault tests. Pricing mirrors the live oracle
/// for 5+ char names ($8/yr, discounts at 2/3/6 years, ceil to 6 decimals); payment is pulled
/// from the caller to BENEFICIARY exactly as the real registrar does. Also answers the two
/// registry reads the vault makes (`findExpiry`, `getResolver`) so one address plays both.
contract MockRegistrar {
    using SafeERC20 for IERC20;
    using Math for uint256;

    uint64 public constant GRACE_PERIOD = 28 days;
    uint256 internal constant RATE_PER_SECOND = 253_679; // 1e-12 dollars, 5+ chars
    uint256 internal constant DEN = 1e38;
    address public constant BENEFICIARY = address(0xBEEF);

    struct Name {
        uint64 expiry;
        address resolver;
    }

    mapping(bytes32 labelHash => Name) internal _names;

    event NameRenewed(
        uint256 indexed tokenId,
        string label,
        uint64 duration,
        uint64 newExpiry,
        IERC20 paymentToken,
        bytes32 indexed referrer,
        uint256 amount
    );

    error NameNotRenewable(string label);

    // ---- test setup

    function register(string calldata label, uint64 expiry, address resolver) external {
        _names[keccak256(bytes(label))] = Name(expiry, resolver);
    }

    // ---- registrar surface

    function isRenewable(string calldata label) public view returns (bool) {
        uint64 expiry = _names[keccak256(bytes(label))].expiry;
        return expiry != 0 && block.timestamp < expiry + GRACE_PERIOD;
    }

    function getRenewPrice(string calldata, uint64 duration, IERC20) public pure returns (uint256) {
        uint256 base = RATE_PER_SECOND * duration;
        uint256 numer;
        if (duration >= 6 * 365 days) numer = 5625 * 1e34;
        else if (duration >= 3 * 365 days) numer = 6875 * 1e34;
        else if (duration >= 2 * 365 days) numer = 875 * 1e35;
        if (numer != 0) base = base.mulDiv(numer, DEN);
        return base.mulDiv(1, 1e6, Math.Rounding.Ceil);
    }

    function renew(RenewData calldata rd, IERC20 paymentToken) external {
        if (!isRenewable(rd.label)) revert NameNotRenewable(rd.label);
        Name storage n = _names[keccak256(bytes(rd.label))];
        uint256 amount = getRenewPrice(rd.label, rd.duration, paymentToken);
        paymentToken.safeTransferFrom(msg.sender, BENEFICIARY, amount);
        n.expiry += rd.duration;
        emit NameRenewed(
            uint256(keccak256(bytes(rd.label))),
            rd.label,
            rd.duration,
            n.expiry,
            paymentToken,
            rd.referrer,
            amount
        );
    }

    // ---- registry surface

    function findExpiry(string calldata label) external view returns (uint64) {
        return _names[keccak256(bytes(label))].expiry;
    }

    function getResolver(string calldata label) external view returns (address) {
        return _names[keccak256(bytes(label))].resolver;
    }
}
