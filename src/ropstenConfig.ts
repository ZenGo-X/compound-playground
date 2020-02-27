export const config = {
  cBATContract: "0xa253295ec2157b8b69c44b2cb35360016daa25b1",
  cDAIContract: "0x6ce27497a64fffb5517aa4aee908b1e7eb63b9ff",
  cETHContract: "0x1d70b01a2c3e3b2e56fcdcefe50d5c5d70109a5d",
  cREPContract: "0x5d4373f8c1af21c391ad7ec755762d8dd3cca809",
  cSAIContract: "0xccaf265e7492c0d9b7c2f0018bf6382ba7f0148d",
  cTBTCContract: "0xb40d042a65dd413ae0fd85becf8d722e16bc46f1",
  cUSDCContract: "0x20572e4c090f15667cf7378e16fad2ea0e2f3eff",
  cWBTCContract: "0x4d15ee7de1f86248c986f5ae7dce855b1c1a8806",
  cZRXContract: "0x3a728dd027ad6f76cdea227d5cf5ba7ce9390a3d",

  comptrollerContract: "0xb081cf57b1e422b3e627544ec95992cbe8eaf9cb",
  priceOracleContract: "0xc7e20cf485b8e0bcec3e2fcc23e3ad93b1b0cb39"
};

// List of all markets on ropsten chain, should be in separate config
export const marketsList: string[] = [
  config.cETHContract,
  config.cUSDCContract,
  config.cREPContract,
  config.cWBTCContract,
  config.cBATContract,
  config.cDAIContract,
  config.cSAIContract,
  config.cZRXContract
];

export const cTokenAPI = "https://api.compound.finance/api/v2/ctoken";
export const addressAPI =
  "https://api.compound.finance/api/v2/account?addresses[]=";
