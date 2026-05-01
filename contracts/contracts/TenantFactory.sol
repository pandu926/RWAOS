// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AuditAnchor} from "./AuditAnchor.sol";
import {ConfidentialRWAToken} from "./ConfidentialRWAToken.sol";
import {DisclosureRegistry} from "./DisclosureRegistry.sol";
import {SettlementVault} from "./SettlementVault.sol";
import {TransferController} from "./TransferController.sol";

/// @title TenantFactory
/// @notice Deploys a complete contract bundle for each public demo tenant.
contract TenantFactory {
    event TenantBundleCreated(
        address indexed owner,
        address token,
        address disclosureRegistry,
        address transferController,
        address auditAnchor
    );
    event TenantSettlementBundleCreated(
        address indexed owner,
        address indexed settlementAsset,
        address token,
        address disclosureRegistry,
        address transferController,
        address auditAnchor,
        address settlementVault
    );

    function createTenantBundle(address owner)
        external
        returns (
            address token,
            address disclosureRegistry,
            address transferController,
            address auditAnchor
        )
    {
        require(owner != address(0), "TenantFactory: zero owner");

        ConfidentialRWAToken deployedToken = new ConfidentialRWAToken();
        DisclosureRegistry deployedRegistry = new DisclosureRegistry();
        TransferController deployedController =
            new TransferController(address(deployedToken), address(deployedRegistry));
        AuditAnchor deployedAuditAnchor = new AuditAnchor(owner);

        deployedToken.transferOwnership(owner);

        token = address(deployedToken);
        disclosureRegistry = address(deployedRegistry);
        transferController = address(deployedController);
        auditAnchor = address(deployedAuditAnchor);

        emit TenantBundleCreated(owner, token, disclosureRegistry, transferController, auditAnchor);
    }

    function createTenantSettlementBundle(address owner, address settlementAsset)
        external
        returns (
            address token,
            address disclosureRegistry,
            address transferController,
            address auditAnchor,
            address settlementVault
        )
    {
        require(owner != address(0), "TenantFactory: zero owner");
        require(settlementAsset != address(0), "TenantFactory: zero settlement asset");

        ConfidentialRWAToken deployedToken = new ConfidentialRWAToken();
        DisclosureRegistry deployedRegistry = new DisclosureRegistry();
        TransferController deployedController =
            new TransferController(address(deployedToken), address(deployedRegistry));
        AuditAnchor deployedAuditAnchor = new AuditAnchor(owner);
        SettlementVault deployedVault = new SettlementVault(settlementAsset, address(deployedToken));

        deployedToken.setAuthorizedMinter(address(deployedVault), true);
        deployedToken.transferOwnership(owner);

        token = address(deployedToken);
        disclosureRegistry = address(deployedRegistry);
        transferController = address(deployedController);
        auditAnchor = address(deployedAuditAnchor);
        settlementVault = address(deployedVault);

        emit TenantSettlementBundleCreated(
            owner,
            settlementAsset,
            token,
            disclosureRegistry,
            transferController,
            auditAnchor,
            settlementVault
        );
    }
}
