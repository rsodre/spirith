// SPDX-License-Identifier: MIT
// ENS Sepolia MockUSDC/MockDAI (ensdomains/namechain test/mocks/MockERC20.sol): permissionless mint.
pragma solidity >=0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMintableERC20 is IERC20 {
    function mint(address to, uint256 amount) external;

    function decimals() external view returns (uint8);
}
