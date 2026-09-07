// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Stand-in for ENS's Sepolia MockUSDC: permissionless mint, configurable decimals.
contract MockERC20 is ERC20 {
    uint8 private immutable _DECIMALS;

    constructor(string memory symbol, uint8 decimals_) ERC20(symbol, symbol) {
        _DECIMALS = decimals_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function decimals() public view override returns (uint8) {
        return _DECIMALS;
    }
}
