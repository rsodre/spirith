// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {IRentPriceOracleRead} from "../src/interfaces/ens/IRentPriceOracleRead.sol";
import {SepoliaConfig as C} from "../script/Config.s.sol";

/// @notice Smoke test of the vendored interfaces against the live ENSv2 Sepolia beta.
/// Runs only when SEPOLIA_RPC_URL is set: `forge test --match-contract SepoliaFork`.
contract SepoliaForkTest is Test {
    IETHRegistrarRead internal registrar = IETHRegistrarRead(C.ETH_REGISTRAR);
    IPermissionedRegistryRead internal registry = IPermissionedRegistryRead(C.ETH_REGISTRY);
    IRentPriceOracleRead internal oracle = IRentPriceOracleRead(C.RENT_PRICE_ORACLE);

    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
    }

    function test_registrarWiring() public view {
        if (!forked) return;
        assertEq(registrar.ETH_REGISTRY(), C.ETH_REGISTRY, "registry");
        assertEq(registrar.rentPriceOracle(), C.RENT_PRICE_ORACLE, "oracle");
        assertEq(registrar.BENEFICIARY(), C.PAYMENT_BENEFICIARY, "beneficiary");
        assertEq(registrar.GRACE_PERIOD(), 28 days, "grace");
    }

    function test_paymentTokens() public view {
        if (!forked) return;
        assertTrue(oracle.isPaymentToken(IERC20(C.MOCK_USDC)), "mock usdc");
        assertTrue(oracle.isPaymentToken(IERC20(C.CIRCLE_USDC)), "circle usdc");
    }

    function test_discountPointsMatchSpec() public view {
        if (!forked) return;
        IRentPriceOracleRead.DiscountPoint[] memory pts = oracle.getDiscountPoints();
        uint128 den = oracle.DISCOUNT_DENOMINATOR();
        assertEq(pts.length, 3);
        assertEq(pts[0].duration, 2 * C.ONE_YEAR);
        assertEq(pts[1].duration, 3 * C.ONE_YEAR);
        assertEq(pts[2].duration, 6 * C.ONE_YEAR);
        assertEq(uint256(pts[0].numer) * 1000 / den, 875);
        assertEq(uint256(pts[1].numer) * 10000 / den, 6875);
        assertEq(uint256(pts[2].numer) * 10000 / den, 5625);
    }

    function test_renewPriceOfARegisteredName() public view {
        if (!forked) return;
        // Registered on the beta during the week of 2026-09-05 (observed in NameRegistered logs).
        string memory label = "chemokinesis";
        IPermissionedRegistryRead.State memory st =
            registry.getState(uint256(keccak256(bytes(label))));
        if (st.status != IPermissionedRegistryRead.Status.REGISTERED) return; // expired since
        assertTrue(registrar.isRenewable(label));
        assertEq(registrar.getRenewPrice(label, C.ONE_YEAR, IERC20(C.MOCK_USDC)), 8_000_021);
        assertEq(registrar.getRenewPrice(label, 6 * C.ONE_YEAR, IERC20(C.MOCK_USDC)), 27_000_071);
    }

    function test_premigratedV1NameIsReservedNotRenewable() public view {
        if (!forked) return;
        IPermissionedRegistryRead.State memory st = registry.getState(uint256(keccak256("vitalik")));
        assertEq(uint8(st.status), uint8(IPermissionedRegistryRead.Status.RESERVED));
        assertFalse(registrar.isRenewable("vitalik"));
    }
}
