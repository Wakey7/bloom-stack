import { PIECE_TYPES } from "./pieces.js";

export class SevenBag {
  constructor(random = Math.random) {
    this.random = random;
    this.bag = [];
  }

  next() {
    if (this.bag.length === 0) this.refill();
    return this.bag.pop();
  }

  refill() {
    this.bag = [...PIECE_TYPES];
    for (let index = this.bag.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(this.random() * (index + 1));
      [this.bag[index], this.bag[swapIndex]] = [this.bag[swapIndex], this.bag[index]];
    }
  }
}
