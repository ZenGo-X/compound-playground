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
import { CTOKEN_JSON_INTERFACE } from "./cToken-interface";
import { COMPTROLLER_INTERFACE } from "./comptroller-interface";
import { ERC20_INERFACE } from "./erc20-interface";
import { PRICE_ORACLE_INTERFACE } from "./priceOracle-interface";

const CHAIN = "ropsten";

// TODO: Config based on network type
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${CHAIN}.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99`
  )
);

// TODO add logic to configure by network
import { config, markets_list } from "./ropstenConfig";

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

  //// Enter Markets /////
  public async enterMarkets() {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract
    );
    const data = myContract.methods.enterMarkets(markets_list).encodeABI();
    this.executeTX(config.comptrollerContract, data, "0x0");
    // this.estimateTX(config.comptrollerContract, data, "0x0");
  }

  /////// Getting balance ////////
  public async getBalanceETH(): Promise<string> {
    const balance = await web3.eth.getBalance(this.address.getAddress());
    const balanceInEth = web3.utils.fromWei(balance, "ether");
    return balanceInEth;
  }

  public async getBalanceDAI(): Promise<string> {
    const balance = await this.getBalanceToken(
      CTOKEN_JSON_INTERFACE,
      config.cDAIContract
    );
    return balance;
  }

  public async getBalanceUSDC(): Promise<string> {
    const balance = await this.getBalanceToken(
      CTOKEN_JSON_INTERFACE,
      config.cUSDCContract
    );
    return balance;
  }

  public async getBalanceREP(): Promise<string> {
    const balance = await this.getBalanceToken(
      CTOKEN_JSON_INTERFACE,
      config.cREPContract
    );
    return balance;
  }

  private async getBalanceToken(
    iface: AbiItem[],
    contract_address: string
  ): Promise<string> {
    const underlyingAddress = await this.getUnderlyingAddress(
      iface,
      contract_address
    );
    const myContract = new web3.eth.Contract(ERC20_INERFACE, underlyingAddress);

    const balance = await myContract.methods
      .balanceOf(this.address.getAddress())
      .call();

    const decimals = await myContract.methods.decimals().call();

    const base: Decimal = new Decimal(10);
    const coefficient: Decimal = base.pow(-decimals);
    const actualBalance: Decimal = coefficient.mul(balance);
    return actualBalance.toString();
  }

  public getBalanceCETH(): Promise<string> {
    return this.getBalanceCToken(CETH_JSON_INTERFACE, config.cETHContract);
  }

  public getBalanceCDAI(): Promise<string> {
    return this.getBalanceCToken(CTOKEN_JSON_INTERFACE, config.cDAIContract);
  }

  public getBalanceCREP(): Promise<string> {
    return this.getBalanceCToken(CTOKEN_JSON_INTERFACE, config.cREPContract);
  }

  public getBalanceCUSDC(): Promise<string> {
    return this.getBalanceCToken(CTOKEN_JSON_INTERFACE, config.cUSDCContract);
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
    const decimals = 18;
    const base: Decimal = new Decimal(10);
    let coefficient: Decimal = base.pow(-decimals);

    const lendBallanceDec: Decimal = coefficient.mul(lendBallance);
    const exchangeRateDec: Decimal = coefficient.mul(exchangeRate);

    const balanceOfUnderlying = lendBallanceDec.mul(exchangeRateDec);

    // const finalBalance: Decimal = coefficient.mul(balanceOfUnderlying);
    return balanceOfUnderlying.toString();
  }

  // Minting Ceth is different as there is not erc20 token
  public async mintCETH(amount: string) {
    const myContract = new web3.eth.Contract(
      CETH_JSON_INTERFACE,
      config.cETHContract
    );
    const data = myContract.methods.mint().encodeABI();
    const nonce = await web3.eth.getTransactionCount(this.address.getAddress());
    const toMint = web3.utils.toWei(amount, "ether");
    const toMintHex = web3.utils.toHex(toMint);
    this.executeTX(config.cETHContract, data, toMintHex);
  }

  /// Mint Tokents ////
  public async mintCDAI(amount: string) {
    // await this.approveCToken(
    //   CTOKEN_JSON_INTERFACE,
    //   config.cDAIContract,
    //   amount
    // );
    await this.mintCToken(CTOKEN_JSON_INTERFACE, config.cDAIContract, amount);
    // await this.estimateCToken(
    //   CTOKEN_JSON_INTERFACE,
    //   config.cDAIContract,
    //   amount
    // );
  }

  public async mintCUSDC(amount: string) {
    await this.approveCToken(
      CTOKEN_JSON_INTERFACE,
      config.cUSDCContract,
      amount
    );
    await this.mintCToken(CTOKEN_JSON_INTERFACE, config.cUSDCContract, amount);
  }

  public async mintCREP(amount: string) {
    await this.approveCToken(
      CTOKEN_JSON_INTERFACE,
      config.cREPContract,
      amount
    );
    await this.mintCToken(CTOKEN_JSON_INTERFACE, config.cREPContract, amount);
  }

  private async mintCToken(
    iface: AbiItem[],
    contract_address: string,
    amount: string
  ) {
    // TODO: Check the the amount exists in the account
    const toMint = web3.utils.toWei(amount, "ether");
    const toMintHex = web3.utils.toHex(toMint);

    const myContract = new web3.eth.Contract(iface, contract_address);
    const data = myContract.methods.mint(toMintHex).encodeABI();
    await this.executeTX(contract_address, data, "0x0");
  }

  public async estimateCDAI(amount: string) {
    await this.estimateCToken(
      CTOKEN_JSON_INTERFACE,
      config.cDAIContract,
      amount
    );
  }

  public async estimateCREP(amount: string) {
    await this.estimateCToken(
      CTOKEN_JSON_INTERFACE,
      config.cREPContract,
      amount
    );
  }

  private async estimateCToken(
    iface: AbiItem[],
    contract_address: string,
    amount: string
  ) {
    const toMint = web3.utils.toWei(amount, "ether");
    const toMintHex = web3.utils.toHex(toMint);

    const myContract = new web3.eth.Contract(iface, contract_address);
    const data = myContract.methods.mint(toMintHex).encodeABI();
    await this.estimateTX(contract_address, data, "0x0");
  }

  // Minting Ceth is different as there is not erc20 token
  public async estimateCETH(amount: string) {
    const myContract = new web3.eth.Contract(
      CETH_JSON_INTERFACE,
      config.cETHContract
    );
    const data = myContract.methods.mint().encodeABI();
    const nonce = await web3.eth.getTransactionCount(this.address.getAddress());
    const toMint = web3.utils.toWei(amount, "ether");
    const toMintHex = web3.utils.toHex(toMint);
    this.estimateTX(config.cETHContract, data, toMintHex);
  }

  /// Redeem Tokens ///
  public async redeemCETH(amount: string) {
    this.redeemCToken(CETH_JSON_INTERFACE, config.cETHContract, amount);
  }

  public async redeemCDAI(amount: string) {
    this.redeemCToken(CTOKEN_JSON_INTERFACE, config.cDAIContract, amount);
  }

  public async redeemCREP(amount: string) {
    this.redeemCToken(CTOKEN_JSON_INTERFACE, config.cREPContract, amount);
  }

  public async reddemCUSDC(amount: string) {
    this.redeemCToken(CTOKEN_JSON_INTERFACE, config.cUSDCContract, amount);
  }

  /**
   * Redeem supplied tokens for a cToken contract.
   * cTokens are traded back for regular tokens, according to the exchange rate
   */
  private async redeemCToken(
    iface: AbiItem[],
    contract_address: string,
    amount: string
  ) {
    // TODO: Check the the amount exists in the account
    const toRedeem = web3.utils.toWei(amount, "ether");
    const toRedeemHex = web3.utils.toHex(toRedeem);

    const myContract = new web3.eth.Contract(iface, contract_address);
    const data = myContract.methods.redeemUnderlying(toRedeem).encodeABI();
    this.executeTX(contract_address, data, "0x0");
  }

  //// approve market ///////
  public async approveCDAI(amount: string) {
    await this.approveCToken(
      CTOKEN_JSON_INTERFACE,
      config.cDAIContract,
      amount
    );
  }

  public async approveCREP(amount: string) {
    await this.approveCToken(
      CTOKEN_JSON_INTERFACE,
      config.cREPContract,
      amount
    );
  }

  public async approveCUSDC(amount: string) {
    await this.approveCToken(
      CTOKEN_JSON_INTERFACE,
      config.cUSDCContract,
      amount
    );
  }

  private async approveCToken(
    iface: AbiItem[],
    contract_address: string,
    amount: string
  ) {
    const underlyingAddress = await this.getUnderlyingAddress(
      iface,
      contract_address
    );

    const toApprove = web3.utils.toWei(amount, "ether");
    const toApproveHex = web3.utils.toHex(toApprove);

    // The transaction to approve is sent to the underlying contract
    const UnderlyingContract = new web3.eth.Contract(
      ERC20_INERFACE,
      underlyingAddress
    );
    // Let it controll all your funds
    // const max_val = "0xffffffffffffffffffffffffffffffffffffffff";

    const approveCall = UnderlyingContract.methods
      .approve(contract_address, toApproveHex)
      .encodeABI();
    await this.executeTX(underlyingAddress, approveCall, "0x0");
  }

  /**
   * Restore a client address for DB if exists, or generate a new one
   */
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

  private async estimateTX(
    contract_address: string,
    data: string,
    value: string
  ) {
    const nonce = await web3.eth.getTransactionCount(this.address.getAddress());
    let gasPrice = Number(await web3.eth.getGasPrice());
    let gasPriceHex = web3.utils.toHex(gasPrice);

    let gasLimit: number = await web3.eth.estimateGas({
      from: this.address.getAddress(),
      to: contract_address,
      data: data,
      value: value
    });
    let gasLimitHex = web3.utils.toHex(gasLimit);
    console.log("Gas Price: ", gasPrice);
    console.log("Gas Limit: ", gasLimit);
  }

  /**
   * Execute any web3 transaction with passed parameters
   */
  private async executeTX(
    contract_address: string,
    data: string,
    value: string
  ) {
    const nonce = await web3.eth.getTransactionCount(this.address.getAddress());
    let gasPrice = Number(await web3.eth.getGasPrice());
    let gasPriceHex = web3.utils.toHex(gasPrice);

    let gasLimit: number = await web3.eth.estimateGas({
      from: this.address.getAddress(),
      to: contract_address,
      data: data,
      value: value
    });
    let gasLimitHex = web3.utils.toHex(gasLimit);
    console.log("Gas Price: ", gasPrice);
    console.log("Gas Limit: ", gasLimit);

    const txParams = {
      nonce,
      gasPrice: gasPriceHex,
      gasLimit: gasLimitHex,
      to: contract_address,
      data: data,
      value: value
    };
    const tx = new EthereumTx(txParams, {
      chain: CHAIN
    });
    console.log(`TX: ${tx}`);

    console.log("signing tx...");
    // alternatively, we can call `tx.hash()` and sign it using an external signer
    tx.sign(Buffer.from(this.address.getPrivateKey(), "hex"));

    const serializedTx = tx.serialize();

    await web3.eth
      .sendSignedTransaction("0x" + serializedTx.toString("hex"))
      .on("transactionHash", (hash: string) => {
        console.log("-".repeat(20));
        console.log("on(transactionHash): hash =", hash);
      })
      .on("receipt", (receipt: any) => {
        console.log("-".repeat(20));
        console.log("on(receipt): receipt =", receipt);
      })
      .on("error", (error: Error) => {
        console.log("-".repeat(20));
        console.log("on(error): error =", error);
      });
  }

  /**
   * Get the address of the underlying ERC20 contract, related to the
   * cToken. Not relevant for ETH
   */
  private async getUnderlyingAddress(
    iface: AbiItem[],
    contract_address: string
  ): Promise<string> {
    const myContract = new web3.eth.Contract(iface, contract_address);
    const getUnderlying = myContract.methods.underlying().encodeABI();
    let underlyingAddress = await web3.eth.call({
      to: contract_address,
      data: getUnderlying
    });

    underlyingAddress = "0x" + underlyingAddress.substr(-40);
    return underlyingAddress;
  }
}

function ensureDirSync(dirpath: string) {
  try {
    fs.mkdirSync(dirpath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}
