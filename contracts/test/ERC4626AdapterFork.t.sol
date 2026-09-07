// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test, console} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {ERC4626Adapter} from "../src/adapters/ERC4626Adapter.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {MockRegistrar} from "./mocks/MockRegistrar.sol";

/// @notice Real yield, real chain: SpirithVault over Aave v3's ERC-4626 USDC token on an
/// Ethereum mainnet fork. A year passes, the earmark grows, and a renewal is paid from it.
/// The registrar is the mock because ENSv2 is not on mainnet. Runs only with MAINNET_RPC_URL.
contract ERC4626AdapterForkTest is Test {
    // bgd-labs address book, AaveV3EthereumAssets (spec §4.2).
    IERC20 internal constant USDC = IERC20(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    IERC4626 internal constant WA_ETH_USDC = IERC4626(0xD4fa2D31b7968E448877f69A96DE69f5de8cD23E);
    string internal constant LABEL = "spirithbeta";

    MockRegistrar internal registrar;
    ERC4626Adapter internal adapter;
    SpirithVault internal vault;
    address internal patron = makeAddr("patron");
    address internal keeper = makeAddr("keeper");
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("MAINNET_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
        assertEq(WA_ETH_USDC.asset(), address(USDC), "wrong ERC-4626 target");

        registrar = new MockRegistrar();
        adapter = new ERC4626Adapter(WA_ETH_USDC, 300, 500);
        vault = new SpirithVault(
            USDC,
            IETHRegistrarRead(address(registrar)),
            IPermissionedRegistryRead(address(registrar)),
            adapter,
            address(0),
            100e6,
            2
        );
        // Due 20 days after the one-year warp in the renewal test; still inside grace for the other.
        registrar.register(LABEL, uint64(block.timestamp) + 365 days + 20 days, address(0));
        deal(address(USDC), patron, 100e6);
        vm.prank(patron);
        USDC.approve(address(vault), type(uint256).max);
    }

    function test_fork_realYieldPaysARealRenewal() public {
        if (!forked) return;

        vm.prank(patron);
        vault.endow(LABEL, 50e6);
        (uint256 reserve, uint256 adapterShares,,) = vault.endowments(vault.labelhash(LABEL));
        assertEq(reserve, 16_000_042, "two years of renewals stay liquid");
        assertGt(adapterShares, 0, "excess is in Aave");
        assertEq(WA_ETH_USDC.balanceOf(address(adapter)), adapterShares, "adapter holds the shares");
        uint256 assetsAtStart = vault.assetsOf(LABEL);
        assertApproxEqAbs(assetsAtStart, 50e6, 2);

        vm.warp(block.timestamp + 365 days);
        vm.roll(block.number + 2_628_000);

        uint256 assetsAfterYear = vault.assetsOf(LABEL);
        uint256 yield = assetsAfterYear - assetsAtStart;
        console.log("earmarked at start (USDC, 6 dec):", assetsAtStart);
        console.log("earmarked after a year:         ", assetsAfterYear);
        console.log("real Aave yield on ~34 USDC:    ", yield);
        assertGt(yield, 0, "Aave accrued interest over the year");
        assertLt(yield, 5e6, "sanity: under 15% on the deployed 34 USDC");

        uint64 duration = vault.optimalDuration(LABEL);
        assertEq(duration, 6 * 365 days);
        uint64 expiryBefore = registrar.findExpiry(LABEL);
        vm.prank(keeper);
        (uint256 price, uint256 tip) = vault.renew(LABEL, duration);
        console.log("renewal paid from the earmark:  ", price);
        console.log("keeper tip:                     ", tip);

        assertEq(price, 27_000_071);
        assertEq(USDC.balanceOf(registrar.BENEFICIARY()), price, "registrar paid in real USDC");
        assertEq(USDC.balanceOf(keeper), tip);
        assertEq(registrar.findExpiry(LABEL), expiryBefore + duration);
        assertApproxEqAbs(vault.assetsOf(LABEL), assetsAfterYear - price - tip, 2);
        assertEq(USDC.allowance(address(vault), address(adapter)), 0);
        assertEq(USDC.allowance(address(adapter), address(WA_ETH_USDC)), 0);
    }

    function test_fork_patronWithdrawsPrincipalPlusYield() public {
        if (!forked) return;
        vm.prank(patron);
        vault.endow(LABEL, 50e6);
        vm.prank(patron);
        vault.requestWithdraw(LABEL, 50e6);
        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 216_000);
        vm.prank(patron);
        uint256 out = vault.executeWithdraw(LABEL);
        assertGt(out, 50e6, "a month of Aave yield came back with the principal");
        assertEq(vault.assetsOf(LABEL), 0);
        assertEq(WA_ETH_USDC.balanceOf(address(adapter)), 0, "nothing stranded in the adapter");
    }
}
