// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SpirithVault} from "../src/SpirithVault.sol";
import {MockYieldAdapter} from "../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {ITextResolver} from "../src/interfaces/ens/ITextResolver.sol";
import {SepoliaConfig as C} from "../script/Config.s.sol";

interface IVerifiableFactory {
    function deployProxy(address implementation, uint256 salt, bytes calldata data)
        external
        returns (address);
}

interface IResolverInit {
    function initialize(address admin, uint256 roleBitmap, bytes[] calldata setters) external;
}

interface IRegistryWrite {
    function findTokenId(string calldata label) external view returns (uint256);
    function setResolver(uint256 anyId, address resolver) external;
}

/// @notice The whole Phase 2 demo against the live ENSv2 Sepolia beta on a fork: deploy the
/// vault, give the test name its own PermissionedResolver, endow it, renew it from a stranger,
/// and read the liveness record back. Runs only with SEPOLIA_RPC_URL set.
contract RenewForkTest is Test {
    // Registered by the Phase 0 deployer key; expiry 2026-10-04, inside the 30-day lead.
    string internal constant LABEL = "spirithbeta";
    address internal constant NAME_OWNER = 0x62d48EA396a8BD7A5627BbAB5969DD45DB2b42c4;
    uint256 internal constant REGULAR_ROLES = (1 << 0) | (1 << 4) | (1 << 8) | (1 << 12) | (1 << 16)
        | (1 << 20) | (1 << 24) | (1 << 28) | (1 << 32) | (1 << 36) | (1 << 120) | (1 << 124);

    IMintableERC20 internal usdc = IMintableERC20(C.MOCK_USDC);
    IETHRegistrarRead internal registrar = IETHRegistrarRead(C.ETH_REGISTRAR);
    IPermissionedRegistryRead internal registry = IPermissionedRegistryRead(C.ETH_REGISTRY);
    SpirithVault internal vault;
    address internal patron = makeAddr("patron");
    address internal keeper = makeAddr("keeper");
    bool internal forked;

    function setUp() public {
        string memory rpc = vm.envOr("SEPOLIA_RPC_URL", string(""));
        if (bytes(rpc).length == 0) return;
        vm.createSelectFork(rpc);
        forked = true;
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

    function _giveNameAPermissionedResolver() internal returns (address resolver) {
        bytes memory init = abi.encodeCall(
            IResolverInit.initialize,
            (NAME_OWNER, REGULAR_ROLES | (REGULAR_ROLES << 128), new bytes[](0))
        );
        vm.startPrank(NAME_OWNER);
        resolver = IVerifiableFactory(C.VERIFIABLE_FACTORY)
            .deployProxy(C.PERMISSIONED_RESOLVER_IMPL, uint256(keccak256("spirith-fork")), init);
        IRegistryWrite(C.ETH_REGISTRY)
            .setResolver(IRegistryWrite(C.ETH_REGISTRY).findTokenId(LABEL), resolver);
        bytes memory name = abi.encodePacked(uint8(11), LABEL, uint8(3), "eth", uint8(0));
        ITextResolver(resolver)
            .authorizeTextRoles(name, "spirith.funded-until", address(vault), true);
        ITextResolver(resolver).authorizeTextRoles(name, "spirith.patrons", address(vault), true);
        vm.stopPrank();
    }

    function test_fork_fullDemoPath() public {
        if (!forked) return;
        if (!registrar.isRenewable(LABEL)) return; // name lapsed since; nothing to prove here
        address resolver = _giveNameAPermissionedResolver();
        assertEq(registry.getResolver(LABEL), resolver);

        vm.prank(patron);
        vault.endow(LABEL, 50e6);
        assertEq(ITextResolver(resolver).text(vault.node(LABEL), "spirith.patrons"), "1");

        _warpIntoLeadWindow();
        uint64 expiryBefore = registry.findExpiry(LABEL);
        uint64 duration = vault.optimalDuration(LABEL);
        assertEq(duration, 6 * 365 days, "$50 buys the six-year block");
        uint256 beneficiaryBefore = usdc.balanceOf(C.PAYMENT_BENEFICIARY);

        vm.prank(keeper);
        (uint256 price, uint256 tip) = vault.renew(LABEL, duration);

        assertEq(price, 27_000_071, "live oracle price for 6y, 5+ chars");
        assertEq(usdc.balanceOf(C.PAYMENT_BENEFICIARY) - beneficiaryBefore, price);
        assertEq(usdc.balanceOf(keeper), tip);
        assertEq(registry.findExpiry(LABEL), expiryBefore + duration);
        string memory until =
            ITextResolver(resolver).text(vault.node(LABEL), "spirith.funded-until");
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
