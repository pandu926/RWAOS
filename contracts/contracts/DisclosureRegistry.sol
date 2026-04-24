// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DisclosureRegistry
/// @notice Tracks explicit disclosure grants for commitment-linked data.
contract DisclosureRegistry {
    struct DisclosureGrant {
        address granter;
        uint64 expiresAt;
        bool active;
        string metadataURI;
    }

    mapping(bytes32 => mapping(address => DisclosureGrant)) private grants;

    event DisclosureGranted(
        bytes32 indexed dataId,
        address indexed granter,
        address indexed grantee,
        uint64 expiresAt,
        string metadataURI
    );
    event DisclosureRevoked(bytes32 indexed dataId, address indexed granter, address indexed grantee);

    function grantDisclosure(bytes32 dataId, address grantee, uint64 expiresAt, string calldata metadataURI) external {
        require(grantee != address(0), "DisclosureRegistry: zero grantee");
        require(expiresAt == 0 || expiresAt > block.timestamp, "DisclosureRegistry: invalid expiry");

        grants[dataId][grantee] = DisclosureGrant({
            granter: msg.sender,
            expiresAt: expiresAt,
            active: true,
            metadataURI: metadataURI
        });

        emit DisclosureGranted(dataId, msg.sender, grantee, expiresAt, metadataURI);
    }

    function revokeDisclosure(bytes32 dataId, address grantee) external {
        DisclosureGrant storage grant = grants[dataId][grantee];
        require(grant.granter == msg.sender, "DisclosureRegistry: not granter");
        require(grant.active, "DisclosureRegistry: inactive");

        grant.active = false;
        emit DisclosureRevoked(dataId, msg.sender, grantee);
    }

    function hasDisclosure(bytes32 dataId, address grantee) public view returns (bool) {
        DisclosureGrant memory grant = grants[dataId][grantee];
        if (!grant.active) return false;
        if (grant.expiresAt != 0 && grant.expiresAt < block.timestamp) return false;
        return true;
    }

    function getDisclosure(bytes32 dataId, address grantee) external view returns (DisclosureGrant memory) {
        return grants[dataId][grantee];
    }
}
