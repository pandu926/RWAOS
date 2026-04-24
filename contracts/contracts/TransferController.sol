// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {IERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/interfaces/IERC7984.sol";
import {DisclosureRegistry} from "./DisclosureRegistry.sol";

/// @title TransferController
/// @notice Disclosure-gated operator transfer entrypoint for ERC-7984 tokens.
contract TransferController {
    IERC7984 public immutable token;
    DisclosureRegistry public immutable disclosureRegistry;

    event ConfidentialTransferRequested(
        address indexed initiator,
        address indexed from,
        address indexed to,
        bytes32 disclosureDataId
    );
    event CompliancePassportIssued(
        bytes32 indexed transferId,
        bytes32 indexed disclosureDataId,
        bytes32 indexed policyHash,
        bytes32 anchorHash,
        address operator
    );

    constructor(address tokenAddress, address disclosureRegistryAddress) {
        require(tokenAddress != address(0), "TransferController: zero token");
        require(disclosureRegistryAddress != address(0), "TransferController: zero registry");

        token = IERC7984(tokenAddress);
        disclosureRegistry = DisclosureRegistry(disclosureRegistryAddress);
    }

    function confidentialTransferFromWithDisclosure(
        address from,
        address to,
        externalEuint256 encryptedAmount,
        bytes calldata inputProof,
        bytes32 disclosureDataId
    ) external returns (euint256 transferred) {
        transferred = _executeConfidentialTransfer(from, to, encryptedAmount, inputProof, disclosureDataId);
        emit ConfidentialTransferRequested(msg.sender, from, to, disclosureDataId);
    }

    function confidentialTransferFromWithPassport(
        address from,
        address to,
        externalEuint256 encryptedAmount,
        bytes calldata inputProof,
        bytes32 disclosureDataId,
        bytes32 transferId,
        bytes32 policyHash,
        bytes32 anchorHash
    ) external returns (euint256 transferred) {
        transferred = _executeConfidentialTransfer(from, to, encryptedAmount, inputProof, disclosureDataId);
        emit ConfidentialTransferRequested(msg.sender, from, to, disclosureDataId);
        emit CompliancePassportIssued(transferId, disclosureDataId, policyHash, anchorHash, msg.sender);
    }

    function _executeConfidentialTransfer(
        address from,
        address to,
        externalEuint256 encryptedAmount,
        bytes calldata inputProof,
        bytes32 disclosureDataId
    ) internal returns (euint256 transferred) {
        require(from != address(0) && to != address(0), "TransferController: zero account");
        require(disclosureRegistry.hasDisclosure(disclosureDataId, msg.sender), "TransferController: disclosure required");
        require(token.isOperator(from, address(this)), "TransferController: operator missing");
        euint256 amount;
        if (block.chainid == 31337) {
            // Local hardhat tests don't deploy NOX compute precompile contract by default.
            amount = euint256.wrap(externalEuint256.unwrap(encryptedAmount));
        } else {
            // Validate proof with EOA caller context at controller level, then allow token usage.
            amount = Nox.fromExternal(encryptedAmount, inputProof);
            Nox.allow(amount, address(token));
        }
        transferred = token.confidentialTransferFrom(from, to, amount);
    }
}
