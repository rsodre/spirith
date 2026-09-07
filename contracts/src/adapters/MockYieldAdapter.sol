// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

import {IMintableERC20} from "../interfaces/ens/IMintableERC20.sol";
import {IYieldAdapter} from "./IYieldAdapter.sol";

/// @notice Deterministic yield for the demo: simple interest at a fixed rate, realised by
/// minting the asset to itself (ENS's Sepolia MockUSDC has a permissionless mint). Testnet
/// yield is theatre by construction; the UI says so. Never deploy against a real token.
contract MockYieldAdapter is IYieldAdapter {
    using SafeERC20 for IERC20;
    using Math for uint256;

    IMintableERC20 public immutable ASSET;
    uint16 public immutable RATE_BPS;

    uint256 public totalShares;
    uint256 public totalAssets;
    uint64 public lastAccrual;
    /// @notice Sum of all interest ever minted; lets tests reconcile token conservation.
    uint256 public totalYieldMinted;

    mapping(address account => uint256) public sharesOf;

    event Accrued(uint256 interest);

    error ZeroAmount();
    error InsufficientShares(uint256 requested, uint256 available);

    constructor(IMintableERC20 asset_, uint16 rateBps) {
        ASSET = asset_;
        RATE_BPS = rateBps;
        lastAccrual = uint64(block.timestamp);
    }

    function asset() external view returns (IERC20) {
        return ASSET;
    }

    function rateRangeBps() external view returns (uint16, uint16) {
        return (RATE_BPS, RATE_BPS);
    }

    /// @notice Interest owed since the last accrual, not yet minted.
    function pendingInterest() public view returns (uint256) {
        uint256 elapsed = block.timestamp - lastAccrual;
        return totalAssets.mulDiv(RATE_BPS * elapsed, 10_000 * 365 days);
    }

    function accrue() public {
        uint256 interest = pendingInterest();
        lastAccrual = uint64(block.timestamp);
        if (interest == 0) return;
        ASSET.mint(address(this), interest);
        totalAssets += interest;
        totalYieldMinted += interest;
        emit Accrued(interest);
    }

    function convertToAssets(uint256 shares) public view returns (uint256) {
        return shares.mulDiv(totalAssets + pendingInterest() + 1, totalShares + 1);
    }

    function convertToShares(uint256 assets) public view returns (uint256) {
        return assets.mulDiv(totalShares + 1, totalAssets + pendingInterest() + 1);
    }

    function deposit(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        accrue();
        shares = convertToShares(assets);
        IERC20(address(ASSET)).safeTransferFrom(msg.sender, address(this), assets);
        totalAssets += assets;
        totalShares += shares;
        sharesOf[msg.sender] += shares;
    }

    function withdraw(uint256 assets) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAmount();
        accrue();
        shares = assets.mulDiv(totalShares + 1, totalAssets + 1, Math.Rounding.Ceil);
        _burnAndPay(shares, assets);
    }

    function redeem(uint256 shares) external returns (uint256 assets) {
        if (shares == 0) revert ZeroAmount();
        accrue();
        assets = convertToAssets(shares);
        _burnAndPay(shares, assets);
    }

    function _burnAndPay(uint256 shares, uint256 assets) internal {
        uint256 held = sharesOf[msg.sender];
        if (shares > held) revert InsufficientShares(shares, held);
        sharesOf[msg.sender] = held - shares;
        totalShares -= shares;
        totalAssets -= assets;
        IERC20(address(ASSET)).safeTransfer(msg.sender, assets);
    }
}
