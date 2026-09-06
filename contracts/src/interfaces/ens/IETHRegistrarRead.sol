// SPDX-License-Identifier: MIT
// Read-side subset of ensdomains/namechain IETHRegistrar (2026-09-05). Spirith never registers;
// it only prices and renews. Full interface: contracts/src/registrar/interfaces/IETHRegistrar.sol.
pragma solidity >=0.8.13;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IETHRenewer} from "./IETHRenewer.sol";

interface IETHRegistrarRead is IETHRenewer {
    function isAvailable(string memory label) external view returns (bool);

    function getRegisterPrice(string calldata label, uint64 duration, IERC20 paymentToken)
        external
        view
        returns (uint256 base, uint256 premium);

    function rentPriceOracle() external view returns (address);

    function ETH_REGISTRY() external view returns (address);

    function BENEFICIARY() external view returns (address);
}
