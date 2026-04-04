export class DomainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export interface Notifier {
  sendMessage(message: string): Promise<void>;
}