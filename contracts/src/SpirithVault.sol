// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {Ownable, Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

import {IYieldAdapter} from "./adapters/IYieldAdapter.sol";
import {IETHRegistrarRead} from "./interfaces/ens/IETHRegistrarRead.sol";
import {IPermissionedRegistryRead} from "./interfaces/ens/IPermissionedRegistryRead.sol";
import {ITextResolver} from "./interfaces/ens/ITextResolver.sol";
import {Runway} from "./libraries/Runway.sol";

/// @title SpirithVault
/// @notice Per-name endowments for ENSv2 `.eth` names. Patrons deposit USDC earmarked for one
/// name; the deposit earns yield; anyone may pay that name's renewal from its earmark and
/// receive a capped tip.
///
/// Custody model (spec §4.1): the vault holds the yield shares, a patron holds an internal
/// per-name claim on them. Exactly two exits exist, both from one name's own earmark: the ENS
/// registrar as a renewal payment, or the patron of record after a 30-day notice; the capped
/// keeper tip exists only inside a successful renewal. No admin path moves funds;
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
        uint32 patronCount;
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
    /// @notice A name may be renewed once it is this close to expiry (or already in grace).
    uint64 public constant RENEW_LEAD = 30 days;
    uint64 public constant ONE_YEAR = 365 days;
    /// @notice Keeper tip: `min(price * TIP_BPS / 10_000, TIP_CAP)`, from the name's earmark.
    uint256 public constant TIP_BPS = 100;
    uint256 public constant TIP_CAP = 1e6;
    /// @dev Gas stipend per resolver record write; a misbehaving resolver cannot block renewal.
    uint256 internal constant RECORD_GAS = 150_000;
    /// @dev namehash("eth")
    bytes32 internal constant ETH_NODE =
        0x93cdeb708b7545dc668eb9280176169d1c33cfd8ed6f04690a0bcc88a93fc4ae;
    string public constant RECORD_FUNDED_UNTIL = "spirith.funded-until";
    string public constant RECORD_PATRONS = "spirith.patrons";

    IERC20 public immutable USDC;
    IETHRegistrarRead public immutable REGISTRAR;
    IPermissionedRegistryRead public immutable REGISTRY;
    IYieldAdapter public immutable ADAPTER;
    /// @notice Passed on every renewal: this contract's address, left-padded (spec §7).
    bytes32 public immutable REFERRER;
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
    event Renewed(
        bytes32 indexed labelHash,
        string label,
        address indexed keeper,
        uint64 duration,
        uint64 newExpiry,
        uint256 price,
        uint256 tip,
        bool recordWritten
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
    error NotDue(string label, uint64 dueAt);
    error WrongDuration(uint64 expected, uint64 given);
    error Unfunded(string label, uint256 assets);

    ////////////////////////////////////////////////////////////////////////
    // Initialization
    ////////////////////////////////////////////////////////////////////////

    /// @param usdc The payment token; must be accepted by the registrar's oracle.
    /// @param registrar The ENSv2 ETHRegistrar: pricing, renewability, renewals.
    /// @param registry The ENSv2 `.eth` registry: expiry and resolver lookups.
    /// @param adapter The yield venue. Its `asset()` must be `usdc`.
    /// @param owner_ May pause new deposits and nothing else; zero means the deployer. Renounce
    /// after deploy to remove the role.
    /// @param depositCap Maximum assets per name, in USDC units.
    /// @param reserveYears Years of one-year renewals kept liquid.
    constructor(
        IERC20 usdc,
        IETHRegistrarRead registrar,
        IPermissionedRegistryRead registry,
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
        REGISTRY = registry;
        ADAPTER = adapter;
        REFERRER = bytes32(uint256(uint160(address(this))));
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
        Position storage p = positions[h][msg.sender];
        uint256 held = _assetsOf(e);
        if (held + assets > DEPOSIT_CAP) revert DepositCapExceeded(held + assets, DEPOSIT_CAP);

        shares = assets.mulDiv(e.totalShares + 1, held + 1);
        if (shares == 0) revert ZeroShares();

        USDC.safeTransferFrom(msg.sender, address(this), assets);
        e.reserve += assets;
        e.totalShares += shares;
        if (p.shares == 0) e.patronCount += 1;
        p.shares += shares;
        emit Endowed(h, label, msg.sender, assets, shares);

        _deployExcess(label, e);
        _writeRecord(label, h, e);
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
        if (p.shares == 0) e.patronCount -= 1;

        if (e.totalShares == 0) {
            assets = _releaseAll(e);
        } else {
            _release(e, assets);
        }
        USDC.safeTransfer(msg.sender, assets);
        emit Withdrawn(h, msg.sender, shares, assets);

        _writeRecord(label, h, e);
    }

    ////////////////////////////////////////////////////////////////////////
    // Keeper action
    ////////////////////////////////////////////////////////////////////////

    /// @notice Permissionless. Pay `label`'s renewal from its own earmark and take the tip.
    /// Allowed once the name is within `RENEW_LEAD` of expiry or already in grace, and only for
    /// the duration the cadence heuristic returns, so a keeper can neither renew years early
    /// nor pick a worse cadence than the endowment can afford.
    /// @param duration Must equal `optimalDuration(label)`.
    /// @return price USDC paid to the registrar.
    /// @return tip USDC paid to the caller.
    function renew(string calldata label, uint64 duration)
        external
        returns (uint256 price, uint256 tip)
    {
        if (!REGISTRAR.isRenewable(label)) revert NotRenewable(label);
        uint64 expiry = REGISTRY.findExpiry(label);
        if (expiry > block.timestamp + RENEW_LEAD) revert NotDue(label, expiry - RENEW_LEAD);

        bytes32 h = labelhash(label);
        Endowment storage e = endowments[h];
        uint64 expected = _optimalDuration(label, e);
        if (expected == 0) revert Unfunded(label, _assetsOf(e));
        if (duration != expected) revert WrongDuration(expected, duration);

        price = REGISTRAR.getRenewPrice(label, duration, USDC);
        tip = tipFor(price);
        _release(e, price + tip);

        USDC.forceApprove(address(REGISTRAR), price);
        REGISTRAR.renew(label, duration, USDC, REFERRER);
        if (tip > 0) USDC.safeTransfer(msg.sender, tip);

        bool recorded = _writeRecord(label, h, e);
        emit Renewed(h, label, msg.sender, duration, expiry + duration, price, tip, recorded);
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

    /// @notice ENS namehash of `<label>.eth`.
    function node(string calldata label) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(ETH_NODE, keccak256(bytes(label))));
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

    function tipFor(uint256 price) public pure returns (uint256) {
        uint256 tip = price * TIP_BPS / 10_000;
        return tip < TIP_CAP ? tip : TIP_CAP;
    }

    /// @notice The cadence heuristic (spec §6): the longest of 6, 3, 2 or 1 years whose price
    /// plus tip leaves the reserve floor intact; failing that, the longest the earmark can pay
    /// at all. Reverts `Unfunded` when not even one year is affordable.
    function optimalDuration(string calldata label) external view returns (uint64) {
        Endowment storage e = endowments[labelhash(label)];
        uint64 d = _optimalDuration(label, e);
        if (d == 0) revert Unfunded(label, _assetsOf(e));
        return d;
    }

    /// @notice Funded-until projection as a range (spec §4.4), from the adapter's rate range.
    /// @return fundedUntilLow Unix time the name is covered to at the low rate.
    /// @return fundedUntilHigh Unix time at the high rate; `expiry + 500 years` means perpetual.
    /// @return assets USDC value earmarked now.
    /// @return duration The cadence heuristic's answer, or 0 when unfunded.
    function runwayOf(string calldata label)
        external
        view
        returns (uint64 fundedUntilLow, uint64 fundedUntilHigh, uint256 assets, uint64 duration)
    {
        Endowment storage e = endowments[labelhash(label)];
        return _runway(label, e);
    }

    ////////////////////////////////////////////////////////////////////////
    // Internal
    ////////////////////////////////////////////////////////////////////////

    function _assetsOf(Endowment storage e) internal view returns (uint256) {
        return e.reserve + ADAPTER.convertToAssets(e.adapterShares);
    }

    function _ladder() internal pure returns (uint64[4] memory) {
        return [6 * ONE_YEAR, 3 * ONE_YEAR, 2 * ONE_YEAR, ONE_YEAR];
    }

    function _optimalDuration(string calldata label, Endowment storage e)
        internal
        view
        returns (uint64)
    {
        uint256 assets = _assetsOf(e);
        uint256 floor = reserveTarget(label);
        uint64[4] memory ladder = _ladder();
        uint64 affordable;
        for (uint256 i; i < ladder.length; ++i) {
            uint256 price = REGISTRAR.getRenewPrice(label, ladder[i], USDC);
            uint256 cost = price + tipFor(price);
            if (assets >= cost + floor) return ladder[i];
            if (affordable == 0 && assets >= cost) affordable = ladder[i];
        }
        return affordable;
    }

    function _runway(string calldata label, Endowment storage e)
        internal
        view
        returns (uint64 low, uint64 high, uint256 assets, uint64 duration)
    {
        assets = _assetsOf(e);
        uint64 expiry = REGISTRY.findExpiry(label);
        duration = _optimalDuration(label, e);
        if (duration == 0) return (expiry, expiry, assets, 0);
        uint256 blockCost = REGISTRAR.getRenewPrice(label, duration, USDC);
        blockCost += tipFor(blockCost);
        uint256 blockYears = duration / ONE_YEAR;
        (uint16 rateLow, uint16 rateHigh) = ADAPTER.rateRangeBps();
        low =
            expiry + uint64(Runway.coveredYears(assets, blockCost, blockYears, rateLow)) * ONE_YEAR;
        high = expiry + uint64(Runway.coveredYears(assets, blockCost, blockYears, rateHigh))
            * ONE_YEAR;
    }

    /// @dev Best-effort liveness record on the name's resolver (spec §4.3). Needs the owner to
    /// have granted this contract `ROLE_SET_TEXT` for the two keys; otherwise, or for a
    /// resolver that is not a PermissionedResolver, the write fails quietly and returns false.
    function _writeRecord(string calldata label, bytes32 h, Endowment storage e)
        internal
        returns (bool)
    {
        address resolver = REGISTRY.getResolver(label);
        if (resolver.code.length == 0) return false;
        (uint64 low,,,) = _runway(label, e);
        bytes32 n = keccak256(abi.encodePacked(ETH_NODE, h));
        try ITextResolver(resolver).setText{gas: RECORD_GAS}(
            n, RECORD_FUNDED_UNTIL, Strings.toString(low)
        ) {}
        catch {
            return false;
        }
        try ITextResolver(resolver).setText{gas: RECORD_GAS}(
            n, RECORD_PATRONS, Strings.toString(e.patronCount)
        ) {}
        catch {
            return false;
        }
        return true;
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
