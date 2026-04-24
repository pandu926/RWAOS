// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";

/// @notice Lightweight test double for TransferController tests.
contract MockControllerToken {
    mapping(address => mapping(address => bool)) private operatorStatus;

    address public lastCaller;
    address public lastFrom;
    address public lastTo;
    bytes32 public lastEncryptedAmount;
    bytes public lastInputProof;

    function setOperatorStatus(address holder, address operator, bool allowed) external {
        operatorStatus[holder][operator] = allowed;
    }

    function isOperator(address holder, address spender) external view returns (bool) {
        return operatorStatus[holder][spender];
    }

    function confidentialTransferFrom(
        address from,
        address to,
        externalEuint256 encryptedAmount,
        bytes calldata inputProof
    ) external returns (euint256 transferred) {
        lastCaller = msg.sender;
        lastFrom = from;
        lastTo = to;
        lastEncryptedAmount = externalEuint256.unwrap(encryptedAmount);
        lastInputProof = inputProof;
        transferred = euint256.wrap(lastEncryptedAmount);
    }

    function confidentialTransferFrom(
        address from,
        address to,
        euint256 amount
    ) external returns (euint256 transferred) {
        lastCaller = msg.sender;
        lastFrom = from;
        lastTo = to;
        lastEncryptedAmount = euint256.unwrap(amount);
        lastInputProof = "";
        transferred = amount;
    }
}
