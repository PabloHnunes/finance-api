export class PaginatedResponse<T> {
  list: T[];
  count: number;

  constructor(list: T[], count: number) {
    this.list = list;
    this.count = count;
  }
}
