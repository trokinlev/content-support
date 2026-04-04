import { User } from "../entities/user.entitiy";

export interface UserRepository {
  findByExternalId(id: string): Promise<User | null>;
  save(user: User): Promise<void>;
}
