import Decimal from "decimal.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { CompAddress } from "./compAddress";
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

import { config, cTokenAPI } from "./ropstenConfig";
// import { config, cTokenAPI } from "./mainnetConfig";

import { COMPTROLLER_INTERFACE } from "./comptroller-interface";

export class Liquidator {
  public async checkLiquidity(address: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract
    );
    const liquidity = await myContract.methods
      .getAccountLiquidity(address)
      .call();
    console.log(liquidity);
  }

  public async getAssets(address: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract
    );
    const markets = await myContract.methods.getAssetsIn(address).call();
    console.log(markets);
  }
}

// Example of finding liquidatable addresses
/// https://api.compound.finance/api/v2/account?max_health{}={value:1}?page_size=1000
