import Decimal from "decimal.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { AbiItem } from "web3-utils";
const EthereumTx = require("ethereumjs-tx").Transaction;
import Web3 from "web3";

const fetch = require("node-fetch");
const CHAIN = "ropsten";

// TODO: Config based on network type
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${CHAIN}.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99`
  )
);

// TODO add logic to configure by network
import { config, cTokenAPI } from "./ropstenConfig";

import { CETH_JSON_INTERFACE } from "./cEth-interface";
import { CTOKEN_JSON_INTERFACE } from "./cToken-interface";
import { COMPTROLLER_INTERFACE } from "./comptroller-interface";
import { ERC20_INERFACE } from "./erc20-interface";
import { PRICE_ORACLE_INTERFACE } from "./priceOracle-interface";

interface KeyValue {
  value: string;
}

interface CTokenInfo {
  name: string;
  symbol: string;
  supply_rate: KeyValue;
}

interface cTokensResponse {
  cToken: CTokenInfo[];
}

export async function getAPR(token: string): Promise<string> {
  const response = await fetch(cTokenAPI);
  const json: cTokensResponse = await response.json(); //extract JSON from the http response
  const cTokens = json.cToken;
  console.log(cTokens);
  for (const cToken of cTokens) {
    const sym: string = cToken.symbol;
    if (sym.toLowerCase() === token) {
      return cToken.supply_rate.value;
    }
  }
  return "Unknown token";
}

async function getCTokenAPR(
  iface: AbiItem[],
  contract_address: string
): Promise<string> {
  const myContract = new web3.eth.Contract(iface, contract_address);

  const supplyRate = await myContract.methods.supplyRatePerBlock().call();

  const decimals = await myContract.methods.decimals().call();

  const base: Decimal = new Decimal(10);
  const coefficient: Decimal = base.pow(-18);
  const actualSupplyRate: Decimal = coefficient.mul(supplyRate);
  const blocksPerYear = 2102400;
  const APR = actualSupplyRate.mul(blocksPerYear);
  return APR.toString();
}

export async function getContractAPR(token: string): Promise<string> {
  if (token === "ceth") {
    return getCTokenAPR(CETH_JSON_INTERFACE, config.cETHContract);
  }
  if (token === "cdai") {
    return getCTokenAPR(CTOKEN_JSON_INTERFACE, config.cDAIContract);
  }
  return "Unknown token";
}
