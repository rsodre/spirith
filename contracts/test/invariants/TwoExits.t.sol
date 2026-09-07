// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {SpirithVault} from "../../src/SpirithVault.sol";
import {MockYieldAdapter} from "../../src/adapters/MockYieldAdapter.sol";
import {IMintableERC20} from "../../src/interfaces/ens/IMintableERC20.sol";
import {IETHRegistrarRead} from "../../src/interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "../../src/interfaces/ens/IPermissionedRegistryRead.sol";
import {MockERC20} from "../mocks/MockERC20.sol";
import {MockRegistrar} from "../mocks/MockRegistrar.sol";

/// @dev Drives the vault with random patrons, names, amounts and time, tracking every token
/// that leaves the system and to whom.
contract VaultHandler is Test {
    SpirithVault public vault;
    MockERC20 public usdc;
    MockYieldAdapter public adapter;

    address[] public patrons;
    string[] public labels;

    uint256 public ghostEndowed;
    uint256 public ghostWithdrawn;
    uint256 public ghostPaidToRegistrar;
    uint256 public ghostTips;
    address public keeper = makeAddr("keeper");
    address internal constant BENEFICIARY = address(0xBEEF);
    mapping(address => uint256) public ghostPaidTo;

    constructor(SpirithVault vault_, MockERC20 usdc_, MockYieldAdapter adapter_) {
        vault = vault_;
        usdc = usdc_;
        adapter = adapter_;
        patrons.push(makeAddr("p1"));
        patrons.push(makeAddr("p2"));
        patrons.push(makeAddr("p3"));
        labels.push("alpha");
        labels.push("beta");
        labels.push("gamma");
        for (uint256 i; i < patrons.length; ++i) {
            vm.prank(patrons[i]);
            usdc.approve(address(vault), type(uint256).max);
        }
    }

    function patronCount() external view returns (uint256) {
        return patrons.length;
    }

    function labelCount() external view returns (uint256) {
        return labels.length;
    }

    function endow(uint256 p, uint256 l, uint256 amount) external {
        address patron = patrons[p % patrons.length];
        string memory label = labels[l % labels.length];
        uint256 room = vault.DEPOSIT_CAP();
        uint256 held = vault.assetsOf(label);
        if (held >= room) return;
        amount = bound(amount, 1, room - held);
        usdc.mint(patron, amount);
        vm.prank(patron);
        try vault.endow(label, amount) {
            ghostEndowed += amount;
        } catch {}
    }

    function requestWithdraw(uint256 p, uint256 l, uint256 fraction) external {
        address patron = patrons[p % patrons.length];
        string memory label = labels[l % labels.length];
        (uint256 shares,,) = vault.positions(keccak256(bytes(label)), patron);
        if (shares == 0) return;
        uint256 amount = bound(fraction, 1, shares);
        vm.prank(patron);
        vault.requestWithdraw(label, amount);
    }

    function executeWithdraw(uint256 p, uint256 l) external {
        address patron = patrons[p % patrons.length];
        string memory label = labels[l % labels.length];
        (,, uint64 noticeAt) = vault.positions(keccak256(bytes(label)), patron);
        if (noticeAt == 0 || block.timestamp < noticeAt + vault.NOTICE_PERIOD()) return;
        uint256 before = usdc.balanceOf(patron);
        vm.prank(patron);
        uint256 out = vault.executeWithdraw(label);
        assertEq(usdc.balanceOf(patron) - before, out, "paid exactly what was reported");
        ghostWithdrawn += out;
        ghostPaidTo[patron] += out;
    }

    function renew(uint256 l) external {
        string memory label = labels[l % labels.length];
        (,,, uint64 duration) = vault.runwayOf(label);
        if (duration == 0) return;
        uint256 registrarBefore = usdc.balanceOf(BENEFICIARY);
        uint256 keeperBefore = usdc.balanceOf(keeper);
        vm.prank(keeper);
        try vault.renew(label, duration) returns (uint256 price, uint256 tip) {
            assertEq(usdc.balanceOf(BENEFICIARY) - registrarBefore, price);
            assertEq(usdc.balanceOf(keeper) - keeperBefore, tip);
            assertLe(tip, vault.TIP_CAP(), "tip capped");
            ghostPaidToRegistrar += price;
            ghostTips += tip;
        } catch {}
    }

    function warp(uint256 secs) external {
        vm.warp(block.timestamp + bound(secs, 1, 60 days));
    }

    function accrue() external {
        adapter.accrue();
    }

    function pauseToggle(bool on) external {
        if (on == vault.paused()) return;
        vm.prank(vault.owner());
        if (on) vault.pause();
        else vault.unpause();
    }
}

contract TwoExitsInvariantTest is Test {
    MockERC20 internal usdc;
    MockRegistrar internal registrar;
    MockYieldAdapter internal adapter;
    SpirithVault internal vault;
    VaultHandler internal handler;

    address internal owner = makeAddr("owner");
    address internal stranger = makeAddr("stranger");

    function setUp() public {
        usdc = new MockERC20("USDC", 6);
        registrar = new MockRegistrar();
        adapter = new MockYieldAdapter(IMintableERC20(address(usdc)), 500);
        vault = new SpirithVault(
            IERC20(address(usdc)),
            IETHRegistrarRead(address(registrar)),
            IPermissionedRegistryRead(address(registrar)),
            adapter,
            owner,
            100e6,
            2
        );
        handler = new VaultHandler(vault, usdc, adapter);
        vm.warp(1_800_000_000);
        for (uint256 i; i < handler.labelCount(); ++i) {
            registrar.register(handler.labels(i), uint64(block.timestamp) + 20 days, address(0));
        }
        targetContract(address(handler));
    }

    /// Tokens leave {vault, adapter} only as renewal payments to the registrar's beneficiary,
    /// capped tips to the keeper in the same transaction, or withdrawals to patrons: everything
    /// minted in, minus what the system still holds, is exactly the sum of those three.
    function invariant_conservation_threeExitsOnly() public view {
        // Pending interest is unminted, so conservation is checked on minted supply only.
        uint256 systemHeld = usdc.balanceOf(address(vault)) + usdc.balanceOf(address(adapter));
        uint256 mintedIn = handler.ghostEndowed() + adapter.totalYieldMinted();
        uint256 exits =
            handler.ghostWithdrawn() + handler.ghostPaidToRegistrar() + handler.ghostTips();
        assertEq(mintedIn - systemHeld, exits, "leak to a third party");
        uint256 paidToPatrons;
        for (uint256 i; i < handler.patronCount(); ++i) {
            paidToPatrons += handler.ghostPaidTo(handler.patrons(i));
        }
        assertEq(paidToPatrons, handler.ghostWithdrawn());
        assertEq(usdc.balanceOf(registrar.BENEFICIARY()), handler.ghostPaidToRegistrar());
        assertEq(usdc.balanceOf(handler.keeper()), handler.ghostTips());
    }

    /// No third address ever holds vault money.
    function invariant_strangersHoldNothing() public view {
        assertEq(usdc.balanceOf(stranger), 0);
        assertEq(usdc.balanceOf(owner), 0);
        assertEq(
            usdc.balanceOf(address(registrar)),
            0,
            "payments go to the beneficiary, never the registrar"
        );
        assertEq(usdc.balanceOf(address(handler)), 0);
    }

    /// The vault's liquid balance is exactly the sum of per-name reserves, and the adapter
    /// position is exactly the sum of per-name adapter shares: no unearmarked money anywhere.
    function invariant_everyTokenIsEarmarked() public view {
        uint256 reserves;
        uint256 shares;
        for (uint256 i; i < handler.labelCount(); ++i) {
            (uint256 r, uint256 s,,) = vault.endowments(keccak256(bytes(handler.labels(i))));
            reserves += r;
            shares += s;
        }
        assertEq(usdc.balanceOf(address(vault)), reserves, "vault balance != sum of reserves");
        assertEq(adapter.sharesOf(address(vault)), shares, "adapter shares != sum of earmarks");
    }

    /// Each name is solvent: its patrons' claims never exceed what it holds.
    function invariant_perNameSolvency() public view {
        for (uint256 i; i < handler.labelCount(); ++i) {
            string memory label = handler.labels(i);
            uint256 claims;
            for (uint256 j; j < handler.patronCount(); ++j) {
                claims += vault.patronAssets(label, handler.patrons(j));
            }
            assertLe(claims, vault.assetsOf(label) + 4, "claims exceed holdings");
        }
    }

    /// The vault never leaves an allowance behind after talking to the adapter or registrar.
    function invariant_noStandingAllowance() public view {
        assertEq(usdc.allowance(address(vault), address(adapter)), 0);
        assertEq(usdc.allowance(address(vault), address(registrar)), 0);
    }
}
