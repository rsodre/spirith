// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {MockYieldAdapter} from "../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockRegistrar} from "./mocks/MockRegistrar.sol";

contract SpirithVaultTest is Test {
    uint256 internal constant CAP = 100e6;
    uint256 internal constant RESERVE_YEARS = 2;
    uint256 internal constant PRICE_1Y = 8_000_021;
    uint256 internal constant RESERVE_TARGET = RESERVE_YEARS * PRICE_1Y;
    uint16 internal constant RATE_BPS = 400;

    MockERC20 internal usdc;
    MockRegistrar internal registrar;
    MockYieldAdapter internal adapter;
    SpirithVault internal vault;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal keeper = makeAddr("keeper");

    string internal constant NAME = "spirithalpha";
    string internal constant OTHER = "spirithbeta";

    function setUp() public {
        usdc = new MockERC20("USDC", 6);
        registrar = new MockRegistrar();
        adapter = new MockYieldAdapter(IMintableERC20(address(usdc)), RATE_BPS);
        vault = new SpirithVault(
            IERC20(address(usdc)),
            IETHRegistrarRead(address(registrar)),
            adapter,
            owner,
            CAP,
            RESERVE_YEARS
        );
        registrar.setRenewable(NAME, true);
        registrar.setRenewable(OTHER, true);
        _fund(alice, 1_000e6);
        _fund(bob, 1_000e6);
    }

    function _fund(address who, uint256 amount) internal {
        usdc.mint(who, amount);
        vm.prank(who);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _endow(address who, string memory label, uint256 amount) internal returns (uint256) {
        vm.prank(who);
        return vault.endow(label, amount);
    }

    function _withdrawAll(address who, string memory label) internal returns (uint256) {
        (uint256 shares,,) = vault.positions(keccak256(bytes(label)), who);
        vm.prank(who);
        vault.requestWithdraw(label, shares);
        vm.warp(block.timestamp + vault.NOTICE_PERIOD());
        vm.prank(who);
        return vault.executeWithdraw(label);
    }

    // ------------------------------------------------------------------ endow

    function test_endow_firstDepositMintsOneShare_perUnit_andSplitsReserve() public {
        uint256 shares = _endow(alice, NAME, 50e6);
        assertEq(shares, 50e6, "1:1 shares on first deposit");
        (uint256 reserve, uint256 adapterShares, uint256 totalShares) =
            vault.endowments(keccak256(bytes(NAME)));
        assertEq(reserve, RESERVE_TARGET, "reserve topped to target");
        assertEq(totalShares, 50e6);
        assertGt(adapterShares, 0, "excess deployed");
        assertEq(usdc.balanceOf(address(vault)), RESERVE_TARGET, "vault holds only the reserve");
        assertEq(usdc.balanceOf(address(adapter)), 50e6 - RESERVE_TARGET, "adapter holds excess");
        assertApproxEqAbs(vault.assetsOf(NAME), 50e6, 1);
        assertEq(usdc.allowance(address(vault), address(adapter)), 0, "no standing allowance");
    }

    function test_endow_belowReserveTargetStaysLiquid() public {
        _endow(alice, NAME, 10e6);
        (uint256 reserve, uint256 adapterShares,) = vault.endowments(keccak256(bytes(NAME)));
        assertEq(reserve, 10e6);
        assertEq(adapterShares, 0);
    }

    function test_endow_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit SpirithVault.Endowed(keccak256(bytes(NAME)), NAME, alice, 20e6, 20e6);
        _endow(alice, NAME, 20e6);
    }

    function test_endow_revertsWhenPaused_butWithdrawStillWorks() public {
        _endow(alice, NAME, 20e6);
        vm.prank(owner);
        vault.pause();
        vm.expectRevert(Pausable.EnforcedPause.selector);
        _endow(alice, NAME, 1e6);
        uint256 out = _withdrawAll(alice, NAME);
        assertGe(out, 20e6, "pause never blocks a withdrawal");
    }

    function test_endow_revertsOnZero() public {
        vm.expectRevert(SpirithVault.ZeroAmount.selector);
        _endow(alice, NAME, 0);
    }

    function test_endow_revertsWhenNameNotRenewable() public {
        registrar.setRenewable(NAME, false);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.NotRenewable.selector, NAME));
        _endow(alice, NAME, 1e6);
    }

    function test_endow_revertsAboveCap() public {
        _endow(alice, NAME, 60e6);
        vm.expectRevert(
            abi.encodeWithSelector(SpirithVault.DepositCapExceeded.selector, 101e6, CAP)
        );
        _endow(bob, NAME, 41e6);
        _endow(bob, NAME, 40e6);
    }

    function test_endow_capCountsAccruedYield() public {
        _endow(alice, NAME, 100e6);
        vm.warp(block.timestamp + 365 days);
        assertGt(vault.assetsOf(NAME), 100e6);
        vm.expectRevert();
        _endow(bob, NAME, 1);
    }

    // ------------------------------------------------------------- multi-patron

    function test_secondPatronAfterYieldGetsFewerShares_andProRataValue() public {
        _endow(alice, NAME, 40e6);
        vm.warp(block.timestamp + 365 days);
        uint256 bobShares = _endow(bob, NAME, 40e6);
        assertLt(bobShares, 40e6, "bob buys in at a higher share price");
        uint256 aliceValue = vault.patronAssets(NAME, alice);
        uint256 bobValue = vault.patronAssets(NAME, bob);
        assertGt(aliceValue, bobValue, "alice earned a year of yield, bob none");
        assertApproxEqAbs(bobValue, 40e6, 2, "bob's value is what he put in");
    }

    function test_perNameIsolation_withdrawFromOneNameCannotTouchAnother() public {
        _endow(alice, NAME, 40e6);
        _endow(bob, OTHER, 40e6);
        uint256 otherBefore = vault.assetsOf(OTHER);
        uint256 out = _withdrawAll(alice, NAME);
        assertGe(out, 40e6, "alice gets her principal plus a month of yield");
        assertGe(vault.assetsOf(OTHER), otherBefore, "other name untouched, still accruing");
        assertEq(vault.assetsOf(NAME), 0, "last patron out takes the dust");
    }

    // ---------------------------------------------------------------- withdraw

    function test_requestWithdraw_revertsOnZeroOrTooMany() public {
        _endow(alice, NAME, 10e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.InvalidShares.selector, 0, 10e6));
        vault.requestWithdraw(NAME, 0);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.InvalidShares.selector, 10e6 + 1, 10e6));
        vault.requestWithdraw(NAME, 10e6 + 1);
    }

    function test_executeWithdraw_requiresNoticeAndWaitsFullPeriod() public {
        _endow(alice, NAME, 10e6);
        vm.prank(alice);
        vm.expectRevert(SpirithVault.NoNotice.selector);
        vault.executeWithdraw(NAME);

        vm.prank(alice);
        vault.requestWithdraw(NAME, 10e6);
        uint64 readyAt = uint64(block.timestamp) + vault.NOTICE_PERIOD();
        vm.warp(readyAt - 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.NoticePending.selector, readyAt));
        vault.executeWithdraw(NAME);

        vm.warp(readyAt);
        vm.prank(alice);
        uint256 out = vault.executeWithdraw(NAME);
        assertApproxEqAbs(out, 10e6, 1);
        assertApproxEqAbs(usdc.balanceOf(alice), 1_000e6, 1);
    }

    function test_requestWithdraw_againResetsClock() public {
        _endow(alice, NAME, 10e6);
        vm.prank(alice);
        vault.requestWithdraw(NAME, 10e6);
        vm.warp(block.timestamp + 20 days);
        vm.prank(alice);
        vault.requestWithdraw(NAME, 5e6);
        vm.warp(block.timestamp + 10 days);
        vm.prank(alice);
        vm.expectRevert();
        vault.executeWithdraw(NAME);
        vm.warp(block.timestamp + 20 days);
        vm.prank(alice);
        uint256 out = vault.executeWithdraw(NAME);
        assertApproxEqAbs(out, 5e6, 1, "partial withdraw of the re-requested amount");
        assertApproxEqAbs(vault.patronAssets(NAME, alice), 5e6, 1);
    }

    function test_withdraw_paysReserveFirstThenAdapter() public {
        _endow(alice, NAME, 50e6);
        vm.prank(alice);
        vault.requestWithdraw(NAME, 50e6);
        vm.warp(block.timestamp + 30 days);
        uint256 adapterBefore = usdc.balanceOf(address(adapter));
        vm.prank(alice);
        uint256 out = vault.executeWithdraw(NAME);
        assertGt(out, 50e6, "a month of yield came along");
        assertEq(usdc.balanceOf(address(vault)), 0, "reserve fully used");
        assertLt(usdc.balanceOf(address(adapter)), adapterBefore, "adapter covered the rest");
        (uint256 reserve, uint256 adapterShares, uint256 totalShares) =
            vault.endowments(keccak256(bytes(NAME)));
        assertEq(reserve, 0);
        assertEq(adapterShares, 0);
        assertEq(totalShares, 0);
    }

    function test_withdraw_withinReserveLeavesAdapterAlone() public {
        _endow(alice, NAME, 50e6);
        vm.prank(alice);
        vault.requestWithdraw(NAME, 5e6);
        vm.warp(block.timestamp + 30 days);
        uint256 adapterBefore = usdc.balanceOf(address(adapter));
        vm.prank(alice);
        vault.executeWithdraw(NAME);
        assertEq(usdc.balanceOf(address(adapter)), adapterBefore);
    }

    function test_withdraw_onlyOwnShares() public {
        _endow(alice, NAME, 10e6);
        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.InvalidShares.selector, 1, 0));
        vault.requestWithdraw(NAME, 1);
    }

    // ------------------------------------------------------------------- owner

    function test_owner_onlyOwnerCanPause_andRenouncingLiftsPause() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        vault.pause();

        vm.prank(owner);
        vault.pause();
        assertTrue(vault.paused());

        vm.prank(owner);
        vault.renounceOwnership();
        assertEq(vault.owner(), address(0));
        assertFalse(vault.paused(), "renouncing lifts the pause");

        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, owner));
        vault.pause();
    }

    function test_constructor_zeroOwnerMeansDeployer() public {
        vm.prank(alice);
        SpirithVault v = new SpirithVault(
            IERC20(address(usdc)),
            IETHRegistrarRead(address(registrar)),
            adapter,
            address(0),
            CAP,
            RESERVE_YEARS
        );
        assertEq(v.owner(), alice);
    }

    function test_owner_transferIsTwoStep() public {
        vm.prank(owner);
        vault.transferOwnership(bob);
        assertEq(vault.owner(), owner, "not transferred until accepted");
        vm.prank(bob);
        vault.acceptOwnership();
        assertEq(vault.owner(), bob);
        vm.prank(bob);
        vault.pause();
        assertTrue(vault.paused());
    }

    // -------------------------------------------------------------------- fuzz

    function testFuzz_shareMath_neverPaysMoreThanProRata(uint96 a, uint96 b, uint32 elapsed)
        public
    {
        // Two deposits plus five years of yield must stay under the 100 USDC cap.
        uint256 amountA = bound(uint256(a), 1e6, 40e6);
        uint256 amountB = bound(uint256(b), 1e6, 40e6);
        elapsed = uint32(bound(uint256(elapsed), 0, 5 * 365 days));

        _endow(alice, NAME, amountA);
        vm.warp(block.timestamp + elapsed);
        _endow(bob, NAME, amountB);
        vm.warp(block.timestamp + elapsed);

        uint256 outA = _withdrawAll(alice, NAME);
        uint256 outB = _withdrawAll(bob, NAME);

        assertLe(
            outA + outB,
            amountA + amountB + adapter.totalYieldMinted(),
            "cannot withdraw more than principal plus minted yield"
        );
        assertGe(outB + 2, amountB, "bob never loses principal to alice");
        assertGe(outA + 2, amountA, "alice never loses principal to bob");
        assertEq(vault.assetsOf(NAME), 0, "last patron out takes the dust");
    }

    function testFuzz_endowThenWithdraw_roundTripsWithinDust(uint96 amount, uint32 elapsed) public {
        uint256 amt = bound(uint256(amount), 1, CAP);
        elapsed = uint32(bound(uint256(elapsed), 0, 365 days));
        _endow(alice, NAME, amt);
        vm.warp(block.timestamp + elapsed);
        uint256 out = _withdrawAll(alice, NAME);
        uint256 accruing = uint256(elapsed) + vault.NOTICE_PERIOD();
        assertGe(out + 1, amt, "principal returned");
        assertLe(out, amt + amt * RATE_BPS * accruing / (10_000 * 365 days) + 1, "no phantom yield");
    }
}
