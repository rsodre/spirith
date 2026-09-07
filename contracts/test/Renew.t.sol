// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {MockYieldAdapter} from "../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {Runway} from "../src/libraries/Runway.sol";
import {MockERC20} from "./mocks/MockERC20.sol";
import {MockRegistrar} from "./mocks/MockRegistrar.sol";
import {MockResolver} from "./mocks/MockResolver.sol";

contract RenewTest is Test {
    uint64 internal constant Y = 365 days;
    uint256 internal constant P1 = 8_000_021;
    uint256 internal constant P2 = 14_000_037;
    uint256 internal constant P3 = 16_500_044;
    uint256 internal constant P6 = 27_000_071;

    MockERC20 internal usdc;
    MockRegistrar internal registrar;
    MockResolver internal resolver;
    MockYieldAdapter internal adapter;
    SpirithVault internal vault;

    address internal alice = makeAddr("alice");
    address internal keeper = makeAddr("keeper");
    string internal constant NAME = "spirithbeta";

    function setUp() public {
        usdc = new MockERC20("USDC", 6);
        registrar = new MockRegistrar();
        resolver = new MockResolver();
        adapter = new MockYieldAdapter(IMintableERC20(address(usdc)), 400);
        vault = new SpirithVault(
            IERC20(address(usdc)),
            IETHRegistrarRead(address(registrar)),
            IPermissionedRegistryRead(address(registrar)),
            adapter,
            address(0),
            100e6,
            2
        );
        vm.warp(1_800_000_000);
        registrar.register(NAME, uint64(block.timestamp) + 20 days, address(resolver));
        resolver.setAuthorized(address(vault), true);
        usdc.mint(alice, 1_000e6);
        vm.prank(alice);
        usdc.approve(address(vault), type(uint256).max);
    }

    function _endow(uint256 amount) internal {
        vm.prank(alice);
        vault.endow(NAME, amount);
    }

    // ------------------------------------------------------------------ pricing sanity

    function test_mockRegistrarMatchesLiveOraclePins() public view {
        assertEq(registrar.getRenewPrice(NAME, Y, IERC20(address(usdc))), P1);
        assertEq(registrar.getRenewPrice(NAME, 2 * Y, IERC20(address(usdc))), P2);
        assertEq(registrar.getRenewPrice(NAME, 3 * Y, IERC20(address(usdc))), P3);
        assertEq(registrar.getRenewPrice(NAME, 6 * Y, IERC20(address(usdc))), P6);
    }

    // ------------------------------------------------------------------ cadence

    function test_optimalDuration_prefersSixYearsWhenFloorSurvives() public {
        _endow(50e6); // 27.27 for 6y + 16 floor = 43.3 <= 50
        assertEq(vault.optimalDuration(NAME), 6 * Y);
    }

    function test_optimalDuration_stepsDownTheLadder() public {
        _endow(40e6); // 6y: 27.27+16 > 40; 3y: 16.67+16 = 32.7 <= 40
        assertEq(vault.optimalDuration(NAME), 3 * Y);
    }

    function test_optimalDuration_fallsBackToLongestAffordable() public {
        _endow(20e6); // nothing keeps the floor; 2y costs 14.14 <= 20; 3y 16.67 <= 20 -> 3y
        assertEq(vault.optimalDuration(NAME), 3 * Y);
    }

    function test_optimalDuration_revertsWhenUnfunded() public {
        _endow(5e6);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.Unfunded.selector, NAME, 5e6));
        vault.optimalDuration(NAME);
    }

    function test_tipIsOnePercentCappedAtOneUsdc() public view {
        assertEq(vault.tipFor(P1), 80_000);
        assertEq(vault.tipFor(P6), 270_000);
        assertEq(vault.tipFor(640_000_005), 1e6, "3-char names hit the cap");
    }

    // ------------------------------------------------------------------ renew

    function test_renew_paysRegistrar_tipsKeeper_extendsExpiry_writesRecord() public {
        _endow(50e6);
        uint64 expiryBefore = registrar.findExpiry(NAME);
        uint256 assetsBefore = vault.assetsOf(NAME);

        bytes32 h = vault.labelhash(NAME);
        vm.expectEmit(true, true, false, true);
        emit SpirithVault.Renewed(h, NAME, keeper, 6 * Y, expiryBefore + 6 * Y, P6, 270_000, true);
        vm.prank(keeper);
        (uint256 price, uint256 tip) = vault.renew(NAME, 6 * Y);

        assertEq(price, P6);
        assertEq(tip, 270_000);
        assertEq(usdc.balanceOf(registrar.BENEFICIARY()), P6, "registrar paid exactly the price");
        assertEq(usdc.balanceOf(keeper), tip, "keeper tipped");
        assertEq(registrar.findExpiry(NAME), expiryBefore + 6 * Y, "six years bought");
        assertApproxEqAbs(vault.assetsOf(NAME), assetsBefore - P6 - tip, 1, "paid from earmark");
        assertEq(usdc.allowance(address(vault), address(registrar)), 0, "no standing allowance");
        assertEq(resolver.text(vault.node(NAME), "spirith.patrons"), "1");
        assertGt(bytes(resolver.text(vault.node(NAME), "spirith.funded-until")).length, 0);
    }

    function test_renew_anyoneCanCall_notJustPatronOrOwner() public {
        _endow(50e6);
        address stranger = makeAddr("stranger");
        vm.prank(stranger);
        vault.renew(NAME, 6 * Y);
        assertEq(usdc.balanceOf(stranger), 270_000);
    }

    function test_renew_revertsBeforeLeadWindow() public {
        registrar.register(NAME, uint64(block.timestamp) + 40 days, address(resolver));
        _endow(50e6);
        vm.expectRevert(
            abi.encodeWithSelector(
                SpirithVault.NotDue.selector, NAME, uint64(block.timestamp) + 10 days
            )
        );
        vault.renew(NAME, 6 * Y);
        vm.warp(block.timestamp + 10 days);
        vault.renew(NAME, 6 * Y);
    }

    function test_renew_worksInsideGrace() public {
        _endow(50e6);
        vm.warp(registrar.findExpiry(NAME) + 27 days);
        assertTrue(registrar.isRenewable(NAME));
        vault.renew(NAME, 6 * Y);
    }

    function test_renew_revertsAfterGrace() public {
        _endow(50e6);
        vm.warp(registrar.findExpiry(NAME) + 28 days);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.NotRenewable.selector, NAME));
        vault.renew(NAME, 6 * Y);
    }

    function test_renew_rejectsAnyOtherDuration() public {
        _endow(50e6);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.WrongDuration.selector, 6 * Y, Y));
        vault.renew(NAME, Y);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.WrongDuration.selector, 6 * Y, 7 * Y));
        vault.renew(NAME, 7 * Y);
    }

    function test_renew_revertsWhenUnfunded() public {
        _endow(5e6);
        vm.expectRevert(abi.encodeWithSelector(SpirithVault.Unfunded.selector, NAME, 5e6));
        vault.renew(NAME, Y);
    }

    function test_renew_secondRenewalWaitsForNextLeadWindow() public {
        _endow(90e6);
        vault.renew(NAME, 6 * Y);
        vm.expectRevert();
        vault.renew(NAME, 6 * Y);
        vm.warp(registrar.findExpiry(NAME) - 30 days);
        vault.renew(NAME, vault.optimalDuration(NAME));
    }

    function test_renew_drawsFromAdapterWhenReserveIsShort() public {
        _endow(50e6); // reserve 16, adapter 34; 6y costs 27.27
        uint256 adapterBefore = usdc.balanceOf(address(adapter));
        vault.renew(NAME, 6 * Y);
        (uint256 reserve,,,) = vault.endowments(vault.labelhash(NAME));
        assertEq(reserve, 0, "reserve drained first");
        assertLt(usdc.balanceOf(address(adapter)), adapterBefore, "adapter covered the rest");
    }

    function test_renew_worksWhenPaused() public {
        _endow(50e6);
        vault.pause();
        vault.renew(NAME, 6 * Y);
    }

    // ------------------------------------------------------------------ record

    function test_record_isBestEffort_unauthorisedResolverDoesNotBlockRenewal() public {
        resolver.setAuthorized(address(vault), false);
        _endow(50e6);
        bytes32 h = vault.labelhash(NAME);
        uint64 newExpiry = registrar.findExpiry(NAME) + 6 * Y;
        vm.expectEmit(true, true, false, true);
        emit SpirithVault.Renewed(h, NAME, keeper, 6 * Y, newExpiry, P6, 270_000, false);
        vm.prank(keeper);
        vault.renew(NAME, 6 * Y);
    }

    function test_record_gasBurningResolverCannotBlockRenewal() public {
        resolver.setBurnAllGas(true);
        _endow(50e6);
        uint256 gasBefore = gasleft();
        vault.renew(NAME, 6 * Y);
        assertLt(gasBefore - gasleft(), 1_500_000, "stipend bounded the damage");
    }

    function test_record_noResolverIsFine() public {
        registrar.register(NAME, uint64(block.timestamp) + 20 days, address(0));
        _endow(50e6);
        vault.renew(NAME, 6 * Y);
    }

    function test_record_writtenOnEndowAndWithdraw() public {
        _endow(50e6);
        assertEq(resolver.text(vault.node(NAME), "spirith.patrons"), "1");
        vm.prank(alice);
        vault.requestWithdraw(NAME, 50e6);
        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        vault.executeWithdraw(NAME);
        assertEq(resolver.text(vault.node(NAME), "spirith.patrons"), "0");
    }

    // ------------------------------------------------------------------ runway

    function test_runway_isARange_andPerpetualAtTheHeadlineNumber() public {
        _endow(50e6);
        (uint64 low, uint64 high, uint256 assets, uint64 duration) = vault.runwayOf(NAME);
        uint64 expiry = registrar.findExpiry(NAME);
        assertEq(duration, 6 * Y);
        assertEq(assets, 50e6);
        assertGt(low, expiry + 6 * Y, "more than one block covered");
        assertEq(low, high, "mock adapter reports a fixed rate");
        assertLt(low, expiry + 500 * Y, "$50 at 4% is not perpetual");
    }

    function test_runway_unfundedReturnsExpiry() public {
        _endow(5e6);
        (uint64 low, uint64 high, uint256 assets, uint64 duration) = vault.runwayOf(NAME);
        assertEq(low, registrar.findExpiry(NAME));
        assertEq(high, low);
        assertEq(assets, 5e6);
        assertEq(duration, 0);
    }

    /// Pins the Solidity projection to the TypeScript one (packages/core/test/runway.test.ts).
    function test_runwayLibrary_matchesCorePins() public pure {
        // Same inputs as the TypeScript pins (no tip), so the two implementations are compared.
        assertEq(Runway.coveredYears(129_000_000, P6, 6, 400), Runway.HORIZON_YEARS);
        assertLt(Runway.coveredYears(128_000_000, P6, 6, 400), Runway.HORIZON_YEARS);
        assertLt(Runway.coveredYears(112_500_000, P6, 6, 400), Runway.HORIZON_YEARS);
        assertEq(Runway.coveredYears(50_000_000, P1, 1, 200), 6);
    }
}
