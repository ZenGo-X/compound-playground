const EthereumTx = require("ethereumjs-tx").Transaction;
import Web3 from "web3";
const web3 = new Web3(
  new Web3.providers.HttpProvider(
    "https://ropsten.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99"
  )
);
import { config } from "./config";
import { COMPTROLLER_INTERFACE } from "./comptroller-interface";

const myContract = new web3.eth.Contract(
  COMPTROLLER_INTERFACE,
  config.comptrollerContract
);

// List of all markets on ropsten chain, should be in separate config
const markets_list: string[] = [
  "0x189ca88be39c9c1b8c8dd437f5ff1db1f584b14b",
  "0x2b536482a01e620ee111747f8334b395a42a555e",
  "0x42a628e0c5f3767930097b34b08dcf77e78e4f2b",
  "0xa3c2c1618214549281e1b15dee9d682c8aa0dc1c",
  "0x43a1363afb28235720fcbdf0c2dab7759091f7e0",
  "0x06e728d7907c164649427d2acfd4c81669d453bf",
  "0xdff375162cfe7d77473c1bec4560dede974e138c"
];

const data = myContract.methods.enterMarkets(markets_list).encodeABI();
console.log("data =", data);

(async function enterMarkets() {
  const nonce = await web3.eth.getTransactionCount(config.senderAddress);
  let gasPrice = Number(await web3.eth.getGasPrice());
  console.log("gasPrice =", gasPrice);
  let gasPriceHex = web3.utils.toHex(gasPrice);
  console.log("gasPrice #2 =", gasPriceHex);

  let gasLimit: number = await web3.eth.estimateGas({
    from: config.senderAddress,
    to: config.comptrollerContract,
    data
  });
  console.log("gasLimit =", gasLimit);
  // Might need to pad transaction
  let gasLimitHex = web3.utils.toHex(gasLimit);
  console.log("gasLimit #2 =", gasLimitHex);

  let balance = await web3.eth.getBalance(config.senderAddress);
  console.log(`Balance ${balance}`);

  const txParams = {
    nonce,
    gasPrice: gasPriceHex,
    gasLimit: gasLimitHex,
    to: config.comptrollerContract,
    data,
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
