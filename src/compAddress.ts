export class CompAddress {
  private address: string;
  private privateKey: string;

  constructor(address: string, privateKey: string) {
    this.address = address;
    this.privateKey = privateKey;
  }

  public getAddress() {
    return this.address;
  }

  public getPrivateKey() {
    return this.privateKey;
  }

  public static fromPlain(plain: any): CompAddress {
    return new CompAddress(plain.address, plain.privateKey);
  }
}
