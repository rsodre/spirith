// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Yield venue behind SpirithVault. Per-caller accounting: an adapter serves any
/// depositor and credits shares to `msg.sender`, so the vault needs no special trust from it
/// beyond the asset itself. Implementations: MockYieldAdapter (demo), ERC4626Adapter (real).
interface IYieldAdapter {
    /// @notice The underlying token (the vault's USDC).
    function asset() external view returns (IERC20);

    /// @notice Pull `assets` from `msg.sender` (needs allowance) and credit shares to them.
    function deposit(uint256 assets) external returns (uint256 shares);

    /// @notice Burn just enough of `msg.sender`'s shares to send them exactly `assets`.
    function withdraw(uint256 assets) external returns (uint256 shares);

    /// @notice Burn `shares` of `msg.sender` and send them the assets those shares are worth.
    function redeem(uint256 shares) external returns (uint256 assets);

    function sharesOf(address account) external view returns (uint256);

    function convertToAssets(uint256 shares) external view returns (uint256);

    function convertToShares(uint256 assets) external view returns (uint256);

    /// @notice Annual yield the vault may assume, as a range in basis points. A variable-rate
    /// venue reports a spread; only a contractually fixed rate reports low == high.
    function rateRangeBps() external view returns (uint16 low, uint16 high);
}
