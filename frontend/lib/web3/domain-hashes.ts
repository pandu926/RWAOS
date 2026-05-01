import { encodeAbiParameters, keccak256, type Address, type Hex } from "viem";

export function computeAssetAnchorHash(input: {
  chainId: number;
  assetName: string;
  assetType: string;
  beneficiaryWallet: Address;
  initialSupply: bigint;
  metadataUri: string;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256", name: "chainId" },
        { type: "string", name: "assetName" },
        { type: "string", name: "assetType" },
        { type: "address", name: "beneficiaryWallet" },
        { type: "uint256", name: "initialSupply" },
        { type: "string", name: "metadataUri" },
      ],
      [
        BigInt(input.chainId),
        input.assetName,
        input.assetType,
        input.beneficiaryWallet,
        input.initialSupply,
        input.metadataUri,
      ],
    ),
  );
}

export function computePassportPolicyHash(input: {
  chainId: number;
  transferRecordId: number;
  disclosureDataId: Hex;
  disclosureScope: string;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256", name: "chainId" },
        { type: "uint256", name: "transferRecordId" },
        { type: "bytes32", name: "disclosureDataId" },
        { type: "string", name: "disclosureScope" },
      ],
      [
        BigInt(input.chainId),
        BigInt(input.transferRecordId),
        input.disclosureDataId,
        input.disclosureScope,
      ],
    ),
  );
}

export function computeTransferIdOnchain(input: {
  chainId: number;
  transferRecordId: number;
  transferTxHash: Hex;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "uint256", name: "chainId" },
        { type: "uint256", name: "transferRecordId" },
        { type: "bytes32", name: "transferTxHash" },
      ],
      [
        BigInt(input.chainId),
        BigInt(input.transferRecordId),
        input.transferTxHash,
      ],
    ),
  );
}

export function computePassportAnchorHash(input: {
  transferIdOnchain: Hex;
  policyHash: Hex;
  disclosureDataId: Hex;
  reason: string;
}): Hex {
  return keccak256(
    encodeAbiParameters(
      [
        { type: "bytes32", name: "transferIdOnchain" },
        { type: "bytes32", name: "policyHash" },
        { type: "bytes32", name: "disclosureDataId" },
        { type: "string", name: "reason" },
      ],
      [
        input.transferIdOnchain,
        input.policyHash,
        input.disclosureDataId,
        input.reason,
      ],
    ),
  );
}
