import { JsSqlStore } from '../storage/jsSql'

export class MemorySqlStore extends JsSqlStore {
  close(): void {}
}
