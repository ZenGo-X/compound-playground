# Compound playground
Script for basic interaction with the Compound suite of smart contracts

## Usage

```sh
$ yarn install
$ yarn run build
$ ./demo/client <option>
```

### Options to use on clinet:
`balance <token>`  
Get your balance in cToken or underlyting Token
Example
`./demo/client dai`
`./demo/client cdai`


`mint <token> <amount>`  
Supply the passed amount to compund cToken contract. Amount is specified in underlying token.
Example, to supply 100 DAI to compund:
`./demo/client mint cdai 100`

`redeem <token> <amount>`
Redeem an amount coresponding to the underlying token.
Example, to redeem 50 DAI from compund:
`./demo/client redeem cdai 50`
