// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

import {IYieldAdapter} from "./IYieldAdapter.sol";

/// @notice Real yield behind SpirithVault: a thin per-caller ledger over any ERC-4626 vault
/// (Aave's USDC token, sDAI, Morpho, ...). Written to the standard, never to a protocol
/// (spec §4.2). The adapter holds the ERC-4626 shares; each caller owns a slice of them.
///
/// The rate range is configured at deploy time because ERC-4626 exposes no rate. It is the
/// honest-UI input (spec §4.4), not a promise.
contract ERC4626Adapter is IYieldAdapter {
    using SafeERC20 for IERC20;

    IERC4626 public immutable VAULT;
    IERC20 public immutable ASSET;
    uint16 public immutable RATE_LOW_BPS;
    uint16 public immutable RATE_HIGH_BPS;

    mapping(address account => uint256) public sharesOf;

    error ZeroAmount();
    error InsufficientShares(uint256 requested, uint256 available);
    error InvalidRateRange(uint16 low, uint16 high);

    constructor(IERC4626 vault, uint16 rateLowBps, uint16 rateHighBps) {
        if (rateLowBps > rateHighBps) revert InvalidRateRange(rateLowBps, rateHighBps);
        VAULT = vault;
        ASSET = IERC20(vault.asset());
        RATE_LOW_BPS = rateLowBps;
        RATE_HIGH_BPS = rateHighBps;
    }

    function asset() external view returns (IERC20) {
        return ASSET;
    }

    function rateRangeBps() external view returns (uint16, uint16) {
        return (RATE_LOW_BPS, RATE_HIGH_BPS);
    }

    function convertToAssets(uint256 shares) external view returns (uint256) {
        return VAULT.convertToAssets(shares);
    }

    function convertToShares(uint256 assets) external view returns (uint256) {
        return VAULT.convertToShares(assets);
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        ASSET.safeTransferFrom(msg.sender, address(this), assets);
        ASSET.forceApprove(address(VAULT), assets);
        shares = VAULT.deposit(assets, address(this));
        sharesOf[msg.sender] += shares;
    }

    function withdraw(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        shares = VAULT.previewWithdraw(assets);
        _debit(shares);
        uint256 burned = VAULT.withdraw(assets, msg.sender, address(this));
        // previewWithdraw is the upper bound by the standard; refund any rounding in our favour.
        if (burned < shares) {
            sharesOf[msg.sender] += shares - burned;
            shares = burned;
        }
    }

    function redeem(uint256 shares) external returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        _debit(shares);
        assets = VAULT.redeem(shares, msg.sender, address(this));
    }

    function _debit(uint256 shares) internal {
        uint256 held = sharesOf[msg.sender];
        if (shares > held) revert InsufficientShares(shares, held);
        sharesOf[msg.sender] = held - shares;
    }
}
