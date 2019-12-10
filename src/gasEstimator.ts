import fs from "fs";
import path from "path";
import low from "lowdb";
import FileSync from "lowdb/adapters/FileSync";
const PRICES_DB_PATH = path.join(__dirname, "../../client_db/");

export interface LimitsDict {
  [method: string]: number;
}

const MARGIN = 1.3;

export class GasEstimator {
  private db: any;
  private limits: LimitsDict;

  constructor() {
    this.initDB(PRICES_DB_PATH);
  }

  public async loadData() {
    let limits = await this.db.get("limits").value();
    if (Object.entries(limits).length === 0 && limits.constructor === Object) {
      this.limits = {};
    } else {
      this.limits = limits;
    }
  }

  public async getLimit(method: string): Promise<number> {
    if (method in this.limits) {
      return Math.round(this.limits[method] * MARGIN);
    } else {
      this.limits[method] = 0;
      await this.db.set("limits", this.limits).write();
    }
    return 0;
  }

  public async readAndUpdate(method: string, measured_limit: number) {
    console.log("Reading gas for ", method);
    if (method in this.limits) {
      console.log("Updating gas for ", method);
      let current_limit = this.limits[method];
      if (measured_limit > current_limit) {
        this.limits[method] = measured_limit;
        await this.db.set("limits", this.limits).write();
      }
      // A new method was called
    } else {
      console.log("Creating gas for ", method);
      this.limits[method] = measured_limit;
      await this.db.set("limits", this.limits).write();
    }
    return;
  }

  private initDB(path: string) {
    ensureDirSync(path);
    const adapter = new FileSync(path + "/gas_limits.json");
    this.db = low(adapter);
    this.db.defaults().write();
  }
}

function ensureDirSync(dirpath: string) {
  try {
    fs.mkdirSync(dirpath, { recursive: true });
  } catch (err) {
    if (err.code !== "EEXIST") throw err;
  }
}
