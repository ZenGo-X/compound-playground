import Decimal from "decimal.js";

const EthereumTx = require("ethereumjs-tx").Transaction;
import Web3 from "web3";
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://ropsten.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99"
  )
);
import { config } from "./config";
import { CDAI_JSON_INTERFACE } from "./cDAI-interface";
import { PRICE_ORACLE_INTERFACE } from "./priceOracle-interface";

const cDAIcontract = new web3.eth.Contract(
  CDAI_JSON_INTERFACE,
  config.cDAIContract
);

const priceOracleContract = new web3.eth.Contract(
  PRICE_ORACLE_INTERFACE,
  config.priceOracleContract
);

async function getBalance() {
  const balance = await cDAIcontract.methods
    .balanceOf(config.senderAddress)
    .call();
  console.log("balance =", balance); // in the smallest unit (w.r.t decimals defined in contract)
  // balance = 6
  const decimals = await cDAIcontract.methods.decimals().call();
  console.log("decimals =", decimals);
  // decimals = 18
  const base: Decimal = new Decimal(10);
  const coefficient: Decimal = base.pow(-decimals);
  const actualBalance: Decimal = coefficient.mul(balance);
  console.log("actualBalance =", actualBalance.toString());
  return actualBalance;
}

async function getPrice() {
  const price = await priceOracleContract.methods
    .getUnderlyingPrice(config.cDAIContract)
    .call();
  console.log("price =", price); // in the smallest unit (w.r.t decimals defined in contract)
  // balance = 6
  const decimals = await cDAIcontract.methods.decimals().call();
  console.log("decimals =", decimals);
  // decimals = 18
  const base: Decimal = new Decimal(10);
  const coefficient: Decimal = base.pow(-decimals);
  const actualPrice: Decimal = coefficient.mul(price);
  console.log("Actual Price =", actualPrice.toString());
  return actualPrice;
}

async function getExchangeRate() {
  const price = await cDAIcontract.methods
    .getUnderlyingPrice(config.cDAIContract)
    .call();
  console.log("price =", price); // in the smallest unit (w.r.t decimals defined in contract)
  // balance = 6
  const decimals = await cDAIcontract.methods.decimals().call();
  console.log("decimals =", decimals);
  // decimals = 18
  const base: Decimal = new Decimal(10);
  const coefficient: Decimal = base.pow(-decimals);
  const actualPrice: Decimal = coefficient.mul(price);
  console.log("Actual Price =", actualPrice.toString());
  return actualPrice;
}

(async () => {
  const balance = await getBalance();
  const price = await getPrice();
  console.log("Balance in underlying:", balance.dividedBy(price).toString());
})();
