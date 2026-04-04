export class Channel {
  private constructor(
    private readonly _id: string,
    private _title: string,
    private _rtpmUrl: string,
    private _key: string,
  ) {}
}
