import crypto from "crypto";
import fs from "fs";
import path from "path";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
import { CompAddress } from "./compAddress";
import { AbiItem } from "web3-utils";

const fetch = require("node-fetch");
const CHAIN = "mainnet";

// TODO add logic to configure by network
import { cTokenAPI } from "./ropstenConfig";

const CLIENT_DB_PATH = path.join(__dirname, "../../client_db");

export async function getAPR(token: string): Promise<string> {
  const response = await fetch(cTokenAPI);
  const json = await response.json(); //extract JSON from the http response
  const cTokens: Object = eval(json)["cToken"];
  for (const [index, cToken] of Object.entries(cTokens)) {
    const sym: string = cToken["symbol"];
    if (sym.toLowerCase() === token) {
      return cToken["supply_rate"]["value"];
    }
  }
  return "Unknown token";
}
