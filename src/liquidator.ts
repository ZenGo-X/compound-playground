import Decimal from "decimal.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { CompAddress } from "./compAddress";
import { AbiItem } from "web3-utils";
import { EventData } from "web3-eth-contract";
import { addressToSymbol, addressToPrice } from "./client";
const EthereumTx = require("ethereumjs-tx").Transaction;
import Web3 from "web3";

const fetch = require("node-fetch");
const CHAIN = "mainnet";

// TODO: Config based on network type
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${CHAIN}.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99`
  )
);

import { config, cTokenAPI } from "./mainnetConfig";
// import { config, cTokenAPI } from "./mainnetConfig";

import { COMPTROLLER_INTERFACE } from "./comptroller-interface";
import { CTOKEN_JSON_INTERFACE } from "./cToken-interface";

interface Liquidation extends EventData {
  revenue: number;
  timestampISO: string;
  timestamp: number | string;
}

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

  public async getLiquidationEvents() {
    // Implies only liquidations of Compound USDC debt are retrieved.
    let compoundUsd = new web3.eth.Contract(
      CTOKEN_JSON_INTERFACE,
      config.cUSDCContract
    );
    if (compoundUsd) {
      let options = {
        fromBlock: 0,
        toBlock: "latest"
      };
      let totalLiquidation = 0;
      try {
        // In theory options parameter is optional. In practice an empty array is
        // returned if options is not provided with fromBlock and toBlock set.
        let liquidations = await compoundUsd.getPastEvents(
          "LiquidateBorrow",
          options
        );
        let totalRevenue = 0;
        let distinctLiquidators = new Set();
        let distinctBorrowers = new Set();
        let blocksRetrieved = 0;
        let dailyRevenue = {};
        let liquidatorsByRevenue = {};
        let liquidatedBorrowersByRevenue = {};
        liquidations.forEach(event => {
          let liquidation: Liquidation = event as Liquidation;
          let revenue = this.calculateRevenue(
            config.cUSDCContract,
            liquidation
          );
          console.log("Revenue", revenue);
          totalRevenue += revenue;
          // 6 here is specific for usdc
          let repayAmount = liquidation.returnValues["repayAmount"] / 10 ** 6;
          totalLiquidation += repayAmount;
          var acc: { [id: string]: number } = {};
          web3.eth.getBlock(liquidation.blockNumber, (error, block) => {
            blocksRetrieved++;
            liquidation.timestamp = block.timestamp;
            liquidation.timestampISO = new Date(
              Number(block.timestamp) * 1000
            ).toISOString();
            console.log("Timestamp", liquidation.timestamp);
            console.log("TimestampISO", liquidation.timestampISO);
            let date = liquidation.timestampISO.substring(0, 10);
            acc[date] = (acc[date] || 0) + revenue;

            // wait for all blocks to be retrieved.
            // if (blocksRetrieved === liquidations.length) {
            //   dailyRevenue = liquidations.reduce(function(acc, event) {
            //     console.log("Processing", event);
            //     // let cur = event as Liquidation;
            //     // let date = cur.timestampISO.substring(0, 10);
            //     // acc[date] = (acc[date] || 0) + cur.revenue;
            //     return acc;
            //   }, {});
            //   // trigger ui update once after all blocks have been retrieved
            //   // to avoid degrading performance.
            // }
          });
        });
      } catch (error) {
        console.log(error);
      }
    }
  }

  calculateRevenue(address: string, liquidation: EventData) {
    let sentTokens = liquidation.returnValues["repayAmount"];
    // Specific to a ctoken, get from map
    sentTokens = sentTokens / 10 ** 6;
    const price = addressToPrice(address);
    const liquidationIncentive = 1.05;
    let revenue = sentTokens * price;
    return revenue;
  }
}

// Example of finding liquidatable addresses
/// https://api.compound.finance/api/v2/account?max_health{}={value:1}?page_size=1000
