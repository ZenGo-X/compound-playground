const EthereumTx = require("ethereumjs-tx").Transaction;
import Web3 from "web3";
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://ropsten.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99"
  )
);
import { config } from "./config";
import { ERC20_INERFACE } from "./erc20-interface";
import { CDAI_JSON_INTERFACE } from "./cDAI-interface";

const cDAIContract = new web3.eth.Contract(
  CDAI_JSON_INTERFACE,
  config.cDAIContract
);

(async function approveMarket() {
  const cDAIcall = cDAIContract.methods.underlying().encodeABI();

  let underlyingAddress = await web3.eth.call({
    to: config.cDAIContract,
    data: cDAIcall
  });
  // Returned result needs to be truncated to legal address length
  underlyingAddress = "0x" + underlyingAddress.substr(-40);
  console.log(`Underlying address of DAI ${underlyingAddress}`);

  const nonce = await web3.eth.getTransactionCount(config.senderAddress);
  let gasPrice = Number(await web3.eth.getGasPrice());
  console.log("gasPrice =", gasPrice);
  let gasPriceHex = web3.utils.toHex(gasPrice);
  console.log("gasPrice #2 =", gasPriceHex);

  let balance = await web3.eth.getBalance(config.senderAddress);
  console.log(`Balance ${balance}`);

  const DAIContract = new web3.eth.Contract(
    ERC20_INERFACE,

    underlyingAddress
  );

  const max_val = "0xffffffffffffffffffffffffffffffffffffffff";
  const DAIcall = cDAIContract.methods
    .approve(config.cDAIContract, max_val)
    .encodeABI();

  let gasLimit: number = await web3.eth.estimateGas({
    from: config.senderAddress,
    to: underlyingAddress,
    data: DAIcall
  });
  console.log("gasLimit =", gasLimit);
  // Might need to pad transaction
  let gasLimitHex = web3.utils.toHex(gasLimit);
  console.log("gasLimit #2 =", gasLimitHex);

  const txParams = {
    nonce,
    gasPrice: gasPriceHex,
    gasLimit: gasLimitHex,
    to: underlyingAddress,
    data: DAIcall,
    value: "0x00"
  };
  const tx = new EthereumTx(txParams, {
    chain: "ropsten"
  });
  console.log(`TX: ${tx}`);

  console.log("signing tx...");
  // alternatively, we can call `tx.hash()` and sign it using an external signer
  tx.sign(Buffer.from(config.senderPrivateKey, "hex"));

  const serializedTx = tx.serialize();
  console.log("serializedTx =", serializedTx.toString("hex"));

  web3.eth
    .sendSignedTransaction("0x" + serializedTx.toString("hex"))
    .on("transactionHash", (hash: string) => {
      console.log("-".repeat(20));
      console.log("on(transactionHash): hash =", hash);
    })
    .on("receipt", (receipt: any) => {
      console.log("-".repeat(20));
      console.log("on(receipt): receipt =", receipt);
    })
    .on("confirmation", (confirmation: number, receipt: any) => {
      console.log("-".repeat(20));
      console.log("on(confirmation): confirmation =", confirmation);
      console.log("on(confirmation): receipt =", receipt);
    })
    .on("error", (error: Error) => {
      console.log("-".repeat(20));
      console.log("on(error): error =", error);
    });
})();
