// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {IMintableERC20} from "../src/interfaces/ens/IMintableERC20.sol";
import {SepoliaConfig as C} from "./Config.s.sol";

interface IRegistrarRegister {
    function commit(bytes32 commitment) external;
    function commitmentAt(bytes32 commitment) external view returns (uint64);
    function isAvailable(string memory label) external view returns (bool);
    function getRegisterPrice(string calldata label, uint64 duration, IERC20 paymentToken)
        external
        view
        returns (uint256 base, uint256 premium);
    function makeCommitment(
        string calldata label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        bytes32 referrer
    ) external pure returns (bytes32);
    function register(
        string memory label,
        address owner,
        bytes32 secret,
        address subregistry,
        address resolver,
        uint64 duration,
        IERC20 paymentToken,
        bytes32 referrer
    ) external returns (uint256);
}

/// @notice Registers a test name with MockUSDC in two runs (commit, then register >= 60 s later).
///
///   LABEL=<label> STEP=commit   forge script script/RegisterName.s.sol --rpc-url ... --broadcast
///   LABEL=<label> STEP=register forge script script/RegisterName.s.sol --rpc-url ... --broadcast
///
/// Optional: DURATION (seconds, default 28 days, the minimum), RESOLVER (default PublicResolverV2;
/// a PermissionedResolver instance from manager.ens.dev is what Phase 2 needs), SECRET (bytes32).
contract RegisterName is Script {
    struct Params {
        string label;
        address owner;
        bytes32 secret;
        address resolver;
        uint64 duration;
        bytes32 referrer;
    }

    IRegistrarRegister internal constant REGISTRAR = IRegistrarRegister(C.ETH_REGISTRAR);
    IMintableERC20 internal constant USDC = IMintableERC20(C.MOCK_USDC);

    function run() external {
        require(block.chainid == C.CHAIN_ID, "sepolia only");
        Params memory p = _params();
        require(REGISTRAR.isAvailable(p.label), "not available");

        if (keccak256(bytes(vm.envString("STEP"))) == keccak256("commit")) {
            _commit(p);
        } else {
            _register(p);
        }
    }

    function _params() internal view returns (Params memory p) {
        p.label = vm.envString("LABEL");
        p.owner = msg.sender;
        p.secret = vm.envOr("SECRET", keccak256("spirith-phase0"));
        p.resolver = vm.envOr("RESOLVER", C.PUBLIC_RESOLVER_V2);
        p.duration = uint64(vm.envOr("DURATION", uint256(C.MIN_REGISTER_DURATION)));
        p.referrer = bytes32(uint256(uint160(msg.sender)));
    }

    function _commitment(Params memory p) internal pure returns (bytes32) {
        return REGISTRAR.makeCommitment(
            p.label, p.owner, p.secret, address(0), p.resolver, p.duration, p.referrer
        );
    }

    function _commit(Params memory p) internal {
        vm.startBroadcast();
        REGISTRAR.commit(_commitment(p));
        vm.stopBroadcast();
        console.log("committed; run STEP=register after 60 s (before 24 h)");
    }

    function _register(Params memory p) internal {
        require(REGISTRAR.commitmentAt(_commitment(p)) != 0, "no commitment; run STEP=commit first");
        (uint256 base, uint256 premium) =
            REGISTRAR.getRegisterPrice(p.label, p.duration, IERC20(address(USDC)));
        console.log("price base / premium:", base, premium);

        vm.startBroadcast();
        if (USDC.balanceOf(p.owner) < base + premium) USDC.mint(p.owner, base + premium);
        USDC.approve(address(REGISTRAR), base + premium);
        uint256 tokenId = REGISTRAR.register(
            p.label,
            p.owner,
            p.secret,
            address(0),
            p.resolver,
            p.duration,
            IERC20(address(USDC)),
            p.referrer
        );
        vm.stopBroadcast();
        console.log("registered tokenId:", tokenId);
    }
}
