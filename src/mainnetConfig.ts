export const config = {
  cBATContract: "0x6c8c6b02e7b2be14d4fa6022dfd6d75921d90e4e",
  cDAIContract: "0x5d3a536e4d6dbd6114cc1ead35777bab948e3643",
  cETHContract: "0x4ddc2d193948926d02f9b1fe9e1daa0718270ed5",
  cREPContract: "0x158079ee67fce2f58472a96584a73c7ab9ac95c1",
  cSAIContract: "0xf5dce57282a584d2746faf1593d3121fcac444dc",
  cUSDCContract: "0x39aa39c021dfbae8fac545936693ac917d5e7563",
  cWBTCContract: "0xc11b1268c1a384e55c48c2391d8d480264a3a7f4",
  cZRXContract: "0xb3319f5d18bc0d84dd1b4825dcde5d5f7266d407",
  comptrollerContract: "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b",
  priceOracleContract: "0xc7e20cf485b8e0bcec3e2fcc23e3ad93b1b0cb39"
};

// List of all markets on ropsten chain, should be in separate config
export const markets_list: string[] = [
  config.cBATContract,
  config.cDAIContract,
  config.cETHContract,
  config.cREPContract,
  config.cSAIContract,
  config.cUSDCContract,
  config.cWBTCContract,
  config.cZRXContract
];

export const cTokenAPI = "https://api.compound.finance/api/v2/ctoken";
export const addressAPI =
  "https://api.compound.finance/api/v2/account?addresses[]=";
