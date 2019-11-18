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

// import interfaces: Should be the same for mainnet/testnet
import { CETH_JSON_INTERFACE } from "./cEth-interface";
import { CDAI_JSON_INTERFACE } from "./cDAI-interface";
import { COMPTROLLER_INTERFACE } from "./comptroller-interface";
import { ERC20_INERFACE } from "./erc20-interface";
import { PRICE_ORACLE_INTERFACE } from "./priceOracle-interface";

// TODO: Config based on network type
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://ropsten.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99"
  )
);
import { config } from "./ropstenConfig";

const CLIENT_DB_PATH = path.join(__dirname, "../../client_db");

export class Client {
  private mainnet: boolean;
  private db: any;
  private address: CompAddress;

  constructor(mainnet: boolean = false, useAsyncBroadcast: boolean = false) {
    this.mainnet = mainnet;
  }

  public async init() {
    this.initDb();
    this.address = await this.restoreOrGenerate();
  }

  public getAddress(): CompAddress {
    return this.address;
  }

  public async getBalance(): Promise<string> {
    const balance = await web3.eth.getBalance(this.address.getAddress());
    const balanceInEth = web3.utils.fromWei(balance, "ether");
    return balanceInEth;
  }

  public getBalanceCETH(): Promise<string> {
    return this.getBalanceCToken(CETH_JSON_INTERFACE, config.cETHContract);
  }

  public getBalanceCDAI(): Promise<string> {
    return this.getBalanceCToken(CDAI_JSON_INTERFACE, config.cDAIContract);
  }

  private async getBalanceCToken(
    iface: AbiItem[],
    contract_address: string
  ): Promise<string> {
    const myContract = new web3.eth.Contract(iface, contract_address);
    let [
      error,
      lendBallance,
      borrowBalance,
      exchangeRate
    ] = await myContract.methods
      .getAccountSnapshot(this.address.getAddress())
      .call();
    const decimals = await myContract.methods.decimals().call();
    const base: Decimal = new Decimal(10);
    let coefficient: Decimal = base.pow(-decimals);

    const lendBallanceDec: Decimal = coefficient.mul(lendBallance);
    const exchangeRateDec: Decimal = coefficient.mul(exchangeRate);

    const balanceOfUnderlying = lendBallanceDec.mul(exchangeRateDec);
    // I can explain 18 but not another 2 zeros
    coefficient = base.pow(-20);

    const finalBalance: Decimal = coefficient.mul(balanceOfUnderlying);
    return finalBalance.toString();
  }

  private async restoreOrGenerate(): Promise<CompAddress> {
    let addr = await this.db.get("address").value();
    if (Object.entries(addr).length === 0 && addr.constructor === Object) {
      return this.generateAddress();
    }
    return CompAddress.fromPlain(addr);
  }

  private async generateAddress(): Promise<CompAddress> {
    let account = await web3.eth.accounts.create();
    let addr = new CompAddress(account.address, account.privateKey);
    this.db.set("address", addr).write();
    return addr;
  }

  private initDb() {
    ensureDirSync(CLIENT_DB_PATH);
    const adapter = new FileSync(`${CLIENT_DB_PATH}/db.json`);
    this.db = low(adapter);
    this.db.defaults().write();
  }
}

function ensureDirSync(dirpath: string) {
  try {
    fs.mkdirSync(dirpath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}
