import { User } from "../entities/user.entitiy";
import { DomainError } from "../common";
import { UserRepository } from "../repositories/user.repository";

export class UserAlreadyExistsError extends DomainError {
  constructor(externalId: string) {
    super(`User with externalId ${externalId} already exists`);
    this.name = "UserAlreadyExistsError";
  }
}

export class UserNotFoundError extends DomainError {
  constructor(externalId: string) {
    super(`User with externalId ${externalId} not found`);
    this.name = "UserNotFoundError";
  }
}

export class UserRegistrator {
  constructor(private readonly userRepo: UserRepository) {}

  async register(externalId: string, username: string): Promise<User> {
    const candidate = await this.userRepo.findByExternalId(externalId);
    if (candidate) {
      throw new UserAlreadyExistsError(externalId);
    }

    const user = User.create(externalId, username);
    await this.userRepo.save(user);

    return user;
  }

  async login(externalId: string): Promise<User> {
    const user = await this.userRepo.findByExternalId(externalId);
    if (!user) {
      throw new UserNotFoundError(externalId);
    }

    return user;
  };
}