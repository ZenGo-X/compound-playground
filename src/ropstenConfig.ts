export const config = {
  cBATContract: '0x9e95c0b2412ce50c37a121622308e7a6177f819d',
  cDAIContract: '0xdb5ed4605c11822811a39f94314fdb8f0fb59a2c',
  cETHContract: '0xbe839b6d93e3ea47effcca1f27841c917a8794f3',
  cREPContract: '0x8f2c8b147a3d316d2b98f32f3864746f034a55a2',
  cSAIContract: '0xc4d2a5872e16bc9e6557be8b24683d96eb6adca9',
  cUSDCContract: '0x8af93cae804cc220d1a608d4fa54d1b6ca5eb361',
  cUSDTContract: '0x135669c2dcbd63f639582b313883f101a4497f76',
  cWBTCContract: '0x58145bc5407d63daf226e4870beeb744c588f149',
  cZRXContract: '0x00e02a5200ce3d5b5743f5369deb897946c88121',

  COMPContract: '0x1fe16de955718cfab7a44605458ab023838c2793',
  comptrollerContract: '0x54188bbedd7b68228fa89cbdda5e3e930459c6c6',
  priceOracleContract: '0xb2b3d5b4e35881d518fa2062325f118a6ebb6c4a',
  compoundLensContract: '0xB272C5C22850CcEB72C6D45DFBDbDE0D9433b036',
};

// List of all markets on ropsten chain, should be in separate config
export const marketsList: string[] = [
  config.cETHContract,
  config.cUSDCContract,
  config.cUSDTContract,
  config.cREPContract,
  config.cWBTCContract,
  config.cBATContract,
  config.cDAIContract,
  config.cSAIContract,
  config.cZRXContract,
];

export const cTokenAPI = 'https://api.compound.finance/api/v2/ctoken';
export const addressAPI =
  'https://api.compound.finance/api/v2/account?addresses[]=';
