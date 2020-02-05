import Decimal from 'decimal.js';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { CompAddress } from './compAddress';
import { AbiItem } from 'web3-utils';
import { EventData } from 'web3-eth-contract';
import { addressToSymbol, addressToPrice, addressToDecimals } from './client';
import { ExportToCsv } from 'export-to-csv';
const EthereumTx = require('ethereumjs-tx').Transaction;
import Web3 from 'web3';

const fetch = require('node-fetch');
const CHAIN = 'mainnet';

// TODO: Config based on network type
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${CHAIN}.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99`,
  ),
);

import { config, cTokenAPI } from './mainnetConfig';
// import { config, cTokenAPI } from "./mainnetConfig";

import { COMPTROLLER_INTERFACE } from './comptroller-interface';
import { CTOKEN_JSON_INTERFACE } from './cToken-interface';
import { CETH_JSON_INTERFACE } from './cEth-interface';

interface Liquidation {
  transactionHash: string;
  timestampISO: string;
  date: number | string;
  amountRaw: number;
  amount: number;
  revenueRaw: number;
  revenue: number;
  liquidatee: string;
  liquidator: string;
  collaterizedToken: string;
  liquidatedToken: string;
}

export class Liquidator {
  public async checkLiquidity(address: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract,
    );
    const liquidity = await myContract.methods
      .getAccountLiquidity(address)
      .call();
    console.log(liquidity);
  }

  public async getAssets(address: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract,
    );
    const markets = await myContract.methods.getAssetsIn(address).call();
    console.log(markets);
  }

  public async getLiquidationEvents() {
    let address = config.cZRXContract;
    // Implies only liquidations of Compound USDC debt are retrieved.
    let compoundUsd = new web3.eth.Contract(CTOKEN_JSON_INTERFACE, address);
    if (compoundUsd) {
      let options = {
        fromBlock: 0,
        toBlock: 'latest',
      };
      let totalLiquidation = 0;
      try {
        // In theory options parameter is optional. In practice an empty array is
        // returned if options is not provided with fromBlock and toBlock set.
        let liquidations = await compoundUsd.getPastEvents(
          'LiquidateBorrow',
          options,
        );
        let totalRevenue = 0;
        let distinctLiquidators = new Set();
        let distinctBorrowers = new Set();
        let blocksRetrieved = 0;
        let dailyRevenue = {};
        let liquidatorsByRevenue = {};
        let liquidatedBorrowersByRevenue = {};
        var acc: { [id: string]: number } = {};
        var allEvents = [];
        for (let event of liquidations) {
          let amountRaw = this.getRepaidAmountRaw(address, event);
          let amount = this.getRepaidAmount(address, event);
          let revenueRaw = amountRaw * 0.05;
          let revenue = amount * 0.05;
          totalRevenue += revenue;
          let decimals = addressToDecimals(address);
          let repayAmount = event.returnValues['repayAmount'] / 10 ** 6;
          totalLiquidation += repayAmount;
          let block = await web3.eth.getBlock(event.blockNumber);
          let timestamp = block.timestamp;
          let timestampISO = new Date(
            Number(block.timestamp) * 1000,
          ).toISOString();
          let liquidator = this.getLiquidator(event);
          let liquidatee = this.getLiquidatee(event);
          let collaterizedToken = this.getCollaterized(event);
          console.log('-------------------------');
          console.log('Timestamp', timestamp);
          console.log('TimestampISO', timestampISO);
          console.log('Amount', amount);
          console.log('Revenue', revenue);
          console.log('Hash', event.transactionHash);
          let date = timestampISO.substring(0, 10);
          acc[date] = (acc[date] || 0) + revenue;

          let liquidation: Liquidation = {
            transactionHash: event.transactionHash,
            timestampISO: timestampISO,
            date: date,
            amountRaw: amountRaw,
            amount: amount,
            revenueRaw: revenueRaw,
            revenue: revenue,
            liquidator: liquidator,
            liquidatee: liquidatee,
            collaterizedToken: collaterizedToken,
            liquidatedToken: 'ZRX',
          };
          allEvents.push(liquidation);
        }
        console.log('Acc', acc);
        exportToCSV(allEvents, 'cZRX-liquidations.csv');
      } catch (error) {
        console.log(error);
      }
    }
  }

  getRepaidAmount(address: string, liquidation: EventData) {
    let sentTokens = liquidation.returnValues['repayAmount'];
    // Specific to a ctoken, get from map
    let decimals = addressToDecimals(address);
    sentTokens = sentTokens / 10 ** decimals;
    const price = addressToPrice(address);
    let revenue = sentTokens * price;
    return revenue;
  }

  getRepaidAmountRaw(address: string, liquidation: EventData): number {
    let sentTokens = liquidation.returnValues['repayAmount'];
    // Specific to a ctoken, get from map
    let decimals = addressToDecimals(address);
    sentTokens = sentTokens / 10 ** decimals;
    return sentTokens;
  }

  getLiquidator(liquidation: EventData): string {
    return liquidation.returnValues['liquidator'];
  }

  getLiquidatee(liquidation: EventData): string {
    return liquidation.returnValues['borrower'];
  }

  getCollaterized(liquidation: EventData): string {
    let colAddress = liquidation.returnValues['cTokenCollateral'];
    let sym = addressToSymbol(colAddress.toLowerCase());
    console.log('Symbol', sym);
    return sym;
  }
}

async function exportToCSV(txArray: Liquidation[], outputFile: string) {
  const options = {
    fieldSeparator: ',',
    quoteStrings: '"',
    decimalSeparator: '.',
    showLabels: true,
    showTitle: false,
    useTextFile: false,
    useBom: true,
    useKeysAsHeaders: true,
  };

  const csvExporter = new ExportToCsv(options);
  const csvData = csvExporter.generateCsv(txArray, true);
  await fs.writeFileSync(outputFile, csvData);
}

// Example of finding liquidatable addresses
/// https://api.compound.finance/api/v2/account?max_health{}={value:1}?page_size=1000
