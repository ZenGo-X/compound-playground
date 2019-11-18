import { AbiItem } from "web3-utils";

export const PRICE_ORACLE_INTERFACE: AbiItem[] = [
  {
    constant: false,
    inputs: [
      {
        name: "cToken",
        type: "address"
      },
      {
        name: "underlyingPriceMantissa",
        type: "uint256"
      }
    ],
    name: "setUnderlyingPrice",
    outputs: [],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "asset",
        type: "address"
      }
    ],
    name: "assetPrices",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [],
    name: "isPriceOracle",
    outputs: [
      {
        name: "",
        type: "bool"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "cToken",
        type: "address"
      }
    ],
    name: "getUnderlyingPrice",
    outputs: [
      {
        name: "",
        type: "uint256"
      }
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  }
];
