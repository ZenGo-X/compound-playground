# Compound Playground

This demo app demonstrates basic interaction with the [compound](https://compound.finance) smart contracts system for supplying liquidity and borrowing funds.
This is a reference client if want to you integrate calls to compound smart contracts in your work.

This also demonstrates how to send multiple Ethereum transaction, without having to wait for each transaction to complete, a way to mitigate the baDAPProve security issue.

## Usage

### Building from source

```sh
yarn install
yarn run build
./demo/client <option>
```

Create a new client private key and addresses.

```
./demo/client --init
```

This will create a new file `./client_db/db.json` with a private key and address.

### Options to use on client:

#### Balances

- `balance <token>`  
  Get your balance in cToken or underlying Token:
  - `./demo/client dai`
  - `./demo/client cdai`
  - `./demo/client comp`

#### Supplying and borrowing

- `appmint <cToken> <amount>`  
  This operation demonstrates the discussed technique above. GasLimit for the approve and mint transactions is read from the database. Both transactions are created and signed with nonce=`n` and nonce=`n+1` respectively.  
  Both transactions are then broadcaster to the network _asyncronously_.  
  Example, to supply 100 DAI to compound:  
  `./demo/client appmint cdai 100`

- `approve <cToken> <amount>`  
  Supply the passed amount to compound cToken contract. Amount is specified in underlying token.
  Example, to supply 100 DAI to compound:  
  `./demo/client mint cdai 100`

- `mint <cToken> <amount>`  
  Supply the passed amount to compound cToken contract. Amount is specified in underlying token.
  Example, to supply 100 DAI to compound:  
  `./demo/client mint cdai 100`

- `redeem <cToken> <amount>`  
  Redeem an amount corresponding to the underlying token.
  Example, to redeem 50 DAI from compound:  
  `./demo/client redeem cdai 50`

### COMP

- `comp_earned`  
  Get the amount of COMP earned by the client. This amount will be added to your COMP balance once a value above 0.001 is earned and some action is performed on compound.
  `./demo/client comp_earned`

- `claim_comp`  
  Manually claim the amount of COMP your have earned, regardless of whether the 0.001 threshold was reached.
  `./demo/client comp_earned`

## Dealing with baDAPProve

DeFi contracts actions such as lending typically require the pre-approval of a user to be able to transfer ERC20 tokens on his behalf.
This approval is done by calling the `approve` function of ERC20, where a sender permits a different address (i.e. spender, in this case the DeFi contract) to spend a given amount on his behalf.
This is usually a mandatory prerequisite before a user can continue to some core action as part of the interaction with the DeFi app.

### The security issue

The clear drawback of this solution it allows the contract to withdraw more than the user intended due to a bug, vulnerability etc.
Once a user approves an infinite amount, the contract might withdraw the entire balance of the approve ERC20.
The user might not even own any tokens at the moment of approval, the contract might still be able to withdraw them in the future.

### The parallelization issue

Sending both transactions (approve, action) in parallel can save time. However, when `estimateGas` function is called on the action Tx, it will not be updated with the results of the user approve, the function simulation will probably fail.
This might result in a wrong GasLimit estimation of the action transaction.
Consequently, the action Tx will fail upon broadcast.
Sending both transactions serially (waiting for the first to be confirmed before sending the other) could lead to long waiting periods between before the action is finally complete.

### The solution

A non compromise solution uses the fact that you can send several transactions in parallel, manually increasing the nonce.
You also need to manually specify the gasLimit for each transaction.  
This repository demonstrates how to execute these two transactions with minimal trade-offs between latency and security.

### Fee estimation algorithm

1. Estimate gas based on historical data and set it as **Gas_Limit**
2. Take a margin of **L**>1 and set **Limit_used** = **Gas_Limit** \* **L**
3. For each executed transaction(With **Limit_Used**), read the actual gas used: **Gas_used**
4. If **Gas_used** > **Gas_Limit**, set **Gas_Limit** = **Gas_used**, **Limit_used** = **Gas_used** \* **L**
5. If a transaction fails for insufficient gas:
   - Run `estimateGas()` on the failed transaction and obtain **Failed_Limit**
   - Create and sign a new transaction
   - Retransmit transaction with new estimation
   - Update **Gas_Limit** = **Failed_Limit**
   - Raise error for investigation

### Demo Gif

Recording of the `appmint` in action, sending two Txs asynchronously  
![demo](./assets/demo.gif)
