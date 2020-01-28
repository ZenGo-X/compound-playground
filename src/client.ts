import Decimal from 'decimal.js';

import fs from 'fs';
import path from 'path';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';
import { GasEstimator } from './gasEstimator';
import { AbiItem } from 'web3-utils';
import { Transaction } from 'ethereumjs-tx';
import { Account, TransactionReceipt } from 'web3-core';
import Web3 from 'web3';

// import interfaces: Should be the same for mainnet/testnet
import { CETH_JSON_INTERFACE } from './cEth-interface';
import { CTOKEN_JSON_INTERFACE } from './cToken-interface';
import { COMPTROLLER_INTERFACE } from './comptroller-interface';
import { ERC20_INERFACE } from './erc20-interface';

//const CHAIN = "mainnet";
const CHAIN = 'ropsten';

const fetch = require('node-fetch');

// TODO: Config based on network type
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    `https://${CHAIN}.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99`,
  ),
);

// TODO add logic to configure by network
// import { config, markets_list, addressAPI } from "./ropstenConfig";
import { config, marketsList, addressAPI } from './ropstenConfig';

const CLIENT_DB_PATH = path.join(__dirname, '../../client_db');

/**
 * Holds the state of the current client, its address and private key
 */
export class Client {
  private mainnet: boolean;
  private db: any;
  private gasEstimator: GasEstimator;
  private account: Account;

  constructor(mainnet = false) {
    this.mainnet = mainnet;
    this.gasEstimator = new GasEstimator();
  }

  public async init(path = `${CLIENT_DB_PATH}/db.json`) {
    this.initDb(path);
    this.gasEstimator.loadData();
    this.account = await this.restoreOrGenerate();
  }

  public getAddress(): Account {
    return this.account;
  }

  //// Enter Markets /////
  /**
   * Receives a symbol of a market to enter and enters the market
   * Enter market is required to consider a token as collateral and to
   * be able to borrow from a market
   */
  public async enterMarket(sym: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract,
    );
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      console.log('No such symbol');
    }
    const contracts: string[] = [contractAddress];
    const data = myContract.methods.enterMarkets(contracts).encodeABI();
    this.executeTX(config.comptrollerContract, data, '0x0', 'enterMarket');
  }

  public async exitMarket(sym: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract,
    );
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      console.log('No such symbol');
    }
    const contracts: string[] = [contractAddress];
    const data = myContract.methods.exitMarket(contracts).encodeABI();
    this.executeTX(config.comptrollerContract, data, '0x0', 'exitMarkets');
  }

  /**
   * Eneter all markets at once
   */
  public async enterAllMarkets(sym: string) {
    const myContract = new web3.eth.Contract(
      COMPTROLLER_INTERFACE,
      config.comptrollerContract,
    );
    const data = myContract.methods.enterMarkets(marketsList).encodeABI();
    this.executeTX(config.comptrollerContract, data, '0x0', 'enterAllMarkets');
  }

  /////// Getting balance ////////
  /**
   * Get th
   */
  public async getBalanceETH(): Promise<string> {
    const balance = await web3.eth.getBalance(this.account.address);
    const balanceInEth = web3.utils.fromWei(balance, 'ether');
    return balanceInEth;
  }

  /**
   * Get the mantissa the underlying token is working with for conversion calculations
   */
  private async getUnderlyingDecimals(
    contractAddress: string,
  ): Promise<number> {
    if (contractAddress === config.cETHContract) {
      return 18;
    }
    const iface = CTOKEN_JSON_INTERFACE;
    const underlyingAddress = await this.getUnderlyingAddress(
      iface,
      contractAddress,
    );
    const myContract = new web3.eth.Contract(ERC20_INERFACE, underlyingAddress);
    const decimals = await myContract.methods.decimals().call();
    return decimals;
  }

  /**
   * Get the balance of an underlying cToken directly from the ERC20 contract
   * Receives the cToken symbol
   * Returns the balance of the underlying token
   */
  private async getBalanceToken(sym: string): Promise<string> {
    const iface = CTOKEN_JSON_INTERFACE;
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      throw new Error('Unable to get contract address');
    }
    const underlyingAddress = await this.getUnderlyingAddress(
      iface,
      contractAddress,
    );
    if (underlyingAddress == '0x0') {
      throw new Error('No Underlying address');
    }
    const myContract = new web3.eth.Contract(ERC20_INERFACE, underlyingAddress);

    const balance = await myContract.methods
      .balanceOf(this.account.address)
      .call();

    const decimals = await myContract.methods.decimals().call();

    const base: Decimal = new Decimal(10);
    const coefficient: Decimal = base.pow(-decimals);
    const actualBalance: Decimal = coefficient.mul(balance);
    return actualBalance.toString();
  }

  /**
   * Get the balance of a cToken
   * Receives a symbol of a cToken
   * Returns the balance currently supplied to the cToken contract, in unites of
   * the underlying cToken, i.e. multiplied by the exchange rate
   */
  private async getBalanceCToken(sym: string): Promise<string> {
    const iface = CTOKEN_JSON_INTERFACE;
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      throw new Error('Unable to get contract address');
      console.log('No such symbol');
    }
    const myContract = new web3.eth.Contract(iface, contractAddress);
    const [
      error,
      lendBallance,
      borrowBalance,
      exchangeRate,
    ] = await myContract.methods
      .getAccountSnapshot(this.account.address)
      .call();
    const underlyingDecimals = await this.getUnderlyingDecimals(
      contractAddress,
    );
    const cTokenDecimals: number = await myContract.methods.decimals().call();
    console.log('Token Decimals', cTokenDecimals);
    console.log('Underlying Decimals', underlyingDecimals);
    const base: Decimal = new Decimal(10);

    // Balance in underlying token
    // Get the balance of the underlying token, with the appropriate mantissa
    let coefficient: Decimal = base.pow(-cTokenDecimals);
    const ballanceDec: Decimal = coefficient.mul(lendBallance);

    // Exchange rate mantissa
    // The mantissa of the exchange rate is calculated as:
    // 18 + decimals_of_underlying - decimals_of_ctoken
    const decimals = 18;
    const decimlasDiff = Number(
      -decimals - Number(underlyingDecimals) + Number(cTokenDecimals),
    );
    coefficient = base.pow(decimlasDiff);
    const exchangeRateDec: Decimal = coefficient.mul(exchangeRate);

    const balanceOfUnderlying = ballanceDec.mul(exchangeRateDec);
    return balanceOfUnderlying.toString();
  }

  /// Minting (supplying) (lending)
  /**
   * Sends the specified amount of Ether to the cEth contract, and receive
   * cEth tokens in return
   * Mining cEth is different to other tokens, as an amount is required.
   */
  public async mintCETH(amount: string) {
    const myContract = new web3.eth.Contract(
      CETH_JSON_INTERFACE,
      config.cETHContract,
    );
    const data = myContract.methods.mint().encodeABI();
    const nonce = await web3.eth.getTransactionCount(this.account.address);
    const toMint = web3.utils.toWei(amount, 'ether');
    const toMintHex = web3.utils.toHex(toMint);
    this.executeTX(config.cETHContract, data, toMintHex, 'mintcETH');
  }

  /**
   * Sends the specified amount of the underlying token to the cToken contract,
   * and receive cTokens in return
   * Minting can fail if there are insufficient funds in the underlying ERC20
   * contract, or if funds have not been approved for moving
   */
  public async mintCToken(
    sym: string,
    amount: string,
    nonce?: number,
    gasLimit?: number,
  ) {
    const iface = CTOKEN_JSON_INTERFACE;
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      throw new Error('Unable to get contract address');
      console.log('No such symbol');
    }
    // TODO: Check the amount exists in the account
    const toMintHex = await this.convertToUnderlying(amount, contractAddress);

    const myContract = new web3.eth.Contract(iface, contractAddress);
    const data = myContract.methods.mint(toMintHex).encodeABI();
    await this.executeTX(
      contractAddress,
      data,
      '0x0',
      'mintCToken',
      nonce,
      gasLimit,
    );
  }

  //// approve ///////
  /**
   * Before ERC20 tokens can be pulled from and account, the amount must
   * be approved.
   * Receives: a symbol and the amount of underlying tokens to approve
   */
  private async approveCToken(
    sym: string,
    amount: string,
    nonce?: number,
    gasLimit?: number,
  ) {
    const iface = CTOKEN_JSON_INTERFACE;
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      throw new Error('Unable to get contract address');
      console.log('No such symbol');
    }
    const underlyingAddress = await this.getUnderlyingAddress(
      iface,
      contractAddress,
    );
    const toApproveHex = await this.convertToUnderlying(
      amount,
      contractAddress,
    );

    // The transaction to approve is sent to the underlying contract
    const underlyingContract = new web3.eth.Contract(
      ERC20_INERFACE,
      underlyingAddress,
    );
    console.log('Underlying', underlyingAddress);
    // Let it controll all your funds
    // const max_val = "0xffffffffffffffffffffffffffffffffffffffff";

    const approveCall = underlyingContract.methods
      .approve(contractAddress, toApproveHex)
      .encodeABI();
    await this.executeTX(
      underlyingAddress,
      approveCall,
      '0x0',
      'approve',
      nonce,
      gasLimit,
    );
  }

  /**
   * Performs both approve and mint asynchronously, both transactions are sent
   * where mint has nonce + 1.
   * The gas price is an over estimation of the actual cost, and might need
   * to be updated
   */
  public async approveAndMintCToken(sym: string, amount: string) {
    const nonce = await web3.eth.getTransactionCount(this.account.address);
    const approveLimit = await this.gasEstimator.getLimit('approve');
    const mintLimit = await this.gasEstimator.getLimit('mintCToken');
    console.log('Using ' + approveLimit + ' for approve');
    console.log('Using ' + mintLimit + ' for mint');
    this.approveCToken(sym, amount, nonce, approveLimit);
    this.mintCToken(sym, amount, nonce + 1, mintLimit);
  }

  /**
   * Redeem supplied tokens for a cToken contract.
   * cTokens are traded back for regular tokens, according to the exchange rate
   * If redeem All flag is passed, all the cTokens are redeemed without converting
   * to underlying tokens
   */
  private async redeemCToken(sym: string, amount: string, redeemAll = false) {
    const iface = CTOKEN_JSON_INTERFACE;
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      throw new Error('Unable to get contract address');
      console.log('No such symbol');
    }
    // If we want to redeem all, need to specify amount in cTokens
    if (redeemAll == true) {
      const iface = CTOKEN_JSON_INTERFACE;
      const contractAddress = symbolToAddress(sym);
      if (contractAddress == '0x0') {
        throw new Error('Unable to get contract address');
        console.log('No such symbol');
      }
      const myContract = new web3.eth.Contract(iface, contractAddress);
      const [
        error,
        lendBallance,
        borrowBalance,
        exchangeRate,
      ] = await myContract.methods
        .getAccountSnapshot(this.account.address)
        .call();
      const data = myContract.methods.redeem(lendBallance).encodeABI();
      this.executeTX(contractAddress, data, '0x0', 'redeemCToken');
    } else {
      const toRedeemHex = await this.convertToUnderlying(
        amount,
        contractAddress,
      );
      const myContract = new web3.eth.Contract(iface, contractAddress);
      // TODO: Replace with redeem and do the calculation yourself
      const data = myContract.methods.redeemUnderlying(toRedeemHex).encodeABI();
      this.executeTX(contractAddress, data, '0x0', 'redeemCToken');
    }
  }

  //// Borrowing ///////
  /**
   * Borrow the specified amount of underlying tokens.
   * Borrowing requires to "enter" at least one market where you have collateral
   * and the market you want to borrow from
   */
  private async borrowCToken(
    sym: string,
    amount: string,
    nonce?: number,
    gasLimit?: number,
  ) {
    const iface = CTOKEN_JSON_INTERFACE;
    const contractAddress = symbolToAddress(sym);
    if (contractAddress == '0x0') {
      console.log('No such symbol');
    }
    // TODO: Check the amount exists in the account
    const toBorrowHex = await this.convertToUnderlying(amount, contractAddress);

    const myContract = new web3.eth.Contract(iface, contractAddress);
    const data = myContract.methods.borrow(toBorrowHex).encodeABI();
    await this.executeTX(
      contractAddress,
      data,
      '0x0',
      'borrow',
      nonce,
      gasLimit,
    );
  }

  /**
   * Restore a client address for DB if exists, or generate a new one
   */
  private async restoreOrGenerate(): Promise<Account> {
    const addr = await this.db.get('address').value();
    if (
      !addr ||
      (Object.entries(addr).length === 0 && addr.constructor === Object)
    ) {
      return this.generateAddress();
    }
    return addr;
  }

  private async generateAddress(): Promise<Account> {
    const account = await web3.eth.accounts.create();
    this.db.set('address', account).write();
    return account;
  }

  private initDb(path: string) {
    ensureDirSync(CLIENT_DB_PATH);
    const adapter = new FileSync(path);
    this.db = low(adapter);
    this.db.defaults().write();
  }

  // Only estimate the gas cost of a transaction without execution
  private async estimateTX(
    contractAddress: string,
    data: string,
    value: string,
  ) {
    const nonce = await web3.eth.getTransactionCount(this.account.address);
    const gasPrice = Number(await web3.eth.getGasPrice()) * 2;
    const gasPriceHex = web3.utils.toHex(gasPrice);

    const gasLimit: number = await web3.eth.estimateGas({
      from: this.account.address,
      to: contractAddress,
      data: data,
      value: value,
    });
    const gasLimitHex = web3.utils.toHex(gasLimit);
    console.log('Gas Price: ', gasPrice);
    console.log('Gas Limit: ', gasLimit);
  }

  // Create a serialized tx from the passed values
  private async generateTX(
    contractAddress: string,
    data: string,
    value: string,
    nonce: number,
    gasLimit?: number,
  ) {
    const gasPrice = Number(await web3.eth.getGasPrice());
    const gasPriceHex = web3.utils.toHex(gasPrice);

    if (gasLimit == null) {
      gasLimit = await web3.eth.estimateGas({
        from: this.account.address,
        to: contractAddress,
        data: data,
        value: value,
      });
    }
    const gasLimitHex = web3.utils.toHex(gasLimit);

    console.log('Gas Price: ', gasPrice);
    console.log('Gas Limit: ', gasLimit);

    const txParams = {
      nonce,
      gasPrice: gasPriceHex,
      gasLimit: gasLimitHex,
      to: contractAddress,
      data: data,
      value: value,
    };
    const tx = new Transaction(txParams, {
      chain: CHAIN,
    });
    console.log(`TX: ${tx}`);
    return tx;
  }

  // Sign the transaction and return the sign hex value
  private async signTX(tx: Transaction): Promise<Buffer> {
    console.log('signing tx...');
    // alternatively, we can call `tx.hash()` and sign it using an external signer
    tx.sign(Buffer.from(this.account.privateKey, 'hex'));

    const serializedTx = tx.serialize();
    return tx.serialize();
  }

  // Broadcast the transaction to the provider, and return the receipt
  private async broadcastTX(serializedTx: Buffer): Promise<TransactionReceipt> {
    const receipt = await web3.eth
      .sendSignedTransaction('0x' + serializedTx.toString('hex'))
      .on('transactionHash', (hash: string) => {
        console.log('-'.repeat(20));
        console.log('on(transactionHash): hash =', hash);
      })
      .on('receipt', (receipt: TransactionReceipt) => {
        console.log('-'.repeat(20));
        console.log('on(receipt): receipt =', receipt);
      })
      .on('error', (error: Error) => {
        console.log('-'.repeat(20));
        console.log('on(error): error =', error);
      });
    return receipt;
  }

  /**
   * Execute web3 transaction with passed parameters
   * Create serialized transaction
   * Sign
   * Broadcast
   */
  private async executeTX(
    contractAddress: string,
    data: string,
    value: string,
    methodName: string,
    nonce?: number,
    gasLimit?: number,
  ) {
    if (nonce == null) {
      nonce = await web3.eth.getTransactionCount(this.account.address);
    }
    console.log('Nonce: ', nonce);
    const tx = await this.generateTX(
      contractAddress,
      data,
      value,
      nonce,
      gasLimit,
    );
    const serializedTx = await this.signTX(tx);
    try {
      const receipt = await this.broadcastTX(serializedTx);
      console.log('Receipt', receipt);
      const gasUsed = await extractGasUsedFromReceipt(receipt);
      console.log('Gas Used', gasUsed);
      // Update the gas estimation according to the receipt
      if (gasUsed > 0) {
        await this.gasEstimator.readAndUpdate(methodName, gasUsed);
      }
      // If the transaction failed on inefficient gas, try to estimate gas
      // with API and retransmit.
    } catch (e) {
      // TODO: Check the failure is due to gas limit
      console.log('Trasanction execution failed for low gas, estimating...');
      const gasLimit: number = await web3.eth.estimateGas({
        from: this.account.address,
        to: contractAddress,
        data: data,
        value: value,
      });
      // In case of failure, we update the gas according to the
      // value received from estimate gas
      await this.gasEstimator.readAndUpdate(methodName, gasLimit);
      console.log('Excuting again');
      // Need to get a new nonce, failed transaction increases the nonce
      const nonce = await web3.eth.getTransactionCount(this.account.address);
      const tx = await this.generateTX(
        contractAddress,
        data,
        value,
        nonce,
        gasLimit,
      );
      const serializedTx = await this.signTX(tx);
      const receipt = await this.broadcastTX(serializedTx);
    }
  }

  /**
   * Get the address of the underlying ERC20 contract, related to the
   * cToken. Not relevant for ETH
   */
  private async getUnderlyingAddress(
    iface: AbiItem[],
    contractAddress: string,
  ): Promise<string> {
    const myContract = new web3.eth.Contract(iface, contractAddress);
    const getUnderlying = myContract.methods.underlying().encodeABI();
    const underlyingAddress = await web3.eth.call({
      to: contractAddress,
      data: getUnderlying,
    });
    if (typeof underlyingAddress === 'string') {
      const strippedAddress = '0x' + underlyingAddress.substr(-40);
      return strippedAddress;
    } else {
      return '0x0';
    }
  }

  /**
   * Converts a number in human readable format to the correct hexadecimal
   * value required by the underlying ERC20 token.
   * Notice this receives the cToken address, and polls for decimals of the
   * underlying contract
   * TODO: This can be optimized with a simple mapping
   */
  private async convertToUnderlying(
    amount: string,
    contractAddress: string,
  ): Promise<string> {
    const base: Decimal = new Decimal(10);
    const underlyingDecimals = await this.getUnderlyingDecimals(
      contractAddress,
    );
    const coefficient: Decimal = base.pow(underlyingDecimals);
    const decimal: Decimal = coefficient.mul(Number(amount));
    const hex = decimal.toHex();
    return hex;
  }

  // Returns the accrued supply interest in units of the underlying token
  public async accruedInterest(sym: string): Promise<string> {
    const apiCall = addressAPI + this.account.address;
    const response = await fetch(apiCall);
    const json: addressResponse = await response.json();
    // Without errors, there should only be one returned accout
    const tokens: TokenInfo[] = json.accounts[0].tokens;
    for (const token of tokens) {
      const isym = addressToSymbol(token.address);
      if (isym === sym) {
        return token.lifetime_supply_interest_accrued.value;
      }
    }
    return 'No such token for address';
  }

  // Liquidate an outstanding borrower.
  // Receives the address of the liquidated account
  // The symbol to liquidate (the borrow you will pay on behalf)
  // The amount to pay in underlying value
  // The symbol for the collateral to be received in exchange
  public async liquidate(
    account: string,
    borrowedSym: string,
    amount: string, // should be in underlying already
    collateralSym: string,
  ) {
    const iface = CTOKEN_JSON_INTERFACE;
    const collateralAddress = symbolToAddress(collateralSym);
    if (collateralAddress == '0x0') {
      throw new Error('Unable to get contract address');
      console.log('No such symbol');
    }

    const borrowedAddress = symbolToAddress(borrowedSym);
    if (borrowedAddress == '0x0') {
      throw new Error('Unable to get contract address');
      console.log('No such symbol');
    }
    // TODO: The repaid token needs to first be approved

    const base: Decimal = new Decimal(10);
    const decimals = 18;
    const coefficient: Decimal = base.pow(decimals);
    const decimal = coefficient.mul(Number(amount)).toString();
    // const hexAmount = decimal.toHex();

    const myContract = new web3.eth.Contract(iface, borrowedAddress);
    const data = myContract.methods
      .liquidateBorrow(account, decimal, collateralAddress)
      .encodeABI();

    await this.executeTX(borrowedAddress, data, '0x0', 'liquidate');
  }
}

// Interfaces for api call responses
interface addressResponse {
  accounts: addressInfo[];
}

interface addressInfo {
  address: string;
  health: KeyValue;
  tokens: TokenInfo[];
}

interface TokenInfo {
  address: string;
  lifetime_supply_interest_accrued: KeyValue;
}

interface KeyValue {
  value: string;
}

function ensureDirSync(dirpath: string) {
  try {
    fs.mkdirSync(dirpath, { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

/**
 * Return the cToken contract address of the given symbol
 * 0x0 if no symbol
 */
function symbolToAddress(sym: string): string {
  switch (sym) {
    case 'cbat': {
      return config.cBATContract;
      break;
    }
    case 'cdai': {
      return config.cDAIContract;
      break;
    }
    case 'ceth': {
      return config.cETHContract;
      break;
    }
    case 'crep': {
      return config.cREPContract;
      break;
    }
    case 'csai': {
      return config.cSAIContract;
      break;
    }
    case 'cusdc': {
      return config.cUSDCContract;
      break;
    }
    case 'cwbtc': {
      return config.cWBTCContract;
      break;
    }
    case 'czrx': {
      return config.cZRXContract;
      break;
    }
  }
  return '0x0';
}

/**
 * Covert address to symbol
 */
function addressToSymbol(address: string): string {
  switch (address) {
    case config.cBATContract: {
      return 'cbat';
      break;
    }
    case config.cDAIContract: {
      return 'cdai';
      break;
    }
    case config.cETHContract: {
      return 'ceth';
      break;
    }
    case config.cREPContract: {
      return 'crep';
      break;
    }
    case config.cSAIContract: {
      return 'csai';
      break;
    }
    case config.cUSDCContract: {
      return 'cusdc';
      break;
    }
    case config.cWBTCContract: {
      return 'cwbtc';
      break;
    }
    case config.cZRXContract: {
      return 'czrx';
      break;
    }
  }
  return '0x0';
}

async function extractGasUsedFromReceipt(
  txReceipt: TransactionReceipt,
): Promise<number> {
  try {
    const gasUsed = txReceipt.gasUsed;
    return gasUsed;
  } catch (e) {
    console.log(e);
  }
  return 0;
}
