// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Adapter-facing NOX compute interface for handle/proof validation hooks.
/// @dev Prototype contracts call this conditionally when adapter is configured.
interface INoxCompute {
    function verifyMint(
        address to,
        uint256 amount,
        bytes32 commitment,
        bytes calldata noxProof
    ) external view returns (bool);

    function verifyTransfer(
        address from,
        address to,
        uint256 amount,
        bytes32 commitment,
        bytes calldata noxProof
    ) external view returns (bool);
}
