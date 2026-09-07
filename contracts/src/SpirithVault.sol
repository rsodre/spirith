// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IYieldAdapter} from "./adapters/IYieldAdapter.sol";
import {IETHRegistrarRead} from "./interfaces/ens/IETHRegistrarRead.sol";

/// @title SpirithVault
/// @notice Per-name endowments for ENSv2 `.eth` names. Patrons deposit USDC earmarked for one
/// name; the deposit earns yield; anyone may later pay that name's renewal from its earmark.
///
/// Custody model (spec §4.1): the vault holds the yield shares, a patron holds an internal
/// per-name claim on them. Exactly two exits exist for tokens: the ENS registrar as a renewal
/// payment (Phase 2), or the patron of record via a 30-day notice. No admin path moves funds;
/// the owner's only powers are pausing new deposits and handing over or renouncing that role.
contract SpirithVault is Ownable2Step, Pausable {
    using SafeERC20 for IERC20;
    using Math for uint256;

    ////////////////////////////////////////////////////////////////////////
    // Types
    ////////////////////////////////////////////////////////////////////////

    /// @dev One name's earmark. `reserve` is liquid USDC held here; `adapterShares` are this
    /// name's share of the adapter position; `totalShares` are the patrons' internal shares.
    struct Endowment {
        uint256 reserve;
        uint256 adapterShares;
        uint256 totalShares;
    }

    /// @dev One patron's claim on one name. A notice covers `noticeShares` from `noticeAt`.
    struct Position {
        uint256 shares;
        uint256 noticeShares;
        uint64 noticeAt;
    }

    ////////////////////////////////////////////////////////////////////////
    // Constants and immutables
    ////////////////////////////////////////////////////////////////////////

    uint64 public constant NOTICE_PERIOD = 30 days;
    uint64 public constant ONE_YEAR = 365 days;

    IERC20 public immutable USDC;
    IETHRegistrarRead public immutable REGISTRAR;
    IYieldAdapter public immutable ADAPTER;
    /// @notice Hackathon posture: maximum assets one name may hold.
    uint256 public immutable DEPOSIT_CAP;
    /// @notice Years of renewals kept as liquid USDC before anything goes to the adapter.
    uint256 public immutable RESERVE_YEARS;

    ////////////////////////////////////////////////////////////////////////
    // Storage
    ////////////////////////////////////////////////////////////////////////

    mapping(bytes32 labelHash => Endowment) public endowments;
    mapping(bytes32 labelHash => mapping(address patron => Position)) public positions;

    ////////////////////////////////////////////////////////////////////////
    // Events
    ////////////////////////////////////////////////////////////////////////

    event Endowed(
        bytes32 indexed labelHash,
        string label,
        address indexed patron,
        uint256 assets,
        uint256 shares
    );
    event WithdrawRequested(
        bytes32 indexed labelHash, address indexed patron, uint256 shares, uint64 executableAt
    );
    event Withdrawn(
        bytes32 indexed labelHash, address indexed patron, uint256 shares, uint256 assets
    );

    ////////////////////////////////////////////////////////////////////////
    // Errors
    ////////////////////////////////////////////////////////////////////////

    error AdapterAssetMismatch();
    error ZeroAmount();
    error ZeroShares();
    error NotRenewable(string label);
    error DepositCapExceeded(uint256 wouldHold, uint256 cap);
    error InvalidShares(uint256 requested, uint256 held);
    error NoNotice();
    error NoticePending(uint64 executableAt);

    ////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////

    /// @param usdc The payment token; must be accepted by the registrar's oracle.
    /// @param registrar The ENSv2 ETHRegistrar (pricing, renewability, and Phase 2 renewals).
    /// @param adapter The yield venue. Its `asset()` must be `usdc`.
    /// @param owner_ May pause new deposits and nothing else; zero means the deployer. Renounce
    /// after deploy to remove the role.
    /// @param depositCap Maximum assets per name, in USDC units.
    /// @param reserveYears Years of one-year renewals kept liquid.
    constructor(
        IERC20 usdc,
        IETHRegistrarRead registrar,
        IYieldAdapter adapter,
        address owner_,
        uint256 depositCap,
        uint256 reserveYears
    ) Ownable(owner_ == address(0) ? msg.sender : owner_) {
        if (address(adapter.asset()) != address(usdc)) {
            revert AdapterAssetMismatch();
        }
        USDC = usdc;
        REGISTRAR = registrar;
        ADAPTER = adapter;
        DEPOSIT_CAP = depositCap;
        RESERVE_YEARS = reserveYears;
    }

    ////////////////////////////////////////////////////////////////////////
    // Patron actions
    ////////////////////////////////////////////////////////////////////////

    /// @notice Earmark `assets` USDC for `label`. Anyone may endow any renewable name.
    /// @return shares Internal shares minted to the caller for this name.
    function endow(string calldata label, uint256 assets)
        external
        whenNotPaused
        returns (uint256 shares)
    {
        if (assets == 0) revert ZeroAmount();
        if (!REGISTRAR.isRenewable(label)) revert NotRenewable(label);

        bytes32 h = labelhash(label);
        Endowment storage e = endowments[h];
        uint256 held = _assetsOf(e);
        if (held + assets > DEPOSIT_CAP) revert DepositCapExceeded(held + assets, DEPOSIT_CAP);

        shares = assets.mulDiv(e.totalShares + 1, held + 1);
        if (shares == 0) revert ZeroShares();

        USDC.safeTransferFrom(msg.sender, address(this), assets);
        e.reserve += assets;
        e.totalShares += shares;
        positions[h][msg.sender].shares += shares;
        emit Endowed(h, label, msg.sender, assets, shares);

        _deployExcess(label, e);
    }

    /// @notice Start the notice period for withdrawing `shares` of the caller's claim on
    /// `label`. A new request replaces the previous one and restarts the clock.
    function requestWithdraw(string calldata label, uint256 shares) external {
        bytes32 h = labelhash(label);
        Position storage p = positions[h][msg.sender];
        if (shares == 0 || shares > p.shares) revert InvalidShares(shares, p.shares);
        p.noticeShares = shares;
        p.noticeAt = uint64(block.timestamp);
        emit WithdrawRequested(h, msg.sender, shares, uint64(block.timestamp) + NOTICE_PERIOD);
    }

    /// @notice Redeem the shares under notice for USDC at the current value. Never blocked by
    /// pause; only by an unexpired notice.
    /// @return assets USDC sent to the caller.
    function executeWithdraw(string calldata label) external returns (uint256 assets) {
        bytes32 h = labelhash(label);
        Position storage p = positions[h][msg.sender];
        Endowment storage e = endowments[h];
        if (p.noticeAt == 0) revert NoNotice();
        uint64 executableAt = p.noticeAt + NOTICE_PERIOD;
        if (block.timestamp < executableAt) revert NoticePending(executableAt);

        uint256 shares = p.noticeShares < p.shares ? p.noticeShares : p.shares;
        assets = shares.mulDiv(_assetsOf(e) + 1, e.totalShares + 1);

        p.shares -= shares;
        p.noticeShares = 0;
        p.noticeAt = 0;
        e.totalShares -= shares;

        if (e.totalShares == 0) {
            assets = _releaseAll(e);
        } else {
            _release(e, assets);
        }
        USDC.safeTransfer(msg.sender, assets);
        emit Withdrawn(h, msg.sender, shares, assets);
    }

    ////////////////////////////////////////////////////////////////////////
    // Owner: pause deposits, and nothing else
    ////////////////////////////////////////////////////////////////////////

    /// @notice Stop new deposits. Withdrawals and renewals are never affected.
    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Give up ownership forever. Lifts any active pause first, so renouncing can never
    /// freeze deposits.
    function renounceOwnership() public override onlyOwner {
        if (paused()) _unpause();
        super.renounceOwnership();
    }

    ////////////////////////////////////////////////////////////////////////
    // Views
    ////////////////////////////////////////////////////////////////////////

    function labelhash(string calldata label) public pure returns (bytes32) {
        return keccak256(bytes(label));
    }

    /// @notice USDC value earmarked for `label`: liquid reserve plus the adapter position.
    function assetsOf(string calldata label) external view returns (uint256) {
        return _assetsOf(endowments[labelhash(label)]);
    }

    /// @notice USDC value of `patron`'s claim on `label` at the current share price.
    function patronAssets(string calldata label, address patron) external view returns (uint256) {
        bytes32 h = labelhash(label);
        Endowment storage e = endowments[h];
        return positions[h][patron].shares.mulDiv(_assetsOf(e) + 1, e.totalShares + 1);
    }

    /// @notice Liquid USDC the vault keeps for `label` before deploying anything to yield.
    function reserveTarget(string calldata label) public view returns (uint256) {
        return RESERVE_YEARS * REGISTRAR.getRenewPrice(label, ONE_YEAR, USDC);
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    function _assetsOf(Endowment storage e) internal view returns (uint256) {
        return e.reserve + ADAPTER.convertToAssets(e.adapterShares);
    }

    /// @dev Move whatever exceeds the reserve target into the adapter, with an exact allowance
    /// so the adapter never holds a standing approval on vault funds.
    function _deployExcess(string calldata label, Endowment storage e) internal {
        uint256 target = reserveTarget(label);
        if (e.reserve <= target) return;
        uint256 excess = e.reserve - target;
        e.reserve = target;
        USDC.forceApprove(address(ADAPTER), excess);
        e.adapterShares += ADAPTER.deposit(excess);
    }

    /// @dev The last patron out takes everything the name holds, rounding dust included, so a
    /// name never carries orphaned shares into its next endowment.
    function _releaseAll(Endowment storage e) internal returns (uint256 assets) {
        assets = e.reserve;
        e.reserve = 0;
        uint256 shares = e.adapterShares;
        if (shares > 0) {
            e.adapterShares = 0;
            assets += ADAPTER.redeem(shares);
        }
    }

    /// @dev Make `assets` liquid for one name: reserve first, then the adapter.
    function _release(Endowment storage e, uint256 assets) internal {
        if (assets <= e.reserve) {
            e.reserve -= assets;
            return;
        }
        uint256 shortfall = assets - e.reserve;
        e.reserve = 0;
        uint256 burned = ADAPTER.withdraw(shortfall);
        e.adapterShares = burned >= e.adapterShares ? 0 : e.adapterShares - burned;
    }
}
