// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC165Checker} from "@openzeppelin/contracts/utils/introspection/ERC165Checker.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {MockYieldAdapter} from "../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {Config, EnsConfig} from "../script/Config.s.sol";
import {ResolverSetup} from "../script/ResolverSetup.s.sol";

interface IRegistryWrite {
    function findTokenId(string calldata label) external view returns (uint256);
    function setResolver(uint256 anyId, address resolver) external;
}

/// @notice The whole Phase 2 demo against the live ENSv2 set of SPIRITH_ENV on a fork: deploy the
/// vault, give the test name its own PermissionedResolver, endow it, renew it from a stranger,
/// and read the liveness record back. Runs only with SEPOLIA_RPC_URL set.
contract RenewForkTest is Test {
    // Registered by the Phase 0 deployer key; expiry 2026-10-04, inside the 30-day lead.
    string internal constant LABEL = "spirithbeta";
    /// @dev IETHRenewer with the struct renew, as the interface documents its selector.
    bytes4 internal constant RENEWER_ID = 0x37e6a567;
    address internal constant NAME_OWNER = 0x62d48EA396a8BD7A5627BbAB5969DD45DB2b42c4;

    EnsConfig internal C;
    IMintableERC20 internal usdc;
    IETHRegistrarRead internal registrar;
    IPermissionedRegistryRead internal registry;
    SpirithVault internal vault;
    address internal patron = makeAddr("patron");
    address internal keeper = makeAddr("keeper");
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        C = Config.load(vm);
        // The beta registrar still has the older renew(string,uint64,address,bytes32); the vault
        // at deployments/sepolia.json was built for it. New vault code targets the struct renew
        // (spec §2), so the demo path is only proven where the registrar speaks it.
        if (!ERC165Checker.supportsERC165InterfaceUnchecked(C.ethRegistrar, RENEWER_ID)) return;
        forked = true;
        usdc = IMintableERC20(C.mockUsdc);
        registrar = IETHRegistrarRead(C.ethRegistrar);
        registry = IPermissionedRegistryRead(C.ethRegistry);
        MockYieldAdapter adapter = new MockYieldAdapter(usdc, 400);
        vault = new SpirithVault(
            IERC20(address(usdc)), registrar, registry, adapter, address(0), 100e6, 2
        );
        usdc.mint(patron, 100e6);
        vm.prank(patron);
        usdc.approve(address(vault), type(uint256).max);
    }

    /// @dev The live name may have been renewed already (it was, in Phase 2); move the fork's
    /// clock to one day before it is due so the vault's trigger holds.
    function _warpIntoLeadWindow() internal {
        uint64 expiry = registry.findExpiry(LABEL);
        uint64 lead = vault.RENEW_LEAD();
        if (expiry > block.timestamp + lead) vm.warp(expiry - lead + 1 days);
    }

    function _dnsName() internal pure returns (bytes memory) {
        return abi.encodePacked(uint8(bytes(LABEL).length), LABEL, uint8(3), "eth", uint8(0));
    }

    function _giveNameAPermissionedResolver() internal returns (address resolver) {
        vm.startPrank(NAME_OWNER);
        resolver = ResolverSetup.deploy(
            C.verifiableFactory,
            C.permissionedResolverImpl,
            uint256(keccak256("spirith-fork")),
            NAME_OWNER
        );
        IRegistryWrite(C.ethRegistry)
            .setResolver(IRegistryWrite(C.ethRegistry).findTokenId(LABEL), resolver);
        ResolverSetup.authorizeText(resolver, _dnsName(), "spirith.funded-until", address(vault));
        ResolverSetup.authorizeText(resolver, _dnsName(), "spirith.patrons", address(vault));
        vm.stopPrank();
    }

    function _text(address resolver, string memory key) internal view returns (string memory) {
        return ResolverSetup.readText(resolver, _dnsName(), vault.node(LABEL), key);
    }

    function test_fork_fullDemoPath() public {
        if (!forked) return;
        if (!registrar.isRenewable(LABEL)) return; // name lapsed since; nothing to prove here
        address resolver = _giveNameAPermissionedResolver();
        assertEq(registry.getResolver(LABEL), resolver);

        vm.prank(patron);
        vault.endow(LABEL, 50e6);
        assertEq(_text(resolver, "spirith.patrons"), "1");

        _warpIntoLeadWindow();
        uint64 expiryBefore = registry.findExpiry(LABEL);
        uint64 duration = vault.optimalDuration(LABEL);
        assertEq(duration, 6 * 365 days, "$50 buys the six-year block");
        uint256 beneficiaryBefore = usdc.balanceOf(C.paymentBeneficiary);

        vm.prank(keeper);
        (uint256 price, uint256 tip) = vault.renew(LABEL, duration);

        assertEq(price, 27_000_071, "live oracle price for 6y, 5+ chars");
        assertEq(usdc.balanceOf(C.paymentBeneficiary) - beneficiaryBefore, price);
        assertEq(usdc.balanceOf(keeper), tip);
        assertEq(registry.findExpiry(LABEL), expiryBefore + duration);
        string memory until = _text(resolver, "spirith.funded-until");
        assertGt(bytes(until).length, 0, "liveness record written on the name");
        (uint64 low,,,) = vault.runwayOf(LABEL);
        assertEq(until, vm.toString(low));
    }

    function test_fork_renewWithoutRecordAuthorisationStillRenews() public {
        if (!forked) return;
        if (!registrar.isRenewable(LABEL)) return;
        vm.prank(patron);
        vault.endow(LABEL, 50e6);
        _warpIntoLeadWindow();
        uint64 expiryBefore = registry.findExpiry(LABEL);
        vm.prank(keeper);
        vault.renew(LABEL, vault.optimalDuration(LABEL));
        assertGt(registry.findExpiry(LABEL), expiryBefore);
    }
}
