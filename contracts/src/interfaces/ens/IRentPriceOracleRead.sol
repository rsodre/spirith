// SPDX-License-Identifier: MIT
// Read-side subset of ensdomains/namechain StandardRentPriceOracle (2026-09-05), for the on-chain
// cadence heuristic. Prices themselves come from the registrar's getRenewPrice.
pragma solidity >=0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRentPriceOracleRead {
    struct DiscountPoint {
        uint64 duration;
        uint128 numer;
    }

    function isPaymentToken(IERC20 paymentToken) external view returns (bool);

    function getDiscountPoints() external view returns (DiscountPoint[] memory);

    function DISCOUNT_DENOMINATOR() external view returns (uint128);

    function getBasePrice(string calldata label, uint64 duration) external view returns (uint256);
}
