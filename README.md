# ERC20 playground
Ethereum ERC20 playground for ZenGo integration.

## Usage

```sh
$ yarn install
$ yarn run build
$ node ./dist/src/<script>
```
where `<script>` is any of the following: <br>
* `get-balance`
* `get-history`
* `listen-receive-token`
* `send-token`

## Comments & Potential issues

0) Repository of existing tokens with their addresses and icons:
https://github.com/MetaMask/eth-contract-metadata
1) Infura web-sockets support still may be not the most stable option. Needs to be tested extensively.
https://github.com/INFURA/infura/issues/97
2) We should keep track of Infura usage as part of overall monitoring.
   We're currently approaching a bit more than 50% of daily API limit.
