// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AuditAnchor
/// @notice Immutable commitment log for off-chain confidential audit artifacts.
contract AuditAnchor is Ownable {
    struct AnchorRecord {
        bytes32 anchorHash;
        uint64 timestamp;
        address submitter;
        string metadataURI;
    }

    bool public requireSubmitterRole;
    uint256 public latestAnchorId;
    mapping(uint256 => AnchorRecord) public anchors;
    mapping(address => bool) public submitters;

    event SubmitterSet(address indexed submitter, bool enabled);
    event RequireSubmitterRoleSet(bool enabled);
    event AnchorCommitted(
        uint256 indexed anchorId,
        bytes32 indexed anchorHash,
        address indexed submitter,
        string metadataURI,
        uint64 timestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setSubmitter(address submitter, bool enabled) external onlyOwner {
        submitters[submitter] = enabled;
        emit SubmitterSet(submitter, enabled);
    }

    function setRequireSubmitterRole(bool enabled) external onlyOwner {
        requireSubmitterRole = enabled;
        emit RequireSubmitterRoleSet(enabled);
    }

    function commitAnchor(bytes32 anchorHash, string calldata metadataURI) external returns (uint256 anchorId) {
        require(anchorHash != bytes32(0), "AuditAnchor: empty hash");
        if (requireSubmitterRole) {
            require(submitters[msg.sender], "AuditAnchor: not submitter");
        }

        anchorId = ++latestAnchorId;
        anchors[anchorId] = AnchorRecord({
            anchorHash: anchorHash,
            timestamp: uint64(block.timestamp),
            submitter: msg.sender,
            metadataURI: metadataURI
        });

        emit AnchorCommitted(anchorId, anchorHash, msg.sender, metadataURI, uint64(block.timestamp));
    }
}
