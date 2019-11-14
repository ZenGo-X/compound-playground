const EthereumTx = require('ethereumjs-tx').Transaction;
import Web3 from 'web3';
const web3 = new Web3(new Web3.providers.HttpProvider('https://ropsten.infura.io/v3/3d93a3a00252437cb50e9a81ad147c99'));
import {config} from './config';
import {CDAI_JSON_INTERFACE} from "./cDAI-interface";

const myContract = new web3.eth.Contract(
    CDAI_JSON_INTERFACE,
    config.cDAIContract
);


(async function redeem() {
    const cDAIcall = myContract.methods.balanceOf(config.senderAddress).encodeABI();

    let balanceInDai = await web3.eth.call({
      to: config.cDAIContract,
      data: cDAIcall,
    })

    console.log(`Balance in Dai ${balanceInDai}`);

    const nonce = await web3.eth.getTransactionCount(config.senderAddress);
    let gasPrice = Number(await web3.eth.getGasPrice());
    console.log('gasPrice =', gasPrice);
    let gasPriceHex = web3.utils.toHex(gasPrice);
    console.log('gasPrice #2 =', gasPriceHex);

    const toRedeem  = balanceInDai;
    console.log(`To redeem ${toRedeem}`);
    const data = myContract.methods.redeem(toRedeem).encodeABI();
    console.log('data =', data);

    let gasLimit:number = await web3.eth.estimateGas({
        from: config.senderAddress,
        to: config.cDAIContract,
        data
    });
    console.log('gasLimit =', gasLimit);
    let gasLimitHex = web3.utils.toHex(gasLimit)
    console.log('gasLimit #2 =', gasLimitHex);

    const txParams = {
        nonce,
        gasPrice: gasPriceHex,
        gasLimit: gasLimitHex,
        to: config.cDAIContract,
        data,
        value: "0x0"
    };
    const tx = new EthereumTx(txParams, {
        chain: 'ropsten'
    });
    console.log(`TX: ${tx}`);

    console.log('signing tx...');
    // alternatively, we can call `tx.hash()` and sign it using an external signer
    tx.sign(Buffer.from(config.senderPrivateKey, 'hex'));

    const serializedTx = tx.serialize();
    console.log('serializedTx =', serializedTx.toString('hex'));

    await web3.eth.sendSignedTransaction('0x' + serializedTx.toString('hex'))
        .on('transactionHash', (hash: string) => {
            console.log('-'.repeat(20));
            console.log('on(transactionHash): hash =', hash);
        })
        .on('receipt', (receipt: any) => {
            console.log('-'.repeat(20));
            console.log('on(receipt): receipt =', receipt)
        })
        .on('confirmation', (confirmation: number, receipt: any) => { 
            console.log('-'.repeat(20));
            console.log('on(confirmation): confirmation =', confirmation);
            console.log('on(confirmation): receipt =', receipt)
        })
        .on('error', (error: Error) => {
            console.log('-'.repeat(20));
            console.log('on(error): error =', error)
        });
})();


