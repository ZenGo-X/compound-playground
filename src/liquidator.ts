import Decimal from "decimal.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { CompAddress } from "./compAddress";
import { AbiItem } from "web3-utils";
import { EventData } from "web3-eth-contract";
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

interface LiquidationEventResult {
  cTokenCollateral: string;
  seizeTokens: number;
  repayAmount: number;
}

interface LiquidationData {
  price: number;
  symbol: string;
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
      try {
        // In theory options parameter is optional. In practice an empty array is
        // returned if options is not provided with fromBlock and toBlock set.
        let liquidations = await compoundUsd.getPastEvents(
          "LiquidateBorrow",
          options
        );
        let totalLiquidation = 0;
        let totalRevenue = 0;
        let distinctLiquidators = new Set();
        let distinctBorrowers = new Set();
        let blocksRetrieved = 0;
        let dailyRevenue = {};
        let liquidatorsByRevenue = {};
        let liquidatedBorrowersByRevenue = {};
        liquidations.forEach(liquidation => {
          this.calculateRevenue(liquidation);
          totalRevenue += liquidation.revenue;
          // 6 here is specific for usdc
          let repayAmount = liquidation.returnValues["repayAmount"] / 10 ** 6;
          totalLiquidation += repayAmount;
          distinctLiquidators.add(liquidation.returnValues["liquidator"]);
          distinctBorrowers.add(liquidation.returnValues["borrower"]);
          this.calculateLiquidatorsByRevenue(liquidation, liquidatorsByRevenue);
          this.calculateLiquidatedBorrowersByRevenue(
            liquidation,
            liquidatedBorrowersByRevenue
          );
          web3.eth.getBlock(liquidation.blockNumber, (error, block) => {
            blocksRetrieved++;
            liquidation.timestamp = block.timestamp;
            liquidation.timestampISO = new Date(
              block.timestamp * 1000
            ).toISOString();
            // wait for all blocks to be retrieved.
            if (blocksRetrieved === liquidations.length) {
              dailyRevenue = liquidations.reduce(function(acc, cur) {
                let date = cur.timestampISO.substring(0, 10);
                acc[date] = (acc[date] || 0) + cur.revenue;
                return acc;
              }, {});
              // trigger ui update once after all blocks have been retrieved
              // to avoid degrading performance.
              this.setState({
                liquidations: liquidations,
                dailyRevenue: dailyRevenue
              });
            }
          });
        });
        liquidatorsByRevenue = Object.values(liquidatorsByRevenue).sort(
          (a, b) => b.revenue - a.revenue
        );
        liquidatedBorrowersByRevenue = Object.values(
          liquidatedBorrowersByRevenue
        ).sort((a, b) => b.revenue - a.revenue);
        let top10LiquidatedBorrowersByRevenue = liquidatedBorrowersByRevenue.slice(
          0,
          10
        );
        top10LiquidatedBorrowersByRevenue = [
          top10LiquidatedBorrowersByRevenue.map(x => x.address),
          top10LiquidatedBorrowersByRevenue.map(x => x.revenue.toFixed(2)),
          top10LiquidatedBorrowersByRevenue.map(x => x.txCount)
        ];
        let top10LiquidatorsByRevenue = liquidatorsByRevenue.slice(0, 10);
        top10LiquidatorsByRevenue = [
          top10LiquidatorsByRevenue.map(x => x.address),
          top10LiquidatorsByRevenue.map(x => x.revenue.toFixed(2)),
          top10LiquidatorsByRevenue.map(x => x.txCount)
        ];
        this.setState({
          liquidations: liquidations,
          totalLiquidation: totalLiquidation,
          totalRevenue: totalRevenue,
          distinctLiquidators: distinctLiquidators,
          distinctBorrowers: distinctBorrowers,
          liquidatorsByRevenue: liquidatorsByRevenue,
          top10LiquidatorsByRevenue: top10LiquidatorsByRevenue,
          liquidatedBorrowersByRevenue: liquidatedBorrowersByRevenue,
          top10LiquidatedBorrowersByRevenue: top10LiquidatedBorrowersByRevenue
        });
      } catch (error) {
        console.log(error);
      }
    }
  }

  calculateLiquidatorsByRevenue(liquidation, liquidatorsByRevenue) {
    let liquidator = {};
    liquidator.address = liquidation.returnValues["liquidator"];
    liquidator.revenue = liquidation.revenue;
    liquidator.txCount = 1;
    if (liquidatorsByRevenue[liquidator.address]) {
      liquidatorsByRevenue[liquidator.address].revenue += liquidation.revenue;
      liquidatorsByRevenue[liquidator.address].txCount++;
    } else {
      liquidatorsByRevenue[liquidator.address] = liquidator;
    }
  }

  calculateLiquidatedBorrowersByRevenue(
    liquidation,
    liquidatedBorrowersByRevenue
  ) {
    let borrower = {};
    borrower.address = liquidation.returnValues["borrower"];
    borrower.revenue = liquidation.revenue;
    borrower.txCount = 1;
    if (liquidatedBorrowersByRevenue[borrower.address]) {
      liquidatedBorrowersByRevenue[borrower.address].revenue +=
        liquidation.revenue;
      liquidatedBorrowersByRevenue[borrower.address].txCount++;
    } else {
      liquidatedBorrowersByRevenue[borrower.address] = borrower;
    }
  }

  calculateRevenue(liquidation: EventData) {
    // Prices are in USD ($).
    const addressToSymbolMap = {
      "0x4Ddc2D193948926D02f9B1fE9e1daa0718270ED5": {
        symbol: "cETH",
        price: 3.0154
      },
      "0x158079Ee67Fce2f58472A96584A73C7Ab9AC95c1": {
        symbol: "cREP",
        price: 0.2126
      },
      "0x6C8c6b02E7b2BE14d4fA6022Dfd6d75921D90E4E": {
        symbol: "cBAT",
        price: 0.0039
      },
      "0xF5DCe57282A584D2746FaF1593d3121Fcac444dC": {
        symbol: "cSAI",
        price: 0.0211
      },
      "0xB3319f5D18Bc0D84dD1b4825Dcde5d5f7266d407": {
        symbol: "cZRX",
        price: 0.0051
      },
      "0xC11b1268C1A384e55C48c2391d8d480264A3A7F4": {
        symbol: "cWBTC",
        price: 148.3473
      }
    };
    const cTokenResult: LiquidationEventResult =
      liquidation.returnValues["cTokenCollateral"];
    const cTokenAddress = cTokenResult.cTokenCollateral;
    // TODO Use my address to map
    let liquidationData: LiquidationData;
    liquidationData.symbol = addressToSymbolMap[cTokenAddress].symbol;
    const price = addressToSymbolMap[cTokenAddress].price;
    const seizeTokens = liquidation.returnValues["seizeTokens"] / 10 ** 8;
    // Liquidation incentive is 1.05.
    // seizeTokens = x * 1.05
    // x = seizeTokens / 1.05
    // revenue = seizeTokens - x
    // revenue = seizeTokens - (seizeTokens / 1.05)
    const liquidationIncentive = 1.05;
    liquidation.revenue = seizeTokens - seizeTokens / liquidationIncentive;
    liquidation.revenue = liquidation.revenue * price;
  }
}

// Example of finding liquidatable addresses
/// https://api.compound.finance/api/v2/account?max_health{}={value:1}?page_size=1000
