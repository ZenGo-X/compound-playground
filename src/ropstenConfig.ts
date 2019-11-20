export const config = {
  cDAIContract: "0x2b536482a01e620ee111747f8334b395a42a555e",
  cETHContract: "0x42a628e0c5f3767930097b34b08dcf77e78e4f2b",
  comptrollerContract: "0xb081cf57b1e422b3e627544ec95992cbe8eaf9cb",
  priceOracleContract: "0xc7e20cf485b8e0bcec3e2fcc23e3ad93b1b0cb39"
};

// List of all markets on ropsten chain, should be in separate config
export const markets_list: string[] = [
  "0x189ca88be39c9c1b8c8dd437f5ff1db1f584b14b",
  "0x2b536482a01e620ee111747f8334b395a42a555e",
  "0x42a628e0c5f3767930097b34b08dcf77e78e4f2b",
  "0xa3c2c1618214549281e1b15dee9d682c8aa0dc1c",
  "0x43a1363afb28235720fcbdf0c2dab7759091f7e0",
  "0x06e728d7907c164649427d2acfd4c81669d453bf",
  "0xdff375162cfe7d77473c1bec4560dede974e138c"
];

export const cTokenAPI = "https://api.compound.finance/api/v2/ctoken";
